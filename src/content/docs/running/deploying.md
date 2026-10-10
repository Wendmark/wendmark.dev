---
title: "Deploying"
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/deploying.md
---

What you need to run the portal somewhere other than your laptop. For getting
it running locally, the [README](https://github.com/Wendmark/wendmark) is shorter.

Wendmark is one web application and one Postgres database. There is no queue,
no cache, no object storage and nothing to scale separately.

## The quickest real deployment

```bash
git clone https://github.com/Wendmark/wendmark.git && cd wendmark
cp .env.prod.example .env.prod          # fill in the three required values
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

That starts Postgres, applies the migrations, and runs the portal on
`PORTAL_PORT` (3100 by default). Put a reverse proxy in front of it for TLS.

Then open the portal. An empty database sends you to **/setup**, which
creates your organization and its first administrator — and closes
permanently once any user exists.

## Settings

Only three have no sensible default.

| Variable             | Required       | What it is                                                     |
| -------------------- | -------------- | -------------------------------------------------------------- |
| `DATABASE_URL`       | yes            | Postgres connection string                                     |
| `AUTH_SECRET`        | yes            | Signs session cookies. `openssl rand -base64 32`               |
| `AUTH_URL`           | yes            | The public address people reach the portal on, with the scheme |
| `AUTH_TRUST_HOST`    | behind a proxy | `true`, so Auth.js believes the forwarded host                 |
| `OIDC_ISSUER`        | no             | Single sign-on. All three OIDC values or none                  |
| `OIDC_CLIENT_ID`     | no             |                                                                |
| `OIDC_CLIENT_SECRET` | no             |                                                                |
| `OIDC_NAME`          | no             | What the sign-in button calls your provider                    |

A variable set to an empty string counts as absent, because that is what
compose and Kubernetes produce for an optional value nobody filled in.

**`AUTH_SECRET` is the one to get right.** Changing it signs everybody out.
Losing it means nobody can sign in. Keep it with your other secrets, not in
the repository.

**`AUTH_URL` matters more than it looks.** The portal sits behind your proxy
and cannot work out its own public address from a request. It is also the
address the snippet is served from, so it has to be reachable from your
customers' pages — not an internal hostname.

## Without compose

The image is a plain Next.js standalone server on port 3100. It needs
`DATABASE_URL`, `AUTH_SECRET` and `AUTH_URL` in its environment, and it
**cannot migrate its own database** — the Prisma CLI is deliberately not in
the runtime image.

Run migrations as a release step, from the build stage, which has the CLI:

```bash
docker build --target build -t wendmark/migrate .
docker run --rm -e DATABASE_URL="$DATABASE_URL" wendmark/migrate \
  pnpm --filter @wendmark/portal exec prisma migrate deploy
```

Prisma takes an advisory lock while migrating, so running this from several
places at once waits rather than collides.

## Serving the snippet

The portal serves `snippet.js` and `author.js` as static files. Customers
point a script tag at your portal:

```html
<script src="https://wendmark.example.com/snippet.js" data-app="wm_…"></script>
```

Two things follow from that.

**It must be reachable from your customers' pages.** A portal on an internal
network can record and publish, but no end user will ever see guidance.

**It is cached for five minutes.** `Cache-Control: public, max-age=300,
must-revalidate`. That number is the version-skew window: for five minutes
after you upgrade, some visitors are still running the previous snippet
against your new portal. The flow format is designed for exactly this — see
[flow-compatibility.md](/decisions/flow-compatibility/).

### Content Security Policy

If a customer's app sets a CSP — and a careful one does — they need to allow
your portal in three places:

```
script-src  https://wendmark.example.com    # snippet.js and author.js
connect-src https://wendmark.example.com    # config, flows, the install ping
style-src   'unsafe-inline'                 # only if they do not already allow it
```

`style-src` deserves a word. Wendmark's interface lives in a shadow root with
`:host { all: initial }`, and its styles go in a `<style>` element inside that
root. A page with a strict `style-src` that forbids inline styles will render
the guidance unstyled. Nothing is injected into the page's own `<head>`.

No `img-src` or `font-src` entry is needed: the snippet loads no images and no
web fonts.

## Keys and origins

Each app has a **public key** that appears in its script tag. It identifies
the app; it authenticates nobody, and it is visible to anyone who views
source. What stops another site using it is the **origin allowlist** on the
app: requests from an address that is not on the list get the same empty
answer as an unknown key.

Keep the list to addresses you control, and use `https` for everything but
localhost — the portal refuses plain `http` for anything else.

**Rotating a key** issues a new one and invalidates the old one immediately,
along with any author sessions recording against it. Any page still serving
the old script tag loses guidance until its tag is updated. Rotate when a key
has been somewhere it should not have been; there is no other reason to.

## What is stored

In Postgres, and nowhere else:

- **Organizations, users, memberships.** Email addresses, names, and Argon2id
  password hashes for accounts that use a password.
- **Apps.** Name, public key, origin allowlist, when the snippet was last
  seen and from where.
- **Processes.** The steps as recorded: for each one, the wording an author
  wrote and how to find the element — its role, accessible name, visible
  text, test id, surrounding context and CSS selectors.
- **Published versions.** A frozen copy of a process each time it is
  published, kept so a rollback has something to roll back to.
- **Short-lived author tokens and pairing requests**, which expire in seconds
  and are deleted when collected.

**Nothing a user types is ever recorded.** Not into a password field, an
email field or a payment field — no field values at all. The recorder reads
the structure of the page and the labels your own designers wrote.

Nothing expires on a schedule. Deleted processes are kept with a `deletedAt`
so a deletion can be undone; nothing reads them. If you need a retention
policy, it is yours to write.

**Back up Postgres.** It holds everything. There is no other state — the
portal keeps nothing on disk that matters.

## Upgrading

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Migrations run before the new portal starts, because the compose file makes
the portal wait for the migration service to exit cleanly.

Migrations are forward-only. There are no down migrations, so take a database
backup before upgrading if the data matters — which it does, because it is
every process anyone recorded.

For a few minutes after an upgrade, some visitors still have the previous
`snippet.js` cached. That is expected and handled; the compatibility rules are
in [flow-compatibility.md](/decisions/flow-compatibility/).

## Things that are not here yet

Worth knowing before you depend on them:

- **No "sign out everywhere".** Sessions are JWTs, revoked by bumping
  `user.sessionVersion`, and nothing in the portal writes that column yet.
  Changing `AUTH_SECRET` signs everyone out, bluntly.
- **The rate limit on saving drafts is per process**, held in memory. Several
  instances count separately. Put a real limit in your proxy if you need one.
- **No metrics endpoint, no structured logs.** The portal logs to stdout.
