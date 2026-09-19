/* NULL · gifs.ts
   The GIF shelf behind the composer's film button.

   The shelf works on every deployment with nothing set at all: the search
   goes out with Giphy's public beta key, which is what Giphy's own docs hand
   to tinkerers and what every open-source GIF picker ships with. It is
   rate-limited rather than secret, so it is not treated as one — it lives
   here in the open, and a deployment that wants its own quota puts
   GIPHY_API_KEY (or GIF_API_KEY, for the name the first version used) in the
   environment, and that key is used instead.

   An API key cannot live in a page bundle, so the search happens here and
   the browser only ever sees a list of URLs. Until now a deployment with no
   key said so instead of showing a shelf; with the public key the shelf
   fills itself in, and the `ready` flag exists so an old client can still
   ask whether searching is possible at all. */

import { v } from "convex/values";

import { action, query } from "./_generated/server";

/** The deployment's own key first, then the public beta key, which is what
 *  makes the shelf work with nothing configured. */
const PUBLIC_KEY = "GlVGYHkr3WSBnllca54iNt0yFbjz7L65";
const KEY = () => (process.env.GIPHY_API_KEY || process.env.GIF_API_KEY || PUBLIC_KEY).trim();

/** Whether this deployment can search at all, so an old panel can say why not. */
export const ready = query({
  args: {},
  handler: async () => !!KEY(),
});

type Shot = {
  id: string;
  /** what gets stored on the message — a URL, never the file */
  full: string;
  /** the small one the grid draws */
  thumb: string;
  w: number;
  h: number;
  title: string;
};

/** Giphy's payload, thinned down. The variants are tried in order because a
 *  few creations are missing the size somebody would have picked. */
function shape(rows: any[]): Shot[] {
  const out: Shot[] = [];
  for (const g of rows ?? []) {
    const im = g?.images ?? {};
    const full = im.downsized_medium?.url || im.fixed_height?.url || im.original?.url;
    const thumb = im.fixed_height_small?.url || im.fixed_width_small?.url || im.preview_gif?.url || full;
    if (!g?.id || !full || !thumb) continue;
    out.push({
      id: String(g.id),
      full: String(full),
      thumb: String(thumb),
      w: Number(im.downsized_medium?.width ?? im.fixed_height?.width ?? 0) || 200,
      h: Number(im.downsized_medium?.height ?? im.fixed_height?.height ?? 0) || 200,
      title: String(g.title ?? "").slice(0, 90),
    });
  }
  return out;
}

async function ask(path: string, params: Record<string, string>) {
  const url = new URL(`https://api.giphy.com/v1/${path}`);
  url.searchParams.set("api_key", KEY());
  url.searchParams.set("rating", "pg-13");
  url.searchParams.set("limit", "30");
  for (const [k, val] of Object.entries(params)) url.searchParams.set(k, val);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { gifs: [] as Shot[], error: `Giphy said ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}.` };
  }
  const json = (await res.json()) as { data?: any[] };
  return { gifs: shape(json.data ?? []), error: null as string | null };
}

/** Search Giphy. An empty query is the trending shelf, which is what the panel
 *  opens on. */
export const find = action({
  args: { q: v.string() },
  handler: async (_ctx, { q }) => {
    if (!KEY()) {
      return { gifs: [] as Shot[], error: "No GIF key on this deployment — add GIPHY_API_KEY to search." };
    }
    const query = q.trim();
    if (!query) return await ask("gifs/trending", {});
    return await ask("gifs/search", { q: query });
  },
});

/** Stickers: transparent GIFs, the same engine with a different shelf. */
export const stickers = action({
  args: { q: v.string() },
  handler: async (_ctx, { q }) => {
    if (!KEY()) return { gifs: [] as Shot[], error: null };
    const query = q.trim();
    if (!query) return await ask("stickers/trending", {});
    return await ask("stickers/search", { q: query });
  },
});
