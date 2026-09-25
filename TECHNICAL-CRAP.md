# NULL

A flat, fast hub for games, apps, proxies and tools. One window, a thin rail,
a Chrome-shaped tab strip, and twenty-three palettes (plus your own) that
re-ink the whole site.

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
  themes.ts           the palettes, the shape scale, and the custom one
  nav.ts              every destination, its null:// address and its icon
  tabs.ts             the tab model: back/forward stacks, the address bar
  catalog.ts          the library: games, apps, cloud titles, the shelves
  discovered.ts       the generated shelf — do not hand-edit, see the script
  econ.ts             coins, the shop, gift codes
  account.ts          the local account and profile card
  owner.ts            the one handle that owns the site: scrambled, reserved
  members.ts          the directory: everyone who has signed in, anywhere
  cloud.ts            is there a server behind this build, and its client
  friends.ts          the friend graph, and the presence beat
  gift.ts             sending somebody coins, or a thing you own
  jam.ts              listening together, watched from the shell
  voice.ts            the voice channel: peer to peer, no media server
  saves.ts            cloud saves, for both kinds of game
  vote.ts             the staff poll, read out of a message
  ob.ts               the twin map, off by default
  device.ts           "Chrome · Windows" in one line, off by default
  emoji.ts            the short reaction row, the names, the search
  music.ts            the catalogue, the queue, the kept shelf
  extensions.ts       the add-on registry
  browser.ts relay.ts the two roads a proxied address can take
  crx.ts chromeext.ts a Chrome extension: its archive, and its APIs
  art.tsx             the artwork the shop draws, for anything wearing a piece
                      bought before the shelf became real files
  brand.tsx           the wordmark, and the face NULL wears when you have none
  shopAssets.ts       the shelf: what a piece is called, what it costs, and
                      which file in public/decor/shop it is
  outage.tsx          whether the server is there at all, the card a cloud page
                      shows when it is not, and the backendless switch
  card.ts             the share card, painted to a canvas for a PNG
src/components/
  Rail.tsx            the 56px spine
  Chrome.tsx          the tab strip, the toolbar, the mini player
  Ambient.tsx         the fog and the specks, drawn by hand on one canvas
  Sheet.tsx           the one popup shape, with the heavy blur
  SettingsSheet.tsx   settings, over whatever page you are on
  Guard.tsx           the boundary that turns a throw into a card
  StaffRoles.tsx      the role marks, and the owner's picker
  FriendsPanel.tsx    the friends list, on the account page
  CloudSaves.tsx      the save slots, in the player and on a profile
  Appeals.tsx         the appeal queue and the staff log
  WebStore.tsx        adding a Chrome extension from a .crx
  EmojiPicker.tsx     the pad, and the names under a colon
src/pages/            one file per page
src/styles/
  fonts.css           the eight display faces, as files
  tokens.css          the palettes, the shape scale
  shell.css           rail, tab strip, toolbar, page frame
  pages.css           home, library, proxies, changelog, extensions, player, 404
  community.css       the rooms, the members board, the directory
  voice.css saves.css the channel, and the save slots
  emoji.css           the composer's pad, shelf and names
  social.css          gifts and jams
  messages.css        the conversation list, and the thread beside it
  staff.css           roles, the picker, the badge colours
  shop.css            the counters, the shelves, and every animation
  profile.css         the sign-in card, the player card, the account list
  settings.css        the settings popup
  refine.css          the quiet pass, imported last: it overrides sizes
