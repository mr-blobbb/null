/* NULL · Changelog.tsx
   A spine, oldest at the bottom. The newest dot glows; the rest are outlines.
   Every entry is a version, a date, one line about it, and what changed,
   marked with a green plus for things that arrived, a wrench for things that
   moved, and a red X in a circle for things that were removed. */

import { CircleX, Plus, Wrench } from "lucide-react";

type Change = { kind: "add" | "tweak" | "remove"; text: string };
type Release = { version: string; date: string; note: string; changes: Change[] };

const RELEASES: Release[] = [
  {
    version: "v1.2.3",
    date: "September 21, 2026",
    note: "The one where searching the games shelf stopped guessing, and the browser got a new little door.",
    changes: [
      { kind: "tweak", text: "Game search now matches names, IDs and labels predictably, with partial-name support and only a conservative one-letter typo fallback. Unrelated games no longer appear because their metadata happens to contain the same letters." },
      { kind: "add", text: "Added the Minecraft top-bar door. It opens the hosted Minecraft page inside NULL while keeping its tab identity as null://minecraft." },
      { kind: "tweak", text: "The homepage build stamp and visible version are now v1.2.3 · 20260921." },
    ],
  },
  {
    version: "v1.2.2",
    date: "September 20, 2026",
    note: "The one where NULL became a more complete browser, tightened the UI, and cleaned up the chrome.",
    changes: [
      { kind: "add", text: "The AI assistant now supports multiple saved conversation threads, thread switching and deletion, a per-thread token estimate, and a GPT-4o mini model selector with future models clearly marked Coming Soon." },
      { kind: "add", text: "The browser shell now keeps per-tab titles, favicons, loading and error state, bookmarks, history records, downloads records, keyboard shortcuts, page information, and relay recovery state." },
      { kind: "add", text: "External sites always enter NULL's proxy path, with expanded rewriting for redirects, cookies, policy headers, CORS, workers, dynamic imports, WebSockets, service workers, manifests, media, WASM, and range/cache headers." },
      { kind: "add", text: "Games now use a CORS-friendly CDN mirror with automatic fallback, and the removed CKV shelf no longer appears in the games menu." },
      { kind: "add", text: "Split view now gives both panes their own tab strip and address bar, so two pages can be navigated independently side by side." },
      { kind: "add", text: "Bookmarking is now a dedicated star in the browser toolbar, next to Split and Extensions." },
      { kind: "tweak", text: "The global visual audit restored card geometry after an overly broad button rule, then kept compact styling limited to real controls and fields. Profile banners, overlay compositing, responsive wrappers, overflow, and cross-browser fallbacks were tightened." },
      { kind: "remove", text: "The standalone DMs page and its navigation route were removed; DMs remain inside Chat." },
      { kind: "remove", text: "The standalone Proxies app was removed from the homepage All Apps shelf; proxy loading remains available to browser tabs and supported media doors." },
      { kind: "remove", text: "History, Downloads, and Page Info toolbar buttons and popovers were removed from the browser chrome to keep the top bar focused." },
    ],
  },
  {
    version: "v1.2.1",
    date: "September 18, 2026",
    note: "The one about the two places you look at other people: a page for messages, and a browser that waits for the pictures.",
    changes: [
      { kind: "add", text: "Messages: a page of its own. Every conversation you are in down the left, most recent first, the one you pick on the right, and a box at the bottom that sends. Names, pictures, role chips and the green dot come from the search box's directory — so anybody can be written to from the box itself, whether or not there is a thread yet." },
      { kind: "add", text: "What arrived since you last had a thread open is marked, and it is this browser's own stamp rather than the server's: whether you have read something is a thing a machine knows and a server cannot." },
      { kind: "add", text: "The day is written once where the day changes, runs of lines from the same person share one picture, and gifts and trades take their place in the stream in the order they happened, exactly as they do in the pop-out." },
      { kind: "tweak", text: "The partner wall is gone. The PARTNER badge still marks whoever holds the role, and the door it sat behind on the rail is Messages now." },
      { kind: "tweak", text: "A copied page no longer arrives as its own inline styles and nothing else. A stylesheet, a script or a picture that fails to load on its own is pulled over the relay instead, together with the images and fonts the sheet names, because those are relative to the sheet and not to the page. It is lazy: a page whose files load normally fetches nothing twice." },
    ],
  },
  {
    version: "v1.2.0",
    date: "September 18, 2026",
    note: "The one with other people in it, properly: talking, saving, gifting, and a wall for the people who built the shelves.",
    changes: [
      { kind: "add", text: "Voice channels in the chat rooms. The audio goes straight between the browsers in the room and NULL's server only makes the introduction, which is also why there is nothing here that could record you." },
      { kind: "add", text: "Cloud saves. A game NULL copied into a frame can be read and written in one click; a game on somebody else's origin takes the save the honest way — paste it, or drop in the file it exported." },
      { kind: "add", text: "Friends, with presence. Two follows pointing at each other are a friendship, so there is no second table to go stale, and a green dot means the other browser said hello in the last minute." },
      { kind: "add", text: "Appeals: one long message, filed by anybody, read by a person. Granting one lifts the ban in the same write as the decision, so the paperwork and the door never disagree." },
      { kind: "add", text: "An audit log for staff, append-only, newest first. A log you can edit is not a log." },
      { kind: "add", text: "Quoting. A reply carries a copy of the words rather than a pointer at them, so a deleted message does not leave a hole in the conversation." },
      { kind: "add", text: "The apps shelf is stocked, and the front door has a row of doors out to the services NULL should not pretend to be — Now.gg, GeForce NOW, Poki, itch and friends." },
      { kind: "add", text: "A partner wall: whoever holds the PARTNER role, read from the directory so it cannot go stale, plus the shelves and relays NULL is built on. Every badge is drawn in code from the handle, so a partner who joins tomorrow has one already." },
      { kind: "add", text: "The front door picks a different line every visit, and the new ones sit in the same hat as the old ones. There is no rare message; that is the joke." },
      { kind: "add", text: "A device chip, off by default: “Chrome · Windows”, “Safari · iPhone”. Half of what a games hub gets asked starts with what the machine is." },
      { kind: "add", text: "Eight display faces to put your own name in, and the palette list grew to match." },
      { kind: "add", text: "The fog behind the page and the specks rising through it are drawn by hand on one canvas. They stop when the tab is hidden, and in the performance modes they are a single still frame." },
      { kind: "add", text: "Off by default, in the chat: write a line in twins — every printable character swapped for the one 19,936 code points above it. It is not encryption and does not claim to be. It is for a room with a machine reading over your shoulder." },
      { kind: "tweak", text: "Staff can post a vote in a message — /vote #one #two #the question — and it is drawn as a poll under the prose rather than as a separate thing to post. The tallies are shared, so the room sees the same numbers." },
      { kind: "tweak", text: "The reaction row is the short list people actually use, the picker behind it is the whole set, and typing a colon offers names as you go. The gif button talks to a gif service instead of asking you for a URL." },
      { kind: "tweak", text: "Roles got their colours and their marks back: OWNER, CO-OWNER, ADMIN, BETA, PARTNER, DEV, LINKER, and the verified ring. The owner can hand one out from a card." },
      { kind: "tweak", text: "More than one account can live on a device. Signing out of one no longer takes the others with it, and two tabs can be two different people." },
      { kind: "tweak", text: "Signing in no longer resets the name styling you set on the account, and the room the chat opens on is the rules, not general." },
      { kind: "tweak", text: "Deleting an account deletes it, on the device and in the directory." },
      { kind: "tweak", text: "Everything is rounder and spaced a little more like a chat app than a dashboard." },
      { kind: "tweak", text: "There are no adverts on NULL and there will not be. That is a rule, not a roadmap item." },
    ],
  },
  {
    version: "v1.1.1",
    date: "September 17, 2026",
    note: "The one where the browser gets a second road that actually works.",
    changes: [
      { kind: "tweak", text: "Audius stopped blaming the node for a song it does not have. It says whether the catalogue had nothing, had only gated matches, or really was down." },
      { kind: "tweak", text: "A search that comes back empty is retried without the extra words, because Audius indexes titles." },
      { kind: "add", text: "The copy road can make requests: a copied page's fetch and XHR are carried out by the window that owns the relay, so a site whose first API call is refused still draws." },
      { kind: "add", text: "The copy road has somewhere to store things — an in-memory database for pages that persist, because an opaque origin throws on the real one." },
      { kind: "add", text: "A window that fails says why: the reason the rewritten road did not come up, and the first error the page threw, on a bar above the frame." },
      { kind: "tweak", text: "The rewritten window is judged by what it drew, not by a load event that fires for blank pages and error pages alike." },
      { kind: "tweak", text: "The band of cards on the front door no longer vanishes on a normal laptop screen; the page steps down to fit it instead." },
      { kind: "add", text: "The assistant answers whether or not the deployment has a key, and uses the deployment's key when there is one." },
    ],
  },
  {
    version: "v1.1.0",
    date: "September 17, 2026",
    note: "The one with other people in it. NULL gets a server.",
    changes: [
      { kind: "add", text: "A chat room: one room, everyone in it, with a filter that knows about sh1t and leaves Scunthorpe alone." },
      { kind: "add", text: "Members and the Richest board now read across machines, not just this browser." },
      { kind: "add", text: "Music asks the catalogues through the server, so Qobuz and SoundCloud can answer at all. Keys can live on the deployment." },
      { kind: "add", text: "Chrome extensions can be added from a .crx and run their popup in a sandbox. The ones that need the whole browser install dormant and say why." },
      { kind: "add", text: "A five-step tour of the front door, once, replayable from Settings." },
      { kind: "add", text: "Richest, behind a trophy: the top five purse-holders, by coins, which means by time." },
      { kind: "tweak", text: "404s are real now: null://404 exists, and an address with nothing behind it says so instead of showing the front door." },
      { kind: "tweak", text: "The epoxy transport was missing the class bare-mux needs. Every proxied page was throwing “is not a constructor” because of it." },
      { kind: "tweak", text: "The clock moved out of the toolbar, which gave the address bar and the player their room back." },
      { kind: "tweak", text: "Tabs are rounder, and they open, close and drag with a beat." },
      { kind: "tweak", text: "Avatar decorations sit on the picture's rim instead of floating inside it." },
      { kind: "tweak", text: "The front door does not scroll. Everything on it is sized to the window." },
      { kind: "tweak", text: "New icon: a rounded pixel tile, drawn from one map for the favicon, the app icons and the default picture." },
    ],
  },
  {
    version: "v1.0.0",
    date: "September 17, 2026",
    note: "Welcome to Null v1! This is the newest generation of Null, built to last.",
    changes: [
      { kind: "add", text: "Rewritten in React and TypeScript, one app instead of twenty pages." },
      { kind: "add", text: "A tab strip with back, forward and reload, and an address bar that speaks null://." },
      { kind: "add", text: "Sixteen palettes, and the homepage wordmark takes the colour of whichever one is on." },
      { kind: "add", text: "The Shop, rebuilt: coins from time on the site, three shelves, gift codes." },
      { kind: "add", text: "The Profile: sign in locally, banner, picture, bio, name styles, library." },
      { kind: "add", text: "Settings opens over the page you are on instead of replacing it." },
      { kind: "add", text: "The Proxies window: type an address and it loads inside NULL." },
      { kind: "add", text: "Extensions can draw in the top bar or take a page of their own." },
      { kind: "tweak", text: "One icon set, one radius scale, one border width, one accent per palette." },
      { kind: "tweak", text: "The rail is thinner and no longer opens on hover." },
      { kind: "tweak", text: "Every page is flat: no gradients, no shine, no drifting haze." },
    ],
  },
  {
    version: "v0.9.4",
    date: "September 14, 2026",
    note: "The quiet one. Mostly things that were annoying.",
    changes: [
      { kind: "tweak", text: "The library's sticky row sticks now, on all three shelves." },
      { kind: "tweak", text: "Themes stopped rolling violet at random." },
      { kind: "tweak", text: "Cards stopped printing their own description back at you." },
      { kind: "add", text: "Favourites, with a count that only counts what is really there." },
    ],
  },
  {
    version: "v0.9.0",
    date: "September 9, 2026",
    note: "The library, the player, and the first version of the shop.",
    changes: [
      { kind: "add", text: "A player window for games, apps and proxied sites." },
      { kind: "add", text: "Android and desktop save states, kept in the browser." },
      { kind: "tweak", text: "Search stopped indexing pages that no longer exist." },
    ],
  },
  {
    version: "v0.8.0",
    date: "September 3, 2026",
    note: "Where it started: a black page with a wordmark on it.",
    changes: [
      { kind: "add", text: "The first NULL, one file, no build step." },
      { kind: "add", text: "Games, apps and proxies in one place." },
    ],
  },
];

export function Changelog() {
  return (
    <div className="page">
      <h1 className="lb-title cl-title">Changelog</h1>
      <p className="lede">
        Everything that changed, newest first. Added work is marked with a plus, moved or
        repaired work with a wrench, and removed features with a red X.
      </p>

      <ol className="cl">
        {RELEASES.map((r, i) => (
          <li className="cl-item" key={r.version}>
            <span className={`cl-dot${i === 0 ? " is-new" : ""}`} aria-hidden="true" />
            <div className={`cl-head${i === 0 ? " is-new" : ""}`}>
              <b>{r.version}</b>
              <span className="cl-sep">∙</span>
              <span className="muted">{r.date}</span>
            </div>
            <p className="cl-note">{r.note}</p>
            <ul className="cl-list">
              {r.changes.map((c, n) => (
                <li key={n} className={`cl-change cl-change--${c.kind}`}>
                  <span className="cl-mark">{c.kind === "add" ? <Plus /> : c.kind === "remove" ? <CircleX /> : <Wrench />}</span>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
