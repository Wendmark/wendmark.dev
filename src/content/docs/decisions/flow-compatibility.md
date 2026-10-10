---
title: "Flow format compatibility"
description: "What happens when a portal serves a flow to a snippet that is."
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/decisions/flow-compatibility.md
---

older than the flow

## The problem

Today the portal serves no flows. The only snippet that exists is the one we
build, and the only flows are the ones we hand it. Version skew cannot
happen.

The moment the portal starts serving flows (#32, #33), that changes.
`snippet.js` sits cached in browsers we do not control, on pages we cannot
reload. A flow written in a newer format will meet an older snippet, and
today that snippet would fail `looksLikeFlow`, ignore the flow, and say
nothing at all. The user sees no guidance and no reason for it.

## What skew is actually possible

Worth being precise, because it narrows the problem.

The portal **serves the snippet**. A self-hoster who upgrades their portal
upgrades the snippet at the same moment — they are one deployment. So the
skew is never "old portal, new snippet". It is only ever:

```
new portal  +  old snippet still cached in someone's browser
```

which is bounded by however long `/snippet.js` is cached, plus the time until
that tab is reloaded. That is hours or days, not years — but during those
hours the guidance is broken.

## Decision

**1. Additive changes never bump `SCHEMA_VERSION`.**

A new optional field on a flow, a step or a target is not a breaking change.
Old snippets must ignore fields they do not recognise, and the guard is
written so they do. This is the discipline that keeps everything else rare:
most changes we can imagine are additive.

The zod schemas stay `strictObject`, so the **portal** still refuses unknown
keys from a snippet. That direction is not skew — a snippet sending a field
its own portal has never heard of is a bug, not a version difference.

**The rule holds only while ignoring the field is harmless**, and that is
worth checking each time rather than assuming. A field that decorates a step
can be dropped safely. A field that changes what the user is asked to do
cannot: a `times: 3` on a step meaning "press this three times" would be
ignored by an older snippet, which would then guide somebody to press it
once and say nothing was wrong. Silence is the problem — an old snippet
refusing a flow is visible, an old snippet quietly giving wrong guidance is
not. When ignoring a field would change the outcome, express it some other
way. Repeated presses became three separate steps for exactly this reason.

**2. A new step type counts as breaking, and is caught by shape, not by
number.**

`checkFlow` reports `too-new` when it meets a step type it does not know,
whatever the version says. An old snippet cannot play a `wait` step by
ignoring it — the process would be wrong, not incomplete — so it must refuse
the whole flow.

**3. The snippet tells the portal its version, and the portal decides.**

When the snippet asks for an app's flows (#32), it sends the format version
it understands. The portal serves what that snippet can play and leaves out
what it cannot. The logic lives in the portal, because the portal is the part
that can be deployed; a cached snippet is not.

This is preferred over putting a `minSnippetVersion` on each flow and letting
the snippet skip what it cannot play. Both work, but the portal knows more —
it can serve an older version of a flow, or explain in the dashboard that a
flow is not reaching some visitors. A snippet can only stay quiet.

**4. Refusal is never silent.**

`checkFlow` returns `ok`, `too-new` or `malformed` rather than a boolean, so
a caller can tell "your flow is wrong" from "this page has an old copy of
Wendmark". `start()` throws a message naming which. When the launcher (#34)
exists, a `too-new` flow should be visible in it as unavailable rather than
missing.

## Consequences

- `@wendmark/core/guard` exports `checkFlow` alongside `looksLikeFlow`, which
  is now a wrapper. Both are zero-dependency.
- #32 must include the snippet's format version in the config request, and
  #33 must send it. This decision is not finished until they do.
- `/snippet.js` needs a deliberate `Cache-Control`. A long cache makes skew
  last longer; no cache costs every visitor a request. Decide it in #32, and
  write the number down — the skew window is that number.
- `SCHEMA_VERSION` is still 1, and should stay 1 for as long as we can manage.
  Bumping it is a real cost paid by users who did nothing wrong.

## What this does not cover

A flow recorded by a **newer snippet** and saved to an **older portal**
cannot happen while the portal serves the snippet. If Wendmark ever ships a
browser extension that records against portals it did not come from, that
assumption breaks and this decision needs revisiting.
