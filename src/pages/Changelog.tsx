/* NULL · Changelog.tsx
   A spine, oldest at the bottom. The newest dot glows; the rest are outlines.
   Every entry is a version, a date, one line about it, and what changed,
   marked with a green plus for things that arrived and a wrench for things
   that moved. */

import { Plus, Wrench } from "lucide-react";

type Change = { kind: "add" | "tweak"; text: string };
type Release = { version: string; date: string; note: string; changes: Change[] };

const RELEASES: Release[] = [
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
        Everything that changed, newest first. Where a release added something it is marked
        with a plus; where it moved something, a wrench.
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
                  <span className="cl-mark">{c.kind === "add" ? <Plus /> : <Wrench />}</span>
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
