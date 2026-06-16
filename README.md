# Campus Gridiron Dynasty

A fictional college football dynasty simulation web app built with React, TypeScript, Vite, Vitest, and Playwright.

The app creates a 20-year dynasty with 70 made-up programs, 7 conferences, 85-player rosters, thousands of recruits per cycle, hidden recruit traits, coach movement, program investments, weekly awards, season awards, all-national/all-conference teams, fictional bowls, and an 8-team playoff.

## Run

```bash
npm install
npm run dev
```

The app stores saves locally in IndexedDB. Local storage only keeps the active save pointer because the dynasty state includes thousands of players and recruits.

## Test

```bash
npm run build
npm run test
npm run smoke
```

Smoke coverage runs Chromium desktop, WebKit desktop, and WebKit with an iPhone 15 Pro Max profile. The smoke test also uses the debug controls to force a user playoff berth, force a user award winner, auto-recruit, and simulate three seasons.

QA screenshots are written to:

- `artifacts/screenshots/home-desktop.png`
- `artifacts/screenshots/dashboard-desktop.png`
- `artifacts/screenshots/recruiting-desktop.png`
- `artifacts/screenshots/awards-playoff-desktop.png`
- `artifacts/screenshots/mobile-dashboard.png`

## Generated Assets

The home hero and the 14-portrait 8-bit player sprite sheet were generated with the built-in image generator and copied into:

- `public/assets/dynasty-hero.png`
- `public/assets/portrait-sprite.png`

## Design Rules

- Do not use real college names, real awards, real athletes, real coaches, real conferences, or real logos.
- Initial generated players must not exceed 93 in any rating.
- Recruit generated ratings must stay within their hidden trait entry bands, with `elite` capped at 83.
- Recruiting traits stay hidden until signing day unless scouting fully unlocks gem/bust information.
- The game should stay playable on WebKit and on mobile-width screens.

## Research Notes

Modern dynasty-mode inspiration was checked against official EA pages and translated into original mechanics only:

- https://www.ea.com/games/ea-sports-college-football/college-football-26/news/cfb26-campus-huddle-dynasty-deep-dive
- https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty
