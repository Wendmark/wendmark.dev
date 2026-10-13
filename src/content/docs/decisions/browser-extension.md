---
title: "A browser extension"
description: "What a Wendmark browser extension is for, how a guide made in it reaches somebody else, and where it does and does not work."
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/decisions/browser-extension.md
---

## The idea

Wendmark today needs two things in place before anyone can be guided: the
snippet installed in an application, and a portal to record, edit and
publish from. That is right for a company putting guidance in its own
product. It is far too much for the smaller, more frequent need:

- a DevOps engineer showing a colleague how to reproduce a bug
- someone walking a teammate through a small feature, once
- anyone explaining a few clicks in a tool neither of them owns

These are "here's how", not documentation. Made in a minute, sent in a
chat, followed once, forgotten. The closest thing people use today is a
screen recording, which shows somebody doing it; Wendmark would let the
colleague do it themselves, in the real application, guided.

## Decision

Build a **Chrome extension that works without the portal**. Record, preview,
share and play happen entirely in the browser: no account, no server, no
install in the application being explained. The engine is the one the
snippet already uses — recorder, player, teaching cursor, panels — so a
guide is the same flow format the portal reads, and one made in the
extension could later be imported into a portal unchanged.

### Who it is for

People sharing a short, one-off process with someone else. Not a library:
guides are kept locally for 30 days and then tidied away unless pinned.

### Sharing

In order of how much they are expected to be used:

1. **A link.** "Copy link" produces
   `https://wendmark.dev/play#g=<the guide, compressed>`. The colleague
   clicks it; the play page shows the guide's title, the site it starts on
   and its steps, and a **Start on app.example.com** button. With the
   extension, Start asks once for access to that site, opens it in the
   colleague's own signed-in session, and the guide begins. Without it, the
   page still lists the steps as text, with a link to install.
2. **Readable text.** "Copy as text" produces numbered steps for a ticket or
   a chat message. The recipient needs nothing installed.
3. **A file** (`.wendmark.json`), for guides too long for a link.

Optional sync to a portal comes later, for teams that outgrow sharing by
hand. It is not part of the first version and nothing in it should depend
on one.

### Why the guide travels in wendmark.dev's address, not the target's

The obvious design is to add the guide to the target site's own address:
`https://app.example.com/#wendmark=…`. That breaks on exactly the kind of
application this is for. Many single-page applications — cloud consoles,
webmail, older Angular apps — use the part after `#` for their own
navigation (`https://app.example.com/#home`), and a guide there collides
with it.

So the link points at a page of ours, and the guide sits after `#` in
**that** address. The part of an address after `#` is never sent to any
server — not to wendmark.dev, which is static files on GitHub Pages, and not
to the target site. It works the same for every site, whatever that site
does with its own addresses.

A compressed guide of ten steps is roughly 1–2 KB, which chat tools and
email carry without trouble. Above a cut-off, to be set in the first build,
"Copy link" offers the file instead.

### The play page

`wendmark.dev/play` is one static page in the existing site. It reads the
guide from its own address, decompresses it with the browser's built-in
`DecompressionStream`, shows it, and hands it to the extension when Start
is pressed.

The hand-over uses Chrome's page-to-extension messaging: the extension's
manifest lists `https://wendmark.dev` under `externally_connectable`, and
no other site can message it. Nothing on that page is a request to a
server, so there is no CORS question anywhere in this design, and nothing
relies on one window reaching another — the `window.opener` failure in
[author-mode.md](/decisions/author-mode/) cannot happen here.

Because the guide is in the page's address, `/play` carries **no analytics
or third-party scripts**, and says so. A company that would rather not
depend on wendmark.dev can host its own copy; letting the extension trust
more than one play page is a later option.

### Permissions

The extension runs on a site only when it is asked to: on the toolbar icon
being clicked (`activeTab`), or when a guide is started from the play page,
which requests access to that one site at that moment. It never asks for
"all websites". That keeps the Chrome Web Store review simple and the
promise to users short.

## What carries over unchanged

- **Wendmark guides. It never acts.** The extension clicks nothing, types
  nothing and navigates nowhere on anyone's behalf. Following a guide is
  slower than watching a replay; for "learn how to do this", that is the
  point.
- **Nothing anyone types is recorded.** For bug reproduction the value often
  matters ("type −1 in Quantity"), so the person sharing can add a note to
  any step. Wendmark still never reads a field.
