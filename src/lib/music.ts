/* NULL · music.ts
   The music engine: what plays, what is queued, what has been kept.

   NULL does not load the shops. It asks them for tracks and plays the stream
   they hand back, which is why nothing here embeds a site.

   The source that matters is Audius, and it is the default for one reason:
   it is the only catalogue here that answers a browser directly AND hands
   back the whole track. Its API sends `access-control-allow-origin: *`, it
   needs no key of any kind, and its stream endpoint 302s to the real file —
   which an <audio> element is allowed to follow cross-origin without CORS,
   because media is not a fetch. That is the difference between a player and
   a sample player.

   The other three are wired to the backend instead. A browser can only call
   a service that sends CORS headers, and none of them do: SoundCloud's API
   answers 401 to a browser, Qobuz wants an app id and still sends no
   allow-origin, and YouTube Music has no unauthenticated API at all. Fill in
   a key and the Convex action asks on your behalf. Qobuz without a
   subscriber token still only hands back previews, which the page admits.
   Apple's index is the last resort: real audio, thirty seconds each. */

import { cloud } from "./cloud";
import { api } from "../../convex/_generated/api";
import { createStore, useStore } from "./store";

export type SourceId = "audius" | "qobuz" | "soundcloud" | "ytmusic" | "keyless";

export type Track = {
  /** source:id, which is what a playlist stores */
  key: string;
  id: string;
  source: SourceId;
  title: string;
  artist: string;
  album: string;
  art: string | null;
  /** the stream. Without one the row is searchable but silent. */
  audio: string | null;
  seconds: number;
  explicit: boolean;
};

export type Playlist = {
  id: string;
  name: string;
  at: number;
  tracks: Track[];
};

export const SOURCES: {
  id: SourceId;
  name: string;
  /** what the source is for, printed under the picker */
  note: string;
  /** the name of the key it wants, or null when it needs none */
  keyLabel: string | null;
  placeholder: string;
}[] = [
  {
    id: "audius",
    name: "Audius",
    note: "Full tracks, no key, no server — the catalogue NULL plays out of the box. Every row here is the whole song.",
    keyLabel: null,
    placeholder: "",
  },
  {
    id: "qobuz",
    name: "Qobuz",
    note: "Lossless catalogue. Ask for format 27 and it answers with FLAC when the key is a subscriber's; a plain app id is only entitled to previews, and the page says so when it gets one. The id can be typed here or set once as QOBUZ_APP_ID on the deployment.",
    keyLabel: "app id",
    placeholder: "your-qobuz-app-id",
  },
  {
    id: "soundcloud",
    name: "SoundCloud",
    note: "Everything anyone has uploaded, in full. It needs a client id — type it here or set SOUNDCLOUD_CLIENT_ID on the deployment.",
    keyLabel: "client id",
    placeholder: "your-soundcloud-client-id",
  },
  {
    id: "ytmusic",
    name: "YouTube Music",
    note: "Search works with a key (here, or YOUTUBE_API_KEY on the deployment), but YouTube hands back no audio stream, so its rows play nowhere — the page says so rather than leaving a silent button.",
    keyLabel: "api key",
    placeholder: "your-youtube-data-api-key",
  },
  {
    id: "keyless",
    name: "Apple previews",
    note: "No key needed, but Apple only gives thirty seconds of each track, so this one is a fallback rather than a source. Audius is where the full songs are.",
    keyLabel: null,
    placeholder: "",
  },
];

export type Music = {
  source: SourceId;
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
  source: "audius",
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

/* Anyone who used NULL before Audius was here is still pointing at Qobuz with
   no key, which is exactly the thirty-second previews they complained about.
   Only that exact combination is moved, so a key someone typed or a source
   they chose on purpose is left alone. */
(function migrateSource() {
  const s = music.get();
  if (s.source === "qobuz" && !s.keys.qobuz) music.set({ source: "audius" });
})();

/* ============================================================
   the catalogue
   ============================================================ */

type ITunesTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  trackExplicitness?: string;
};

/* ---------- Audius ----------
   Two nodes, because a discovery node is run by whoever feels like it. The
   first is the long-standing public one; the second is the official proxy,
   which is what the web player itself falls back to. */
const NODES = ["https://discoveryprovider.audius.co", "https://api.audius.co"];
/* Audius asks apps to identify themselves. It is not a key: it is a name, and
   it is the whole of the registration. */
