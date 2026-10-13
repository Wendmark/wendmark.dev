---
title: "Install it"
description: "Run the Wendmark portal locally or on your own infrastructure, then add one script tag to your application."
---

There is no hosted Wendmark. You run the portal, it serves the snippet, and
your application loads it. Two steps: get the portal running, then point your
app at it.

## Run the portal locally

Requirements: **Node 22** (see `.nvmrc`), **pnpm 9**, and Docker for the
database.

```bash
git clone https://github.com/Wendmark/wendmark.git
cd wendmark
corepack enable
pnpm install
pnpm bootstrap
pnpm dev
```

`pnpm bootstrap` starts Postgres, writes `apps/portal/.env` with a generated
`AUTH_SECRET`, applies the migrations and seeds an example organization, app
and process. Run it as often as you like: it never overwrites an existing
`.env`, and the migration and seed are both idempotent.

Already have a Postgres you would rather use? Copy
`apps/portal/.env.example`, point `DATABASE_URL` at it, and `pnpm bootstrap`
leaves your database alone and does the rest.

That gives you:

- **Portal** at `http://localhost:3100` — sign in as `dev@example.com` with
  the password the seed printed
- **Fika** at `http://localhost:5174` — a pretend coffee-subscription app to
  try guidance against, with the snippet already installed

:::note
A real installation does not use the seed. An empty database sends you to
**/setup** to create your organization and its first administrator, and that
screen closes for good once any user exists.
:::

## Add your own app

In the portal, add an app and give it the origins its snippet may be used
from — `https://app.example.com`, your staging address, `http://localhost:…`
for development. Anything not on that list is refused, so a key lifted from
your page is no use anywhere else.

The portal then gives you a tag:

```html
<script src="https://your-portal.example.com/snippet.js" data-app="wm_…"></script>
```

Paste it into your application and reload. The portal's page for that app
stops saying "waiting" once it has seen the snippet, so you know the tag is
live before you record anything.

The key is **not a secret**. It identifies an app; it does not authenticate
anyone. Permission to change a process always comes from a portal session.

## What the snippet does to your page

As little as possible, by design:

- **Shadow DOM.** Everything renders inside one host element with an open
  shadow root and `:host { all: initial }`. Your CSS cannot reach it and its
  CSS cannot reach you.
- **One global.** `window.Wendmark`, and nothing else. No prototype patching,
  no polyfills touching built-ins.
- **No framework**, and a **30 KB gzipped budget** enforced in CI. It is
  currently 18.7 KB.
- **Nothing in your interface unless you ask.** The launcher button is off by
  default.

## Showing people the processes

Either turn on the launcher in the portal — a button in the corner, named
whatever suits your product — or leave it off and call the API from your own
help menu:

```js
Wendmark.openLauncher()          // the list of processes
Wendmark.listFlows()             // if you would rather render it yourself
Wendmark.start('<flow-id>')      // start one directly
Wendmark.reportProblem()         // let them report what went wrong
```

A process can also be **hidden**, which keeps it out of the launcher while
`start(id)` still plays it. That is how you attach guidance to one of your own
buttons without it appearing in a general list.

`reportProblem()` only does something once problem reports are switched on for
the app. See [Let users report a problem](/start/reporting/).

## Running it for real

```bash
cp .env.prod.example .env.prod          # three values to fill in
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

[Deploying](/running/deploying/) covers the settings, the Content Security
Policy your customers' apps need, key rotation, what is stored and upgrading.
