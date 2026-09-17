/* NULL · browser.ts
   The fullscreen browser's plumbing.

     the page ──> Ultraviolet (a service worker under /uv/) ──> bare-mux
              ──> epoxy ──> the Wisp relay ──> the far site

   A page cannot fetch another origin, and it cannot pretend not to be itself,
   so the far site is not requested by this document at all: Ultraviolet
   rewrites it inside the worker and hands it back as if it had always lived
   under /uv/service/. The relay is what actually talks to the site; that is
   the one address a visitor may need to run themselves (see the Proxies
   page), because GitHub Pages cannot host a WebSocket server.

   Nothing here runs until someone opens an address, and every failure comes
   back as words rather than a blank frame. */

/* bare-mux reads browser globals while its module loads, so it is pulled in
   by the dynamic import in start() rather than at the top of this file: a
   browser that cannot run the proxy should still get the rest of NULL. */

type UvConfig = {
  prefix: string;
  encodeUrl: (url: string) => string;
  decodeUrl: (url: string) => string;
};

export type Boot = { ok: boolean; reason?: string };

let cfg: UvConfig | null = null;
let boot: Promise<Boot> | null = null;
let relayUsed = "";

function script(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.append(el);
  });
}

/** The address to put in the frame: the far site, rewritten. */
export function proxied(url: string): string | null {
  if (!cfg) return null;
  try {
    return cfg.prefix + cfg.encodeUrl(url);
  } catch {
    return null;
  }
}

/** Bring the worker and the relay up once. Safe to call from anywhere. */
export function start(relay: string): Promise<Boot> {
  /* a new relay means a new transport, so only the first one is remembered */
  if (boot && relayUsed === relay) return boot;
  relayUsed = relay;
  boot = (async (): Promise<Boot> => {
    if (!("serviceWorker" in navigator)) {
      return { ok: false, reason: "This browser has no service workers, so pages cannot be rewritten." };
    }
    if (!relay) {
      return { ok: false, reason: "No relay is set. Nothing can be fetched without one." };
    }
    try {
      if (!cfg) {
        await script("/uv/uv.bundle.js");
        await script("/uv/uv.config.js");
        cfg = (self as unknown as { __uv$config?: UvConfig }).__uv$config ?? null;
      }
      if (!cfg) return { ok: false, reason: "Ultraviolet loaded but did not describe itself." };

      await navigator.serviceWorker.register("/uv/uv.sw.js", { scope: "/uv/" });

      const { BareMuxConnection } = await import("@mercuryworkshop/bare-mux");
      const connection = new BareMuxConnection("/baremux/worker.js");
      await connection.setTransport("/epoxy/epoxy-bundled.js", [{ wisp: relay }]);
    } catch (e) {
      return { ok: false, reason: `The relay at ${relay} did not answer (${(e as Error).message}).` };
    }
    return { ok: true };
  })();
  return boot;
}
