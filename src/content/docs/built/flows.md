---
title: "Flows"
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/architecture/05-flows.md
---

A **flow** is the product: an ordered list of steps that guides someone
through a process. Everything else in the portal exists to store, edit and
serve these.

## One definition, three places

`@wendmark/core` is the only package with no internal dependencies, and this
is why. The snippet records flows, the player plays them, the portal stores
them — all three must agree on exactly one shape.

`packages/core/src/schemas.ts`:

```ts
/**
 * Objects are strict — unknown keys are rejected rather than silently dropped,
 * so a step can never smuggle in fields another part of the system ignores.
 */
```

`strictObject` does real work. When the save endpoint refuses a `Target`
carrying `value: '4111'`, that is not a special case someone wrote for card
numbers — `value` is not a key, so the object is invalid. The privacy rule is
enforced by the shape, not by a blocklist.

Three step types:

| Type          | What it means  | How it completes                                   |
| ------------- | -------------- | -------------------------------------------------- |
| `action`      | Click this     | the user clicks it                                 |
| `input`       | Fill this in   | the `change` event fires — the value is never read |
| `instruction` | Just read this | the user presses Done                              |

Every `Target` field is structural or an authored label. `selectors` is an
array of up to five because one CSS selector is brittle: the resolver in
`@wendmark/dom` scores several signals together — role, accessible name, test
id, surrounding context, selectors — so losing one does not lose the element.
That is why fingerprints are fat.

## The zod problem

Importing anything from `@wendmark/core`'s root pulls in **zod, ~95 KB
gzipped**, because building a schema is a top-level call the bundler cannot
drop. That is three times the snippet's entire budget.

So there are two entry points. `packages/core/src/guard.ts` is hand-written
and depends on nothing:

```ts
export function looksLikeFlow(value: unknown): value is Flow {
  if (!isRecord(value)) return false
  if (value.schemaVersion !== SCHEMA_VERSION) return false
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name)) return false
  return Array.isArray(value.steps) && value.steps.length > 0 && value.steps.every(looksLikeStep)
}
```

`SCHEMA_VERSION` lives in its own `version.ts` purely so the guard can read
it without touching `schemas.ts` and dragging zod in behind it.

**The division of labour:** the browser gets a cheap shape check, the server
does real validation. The portal validates with `FlowSchema` before anything
is stored or served, so the snippet never has to trust what it is given and
never pays for the checking.

Type-only imports are free, which is why the snippet is full of
`import type { Flow } from '@wendmark/core'`. Dropping the `type` adds 95 KB,
and `pnpm size` is what catches it.

## Recording: the draft model

While recording, the flow is a `Draft`
(`packages/snippet/src/author/draft.ts`), and every operation is pure:

```ts
export function removeStep(draft: Draft, id: string): Draft {
  return { ...draft, steps: renumber(draft.steps.filter((step) => step.id !== id)) }
}
```

Nothing mutates; the panel re-renders from the returned draft. That is why
the fiddly rules — renumbering after a delete, refusing to move past the end,
ignoring an empty rename — are plain unit tests with no DOM at all.

`renumber` keeps ids as `s1, s2, s3…` after every edit. Those ids are what
the portal stores, and what any future AI-assisted editing would key
decisions to. `toFlow(draft, id)` produces a real `Flow` when saving.

## Saving: the order of the checks is the design

`app/api/v1/author/flows/route.ts`, read as a sequence — each step guards the
next:

```ts
const declared = Number(request.headers.get('content-length') ?? '0')
if (Number.isFinite(declared) && !isWithinSizeLimit(declared)) return tooBig(origin)

const raw = await request.text()
if (!isWithinSizeLimit(byteLength(raw))) return tooBig(origin)
```

The declared length is checked first, to refuse before reading a huge body;
then what actually arrived, because a header is a claim, not a fact.

```ts
const read = readDraftRequest(body)
// Reading the body first, then the session: a malformed request is worth
// the same answer whether or not the token behind it is real.
if (!read.ok) return bad(origin, read.error)

const session = await verifyAuthorSession(read.request.sessionToken, origin)
if (!session) return refuse(origin)
```

That ordering is easy to get backwards. Checking the session first would make
`401` mean "your token is bad" and `400` mean "your token is good but your
flow is wrong" — which tells anyone probing which tokens are real.

Then the line that matters most:

```ts
const draft = await saveAuthorDraft(session, read.request.flow)
```

`session`, not the request. The app id comes from the server's own record of
who this session is; a request cannot say which app to write into.

And the service never writes a status. `status` defaults to `draft` in the
schema, so the guarantee is not a check that could be forgotten — it is an
absence.

## Listing

`lib/flows/list.ts` holds the decisions that do not need a database:

```ts
export function stepCount(steps: unknown): number {
  return Array.isArray(steps) ? steps.length : 0
}
```

`steps` is a JSON column. A row written by a newer portal, or edited by hand,
might not hold an array — and a list should still render. The same instinct
on the process page:

```ts
function readSteps(steps: unknown): Step[] | null {
  const parsed = FlowSchema.shape.steps.safeParse(steps)
  return parsed.success ? parsed.data : null
}
```

`null` becomes an explanation on screen, not a crash.

Status is translated once, into words a product owner uses:

```ts
if (status === 'published') return 'Users can see this'
if (status === 'paused') return 'Hidden from users'
return 'Not published yet'
```

No badge saying `DRAFT`. The screen says what it means for the people the
flow is meant to help.

## What is not built yet

The authoring half is done. The delivery half is not:

- `status: published` — a column nothing reads
- `urlPatterns: []` — rules nothing applies
- `visibility` — never consulted
- `FlowVersion` — a table with no rows

The schema was designed for them, which is why those issues are small once
started. The open decision is flow-format compatibility: `FlowSchema` pins
`schemaVersion: z.literal(1)`, so a portal serving a version-2 flow to an old
snippet produces a flow that silently fails `looksLikeFlow` and never plays.
Harmless while nothing is published; not harmless the day after.

## Checks

```bash
grep -rn "from '@wendmark/core'" packages/snippet/src | grep -v "import type"
```

Should return only `guard` imports. Anything else means zod is in the
snippet.

```bash
pnpm size
```

The number that keeps the snippet honest.
