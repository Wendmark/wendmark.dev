# wendmark.dev

The project site for [Wendmark](https://github.com/Wendmark/wendmark) — the
landing page and the documentation, at **https://wendmark.dev**.

Built with [Astro](https://astro.build) and
[Starlight](https://starlight.astro.build). Deployed to GitHub Pages by
`.github/workflows/deploy.yml` on every push to `main`.

```bash
corepack enable
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # static output in dist/
```

## Where the content comes from

Most pages under `src/content/docs/` are the main repository's own docs,
copied in and relinked:

| Here | There |
| --- | --- |
| `built/*` | `docs/architecture/*` |
| `decisions/*` | `docs/decisions/*` |
| `running/security` | `docs/security.md` |
| `running/deploying` | `docs/deploying.md` |
| `start/recording` | `docs/authoring-flows.md` |
| `contributing` | `CONTRIBUTING.md` |

They are copied rather than pulled in at build time. There are a dozen of
them, they change rarely, and a sync step that breaks quietly is worse than a
diff somebody has to read. **If you change one of those docs in the main
repository, copy it here too.**

`start/what-it-is`, `start/install` and the landing page are written for this
site and have no counterpart in the repository.

## Licence

**AGPL-3.0**, matching the main repository's default — which is the licence
the copied documentation already carries, so this repository cannot offer it
under anything looser. See
[LICENSING](https://github.com/Wendmark/wendmark/blob/main/LICENSING.md).
