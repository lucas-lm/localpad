# ADR 0001: Path-based routing on GitHub Pages via a `404.html` fallback

- **Status:** Accepted
- **Date:** 2026-11-22

## Context

LocalPad identifies each document by its URL path (`/meeting`, `/todo`, `/work/ideas`). These clean, readable URLs are the core of the product: you type an address and get a note.

The app is deployed to **GitHub Pages**, which only serves static files and has no URL rewriting. A request for `/meeting` doesn't match a file, so Pages would normally return its own 404 page instead of the app. Hosts like Netlify or Vercel solve this with a rewrite rule (`/* → /index.html`), but GitHub Pages has no equivalent.

Two other constraints apply:

- **Base path.** A GitHub Pages project site lives under `/<repo>/`, while a user site or custom domain lives at `/`. The app has to work under both.
- **Offline-first.** Once the app is installed, routes must keep working without a network connection.

## Options considered

1. **Copy `index.html` to `404.html`.** GitHub Pages serves `404.html` for any unknown path. If that file is the app itself, the app loads at every URL and reads the slug from `location.pathname`.
2. **Hash routing (`/#/meeting`).** The server only ever sees `/`, so no fallback is needed.
3. **Redirect trick (`spa-github-pages`).** `404.html` redirects to `/?/meeting`, and a script in `index.html` rewrites the URL back to `/meeting`.
4. **Move to a host with rewrites** (Netlify, Vercel, Cloudflare Pages).

## Decision

Use **option 1**: path-based routing, with the build copying `index.html` to `404.html`.

- It keeps clean URLs like `/meeting`.
- It needs no extra runtime code: the copy is one build step, and the router already reads `location.pathname`.
- After the first load, the service worker (Workbox `navigateFallback`) serves every route from the cache with status 200, which also covers offline use.

Option 2 was rejected because `/#/meeting` gives up the clean URLs the product is built around. Option 3 adds a redirect, a visible URL flash and extra script, for no real benefit over option 1. Option 4 was ruled out because the deployment target is GitHub Pages.

The base path is handled separately. A `BASE_PATH` build variable (default `/`) feeds Vite's `base`, the PWA manifest (`id`, `start_url`, `scope`) and the router. The router strips the prefix when reading the URL and adds it back when building links, so the rest of the app only deals with paths like `/meeting`. The deploy workflow sets `BASE_PATH` from `actions/configure-pages`, so project sites, user sites and custom domains all work without manual configuration.

## Consequences

**Positive**

- URLs stay clean: `https://<host>/<base>/meeting`.
- No server configuration and no host-specific files (`_redirects`, `vercel.json` were removed).
- The same build works under any base path.

**Negative**

- **The first visit to a deep link returns HTTP 404.** Browsers render the page normally, so users don't see it, but link previews, crawlers and monitoring tools see a 404. LocalPad is a personal app with nothing to index, so this is acceptable. Once the service worker is installed, those requests get 200.
- **Real files take priority over slugs.** A slug that matches an existing file in `dist/` (for example `/sw.js` or `/manifest.webmanifest`) returns that file instead of a note on the first visit. In practice this only affects a handful of unlikely names.
- **The deploy setup depends on GitHub Pages' `404.html` behavior.** If the app moves to another host, replace the `404.html` copy with that host's rewrite rule.

## Implementation

- [`scripts/spa-fallback.mjs`](../../scripts/spa-fallback.mjs): copies `dist/index.html` to `dist/404.html`; runs as the last step of `npm run build`.
- [`src/lib/router.tsx`](../../src/lib/router.tsx): reads and writes paths relative to `import.meta.env.BASE_URL`.
- [`vite.config.ts`](../../vite.config.ts): `base` and manifest paths from `BASE_PATH`; Workbox `navigateFallback: 'index.html'`.
- [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml): sets `BASE_PATH` from `actions/configure-pages`.

Verified against a local server that mimics GitHub Pages (files under `/localpad/`, `404.html` with status 404, no rewrites). The first deep-link visit returns 404 and the note opens; after the service worker is installed, the same route returns 200 and works offline.
