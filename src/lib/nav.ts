/* NULL · nav.ts
   Every destination in one table: what it is called, the null:// address the
   tab bar shows, where it lives, and which icon it wears. The rail, the tab
   strip, the All Apps sheet and the command palette are all built from this,
   so a page that exists is a line here and a page that does not is a line
   deleted. */

import {
  Bot,
  Clapperboard,
  Compass,
  Gamepad2,
  MessageCircle,
  MessagesSquare,
  Music,
  Globe,
  House,
  Link2,
  Play,
  ScrollText,
  ShoppingBag,
  SlidersHorizontal,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export type PageId =
  | "home"
  | "games"
  | "apps"
  | "ai"
  | "chat"
  | "movies"
  | "music"
  | "proxies"
  | "shop"
  | "profile"
  | "changelog"
  | "settings"
  | "users"
  | "rich"
  | "missing"
  | "player"
  | "minecraft";

export type Page = {
  id: PageId;
  name: string;
  /** the internal address the tab shows */
  address: string;
  route: string;
  icon: LucideIcon;
  blurb: string;
  /** matches the query in the command palette as well as the title */
  keywords: string;
  /** an address this page opens through the proxy window, if it is one */
  loads?: string;
};

export const PAGES: Record<PageId, Page> = {
  home: {
    id: "home",
    name: "Home",
    address: "null://home",
    route: "/",
    icon: House,
    blurb: "The front door: search everything and jump to a page.",
    keywords: "home start welcome hub front door",
  },
  games: {
    id: "games",
    name: "Games",
    address: "null://g",
    route: "/games",
    icon: Gamepad2,
    blurb: "The library: one square each, searchable by name or category.",
    keywords: "play game arcade fun library",
  },
  apps: {
    id: "apps",
    name: "Apps",
    address: "null://a",
    route: "/apps",
    icon: Link2,
    blurb: "Tools that run in a tab, laid out exactly like the games.",
    keywords: "app tool utility library",
  },
  ai: {
    id: "ai",
    name: "Assistant",
    address: "null://ai",
    route: "/ai",
    icon: Bot,
    blurb: "A model you can ask about the site. It runs on the deployment's key.",
    keywords: "ai assistant bot chat gpt llm ask help chatbot",
  },
  chat: {
    id: "chat",
    name: "Chat",
    address: "null://chat",
    route: "/chat",
    icon: MessageCircle,
    blurb: "One room, every machine that has NULL open. Mind your language.",
    keywords: "chat room talk message community people say hello",
  },
  movies: {
    id: "movies",
    name: "Movies",
    address: "null://m",
    route: "/movies",
    icon: Clapperboard,
    blurb: "aether.cx, opened inside NULL like any other address.",
    keywords: "movies film watch aether stream cinema",
    loads: "https://aether.cx/settings",
  },
  music: {
    id: "music",
    name: "Music",
    address: "null://music",
    route: "/music",
    icon: Music,
    blurb: "The player: search a catalogue, keep what you like, queue the rest.",
    keywords: "music songs player playlist qobuz soundcloud youtube shuffle audio",
  },
  /* No longer a door of its own: an address is typed in the bar and opens as
     a tab. The page stays for the fullscreen browser and the ready-made
     links, it is just not advertised in the rail. */
  proxies: {
    id: "proxies",
    name: "Proxies",
    address: "null://p",
    route: "/proxies",
    icon: Globe,
    blurb: "Open any site inside NULL, or use the ready-made links.",
    keywords: "proxy wisp relay unblock browse mirror web",
  },
  shop: {
    id: "shop",
    name: "Shop",
    address: "null://shop",
    route: "/shop",
    icon: ShoppingBag,
    blurb: "Spend playtime coins on decorations, effects and name tags.",
    keywords: "shop coins buy cosmetics decorate gift",
  },
  profile: {
    id: "profile",
    name: "Profile",
    address: "null://me",
    route: "/profile",
    icon: UserRound,
    blurb: "Your card: banner, picture, name, bio and library.",
    keywords: "profile account login sign in banner avatar bio me",
  },
  changelog: {
    id: "changelog",
    name: "Changelog",
    address: "null://log",
    route: "/changelog",
    icon: ScrollText,
    blurb: "Every release, newest first, with what was added and fixed.",
    keywords: "changelog release notes news update version",
  },
  users: {
    id: "users",
    name: "Members",
    address: "null://u",
    route: "/users",
    icon: Users,
    blurb: "Everybody who has signed in here, owner first.",
    keywords: "members users people profiles community accounts who joined",
  },
  rich: {
    id: "rich",
    name: "Richest",
    address: "null://rich",
    route: "/rich",
    icon: Trophy,
    blurb: "The five fattest coin purses on NULL, this month or any other.",
    keywords: "richest leaderboard top coins rich ranking wealth board",
  },
  /* Not a door: the page an address with nothing behind it lands on. It is in
     this table so the tab bar, the address bar and the router all agree on
     what it is, and out of ALL_PAGES so nothing ever offers it as a
     destination. */
  missing: {
    id: "missing",
    name: "Not found",
    address: "null://404",
    route: "/404",
    icon: Compass,
    blurb: "There is nothing at that address.",
    keywords: "404 not found missing nothing here error",
  },
  settings: {
    id: "settings",
    name: "Settings",
    address: "null://set",
    route: "/settings",
    icon: SlidersHorizontal,
    blurb: "Themes, data and the paperwork, over whatever page you are on.",
    keywords: "settings theme palette appearance data privacy terms",
  },
  player: {
    id: "player",
    name: "Player",
    address: "null://play",
    route: "/play",
    icon: Play,
    blurb: "The window a game or a proxied site opens in.",
    keywords: "player play window frame",
  },
  minecraft: {
    id: "minecraft",
    name: "Minecraft",
    address: "null://minecraft",
    route: "/minecraft",
    icon: Gamepad2,
    blurb: "Open the Minecraft page inside NULL.",
    keywords: "minecraft slides game",
    loads: "https://yt78n.github.io/googleslidesisfun",
  },
};

/** Five doors at the top of the rail, five at the bottom, and a deliberate
 *  empty gap between them. The gap is the point: the rail is a spine.
 *
 *  The bottom group is read upward from the last door, so the two that are
 *  about people sit together: members just above the profile. */
export const RAIL_TOP: PageId[] = ["home", "games", "apps", "ai", "chat", "movies", "music", "shop"];
export const RAIL_BOTTOM: PageId[] = ["rich", "users", "profile", "changelog", "settings"];

/** Everything the All Apps sheet lists, in reading order. */
export const ALL_PAGES: PageId[] = [
  "home",
  "games",
  "apps",
  "ai",
  "chat",
  "movies",
  "music",
  "proxies",
  "shop",
  "rich",
  "users",
  "profile",
  "changelog",
  "settings",
];

/** The rail and the sheets never offer Settings as a page: it is a sheet that
 *  opens over whatever is already there. */
export const SHEET_PAGES: PageId[] = ALL_PAGES.filter((id) => id !== "settings" && id !== "proxies");

/** The doors that are only there because something else is holding the other
 *  end: a chat room and a member directory and a board of everyone's purses
 *  are all the same room on a server. Nothing else about NULL needs one —
 *  games, apps, the shop, the profile and the browser are all this machine.
 *
 *  When the deployment cannot be reached, or somebody has asked for the
 *  backendless build, these are the doors that go: an offer nobody can take
 *  is worse than no offer. See src/lib/outage.tsx. */
export const CLOUD_PAGES: PageId[] = ["chat", "users", "rich"];

/** A list of doors, minus the ones that need a server there is not one of. */
export function doors(ids: readonly PageId[], offline: boolean): PageId[] {
  return offline ? ids.filter((id) => !CLOUD_PAGES.includes(id)) : [...ids];
}

export function needsCloud(id: PageId): boolean {
  return CLOUD_PAGES.includes(id);
}

export function pageOf(id: PageId): Page {
  return PAGES[id];
}

/* ---------- the address bar ----------
   One box does both jobs, like a browser's: an internal null:// page, a typed
   address, or words to search for. Brave is what the site ships with. */
export type EngineId = "brave" | "duckduckgo" | "google";

export const ENGINES: { id: EngineId; name: string; url: (q: string) => string }[] = [
  { id: "brave", name: "Brave", url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}` },
  { id: "duckduckgo", name: "DuckDuckGo", url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  { id: "google", name: "Google", url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
];

export function searchUrl(q: string, engine: EngineId = "brave"): string {
  const hit = ENGINES.find((e) => e.id === engine) ?? ENGINES[0];
  return hit.url(q);
}

/** Where something typed can go. `missing` is the third answer, and the one
 *  the old code did not have: an address that means nothing used to fall
 *  through to the homepage, which is exactly what a 404 is for. */
export type Destination = { page: PageId } | { url: string } | { missing: string };

/** What the address box does with what you typed. A page, an address, a place
 *  that is not there, or a search — never nothing. */
export function destinationFor(raw: string, engine: EngineId = "brave"): Destination | null {
  const s = raw.trim();
  if (!s) return null;
  const parsed = parseAddress(s);
  if (parsed) return parsed;
  /* words, or a single word that could not be a host: search the web */
  if (/\s/.test(s) || !/\.[a-z]{2,}/i.test(s)) return { url: searchUrl(s, engine) };
  return null;
}

/** Turn a typed or pasted address into a destination.
 *  `null://g`, `g`, `/games`, `null://games` all mean the games page.
 *
 *  An address *inside* NULL that matches nothing is an address inside NULL:
 *  it returns `missing` and shows the 404 with whatever was typed, rather than
 *  being quietly reinterpreted as a web search or, worse, the front door. */
export function parseAddress(raw: string): Destination | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^null:\/\//i.test(s)) {
    const host = s.replace(/^null:\/\//i, "").replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
    if (host === "minecraft") return { page: "minecraft" };
    if (host === "404") return { page: "missing" };
    const hit = ALL_PAGES.find(
      (id) =>
        id === host ||
        PAGES[id].address.replace("null://", "") === host ||
        PAGES[id].name.toLowerCase() === host,
    );
    return hit ? { page: hit } : { missing: `null://${host}` };
  }
  if (s.startsWith("/")) {
    const hit = ALL_PAGES.find((id) => PAGES[id].route === s.replace(/\/$/, "") || (s === "/" && id === "home"));
    if (hit) return { page: hit };
    if (s === "/404") return { page: "missing" };
    return { missing: s };
  }
  /* a bare word that is a page name still counts */
  const bare = s.toLowerCase();
  const named = ALL_PAGES.find((id) => PAGES[id].address.replace("null://", "") === bare);
  if (named) return { page: named };
  /* anything else is treated as a website, normalised to https */
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return { url: s };
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(s)) return { url: `https://${s}` };
  return null;
}
