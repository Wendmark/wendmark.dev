/**
 * The person in the clips: a visible pointer that moves like a hand does.
 *
 * Headless Chrome draws no mouse pointer, and a clip about clicking is
 * useless without one. This draws an ordinary black arrow, deliberately
 * unlike Wendmark's white teaching cursor, so viewers can tell who is who:
 * Wendmark shows the way, the person clicks.
 *
 * Only ever added to pages in the capture browser. It is not part of Fika,
 * the portal or Wendmark.
 */

const ARROW = `
<svg xmlns="http://www.w3.org/2000/svg" width="22" height="26" viewBox="0 0 22 26">
  <path d="M2 2v19l5-4.6 3.4 7.6 3.6-1.6-3.3-7.4H18z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`

/** Adds the pointer to every page the context opens. */
export async function installPointer(context) {
  await context.addInitScript((arrow) => {
    const add = () => {
      if (document.getElementById('capture-pointer')) return
      const pointer = document.createElement('div')
      pointer.id = 'capture-pointer'
      pointer.innerHTML = arrow
      pointer.style.cssText =
        'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;' +
        'transform:translate(-100px,-100px);transition:scale 90ms ease;transform-origin:2px 2px;' +
        'filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))'
      document.documentElement.appendChild(pointer)
      addEventListener(
        'mousemove',
        (event) => {
          pointer.style.transform = `translate(${event.clientX - 2}px, ${event.clientY - 2}px)`
          // Stay above anything added later, Wendmark's own overlay included.
          if (pointer.nextSibling) document.documentElement.appendChild(pointer)
        },
        { capture: true, passive: true },
      )
      addEventListener('mousedown', () => (pointer.style.scale = '0.85'), { capture: true, passive: true })
      addEventListener('mouseup', () => (pointer.style.scale = '1'), { capture: true, passive: true })
    }
    if (document.documentElement) add()
    else addEventListener('DOMContentLoaded', add)
  }, ARROW)
}

const positions = new WeakMap()

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Ease in and out, so moves start and land softly. */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** Moves the pointer to a point, or to the middle of a locator's element. */
export async function moveTo(page, target) {
  let point = target
  if (typeof target.boundingBox === 'function') {
    await target.scrollIntoViewIfNeeded()
    const box = await target.boundingBox()
    if (!box) throw new Error('target is not visible')
    point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  const from = positions.get(page) ?? { x: point.x - 160, y: point.y + 120 }
  const distance = Math.hypot(point.x - from.x, point.y - from.y)
  // Longer moves take longer, within reason: 350–900 ms at ~60 fps.
  const steps = Math.round(Math.min(Math.max(distance / 14, 21), 54))
  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps)
    await page.mouse.move(from.x + (point.x - from.x) * t, from.y + (point.y - from.y) * t)
    await pause(16)
  }
  positions.set(page, point)
}

/** Moves there, hesitates a moment like a person does, and clicks. */
export async function click(page, locator) {
  await moveTo(page, locator)
  await pause(220)
  await page.mouse.down()
  await pause(90)
  await page.mouse.up()
}

/** Types at a believable speed. */
export async function typeLike(page, text) {
  for (const char of text) {
    await page.keyboard.type(char)
    await pause(45 + Math.random() * 55)
  }
}
