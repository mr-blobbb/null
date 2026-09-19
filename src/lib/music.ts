/* NULL · music.ts
   The music engine: what plays, what is queued, what has been kept.

   One rule above everything: a row here is the whole song. Every source that
   could only offer a thirty-second slice of somebody's track has been taken
   off the panel — a grid of previews is a slower way of not listening.

   So a search asks the catalogues that answer a browser directly, want no
   key of any kind, and hand back complete files, and it asks all of them at
   once:

   · Audius — the whole streamed catalogue, full tracks, its stream endpoint
     302s to the real file, which an <audio> element may follow cross-origin
     because media is not a fetch. It sends `access-control-allow-origin: *`.
   · the Internet Archive — live shows, radio plays, classical, netlabels,
     records nobody else kept, all full MP3s, also CORS-open, and one of the
     few hosts a school filter usually leaves alone.

   Two more join in when the deployment has been given keys: SoundCloud and
   Qobuz cannot be called from a browser at all, so the backend asks them —
   and only their full-length rows are kept, the gated and sample ones are
   dropped before the grid ever sees them.

   Results are pages: page 0 is the first screenful from every catalogue,
   page 1 the next, and so on, which is what the More button under the grid
   asks for. NULL does not load the shops. It asks them for tracks and plays
   the stream they hand back, which is why nothing here embeds a site. */

import { cloud } from "./cloud";
import { api } from "../../convex/_generated/api";
import { createStore, useStore } from "./store";

export type SourceId = "audius" | "archive" | "soundcloud" | "qobuz";

export type Track = {
  /** source:id, which is what a playlist stores */
  key: string;
  id: string;
  source: SourceId;
  title: string;
  artist: string;
  album: string;
  art: string | null;
  /** the stream. Without one the row is not shown — a silent tile is not a song. */
  audio: string;
  seconds: number;
  explicit: boolean;
};

export type Playlist = {
  id: string;
  name: string;
  at: number;
  tracks: Track[];
};

/** What the keyed sources are called, for the row that explains them. */
export const SERVER_SOURCES: { id: SourceId; name: string; keyLabel: string; placeholder: string; env: string }[] = [
  {
    id: "soundcloud",
    name: "SoundCloud",
    keyLabel: "client id",
    placeholder: "your-soundcloud-client-id",
    env: "SOUNDCLOUD_CLIENT_ID",
  },
  {
    id: "qobuz",
    name: "Qobuz",
    keyLabel: "app id",
    placeholder: "your-qobuz-app-id",
    env: "QOBUZ_APP_ID",
  },
];

export type Music = {
  keys: Partial<Record<SourceId, string>>;
  favorites: Track[];
  playlists: Playlist[];
  recent: Track[];
  /** the play order, which is what shuffle rewrites */
  queue: Track[];
  /** the untouched order, so shuffle can be undone */
  order: Track[];
  index: number;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  volume: number;
  playing: boolean;
  at: number;
  duration: number;
  now: Track | null;
  /** the last thing that went wrong, in words */
  problem: string | null;
};

const EMPTY: Music = {
  keys: {},
  favorites: [],
  playlists: [],
  recent: [],
  queue: [],
  order: [],
  index: -1,
  shuffle: false,
  repeat: "off",
  volume: 0.8,
  playing: false,
  at: 0,
  duration: 0,
  now: null,
  problem: null,
};

export const music = createStore<Music>("music", EMPTY);

export function useMusic(): Music {
  return useStore(music);
}

/* ---------- old shelves, tidied on the way in ----------

   Rows kept before the previews were taken off the page still point at
   thirty-second files. They are dropped here, once: a library that says
   "full songs only" does not keep a hidden shelf of the other kind. Saved
   tracks from sources that no longer exist come back the same way. */
