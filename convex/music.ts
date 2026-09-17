/* NULL · music.ts (server)
   The half of the music page a browser cannot do itself.

   Qobuz, SoundCloud and YouTube all answer with no CORS headers, and two of
   them want a key that must not ship to a client. So the browser asks this
   action, this action asks the catalogue, and the stream URL comes back as
   plain JSON the player already knows how to play.

   Keys come from either place: the field on the music page, or the deployment
   environment (`npx convex env set QOBUZ_APP_ID …`). The environment is the
   one to use — a key typed into a page lives in that one browser's storage,
   an environment key works for everyone who visits.

   The one honest gap: YouTube's Data API hands back a video id and nothing
   playable. Those rows come back searchable and silent, with a note, rather
   than pretending. Qobuz and SoundCloud return real streams. */

"use node";

/* the Node runtime, because these actions read the deployment's environment
   variables and do three or four sequential fetches each — both things the
   default isolate runtime is worse at */

import { action } from "./_generated/server";
import { v } from "convex/values";

const UA = "null/1.0 (+https://github.com/googleslides2026)";

type Track = {
  key: string;
  id: string;
  source: "qobuz" | "soundcloud" | "ytmusic";
  title: string;
  artist: string;
  album: string;
  art: string | null;
  audio: string | null;
  seconds: number;
  explicit: boolean;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json", "user-agent": UA } });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
  return (await res.json()) as T;
}

/* ---------- Qobuz ---------- */

type QobuzTrack = {
  id: number;
  title?: string;
  duration?: number;
  parental_warning?: boolean;
  performer?: { name?: string };
  album?: { title?: string; image?: { large?: string; small?: string } };
};

/** The catalogue entry, then the file behind it. Qobuz signs the file request
 *  for a subscriber; without one it still answers, and says `sample: true` on
 *  the answer. That flag is what tells the page whether it is about to play
 *  the whole track or the sleeve notes. */
async function qobuzFile(id: number, appId: string): Promise<{ url: string | null; sample: boolean }> {
  /* 27 is 24-bit FLAC, 6 is 16-bit FLAC, 5 is MP3 320. Ask for the best and
     walk down: which of the three a key is entitled to is Qobuz's business. */
  for (const format of [27, 6, 5]) {
    try {
      const body = await getJson<{ url?: string; sample?: boolean }>(
        `https://www.qobuz.com/api.json/0.2/track/get/file?track_id=${id}&format_id=${format}&app_id=${encodeURIComponent(appId)}&request_ts=${Math.floor(Date.now() / 1000)}`,
      );
      if (body.url) return { url: body.url, sample: body.sample === true };
    } catch {
      /* try the next format */
    }
  }
  return { url: null, sample: false };
}

async function qobuz(q: string, key: string) {
  const appId = key || process.env.QOBUZ_APP_ID || "";
  if (!appId) throw new Error("Qobuz needs its app id (Settings → Music, or QOBUZ_APP_ID on the deployment)");
  const body = await getJson<{ tracks?: { items?: QobuzTrack[] } }>(
    `https://www.qobuz.com/api.json/0.2/catalog/search?query=${encodeURIComponent(q)}&limit=20&app_id=${encodeURIComponent(appId)}`,
  );
  const items = body.tracks?.items ?? [];
  const tracks: Track[] = [];
  let sampled = 0;
  for (const t of items) {
    const file = await qobuzFile(t.id, appId);
    if (file.sample) sampled++;
    tracks.push({
      key: `qobuz:${t.id}`,
      id: String(t.id),
      source: "qobuz",
      title: t.title ?? "Untitled",
      artist: t.performer?.name ?? "Unknown artist",
      album: t.album?.title ?? "",
      art: t.album?.image?.large ?? t.album?.image?.small ?? null,
      audio: file.url,
      seconds: Math.round(t.duration ?? 0),
      explicit: t.parental_warning === true,
    });
  }
  return {
    tracks,
    note: sampled
      ? "Qobuz answered with previews: full and lossless playback needs a subscriber token, which a plain app id is not."
      : null,
  };
}

