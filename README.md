# NULL

A plain black-and-white web hub for **games**, **apps**, **proxies** and useful
tools. Flat surfaces, hairline borders, a grayscale identity — built as plain
static HTML/CSS/JS, deployable straight to GitHub Pages.

```
Primary deployment: https://googleslides2026.github.io
```

No backend. No database. No framework. **No build step and no toolchain** —
there is nothing to install or compile. Open the folder on a static host and it
runs.

---

## Layout

```
/
├── index.html             Home dashboard
├── 404.html               Custom NULL 404 (leaking barrel)
├── tools.html             Catalog builder (maintainer page)
├── tests.html             The test suite, run in the browser
├── games/                 Game library — index.html is the /games page
│   ├── index.html         The /games library page
│   ├── pulse/ …           One folder per game
│   └── hollow-knight/     Placeholder — drop the real files in, then rebuild the catalog
├── apps/                  App library — index.html is the /apps page
├── proxies/               Proxy list — index.html is the /proxies page
├── src/
│   ├── styles/            global.css, extra.css, tools.css, tests.css
│   ├── utilities/         store, dom, modal, theme, scroll, markdown, econ,
│   │                      catalog-tool (the parser behind /tools)
│   ├── components/        shell (nav/footer), cards, search, schedule,
│   │                      tab presets, seasons, daily (crate + quests)
│   ├── catalog/           catalog.js runtime + generated-catalog.js (the catalog)
│   ├── content/content.js Hand-written content (announcements, page index)
│   ├── routing/router.js  Shared navigation model
│   └── pages/             One small init script per page
├── public/
│   ├── favicon.svg, icon-*.png
│   └── fallback-assets/   NULL-styled thumbnails used when one is missing
├── releases/              Self-contained single-file builds (static snapshots)
│   ├── null-mini.html     Lightweight essentials
│   ├── null-lite.html     More capable standalone
│   └── null-regular.html  Closest standalone reproduction of the full site
├── sw.js                  Service worker (installable app + offline shell)
└── tsconfig.json, node_modules/   Host-only: see "Not part of the site"
```

Pages are ordinary HTML files. The library pages live as `games/index.html`,
`apps/index.html` and `proxies/index.html` (served at `/games`, `/apps`,
`/proxies`); the rest sit at the root. All share the same stylesheets and a
handful of plain-JS modules — normal page navigation, no SPA router tricks.

---

## Adding content

The catalog is **one plain data file**:

```
src/catalog/generated-catalog.js
```

### Build it in the browser — /tools

Open **`/tools.html`** on your deployed (or locally served) copy, paste the
folders you added, and press **Scan folders**:

```
games/hollow-knight
games/crazy-cubes
apps/paint
proxies/wiki
```

The page scans them over HTTP and reads each folder's own files, exactly the way
the old Node scripts did — `Label.txt`, `Warning.txt`, `meta.txt`, `proxy.txt`
and the thumbnail. It shows you what it found (with previews and any folders it
had to skip) and gives you the whole `generated-catalog.js` back to copy or
download. Paste it over the file and you are done.

You can also just edit `generated-catalog.js` by hand — it is plain data.
Whichever way you change it, bump the `?v=` number on that `<script>` tag in the
HTML heads so browsers pick up the new library.

### Folder conventions

```
games/hollow-knight/
├── hollow-knight.html     Standalone game file (index.html also works)
├── hollow-knight.png      Optional thumbnail (any image works)
├── Label.txt              Optional — tags, one per line
├── Warning.txt            Optional — Title: / Description:
└── meta.txt               Optional — Name: / Description: / Added: / #hot
```

- `Label.txt`: every non-empty line becomes one or more chips.
  `Label: Action Puzzle Singleplayer` → `Action Puzzle Singleplayer`.
  A number followed by a word stays one label (`2 Player`).
- `Warning.txt`: shown in the shared modal before the game launches.
- `meta.txt`: `Name:` and `Description:` override the folder name,
  `Added: YYYY-MM-DD` stamps the NEW badge for 14 days, and any line containing
  `#hot` stamps a HOT badge.
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

