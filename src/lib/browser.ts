/* NULL · browser.ts
   The fullscreen browser's plumbing.

     the page ──> Ultraviolet (a service worker under /uv/) ──> bare-mux
              ──> epoxy ──> the Wisp relay ──> the far site

   A page cannot fetch another origin, and it cannot pretend not to be itself,
   so the far site is not requested by this document at all: Ultraviolet
   rewrites it inside the worker and hands it back as if it had always lived
   under /uv/service/. The relay is what actually talks to the site; that is
   the one address a visitor may need to run themselves (see the Proxies
   page), because a static host cannot host a WebSocket server.

   Public relays come and go, which is the whole reason this file keeps a list
   rather than an address. Every relay is given a bare handshake first — six
   seconds, no transport, no worker — and the first one that answers carries
   the page. A relay that has gone quiet costs a page one handshake instead of
   a dead window. */

/* bare-mux reads browser globals while its module loads, so it is pulled in
   by the dynamic imports below rather than at the top of this file: a browser
   that cannot run the proxy should still get the rest of NULL. */

type UvConfig = {
  prefix: string;
  encodeUrl: (url: string) => string;
  decodeUrl: (url: string) => string;
};

export type Boot = { ok: boolean; relay?: string; reason?: string };

type Config = UvConfig & { handler?: string; client?: string; bundle?: string; config?: string; sw?: string };

/* The relays NULL knows about, in the order they are tried, so the first entry
   is the default. Only addresses that answered a real Wisp handshake from a
   normal network are in here — a list padded with hopeful URLs costs a page
   six seconds per dead entry, which is worse than a short list.

   A relay is the one piece of this a static host cannot supply, and therefore
   the piece most likely to be why a page does not load. So this is data, not
   code: adding one is a line, and so is removing one that has gone quiet. */
export const RELAYS: { name: string; url: string; note: string }[] = [
  {
    name: "anura",
    url: "wss://anura.pro/",
    note: "The one NULL ships with. Speaks both versions of Wisp, and answers.",
  },
  {
    name: "mercurywork",
    url: "wss://wisp.mercurywork.shop/",
    note: "The community relay. Speaks Wisp v1, and is up and down by turns — which is why it is second now.",
  },
];

export const RELAY_URLS = RELAYS.map((r) => r.url);

const WORKER = "/baremux/worker.js";
/* the transport class, not the wasm glue — see the note in public/epoxy/ */
const TRANSPORT = "/epoxy/transport.mjs";

let cfg: Config | null = null;
let boot: Promise<Boot> | null = null;
let bootKey = "";
/* the relay that actually answered last time, for anything that wants to
   name it in the interface without asking again */
let live = "";

export function relayInUse(): string {
  return live;
}

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
  bootKey = "";
  live = "";
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
export async function transport(relay: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { BareMuxConnection } = await import("@mercuryworkshop/bare-mux");
    const connection = new BareMuxConnection(WORKER);
    /* `epoxy-bundled.js` is the wasm glue, not a transport: its default export
       is an init function, so bare-mux's `new BareTransport(...)` threw
       "is not a constructor" and every proxied page died on the relay road.
       transport.mjs is the class that was missing. */
    await connection.setTransport(TRANSPORT, [{ wisp: relay }]);
    live = relay;
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** A client for one relay, wiring the transport only when it is not already
 *  the one in use. Used by the reader as well as by start(). */
export async function clientFor(relay: string) {
  const { BareClient, BareMuxConnection } = await import("@mercuryworkshop/bare-mux");
  const connection = new BareMuxConnection(WORKER);
  if (live !== relay) {
    await connection.setTransport(TRANSPORT, [{ wisp: relay }]);
    live = relay;
  }
  return new BareClient(WORKER);
}

/** The relays worth trying, best first: whatever is configured, then the list
 *  in order, with no duplicates. */
export function candidates(preferred: string): string[] {
  const all = [preferred, ...RELAY_URLS, live].filter(Boolean);
  return [...new Set(all)];
}

/** Bring the worker and a relay up once. Safe to call from anywhere.
 *
 *  The preferred relay is tried first, but a preferred relay that has gone
 *  quiet no longer means a dead window: the rest of the list gets its turn,
 *  and the one that answered is the one named in the result. */
export function start(preferred: string): Promise<Boot> {
  if (boot && bootKey === preferred) return boot;
  bootKey = preferred;
  boot = (async (): Promise<Boot> => {
    if (!("serviceWorker" in navigator)) {
      return { ok: false, reason: "This browser has no service workers, so pages cannot be rewritten." };
    }
    const order = candidates(preferred);
    if (!order.length) {
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

    /* 2 · the service worker that rewrites every request in its scope. This
       does not depend on the relay, so it is done once, before the walk. */
    try {
      await navigator.serviceWorker.register("/uv/uv.sw.js", { scope: "/uv/" });
    } catch (e) {
      return {
        ok: false,
        reason: `The service worker would not register here (${(e as Error).message}).`,
      };
    }

    /* 3 · the walk. Every relay gets a handshake first: a transport built on
       a socket that is not there throws, and the reason it throws is far
       less useful than "nothing answered". */
    const tried: string[] = [];
    for (const r of order) {
      const seen = await ping(r);
      if (!seen.ok) {
        tried.push(`${r} (${seen.reason})`);
        continue;
      }
      const wire = await transport(r);
      if (wire.ok) return { ok: true, relay: r };
      tried.push(`${r} (${wire.reason})`);
    }
    return { ok: false, reason: `No relay answered. Tried ${tried.join(", ")}.` };
  })();
  return boot;
}
