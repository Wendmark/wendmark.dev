/**
 * Reading a shared guide out of the play page's own address.
 *
 * The link is `https://wendmark.dev/play#g=<guide>`: the guide is JSON,
 * `{ v: 1, origin, flow }`, compressed with deflate-raw and written in
 * base64url. The part after `#` never leaves the browser, so this is all
 * done here, with the browser's own DecompressionStream. The format is the
 * Wendmark repository's apps/extension/src/transfer.ts; this reads only what
 * the page shows, and the extension checks everything again, strictly,
 * before it plays anything.
 */

export interface GuideStep {
  text: string
  page: string | null
}

export interface Guide {
  name: string
  origin: string
  host: string
  steps: GuideStep[]
}

/** The encoded guide in an address, or null. */
export function encodedGuide(hash: string): string | null {
  const match = /^#(?:.*&)?g=([A-Za-z0-9_-]+)/.exec(hash)
  // Longer than any link the extension makes, by far.
  return match?.[1] && match[1].length <= 64 * 1024 ? match[1] : null
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

function readOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === value
      ? value
      : null
  } catch {
    return null
  }
}

/** What the page shows, read defensively from whatever was in the link. */
export function readGuide(value: unknown): Guide | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as { v?: unknown; origin?: unknown; flow?: unknown }
  const origin = readOrigin(raw.origin)
  if (raw.v !== 1 || !origin) return null
  const flow = raw.flow as { name?: unknown; steps?: unknown } | null
  if (!flow || typeof flow.name !== 'string' || !Array.isArray(flow.steps)) return null

  const steps: GuideStep[] = []
  for (const step of flow.steps as unknown[]) {
    const { text, target } = (step ?? {}) as { text?: unknown; target?: { url?: unknown } }
    if (typeof text !== 'string') return null
    steps.push({ text, page: typeof target?.url === 'string' ? target.url : null })
  }
  if (steps.length === 0) return null
  return { name: flow.name, origin, host: new URL(origin).host, steps }
}

/** The guide in an address, or null when there is none or it cannot be read. */
export async function guideFromHash(hash: string): Promise<Guide | null> {
  const encoded = encodedGuide(hash)
  if (!encoded) return null
  try {
    const stream = new Blob([fromBase64Url(encoded) as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'))
    return readGuide(JSON.parse(await new Response(stream).text()))
  } catch {
    return null
  }
}

/** The steps as plain text, for a ticket or for following by hand. */
export function asText(guide: Guide): string {
  const lines = [guide.name, `On ${guide.host}`, '']
  let lastPage: string | null = null
  guide.steps.forEach((step, index) => {
    const where = step.page && step.page !== lastPage ? ` (on ${step.page})` : ''
    if (step.page) lastPage = step.page
    lines.push(`${index + 1}. ${step.text}${where}`)
  })
  return lines.join('\n')
}
