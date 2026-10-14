/**
 * Records the demo clips and the docs' screenshots from a real, running
 * Wendmark.
 *
 * One story, told against the Fika demo app:
 *
 *   recording  — the portal's "Record a process" opens Fika, a person clicks
 *                through changing their subscription plan while the recorder
 *                fills with steps, names the process and saves it
 *   editing    — in the portal, rewording a step and publishing
 *   guiding    — a visitor opens "Show me how", picks that process and is
 *                walked through it, clicking every step themselves
 *   reporting  — a visitor reports a problem: they redo what went wrong,
 *                see the masked steps, say what happened and send it
 *                (needs problem reports switched on for the Fika app)
 *   reviewing  — in the portal, opening the app's reports and reading one
 *   replaying  — from that report, Replay in the app: the teaching cursor
 *                walks the path the visitor took
 *
 * The clips zoom in on Wendmark's panel when it is what matters and back out
 * when the page is (camera.mjs). The stills — the screenshots in the docs —
 * are taken during the same scenes, into src/assets/stills.
 *
 * Needs the Wendmark repo's dev servers running (`pnpm dev` there: portal on
 * :3100, Fika on :5174) and its seeded development account. Each run first
 * deletes the process it made last time, so re-running is safe.
 *
 *   pnpm capture                 # everything
 *   pnpm capture guiding         # just one scene (stills included)
 *   pnpm capture --encode-only   # re-encode the last frames, no browser
 *
 * Frames come from Chrome's screencast at twice the CSS resolution, so text
 * stays crisp, and are encoded by ffmpeg into public/media/.
 */

import { chromium } from 'playwright'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startCapture, encode, still } from './video.mjs'
import { installPointer, click, moveTo, pause, typeLike } from './pointer.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const MEDIA = path.resolve(here, '../../public/media')
// Stills go through Astro's image pipeline, which sizes and serves them.
const STILLS = path.resolve(here, '../../src/assets/stills')
const WORK = path.resolve(here, '../../.capture')

const PORTAL = process.env.WENDMARK_PORTAL ?? 'http://localhost:3100'
const FIKA = process.env.WENDMARK_FIKA ?? 'http://localhost:5174'
// The development account from the Wendmark repo's apps/portal/prisma/seed.ts.
// Local only: it exists in a seeded development database and nowhere else.
const EMAIL = process.env.WENDMARK_EMAIL ?? 'dev@example.com'
const PASSWORD = process.env.WENDMARK_PASSWORD ?? 'development password'

const APP_NAME = 'Fika (local)'
const PROCESS = 'Change your plan'
const REPORT_NOTE = 'I added a coffee but my plan still shows two bags.'

const VIEWPORT = { width: 1280, height: 800 }

const SCENES = ['recording', 'editing', 'guiding', 'reporting', 'reviewing', 'replaying']

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

// Wendmark's panels, inside its shadow root. Playwright's CSS pierces open
// roots. Each is the whole movable frame: the sheet and its bar.
const panel = (page, kind) =>
  page.locator('.wm-frame', { has: page.locator(`[data-wendmark="${kind}"]`) })
const recorder = (page) => page.locator('[data-wendmark="recorder"]')
const launcher = (page) => page.locator('wendmark-overlay .frame', { has: page.locator('.list') })

/** Points the camera and gives the move time to land. */
async function look(capture, target, ms = 1400) {
  await capture.focus(target)
  await pause(ms)
}

