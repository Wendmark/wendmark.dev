---
title: "Handing author mode to a customer's app"
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/decisions/author-mode.md
---

Decided 2026-09-23. Closes the question left open in the authentication
decisions: how the portal proves to an app that this person may record flows
for it.

## The problem

Two sites are involved, and the browser keeps them apart. The portal knows
who you are, because you are signed into it. The customer's app cannot read
that: a site never sees another site's cookies. So clicking **Record a
process** has to carry one fact across the gap:

> the person in this tab may author flows for this app

## What we chose

**A pairing flow.** The snippet asks to record; the portal, where the person
is signed in, approves. Nothing secret travels through a URL, and no window
has to talk to another window.

```
1. You click "Record a process" in the portal.
   It opens your app at  https://app.example.com/profile#wm=author
   — a hint, not a secret.

2. The snippet sees the hint, invents a random code, and tells the portal:
   "app KEY at origin app.example.com would like to record, code C".
   Nothing has been granted. The code is useless on its own.

3. The portal tab — where you are signed in — sees that request, checks the
   origin is on the app's list, and approves it. Your click was the approval;
   there is no second button to press.

4. The snippet exchanges its code for an author session, once. The pairing
   request is deleted as it is collected.
```

### Why not pass a message between the two tabs

This was the original choice, and it does not work reliably. `window.opener`
is missing in embedded browsers, and any app that sets
**`Cross-Origin-Opener-Policy: same-origin`** — ordinary security hardening —
severs window-to-window messaging permanently. We do not control customers'
headers, so a design that depends on them is a design that breaks for the
most security-conscious customers.

## Why not the alternatives

**A token in the URL fragment** is simpler, and it does keep the token out of
server logs. But everything running in the page can read the address, and
client-side error trackers routinely record `location.href` on every event —
so the token would end up in whatever logging service the customer uses. That
is a silent leak, which is the worst kind.

**An invisible portal frame** asking "who is this person?" is stronger still,
because there is no token to intercept: the answer comes from the portal's own
session cookie. Browsers increasingly block cookies for embedded sites, so it
needs the Storage Access API and a fallback anyway. Worth revisiting if the
message approach proves awkward.

## The ceiling, stated plainly

Any script running in the page can read what the page receives: the app's own
code, an analytics tag, a chat widget. No arrangement of messages or frames
changes that, because they all share one execution environment. Only a
browser extension runs somewhere the page cannot reach.

So the protection is in what a stolen token is worth, not in hiding it:

- **Drafts only.** An author session may create and edit drafts. Publishing
  happens in the portal, in a session an attacker does not have. The worst
  realistic outcome is a junk draft and an audit entry.
- **Ninety seconds, single use**, bound to one app and one origin, approved
  by a named user.
- **Audited**: who authored, which app, which origin, when.
- **Revocable**: rotating an app's key invalidates live author sessions.
- **Bounded.** `POST /api/v1/author/flows` refuses a body over 128 KB or a
  recording over 200 steps, counts saves per app, and validates the flow with
  `FlowSchema` before anything is written. The app is taken from the session,
  never from the request, so a session cannot write into another app.

The rate limit is in memory, per process: a brake on a runaway script, not a
defence against a determined attacker. A portal running several instances
counts separately in each, and a deployment that needs a real limit should
put one in its proxy.

## Consequences

- Author mode needs the snippet already installed in the app. An app we
  cannot add a script to needs a browser extension, which is a later option.
- Pairing lives in `lib/auth/pairing.ts` on the server and
  `src/author/pairing.ts` in the snippet, so changing how it works later is
  contained.
- The portal waits while the request arrives, which takes a second or two.
- Approving in the portal is where permission is decided, which is the same
  place publishing happens.
- The person must be signed into their own app already; the token only
  authorises saving to the portal.
