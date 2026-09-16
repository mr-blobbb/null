# NULL

A plain black-and-white web hub for **games**, **apps**, **proxies** and useful
tools. Flat surfaces, hairline borders, a grayscale identity, built as plain
static HTML/CSS/JS, deployable straight to GitHub Pages.

```
Repository:  https://github.com/googleslides2026/googleslides2026.github.io
Deployment:  https://googleslides2026.github.io
```

That is a **user** page: the repo is named after the domain, so NULL is served
from the root and the address is the bare domain. Nothing here leans on that
either way: the pages link to each other relatively and the JS asks for a page
by its site path through `N.url()` (see `store.js`), which works out the folder
from the address the script was loaded at. The same files therefore run
unchanged at a domain root, under a subfolder, or from a preview server.

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
├── void.html, blob.html,  The hidden pages: nothing links them, you get there
│   time.html, credits.html  by typing the address or from the dev console
├── games/                 Game library: index.html is the /games page
│   ├── index.html         The /games library page
│   └── <slug>/ …          One folder per game: the catalog build discovers them
├── apps/                  App library: index.html is the /apps page
├── proxies/               Proxy list: index.html is the /proxies page
├── src/
│   ├── styles/            global.css, extra.css, home.css, particles.css,
│   │                      perf.css, dev.css, eggs.css
│   ├── utilities/         store, dom, modal, theme, scroll, markdown, econ,
│   │                      catalog-tool (the catalog's parser)
│   ├── components/        shell (nav/footer), cards, search, schedule,
│   │                      tab presets, seasons, daily (crate + quests),
│   │                      editor (the theme & particle editor)
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
├── robots.txt             Keeps the 404 out of search (only read at a root)
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

Nobody edits it by hand. `scripts/build-catalog.js` walks `games/`, `apps/` and
`proxies/`, reads each folder's own files and writes the catalog:

```
bun run catalog            # or: node scripts/build-catalog.js
```

The parsing rules sit in `src/utilities/catalog-tool.js`, away from the
filesystem, so the same code parses a folder wherever it is run from.

Folders without an HTML file (or without a `Link:` in `proxy.txt`) are skipped
and listed, an unchanged library leaves the file (and its timestamp) exactly
as it was, and the cache key on the pages only moves when something changed. The
pages load it as `generated-catalog.js?v=<key>`, a hash of the catalog itself, so
nobody stays stuck on a cached copy of yesterday's games.

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

## Extensions (the puzzle button)

`src/utilities/ext.js` is the runtime, and the puzzle button in the nav is its
front door. Two kinds of extension live in one registry, and the difference
between them is the whole design:

| kind | what it is | what it can touch |
| --- | --- | --- |
| **.nullext** | a NULL-native file: a JSON manifest with an optional `css` and `js` block, or a bare `.js` file that becomes the code | **everything.** It runs in the page's own realm with `N` in scope: the economy, coins, XP, quests, achievements, storage keys, recents, favorites, theme packs, particles, seasons, the player, search, hidden pages, the dev console, the screensaver, modals, FX. No sandbox, on purpose |
| Chrome import | a manifest.json plus its popup files, picked as a folder | only its own popup, **sandboxed**: an iframe with an opaque origin, its local css/js inlined, and a `chrome.*` shim that bridges `storage.local`/`sync` and `sendMessage` back through postMessage. No background script, no tabs, no content scripts, no host permissions |

The manager is `/extensions` (also in the nav menu, which lists what you have
installed so a popup is one click away). Storage: `null:ext` is the registry,
`null:extdata:<id>` is each extension's own bag, and `ctx.prefs` keys are
namespaced per extension so the normal backup/export picks them up.

Extensions can register views (`ctx.page`), listen to hooks (`ctx.hook`), and
add nav entries. The hooks core code emits are listed on the manager page and
define in `EVENTS` in `ext.js`; the same events are echoed onto `N.bus` as
`ext:<name>`.

**Read the file before you install it.** A .nullext is a script with the same
reach as any other script on the page, and nothing reviews it. That is the
trade the feature is built on.

## Labs (the flask button)

`/labs` is the half-finished shelf:

- **Experiments.** CSS-only looks toggled through `html[data-labs]` (`tilt`,
  `vignette`, `dense`, `gridlines`), applied site-wide from `src/styles/ext.css`.
- **Retextures.** Whole-site redesigns under `html[data-retexture]`: Terminal,
  Print and Brutal. Each one moves tokens and shapes only, so every page
  follows and the black-and-white identity survives.
- **Theme generator.** `src/utilities/procgen.js` rolls a complete theme set
  (palette, tint, backdrop chosen by hue, drifting parts, particle set) from a
  seed, and writes it into `null:craft`: a generated theme is a crafted theme,
  so it previews, applies, edits and deletes through the editor's own code.
  Accent colours are forced light-on-dark or dark-on-light, which is what
  keeps a random hue readable.
- **Prototype UI** and the **vote links** (a list at the top of `labs.js`:
  swap those URLs for your own forms whenever you have them).

## /root

A hidden page with no link from anywhere: a live map of the running site, not a
written-down doc. Systems off `N`, the nav/footer/hidden/extension pages, the
economy, the look, the storage keys with their sizes, whatever extensions are
installed, and the hook list. It reads it all off the live objects, so anything
an extension adds shows up in it too. The dev console's **surfaces** card opens
it, along with `/extensions` and `/labs`.

---

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

---

## Deployment

Push the repo and let GitHub Pages serve it. `404.html`, `index.html` and all
content folders sit at the root of the repo, so no build step and no special
Pages config is needed: **Settings → Pages → Deploy from a branch → main / root**.

The repo is named `googleslides2026.github.io`, which makes this the **user**
page for that account, so it answers at the bare domain:

```
https://googleslides2026.github.io
```

Three things keep the links working there:

- **No page writes a path from the domain root**, so the same files also run
  under a subfolder (`user.github.io/some-repo/`) or from a preview server, and
  renaming the repo would not break the site. The pages link to each other
  relatively (`src="../styles/global.css"`, `href="games/"`) and the JS asks for
  a page by its site path through `N.url()` (`store.js`), which reads the folder
  out of the address the script was loaded at. Nothing needs a `<base>` tag. The
  one exception is `404.html`, which cannot read the address and names the root
  instead (below).
- **The service worker and the manifest scope themselves.** `sw.js` sits next to
  `index.html`, so its scope is whatever folder NULL is served from, and its
  precache list is resolved against its own address.
  `public/manifest.webmanifest` sets `start_url` and `scope` to `../` for the
  same reason.
- Library links point at directories (`games/`, `apps/`, `proxies/`): Pages
  resolves those to `games/index.html` and redirects to the trailing-slash form,
  and the nav lights up for either shape. Pages and other root pages are linked
  as their real files (`schedule.html`), because Pages serves an exact file or a
directory index and nothing else: an extensionless `/schedule` would 404.

`404.html` does double duty. A static host answers a missing address with it and
**keeps the address**, so a 404 for `/games/typo/` is served at `/games/typo/`
and every relative path on the page would resolve inside that folder. It is the
one page written from the root (`/src/styles/global.css`) and it carries
`data-root="/"` on `<html>` so the nav and footer it mounts know where the root
is. It also stands in as a redirect for extensionless addresses: it tries
`schedule.html`, then `schedule/index.html`, and hops to whichever exists.

`robots.txt` allows the site but keeps `404.html` out of search results, and the
page carries its own `noindex` tag too. Crawlers only read `/robots.txt` at an
origin's root, which is where this one is.

`.nojekyll` keeps Pages from running Jekyll over the repo, so every file is
served exactly as it is in git.

`node scripts/check-links.js` re-checks that every internal path in the HTML and
the shipped JavaScript exists as a real file before you push, and
`node scripts/check-pages.js` loads every page (also from a made-up subfolder) to
confirm the links it builds carry the folder.

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
| `scripts/check-pages.js` | loads every real page in jsdom and asserts on what it renders |
| `scripts/check-releases.js` | drives the built releases and reports errors |
| `src/utilities/ext.js` | the extension runtime (registry, .nullext runner, popup host, hooks) |
| `src/utilities/procgen.js` | the procedural theme generator used by Labs |
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
- **Settings** is a sticky rail of five sections (Look and feel, Effects,
  Layout and speed, Browsing, Your stuff) beside grouped cards. Cards that are
  only set once fold away with their current value in the header
  (`Glow border · Rainbow`, `Panic key · \``), the fold state is remembered in
  `null:setFolds`, and the rail's own filter hides every card that doesn't
  match, opening what it finds.
- Light and dark is **one switch** with a sun and a moon, and every colour
  choice is a **colour circle** (an invisible `<input type="color">` stretched
  over a swatch, `N.dom.colorDot`) instead of a bare native box.
- **Layout compactness** in Settings: regular, comfy, spacious or compact:
  one spacing scale (nav height, page gutters, section rhythm, grid gaps, card
  padding, tile width) behind `html[data-density]`, so every page follows it.
  A live sample strip in the card shows the scale before you commit to it.
- **Mini-Perf mode** in Settings: strips nothing, it just lets the browser skip
  the blocks that are off screen (`content-visibility`, in perf.css) and brings
  them right back on scroll. Full visuals, less work per frame.
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
  spent on theme packs with real animated backdrops, particle sets, boosts and
  effects. Beta games (`betas` in `content.js`) join the Shop only while that
  list has entries in it.
- **Custom background image** (Shop unlock, `fx custombg`): paste a link or
  upload a file in Settings, then set the fit (cover / contain / tile), how far
  it dims behind the page and how soft it is. It gets its own fixed layer
  (`--bg-dim` lays the page colour over it) behind the theme pack and particles.
- **Theme & particle editor** (Shop unlock, `fx editor`): build your own theme
  pack (four palette colours, a tint, which backdrop art to borrow, drifting
  parts) and your own particle set (kinds, counts, start points, own palette or
  the site's), with a live preview. Both are stored in `null:craft` and merged
  into `allPacks()` / `allParticles()`, so a crafted theme applies through the
  same code a bought one does.
- Your own pack and particle set also get a card in Settings with their
  palette and tint as colour circles plus **Edit** and **Delete**, so you can
  recolour or throw one away without opening the editor
  (`N.theme.craftPatch` / `removeCraft`; deleting un-wears it).
- **Daily crate** (a modal with a spinning reel, streak bonuses), three rotating
  **daily quests** and permanent **achievements**, all paid in coins.
- Seasonal mode with **holiday variants**: a holiday is a variant of the season
  it lands in, so Fall offers Fall and Halloween (last two weeks of October by
  itself) and Winter offers Winter and Holidays. Pick either in Settings, or let
  the calendar choose (`prefs.seasonVariant`, `null` = automatic; the dev
  console still previews via `seasonOverride`).
- Performance mode, **Mini-Perf**, and an **Ultra-Performance** floor (no
  animation at all, no effects, no off-screen paint) that NULL offers by itself
  when it measures a low frame rate. Plus panic key, screensaver, smart tab
  cloak.
- Installable PWA with an offline shell, and a Service Worker that keeps the
  shell usable without a network.
- **Extensions**: `.nullext` files with full access to NULL, plus imported
  Chrome popup extensions that stay sandboxed, managed at `/extensions` and
  launched from the puzzle button in the nav.
- **Labs**: experimental looks, whole-site **retextures**, a procedural
  **theme generator** and the place to vote on what gets promoted.
- **`/root`**: a hidden, live map of every system, page, season, theme, storage
  key and installed extension.
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
