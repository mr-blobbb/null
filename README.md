# NULL

A plain black-and-white web hub for **games**, **apps**, **proxies** and useful
tools. Flat surfaces, hairline borders, a grayscale identity, built as plain
static HTML/CSS/JS, deployable straight to GitHub Pages.

```
Primary deployment: https://googleslides2026.github.io
```

No backend, no database, no framework, and **no build step for the site**:
there is nothing to compile and nothing to deploy beyond these files. Open the
folder on a static host and it runs. (A small dev-only toolchain exists so the
site can be previewed and the releases rebuilt; see the end of this file.)

---

## Layout

```
/
├── index.html             Home dashboard
├── 404.html               Custom NULL 404 (leaking barrel)
├── tools.html             Catalog builder (maintainer page)
├── tests.html             The test suite, run in the browser
├── games/                 Game library: index.html is the /games page
│   ├── index.html         The /games library page
│   ├── pulse/ …           One folder per game
│   └── hollow-knight/     Placeholder: drop the real files in, then rebuild the catalog
├── apps/                  App library: index.html is the /apps page
├── proxies/               Proxy list: index.html is the /proxies page
├── src/
│   ├── styles/            global.css, extra.css, home.css, tools.css,
│   │                      tests.css, particles.css, perf.css, dev.css
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
│   ├── fonts/             The icon font NULL ships (a ~88 KB cut of Material Symbols)
│   └── fallback-assets/   NULL-styled thumbnails used when one is missing
├── releases/              Self-contained single-file builds (generated snapshots)
│   ├── null-regular.html  The whole thing, readable
│   ├── null-mini.html     Same build, compressed
│   └── null-lite.html     Stripped: no theme packs, particles, glow or shop,
│                          animations off, and compressed, so it is smallest
├── scripts/               Build + check tools (dev only, never loaded by a page)
│   ├── build-catalog.js   Scans the content folders → generated-catalog.js
│   ├── build-font.js      Cuts the icon font down to the glyphs the site uses
│   └── build-releases.js  Rebuilds the three single-file builds
├── .github/workflows/     update-catalog.yml: refresh + commit on content changes
├── sw.js                  Service worker (installable app + offline shell)
├── robots.txt             Keeps the catalog builder, tests and 404 out of search
├── .nojekyll              Serves the repo as plain files on GitHub Pages
├── LICENSE                AGPL-3.0 notice (the platform code's license)
└── package.json, vite.config.js, tsconfig.json   Dev only, see below
```

Pages are ordinary HTML files. The library pages live as `games/index.html`,
`apps/index.html` and `proxies/index.html` (served at `/games`, `/apps`,
`/proxies`); the rest sit at the root. All share the same stylesheets and a
handful of plain-JS modules: normal page navigation, no SPA router tricks.

---

## Adding content

The catalog is **one plain data file**:

```
src/catalog/generated-catalog.js
```

### Build it in the browser: /tools

Open **`/tools.html`** on your deployed (or locally served) copy, paste the
folders you added, and press **Scan folders**:

```
games/hollow-knight
games/crazy-cubes
apps/paint
proxies/wiki
```

The page scans them over HTTP and reads each folder's own files, exactly the way
the old Node scripts did: `Label.txt`, `Warning.txt`, `meta.txt`, `proxy.txt`
and the thumbnail. It shows you what it found (with previews and any folders it
had to skip) and gives you the whole `generated-catalog.js` back to copy or
download. Paste it over the file and you are done.

You can also just edit `generated-catalog.js` by hand: it is plain data.

Either way the pages load it as `generated-catalog.js?v=<key>`, and that key is
a hash of the catalog itself, so nobody stays stuck on a cached copy of
yesterday's games.

### Or let the repo build it: `bun run catalog`

`scripts/build-catalog.js` walks `games/`, `apps/` and `proxies/`, reads each
folder's own files and writes the catalog. It uses the same parser as the
`/tools` page (`src/utilities/catalog-tool.js`), so the two can never disagree:

```
bun run catalog            # or: node scripts/build-catalog.js
```

Folders without an HTML file (or without a `Link:` in `proxy.txt`) are skipped
and listed, an unchanged library leaves the file (and its timestamp) exactly
as it was, and the cache key on the pages only moves when something changed.

`.github/workflows/update-catalog.yml` runs this for you. Push anything under
`games/`, `apps/` or `proxies/` and the Action rebuilds the catalog, plus the
`?v=` cache key on every page that loads it: **and** the single-file releases,
then commits all of it, ready for Pages to serve. Node runs on
the runner during that build step only: the deployed site is still just the
HTML, CSS, JS and data files in this repo: no backend, no server, nothing for a
visitor to install. (It needs *Settings → Actions → General → Read and write
permissions*; you can also start it by hand from the Actions tab.)

### Folder conventions

