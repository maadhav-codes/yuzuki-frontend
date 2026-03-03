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

Example:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

## Microphone And Privacy Notice

- The app only requests microphone access after the user clicks the mic button.
- Audio is used for in-session speech-to-text transcription and is not started automatically.
- If speech-to-text is unavailable or permission is denied, users can continue in text-only mode.
