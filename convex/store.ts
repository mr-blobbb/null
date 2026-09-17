/* NULL · store.ts (server)
   Fetching a Chrome extension package on the browser's behalf.

   The Web Store's update endpoint sends no CORS headers, so a page cannot ask
   it for a .crx. A server can. This action pulls the package, puts it in
   Convex file storage, and hands back a URL — which *is* CORS-enabled, so the
   browser can then download its own copy and open it with src/lib/crx.ts.

   Nothing is inspected here and nothing is kept for long: the file is stored
   so the client can reach it, and the client unpacks it locally. */

"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function urlFor(id: string): string {
  const x = `id=${id}&uc`;
  return (
    "https://clients2.google.com/service/update2/crx?response=redirect" +
    "&os=linux&arch=x86-64&os_arch=x86-64&nacl_arch=x86-64" +
    "&prod=chromiumcrx&prodchannel=unknown&prodversion=124.0.0.0" +
    "&acceptformat=crx2,crx3" +
    `&x=${encodeURIComponent(x)}`
  );
}

export const pull = action({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const clean = id.trim().toLowerCase();
    if (!/^[a-p]{32}$/.test(clean)) {
      return { ok: false as const, reason: "that is not a Chrome extension id — they are 32 letters, a–p" };
    }

    let res: Response;
    try {
      res = await fetch(urlFor(clean), { headers: { "user-agent": UA, accept: "*/*" } });
    } catch (e) {
      return { ok: false as const, reason: `the Web Store could not be reached (${(e as Error).message})` };
    }

    if (!res.ok) {
      return { ok: false as const, reason: `the Web Store answered ${res.status} — it only serves the update endpoint to real browser user agents` };
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength < 100) {
      return { ok: false as const, reason: "the Web Store sent nothing back for that id" };
    }
    if (buf.byteLength > 24 * 1024 * 1024) {
      return { ok: false as const, reason: "that package is over 24 MB, which is past what NULL will move around" };
    }

    const head = new TextDecoder().decode(new Uint8Array(buf.slice(0, 4)));
    if (head !== "Cr24") {
      return { ok: false as const, reason: "the answer was not a .crx package" };
    }

    const blob = new Blob([buf]);
    const stored = await ctx.storage.store(blob);
    const url = await ctx.storage.getUrl(stored);
    return { ok: true as const, url, bytes: buf.byteLength };
  },
});
