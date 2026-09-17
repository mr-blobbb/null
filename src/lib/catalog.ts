/* NULL · catalog.ts
   The library. Entries are plain objects: adding a game is adding a line,
   dropping a file at `games/` is not enough on its own because the site is
   built rather than served as a folder tree any more.

   `file` is a real path inside the built site, `thumb` an optional image,
   `labels` the categories the search also matches against. */

export type Kind = "game" | "app" | "proxy";

export type Entry = {
  id: string;
  name: string;
  kind: Kind;
  /** where it opens. A game or app: a file inside the site. A proxy: a site. */
  file?: string;
  url?: string;
  /** optional artwork. Without one the card shows a plain square and a glyph */
  thumb?: string;
  labels: string[];
  status?: "All Good" | "Issue" | "Blocked";
  warning?: { title: string; body: string };
};

const GAMES: Entry[] = [];

const APPS: Entry[] = [];

const PROXIES: Entry[] = [
  {
    id: "internet-archive",
    name: "Internet Archive",
    kind: "proxy",
    url: "https://archive.org/",
    labels: ["Archive", "Books", "Software"],
    status: "All Good",
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    kind: "proxy",
    url: "https://www.wikipedia.org/",
    labels: ["Reference", "Reading"],
    status: "All Good",
  },
  {
    id: "openstreetmap",
    name: "Openstreetmap",
    kind: "proxy",
    url: "https://www.openstreetmap.org/",
    labels: ["Maps", "Reference"],
    status: "Issue",
  },
];

export const LIBRARY: Record<Kind, Entry[]> = {
  game: GAMES,
  app: APPS,
  proxy: PROXIES,
};

export function entries(kind: Kind): Entry[] {
  return LIBRARY[kind];
}

export function find(kind: Kind, id: string): Entry | undefined {
  return LIBRARY[kind].find((e) => e.id === id);
}

/** Every category in one kind, alphabetical, for the filters row. */
export function categories(kind: Kind): string[] {
  const seen = new Set<string>();
  LIBRARY[kind].forEach((e) => e.labels.forEach((l) => seen.add(l)));
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function counts() {
  return {
    game: LIBRARY.game.length,
    app: LIBRARY.app.length,
    proxy: LIBRARY.proxy.length,
  };
}

export type SortId = "az" | "za" | "new" | "random";

export const SORTS: { id: SortId; name: string }[] = [
  { id: "az", name: "A to Z" },
  { id: "za", name: "Z to A" },
  { id: "new", name: "Recently added" },
  { id: "random", name: "Shuffled" },
];

/** Filter + sort in one pass. The search matches the name and every label,
 *  which is why categories are searchable without being printed on a card. */
export function browse(
  kind: Kind,
  opts: { q?: string; sort?: SortId; onlyIds?: string[]; seed?: number },
): Entry[] {
  const q = (opts.q ?? "").trim().toLowerCase();
  const sort = opts.sort ?? "az";
  let list = LIBRARY[kind].slice();

  if (opts.onlyIds) {
    const set = new Set(opts.onlyIds);
    list = list.filter((e) => set.has(e.id));
  }
  if (q) {
    list = list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.id.includes(q) ||
        e.labels.some((l) => l.toLowerCase().includes(q)),
    );
  }

  if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "za") list.sort((a, b) => b.name.localeCompare(a.name));
  else if (sort === "random") list = shuffled(list, opts.seed ?? 7);

  return list;
}

function shuffled<T>(list: T[], seed: number): T[] {
  const out = list.slice();
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
