---
title: "Trust model"
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/security.md
---

What is protected, what is not, and why. [SECURITY.md](https://github.com/Wendmark/wendmark/blob/main/SECURITY.md) is the
shorter document and says how to report something; this one is the reasoning
behind it.

Nothing here has been reviewed by a security professional. It is written so
that someone who knows this subject can disagree with it specifically.

## Two places, with very different trust

**The portal** is an ordinary authenticated web application. People sign in,
belong to an organization, and have a role. Everything they do is checked
against that.

**The snippet** runs in a customer's page, where it has no secrets and no
privileges. Anything it knows, the page knows. Anything it can do, any other
script on that page can do.

Almost every decision in Wendmark comes from keeping those apart: the portal
decides, the snippet shows.

## The ceiling, stated first

**Code in a page cannot keep a secret from other code in that page.** The
app's own JavaScript, an analytics tag, a chat widget, a browser extension —
they share one execution environment and can read everything the snippet
receives. No arrangement of iframes, message passing or obfuscation changes
this.

So Wendmark does not try to hide anything in the browser. It limits what
there is to steal.

## Who might attack, and what they reach

### A curious end user on a customer's page

They can read `snippet.js`, find the app's public key in the script tag, open
the console and call `Wendmark.start(id)` on any published process.

**That is the intended behaviour.** Published processes are guidance meant
for them. The key identifies an app; it authenticates nobody.

What they cannot do: see drafts, see paused or deleted processes, see
anything belonging to another app, or change anything. The config endpoint
answers with published, listed processes and nothing else, and the flow
endpoint serves only published ones.

### A malicious page using someone else's public key

They paste another company's key into their own site and ask for the config.

They get an empty answer. Every public endpoint checks the request's `Origin`
against the app's allowlist, and an address that is not on it is answered
exactly as an unknown key would be — no error, nothing to learn. The CORS
header is only set for an allowed origin, so a browser refuses to hand the
response to their script even if they reach the endpoint.

What this does **not** stop: a server-side request, which has no `Origin`
and is not bound by CORS. Someone with a key can read an app's published
process list and steps from outside a browser. Those are things that app
shows its own users, so the exposure is "a competitor can read your help
content", not "a competitor can read your data". Worth knowing all the same.

### Someone who has stolen an author token

An author token is what the portal gives the snippet so it can record.

It is worth very little on purpose:

|            |                                                               |
| ---------- | ------------------------------------------------------------- |
| Lifetime   | 60 seconds, then useless                                      |
| Uses       | One. Redeeming it marks it spent before anything else happens |
| Bound to   | One app, one origin, one named user                           |
| Grants     | Creating a **draft**. Nothing else                            |
| Revoked by | Rotating the app's key, which deletes every session for it    |

Redeeming a token produces a session that lasts an hour and can still only
create drafts. **Publishing is portal-only**, in a signed-in session an
attacker does not have. The worst realistic outcome of a stolen token is a
junk draft that a person has to delete.

Pairing — how the token gets to the page — is covered in
[decisions/author-mode.md](/decisions/author-mode/). The short version: the
snippet invents a code and asks; the portal, where someone is signed in,
approves. Nothing secret travels through a URL, and no window messages
another, because `Cross-Origin-Opener-Policy` severs that on many real apps
and we do not control customers' headers.

### Someone with read access to the database

They get: email addresses, names, Argon2id password hashes, app keys, origin
allowlists, and every recorded process.

They do **not** get: anything a user typed into any application. Not
passwords, not emails, not card numbers. The recorder never reads `.value`,
the text content of a field, `contenteditable` content or keystrokes. The
`Target` schema is a strict object, so a value cannot be smuggled in as an
unknown key even by a modified snippet — the server rejects it.

What a recorded process does reveal is the **shape of an application**: the
names of buttons, the labels of fields, the structure of pages. For an
internal tool that is close to a screenshot of the interface. Treat the
database as you would a copy of your application's source.

They also get **problem reports**, if the app has them switched on, and those
are the one table where "the shape of an application" is not the whole
answer. A report is captured on an end user's own screen, so treat that table
as holding your users' data rather than your interface's. The section below
says what is and is not in it.

Session tokens are not in there. Author tokens and sessions are stored as
SHA-256 hashes; the tokens themselves never touch the database.

### A portal user with a lower role

Roles are checked in the service layer, not only hidden in the interface. A
`viewer` who calls a server action directly gets `NotAllowedError`, because
`require(role, action)` throws before any work happens. Every query also
filters by organization, so an id belonging to another organization answers
as not found rather than refusing — the portal cannot be used to discover
that an id exists.

### A customer's own application

An app that embeds the snippet can do anything to it, because it owns the
page. It could call the API with its own key, read its own config, or replace
the snippet entirely.

None of that gains it anything it does not already have: it is reading and
changing its own processes, which its own staff author anyway.

The reverse direction matters more, and is the promise Wendmark makes to the
customer: **the snippet never acts on the user's behalf.** No synthetic
clicks, no setting values, no submitting forms, no navigation. Overlays are
`pointer-events: none`; listeners are passive and capture-phase and never
call `preventDefault`. A compromised Wendmark could not quietly perform
actions in a customer's application without that changing, and that change
would be visible in an Apache-2.0 licensed file they can read.

## Privacy

**No field values, ever.** Password, email and payment fields get no special
case, because there is no case to make: nothing is read from any field. What
is captured is the structure of the page and the labels its own designers
wrote — role, accessible name, visible text of non-input elements, test ids,
surrounding context, CSS selectors.

Three things hold that in place: the recorder does not reach for values; a
test spies on the value getter and fails if anything reads it; and the schema
rejects unknown keys server-side.

**Problem reports are the one exception, and they are off by default.** When
an app turns them on, an end user can retrace something that failed and send
it. That is a capture of a real session in a real account, so it cannot rest
on an absence the way everything above does, and it is worth being exact
about:

- Still no field values, no keystrokes, no screenshots. The same recorder,
  the same strict schema.
- Nothing is captured until the user asks, nothing after they stop, and they
  see the exact list that will be sent and can remove any of it first.
- By default every label comes off: `name`, `text` and `context` are
  stripped and each step's wording is rewritten, so a report says "Press a
  button" where it could have said "Press Issue refund". Paths keep their
  shape and lose their ids — `/orders/10421` is stored as `/orders/*`.
- An app can opt into keeping labels. The portal re-applies its own stored
  policy on write and does not take the snippet's word for what it stripped.
- What survives masking is structure: selectors, role, test id, shadow path.
  The one thing that can carry data through is a `data-testid` built from a
  record id, which no heuristic can tell from a naming convention. That is
  why the policy is the app operator's to set.
- Reports are deleted outright after a retention period the app chooses, 90
  days by default. A hard delete, not the soft delete a process gets.

The app operator is the data controller for all of it. See
[decisions/problem-reports.md](/decisions/problem-reports/).

**Step snapshots are deliberately not built.** Capturing a picture of each
step at record time would photograph whatever was on the author's screen,
which in a real application is somebody's real order. It would also turn a
guarantee that holds because nothing happens — nothing reads a value — into
one that holds because masking code runs correctly on markup it has never
seen. See [decisions/step-snapshots.md](/decisions/step-snapshots/).

## The rest of the surface

**Passwords** are Argon2id at OWASP's current parameters (19 MiB, two
passes). An unknown email still costs a verification, so response time does
not reveal which addresses exist, and sign-in failures never say which half
was wrong.