```
games/hollow-knight/
├── hollow-knight.html     Standalone game file (index.html also works)
├── hollow-knight.png      Optional thumbnail (any image works)
├── Label.txt              Optional: tags, one per line
├── Warning.txt            Optional: Title: / Description:
└── meta.txt               Optional: Name: / Description: / Added: / #hot
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
    Status: All Good        (All Good | Issue | Blocked: maintained by hand)
```

Proxies always open the external destination in a new tab (with a NULL redirect
confirmation); they are never wrapped in the player.

### Everything else

- **Announcements / pages**: edit `src/content/content.js` (also feeds search).
- **Legal pages**: edit the markdown inside each page file
  (`about.html`, `privacy.html`, …); look for the `<!-- WRITE MARKDOWN HERE -->` marker.
- **Schedule**: edit the `SCHEDULE` object at the top of `src/components/schedule.js`.
- **Backup links / statuses**: edit `backups.html`. Statuses are manual.

---

## Icons

Every glyph in the interface comes from one font, Material Symbols Rounded.
Upstream that is a single 5 MB file covering all ~3,600 Google icons; NULL uses
67 of them, so `public/fonts/material-symbols-rounded.woff2` is an ~88 KB cut of
it and nothing else:

```
bun run font            # or: node scripts/build-font.js
```

`src/utilities/dom.js` holds the table: a name (`home`, `coin`, `warn`…) and the
glyph's codepoint, with the ligature it came from in the comment. Add a name, run
the script, and it tells you the codepoint to paste, then re-cuts the font. It
writes nothing unless every icon still draws exactly what the full font draws,
including the **filled** heart and star, which the FILL axis swaps in as
different glyphs.

Two things to know before touching it:

- The table holds codepoints, not the ligature words the glyphs are named after.
  A cut this small has no letters in it: keeping them would let HarfBuzz's layout
  closure pull all ~3,600 icons back in, and the file lands at 4.7 MB instead of
  88 KB.
- The pages serve the file themselves, so icons render offline, behind a network
  that blocks `fonts.googleapis.com`, and with no third-party request on the
  critical path. The single-file releases carry it inline as a `data:` URI.

---

## Tests: /tests

Open **`/tests.html`**. It loads each real page into a same-origin frame and
asserts on what it renders, then drives the economy (playtime → XP → coins,
daily quests, achievements, the daily crate, the day rollover) and the catalog
parser directly against the modules the site ships. It also checks that the
stylesheets, the service worker and the catalog are all wired up.

Your `null:*` localStorage keys are snapshotted before a run and put back
afterwards; **Restore my data** does it again on demand. Like the rest of the
site it needs to be served over http(s): the frames cannot load from `file://`.

## Dev console: type `nldev`

Type **`nldev`** on any page (no input focused) for a full-screen tool panel. It
asks for a password first: it lives in `devconsole.js`, which is a speed bump
and not security: anything served to the browser can be read. It is grouped into
one card per job: stress test, launch, look, theme packs,
particles, fx, modals, tab presets, seasonal, economy, data, pages: with a
filter box in the header and a lit state on whichever setting is currently
active. The lists of packs, particle sets, accents, glow palettes and tab
presets come straight out of the modules that own them, so adding one to the
site adds it here automatically.

**Stress test** pushes placeholder entries into the live catalog: *250 games*,
*1,000 games*, apps and proxies, so the virtualized grid, search and the featured
rail can be loaded up without touching a single file. Placeholders carry a
`placeholder` label (filter for them on any library page), a share of the NEW
and HOT badges, some deliberately empty and some deliberately long
descriptions, and they launch the first real game in the library so the player
still opens. They live under `null:devseed` and are merged back on every page
load, so the seeded build survives a reload or a page change until you press
**Clear placeholders**.

## Releases

`releases/null-{regular,mini,lite}.html` are self-contained single-file builds.
Each one inlines the stylesheets, the whole runtime and the release shell, plus
a copy of the catalog whose games and apps carry their own code as a `data:`
URI: copy one anywhere and it runs with no other NULL file, on `file://`, in a
blob or on a hosted page.

They are **generated**, so rebuild them after changing anything they should
carry:

```
bun run releases            # or: node scripts/build-releases.js
```

The three tiers differ only in what the build keeps:

| build | contents |
| --- | --- |
| `null-regular.html` | everything, readable source |
| `null-mini.html` | everything, minified |
| `null-lite.html` | no theme packs, particles, glow or shop, performance mode pinned on, minified |

`scripts/check-releases.js` loads all three and drives them (nav, library, the
player overlay, settings, shop) to catch a bad build before you ship it. The
update Action rebuilds them whenever the library changes, so a game added to
`games/` shows up in the standalone builds too.

## Deployment

Push the repo and let GitHub Pages serve it from the repository root.
`404.html`, `index.html` and all content folders live at the root on purpose, so
no build step or special Pages config is needed.

Two things make the links behave on Pages:

