# Cadence

A personal moon-rhythm app for one person: habits, tasks, calendar and feelings alongside the Moon. Installable PWA for iPhone.

- Stack: Vite + React + TypeScript, vite-plugin-pwa, Dexie (IndexedDB), astronomy-engine, culori.
- `npm run dev` to work locally, `npm run build` to build. `BASE=/repo-name/` sets the path for GitHub Pages.
- Deploys from `main` through `.github/workflows/deploy.yml` (GitHub Pages, source: GitHub Actions).
- `npx vite build -c vite.preview.config.ts` makes a single-file preview (no offline or install).

## Layout
- `src/lib/sky.ts` sky gradient from the Sun's altitude, blended in OKLCH, with contrast-picked ink.
- `src/lib/moon.ts` daily moon phase and sign (expanded in milestone 2).
- `src/lib/passcode.ts` PBKDF2-hashed passcode stored in IndexedDB.
- `src/tabs/*` the five tabs and Settings.

## Milestones
1. Shell (done): PWA, five tabs, live sky, offline, passcode.
2. Moon engine and setup flow. 3. Habits and tasks. 4. Emotions. 5. Google Calendar and 1pm push. 6. Rituals and insights.