(function tidyShelf() {
  const s = music.get();
  const real = (t: Track | undefined): t is Track => !!t?.key && !!t.audio && !/mzstatic|itunes\.apple\.com/.test(t.audio);
  const favorites = s.favorites.filter(real);
  const recent = s.recent.filter(real);
  const queue = s.queue.filter(real);
  const playlists = s.playlists.map((p) => ({ ...p, tracks: (p.tracks ?? []).filter(real) }));
  if (
    favorites.length !== s.favorites.length ||
    recent.length !== s.recent.length ||
    queue.length !== s.queue.length ||
    playlists.some((p, i) => p.tracks.length !== s.playlists[i]?.tracks.length)
  ) {
    music.set({ favorites, recent, queue, playlists });
  }
})();

/* ============================================================
   the catalogues
   ============================================================ */

/* ---------- Audius ----------
   Two nodes, because a discovery node is run by whoever feels like it. The
   first is the long-standing public one; the second is the official proxy,
   which is what the web player itself falls back to. */
const NODES = ["https://discoveryprovider.audius.co", "https://api.audius.co"];
/* Audius asks apps to identify themselves. It is not a key: it is a name, and
   it is the whole of the registration. */
const APP = "null-hub";
/** How many rows one page of the grid takes from Audius. */
const AUDIUS_PAGE = 24;

type AudiusTrack = {
  id?: string;
  title?: string;
  duration?: number;
  genre?: string;
  is_streamable?: boolean;
  artwork?: Record<string, string> | null;
  user?: { name?: string; handle?: string } | null;
};

/** What a look through Audius came back as. `none` and `gated` are answers —
 *  the catalogue knew and had nothing that plays — and only `down` is a
 *  failure. Reporting all three as "could not be reached" was both wrong and
 *  the reason a missing song looked like a broken node. */
type Reach = { tracks: Track[]; how: "ok" | "none" | "gated" | "down"; detail: string };

/** Other ways of asking the same thing, in the order they are tried. Audius
 *  matches titles, so "song name artist name" can come back empty where
 *  "song name" finds it. Three tries at most, because each one is a request. */
function attempts(term: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const t = s.trim().replace(/\s+/g, " ");
    if (t.length > 1 && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  };
  add(term);
  const words = term.split(/\s+/).filter(Boolean);
  if (words.length > 2) add(words.slice(0, 3).join(" "));
  if (words.length > 1) add(words.slice(0, 2).join(" "));
  return out.slice(0, 3);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** One node, one query. `null` means the node could not be asked at all, which
 *  is a different thing from a node that answered with nothing. */
async function askNode(node: string, term: string, offset: number): Promise<AudiusTrack[] | null> {
  try {
    const res = await fetch(
      `${node}/v1/tracks/search?query=${encodeURIComponent(term)}&app_name=${APP}&limit=${AUDIUS_PAGE}&offset=${offset}`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: AudiusTrack[] };
    return body.data ?? [];
  } catch {
    return null;
  }
}

/** A row as the player wants it. The stream endpoint is a redirect to the file
 *  itself, which is why the audio plays at full length in an ordinary
 *  <audio> tag. */
function rowOf(node: string, t: AudiusTrack): Track {
  return {
    key: `audius:${t.id}`,
    id: String(t.id),
    source: "audius" as const,
    title: t.title || "Untitled",
    artist: t.user?.name || t.user?.handle || "Unknown artist",
    album: t.genre ?? "",
    art: t.artwork?.["480x480"] ?? t.artwork?.["150x150"] ?? null,
    audio: `${node}/v1/tracks/${t.id}/stream?app_name=${APP}`,
    seconds: Math.round(t.duration ?? 0),
    explicit: false,
  };
}

/** Search Audius — one page of it. Gated tracks come back unstreamable and a
 *  silent tile is worse than no tile, so they never become rows. */
async function searchAudius(term: string, page: number): Promise<Reach> {
  const notes: string[] = [];
  let answered = false;
  let gated = false;

  for (const q of attempts(term)) {
    for (const node of NODES) {
      const rows = await askNode(node, q, page * AUDIUS_PAGE);
      if (rows === null) {
        notes.push(`the node at ${hostOf(node)} did not answer`);
        continue;
      }
      answered = true;
      const playable = rows.filter((t) => t.id && t.is_streamable !== false);
      if (playable.length) {
        return { tracks: playable.map((t) => rowOf(node, t)), how: "ok", detail: q };
      }
      if (rows.length) gated = true;
    }
  }

  if (!answered) return { tracks: [], how: "down", detail: notes[0] ?? "nothing answered" };
  if (gated) return { tracks: [], how: "gated", detail: term };
  return { tracks: [], how: "none", detail: term };
}

/* ---------- the Internet Archive ----------
   The other catalogue that answers a browser directly and hands back whole
   tracks. It is a *collection* rather than a shelf: one item is a show, an
   album or a series, and its tracks are the files inside it. So a page of
   the grid is built out of the items the search found, best-downloaded
   first, which is why this is the only catalogue here that makes more than
   one request per page. */
const ARC = "https://archive.org";
/** How many items a page opens, and how many tracks are taken from each. */
const ARC_ITEMS = 6;
const ARC_TRACKS = 6;

/** "07 - Basin Street Blues.mp3" -> "Basin Street Blues" */
function trackName(file: string): string {
  return (
    file
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/^\s*(\(?\d{1,3}\)?)\s*[-.)]?\s*/, "")
      .replace(/_/g, " ")
      .trim() || file
  );
}

