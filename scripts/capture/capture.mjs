/**
 * Records the demo clips on wendmark.dev from a real, running Wendmark.
 *
 * One story in three clips, all against the Fika demo app:
 *
 *   recording  — the portal's "Record a process" opens Fika, a person clicks
 *                through changing their subscription plan while the recorder
 *                fills with steps, names the process and saves it
 *   editing    — in the portal, rewording a step and publishing
 *   guiding    — a visitor opens "Show me how", picks that process and is
 *                walked through it, clicking every step themselves
 *
 * Needs the Wendmark repo's dev servers running (`pnpm dev` there: portal on
 * :3100, Fika on :5174) and its seeded development account. Each run first
 * deletes the process it made last time, so re-running is safe.
 *
 *   pnpm capture                 # all three
 *   pnpm capture guiding         # just one
 *   pnpm capture --encode-only   # re-encode the last frames, no browser
 *
 * Frames come from Chrome's screencast at twice the CSS resolution, so text
 * stays crisp, and are encoded by ffmpeg into public/media/.
 */

import { chromium } from 'playwright'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startCapture, encode } from './video.mjs'
import { installPointer, click, moveTo, pause, typeLike } from './pointer.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const MEDIA = path.resolve(here, '../../public/media')
const WORK = path.resolve(here, '../../.capture')

const PORTAL = process.env.WENDMARK_PORTAL ?? 'http://localhost:3100'
const FIKA = process.env.WENDMARK_FIKA ?? 'http://localhost:5174'
// The development account from the Wendmark repo's apps/portal/prisma/seed.ts.
// Local only: it exists in a seeded development database and nowhere else.
const EMAIL = process.env.WENDMARK_EMAIL ?? 'dev@example.com'
const PASSWORD = process.env.WENDMARK_PASSWORD ?? 'development password'

const APP_NAME = 'Fika (local)'
const PROCESS = 'Change your plan'

const VIEWPORT = { width: 1280, height: 800 }

const args = process.argv.slice(2)
const encodeOnly = args.includes('--encode-only')
const wanted = new Set(args.filter((arg) => !arg.startsWith('--')))
const want = (name) => wanted.size === 0 || wanted.has(name)

async function newContext(browser) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  })
  await installPointer(context)
  return context
}

/** Signs in to the portal and opens the Fika app's page. Returns its URL. */
async function openApp(page) {
  await page.goto(`${PORTAL}/sign-in`)
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'))
  await page.goto(PORTAL)
  await page.getByRole('link', { name: APP_NAME }).first().click()
  await page.getByRole('button', { name: 'Record a process' }).waitFor()
  return page.url()
}

/** Deletes processes left by earlier runs, so the launcher shows one. */
async function cleanUp(page) {
  for (;;) {
    const row = page.locator('li.process', { has: page.getByRole('link', { name: PROCESS, exact: true }) })
    if ((await row.count()) === 0) return
    await row.first().getByRole('button', { name: 'Delete' }).click()
    await row.first().getByRole('button', { name: 'Yes, delete' }).click()
    await page.waitForTimeout(800)
  }
}

/** The shadow-DOM part of the snippet. Playwright's CSS pierces open roots. */
const recorder = (page) => page.locator('[data-wendmark="recorder"]')

async function recordingScene(portal) {
  const [fika] = await Promise.all([
    portal.context().waitForEvent('page'),
    portal.getByRole('button', { name: 'Record a process' }).click(),
  ])
  // Start once Fika has drawn itself: a blank first frame is what a reader
  // sees whenever a browser will not autoplay.
  await fika.locator('nav').first().waitFor()
  const capture = await startCapture(fika, path.join(WORK, 'recording'))

  await recorder(fika).waitFor()
  await pause(1600)

  await click(fika, fika.locator('nav').getByRole('link', { name: 'Subscription' }))
  await pause(1100)
  await click(fika, fika.getByRole('button', { name: 'Change plan', exact: true }))
  await pause(1000)
  await click(fika, fika.getByText('Four bags / month', { exact: true }))
  await pause(900)
  await click(fika, fika.getByRole('button', { name: 'Save plan', exact: true }))
  await pause(1400)

  // Name it in the recorder, then save it to the portal as a draft.
  const name = recorder(fika).locator('input[data-wendmark="flow-name"]')
  await click(fika, name)
  await name.selectText()
  await typeLike(fika, PROCESS)
  await fika.keyboard.press('Tab')
  await pause(600)
  await click(fika, recorder(fika).getByRole('button', { name: 'Save', exact: true }))
  await recorder(fika).getByText('Saved as a draft').waitFor()
  await pause(2200)

  await capture.stop()
  await fika.close()
}