**Portal sessions** are JWTs lasting 12 hours, with the role re-read from the
database on every renewal so a role change takes effect without waiting.

**Rate limiting** exists on one endpoint — saving a draft, 30 per minute per
app — and is held in memory. Several instances count separately. It is a
brake on a runaway script, not a defence. A real limit belongs in your proxy.

**Request size** is capped at 128 KB and 200 steps for a saved draft, checked
against the declared length before the body is read and again against what
arrived.

**Preflights echo the headers a browser asks for**, because the snippet uses
the host page's `fetch` and many apps have wrapped theirs. No endpoint trusts
a header: identity comes from `Origin` against the allowlist and a token in
the body.

## What is not protected

Written down because a threat model that only lists wins is marketing.

**There is no "sign out everywhere".** Sessions are JWTs, revoked by bumping
`user.sessionVersion`, which is read on every renewal — and nothing in the
portal writes that column. A password change does not end other sessions.
Changing `AUTH_SECRET` ends all of them, bluntly, for everyone.

**There is no audit log.** Rows carry attribution — who recorded a process,
who published a version and when, which user and origin an author session
belongs to — but nothing records actions. You cannot ask "who deleted this",
only "who created it".

**Expired author sessions are not cleaned up.** They stop working at their
expiry and are deleted when an app's key is rotated, but otherwise the rows
remain. Expired pairing requests are swept when a new one is created.

**A deleted process is not deleted.** It keeps a `deletedAt` so a deletion
can be undone. Nothing reads it, and nothing removes it later.

**There is no retention policy and no scheduled deletion.** Everything is
kept until someone removes it.

**The portal does not set a Content-Security-Policy of its own**, and its
static files are served with `Access-Control-Allow-Origin: *`, which they
must be — customers' pages load them.

**None of this has been penetration tested.**
