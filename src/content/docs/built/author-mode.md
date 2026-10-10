---
title: "Author mode"
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/architecture/04-author-mode.md
---

The area with the most reasoning per line of code, because two things fought
us: browsers deliberately keep two sites apart, and the recording interface
is too big to ship to everyone.

The decision record, including the options rejected, is in
[docs/decisions/author-mode.md](/decisions/author-mode/).

## The problem

Recording cannot happen in the portal. The portal does not have the
customer's DOM — it cannot know their Checkout button exists. So recording
happens **inside the customer's app**, where the snippet already is.

But permission lives in the portal, where the person is signed in:

```
portal (:3100)                   customer's app (:5174)
  person is signed in here         snippet lives here
  knows who may record             knows what the buttons are
```

Something has to cross that gap.

## The attempt that failed

The obvious design: the portal opens the app in a new tab and passes a token
through `window.opener.postMessage`. It did not work — `window.opener` was
`false`.

`Cross-Origin-Opener-Policy: same-origin` tells the browser to **sever the
link** between an opener and the window it opened. It is standard hardening,
on by default in many frameworks, and it exists to prevent exactly the
cross-window access we wanted. We do not control customers' headers, so any
design depending on window messaging is broken on an unknown fraction of real
apps — and broken silently, on the most security-conscious ones.

The design changed to one where no window talks to any other window.

## Pairing

Like signing a TV into a streaming account. Four steps, no secret in any URL:

```
1. Click "Record a process" in the portal
       → opens the app at  /#wm=author        ← a hint, not a credential

2. The snippet sees the hint, invents a random code, and tells the portal:
   "the app at <origin> would like to record"

3. The portal tab — where the person is signed in — sees that request,
   checks the origin, and approves it. The click IS the approval.

4. The snippet, polling, collects its session token with the code
   only it knows.
```

The snippet's side is `packages/snippet/src/author/start.ts`:

```ts
if (!wantsAuthorMode(view)) return
clearHint(view)

const portal = portalOrigin(doc)
const key = appKey(doc)
if (!portal || !key) return

const code = generateCode(view)
if (!(await askToRecord(portal, key, code))) return

const session = await waitForApproval(view, portal, code)
if (!session) return

const author = await loadAuthorBundle(doc, view, portal)
author?.start({ session, portalOrigin: portal, doc, view, api })
```

Every failure is a silent `return`. A visitor must never see a trace of this.
`clearHint()` runs immediately, so a reload or a copied link does not restart
the dance.

`lib/auth/pairing.ts` stores the **hash** of the code, never the code:

```ts
await getDb().pairingRequest.create({
  data: {
    codeHash: hashToken(input.code),
    appId: app.id,
    origin: input.origin,
    expiresAt: new Date(Date.now() + PAIRING_LIFETIME_MS), // 90 seconds
  },
})
```

Requesting is public, so it says nothing back: `{ ok: false }` for a bad key,
a bad origin, or a real key from the wrong site — identical answers.
Collection is a one-time exchange; the row is deleted the moment the session
is handed over, and all five failure conditions return the same
`202 { waiting: true }`.

## The ceiling, stated plainly

**Any script in the page can read what the page receives** — the app's own
code, an analytics tag, a chat widget. They share one execution environment.
No arrangement of frames or messages changes that.

So the protection is not in hiding the token. It is in what a stolen token is
worth:

- **Drafts only.** An author session can create a draft and nothing else.
  Publishing happens in the portal, in a session an attacker does not have.
  The worst realistic outcome is a junk draft.
- **90 seconds, single use**, bound to one app and one origin, approved by a
  named person.
- **Revocable** — rotating the app's key ends live sessions.
- **Bounded** — 128 KB, 200 steps, rate limited.

That list is the security design.

## Two bundles

The recording interface is around 13 KB. The snippet's budget is 30 KB
gzipped for _every visitor_. Shipping the recorder to everyone to serve the
few people who record would be absurd.

`tsup.config.ts` builds two files:

```ts
entry: { snippet: 'src/index.ts' },         globalName: 'Wendmark'
entry: { author:  'src/author/bundle.ts' }, globalName: 'WendmarkAuthor'
```

`author.js` is fetched from the portal only when someone records.

The first attempt was 34 KB, because it re-bundled the recorder, the player
and the element engine — all of which were already on the page inside
`snippet.js`. The fix is the interface in `src/author/loader.ts`:

```ts
export interface SnippetApi {
  startFlow: (flow: Flow, options?: { onEnd?: () => void }) => void
  stopFlow: () => void
  startRecording: (options: RecordingOptions) => Recording
}
```

The page **lends** its engine to the author bundle rather than the bundle
importing it. 34 KB became 9.9 KB.

This is why `bundle.ts` calls `context.api.startRecording(...)` instead of
importing `record`. The import would be correct and would silently triple the
download. Nothing enforces it — `author.js` has no size budget — so it is a
rule to keep in mind when editing that file.

## The rule the recorder must never break

**Never record typed values.** Not `.value`, not `textContent` of a field,
not keystrokes. Password, email and payment fields get no special case,
because there is no case: no field values, ever.

Three layers hold it:

1. The recorder captures structure and authored labels only.
2. A test spies on the value getter and fails if anything reads it.
3. The core `Target` schema is `strictObject`, so a smuggled `value` key is
   rejected on the server.

The recorder also has its own manners (`src/recorder/hygiene.test.ts`): it
never records a click on Wendmark's own interface, never records the same
click twice in a row, and **shows a badge, so nobody is recorded without
knowing**. The last one is not a technical requirement — it is the same
principle as guide-never-act.

## Checks

```bash
grep -rn "startRecording\|startFlow" packages/snippet/src/author/bundle.ts
```

Every engine call should go through `context.api`.

```bash
grep -rn "\.value" packages/snippet/src/recorder/
```

Should find nothing that reads a field. The most important check in the repo.
