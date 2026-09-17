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
  owner.ts            the one handle that owns the site: scrambled, reserved
  members.ts          everyone this browser has seen sign in
  extensions.ts       the add-on registry
  art.tsx             the animated artwork the shop sells
  card.ts             the share card, painted to a canvas for a PNG
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
One handle is reserved for the person who owns NULL: `owner.ts` holds it
scrambled and the password only as a digest, signing up or renaming to it is
refused, and signing in with it takes the whole shop shelf for free plus the
OWNER tag, which is not on the shelf at all. It is an obfuscated check, not a
secure one — there is no server here to authenticate against.

**An address opens in a tab.** There is no separate proxies page in the rail:
type a site into the address bar and it opens as a tab through Ultraviolet and
the Wisp relay. `null://p` still reaches the ready-made list, and the Movies
door (`null://m`) is the same window pointed at `aether.cx`.

**Settings is a sheet.** It opens over whatever page you are on, which is why
there is no `/settings` view: a tab that lands on it shows the home screen
with the sheet over the top.

**A proxied site is the tab, not a second window.** The Ultraviolet chain
(`src/lib/browser.ts`) renders inside the page area, under the same tab bar
and toolbar as everything else: the address above is the site's real one, the
reload button above reloads it, and back and forward walk its own history, so
nothing repeats that furniture down here. `null://m` is the exception —
aether.cx, framed directly, because it is one address worth reaching without
a relay.

**Effects left the profile card.** A wide looping clip painted behind the
profile was being squashed into a strip and tinted until nothing of it
survived, so it moved to the share card (`src/components/ShareCard.tsx`),
which is the size it was made for. Downloading one paints the same card onto
a canvas — banner, the clip's current frame screened over it, picture, name,
tags and bio — and hands back a PNG. Nothing is uploaded.

## Adding things

* **A game or app** — the files, plus one entry in `src/lib/catalog.ts`. See
  `games/README.txt`.
* **A proxy** — one entry in the same file, with a `url` instead of a `file`.
  See `proxies/README.txt`.
* **An extension** — one entry in `src/lib/extensions.ts`. It declares where
  it draws (`nav`, `page` or `overlay`) and what it may touch, and the
  Extensions page prints both on its card.
* **A shop item** — one entry in `src/lib/econ.ts`. A drawn piece also needs
  its class in `shop.css`; a clip needs its file in `public/decor/` and a line
  in the map at the top of `src/lib/art.tsx`.

## Icons and fonts

Icons are [Lucide](https://lucide.dev) `lucide-react`, imported as components.
Nothing is hand-drawn per screen and there is no icon font to subset.

Body text is `Adwaita Sans → SF Compact Text → Inter → system`. The eight
display faces a profile can put its own name in load separately from Google
Fonts, and nothing else uses them.

## Licence

ISC. See `LICENSE`.
