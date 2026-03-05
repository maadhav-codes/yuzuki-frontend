# Yuzuki Frontend

Production-ready Next.js starter powered by TypeScript, Tailwind CSS, and Biome.

## Scripts

- `pnpm dev`: start local development server
- `pnpm build`: create production build
- `pnpm start`: run production server
- `pnpm typecheck`: run TypeScript checks
- `pnpm lint`: run Biome lint rules
- `pnpm format`: apply code formatting
- `pnpm check`: run Biome checks with autofix

## Environment Variables

- `NEXT_PUBLIC_SITE_URL`: canonical site URL used for metadata, `robots.txt`, and `sitemap.xml`.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL used by browser and server clients.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable (anon) key used for auth/session handling.
- `BACKEND_URL` (or `NEXT_PUBLIC_BACKEND_URL`): FastAPI backend base URL used by Next.js rewrite from `/backend/*`.

Example:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
BACKEND_URL=http://localhost:8000
```

## Microphone And Privacy Notice

- The app only requests microphone access after the user clicks the mic button.
- Audio is used for in-session speech-to-text transcription and is not started automatically.
- If speech-to-text is unavailable or permission is denied, users can continue in text-only mode.