/** A page of Archive items, as raw search rows. */
type ArcDoc = { identifier: string; title?: string; creator?: string | string[] };

async function archiveItems(term: string, page: number): Promise<ArcDoc[]> {
  const q = `${term} AND mediatype:(audio) AND format:("VBR MP3")`;
  const url =
    `${ARC}/advancedsearch.php?q=${encodeURIComponent(q)}` +
    "&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator" +
    `&rows=${ARC_ITEMS}&page=${page + 1}&output=json&sort%5B%5D=downloads+desc`;
  const found = (await (await fetch(url)).json()) as { response?: { docs?: ArcDoc[] } };
  return found.response?.docs ?? [];
}

async function searchArchive(term: string, page: number): Promise<Track[]> {
  const items = await archiveItems(term, page);
  /* asked together rather than one after the other: six items in series is
     six round trips before the first row appears */
  const opened = await Promise.all(
    items.map(async (item) => {
      try {
        const meta = (await (await fetch(`${ARC}/metadata/${item.identifier}`)).json()) as {
          files?: { name?: string; format?: string; source?: string }[];
        };
        const files = (meta.files ?? []).filter(
          (f) => /\.mp3$/i.test(f.name ?? "") && f.format !== "Metadata",
        );
        return { item, files };
      } catch {
        return { item, files: [] };
      }
    }),
  );

  const rows: Track[] = [];
  for (const { item, files } of opened) {
    const creator = Array.isArray(item.creator) ? item.creator[0] : item.creator;
    for (const file of files.slice(0, ARC_TRACKS)) {
      const name = file.name ?? "";
      rows.push({
        key: `archive:${item.identifier}/${name}`,
        id: `${item.identifier}/${name}`,
        source: "archive" as const,
        title: trackName(name),
        artist: creator || "Internet Archive",
        album: item.title ?? item.identifier,
        art: `${ARC}/services/img/${item.identifier}`,
        audio: `${ARC}/download/${item.identifier}/${encodeURIComponent(name)}`,
        /* the Archive writes a duration on some files and not others, and the
           player learns the real one when it starts playing anyway */
        seconds: 0,
        explicit: false,
      });
    }
  }
  return rows;
}

/* ---------- the keyed sources ----------
   Their APIs do not answer a browser, so the backend asks. The action drops
   previews and gated tracks on its side; the page keeps only rows that
   arrived with a stream, which by then is every row. */
const KEYED: SourceId[] = ["soundcloud", "qobuz"];

async function searchServer(source: SourceId, q: string, page: number, key: string): Promise<Track[]> {
  const c = cloud();
  if (!c) return [];
  const out = (await c.action(api.music.search, { source, q, key, offset: page * 20 })) as {
    tracks?: Track[];
  };
  return (out.tracks ?? []).filter((t) => !!t.audio);
}

/* ============================================================
   one search, every catalogue, one grid
   ============================================================ */

export type Found = { tracks: Track[]; note: string | null };

