/* NULL · nav.ts
   Every destination in one table: what it is called, the null:// address the
   tab bar shows, where it lives, and which icon it wears. The rail, the tab
   strip, the All Apps sheet and the command palette are all built from this,
   so a page that exists is a line here and a page that does not is a line
   deleted. */

import {
  Clapperboard,
  Gamepad2,
  Music,
  Globe,
  House,
  Link2,
  Play,
  Puzzle,
  ScrollText,
  ShoppingBag,
  SlidersHorizontal,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export type PageId =
  | "home"
  | "games"
  | "apps"
  | "movies"
  | "music"
  | "proxies"
  | "shop"
  | "profile"
  | "changelog"
  | "extensions"
  | "settings"
  | "users"
  | "player";

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
  movies: {
    id: "movies",
    name: "Movies",
    address: "null://m",
    route: "/movies",
    icon: Clapperboard,
    blurb: "aether.cx, opened inside NULL like any other address.",
    keywords: "movies film watch aether stream cinema",
    loads: "https://aether.cx",
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
  extensions: {
    id: "extensions",
    name: "Extensions",
    address: "null://ext",
    route: "/extensions",
    icon: Puzzle,
    blurb: "Add-ons that draw inside NULL, in any page you are on.",
    keywords: "extension addon plugin widget popup",
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
};

/** Five doors at the top of the rail, five at the bottom, and a deliberate
 *  empty gap between them. The gap is the point: the rail is a spine.
 *
 *  The bottom group is read upward from the last door, so the two that are
 *  about people sit together: members just above the profile. */
export const RAIL_TOP: PageId[] = ["home", "games", "apps", "movies", "music", "shop"];
export const RAIL_BOTTOM: PageId[] = ["users", "profile", "changelog", "extensions", "settings"];

/** Everything the All Apps sheet lists, in reading order. */
export const ALL_PAGES: PageId[] = [
  "home",
  "games",
  "apps",
  "movies",
  "music",
  "proxies",
  "shop",
  "users",
  "profile",
  "changelog",
  "extensions",
  "settings",
];

/** The rail and the sheets never offer Settings as a page: it is a sheet that
 *  opens over whatever is already there. */
export const SHEET_PAGES: PageId[] = ALL_PAGES.filter((id) => id !== "settings");

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

/** What the address box does with what you typed. A page, an address, or a
 *  search — never nothing, which is what the old popup search got wrong. */
export function destinationFor(
  raw: string,
  engine: EngineId = "brave",
): { page: PageId } | { url: string } | null {
  const s = raw.trim();
  if (!s) return null;
  const parsed = parseAddress(s);
  if (parsed) return parsed;
  /* words, or a single word that could not be a host: search the web */
  if (/\s/.test(s) || !/\.[a-z]{2,}/i.test(s)) return { url: searchUrl(s, engine) };
  return null;
}

/** Turn a typed or pasted address into a destination.
 *  `null://g`, `g`, `/games`, `null://games` all mean the games page. */
export function parseAddress(raw: string): { page: PageId } | { url: string } | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^null:\/\//i.test(s)) {
    const host = s.replace(/^null:\/\//i, "").replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
    const hit = ALL_PAGES.find(
      (id) =>
        id === host ||
        PAGES[id].address.replace("null://", "") === host ||
        PAGES[id].name.toLowerCase() === host,
    );
    return hit ? { page: hit } : null;
  }
  if (s.startsWith("/")) {
    const hit = ALL_PAGES.find((id) => PAGES[id].route === s.replace(/\/$/, "") || (s === "/" && id === "home"));
    return hit ? { page: hit } : null;
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
