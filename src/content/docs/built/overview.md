---
title: "How Wendmark is built"
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/architecture/README.md
---

Five documents, each covering one area, in the order they make sense to read.
They explain _why_ the code looks the way it does — the constraints that
shaped it and the attempts that failed — which is the part source code cannot
tell you on its own.

1. [The shape of the portal](/built/portal-shape/) — layers, the `ctx` object,
   permissions, and two conventions that explain a lot of the code
2. [Auth](/built/auth/) — first-run setup, passwords, JWT sessions and how
   revocation works without a session table
3. [Apps](/built/apps/) — public keys, the origin allowlist, the install ping
4. [Author mode](/built/author-mode/) — pairing, why window messaging failed,
   and why there are two snippet bundles
5. [Flows](/built/flows/) — the shared schema, the zod problem, saving and
   listing

The trust model across all of them is in
[docs/security.md](/running/security/).

The rules these follow — guide never act, the dependency table, the snippet's
constraints — are in [CLAUDE.md](https://github.com/Wendmark/wendmark/blob/main/CLAUDE.md). Decisions with alternatives
weighed are in [docs/decisions](/decisions/).
