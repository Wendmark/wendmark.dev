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

`start/what-it-is`, `start/install`, `start/recording` and the landing page
are written for this site and have no counterpart in the repository.
`start/by-hand` is copied from `docs/authoring-flows.md`.

## The demo clips

The clips in `public/media/` are recorded from a real, running Wendmark, not
edited by hand. With the main repository's `pnpm dev` running and its
development database seeded:

```bash
pnpm capture            # all three: recording, editing, guiding
pnpm capture guiding    # just one
```

A Playwright script drives the Fika demo app and the portal, Chrome's
screencast captures it at twice the resolution, and ffmpeg (which must be
installed) encodes MP4, WebM and a poster for each clip, plus a GIF for the
main repository's README in `.capture/`. Each run replaces the process it
made last time. Re-record whenever the interface changes.

The intro on the landing page (`public/media/intro.*`) is the exception: an
edited film rather than a capture, so `pnpm capture` does not make it. It is
the same file as `docs/images/intro.mp4` in the main repository.

## Licence

**AGPL-3.0**, matching the main repository's default — which is the licence
the copied documentation already carries, so this repository cannot offer it
under anything looser. See
[LICENSING](https://github.com/Wendmark/wendmark/blob/main/LICENSING.md).

The music in the intro film is the exception: "Happy Beats / Business Moves
Vol. 12" by Sascha Ende ([ende.app](https://ende.app/en)), under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), credited under the
film on the landing page.
