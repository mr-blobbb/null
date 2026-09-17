# null

A flat, fast, black-and-white hub: games, apps, a proxy window, a shop, a
profile, extensions and settings, in plain HTML, CSS and JavaScript. No build
step is required to serve it — GitHub Pages publishes the repository root as it
is — and there is no server and no database. Node is only the development
tooling: the catalog scan, the icon set, and the checks.

Live at <https://googleslides2026.github.io/>.

---

## What is on the site

Nine doors, and nothing else. The rail down the left edge carries five at the
top and four at the bottom, with real Lucide icons and the current page marked
by a hairline against the window edge.

| Page | Address | What it is |
| --- | --- | --- |
| Home | `/` | the wordmark, a line that changes every load, site search, quick links, a band of cards |
| Games | `/games/` | the game library: one square each, searchable by name or hidden category |
| Apps | `/apps/` | the same page for apps |
| Proxies | `/proxies/` | the proxy window, plus the ready-made links |
| Shop | `/shop` | coins from playtime, spent on avatar decorations, profile effects and name tags |
| Profile | `/profile` | a local account: banner, picture, name, bio, library, saves |
| Changelog | `/changelog` | every release, newest first |
| Extensions | `/extensions` | `.nullext` files with full access, or sandboxed Chrome popups |
| Settings | `/settings` | a sheet over whatever page you are on: Appearance, Data, Privacy & ToS |

The player (`/player`) is not a door: it is the window a game opens in.

## The shape of a page

Every page loads the same shell, in this order:

```
store.js      preferences, favorites, recents, N.meta, the folder NULL is served from
econ.js       coins, XP, quests, achievements, cosmetics
icons.generated.js   the vendored icon set (generated — see below)
dom.js        element helpers, the icon builder, toasts, selects
modal.js      dialog sheets
theme.js      palettes, accents, backdrops, performance modes
router.js     every page, its name, its icon and its null:// host
catalog/…     the library, built from the folders
cards.js, search.js, daily.js, ext.js
tabs.js       the null:// tab bar
settings-sheet.js  the Settings overlay
shell.js      the rail, the footer, the keyboard, the screensaver
devconsole.js typing `nldev` on any page
```

Everything shares `src/styles/global.css` (design tokens and the older
components), `extra.css`, and the rebuilt half of the system in `v2.css` and
`v2b.css`. The two v2 sheets are where the current look lives: `v2.css` holds
the tokens, the rail, the sheets, home, the library, the changelog and the
profile; `v2b.css` holds the tab bar, the Settings sheet, the proxy window and
the rounder geometry that overrides the older rules by load order.

## Icons

Icons are **Lucide** (<https://lucide.dev>, ISC). Nothing is drawn by hand and
nothing is a font: `scripts/build-icons.js` reads the `.svg` files out of
`node_modules/lucide-static`, maps NULL's names onto Lucide's, and writes
`src/utilities/icons.generated.js`. `dom.js` then builds one `<svg>` per icon
at `1em`, so an icon follows whatever font-size its button has, exactly the way
a glyph used to.

    bun run icons      # after adding a line to MAP in scripts/build-icons.js

There is no icon font any more, so there is no font request, no subset script
and no flash of invisible glyphs.

## The proxy window

`/proxies/` loads live sites inside NULL:

    this page  →  Scramjet  →  bare-mux  →  a Wisp relay  →  the far site

Scramjet rewrites the far page's HTML, CSS and JavaScript as it arrives, so its
links and requests stay inside the frame; bare-mux is the pipe; a Wisp relay is
the other end of it. A relay needs a WebSocket server, which GitHub Pages
cannot host, so the relay address is a setting (`wispUrl`, default
`wss://wisp.mercurywork.shop/`) and the engine can be switched between Scramjet
and Ultraviolet. When the relay cannot be reached the window says so in plain
words and offers the address in a normal tab.

Everything the proxy engine needs is loaded from jsDelivr at run time, on
purpose: the site ships no bundler and no vendored copy of somebody else's
service worker.

## Data

All of it is `localStorage`, under `null:` keys: preferences, the economy,
profile accounts (salted hash, this browser only), favorites, recents, tabs,
installed extensions and their own stores. Settings → Data lists every key,
exports a backup file, restores one, and clears the lot.

## Layout of the repository

```
index.html  shop.html  profile.html  changelog.html  extensions.html
settings.html  player.html  404.html
games/  apps/  proxies/      one index.html each, plus the content folders
src/
  catalog/     catalog.js + generated-catalog.js (rebuilt by the scan)
  components/  cards, search, tabs, settings-sheet, proxy, shell, devconsole, …
  content/     hand-written posts and page blurbs (search reads this)
  pages/       one script per page
  routing/     router.js — the table every nav, tab and palette is built from
  styles/      the design system
  utilities/   store, econ, dom, icons.generated, theme, modal, ext, markdown
public/        favicon, icons, manifest, fallback art
scripts/       build-icons, build-catalog, check-links, check-pages
.github/workflows/pages.yml    the Pages deploy
```

## Development

    bun install
    bun run icons        # regenerate the icon set
    bun run catalog      # rescan games/apps/proxies into the catalog
    bun run check        # tsc -b
    bun run check:links  # every internal path on the site resolves
    bun run check:pages  # jsdom smoke test of every page

`check:links` walks the HTML and the shipped JavaScript and fails on a path
that does not exist on disk; `check:pages` loads every page with its scripts
inlined, fails on an uncaught error, and asserts the rail, the tab strip, the
icon set, the library controls, the shop shelves, the gift codes, the profile
screens, the proxy window and the Settings sheet.

The site is served as files. Nothing needs to be built to publish it, and
nothing should be: a page that only works after a build step does not work on a
static host.
