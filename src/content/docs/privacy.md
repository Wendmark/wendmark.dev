---
title: Privacy
description: "What the Wendmark browser extension and wendmark.dev keep, what they never capture, and where your guides go. In short: nothing leaves your browser unless you share it."
---

Last updated 18 October 2026.

This covers the **Wendmark extension for Chrome** and this website,
**wendmark.dev**, including its play page for shared guides. A Wendmark
portal that a company runs for its own application is that company's to
describe; see [the trust model](/running/security/) for how it is built.

## The short version

Wendmark collects nothing about you. There is no account, no analytics, no
tracking and no advertising, and nothing is sent to us. Your guides stay in
your browser until you choose to share one, and a shared guide travels
inside its own link.

## The extension

**What it can see, and when.** The extension does nothing on a page until
you ask it to: by clicking its icon (which lets it run on that tab only), or
by starting a guide and allowing that one site when Chrome asks. It never
asks for access to all websites. You can remove a site's access at any time
from the extension's details in `chrome://extensions`.

**What a guide contains.** When you record, each click becomes a step: what
kind of control it was (a button, a link), its label, the page it was on,
and how to find it again. **Nothing you type is ever recorded**: not the
contents of any field, not your keystrokes, not passwords or card numbers.
Before you share a guide you see exactly what it contains, and by default
the words from the page are taken out of every step.

**Where guides are kept.** In your browser's own storage for extensions, on
your computer. An unpinned guide is deleted after 30 days. Uninstalling the
extension deletes them all. Nothing is synced or uploaded.

**When you share.** A link puts the guide in the part of the address after
`#`, which browsers never send to any server, ours included. Copying the
steps as text or saving a file gives you the guide to send however you
like. In every case, you decide who receives it.

**What it sends.** Nothing, to us or anyone else. The extension makes no
network requests of its own.

## wendmark.dev and its play page

wendmark.dev is a static site hosted on GitHub Pages. It sets no cookies,
runs no analytics and loads nothing from other websites. GitHub, as the
host, receives the ordinary information any web server does, such as your IP
address, and handles it under [GitHub's privacy
statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

The play page, `wendmark.dev/play`, reads a shared guide from its own
address, after the `#`, inside your browser. The guide is never sent to the
server. If you have the extension, pressing **Start** hands the guide to it
inside your browser.

## Contact

Questions or concerns: open an issue at
[github.com/Wendmark/wendmark](https://github.com/Wendmark/wendmark/issues).
For anything you would rather not post in public, see
[SECURITY.md](https://github.com/Wendmark/wendmark/blob/main/SECURITY.md).