```

## How it is put together

**Palettes are variables.** `tokens.css` declares the same nine values once per
palette. Switching a theme writes one attribute on `<html>`, so no
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
card. There is no reset flow and no email field, because there is no mailbox
to send one to: the password never leaves the browser, and the directory on
the server holds the handle and the card, not the digest. Several accounts
can live on one device — the list is a list, not a slot — so signing out of
one leaves the others where they were and two tabs can be two people.
Deleting one removes it from the device and from the directory, which is what
makes it a deletion rather than a logout. One handle is reserved for the
person who owns NULL: `owner.ts` holds it
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
at it. The same bridge takes the resources the frame fetches *for itself*: a
stylesheet, a script or a picture that fails to load on its own is pulled over
the relay and the element is pointed at what came back, with the images and
fonts a sheet names pulled alongside it, because those are relative to the
sheet rather than to the page. It is deliberately lazy — nothing is fetched
twice, and a page whose files load normally pays nothing for it. The first
error the page throws is handed up as well, and the bar above the frame says
which of the two happened.

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

**A voice channel has no server, so it has a shape.** There is no media
server anywhere in NULL: each person in the room holds one peer connection to
every other person in the room, and the only thing that goes through the
backend is the introduction — an offer, an answer, and a few addresses, all
discarded once read (`convex/voice.ts`). Two people is one connection, four is
six, eight is twenty-eight, and the room says so rather than quietly sounding
bad. The audio never touches NULL's disk, which is the same sentence as
"nothing here can record you".

**Two kinds of save, two ways in.** `src/lib/saves.ts` knows where a save
comes from, and it is two answers because the library is two things. A game
NULL copied into a frame runs as a document this page can reach, so its
storage is simply read and written. A game on somebody else's origin cannot be
read at all — that is what an origin is for — so those cards ask for the save
the honest way: paste it, or drop in the file the game exported. What lands on
the account is text NULL never looks inside, which is why it works for a game
nobody has heard of yet.

**A friendship is two follows pointing at each other.** `friends.ts` keeps no
separate friend table, so there is nothing to go stale: the graph is the
follows, and a mutual pair is a friendship. Presence rides on the same module
— this browser says "still me" every forty-five seconds and anybody whose last
word was inside the server's online window gets a green dot. It is a two-field
write rather than a whole member card, which is what makes it cheap enough to
leave running.

**An appeal is read by a person.** `Appeals.tsx` holds both ends of a
punishment: the queue a member writes into, long-form and about anything, and
the log staff read. Nothing unlocks itself. Granting an appeal lifts the ban
in the *same write* as the decision, so there is never a moment where the
paperwork says yes and the door is still shut, and the log is append-only on
the server, which is the only thing that makes a log worth reading.

**A quote carries the words, not a pointer at them.** A reply copies what it
is replying to. A deleted original therefore leaves a readable conversation
rather than a hole where the quote used to be, and the copy is what the filter
and the room both see.

**One substitution, and what it is for.** Every printable ASCII character has
a twin 19,936 code points above it, so `a` is written as `一` and `~` as `一`+
126. `ob.ts` does that and nothing else. It is not encryption and does not
pretend to be — it is for saying something in a room where a machine is
reading the page over your shoulder. A monitor looking for words sees Chinese;
anybody in NULL who knows the map sees the sentence. It is off by default, it
is never applied to a message you did not switch it on for, and the person you
are talking to reads it decoded, because they are on the same site. What it
changes is what the words look like to something that is *not* in the room.

**A conversation gets a whole window when it deserves one.** Messages is the
chat pop-out's other half: the same `dms` rows and the same mutation behind it,
laid out as a list of conversations with the thread beside it. Names, pictures,
role chips and the green dot come from the directory the page is already
reading, the day is written once where the day changes, and what has arrived
since you last had a thread open is this browser's own stamp — a thing a
machine can know and a server cannot.

**The background is one canvas, or it is a still frame.** `Ambient.tsx` draws
the fog and the specks itself: nothing is fetched and nothing is a library.
The loop stops the moment the tab is hidden, and the performance and motion
switches both mean the same thing — draw it once and leave it alone. A
background that costs frames is a background that has to go.

**The shared side is optional, and says so.** Three doors on NULL are really
one server: the chat rooms, the member directory and the Richest board. When
that deployment stops answering — a spent usage limit is what happened to the
old one — the doors come off the rail (and out of All Apps and the 404) rather
than being offered and then throwing, and the pages behind them say which of
the two things happened: the server is gone, or this page has a bug. The
switch in Settings → Server does the same thing on purpose, which is the shape
the site takes on a network the server is not welcome on. Chat, presence, the
jam, the shared music shelf, cloud saves, friends and the assistant all stop
cleanly; the shop, the library, the player, the profile and the browser never
spoke to a server in the first place, so nothing about them changes.

**Art that ships with the site does not get filtered.** Every card in the shop
used to point at raw.githubusercontent, which is a host half the school
districts in the world block, and a blocked host cost the shelf every picture
it had. The art is in `public/decor/shop` now and is served from whatever
served the page, so the shelf draws on the same connection the visitor
already had. It is not inlined into the bundle: a 288px animated PNG is about
a megabyte, and 73 of them as base64 would be a 100MB JavaScript file.

**Nothing is advertised.** There are no adverts on NULL, no ad slots, no
sponsored tiles and no placeholder for one to arrive in. It is a rule, not a
roadmap item, and the front door says so in as many words.

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
  in the map at the top of `src/lib/art.tsx`; a piece of shelf art needs the
  file in `public/decor/shop/` and its name, name and price in the seed table
  in `src/lib/shopAssets.ts` (see `public/decor/README.txt`).
* **A page that needs the server** — the door goes in `src/lib/nav.ts` and its
  id goes in `CLOUD_PAGES` beside it, which is what takes it off the rail,
  out of All Apps and out of the 404's list in the backendless build
  (`src/lib/outage.tsx`). Everything else on the site has to keep working with
  no deployment at all.

## Icons and fonts

Icons are [Lucide](https://lucide.dev) `lucide-react`, imported as components.
Nothing is hand-drawn per screen and there is no icon font to subset.

Body text is `Adwaita Sans → SF Compact Text → Inter → system`. The eight
display faces a profile can put its own name in load separately from Google
Fonts, and nothing else uses them.

## Licence

ISC. See `LICENSE`.