async function recordingScene(portal) {
  // The header and the button only: the process list below is whatever the
  // local database holds, test runs and all.
  await still(portal, STILLS, 'portal-app', [portal.locator('main h1').first(), portal.locator('.record')], {
    padding: 12,
  })

  const [fika] = await Promise.all([
    portal.context().waitForEvent('page'),
    portal.getByRole('button', { name: 'Record a process' }).click(),
  ])
  // Start once Fika has drawn itself: a blank first frame is what a reader
  // sees whenever a browser will not autoplay.
  await fika.locator('nav').first().waitFor()
  const capture = await startCapture(fika, path.join(WORK, 'recording'))

  await recorder(fika).waitFor()
  await pause(1200)
  // The recorder, empty and waiting.
  await look(capture, panel(fika, 'recorder'), 2200)
  await look(capture, null, 1000)

  await click(fika, fika.locator('nav').getByRole('link', { name: 'Subscription' }))
  await pause(1100)
  await click(fika, fika.getByRole('button', { name: 'Change plan', exact: true }))
  await pause(1000)
  await click(fika, fika.getByText('Four bags / month', { exact: true }))
  await pause(900)
  await click(fika, fika.getByRole('button', { name: 'Save plan', exact: true }))
  await pause(900)

  // Four clicks, four steps.
  await look(capture, panel(fika, 'recorder'), 1800)
  await still(fika, STILLS, 'recorder-steps', panel(fika, 'recorder'))

  // Name it in the recorder, then save it to the portal as a draft.
  const name = recorder(fika).locator('input[data-wendmark="flow-name"]')
  await click(fika, name)
  await name.selectText()
  await typeLike(fika, PROCESS)
  await fika.keyboard.press('Tab')
  await pause(600)
  await click(fika, recorder(fika).getByRole('button', { name: 'Save', exact: true }))
  await recorder(fika).getByText('Saved as a draft').waitFor()
  await pause(2400)

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
  await look(capture, steps, 1200)
  await click(portal, steps.nth(0).getByRole('button', { name: 'Reword' }))
  const text = portal.getByLabel('What this step says')
  await text.selectText()
  await typeLike(portal, 'Open Subscription in the top menu')
  await pause(300)
  // Tight: any wider and the lines above and below are cut in half.
  await still(portal, STILLS, 'editing-reword', steps.nth(0), { padding: 8 })
  await click(portal, steps.nth(0).getByRole('button', { name: 'Save' }))
  await pause(1200)

  await click(portal, steps.nth(2).getByRole('button', { name: 'Reword' }))
  await portal.getByLabel('What this step says').selectText()
  await typeLike(portal, 'Pick the plan you want')
  await pause(300)
  await click(portal, steps.nth(2).getByRole('button', { name: 'Save' }))
  await moveTo(portal, { x: 1180, y: 760 })
  await pause(900)
  await still(portal, STILLS, 'editing-steps', steps, { padding: 8 })

  await look(capture, null, 1000)
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
  await still(fika, STILLS, 'launcher-closed', opener, { padding: 48 })

  const capture = await startCapture(fika, path.join(WORK, 'guiding'))
  await moveTo(fika, { x: 640, y: 420 })
  await pause(1000)

  await click(fika, opener)
  await pause(500)
  // The launcher: the processes for this page.
  await look(capture, launcher(fika), 1800)
  await still(fika, STILLS, 'launcher-open', launcher(fika))
  await click(fika, fika.locator('.item', { hasText: PROCESS }))
  await look(capture, null, 600)

  // Each step: the teaching cursor glides to the target first, then the
  // person follows it and clicks. Wendmark never clicks for them.
  await pause(1600)
  await still(fika, STILLS, 'guide-step')
  await click(fika, fika.locator('nav').getByRole('link', { name: 'Subscription' }))
  await pause(900)
  // The panel: where they are, and what is left.
  await look(capture, panel(fika, 'panel'), 2000)
  await still(fika, STILLS, 'guide-panel', panel(fika, 'panel'))
  await look(capture, null, 1000)
  await click(fika, fika.getByRole('button', { name: 'Change plan', exact: true }))
  await pause(2000)
  await click(fika, fika.getByText('Four bags / month', { exact: true }))
  await pause(2000)
  await click(fika, fika.getByRole('button', { name: 'Save plan', exact: true }))
  await pause(2400)

  await capture.stop()
  await context.close()
}

async function reportingScene(browser) {
  // A visitor again, with nothing in this browser from before.
  const context = await newContext(browser)
  const fika = await context.newPage()
  await fika.goto(FIKA)
  const opener = fika.locator('button.opener')
  await opener.waitFor()

  const capture = await startCapture(fika, path.join(WORK, 'reporting'))
  await moveTo(fika, { x: 640, y: 420 })
  await pause(900)

  await click(fika, opener)
  await pause(500)
  await look(capture, launcher(fika), 1500)
  await still(fika, STILLS, 'report-entry', launcher(fika))
  await click(fika, fika.locator('.report button'))
  const report = fika.locator('[data-wendmark="report"]')
  await report.waitFor()
  await look(capture, panel(fika, 'report'), 1800)
  await look(capture, null, 1000)

  // What they did before, done again. Each press appears in the panel,
  // already masked.
  await click(fika, fika.locator('.product-card').first().getByRole('button', { name: 'Add to cart' }))
  await pause(1200)
  await click(fika, fika.locator('nav').getByRole('link', { name: 'Subscription' }))
  await pause(1200)
  await click(fika, fika.getByRole('button', { name: 'Change plan', exact: true }))
  await pause(900)

  await look(capture, panel(fika, 'report'), 1800)
  await still(fika, STILLS, 'report-steps', panel(fika, 'report'))
  await click(fika, report.getByRole('button', { name: 'Done', exact: true }))
  await pause(700)
  await click(fika, report.locator('textarea'))
  await typeLike(fika, REPORT_NOTE)
  await pause(800)
  await still(fika, STILLS, 'report-describe', panel(fika, 'report'))
  await click(fika, report.getByRole('button', { name: 'Send report', exact: true }))
  await report.getByText('Your report was sent').waitFor()
  await pause(2200)

  await capture.stop()
  await context.close()
}

