---
title: "Problem reports"
description: "What an end user's \"report a problem\" captures, who it belongs to, and how long it lives."
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/decisions/problem-reports.md
---

## The idea

A user gets stuck. Instead of writing "it doesn't work" into a support box,
they press **Report a problem**, do the thing that failed, and press **Done**.
Wendmark noted which controls they touched, in order. Support opens the
report and watches the same path replay with the teaching cursor.

The recorder already turns clicks into structured steps. A flow says "this is
how you do it"; a report says "this is what I did". Same steps, opposite
direction.

## What this is not

The usual answer to "what happened?" is session replay: record the screen
continuously, play back video. That is invasive, heavy, and awkward under
GDPR — it captures everyone all the time, including the people who had no
problem.

A report is **user-initiated** and **structural**. Nothing is captured until
somebody asks for it, nothing is captured after they stop, and what is
captured is a list of controls, not a film.

## Decision

Build it, open source, in four stages (below). Off for every app until an
administrator turns it on.

### The three questions the issue left open

**Redaction: mask by default, app opts in to less.** Reasons below.

**Retention: 90 days, then the row is gone.** A hard delete, not the soft
delete flows get. Configurable per app between 7 and 365 days. Any editor can
delete a single report immediately; only an administrator can change the
retention setting.

**Open core or paid: open.** There is no entitlement machinery in this
repository and inventing some for one feature would be the tail wagging the
dog. If reports ever carry a price it will be on volume or on how long they
are kept, not on the feature existing.

## Why masking has to be the default

Every privacy claim Wendmark makes today is an **absence**. The recorder never
reaches for a field value, a test fails if anything touches the value getter,
and the `Target` schema rejects unknown keys server-side. Three things that
do not happen — see `docs/decisions/step-snapshots.md`, which turned a feature
down to keep that shape.

A report cannot be an absence. It is, by definition, a capture of a real
person's real session in a real account. The fields are the same structural
ones as always, but the _contents_ change character:

```jsonc
// Staff recording how to refund an order — a label their own designers wrote
{ "role": "button", "name": "Issue refund", "context": "Order details" }

// A customer reporting that refunds fail — the same fields, their own data
{ "role": "link", "name": "Order FK-10421", "context": "Alex Lindqvist's orders" }
```

`selectors`, `role`, `testId` and `shadowPath` are structure: they describe
the application, which is the same for everybody. `name`, `text` and
`context` are whatever the page happened to say, which on a customer's screen
is often the customer.

So those three are dropped unless there is a reason to keep them.

### Dropping them costs the replay nothing

This is what makes the decision easy. The player resolves a step from
`selectors`, `testId`, `role` and `shadowPath`. `name` and `text` are
tie-breakers and are what the _human_ reads in the portal's list — they are
not what finds the element. A masked report still replays.

That held only once selectors were unique on their own. Building the replay
showed a gap: the first of several look-alike siblings got no position, so
`nav > a.nav-link` matched every link in the nav. In a guide the name broke
the tie; in a masked report nothing did, and the replay stalled on the first
step. Selectors now always carry `:nth-of-type` when an element has siblings
of the same tag. Reports sent before that change may still stall on such a
step, which Skip gets past.

What support loses is readability: `Click (button) in (section)` instead of
`Click Order FK-10421`. That is a worse report. It is not a broken one, and
it is the operator's call to make, not ours.

### Three mechanisms, and only one of them is a promise

In order of how much they are worth:

1. **The preview.** Before anything is sent, the user sees the exact list
   that will be sent and can remove any step. This is the only mechanism that
   is actually a guarantee, because it is the user looking at it.
2. **The per-app label policy.** `none` (default: drop `name`, `text`,
   `context` from every step), or `all` (keep them, for an operator who has
   decided their labels carry no personal data). Set by an administrator, who
   is the party that knows.
3. **The `dynamic` guess.** The recorder already guesses whether a target
   sits in the user's own data (`isInRepeatedStructure`, issue #53). Under a
   future `labels: "fixed-only"` policy it would keep labels on fixed UI and
   drop them on everything in a list.

Three is deliberately **not** in the first version. It is a heuristic with
known blind spots — it gives up after six levels, and two lookalike siblings
read as a coincidence — and a heuristic is the wrong thing to put between a
customer's data and a database. It can be offered later as a third setting an
operator chooses knowingly. It must never be the default, because a default
is exactly the case where nobody chose anything.

### What survives masking, and the one gap in it

Selectors are built from test ids, hand-written ids, tag names, hand-written
class names and `:nth-of-type` positions. `isStableId` in `@wendmark/dom`
already rejects anything with three digits in a row or a hex suffix, so
`#order-FK-10421` never becomes a selector in the first place. Paths keep
their shape and lose their ids: `/orders/10421` is stored as `/orders/*`,
the same wildcarding `urlMatches` already does when it compares pages.

The gap is `data-testid`. It is taken as given, because it is the best anchor
there is and breaking it breaks the replay. An application whose test ids are
built from record ids — `data-testid="order-FK-10421"` — would store that id,
and no heuristic can tell that apart from a developer's naming convention
without also throwing away the good ones.

That is not fixable by code, so it is written down instead: the per-app
policy exists because the operator is the only party who knows what their own
markup contains, and `docs/security.md` has to say this out loud rather than
claim structure is always impersonal.

