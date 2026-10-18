---
title: "What Wendmark is"
description: "A teaching cursor that shows people how to use your app, and the one rule that makes it different from every other onboarding tool."
---

Wendmark shows people how to use a web application. Somebody who knows the
process records it once; everyone else replays it as guidance. A cursor glides
to the next thing to click, a panel says what to do and how far along they
are, and **the person clicks it themselves**.

It is made of two pieces:

- **The snippet** — one `<script>` tag in your application. It plays
  processes, records them when somebody with permission asks, and lets your
  users report a problem if you switch that on. 18.7 KB gzipped, no
  framework, everything inside a shadow root.
- **The portal** — a small Next.js application where your team edits and
  publishes processes, and where the snippet fetches them from. You run it;
  there is no hosted service.

## The one rule

Most tools in this category are built to drive. They click, they fill, they
submit. Wendmark does not, and that is enforced rather than promised:

> **Wendmark guides. It never acts.**
>
> No synthetic clicks. No setting values. No submitting forms. No navigation
> on someone's behalf.

In the code that means overlays are `pointer-events: none`, every listener is
passive and capture-phase and never calls `preventDefault`, and a step
advances only because a real user event happened. A change that would break
this does not get merged — it is the first thing in
[CLAUDE.md](https://github.com/Wendmark/wendmark/blob/main/CLAUDE.md) and the
first thing in [CONTRIBUTING](/contributing/).

Two things follow, and both are the point.

**Nobody is ever stuck.** The guidance sits beside your application rather
than in front of it. A user can click elsewhere, navigate away, or ignore it
entirely, and the app behaves exactly as it does without Wendmark.

**It teaches.** Somebody guided through refunding an order has refunded an
order themselves. They can do it again next week without the guidance, which
is the entire reason to show somebody how to do something.

## What it records, and what it refuses to

The recorder reads **structure** and the labels your own designers wrote: ARIA
roles, accessible names, visible text of non-input elements, test ids, CSS
selectors, and the section an element sits in.

It never reads what anyone types. Not `.value`, not the text content of a
field, not `contenteditable`, not keystrokes. Password, email and payment
fields get no special case, because there is no case to make — nothing is read
from any field.

That holds up because of three things that *do not happen*: the recorder never
reaches for a value, a test fails if anything touches the value getter, and
the schema rejects unknown keys server-side, so even a modified snippet cannot
smuggle one past the server.

There are no screenshots and no session replay.
[We turned those down deliberately](/decisions/step-snapshots/), and the
reasoning is written down rather than assumed.

## Where it is

Early, and honest about it: **not yet released or versioned**, and the API may
still move. The whole path works end to end — record, edit, publish, target,
play, resume — and is covered by about 1,000 tests.

| Working | Not yet |
| --- | --- |
| Recording from inside your own app | Frames from other sites inside a page |
| Editing, reordering, publishing with frozen versions | Firefox and Safari for the extension |
| URL targeting, hidden processes, pause and restore | Analytics and flow-health checks |
| The launcher, progress across reloads, shadow DOM | A hosted service |
| [Problem reports](/start/reporting/), replayable in your app | |
| [A Chrome extension](/extension/): record, share a link, follow it | |
| Email-and-password sign-in, optional OIDC | |
| Self-hosting with Docker Compose | |

## Next

- [Install it](/start/install/) — run the portal and add the script tag
- [Record a process](/start/recording/) — and what makes a good one
- [How it is built](/built/overview/) — if you would rather read the design first