- **A preview before anything leaves the browser.** Internal tools show
  customer names and order numbers, and a link travels. Before sharing, the
  person sees every step, can remove any, and can switch to structure only,
  using the same masking as problem reports
  ([problem-reports.md](/decisions/problem-reports/)). Structure only is the default.

## Frames

A page can embed other pages in boxes (iframes). Cloud consoles and admin
tools built from embedded panels do this throughout: the shell is one page,
and many of the panels are pages from other addresses. The browser does not let code in the outer page
reach inside a box from another address, so an engine running in one page
misses clicks inside the boxes, cannot find their buttons, and does not
know where to point the cursor.

An extension can run the engine in every frame. Each frame records its own
clicks and reports them to the extension, which merges them into one
ordered list and remembers which frame each step belongs to, much as
`shadowPath` does for shadow roots. When playing, each frame is asked
whether a step's target is inside it; the one that finds it rings it and
reports where it is.

This is new work, and the first build proves it before anything else, on a
fixture any contributor can run: a page in the demo app that embeds a panel
served from a second local address ([#89](https://github.com/Wendmark/wendmark/issues/89)).

## Where Wendmark works

### Frames, in the snippet and the extension

| Scenario                                                   | Snippet (portal)                                            | Extension                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| No frames — most modern applications                       | Works                                                       | Works                                                      |
| The application's own pages in frames, same address        | Not today. Fixable: it may reach into them, it just doesn't | Fixable, as above                                          |
| Frames from another address the same company owns          | Fixable only with the snippet installed on both, in step    | Fixable with no setup — frame-heavy consoles are this case |
| Another company's widget (card form, video, chat)          | Not possible, by browser design. A note step instead        | Possible with permission; a policy choice                  |
| Locked components (closed shadow roots)                    | Not possible                                                | Not possible                                               |
| Applications drawn on a canvas (Figma, a spreadsheet grid) | Not possible: there is nothing on the page to point at      | Not possible                                               |

The snippet's gap with an application's own same-address frames is ordinary
engineering and is tracked separately. The extension's frame work builds
most of what it needs.

Whether the extension should reach into another company's widget, such as a
payment form, is left open. It would still never record a value; the
question is whether pointing into a payment provider's frame is something
Wendmark should do at all.

### By kind of application

Not measured yet, so described rather than counted:

- **Works well, which is most of what people use at work:** single-page
  applications in any framework, server-rendered sites, open web
  components, and applications whose class names are generated — steps are
  found by role and name, not only by CSS.
- **Partly, and fixable:** applications built from frames, as above, and
  very long lists that only draw the rows on screen, where a step's row may
  not exist until the user scrolls to it.
- **Not covered:** canvas-drawn applications such as Figma, Miro and the
  Google Sheets grid (their menus and toolbars often still work), closed
  shadow roots, and the inside of other companies' widgets.

### Proving it

Before the extension is built out, a spike records and replays one short
process on each of: Azure portal, Salesforce, Jira, GitHub, Gmail, Notion,
Stripe Dashboard, HubSpot, Shopify admin and Google Sheets. The results
become a compatibility list on wendmark.dev, so the claims above are
evidence rather than judgement.

## Where it lives

`apps/extension` in this repository, depending on the same packages the
snippet does. It is a new entry in the dependency table, so the change to
`ALLOWED_DEPENDENCIES` in `eslint.config.js`, the table in `CLAUDE.md` and
the package's `package.json` go together, as `CLAUDE.md` asks. The
snippet's 30 KB budget does not apply: the extension is installed once, not
downloaded on every page load.

## Turned down

- **The guide after `#` in the target site's address.** Breaks applications
  that route with `#`, which many single-page applications, webmail and
  cloud consoles do.
- **The guide in a `?` parameter.** Sent to the target site's server, logged
  there, and able to change what the application does.
- **Short links from a link service.** Needs a server, which ends the
  independence and puts every guide on somebody's disk.
- **Files only.** Too much friction for a one-off "here's how".
- **Asking for access to all websites at install.** More than the job needs,
  harder to review, and harder to trust.

## Open questions

- The size above which "Copy link" offers a file instead.
- How steps are matched to pages in applications that route with `#`. Page
  hints already follow routes written as `#/orders`, but not `#home`,
  `#!/orders` or `#view/…`, which in those applications _is_ the page
  ([#98](https://github.com/Wendmark/wendmark/issues/98)).
- Whether to reach into other companies' widgets at all.
- Firefox and Safari, after Chrome.
