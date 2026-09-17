/* NULL · music.ts
   The music engine: what plays, what is queued, what has been kept.

   NULL does not load the shops. It asks them for tracks and plays the stream
   they hand back, which is why nothing here embeds a site.

   One honest note about the sources. A browser can only call a service that
   sends CORS headers, and the three named ones do not: SoundCloud's API
   answers 401 to a browser, Qobuz's catalogue wants an app id and still sends
   no allow-origin, and YouTube Music has no unauthenticated API at all. So the
   keyless catalogue below is what plays out of the box — it is a real
   catalogue with real audio, not a mock — and each of the three named sources
   is wired with its key field: fill a key in Settings and that source is
   asked first, through the backend that can reach it. */

import { cloudUrl } from "./cloud";
import { createStore, useStore } from "./store";

export type SourceId = "qobuz" | "soundcloud" | "ytmusic" | "keyless";

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
    id: "qobuz",
    name: "Qobuz",
    note: "Lossless catalogue. Ask for format 27 and it answers with FLAC; a plain app id only entitles you to previews, and the page says so when it gets one. The id can be typed here or set once as QOBUZ_APP_ID on the deployment.",
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
    name: "Keyless catalogue",
    note: "No key needed. Real tracks, thirty seconds each, plays right now.",
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
  source: "qobuz",
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

/** The keyless catalogue: Apple's public search index, which sends
 *  `access-control-allow-origin: *` and hands back a real 30-second stream
 *  per track. It is the only one of these a browser may call directly. */
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
 *  sentence saying which. */
async function searchServer(
  source: SourceId,
  q: string,
  key: string,
): Promise<{ tracks: Track[]; note: string | null }> {
  const url = serverUrl();
  if (!url) throw new Error("no backend is configured for this build");
  /* Convex's own HTTP API: an action runs where the network is. */
  const res = await fetch(`${url.replace(/\/$/, "")}/api/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: "music:search", args: { source, q, key }, format: "json" }),
  });
  if (!res.ok) throw new Error(`the backend answered ${res.status}`);
  const body = (await res.json()) as {
    value?: { tracks?: Track[]; note?: string | null };
    errorMessage?: string;
  };
  if (body.errorMessage) throw new Error(body.errorMessage);
  return { tracks: body.value?.tracks ?? [], note: body.value?.note ?? null };
}

/** Where the backend is. `VITE_CONVEX_URL` is what the Convex tooling writes
 *  into the environment; src/lib/cloud.ts holds the fallback so the music page
 *  and the chat page never disagree about where the server is. */
function serverUrl(): string | null {
  return cloudUrl;
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