/** The report the reporting scene sent, so the clips tell one story. */
const sentReport = (portal) => portal.getByRole('link', { name: /plan still shows two bags/ }).first()

async function reviewingScene(portal, appUrl) {
  await portal.goto(appUrl)
  const reports = portal.getByRole('link', { name: /^Reports/ })
  await reports.waitFor()

  const capture = await startCapture(portal, path.join(WORK, 'reviewing'))
  await moveTo(portal, { x: 640, y: 400 })
  await pause(1200)
  await click(portal, reports)
  await portal.getByRole('heading', { name: 'Problem reports' }).waitFor()
  await pause(1200)
  await still(portal, STILLS, 'portal-reports')

  await click(portal, sentReport(portal))
  await portal.getByRole('heading', { name: 'Problem report' }).waitFor()
  await pause(1400)
  await look(capture, [portal.locator('.report-note'), portal.locator('.report-meta')], 2200)
  await look(capture, null, 800)
  await still(portal, STILLS, 'portal-report')

  const firstStep = portal.locator('.report-step').first()
  await firstStep.scrollIntoViewIfNeeded()
  await pause(600)
  await click(portal, firstStep.getByText('How it is found'))
  await look(capture, firstStep, 2600)

  await capture.stop()
}

async function replayingScene(portal, appUrl) {
  // The same report, from its own page.
  await portal.goto(appUrl)
  await portal.getByRole('link', { name: /^Reports/ }).click()
  await sentReport(portal).click()
  const replay = portal.getByRole('button', { name: 'Replay in the app' })
  await replay.waitFor()
  await still(portal, STILLS, 'portal-replay', [portal.locator('.report-note'), replay], {
    padding: 40,
  })

  const [fika] = await Promise.all([portal.context().waitForEvent('page'), replay.click()])
  await fika.locator('nav').first().waitFor()
  const capture = await startCapture(fika, path.join(WORK, 'replaying'))
  const guide = panel(fika, 'panel')
  await guide.waitFor()
  await pause(1000)

  // It opens by saying what this is: their path, not a guide to follow.
  await look(capture, guide, 2600)
  await still(fika, STILLS, 'replay-intro', guide)
  await click(fika, fika.getByRole('button', { name: 'Got it' }))
  // Off the panel, so the still does not suggest Skip is the next move.
  await moveTo(fika, { x: 560, y: 470 })
  await look(capture, null, 1800)
  await still(fika, STILLS, 'replay-step')

  // The person replaying does each step themselves.
  await click(fika, fika.locator('.product-card').first().getByRole('button', { name: 'Add to cart' }))
  await pause(1800)
  await click(fika, fika.locator('nav').getByRole('link', { name: 'Subscription' }))
  await pause(1800)
  await click(fika, fika.getByRole('button', { name: 'Change plan', exact: true }))
  await pause(2400)

  await capture.stop()
  await fika.close()
}

async function main() {
  await mkdir(MEDIA, { recursive: true })
  if (!encodeOnly) await capture()

  // Guiding's poster is mid-guide, with the cursor, the ring and the panel
  // all showing; it is also the image shared when someone links the site.
  const posters = { guiding: 9, reporting: 13, replaying: 8 }
  for (const name of SCENES) {
    if (want(name)) await encode(path.join(WORK, name), MEDIA, name, { posterAt: posters[name] })
  }
}

async function capture() {
  for (const name of SCENES) {
    if (want(name)) await rm(path.join(WORK, name), { recursive: true, force: true })
  }

  // Without this flag Chrome's screencast sends frames at CSS size, whatever
  // the context's device scale factor, and a zoomed-in frame would be blurry.
  const browser = await chromium.launch({ args: ['--force-device-scale-factor=2'] })
  try {
    const context = await newContext(browser)
    const portal = await context.newPage()
    const appUrl = await openApp(portal)

    if (want('recording')) {
      await cleanUp(portal)
      await portal.goto(appUrl)
      await recordingScene(portal)
    }
    if (want('editing')) await editingScene(portal, appUrl)
    if (want('guiding')) await guidingScene(browser)
    if (want('reporting')) await reportingScene(browser)
    if (want('reviewing')) await reviewingScene(portal, appUrl)
    if (want('replaying')) await replayingScene(portal, appUrl)
    await context.close()
  } finally {
    await browser.close()
  }
}

await main()
