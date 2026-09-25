/* NULL · Home.tsx
   The front door. A wordmark that takes the palette's ink, one line picked
   at random on every visit, a search box, five circular shortcuts the
   visitor can edit, and a band of cards drifting past underneath.

   Nothing here moves except the cards, and they stop when you look at them. */

import { useEffect, useMemo, useState } from "react";
import {
  Gamepad2,
  Grid3x3,
  Image as ImageIcon,
  Package,
  Plus,
  Puzzle,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { createStore, useStore } from "../lib/store";
import { destinationFor, PAGES, parseAddress, SHEET_PAGES, type PageId } from "../lib/nav";
import { go, openDestination } from "../lib/tabs";
import { Sheet } from "../components/Sheet";
import { Tour, tourSeen } from "../components/Tour";
import { prefs, usePalette } from "../lib/themes";
import { api } from "../../convex/_generated/api";
import { useQuery } from "convex/react";
import { cloudOn } from "../lib/cloud";
import { Guard } from "../components/Guard";

/* ---------- the lines ----------
   Every one of these has the same chance. There is no rare message, which
   is the point: a "0.01% chance" line that is as likely as the rest is a
   better joke than one that never shows up. */
const LINES = [
  "you have a 0.01% chance of getting this message",
  "well hello there",
  "i switched to linux",
  "woah",
  "penguins !",
  "made by mr blob",
  "thanks to all our beta testers!",
  "betrayal...",
  "sggames isn’t the best game site, null is!",
  "you’re pretty cool",
  "why is this site down sm i swear",
  "zzz",
  "yummy",
  "null on top fr",
  "tech no night",
  "also try [literally nothing all my other sites dont exist anymore]",
  "taste the spaghetti code",
  "that’s it for now",
  "fatality",
  "i worked very hard",
  "splishy splash",
  "made in...HTML?",
  "and for you sir?",
  "some things might take a bit to load, sorry :(",
  "first time using react kinda nervous",
  "i switched to linux (the message repeats until it is true)",
  "now with a wisp relay of our own",
  "no ads. never ads.",
  "the fog behind this page is drawn by hand",
  "two thousand games and counting",
  "cloud saves, so the progress follows you",
  "type : and the emoji picker finds you",
  "press the panic key. i dare you",
  "your name can be whatever font you like now",
  "voice channels work, and nothing is recorded",
  "there is a hidden shelf. there is always a hidden shelf",
  "if you can read this, the filter lost",
  "coins are earned by playing. that is the whole economy",
  "hello to whoever is up at 3am",
  "the changelog is the honest one",
  "rules are in the chat. read them. please",
  "this line was picked at random. yours might be better",
  "null is the house, and the house always lags a little",
];

/* ---------- the shortcuts ---------- */
type Shortcut = { id: string; label: string; path: string };

const DEFAULT_LINKS: Shortcut[] = [
  { id: "games", label: "Games", path: "null://g" },
  { id: "apps", label: "Apps", path: "null://a" },
  { id: "movies", label: "Movies", path: "null://m" },
  { id: "music", label: "Music", path: "null://music" },
  { id: "shop", label: "Shop", path: "null://shop" },
];

const links = createStore<{ list: Shortcut[] }>("links", { list: DEFAULT_LINKS });

/* Proxies and Extensions left the row — an address belongs in the address
   bar, and the extensions page is gone. A list saved before either of those
   still holds the entry, so both are dropped on the way in rather than
   showing a door the rail no longer has. */
const GONE = /^null:\/\/(p|ext)\/?$/i;
(function tidyLinks() {
  const list = links.get().list ?? [];
  const keep = list.filter((s) => s && !GONE.test(s.path ?? ""));
  if (keep.length !== list.length) links.set({ list: keep.length ? keep : DEFAULT_LINKS });
})();

const ICON_FOR: Record<string, LucideIcon> = {
  games: Gamepad2,
  apps: Package,
  movies: PAGES.movies.icon,
  shop: ShoppingBag,
  music: PAGES.music.icon,
  settings: SlidersHorizontal,
  changelog: PAGES.changelog.icon,
  profile: PAGES.profile.icon,
  home: PAGES.home.icon,
  play: Gamepad2,
};

function iconFor(path: string): LucideIcon {
  const parsed = parseAddress(path);
  if (parsed && "page" in parsed) return PAGES[parsed.page].icon;
  return ICON_FOR[path.replace("null://", "")] ?? ImageIcon;
}

/* ---------- the strip ---------- */
type Card = { avatar: string; name: string; role: string; text: string; lorem: string };

const CARDS: Card[] = [
  {
    avatar: "example.com/a.png",
    name: "mr blob",
    role: "Owner of Null",
    text: "Null is one of, if not the most modern games site. It has all the latest features, good speeds, smooth UI, and overall just works.",
    lorem:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.",
  },
  {
    avatar: "example.com/b.png",
    name: "penguin",
    role: "Beta tester",
    text: "I opened it expecting another mirror site and ended up using it for a week straight. The shop coins just appear while you play.",
    lorem: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip.",
  },
  {
    avatar: "example.com/c.png",
    name: "anonymous",
    role: "On linux",
    text: "Runs in a browser, remembers my theme, and the rail does not get in the way. That is the whole review.",
    lorem: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.",
  },
  {
    avatar: "example.com/d.png",
    name: "spaghetti",
    role: "Code enjoyer",
    text: "The changelog is longer than the site. I respect the honesty.",
    lorem: "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.",
  },
  {
    avatar: "example.com/e.png",
    name: "night owl",
    role: "3am regular",
    text: "Proxy window actually loads pages. I have not touched a bookmark since.",
    lorem: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium.",
  },
  {
    avatar: "example.com/f.png",
    name: "void",
    role: "Theme collector",
    text: "Twenty-four palettes and a custom one. I have changed mine four times today.",
    lorem: "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
  },
  {
    avatar: "example.com/g.png",
    name: "tester one",
    role: "Found three bugs",
    text: "Reported a bug on a Tuesday, it was fixed by Wednesday. Unreasonable.",
    lorem: "Neque porro quisquam est qui dolorem ipsum quia dolor sit amet consectetur.",
  },
  {
    avatar: "example.com/h.png",
    name: "quiet kid",
    role: "Lurker",
    text: "I have nothing to say but I wanted a card in here.",
    lorem: "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam.",
  },
  {
    avatar: "example.com/i.png",
    name: "matcha",
    role: "Green theme enthusiast",
    text: "Forest turns the whole wordmark green. Small thing. Made me stay.",
    lorem: "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis.",
  },
  {
    avatar: "example.com/j.png",
    name: "404",
    role: "Not found",
    text: "There is no page here. There is a page for that, though.",
    lorem: "Et harum quidem rerum facilis est et expedita distinctio nam libero tempore.",
  },
  {
    avatar: "example.com/k.png",
    name: "comet",
    role: "Regular",
    text: "Fast, plain, flat. It looks like a tool instead of a product page.",
    lorem: "Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus.",
  },
  {
    avatar: "example.com/l.png",
    name: "you?",
    role: "There is room",
    text: "The strip loops forever. Stay a while and you will read the whole thing twice.",
    lorem: "Omnis voluptas assumenda est, omnis dolor repellendus temporibus autem.",
  },
];

export function Home() {
  const palette = usePalette();
  const engine = useStore(prefs).searchEngine;
  const [line] = useState(() => LINES[Math.floor(Math.random() * LINES.length)]);
  const [q, setQ] = useState("");
  const [appsOpen, setAppsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [due, setDue] = useState(tourSeen() === false);
  const list = useStore(links).list;

  /* The box is the browser's address bar, not a search popup: a null:// page
     goes there, an address opens in the fullscreen browser, and anything else
     is a web search. Typing always goes somewhere. */
  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const to = destinationFor(q, engine);
    if (!to) return;
    openDestination(to);
  };

  /* the strip is drawn twice so the loop has no seam */
  const band = useMemo(() => [...CARDS, ...CARDS], []);

  return (
    <div className="hm">
      {/* the first-run tour: on the front door, once, and only ever here */}
      {due && <Tour onDone={() => setDue(false)} />}

      {/* The wordmark is the only lit thing on the page, so it is lit
          properly: three stacked shadows — a tight rim, a mid bloom and a
          wide haze — because one shadow reads as a sticker and three read
          as light. The ink comes from the palette, so Rosewood glows rose and
          NULL glows white without a second rule for either. */}
      <h1
        className="hm-word"
        style={{
          fontFamily: "var(--rounded)",
          backgroundImage: `linear-gradient(180deg, color-mix(in srgb, var(--text) 58%, var(--bg)) 0%, var(--text) 42%, ${palette.ink} 100%)`,
          filter: [
            `drop-shadow(0 0 2px color-mix(in srgb, ${palette.ink} 70%, transparent))`,
            `drop-shadow(0 0 16px color-mix(in srgb, ${palette.ink} 62%, transparent))`,
            `drop-shadow(0 0 46px color-mix(in srgb, ${palette.ink} 50%, transparent))`,
            `drop-shadow(0 0 110px color-mix(in srgb, ${palette.ink} 40%, transparent))`,
          ].join(" "),
        }}
      >
        null
      </h1>

      <p className="hm-line">{line}</p>

      <form className="hm-search" onSubmit={runSearch} role="search">
        <Search />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the web, or type an address"
          aria-label="Search the web or enter an address"
          spellCheck={false}
          autoComplete="off"
        />
      </form>

      <div className="hm-links">
        {list.map((s) => (
          <QuickLink
            key={s.id}
            icon={iconFor(s.path)}
            label={s.label}
            onClick={() => {
              const parsed = parseAddress(s.path);
              if (!parsed) return;
              openDestination(parsed);
            }}
            onRemove={() => links.set({ list: list.filter((x) => x.id !== s.id) })}
          />
        ))}
        {/* the two fixed doors sit to the right of the editable ones */}
        <QuickLink icon={Plus} label="Add" muted onClick={() => setAddOpen(true)} fixed />
        <QuickLink icon={Grid3x3} label="All Apps" muted onClick={() => setAppsOpen(true)} fixed />
      </div>

      <Guard what="the online counter" fallback={null}>
        <OnlineCount />
      </Guard>

      <div className="hm-strip">
        <div className="hm-band">
          {band.map((c, i) => (
            <article className="strip-card" key={`${c.name}-${i}`}>
              <header>
                <span className="strip-pic" title={c.avatar} aria-hidden="true" />
                <span className="strip-name">{c.name}</span>
                <span className="strip-dot">∙</span>
                <span className="strip-role">{c.role}</span>
              </header>
              <p className="strip-text">{c.text}</p>
              <p className="strip-lorem">{c.lorem}</p>
            </article>
          ))}
        </div>
      </div>

      <Sheet open={appsOpen} onClose={() => setAppsOpen(false)} title="Apps" icon={<Grid3x3 />} width={560}>
        <div className="appgrid">
          {SHEET_PAGES.map((id: PageId) => {
            const p = PAGES[id];
            const Icon = p.icon;
            return (
              <button
                key={id}
                className="appgrid-btn"
                onClick={() => {
                  setAppsOpen(false);
                  go({ page: id });
                }}
              >
                <Icon />
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>
      </Sheet>

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} onAdd={(s) => links.set({ list: [...list, s] })} />
    </div>
  );
}

/** How many people are on NULL right now. The server counts anyone seen in
 *  the last three minutes; with no server the count simply does not show,
 *  because a made-up number would be worse than none. */
function OnlineCount() {
  const rows = useQuery(api.members.list, cloudOn() ? {} : "skip") as
    | { online: boolean }[]
    | undefined;
  /* a throwing query unmounts whatever drew it, so it gets its own small
     Guard and the homepage keeps its other counters */
  if (!rows) return null;
  const online = rows.filter((r) => r.online).length;
  return (
    <p className="hm-online tiny faint">
      <Users /> {online} {online === 1 ? "person" : "people"} online
    </p>
  );
}

function QuickLink({
  icon: Icon,
  label,
  muted,
  onClick,
  onRemove,
  fixed,
}: {
  icon: LucideIcon;
  label: string;
  muted?: boolean;
  onClick: () => void;
  onRemove?: () => void;
  fixed?: boolean;
}) {
  return (
    <div className={`ql${fixed ? " ql--fixed" : ""}`}>
      <button className="ql-btn" onClick={onClick} aria-label={label}>
        <Icon className={muted ? "is-muted" : ""} />
      </button>
      {!fixed && onRemove && (
        <button
          className="ql-del"
          aria-label={`Remove ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 />
        </button>
      )}
      <span className="ql-label">{label}</span>
    </div>
  );
}

function AddSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (s: Shortcut) => void;
}) {
  const [label, setLabel] = useState("");
  const [path, setPath] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    if (!label.trim()) {
      setErr("Give it a name.");
      return;
    }
    if (!parseAddress(path)) {
      setErr("That is not a null:// address or a website.");
      return;
    }
    onAdd({ id: label.toLowerCase().replace(/\W+/g, "-") + "-" + Date.now().toString(36), label: label.trim(), path: path.trim() });
    setLabel("");
    setPath("");
    setErr(null);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add shortcut" width={430}>
      <div className="form">
        <label className="form-row">
          <span>Label</span>
          <input className="fld" value={label} placeholder="e.g., Games" onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Internal path</span>
          <input className="fld" value={path} placeholder="e.g., null://g" onChange={(e) => setPath(e.target.value)} />
        </label>
        {err && <p className="form-err">{err}</p>}
        <div className="form-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--fill" onClick={submit}>
            Add
          </button>
        </div>
      </div>
    </Sheet>
  );
}