- Library links point at directories (`/games`, `/apps`, `/proxies`): Pages
  resolves those to `games/index.html` and redirects to the trailing-slash form,
  and the nav lights up for either shape.
- Root pages are linked as their real files (`/schedule.html`, `/settings.html`,
  …). Pages serves an exact file or a directory index and nothing else, so an
  extensionless `/schedule` would 404 there. `404.html` doubles as a redirect
  for those anyway. If someone types or bookmarks one, it tries
  `/schedule.html`, then `/schedule/index.html`, and hops to whichever exists.

`robots.txt` allows the site but keeps the catalog builder, the test suite and
`404.html` out of search results: they are tools for whoever runs the site, and
each carries a `noindex` tag of its own anyway.

`.nojekyll` keeps Pages from running Jekyll over the repo, so every file is
served exactly as it is in git. If you ever host under a sub-path instead,
prefix a `<base>` tag in each HTML head.

`node scripts/check-links.js` re-checks that every internal path in the HTML and
the shipped JavaScript exists as a real file before you push.

---

## Dev only: nothing here is needed to deploy

The **site itself** is only HTML, CSS and plain JavaScript (plus the static
`public/manifest.webmanifest`). No page loads any of the following; they exist
so the site can be previewed, rebuilt and checked while working on it:

| file | what it is for |
| --- | --- |
| `vite.config.js` + `package.json` | the local preview server (`bun run dev`); HMR is off, and the config serves these files exactly as GitHub Pages does |
| `scripts/build-catalog.js` | scans `games/`, `apps/`, `proxies/` and regenerates the catalog |
| `scripts/build-font.js` | cuts the icon font down to the glyphs the site uses |
| `scripts/build-releases.js` | regenerates the three single-file builds |
| `scripts/check-releases.js` | drives the built releases and reports errors |
| `scripts/check-links.js` | verifies every internal path resolves to a file |
| `scripts/release-shell.js` + `release.css` | the app inside the releases |
| `tsconfig.json` | a JS-only stub (`allowJs`, `checkJs: false`) so `bun run check` parses the site's JavaScript and catches syntax errors |
| `node_modules/` | install output, ignored by git |

Handy commands: `bun run dev` (preview), `bun run catalog` (refresh the
catalog), `bun run font` (re-cut the icon font), `bun run releases` (rebuild the
single-file builds), `bun run build`
(catalog + releases), `bun run check` (syntax check) and the three check scripts (`check:links` for
broken internal paths, `check:pages` for the real pages, `check:releases` for
the single-file builds). Delete
any of it and the deployed site is unaffected: GitHub Pages serves the files in
this folder as they are, and NULL never calls out to anything.

## Features at a glance

- Minimal flat design system, dark + light themes, configurable accents, and a
  **glow border** that re-inks the viewport edge in the palette you pick (the
  Neon theme pack is the one that also lights its cards).
- Catalog with labels, warnings, fallback thumbs, NEW/HOT badges and popularity.
- Shared NULL player (fullscreen, favorites, tab-preset override, about:blank /
  blob: cloaking within browser limits). Cloaking from Settings opens the
  cloaked copy first and then hands this tab to the real site behind the tab
  preset, so the address bar matches the title the tab is wearing.
- Virtualized library grid: rows render around the viewport and unload far away,
  while scroll height/position stay stable: built for huge libraries on
  Chromebooks.
- Recently played (games only), favorites, Random Game, instant clears.
- Global search over games, apps, proxies, announcements and pages.
- Browser-tab presets (default: *Untitled Slide - Google Slides*) incl. Gmail
  unread-count support; presets override game/app titles inside the player.
- Permanent school schedule (home + /schedule.html) with live now/next, passing
  periods and period-end confetti.
- Shop + local economy: 30 minutes of play banks 10 XP, 100 XP banks 30 coins,
  spent on beta games, theme packs with real animated backdrops, particle sets,
  boosts and effects.
- **Daily crate** (a modal with a spinning reel, streak bonuses), three rotating
  **daily quests** and permanent **achievements**, all paid in coins.
- Seasonal mode, performance mode, and an **Ultra-Performance** floor (no
  animation at all, no effects, no off-screen paint) that NULL offers by itself
  when it measures a low frame rate. Plus panic key, screensaver, smart tab
  cloak.
- Installable PWA with an offline shell, and a Service Worker that keeps the
  shell usable without a network.
- Single-file releases: NULL Mini / Lite / Regular.

---

## License

The NULL platform (HTML, CSS, JavaScript, design system, catalog tooling and
build scripts) is released under the **GNU Affero General Public License,
version 3 or later**. `LICENSE` carries the copyright notice and disclaimer,
and the verbatim terms live at <https://www.gnu.org/licenses/agpl-3.0.txt>.

In short: use it, change it, share it, keep your version open, and if you run a
modified copy as a network service, offer your users its source. Third-party
games, apps and proxy content are not covered by this license and stay with
their own owners. The License page in the site (`license.html`) spells this out
in more detail.
