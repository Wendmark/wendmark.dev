---
title: "Authentication"
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/decisions/auth.md
---

Decided 2026-09-23, for the self-hosted portal.

## Context

Wendmark is open source and meant to be installed by a company on its own
servers, possibly on an internal network with no outbound access. Whatever we
choose has to work there first, and in a hosted service second.

## Decisions

### Password sign-in by default, OIDC opt-in

Email and password work everywhere with no dependencies. Single sign-on is
enabled by setting three environment variables (issuer, client id, client
secret), which covers Entra ID, Google Workspace, Keycloak and Okta.

**Email is never required.** Magic links are pleasant but need SMTP, and a
company installing this internally often has no mail relay to hand — a
self-hoster who cannot log in at all is the worst possible first impression.
Invites work without email too: an admin creates the user and passes on a
one-time link.

Passwords are hashed with Argon2id. Sign-in is rate limited.

### JWT sessions, with a version to invalidate them

The session lives in a signed cookie rather than a database row: nothing to
store, nothing to look up.

The cost is that an individual session cannot be revoked. We mitigate that:

- Sessions are short-lived.
- `user.sessionVersion` is embedded in the token and checked on use. Bumping
  it invalidates every existing session for that user, which is what a
  password change, a role change and "sign out everywhere" all do.

All session reading and writing goes through `lib/auth/session.ts`, so
swapping to database-backed sessions later is one module, not an audit.

### A setup screen for the first administrator

A fresh install has an empty database and no way in. `/setup` creates the
first administrator **only while no users exist**, and is inaccessible
afterwards. The alternatives — a CLI command needing shell access, or an
admin password in an environment variable forever — are worse for the people
installing this.

### One organization now, shaped for many later

The `organization` table exists and every app and flow hangs off it, but the
product behaves as if there is one. Going multi-tenant later stays cheap only
if three rules hold from the start:

1. **No query without an organization.** Reads and writes go through service
   functions that take `{ userId, organizationId }`. Retrofitting that later
   means auditing every query for a data leak, which is the expensive and
   risky part of adding tenancy.
2. **The session carries the current organization**, even when there is only
   one to carry.
3. **URLs are `/apps/[appId]` for now.** Ids are UUIDs, so an `/o/[slug]`
   prefix can be added later with redirects and no URL breaks.

What remains for a hosted service: sign-up, an organization switcher,
invites, billing and per-organization limits. Product work, not surgery.

## Consequences

- No external identity service is needed, and none is assumed.
- A stolen token is valid until it expires or the user's session version
  changes. That is the trade we accepted for not storing sessions.
- Postgres row-level security stays available later if hard isolation is
  wanted for a hosted tier.

## Open

- SAML and SCIM are not planned for the open version; they are the usual
  enterprise line.
