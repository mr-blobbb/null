# NULL

A plain black-and-white web hub for **games**, **apps**, **proxies** and useful
tools. Flat surfaces, hairline borders, a grayscale identity — built as plain
static HTML/CSS/JS, deployable straight to GitHub Pages.

```
Primary deployment: https://googleslides2026.github.io
```

No backend. No database. No framework. Content is **discovered automatically**
from folders; nothing needs to be registered by hand.

---

## Layout

```
/
├── index.html             Home dashboard
├── 404.html               Custom NULL 404 (leaking barrel)
├── games/                 Game library — index.html is the /games page
│   ├── index.html         The /games library page
│   ├── pulse/ …           One folder per game (auto-discovered)
│   └── hollow-knight/     Placeholder — drop the real files in & rebuild
├── apps/                  App library — index.html is the /apps page
├── proxies/               Proxy list — index.html is the /proxies page
├── src/
│   ├── styles/global.css  The whole design system (glass, glow, themes)
│   ├── utilities/         store, dom, modal, theme, scroll, markdown
│   ├── components/        shell (nav/footer), cards + virtualization,
│   │                      search, schedule, tab presets
│   ├── catalog/           catalog.js runtime + generated-catalog.js (build output)
│   ├── content/content.js Hand-written content (announcements, page index)
│   ├── routing/router.js  Shared navigation model
│   └── pages/             One small init script per page
├── public/
│   ├── favicon.svg
│   └── fallback-assets/   NULL-styled thumbnails used when one is missing
├── releases/              Generated single-file builds
│   ├── null-mini.html     Lightweight essentials
│   ├── null-lite.html     More capable standalone
│   └── null-regular.html  Closest standalone reproduction of the full site
├── scripts/               Content discovery + generators (see below)
├── package.json
└── vite.config.js         Dev-only (static deployment is the real build)
```

Pages are ordinary HTML files. The library pages live as `games/index.html`,
`apps/index.html` and `proxies/index.html` (served at `/games`, `/apps`,
`/proxies`); the rest sit at the root (`settings.html`, `player.html`, …).
All share one CSS file and a handful of plain-JS modules — normal page
navigation, no SPA router tricks.

---

## Adding content

### Game or app

Create a folder with the content inside it:

```
games/hollow-knight/
├── hollow-knight.html     Standalone game file
├── hollow-knight.png      Optional thumbnail (any image works)
├── Label.txt              Optional — tags, one per line
├── Warning.txt            Optional — Title: / Description:
└── meta.txt               Optional — Name: / Description: overrides
```

- `Label.txt`: every non-empty line becomes one or more label chips.
  `Label: Action Puzzle Singleplayer` → `Action Puzzle Singleplayer`.
- `Warning.txt`: shown in the shared modal before the game launches.
- Folders without an HTML file are skipped (nothing breaks).
- Folders starting with `.` or `_` are ignored.
- Missing thumbnails fall back to the NULL placeholder art automatically.

### Proxy

```
proxies/my-link/proxy.txt:
    Link: https://example.com/
    Description: What it is.
    Status: All Good        (All Good | Issue | Blocked — maintained by hand)
```

Proxies always open the external destination in a new tab (with a NULL
redirect confirmation); they are never wrapped in the player.

### Announcements / pages

Edit `src/content/content.js` (also feeds global search).

### Legal pages

Edit the markdown inside each page file (`about.html`, `privacy.html`, …) —
look for the `<!-- WRITE MARKDOWN HERE -->` marker. It renders automatically.

### Schedule

Edit the `SCHEDULE` object at the top of `src/components/schedule.js`.

### Backup links / statuses

Edit `backups.html` directly. Statuses are manual — nothing auto-verifies them.

---

## Build & discover

```bash
bun install
bun run dev            # local dev server
bun run catalog        # re-scan games/apps/proxies → src/catalog/generated-catalog.js
bun run releases       # rebuild releases/null-{mini,lite,regular}.html
bun run build          # both of the above
```

`src/catalog/generated-catalog.js` and everything in `releases/` are **build
output**. Add a game folder, run `bun run catalog`, done.

## Deployment

Push the repo and let GitHub Pages serve it from the repository root.
`404.html`, `index.html` and all content folders live at the root on purpose,
so no build step or special Pages config is needed.

Path note: links are root-relative and clean (`/games`, `/apps`, …). GitHub
Pages resolves those to the directory index files (`games/index.html`, …) and
redirects to the trailing-slash form — the nav accounts for both. If you ever
host under a sub-path instead, prefix a `<base>` tag in each HTML head.

## Features at a glance

- Minimal flat design system, dark + light themes, configurable restrained
  accents (accent color drives selected buttons/chips), performance mode.
- Auto-discovered game/app/proxy catalog with labels, warnings, fallback thumbs.
- Shared NULL player (fullscreen, reload, favorites, tab-preset override,
  about:blank / blob: cloaking within browser limits).
- Virtualized library grid: rows render around the viewport and unload far
  away, while scroll height/position stay stable — built for huge libraries on
  Chromebooks.
- Custom pill scrollbars on library pages; styled scrollbars in long modals.
- Recently played + favorites in localStorage; Random Game; instant clears.
- Global search over games, apps, proxies, announcements and pages.
- Browser-tab presets (default: *Untitled Slide - Google Slides*) incl. Gmail
  unread-count support; presets override game/app titles inside the player.
- Permanent school schedule component (home + /schedule.html), A/B days.
- SGGAMES easter egg (type it anywhere — case-insensitive).
- First-run welcome modal + popup/redirect explanation modal.
- Single-file releases: NULL Mini / Lite / Regular.
