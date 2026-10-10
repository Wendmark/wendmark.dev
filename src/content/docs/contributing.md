---
title: "Contributing"
editUrl: https://github.com/Wendmark/wendmark/edit/main/CONTRIBUTING.md
---

Wendmark is young and the architecture still moves. Issues are always welcome.
Pull requests are too, with one request: **for anything beyond a small fix,
open an issue first.** It is kinder than having work rejected on direction
after you have written it.

## Getting it running

```bash
corepack enable
pnpm install
pnpm bootstrap
pnpm dev
```

`pnpm bootstrap` starts Postgres, writes `apps/portal/.env`, migrates and
seeds. The [README](https://github.com/Wendmark/wendmark) has the detail, including how to point it at a
Postgres you already have.

## Before you open a pull request

```bash
pnpm typecheck && pnpm lint && pnpm test
```

For anything in `packages/snippet`, also `pnpm size`.

Changing the portal's service layer? There are tests against a real Postgres
too. They are not part of `pnpm test`, because a contributor fixing a typo
should not need Docker:

```bash
docker exec wendmark-postgres createdb -U wendmark wendmark_test   # once
DATABASE_URL="postgresql://wendmark:wendmark@localhost:5433/wendmark_test" \
  pnpm --filter @wendmark/portal test:db
```

They empty every table between files, so they refuse to run unless the
database name contains "test". That guard is the only thing standing between
a mistyped URL and every process you have recorded.

CI runs all four. None of them is advisory — `pnpm lint` includes the
dependency-boundary rules, and a violating import fails the build.

## The rules that are not negotiable

These are the ones to read before writing code, because the tooling will stop
you otherwise and it is better to know why.

**Wendmark guides, it never acts.** No synthetic clicks, no setting values, no
navigating for the user. A step advances because the person did the thing. If
a change would make Wendmark act on someone's behalf, it will not be merged —
raise it as an issue instead and we will find another way.

**The snippet is a guest in someone else's page.** Shadow DOM, one global,
no framework, and a 30 KB gzipped budget enforced in CI.

**The recorder never records what anyone types.** Not `.value`, not the text
content of a field, not keystrokes. Password, email and payment fields get no
special case, because there is no case: no field values, ever.

**Packages may only depend on what the table allows.** `eslint-plugin-boundaries`
enforces it and `scripts/boundaries.test.ts` proves every rule fires. Never
silence a boundaries error with a disable comment; change the table in a pull
request that explains why.

[CLAUDE.md](https://github.com/Wendmark/wendmark/blob/main/CLAUDE.md) is the long version, and it is worth the ten minutes.
[docs/architecture](/built/overview/) explains how each part works
and why it ended up that way.

## Licensing of contributions

Your contribution carries the licence of the directory it lands in —
Apache-2.0 under `packages/`, AGPL-3.0 under `apps/` and elsewhere. See
[LICENSING.md](https://github.com/Wendmark/wendmark/blob/main/LICENSING.md).

There is **no contributor licence agreement**, and none is planned. What you
contribute stays under the licence it arrived under, which means it cannot
quietly be made proprietary later.

We do ask for a **Developer Certificate of Origin** sign-off, which is one
line in your commit saying you wrote the change and have the right to give it
to us:

```bash
git commit -s -m "fix(snippet): ..."
```

That adds `Signed-off-by: Your Name <you@example.com>`. The full text of what
you are certifying is at [developercertificate.org](https://developercertificate.org/).

## Style

- Branch from `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`
- Conventional Commit titles, scoped: `feat(core): add input step type`
- One concern per pull request; don't mix a refactor with a behaviour change
- Say what changed, why, and how you checked it. Screenshots for visible changes
- Tests live beside the code as `*.test.ts`

Comments are for the reasoning, not the mechanics. The code says what it does;
a comment should say why it does it that way, especially when the obvious
approach was wrong.

## Security

Please do not open a public issue for a vulnerability. See
[SECURITY.md](https://github.com/Wendmark/wendmark/blob/main/SECURITY.md).