/** Two rows are the same song when the words match. The catalogue order is
 *  the preference order, so the first copy found is the one kept. */
function sameSong(a: Track, b: Track): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  return norm(a.title) === norm(b.title) && norm(a.artist) === norm(b.artist);
}

/** Page `page` of the merged results for `q`. Both keyless catalogues are
 *  asked at once, and the keyed ones join the same race when the deployment
 *  has a key for them — the grid is one list, not four. */
export async function search(q: string, page: number, server: boolean): Promise<Found> {
  const term = q.trim();
  if (!term) return { tracks: [], note: null };

  const keys = music.get().keys;
  const jobs: Promise<Track[]>[] = [
    searchAudius(term, page).then((r) => r.tracks, () => []),
    searchArchive(term, page).catch(() => []),
  ];
  if (server) {
    for (const s of KEYED) {
      const key = keys[s] ?? "";
      jobs.push(searchServer(s, term, page, key).catch(() => []));
    }
  }

  const settled = await Promise.allSettled(jobs);
  const merged: Track[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const t of r.value) {
      if (!merged.some((x) => sameSong(x, t))) merged.push(t);
    }
  }

  if (merged.length) return { tracks: merged, note: null };
  return {
    tracks: [],
    note: `Nothing full-length came back for “${term}”. The whole catalogue was asked, not just part of it.`,
  };
}

/* ============================================================
   playback
   ============================================================ */

let el: HTMLAudioElement | null = null;

function audio(): HTMLAudioElement {
  if (el) return el;
  const a = new Audio();
  a.preload = "metadata";
  a.volume = music.get().volume;
  a.addEventListener("timeupdate", () => music.set({ at: a.currentTime }));
  a.addEventListener("durationchange", () => music.set({ duration: Number.isFinite(a.duration) ? a.duration : 0 }));
  a.addEventListener("play", () => music.set({ playing: true }));
  a.addEventListener("pause", () => music.set({ playing: false }));
  a.addEventListener("ended", () => step(1, true));
  a.addEventListener("error", () => {
    const t = music.get().now;
    music.set({
      playing: false,
      problem: t ? `${t.title} would not stream. The file may have moved; try the next one.` : null,
    });
  });
  el = a;
  return a;
}

/** Load a track into the player, optionally with the list it came from. */
export function play(track: Track, list?: Track[]) {
  const s = music.get();
  const order = list && list.length ? [...list] : [...s.order];
  const queue = s.shuffle ? shuffled(order, track) : order;
  const index = queue.findIndex((t) => t.key === track.key);

  music.set({
    now: track,
    order,
    queue: queue.length ? queue : [track],
    index: index < 0 ? 0 : index,
    at: 0,
    duration: track.seconds || 0,
    problem: null,
    recent: [track, ...s.recent.filter((t) => t.key !== track.key)].slice(0, 30),
  });
  load(track);
}

function load(track: Track) {
  const a = audio();
  a.src = track.audio;
  a.play().catch(() => music.set({ playing: false }));
}

export function toggle() {
  const s = music.get();
  const a = audio();
  if (!s.now) {
    if (s.queue.length) play(s.queue[0]);
    return;
  }
  if (a.paused) a.play().catch(() => music.set({ playing: false }));
  else a.pause();
}

/** Move through the queue. `auto` means the track ended by itself, which is
 *  the one case repeat-one and repeat-all care about. */
export function step(dir: 1 | -1, auto = false) {
  const s = music.get();
  if (!s.queue.length) return;

  if (auto && s.repeat === "one" && s.now) {
    audio().currentTime = 0;
    audio().play().catch(() => music.set({ playing: false }));
    return;
  }

  const next = s.index + dir;
  if (next < 0) {
    music.set({ index: s.queue.length - 1 });
    load(s.queue[s.queue.length - 1]);
    return;
  }
  if (next >= s.queue.length) {
    if (!s.shuffle && s.repeat === "off") {
      audio().pause();
      music.set({ playing: false, at: 0 });
      return;
    }
    const queue = s.shuffle ? shuffled(s.order) : s.queue;
    music.set({ queue, index: 0 });
    load(queue[0]);
    return;
  }
  music.set({ index: next });
  load(s.queue[next]);
}

