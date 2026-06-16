# Smoke Matrix

Required commands:

- `npm run test`
- `npm run smoke`
- `npm run build`

Required browser coverage:

- Chromium desktop at 1440 x 950.
- WebKit desktop at 1440 x 950.
- WebKit mobile emulation at 430 x 932, approximating iPhone 15 Pro Max.

Required debug flows:

- Create a new dynasty.
- Force the user team into the playoff.
- Force a user-team award winner.
- Auto-recruit one week.
- Simulate at least three seasons.
- Reset local storage and create another dynasty.

Required screenshots:

- `artifacts/screenshots/home-desktop.png`
- `artifacts/screenshots/dashboard-desktop.png`
- `artifacts/screenshots/recruiting-desktop.png`
- `artifacts/screenshots/awards-playoff-desktop.png`
- `artifacts/screenshots/mobile-dashboard.png`