const APP = "null-hub";

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
async function askNode(node: string, term: string): Promise<AudiusTrack[] | null> {
  try {
    const res = await fetch(
      `${node}/v1/tracks/search?query=${encodeURIComponent(term)}&app_name=${APP}&limit=25`,
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

/** Search Audius and build the stream URL for every row. */
async function searchAudius(term: string): Promise<Reach> {
  const notes: string[] = [];
  let answered = false;
  let gated = false;

  for (const q of attempts(term)) {
    for (const node of NODES) {
      const rows = await askNode(node, q);
      if (rows === null) {
        notes.push(`the node at ${hostOf(node)} did not answer`);
        continue;
      }
      answered = true;
      /* gated tracks come back unstreamable, and a silent row is worse than
         no row — but if that is all there is, say so rather than "nothing" */
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

/** Apple's public search index, the fallback: it sends
 *  `access-control-allow-origin: *` and hands back a real 30-second stream
 *  per track. */
async function searchKeyless(q: string): Promise<Track[]> {
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=25&term=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`the catalogue answered ${res.status}`);
  const body = (await res.json()) as { results?: ITunesTrack[] };
  return (body.results ?? []).map((t) => ({
    key: `keyless:${t.trackId}`,
    id: String(t.trackId),
    source: "keyless" as const,
    title: t.trackName,
    artist: t.artistName,
    album: t.collectionName ?? "",
    art: t.artworkUrl100 ? t.artworkUrl100.replace("100x100bb", "600x600bb") : null,
    audio: t.previewUrl ?? null,
    seconds: Math.round((t.trackTimeMillis ?? 0) / 1000),
    explicit: t.trackExplicitness === "explicit",
  }));
}

/* The three named sources need a key *and* a server: their APIs do not answer
   a browser at all. Until the backend is told a key, asking one of them
   searches the keyless catalogue instead, and says so. */
const NEEDS_SERVER: SourceId[] = ["qobuz", "soundcloud", "ytmusic"];

export type Found = { tracks: Track[]; note: string | null };

export async function search(q: string, source: SourceId): Promise<Found> {
  const term = q.trim();
  if (!term) return { tracks: [], note: null };

  /* Audius first and directly: no server sits in this path, so it works on a
     static deploy with no configuration at all. If it has nothing that plays,
     the previews catalogue catches the fall, and the note says which of the
     two things happened instead of blaming the node for both. */
  if (source === "audius") {
    const reach = await searchAudius(term);
    if (reach.tracks.length) return { tracks: reach.tracks, note: null };

    const previews = "These are Apple previews, so they stop at thirty seconds.";
    const note =
      reach.how === "gated"
        ? `Every match Audius has for “${reach.detail}” is gated, so none of them will play. ${previews}`
        : reach.how === "none"
          ? `Audius has nothing for “${reach.detail}”. ${previews}`
          : `Audius could not be reached (${reach.detail}). ${previews}`;

    try {
      return { tracks: await searchKeyless(term), note };
    } catch {
      return { tracks: [], note };
    }
  }

  if (NEEDS_SERVER.includes(source)) {
    const named = SOURCES.find((s) => s.id === source);
    const key = music.get().keys[source] ?? "";
    /* The server is asked either way: a key typed on this page is one way in,
       but the deployment's own environment is the better one, and only the
       action can read it. An empty key means "use whatever the deployment
       has", not "do not ask". */
    try {
      const found = await searchServer(source, term, key);
      if (found.tracks.length || found.note === null) {
        return { tracks: found.tracks, note: found.note ?? (found.tracks.length ? null : `${named?.name} had nothing for that.`) };
      }
      throw new Error(found.note);
    } catch (e) {
      const why = (e as Error).message;
      const tracks = await searchKeyless(term);
      return {
        tracks,
        note: `${named?.name} could not be asked (${why}). These are keyless results, and they play.`,
      };
    }
  }

  return { tracks: await searchKeyless(term), note: null };
}

/** Ask the source itself, through the action that can reach it. A browser
 *  cannot make these calls — the catalogues send no CORS headers — which is
 *  the whole reason there is a server. `convex/music.ts` does the work and
 *  returns the tracks plus, when something is only half-possible (a preview
 *  instead of a full track, or a catalogue with no stream to hand back), a
 *  sentence saying which.
 *
 *  This used to POST to a made-up `/api/action` path, which 404s, so every
 *  keyed source quietly fell through to Apple previews no matter what key was
 *  set. The Convex client is the way to reach an action; there is no second
 *  way and there never was. */
async function searchServer(
  source: SourceId,
  q: string,
  key: string,
): Promise<{ tracks: Track[]; note: string | null }> {
  const c = cloud();
  if (!c) throw new Error("no backend is configured for this build");
  const out = (await c.action(api.music.search, { source, q, key })) as {
    tracks?: Track[];
    note?: string | null;
  };
  return { tracks: out.tracks ?? [], note: out.note ?? null };
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
      problem: t ? `${t.title} would not stream. Paid and DRM tracks do this.` : null,
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
  if (!track.audio) {
    a.pause();
    a.removeAttribute("src");
    music.set({ playing: false, problem: `${track.title} came back without a stream, so there is nothing to play.` });
    return;
  }
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

export function setSource(source: SourceId) {
  music.set({ source });
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

/** mm:ss, and an em dash when the length is not known yet. */
export function clock(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
