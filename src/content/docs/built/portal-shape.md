---
title: "The shape of the portal"
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/architecture/01-portal-shape.md
---

Everything portal lives in `apps/portal`. Four directories carry the weight:

```
apps/portal/
  app/          pages and HTTP endpoints — Next.js owns this folder's shape
  actions/      server actions: what a form submit runs
  lib/          the actual logic. No Next.js in here except where unavoidable
  prisma/       the database schema and its migration history
  generated/    the Prisma client, built from the schema. Gitignored.
```

Inside `app/`, parentheses are route **groups** — they organise files without
appearing in the URL:

```
app/(auth)/sign-in/page.tsx              → /sign-in
app/(dashboard)/apps/[appId]/page.tsx    → /apps/<id>
app/api/v1/author/flows/route.ts         → POST /api/v1/author/flows
```

A `page.tsx` renders HTML for a person. A `route.ts` exports `POST`, `GET`,
`OPTIONS` and answers a machine. The dashboard is pages; everything the
snippet talks to is `app/api/v1/…`. That split is deliberate: the snippet's
endpoints are a public API with CORS and a version number, the dashboard is
not an API at all.

## The one structural rule

**A page never touches the database. A service never touches HTTP.**

Four layers, every time. Deleting a process, traced end to end:

**1. The page** (`app/(dashboard)/apps/[appId]/processes.tsx`) — a form whose
`action` is a function, not a URL:

```tsx
<form action={remove}>
  <input type="hidden" name="flowId" value={flow.id} />
  <button type="submit" className="destructive">
    Yes, delete
  </button>
</form>
```

**2. The action** (`actions/flows.ts`) — reads the form, calls the service,
turns failures into a message:

```ts
export async function deleteFlowAction(_previous: FormResult, form: FormData): Promise<FormResult> {
  const appId = String(form.get('appId') ?? '')
  try {
    await deleteFlow(await context(), String(form.get('flowId') ?? ''))
  } catch (error) {
    return explain(error)
  }
  revalidatePath(`/apps/${appId}`)
  return {}
}
```

**3. The service** (`lib/flows/service.ts`) — checks the permission, owns the
rule:

```ts
export async function deleteFlow(ctx: Context, flowId: string): Promise<{ appId: string }> {
  requirePermission(ctx.role, 'flow:delete')
  const flow = await own(ctx, flowId)

  await getDb().flow.update({ where: { id: flow.id }, data: { deletedAt: new Date() } })
  return { appId: flow.appId }
}
```

**4. The database** — `getDb()`, and only ever from `lib/`.

> **What a server action is.** `'use server'` at the top of `actions/flows.ts`
> marks every export as runnable on the server _from the browser_. React posts
> the form, Next runs the function on the server, and `revalidatePath` tells
> it to re-render that page with fresh data. No `fetch`, no endpoint, no JSON.
> It only works for the portal's own pages, which is why the snippet gets
> `route.ts` files instead — it lives on someone else's domain.

To learn what the portal _does_, read `lib/`. To learn what a button does,
read `actions/`. Pages are arrangement.

## The `ctx` object

Every service function takes the same first argument:

```ts
export interface Context {
  userId: string
  organizationId: string | null
  role: string | null
}
```

Built once at the top of a page or action from `requireUser()`. Every query
then filters by organization:

```ts
where: { id: flowId, deletedAt: null, app: { organizationId: ctx.organizationId ?? '' } }
```

One organization exists today. This filter is what makes adding more a switch
rather than an audit of every query. The `?? ''` matters: a user with no
organization matches nothing, rather than everything.

## Permissions belong in the service

`lib/permissions.ts` is a table:

```ts
const PERMISSIONS: Record<Role, Action[]> = {
  admin: ['app:read', 'app:create', /* … */ 'flow:delete', 'member:manage'],
  editor: ['app:read', 'app:create', /* … */ 'flow:delete'],
  viewer: ['app:read', 'flow:read'],
}
```

Two ways to use it, and the difference is the point:

- `can(role, 'flow:delete')` → boolean, used in pages to **hide** a button
- `require(role, 'flow:delete')` → throws, used in services to **refuse** the
  work

A hidden button is a courtesy. The refused mutation is the rule. Anyone can
call a server action from a console.

## Two conventions that explain a lot of the code

**Nothing happens on import.** Both `getEnv()` and `getDb()` are functions,
not constants:

```ts
export function getEnv(): Env {
  cached ??= parseEnv(process.env)
  return cached
}
```

When `lib/env.ts` validated at import time, every test that touched a service
needed a live `DATABASE_URL`, and CI failed on module load order. Importing a
module should not connect to anything.

`getDb()` also stashes the client on `globalThis` in development, because Next
reloads modules on every save and would otherwise open a new connection pool
each time until Postgres refused.

**The database client is generated, not installed.** `generated/prisma/client`
is built from `prisma/schema.prisma` and is gitignored, which is why
`package.json` has a `postinstall` hook. The practical consequence: **after
changing the schema, restart the dev server.** The running process imported
the old client, and a new model shows up as `undefined`.

## Checks

```bash
grep -rn "getDb()" apps/portal --include=*.tsx
```

Should return nothing — no page or component talks to the database directly.

```bash
grep -rln "requirePermission\|require(" apps/portal/lib/*/service.ts
```

Every service file. A missing one is a hole.
