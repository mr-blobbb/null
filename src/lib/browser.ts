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

type Config = UvConfig & { handler?: string; client?: string; bundle?: string; config?: string; sw?: string };

let cfg: Config | null = null;
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

/** Forget a failed boot so the next attempt starts from scratch. */
export function restart() {
  boot = null;
  relayUsed = "";
}

/** Does the relay answer at all? A bare WebSocket handshake, no transport and
 *  no worker: the quickest way to tell a dead relay from a broken browser. */
export function ping(relay: string, limit = 6000): Promise<{ ok: boolean; ms?: number; reason?: string }> {
  return new Promise((resolve) => {
    if (!relay) {
      resolve({ ok: false, reason: "no relay is set" });
      return;
    }
    let done = false;
    const finish = (r: { ok: boolean; ms?: number; reason?: string }) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve(r);
    };
    const started = performance.now();
    const timer = window.setTimeout(() => finish({ ok: false, reason: "nothing answered in six seconds" }), limit);
    try {
      const ws = new WebSocket(relay);
      ws.onopen = () => {
        ws.close();
        finish({ ok: true, ms: Math.round(performance.now() - started) });
      };
      ws.onerror = () => finish({ ok: false, reason: "the connection was refused" });
    } catch (e) {
      finish({ ok: false, reason: (e as Error).message });
    }
  });
}

/** Point the transport at a relay. Both roads out of NULL — the rewritten
 *  window and the relay reader in relay.ts — talk to the far site through
 *  this one connection, so it is set up in one place. */
export async function transport(relay: string): Promise<Boot> {
  try {
    const { BareMuxConnection } = await import("@mercuryworkshop/bare-mux");
    const connection = new BareMuxConnection("/baremux/worker.js");
    await connection.setTransport("/epoxy/epoxy-bundled.js", [{ wisp: relay }]);
    return { ok: true };
  } catch (e) {
    const seen = await ping(relay);
    return {
      ok: false,
      reason: seen.ok
        ? `The relay at ${relay} answered, but the transport would not start (${(e as Error).message}).`
        : `The relay at ${relay} did not answer (${seen.reason ?? (e as Error).message}).`,
    };
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

    /* 1 · the rewriter itself, vendored in public/uv */
    if (!cfg) {
      try {
        await script("/uv/uv.bundle.js");
        await script("/uv/uv.config.js");
      } catch (e) {
        return { ok: false, reason: `Ultraviolet is missing from public/uv (${(e as Error).message}).` };
      }
      cfg = (self as unknown as { __uv$config?: Config }).__uv$config ?? null;
      if (!cfg) return { ok: false, reason: "Ultraviolet loaded but did not describe itself." };
    }

    /* 2 · the service worker that rewrites every request in its scope */
    try {
      await navigator.serviceWorker.register("/uv/uv.sw.js", { scope: "/uv/" });
    } catch (e) {
      return {
        ok: false,
        reason: `The service worker would not register here (${(e as Error).message}).`,
      };
    }

    /* 3 · the transport, which is what actually talks to the far site */
    const wire = await transport(relay);
    if (!wire.ok) return wire;

    return { ok: true };
  })();
  return boot;
}