Proxies always open the external destination in a new tab (with a NULL redirect
confirmation); they are never wrapped in the player.

### Everything else

- **Announcements / pages** — edit `src/content/content.js` (also feeds search).
- **Legal pages** — edit the markdown inside each page file
  (`about.html`, `privacy.html`, …); look for the `<!-- WRITE MARKDOWN HERE -->` marker.
- **Schedule** — edit the `SCHEDULE` object at the top of `src/components/schedule.js`.
- **Backup links / statuses** — edit `backups.html`. Statuses are manual.

---

## Tests — /tests

Open **`/tests.html`**. It loads each real page into a same-origin frame and
asserts on what it renders, then drives the economy (playtime → XP → coins,
daily quests, achievements, the daily crate, the day rollover) and the catalog
parser directly against the modules the site ships. It also checks that the
stylesheets, the service worker and the catalog are all wired up.

Your `null:*` localStorage keys are snapshotted before a run and put back
afterwards; **Restore my data** does it again on demand. Like the rest of the
site it needs to be served over http(s) — the frames cannot load from `file://`.

## Releases

`releases/null-{mini,lite,regular}.html` are self-contained single-file builds:
the whole stylesheet, the runtime and the catalog inlined, with a small
tier-driven shell. They are **committed snapshots** — copy one somewhere and it
works on its own, with no other NULL files. Rebuild them by hand if you change
something they should carry.

## Deployment

Push the repo and let GitHub Pages serve it from the repository root.
`404.html`, `index.html` and all content folders live at the root on purpose, so
no build step or special Pages config is needed.

Path note: links are root-relative and clean (`/games`, `/apps`, …). GitHub
Pages resolves those to the directory index files (`games/index.html`, …) and
redirects to the trailing-slash form — the nav accounts for both. If you ever
host under a sub-path instead, prefix a `<base>` tag in each HTML head.

---

## Not part of the site

Two things exist only because this project was scaffolded by a hosted editor.
Neither is needed to run or deploy NULL:

- `node_modules/` — leftover install output. The host runs a syntax check after
  each change; delete the folder if you don't want that.
- `tsconfig.json` — a JS-only stub (`allowJs`, `checkJs: false`) that exists so
  that host check has something to build. It type-checks nothing; it only parses
  the JavaScript, so it still catches syntax errors. Safe to delete.

There is no `package.json`, no Vite, no Prettier, no build scripts and no
TypeScript in the project.

## Features at a glance

- Minimal flat design system, dark + light themes, configurable accents, and a
  **glow border** that re-inks the edge of the viewport *and every card* in the
  palette you pick.
- Catalog with labels, warnings, fallback thumbs, NEW/HOT badges and popularity.
- Shared NULL player (fullscreen, favorites, tab-preset override, about:blank /
  blob: cloaking within browser limits).
- Virtualized library grid: rows render around the viewport and unload far away,
  while scroll height/position stay stable — built for huge libraries on
  Chromebooks.
- Recently played (games only), favorites, Random Game, instant clears.
- Global search over games, apps, proxies, announcements and pages.
- Browser-tab presets (default: *Untitled Slide - Google Slides*) incl. Gmail
  unread-count support; presets override game/app titles inside the player.
- Permanent school schedule (home + /schedule.html) with live now/next, passing
  periods and period-end confetti.
- Shop + local economy: 30 minutes of play banks 10 XP, 100 XP banks 30 coins —
  spent on beta games, theme packs with real animated backdrops, particle sets,
  boosts and effects.
- **Daily crate** (a modal with a spinning reel, streak bonuses), three rotating
  **daily quests** and permanent **achievements**, all paid in coins.
- Seasonal mode, performance mode, panic key, screensaver, smart tab cloak.
- Installable PWA with an offline shell, and a Service Worker that keeps the
  shell usable without a network.
- Single-file releases: NULL Mini / Lite / Regular.
