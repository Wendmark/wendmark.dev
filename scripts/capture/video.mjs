/**
 * Frames in, video out.
 *
 * Chrome's screencast sends a frame whenever the page changes, each with a
 * timestamp. Holding each frame for exactly as long as it was on screen
 * gives a clip with true timing, which ffmpeg then resamples to a steady
 * 30 fps and encodes three ways:
 *
 *   <name>.mp4   H.264, plays everywhere
 *   <name>.webm  VP9, smaller, preferred where supported
 *   <name>.jpg   the poster, shown before the video starts
 *   <name>.gif   for GitHub READMEs, which do not autoplay video files.
 *                Written next to the frames, not into the site: the site
 *                serves the video, and a GIF there would only add weight.
 */

import { spawn } from 'node:child_process'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'

export async function startCapture(page, dir) {
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  const cdp = await page.context().newCDPSession(page)
  const frames = []
  const writes = []

  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`)
    frames.push({ file, t: metadata.timestamp })
    writes.push(writeFile(file, Buffer.from(data, 'base64')))
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })

  const viewport = page.viewportSize()
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 95,
    maxWidth: viewport.width * 2,
    maxHeight: viewport.height * 2,
    everyNthFrame: 1,
  })

  return {
    async stop() {
      await cdp.send('Page.stopScreencast')
      const end = Date.now() / 1000
      await Promise.all(writes)
      // Each frame stays up until the next one arrives; the last until now.
      const lines = []
      frames.forEach((frame, i) => {
        const next = frames[i + 1]?.t ?? end
        lines.push(`file '${frame.file}'`, `duration ${Math.max(next - frame.t, 0.001).toFixed(4)}`)
      })
      // The concat format needs the last file repeated to honour its duration.
      if (frames.length) lines.push(`file '${frames[frames.length - 1].file}'`)
      await writeFile(path.join(dir, 'frames.txt'), lines.join('\n'))
      await cdp.detach()
      return frames.length
    },
  }
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
  const list = ['-f', 'concat', '-safe', '0', '-i', path.join(dir, 'frames.txt')]
  const mp4 = path.join(out, `${name}.mp4`)

  // 1920 wide: sharp on a high-density screen at the size the site shows it.
  await ffmpeg([
    ...list,
    '-vf', 'fps=30,scale=1920:-2:flags=lanczos,format=yuv420p',
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
  console.log(`  ${name}: mp4, webm and jpg in public/media, gif in .capture`)
}
