/**
 * The camera: zooming in on the part of the screen that matters, and back out.
 *
 * While a scene is captured it says where to look — "the recorder", "the
 * whole page" — and each instruction is noted with the time it was given.
 * Nothing moves during capture. Afterwards every frame is cropped to where
 * the camera was at that moment, easing from one place to the next, and
 * scaled to the output size. Re-running the capture reproduces the same
 * moves, which hand-editing a video never would.
 */

import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

/** How long a move takes, in seconds. */
export const MOVE_SECONDS = 0.9

/** The frames' shape, which every crop keeps so nothing is stretched. */
const ASPECT = 1280 / 800

/** Never zoom in further than this: past it, text gets soft. */
const MAX_ZOOM = 2.2

/** Room around the thing being looked at, in CSS pixels. */
const PADDING = 48

/** Slow out, slow in: how a camera operator moves. */
function ease(progress) {
  const p = Math.min(Math.max(progress, 0), 1)
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
}

/**
 * The view that shows `box` with some room around it, in the frames'
 * shape, inside the page. Null means the whole page.
 */
export function viewFor(box, viewport, { padding = PADDING, maxZoom = MAX_ZOOM } = {}) {
  if (!box) return { x: 0, y: 0, width: viewport.width, height: viewport.height }

  const minWidth = viewport.width / maxZoom
  let width = Math.max(box.width + padding * 2, (box.height + padding * 2) * ASPECT, minWidth)
  width = Math.min(width, viewport.width)
  const height = width / ASPECT

  const centreX = box.x + box.width / 2
  const centreY = box.y + box.height / 2
  const x = Math.min(Math.max(centreX - width / 2, 0), viewport.width - width)
  const y = Math.min(Math.max(centreY - height / 2, 0), viewport.height - height)
  return { x, y, width, height }
}

/** Where the camera is at time `t`, given the moves noted during capture. */
export function viewAt(moves, t, viewport) {
  // Each move starts from wherever the camera was when it was given, which
  // may be partway through the move before.
  let from = viewFor(null, viewport)
  let current = null
  for (const move of moves) {
    if (move.t > t) break
    if (current) from = mix(from, current.view, ease((move.t - current.t) / MOVE_SECONDS))
    current = move
  }
  return current ? mix(from, current.view, ease((t - current.t) / MOVE_SECONDS)) : from
}

/**
 * Between two views. Width is mixed on a log scale, so zooming feels even
 * all the way in rather than rushing at the start.
 */
function mix(from, to, progress) {
  if (progress >= 1) return to
  const width = Math.exp(Math.log(from.width) + (Math.log(to.width) - Math.log(from.width)) * progress)
  const height = width / ASPECT
  // Keep the centre moving in a straight line while the size changes.
  const fromCentre = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  const toCentre = { x: to.x + to.width / 2, y: to.y + to.height / 2 }
  const centre = {
    x: fromCentre.x + (toCentre.x - fromCentre.x) * progress,
    y: fromCentre.y + (toCentre.y - fromCentre.y) * progress,
  }
  return { x: centre.x - width / 2, y: centre.y - height / 2, width, height }
}

/**
 * Renders the clip at a steady frame rate, each output frame cropped to
 * where the camera was. Returns the folder of numbered frames.
 */
export async function render({ frames, end, moves, viewport }, dir, { fps = 30, width = 1920 } = {}) {
  const out = path.join(dir, 'camera')
  await rm(out, { recursive: true, force: true })
  await mkdir(out, { recursive: true })

  const height = Math.round(width / ASPECT)
  // Device pixels per CSS pixel, from the frames themselves.
  const { width: frameWidth } = await sharp(frames[0].file).metadata()
  const scale = frameWidth / viewport.width
  if (scale < 2) console.warn(`  frames are ${frameWidth} wide: zoomed views will be soft`)
  const start = frames[0].t
  const count = Math.max(1, Math.round((end - start) * fps))
  let source = 0

  for (let i = 0; i < count; i++) {
    const t = start + i / fps
    while (source + 1 < frames.length && frames[source + 1].t <= t) source++

    // Mid-move the view can lean past an edge; slide it back inside.
    const raw = viewAt(moves, t, viewport)
    const view = {
      ...raw,
      x: clamp(raw.x, 0, viewport.width - raw.width),
      y: clamp(raw.y, 0, viewport.height - raw.height),
    }
    const image = sharp(frames[source].file)
    const { width: imageWidth, height: imageHeight } = await image.metadata()
    const left = clamp(Math.round(view.x * scale), 0, imageWidth - 1)
    const top = clamp(Math.round(view.y * scale), 0, imageHeight - 1)
    await image
      .extract({
        left,
        top,
        width: clamp(Math.round(view.width * scale), 1, imageWidth - left),
        height: clamp(Math.round(view.height * scale), 1, imageHeight - top),
      })
      .resize(width, height, { kernel: 'lanczos3', fit: 'fill' })
      .jpeg({ quality: 92 })
      .toFile(path.join(out, `c${String(i).padStart(5, '0')}.jpg`))
  }
  return { dir: out, pattern: path.join(out, 'c%05d.jpg'), fps }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}
