# NULL

A flat, fast hub for games, apps, proxies and tools. One window, a thin rail,
a Chrome-shaped tab strip, and sixteen palettes that re-ink the whole site.

Rebuilt from scratch in **React + TypeScript** on **Vite**. Nothing of the old
vanilla build is left: no static HTML pages, no second copy of React, no icon
font.

## Run it

```bash
bun install
bun run dev        # the preview host runs this for you
bunx tsc -b        # type check (the same check CI runs)
bun run build      # dist/, ready for any static host
```

`dist/` is plain files. Routing is hash based, so it can be dropped on a host
with no rewrite rules and `/#/games` still lands on the games page.

## Where things are

```
index.html            the one document; paints the palette before React mounts
src/main.tsx          entry: stylesheets in, <App /> out
src/App.tsx           the shell: palette, coin clock, which page the tab shows
src/lib/
  store.ts            one localStorage store + useSyncExternalStore, used by all
  themes.ts           the sixteen palettes, and the custom one
  nav.ts              every destination, its null:// address and its icon
  tabs.ts             the tab model: back/forward stacks, the address bar
  catalog.ts          the library: games, apps, proxies
  econ.ts             coins, the shop, gift codes
  account.ts          the local account and profile card
  extensions.ts       the add-on registry
  art.tsx             the animated artwork the shop sells
src/components/
  Rail.tsx            the 56px spine
  Chrome.tsx          the tab strip and the toolbar
  Sheet.tsx           the one popup shape, with the heavy blur
  SettingsSheet.tsx   settings, over whatever page you are on
  CommandPalette.tsx  the site search
src/pages/            one file per page
src/styles/
  tokens.css          fonts, the shape scale, and all sixteen palettes
  shell.css           rail, tab strip, toolbar, page frame
  pages.css           home, library, proxies, changelog, extensions, player, 404
  shop.css            the counters, the shelves, and every animation
  profile.css         the sign-in card, the player card, the account list
  settings.css        the settings popup
```

## How it is put together

**Palettes are variables.** `tokens.css` declares the same nine values sixteen
times over. Switching a theme writes one attribute on `<html>`, so no
component knows a theme changed. The custom palette writes five inline
variables instead of using a block.

**The wordmark follows the theme.** `Home.tsx` builds its gradient from
`--text` and the palette's ink: pick Forest and the bottom of the letters goes
green with a green glow, pick Mono and the whole thing stays white.

**Coins come from time.** Three a minute while the tab is visible and you are
moving, plus thirty every fifteen minutes. Nothing accrues while the tab is
hidden or the keyboard and mouse have been still for ninety seconds. The
whole rule is `tick()` in `econ.ts`.

**The account is local.** A handle, a salted digest of the password, and the
card. There is no server, so there is no reset flow and no email field.
Deleting the account asks for the password and then wipes the browser copy.

**Settings is a sheet.** It opens over whatever page you are on, which is why
there is no `/settings` view: a tab that lands on it shows the home screen
with the sheet over the top.

## Adding things

* **A game or app** — the files, plus one entry in `src/lib/catalog.ts`. See
  `games/README.txt`.
* **A proxy** — one entry in the same file, with a `url` instead of a `file`.
  See `proxies/README.txt`.
* **An extension** — one entry in `src/lib/extensions.ts`. It declares where
  it draws (`nav`, `page` or `overlay`) and what it may touch, and the
  Extensions page prints both on its card.

## Icons and fonts

Icons are [Lucide](https://lucide.dev) `lucide-react`, imported as components.
Nothing is hand-drawn per screen and there is no icon font to subset.

Body text is `Adwaita Sans → SF Compact Text → Inter → system`. The eight
display faces a profile can put its own name in load separately from Google
Fonts, and nothing else uses them.

## Licence

ISC. See `LICENSE`.
