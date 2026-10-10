---
title: "Step snapshots"
description: "Whether the portal stores a picture of what each step points at."
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/decisions/step-snapshots.md
---

## The idea

The portal's editor shows each step as a line of text:

```
2.  Press Add a tasting note
    Clicks Add a tasting note in My tastings
```

A snapshot — a screenshot or a serialised piece of DOM, captured while
recording — would show the actual control, in place, ringed. Heatmap and
session-replay tools do this, and it is why their editors feel concrete.

## Decision

**The portal does not capture or store snapshots.** Not off by default, not
behind a per-app switch: it does not have the feature.

If it is ever built, it belongs in the browser extension, and the question of
where those snapshots live has to be answered before any of it is written.
See "If the extension does it" below, because relocating the feature does not
by itself solve the problem.

## Why

### The guarantee is currently an absence, and absences do not regress

Today Wendmark can say, flatly, that it never records anything a user typed.
Three things hold that up, and all three are things that _do not happen_: the
recorder never reaches for a value, a test fails if anything reads the value
getter, and the `Target` schema rejects unknown keys server-side.

Masking is the opposite shape. It is code that has to run correctly, every
time, against markup it has never seen, inside applications we do not
control. A custom combobox, a grid drawn on a canvas, a tooltip holding an
account number — each is a case somebody has to have thought of. You can test
the cases you imagined. You cannot test the ones you did not.

"We never read it" and "we removed it correctly" are different promises, and
only one of them can be checked by reading three small files.

### It changes what a leaked database means

Today: the structure of an application and the labels its own designers
wrote. Roughly a copy of the interface.

With snapshots: pictures of real orders, real names, real balances. The
person recording "how to refund an order" is looking at somebody's actual
refund.

### A per-app switch does not protect the position

Once the feature exists, the honest answer to "what does Wendmark store?"
becomes "it depends how it is configured" — for everyone, including the
companies that never turn it on. Every security review then goes through
masking correctness instead of a short, checkable list. That cost lands on
people who get no benefit from the feature.

### The benefit is narrower than it first sounds

Snapshots help when somebody edits a process they did not record, when an
application has several identical-looking controls, and when a step has
broken and you need to see what it used to point at. All real, and all
scaling with team size and with how long ago something was recorded.

They help not at all when you recorded it ten minutes ago in an application
you use daily — which is every case, for anyone small enough to be trying
Wendmark for the first time.

An absolute privacy claim is useful on the first day. Snapshots become useful
on roughly the hundredth.

## What to do instead

**Open the app at this step.** The editor links into the application at the
page a step was recorded on, with that step highlighted. It answers the same
question — _what does this point at_ — for the cost of a click and a page
load, stores nothing, and needs no masking because nothing leaves the page.

Slower than looking at a picture. Also impossible to get wrong.

## If the extension does it

An extension is installed deliberately, runs on the author's own machine, and
screen capture is an expected thing for one to do behind the browser's own
permission prompt. That makes _capturing_ more defensible. It does not settle
where the result goes, and that is the part that matters:

- **Kept local to the extension**, the privacy position survives intact — and
  the snapshots are visible only to the person who captured them, which does
  not serve the use case that motivated the feature.
- **Uploaded to the portal**, the use case is served and the position is gone,
  exactly as it would have been if the snippet had captured them. The capture
  mechanism was never the issue; the storage is.

So the question the extension has to answer is not "can we capture this
safely" but "who is allowed to see it, and where does it rest". Anyone
reopening this should start there.

## Consequences

- [Issue #31](https://github.com/Wendmark/wendmark/issues/31) is closed
  against this document rather than left open as an intention.
- `docs/security.md` can keep saying no field values are ever read or stored,
  without qualification.
- `docs/deploying.md` can keep saying there is no object storage, which was
  the main infrastructure snapshots would have added.
- The editor stays text-only until "open the app at this step" exists.
- If a real user is ever genuinely blocked by this, that is a reason to
  reopen it — with a concrete constraint to design against rather than a
  guess about what people might want.
