---
title: "Auth"
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/architecture/02-auth.md
---

Who is signed in, and what may they do. The whole area was shaped by one
constraint: Wendmark is open source, a company installs it on their own
server, and it cannot assume they have email working.

The reasoning behind each choice, with the alternatives weighed, is in
[docs/decisions/auth.md](/decisions/auth/). This document covers the code.

## First run

Most products sign you in by emailing a link. A self-hoster has no SMTP
server on day one, so that would mean nobody can ever get in. Hence: email
and password by default, optional single sign-on.

That leaves a chicken-and-egg problem — a fresh database has no users, and you
need a user to sign in:

```
fresh install → /setup → first admin + organization → /sign-in → dashboard
```

`lib/auth/setup.ts` is the whole gate:

```ts
export async function needsSetup(): Promise<boolean> {
  return (await getDb().user.count()) === 0
}
```

Once one user exists the screen is closed for good. `app/setup/actions.ts`
checks it **again** inside the action:

```ts
// Checked again here: a form could be submitted after someone else has
// already finished setting the instance up.
if (!(await needsSetup())) return { error: 'This instance is already set up.' }
```

Same principle as permissions: the page check is a courtesy, the action check
is the rule.

## Passwords

`lib/auth/password.ts`:

```ts
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const
```

Argon2id is _memory-hard_: cracking it needs 19 MiB of RAM per guess, so a
GPU farm buys an attacker far less than against bcrypt, which is cheap on
memory. Those numbers are OWASP's current recommendation.

The verifier treats a missing hash as normal, not as an error:

```ts
export async function verifyPassword(hashed: string | null, password: string): Promise<boolean> {
  if (!hashed) return false
  try {
    return await verify(hashed, password, OPTIONS)
  } catch {
    return false
  }
}
```

An account created through SSO has no password at all, and a malformed hash
is a failed sign-in rather than a 500.

## Sessions are JWTs

`lib/auth/config.ts`:

```ts
session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
```

A database session is a row; signing someone out means deleting it. A JWT is
a signed blob in a cookie; the server reads it without a lookup, which is
faster and simpler to deploy, but **it cannot be deleted**. It is valid until
it expires.

So revocation works through `sessionVersion`, an integer on the user:

```ts
const known = typeof token['sessionVersion'] === 'number' ? token['sessionVersion'] : null
if (known !== null && known !== account.sessionVersion) return {}

token['sessionVersion'] = account.sessionVersion
```

Returning `{}` empties the token, which ends the session. Bump the column and
every existing JWT for that user dies on its next refresh.

The same callback re-reads the membership each time:

```ts
const membership = account.memberships[0]
token['organizationId'] = membership?.organizationId ?? null
token['role'] = membership?.role ?? null
```

That is why a role change takes effect without waiting for expiry — the role
is not frozen into the token.

**Known gap.** Nothing writes `sessionVersion` yet. The mechanism is in place
and read on every refresh, but there is no "sign out everywhere" and no bump
on password change.

## Where the sign-in gate is

There is no middleware file. Protection is per-page, through one function:

```ts
export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser()
  if (!user) redirect('/sign-in')
  return user
}
```

The dashboard's layout calls it once for everything in the group:

```tsx
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()
```

Route groups earn their keep here: one call covers the app list, each app,
settings and each process. `app/(auth)/` is a separate group with no such
call, which is how `/sign-in` stays reachable.

Everything under `app/api/v1/` is deliberately outside this. The snippet is
not a signed-in browser; those endpoints authenticate with their own tokens —
see [author mode](/built/author-mode/).

## Saying nothing useful

Sign-in failure:

```ts
// Deliberately vague: saying which half was wrong tells an attacker
// which email addresses exist.
return { error: 'That email and password do not match an account.' }
```

And in the credentials provider, a detail that is easy to miss:

```ts
const user = await getDb().user.findUnique({ where: { email } })
// Verify even when there is no such user, so the response time does not
// reveal which email addresses exist.
const ok = await verifyPassword(user?.passwordHash ?? null, password)
if (!user || !ok) return null
```

Skipping the hash for an unknown email would return in 2 ms instead of 50 ms,
and anyone could enumerate users with a stopwatch. The same habit appears in
author mode: one refusal for every reason.

## Checks

```bash
grep -rn "auth()" apps/portal/lib apps/portal/app | grep -v node_modules
```

Should only appear inside `lib/auth/session.ts` — that is the "one place"
that file's comment claims.