export function jumpTo(index: number) {
  const s = music.get();
  const track = s.queue[index];
  if (!track) return;
  music.set({ index });
  load(track);
}

export function seek(seconds: number) {
  const a = audio();
  if (!a.duration) return;
  a.currentTime = Math.min(Math.max(0, seconds), a.duration);
  music.set({ at: a.currentTime });
}

export function setVolume(v: number) {
  const volume = Math.min(Math.max(0, v), 1);
  audio().volume = volume;
  music.set({ volume });
}

export function setRepeat(repeat: Music["repeat"]) {
  music.set({ repeat });
}

/** Turning shuffle on rewrites the order with the current track first, so the
 *  song you are listening to does not change under you. Turning it off puts
 *  the list back the way it was. */
export function setShuffle(on: boolean) {
  const s = music.get();
  if (on) music.set({ shuffle: true, queue: shuffled(s.order, s.now ?? undefined), index: 0 });
  else music.set({ shuffle: false, queue: s.order, index: s.now ? Math.max(0, s.order.findIndex((t) => t.key === s.now?.key)) : 0 });
}

function shuffled(list: Track[], first?: Track): Track[] {
  const rest = list.filter((t) => t.key !== first?.key);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first ? [first, ...rest] : rest;
}

/** Queue something without interrupting what is playing. */
export function enqueue(track: Track) {
  const s = music.get();
  if (s.queue.some((t) => t.key === track.key)) return;
  music.set({ queue: [...s.queue, track], order: [...s.order, track] });
}

export function clearQueue() {
  music.set({ queue: [], order: [], index: -1, now: null, playing: false, at: 0, duration: 0 });
  audio().pause();
}

/** Everything at once: what is playing, the queue, the history, the kept
 *  tracks and every playlist. Keys survive, because they are how the
 *  catalogue is widened, not part of the library. */
export function clearMusic() {
  music.set({
    favorites: [],
    playlists: [],
    recent: [],
    queue: [],
    order: [],
    index: -1,
    now: null,
    playing: false,
    at: 0,
    duration: 0,
    problem: null,
  });
  audio().pause();
}

export function setKey(source: SourceId, key: string) {
  music.set({ keys: { ...music.get().keys, [source]: key } });
}

/* ============================================================
   keeping things
   ============================================================ */

export function isFavorite(key: string): boolean {
  return music.get().favorites.some((t) => t.key === key);
}

export function toggleFavorite(track: Track) {
  const s = music.get();
  music.set({
    favorites: s.favorites.some((t) => t.key === track.key)
      ? s.favorites.filter((t) => t.key !== track.key)
      : [track, ...s.favorites],
  });
}

export function newPlaylist(name: string): string {
  const id = `pl_${Math.random().toString(36).slice(2, 9)}`;
  const clean = name.trim() || "Untitled playlist";
  music.set({ playlists: [...music.get().playlists, { id, name: clean, at: Date.now(), tracks: [] }] });
  return id;
}

export function renamePlaylist(id: string, name: string) {
  const clean = name.trim();
  if (!clean) return;
  music.set({
    playlists: music.get().playlists.map((p) => (p.id === id ? { ...p, name: clean } : p)),
  });
}

export function deletePlaylist(id: string) {
  music.set({ playlists: music.get().playlists.filter((p) => p.id !== id) });
}

export function addToPlaylist(id: string, track: Track) {
  music.set({
    playlists: music.get().playlists.map((p) =>
      p.id === id && !p.tracks.some((t) => t.key === track.key) ? { ...p, tracks: [...p.tracks, track] } : p,
    ),
  });
}

export function removeFromPlaylist(id: string, trackKey: string) {
  music.set({
    playlists: music.get().playlists.map((p) =>
      p.id === id ? { ...p, tracks: p.tracks.filter((t) => t.key !== trackKey) } : p,
    ),
  });
}

export function playlistOf(id: string): Playlist | undefined {
  return music.get().playlists.find((p) => p.id === id);
}