async function editingScene(portal, appUrl) {
  await portal.goto(appUrl)
  await portal.getByRole('link', { name: PROCESS, exact: true }).first().click()
  await portal.getByRole('heading', { name: 'Publishing' }).waitFor()

  const capture = await startCapture(portal, path.join(WORK, 'editing'))
  await pause(1400)

  // Reword the first step into something a customer would say.
  const steps = portal.locator('ol.steps.editable > li')
  await click(portal, steps.nth(0).getByRole('button', { name: 'Reword' }))
  const text = portal.getByLabel('What this step says')
  await text.selectText()
  await typeLike(portal, 'Open Subscription in the top menu')
  await pause(300)
  await click(portal, steps.nth(0).getByRole('button', { name: 'Save' }))
  await pause(1200)

  await click(portal, steps.nth(2).getByRole('button', { name: 'Reword' }))
  await portal.getByLabel('What this step says').selectText()
  await typeLike(portal, 'Pick the plan you want')
  await pause(300)
  await click(portal, steps.nth(2).getByRole('button', { name: 'Save' }))
  await pause(1200)

  const publish = portal.getByRole('button', { name: 'Publish', exact: true })
  await publish.scrollIntoViewIfNeeded()
  await pause(500)
  await click(portal, publish)
  await portal.getByRole('button', { name: 'Back to draft' }).waitFor()
  await pause(2200)

  await capture.stop()
}

async function guidingScene(browser) {
  // A visitor: a fresh browser, never signed in to anything.
  const context = await newContext(browser)
  const fika = await context.newPage()
  await fika.goto(FIKA)
  const opener = fika.locator('button.opener')
  await opener.waitFor()

  const capture = await startCapture(fika, path.join(WORK, 'guiding'))
  await moveTo(fika, { x: 640, y: 420 })
  await pause(1000)

  await click(fika, opener)
  await pause(1200)
  await click(fika, fika.locator('.item', { hasText: PROCESS }))
  // Each step: the teaching cursor glides to the target first, then the
  // person follows it and clicks. Wendmark never clicks for them.
  await pause(2000)
  await click(fika, fika.locator('nav').getByRole('link', { name: 'Subscription' }))
  await pause(2000)
  await click(fika, fika.getByRole('button', { name: 'Change plan', exact: true }))
  await pause(2000)
  await click(fika, fika.getByText('Four bags / month', { exact: true }))
  await pause(2000)
  await click(fika, fika.getByRole('button', { name: 'Save plan', exact: true }))
  await pause(2400)

  await capture.stop()
  await context.close()
}

async function main() {
  await mkdir(MEDIA, { recursive: true })
  if (!encodeOnly) await capture()

  // Guiding's poster is mid-guide, with the cursor, the ring and the panel
  // all showing; it is also the image shared when someone links the site.
  const posters = { guiding: 14 }
  for (const name of ['recording', 'editing', 'guiding']) {
    if (want(name)) await encode(path.join(WORK, name), MEDIA, name, { posterAt: posters[name] })
  }
}

async function capture() {
  await rm(WORK, { recursive: true, force: true })

  const browser = await chromium.launch()
  try {
    const context = await newContext(browser)
    const portal = await context.newPage()
    const appUrl = await openApp(portal)

    if (want('recording')) {
      await cleanUp(portal)
      await recordingScene(portal)
    }
    if (want('editing')) await editingScene(portal, appUrl)
    if (want('guiding')) await guidingScene(browser)
    await context.close()
  } finally {
    await browser.close()
  }
}

await main()
