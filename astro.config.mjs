// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

/**
 * wendmark.dev — the project site.
 *
 * Starlight for the documentation, a splash page for the front door. The
 * content is the repository's own docs, kept in step by hand rather than by
 * a build-time checkout: there are a dozen pages and they change rarely, and
 * a sync step that breaks silently is worse than a diff somebody reads.
 */
export default defineConfig({
  site: 'https://wendmark.dev',
  integrations: [
    starlight({
      title: 'Wendmark',
      description:
        'Show people how to use your app, without doing it for them. Open-source guided walkthroughs with a teaching cursor.',
      logo: {
        light: './src/assets/wendmark-mark.svg',
        dark: './src/assets/wendmark-mark.svg',
        alt: 'Wendmark',
      },
      favicon: '/favicon.ico',
      head: [
        { tag: 'link', attrs: { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
        { tag: 'meta', attrs: { property: 'og:image', content: 'https://wendmark.dev/media/guiding.jpg' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/Wendmark/wendmark' },
      ],
      editLink: {
        baseUrl: 'https://github.com/Wendmark/wendmark.dev/edit/main/',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'What Wendmark is', slug: 'start/what-it-is' },
            { label: 'Install it', slug: 'start/install' },
            { label: 'Record a process', slug: 'start/recording' },
            { label: 'Write a flow by hand', slug: 'start/by-hand' },
            { label: 'Let users report a problem', slug: 'start/reporting' },
            { label: 'Wendmark for Chrome', slug: 'extension' },
            { label: 'Privacy', slug: 'privacy' },
          ],
        },
        {
          label: 'Demo',
          items: [
            { label: 'Record and publish', slug: 'demo/record' },
            { label: 'Being guided', slug: 'demo/guide' },
            { label: 'Report and replay', slug: 'demo/report' },
          ],
        },
        {
          label: 'Running it',
          items: [
            { label: 'Deploying', slug: 'running/deploying' },
            { label: 'Trust model', slug: 'running/security' },
          ],
        },
        {
          label: 'How it is built',
          items: [
            { label: 'Overview', slug: 'built/overview' },
            { label: 'The shape of the portal', slug: 'built/portal-shape' },
            { label: 'Auth', slug: 'built/auth' },
            { label: 'Apps', slug: 'built/apps' },
            { label: 'Author mode', slug: 'built/author-mode' },
            { label: 'Flows', slug: 'built/flows' },
          ],
        },
        {
          label: 'Decisions',
          items: [{ autogenerate: { directory: 'decisions' } }],
        },
        {
          label: 'Contributing',
          items: [{ label: 'How to contribute', slug: 'contributing' }],
        },
      ],
    }),
  ],
})
