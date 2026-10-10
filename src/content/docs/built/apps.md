---
title: "Apps"
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/architecture/03-apps.md
---

An **app** is one product a company wants to guide people through. It is what
a flow belongs to, and what the snippet identifies itself as. Three ideas
carry the area: the public key, the origin allowlist, and the install ping.

## The public key is not a secret

`lib/apps/keys.ts`:

```ts
/**
 * The key that appears in a customer's script tag. It identifies an app; it
 * does not authenticate anyone, because anyone reading the page can see it.
 * Permission to change flows comes from a portal session, never from this.
 */
const PREFIX = 'wm_'
const RANDOM_BYTES = 18
/** Crockford-style: no look-alike characters to misread over a phone call. */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'
```

It ends up in a `<script data-app="wm_…">` on a public page. Treating it as a
credential would be a lie that eventually gets believed.

Nothing stops someone pasting the key on their own site. What matters is that
the key alone buys nothing: it cannot read a draft, write a flow, or say who
you are.

The alphabet has no `i`/`l`/`1` or `o`/`0`, because someone will eventually
read one of these aloud on a support call. `isPublicKey()` is a shape check
used _before_ hitting the database, so a flood of junk keys never becomes a
flood of queries.

## Origins: where a key may be used

`lib/apps/origins.ts` is the most reused file in the portal — author mode,
the save endpoint and every CORS header lean on it.

An origin is scheme + host + port, and nothing else.
`https://app.example.com` is an origin; `https://app.example.com/orders` is a
URL with a path. The browser's security model is built on that boundary, so
the portal stores exactly that and refuses anything else:

```ts
if (url.protocol === 'http:' && !isLocal(url.hostname)) {
  return { ok: false, reason: 'Use https:// for anything but localhost.' }
}
if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
  return { ok: false, reason: 'Give the site address only, without a path.' }
}
if (url.hostname.includes('*')) {
  return { ok: false, reason: 'Wildcards are not supported yet. Add each address.' }
}
```

`http://` is allowed only for localhost, or companies would happily register
a plaintext staging address. Wildcards are refused outright: `*.example.com`
sounds convenient until an abandoned subdomain is taken over.

Normalising matters more than it looks. `https://App.Example.com/` and
`https://app.example.com` must not both sit in the list and behave
differently; `new URL().origin` collapses them.

Then the one-liner everything calls:

```ts
export function isAllowedOrigin(origins: string[], candidate: string): boolean {
  const parsed = parseOrigin(candidate)
  return parsed.ok && origins.includes(parsed.origin)
}
```

Every CORS header in the portal goes through this.
`Access-Control-Allow-Origin` is never `*` on anything that matters.

## The install ping

The problem it solves: someone pastes the script tag, nothing appears, and
they cannot tell whose fault it is.

**Snippet side** (`packages/snippet/src/install/ping.ts`):

```ts
export function sendInstallPing(doc: Document, view: Window, version: string): void {
  const key = appKey(doc)
  const portal = portalOrigin(doc)
  if (!key || !portal) return
  if (alreadySent(view)) return
```

Three details worth copying elsewhere:

- **The portal's address is derived, not configured.** `portalOrigin()` reads
  the `src` of our own `<script>` tag. The snippet was served by the portal,
  so that is where the portal is. One fewer thing for a self-hoster to set.
- **Once per tab**, via `sessionStorage`. A busy site would otherwise write a
  row on every page load. When storage is blocked it pings anyway — better
  noisy than silent.
- **`keepalive: true`**, so the request survives an immediate navigation.

**Portal side** (`app/api/v1/ping/route.ts`) — look at what it answers:

```ts
const ping = readPing(body)
if (ping) await recordPing(ping)

return NextResponse.json({ ok: true }, { status: 202, headers: corsHeaders() })
```

Junk body, unknown key, valid key — all `202 { ok: true }`. This is the only
endpoint with `Access-Control-Allow-Origin: '*'`, because it must answer from
a site that is not registered yet. It compensates by saying nothing at all,
so it cannot be used to discover which keys are real.

`lib/apps/install.ts` has three outcomes:

| What arrived                  | What happens                                    |
| ----------------------------- | ----------------------------------------------- |
| Known key, allowed origin     | `lastSeenAt` updated — the tick on the app page |
| Known key, **unknown** origin | Counted in `OriginSighting`                     |
| Unknown key                   | Ignored entirely                                |

That middle row powers the "Seen from addresses that are not on the list" box
with an **Add** button. It is almost always a staging environment nobody
registered; offering the fix beats leaving someone confused.

A quiet period stops a busy site writing on every load:

```ts
const seenRecently =
  app.lastSeenAt !== null && Date.now() - app.lastSeenAt.getTime() < QUIET_PERIOD_MS
```

## Two destructive operations, two confirmations

**Rotate key** (`lib/apps/service.ts`):

```ts
const updated = await getDb().app.update({
  where: { id: existing.id },
  data: { publicKey: generatePublicKey() },
})
// Anyone recording against the old key loses their session too.
await revokeAuthorSessions(existing.id)
```

That second line is the one to remember. Rotating a key means "this got into
the wrong hands"; leaving author sessions running would defeat the point. It
is also the one revocation lever that works today.

**Delete app** — typing the name is the confirmation:

```ts
if (confirmation.trim() !== existing.name) {
  throw new InvalidInputError('Type the app name exactly to confirm.')
}
```

Deleting an app cascades to every flow ever recorded for it, unlike deleting
a process, which is soft. Different weight, different friction.

## Checks

```bash
grep -rn "isAllowedOrigin" apps/portal/lib apps/portal/app | grep -v node_modules
```

Every place an origin decides something — the audit list if the rule ever
changes.