/* ============================================================
   the library that follows you
   ============================================================

   Favourites and playlists were the last things here that only existed on
   one machine. They still do — the page reads this store and would play with
   no network at all — but a copy now lives on the server, under the handle
   that is signed in, and it is merged rather than overwritten.

   Merged, because two devices both have a right answer and neither is
   complete: the browser is where the heart was pressed and where the
   playlist was made, and the server is where the other machine left its
   half. A playlist that exists in both keeps every track either side had,
   which is the only rule that never loses a song. */

let syncUser: string | null = null;
let quiet = false;
let pending: number | null = null;

function key(user: string): string {
  return user.trim().replace(/^@/, "").toLowerCase();
}

/** Everything kept here, as the two lists the server stores. */
function shelfOf(): { favorites: Track[]; playlists: Playlist[] } {
  const s = music.get();
  return { favorites: s.favorites, playlists: s.playlists };
}

/** Two shelves, one shelf. Favourites by key, playlists by id, and the older
 *  date wins the name so the title does not flip about between machines. */
export function mergeShelf(
  a: { favorites: Track[]; playlists: Playlist[] },
  b: { favorites: Track[]; playlists: Playlist[] },
): { favorites: Track[]; playlists: Playlist[] } {
  const favorites: Track[] = [];
  for (const t of [...a.favorites, ...b.favorites]) {
    if (t?.key && !favorites.some((x) => x.key === t.key)) favorites.push(t);
  }

  const playlists: Playlist[] = [];
  for (const p of [...a.playlists, ...b.playlists]) {
    if (!p?.id) continue;
    const had = playlists.find((x) => x.id === p.id);
    if (!had) {
      /* a copy, not the row itself: the two halves get merged into it below */
      playlists.push({ ...p, tracks: [...(p.tracks ?? [])] });
      continue;
    }
    if (p.at < had.at) had.name = p.name;
    had.at = Math.min(had.at, p.at);
    for (const t of p.tracks ?? []) {
      if (t?.key && !had.tracks.some((x) => x.key === t.key)) had.tracks.push(t);
    }
  }
  return { favorites, playlists };
}

/** Take the copy down, and put back up whatever the two of them add up to. */
async function pull(who: string): Promise<void> {
  const c = cloud();
  if (!c) return;
  try {
    const row = (await c.query(api.social.tunes, { user: who })) as
      | { favorites: string; playlists: string }
      | null;
    const here = shelfOf();
    if (!row) {
      await c.mutation(api.social.saveTunes, {
        user: who,
        favorites: JSON.stringify(here.favorites),
        playlists: JSON.stringify(here.playlists),
      });
      return;
    }
    const theirs = {
      favorites: (JSON.parse(row.favorites) as Track[]) ?? [],
      playlists: (JSON.parse(row.playlists) as Playlist[]) ?? [],
    };
    const both = mergeShelf(here, theirs);
    quiet = true;
    music.set({ favorites: both.favorites, playlists: both.playlists });
    quiet = false;
    await c.mutation(api.social.saveTunes, {
      user: who,
      favorites: JSON.stringify(both.favorites),
      playlists: JSON.stringify(both.playlists),
    });
  } catch {
    /* the shelf on this machine is the whole truth when the server is quiet */
  }
}

/** Called by the shell: sign in and the library is shared, sign out and it
 *  stays on this machine. Every later change is pushed on a short delay, so
 *  pressing the heart ten times is one write. */
let wired = false;

export function watchLibrary(user: string | null) {
  const who = user ? key(user) : null;
  if (who === syncUser) return;
  syncUser = who;
  if (!who) return;
  void pull(who);
  if (wired) return;
  wired = true;

  music.subscribe(() => {
    if (quiet || !syncUser) return;
    if (pending) window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      const s = shelfOf();
      const c = cloud();
      if (!c || !syncUser) return;
      void c
        .mutation(api.social.saveTunes, {
          user: syncUser,
          favorites: JSON.stringify(s.favorites),
          playlists: JSON.stringify(s.playlists),
        })
        .catch(() => undefined);
    }, 1200);
  });
}

/** mm:ss, and an em dash when the length is not known yet. */
export function clock(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
