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
nothing repeats that furniture down here. `null://m` is the same window
pointed at `aether.cx`, which sends `x-frame-options: DENY`.

**A window is judged by what it drew, not by a load event.** When a page is
opened, the rewritten window is looked at every 650ms: this app's own shell in
the frame means the service worker was not the one answering, and an empty
body means nothing came back — either way the second road gets its turn
instead of leaving a black pane. The second road (`src/lib/relay.ts`) reads
the page itself through the relay and draws it in a sandboxed frame: the far
site is copied, not framed, so a site that refuses to be framed is never
asked. The `<script data-null="nav">` shim inside that copy puts back what an
opaque origin takes away — a working `localStorage`, an in-memory Indexed
Database for pages that persist while they mount, and a bridge that carries
the copy's `fetch` and `XMLHttpRequest` up to the window that owns the relay,
because a request from an origin-less frame is refused by anything that looks
at it. The first error the page throws is handed up as well, and the bar above
the frame says which of the two happened.

**Relays come and go, so there is a list.** `src/lib/browser.ts` holds the
relays NULL knows about and tries each in turn: a bare handshake first, then
the transport, and the first one that answers carries the page. The address in
Settings is tried first and the rest are the fallback, so one public relay
going quiet costs a handshake instead of a dead window. A relay is a WebSocket
server and cannot live on a static host, which is the one thing about this
site a visitor may have to supply themselves — add your own on the shelf page.

**Music plays whole songs.** Two sources do it with no key and no server, and
they are the two that come first. Audius is the default: its API sends
`access-control-allow-origin: *`, it needs no key, and its stream endpoint hands
back the real file. The Internet Archive (`archive.org`) is the second: full
length audio out of a catalogue that never closes, its search and metadata
endpoints both answer a browser, and — the other half of why it is here — a host
a school filter usually leaves alone. It is a collection rather than a shelf, so
one search opens the best few items and lists the tracks inside them. The rest
need a server: Qobuz, SoundCloud and YouTube Music send no CORS headers, so they
go through the Convex action with a key — Qobuz without a subscriber token still returns
previews, and the page says so rather than pretending. Apple's index is kept
last as a fallback, thirty seconds a track. A search that comes back empty
says which of the three things happened — the catalogue had nothing, every
match is gated, or the node really was unreachable — and retries without the
query's extra words first, because Audius indexes titles and not titles plus
artists.

**Two things are called a bot, on purpose.** Null Bot lives in the chat rooms
and answers `$help`, `$playerdata`, `$rich`, `$roll` and friends from data
NULL already has, so it cannot be wrong. `null://ai` is a real model, and it says
when it does not know. It asks the deployment's key first (`npx convex env set
OPENROUTER_API_KEY …` or `GROQ_API_KEY …`); a build with none falls back to
`src/lib/ai.ts`, which carries a scrambled key of its own so the assistant is
never just a setup card. Scrambled is not hidden — put the key on the
deployment and that road stops being used.

**Effects left the profile card.** A wide looping clip painted behind the
profile was being squashed into a strip and tinted until nothing of it
survived, so it moved to the share card (`src/components/ShareCard.tsx`),
which is the size it was made for. Downloading one paints the same card onto
a canvas — banner, the clip's current frame screened over it, picture, name,
tags and bio — and hands back a PNG. Nothing is uploaded.

**The shelf fills itself.** `bun scripts/discover-games.mjs` reads the four
gmshelf shelves — seraph, truffled, the Chicken King's Vault and the Ultimate
Game Stash — and rewrites `src/lib/discovered.ts`: over two thousand games, with
artwork matched by name out of each shelf's covers folder and genres from the
old UGS listing, plus the cloud titles further down. Games are mirrored through
raw.githack and not jsDelivr, for two reasons that both look like a broken game:
jsDelivr labels `.html` as `text/plain`, so a frame handed one shows the page's
own source code, and ckv is past jsDelivr's package size limit, so over there its
files answer 403. Nothing is fetched at runtime; the shelf is a file in the repo,
rebuilt when the script runs.

**A game opens in a document, and never by navigating to the stash.** Three
roads, and the copy road is first: the page is fetched, given a `<base>` so its
own files resolve back to the stash, and handed to a frame as a blob. Two things
make that the right order. A game's scripts expect a real document — a shadow
root has no `getElementById` for them to find their own canvas with, which is
what the inline road is for and why it is not first. And a filtered network
blocks by URL, so what it blocks is the *navigation*: a game in a frame asking
for its own address comes back as "this page has been blocked by Chrome", while
a frame holding a blob was never sent to that URL at all. The frame road is kept
as the last one, for a game that checks where it is running, and the pill's route
button walks a game on to the next road by hand. The frames carry
`allow="pointer-lock"` because an fps game cannot capture the mouse without it.

**Artwork is offered at three hosts.** A cover is the same picture on jsDelivr,
on raw GitHub and on the mirror, and the card takes the first one that loads
(`Cover.tsx`) — a school filter refuses whole hosts, and one refused host should
not cost every tile its picture. When all three are refused the square is drawn
instead, out of the game's own name, so a filtered shelf still reads as a shelf.

**A second shelf is not a shelf of files.** `stratus-api`'s cloud catalogue is
written out as names, keys, covers and tags, with no address to play one at —
those titles are streamed by a service that holds the licence and brokers every
session. A card for one says so and hands over to the service (`catalog.ts`,
`CLOUD_SITE`), which is the honest shape for it: an invented embed URL would
only be a broken tile with extra steps.

## Adding things

* **A game or app** — the files, plus one entry in `src/lib/catalog.ts`. See
  `games/README.txt`.
* **The whole shelf** — `bun scripts/discover-games.mjs` (see above).
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