### What is not captured, in any configuration

- No field values, no keystrokes, no `contenteditable` contents. Unchanged
  from the recorder, and the same `Target` schema enforces it.
- No screenshots or serialised DOM. See `step-snapshots.md`.
- No console output and no network bodies in the first version. Both read as
  "diagnostics" and both routinely carry tokens, email addresses and ids in
  stack traces and URLs. Failed request _statuses_ — method, path pattern,
  status code — are worth having and can be added behind their own switch,
  once there is a path-shape filter to go with them.
- Nothing before the user pressed the button, and nothing after they stopped.
- No user identity, unless the app itself passes an opaque `userRef` it
  already knows. Stored as given, never parsed, capped at 200 characters.
  Without it, an operator can read a report but cannot reply to anyone — which
  is the trade an operator should get to make.

## Who the data belongs to

The app operator is the data controller; Wendmark (or a self-hoster) is the
processor. That is why the per-app switch is off by default, why retention is
a setting and not a constant, and why deletion is a hard delete. It also
means the portal has to be able to answer "delete everything about this
person" — hence `userRef` being indexed, and a delete-by-`userRef` action.

## Shape

### The write path is public, and that is new

Flows are written by staff holding an author session, paired through the
portal. A report has no session to hold: the person writing it is a customer
who has never heard of Wendmark. So the endpoint is keyed by the app's public
key, which anyone can read out of the page.

`POST /api/v1/reports`, and unlike `/api/v1/ping` it is strict:

- **Origin must be on the app's allowlist.** Ping is wide open because it
  writes a timestamp; this writes rows with content in them.
- **Rate limited** per app and per origin, with the in-memory limiter. A
  brake on a runaway script, not a defence — that belongs in a proxy, and
  `docs/security.md` already says so.
- **Body capped** before parsing, and step count capped at the recorder's
  `MAX_STEPS`.
- **Always 202, never a reason.** Same as every other public endpoint: it
  must not help anyone work out which keys are real or which apps have
  reports switched on.
- **Off by default**, per app.

### Stages

1. **This document.** Plus `ReportSchema` and the masking function in core,
   with tests. Nothing imports them yet: the privacy-critical part is small
   enough to read on its own, and that is the point of putting it first.
2. **The snippet.** A "Report a problem" item in the launcher when the app
   has it on; retrace with a badge that says what is being noted; a preview
   with a remove button per step; a sentence from the user; send. Masking runs
   before the preview, so the preview is the truth and not a nicer version of
   it.
3. **The portal's write path.** The `Report` model, the endpoint, the
   per-app switch and label policy in app settings, exposed through
   `/api/v1/config` so the snippet knows whether to offer it, and retention
   applied on write.
4. **The portal's read path.** An Issues list per app, a report replayable
   with the player, delete one, delete by `userRef`, and the sweep that
   enforces retention.

### Replaying a report

**Replay in the app** on a report's page opens the app in a new tab, on the
address the report came from and its first page, with `#wm=replay` in the
address. The snippet there asks the portal for permission, exactly as author
mode does ([author-mode.md](/decisions/author-mode/)): it invents a code, the portal
tab that is waiting approves it, the snippet collects a session. Nothing
secret is in the address and no window talks to another.

What differs is what the session is worth:

- **One report, read only.** Pairing requests and author sessions carry a
  purpose, `record` or `replay`. A replay session has the report's id and
  can fetch that report and nothing else; it cannot save a draft. A
  recording session cannot read reports. A request for one purpose is never
  approved as the other.
- **`report:read` to approve it,** the same permission as opening the report.
  Viewers cannot.
- **Fifteen minutes,** not an hour: reading a report takes seconds and
  following it a few minutes.
- **A POST with the token in the body,** so it never sits in an address.

The replay code lives in `author.js`, not `snippet.js`: only people sent from
the portal ever replay, so ordinary visitors do not pay for it. It plays the
report's steps with the ordinary player and teaching cursor, preceded by a
step saying this is what somebody did, not necessarily the right way, so
nobody takes it for a guide. Progress is not remembered between page loads:
the portal serves flows by id to anyone with the app's key, and a report is
not one of them.

**Wendmark still never acts.** Whoever replays clicks every step themselves,
in their own account. That is also the limit: their data is not the
customer's, so a step can point at a row they do not have. The player then
says it cannot find the step, and Skip moves on; often that difference is
the bug.

Masked page addresses (`/orders/*`) match any identifier in that place.
When the first page had one masked out, the replay opens the app's root
instead, and the guide says which page each step is on, as any guide does.

## Consequences

- `docs/security.md` gains a section: reports are the one thing Wendmark
  stores that can contain a customer's own data, and the paragraph has to say
  so plainly rather than in terms of structure.
- The 30 KB snippet budget absorbs the retrace and preview UI. There is
  roughly 17 KB of headroom today (12.62 KB used), and this is end-user
  facing at the moment somebody is already annoyed, so it must not be a lazy
  fetch like `author.js`.
- `SCHEMA_VERSION` is untouched. A report is not a flow and does not go
  through `FlowSchema`; it reuses `StepSchema` for its steps.
- A report can later become a flow, or be attached to one ("people get stuck
  at step 3"). Nothing in stages 1–4 should make that harder, which is the
  only reason the steps are the same type and not a report-shaped copy.
