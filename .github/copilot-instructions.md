# Copilot Instructions for Smart Bookmark

This file gives concise, actionable guidance for AI coding agents working in this repository.

1. Big picture
- This is a Next.js (App Router) frontend only project (root `app/`). Server components are used by default; client components opt into `"use client"`.
- Database access is via Supabase JS using a singleton client in `lib/supabase.js`.

2. Key files and patterns
- App entry / layout: [app/layout.js](app/layout.js#L1-L12)
- Example client page using Supabase: [app/page.js](app/page.js#L1-L40) (note the `"use client"` directive and `useEffect` data call).
- Supabase client: [lib/supabase.js](lib/supabase.js#L1-L10) — uses env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Path alias: `@/*` maps to repo root (see [tsconfig.json](tsconfig.json#L1-L40)).

3. Run / build / debug commands
- Development: `npm run dev` (runs `next dev`).
- Build: `npm run build` (runs `next build`).
- Start (production): `npm run start` (runs `next start`).
- Lint: `npm run lint` (runs `eslint`).

4. Environment and secrets
- Supabase requires two public env vars set in the environment or in your deployment: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Avoid creating server-only Supabase clients in this repo; the pattern is a singleton in `lib/supabase.js` used from client components.

5. Conventions for AI agents
- Prefer minimal, surgical changes. Modify or add files under the same style and structure (App Router, client components where appropriate).
- When adding data fetching in components, follow the existing pattern: client components use `"use client"` and `useEffect` for browser-only calls (see [app/page.js](app/page.js#L1-L40)).
- Use the `supabase` client from `lib/supabase.js` rather than creating new clients.
- Use the `@/` alias for imports: e.g. `import { supabase } from '@/lib/supabase'`.

6. Tests and CI
- No tests detected. Do not assume a test harness exists; if creating tests, include setup docs and npm scripts.

7. External dependencies and versions
- Core deps: `next@16.x`, `react@19.x`, `@supabase/supabase-js` (see `package.json`).
- Tailwind/postcss present via `postcss.config.mjs` and `tailwindcss` devDependency — only add Tailwind usage if you update CSS.

8. Pull request guidance
- Keep PRs scoped: update only the files required. For changes touching env or deployment, include clear `.env` example and instructions.

9. When you can't find context
- If unsure about runtime behavior (SSR vs client), search `"use client"` or check `app/` files to see whether a file is intended to run in the browser.

If anything here is unclear or you'd like more examples (routing, auth flows, or adding server actions), tell me which area to expand.
