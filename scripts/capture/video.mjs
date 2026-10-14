/**
 * Frames in, video out.
 *
 * Chrome's screencast sends a frame whenever the page changes, each with a
 * timestamp. While capturing, a scene can also move the camera — zoom in on
 * Wendmark's panel, back out to the page — and each move is noted with its
 * time (camera.mjs). Encoding then crops every frame to where the camera was,
 * at a steady 30 fps, and writes:
 *
 *   <name>.mp4   H.264, plays everywhere
 *   <name>.webm  VP9, smaller, preferred where supported
 *   <name>.jpg   the poster, shown before the video starts
 *   <name>.gif   for GitHub READMEs, which do not autoplay video files.
 *                Written next to the frames, not into the site: the site
 *                serves the video, and a GIF there would only add weight.
 *
 * Stills — the screenshots in the docs — are taken during the same scenes,
 * so they always show the current Wendmark.
 */

import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { render, viewFor } from './camera.mjs'

/** The bounding box of a locator, or of several, in CSS pixels. */
async function boxOf(target) {
  if (!target) return null
  if ('x' in target && 'width' in target) return target
  // Every element each locator matches: "the list of steps" is several.
  const targets = Array.isArray(target) ? target : [target]
  const elements = (await Promise.all(targets.map((one) => one.all()))).flat()
  const boxes = (await Promise.all(elements.map((one) => one.boundingBox()))).filter(Boolean)
  if (boxes.length === 0) return null
  const left = Math.min(...boxes.map((box) => box.x))
  const top = Math.min(...boxes.map((box) => box.y))
  const right = Math.max(...boxes.map((box) => box.x + box.width))
  const bottom = Math.max(...boxes.map((box) => box.y + box.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export async function startCapture(page, dir) {
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  const cdp = await page.context().newCDPSession(page)
  const viewport = page.viewportSize()
  const frames = []
  const writes = []
  const moves = []

  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`)
    frames.push({ file, t: metadata.timestamp })
    writes.push(writeFile(file, Buffer.from(data, 'base64')))
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })

  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 95,
    maxWidth: viewport.width * 2,
    maxHeight: viewport.height * 2,
    everyNthFrame: 1,
  })

  return {
    /**
     * Points the camera at a locator (or several, or a box), or back at
     * the whole page with null. The move itself happens at encode time.
     */
    async focus(target, options) {
      const box = await boxOf(target)
      moves.push({ t: Date.now() / 1000, view: viewFor(box, viewport, options) })
    },
    async stop() {
      await cdp.send('Page.stopScreencast')
      const end = Date.now() / 1000
      await Promise.all(writes)
      await writeFile(
        path.join(dir, 'capture.json'),
        JSON.stringify({ frames, end, moves, viewport }, null, 1),
      )
      await cdp.detach()
      return frames.length
    },
  }
}

/**
 * A screenshot for the docs: `target` and some room around it, at device
 * resolution, as WebP. Without a target, the whole page.
 */
export async function still(page, out, name, target, { padding = 32 } = {}) {
  const viewport = page.viewportSize()
  const box = await boxOf(target)
  let clip = { x: 0, y: 0, width: viewport.width, height: viewport.height }
  if (box) {
    const x = Math.max(box.x - padding, 0)
    const y = Math.max(box.y - padding, 0)
    clip = {
      x,
      y,
      width: Math.min(box.x + box.width + padding, viewport.width) - x,
      height: Math.min(box.y + box.height + padding, viewport.height) - y,
    }
  }

  const png = await page.screenshot({ clip, scale: 'device', animations: 'disabled' })
  await mkdir(out, { recursive: true })
  const file = path.join(out, `${name}.webp`)
  await sharp(png).webp({ quality: 90 }).toFile(file)
  const meta = await sharp(file).metadata()
  console.log(`  still ${name}: ${meta.width}×${meta.height}`)
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      stdio: 'inherit',
    })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))))
  })
}

/**
 * `posterAt` picks the poster frame, in seconds from the start; by default
 * the last frame, the process at its most complete.
 */
export async function encode(dir, out, name, { posterAt } = {}) {
  const captured = JSON.parse(await readFile(path.join(dir, 'capture.json'), 'utf8'))
  const frames = await render(captured, dir)
  const mp4 = path.join(out, `${name}.mp4`)

  // 1920 wide: sharp on a high-density screen at the size the site shows it.
  await ffmpeg([
    '-framerate', String(frames.fps), '-i', frames.pattern,
    '-vf', 'format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-tune', 'animation',
    '-movflags', '+faststart', '-an', mp4,
  ])
  await ffmpeg([
    '-i', mp4,
    '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1', '-deadline', 'good',
    '-an', path.join(out, `${name}.webm`),
  ])
  const seek = posterAt === undefined ? ['-sseof', '-0.1'] : ['-ss', String(posterAt)]
  await ffmpeg([...seek, '-i', mp4, '-frames:v', '1', '-q:v', '3', path.join(out, `${name}.jpg`)])
  // GIF: smaller and slower, with a palette made for this clip.
  await ffmpeg([
    '-i', mp4,
    '-filter_complex',
    'fps=15,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
    path.join(dir, '..', `${name}.gif`),
  ])
  await rm(frames.dir, { recursive: true, force: true })
  console.log(`  ${name}: mp4, webm and jpg in public/media, gif in .capture`)
}