/* ---------- SoundCloud ---------- */

type SCTrack = {
  id: number;
  title?: string;
  duration?: number;
  artwork_url?: string | null;
  user?: { username?: string };
  policy?: string | null;
  media?: { transcodings?: { url: string; format?: { protocol?: string; mime_type?: string } }[] };
};

async function scStream(t: SCTrack, clientId: string): Promise<string | null> {
  const list = t.media?.transcodings ?? [];
  const pick =
    list.find((x) => x.format?.protocol === "progressive" && x.format?.mime_type === "audio/mpeg") ??
    list.find((x) => x.format?.protocol === "progressive") ??
    list.find((x) => x.format?.protocol === "hls");
  if (!pick) return null;
  try {
    const body = await getJson<{ url?: string }>(`${pick.url}?client_id=${encodeURIComponent(clientId)}`);
    return body.url ?? null;
  } catch {
    return null;
  }
}

async function soundcloud(q: string, key: string) {
  const clientId = key || process.env.SOUNDCLOUD_CLIENT_ID || "";
  if (!clientId) throw new Error("SoundCloud needs its client id (Settings → Music, or SOUNDCLOUD_CLIENT_ID)");
  const body = await getJson<{ collection?: SCTrack[] }>(
    `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(q)}&client_id=${encodeURIComponent(clientId)}&limit=20&app_locale=en`,
  );
  const items = body.collection ?? [];
  const tracks: Track[] = [];
  for (const t of items) {
    tracks.push({
      key: `soundcloud:${t.id}`,
      id: String(t.id),
      source: "soundcloud",
      title: t.title ?? "Untitled",
      artist: t.user?.username ?? "Unknown artist",
      album: "",
      art: t.artwork_url ? t.artwork_url.replace("-large", "-t500x500") : null,
      audio: await scStream(t, clientId),
      seconds: Math.round((t.duration ?? 0) / 1000),
      explicit: t.policy === "SNIP" || t.policy === "BLOCK",
    });
  }
  return { tracks, note: null };
}

/* ---------- YouTube Music ---------- */

type YTItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
  };
};

async function ytmusic(q: string, key: string) {
  const apiKey = key || process.env.YOUTUBE_API_KEY || "";
  if (!apiKey) throw new Error("YouTube Music needs an API key (Settings → Music, or YOUTUBE_API_KEY)");
  const body = await getJson<{ items?: YTItem[] }>(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=20&q=${encodeURIComponent(q)}&key=${encodeURIComponent(apiKey)}`,
  );
  const tracks: Track[] = (body.items ?? [])
    .filter((i) => i.id?.videoId)
    .map((i) => ({
      key: `ytmusic:${i.id?.videoId}`,
      id: String(i.id?.videoId),
      source: "ytmusic" as const,
      title: (i.snippet?.title ?? "Untitled").replace(/&amp;/g, "&").replace(/&quot;/g, '"'),
      artist: i.snippet?.channelTitle ?? "Unknown artist",
      album: "",
      art: i.snippet?.thumbnails?.high?.url ?? i.snippet?.thumbnails?.medium?.url ?? null,
      audio: null,
      seconds: 0,
      explicit: false,
    }));
  return {
    tracks,
    note: "YouTube's API returns a video id and no audio stream, so these are searchable but silent here.",
  };
}

/* ---------- the door ---------- */

export const search = action({
  args: { source: v.string(), q: v.string(), key: v.optional(v.string()) },
  handler: async (_ctx, args) => {
    const q = (args.q ?? "").trim();
    if (!q) return { tracks: [], note: null };
    const key = (args.key ?? "").trim();
    try {
      if (args.source === "qobuz") return await qobuz(q, key);
      if (args.source === "soundcloud") return await soundcloud(q, key);
      if (args.source === "ytmusic") return await ytmusic(q, key);
      return { tracks: [], note: `NULL has no server route for ${args.source}.` };
    } catch (e) {
      return { tracks: [], note: (e as Error).message };
    }
  },
});
