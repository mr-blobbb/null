/* NULL · epoxy/transport.mjs
   The piece the epoxy package does not ship.

   bare-mux's `setTransport(path, args)` does, inside its worker:

       const { default: BareTransport } = await import(path);
       transport = new BareTransport(...args);

   `epoxy-bundled.js` default-exports its wasm loader, not a transport, so
   pointing bare-mux at it throws "is not a constructor" — which is exactly the
   error NULL used to show on the Movies page. What it needs is a class with
   `init`, `ready`, `request`, `connect` and `meta`, backed by EpoxyClient.

   That class is this file. It is plain ESM so the worker can import it, and it
   carries no build step: the wasm is inlined in epoxy-bundled.js already.

   Args come from `setTransport("/epoxy/transport.mjs", [{ wisp: "wss://…" }])`,
   and the shapes follow bare-mux's own types (dist/baretypes.d.ts): `request`
   answers with a whole body, `connect` answers with the pair of functions that
   write to and close the socket. */

import init, { EpoxyClient, EpoxyClientOptions, EpoxyHandlers } from "./epoxy-bundled.js";

/** Bare headers can be arrays; epoxy wants single strings. */
function flat(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) out[k] = Array.isArray(v) ? v.join(", ") : String(v);
  return out;
}

export default class EpoxyTransport {
  constructor(...args) {
    const first = args[0];
    if (typeof first === "string") {
      this.wisp = first;
      this.v2 = false;
      this.udp = false;
    } else {
      this.wisp = (first && (first.wisp || first.websocket)) || "";
      this.v2 = !!(first && first.wisp_v2);
      /* off by default: a relay without the UDP extension still works, and
         one that needs it will say so rather than silently hanging */
      this.udp = !!(first && first.udp);
    }
    this.ready = false;
    this.client = null;
    this.triedV2 = this.v2;
    this.agent = typeof navigator !== "undefined" && navigator.userAgent ? navigator.userAgent : "null";
  }

  meta() {
    return { name: "epoxy-tls", version: "2.1.19-1" };
  }

  async init() {
    if (!this.wisp) {
      throw new Error("no relay was given to the transport — set one on the Proxies page");
    }
    /* the bundled build has the wasm inlined as base64, so no path is needed */
    await init();
    this.client = this.make(this.triedV2);
    this.ready = true;
  }

  make(v2) {
    const options = new EpoxyClientOptions();
    options.user_agent = this.agent;
    options.wisp_v2 = v2;
    options.udp_extension_required = this.udp;
    return new EpoxyClient(this.wisp, options);
  }

  /** Wisp speaks two versions and a relay may only answer one. Rather than
   *  guess once and stay wrong, a failure flips the setting and tries the
   *  other, once. */
  async connectClient() {
    if (!this.ready) await this.init();
    return this.client;
  }

  async flip(err) {
    const other = !this.triedV2;
    if (other === this.v2 || this.flipped) throw err;
    this.flipped = true;
    this.triedV2 = other;
    this.client = this.make(other);
    return this.client;
  }

  async request(remote, method, body, headers, _signal) {
    const client = await this.connectClient();
    const options = { method, body: body ?? undefined, headers: flat(headers), redirect: "manual" };
    let res;
    try {
      res = await client.fetch(remote.href, options);
    } catch (e) {
      const retry = await this.flip(e);
      res = await retry.fetch(remote.href, options);
    }
    return {
      body: await res.arrayBuffer(),
      headers: Object.fromEntries(res.headers),
      status: res.status,
      statusText: res.statusText,
    };
  }

  connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
    let socket = null;
    let dropped = false;

    const handlers = new EpoxyHandlers(
      () => onopen((protocols && protocols[0]) || ""),
      (code, reason) => onclose(code, reason),
      (err) => onerror(typeof err === "string" ? err : String(err && err.message ? err.message : err)),
      (msg) => onmessage(msg),
    );

    this.connectClient()
      .then((client) => client.connect_websocket(handlers, url.href, protocols || [], flat(requestHeaders)))
      .then((ws) => {
        socket = ws;
        if (dropped) ws.close(1000, "closed").catch(() => {});
      })
      .catch((e) => onerror(String(e && e.message ? e.message : e)));

    return [
      (data) => {
        try {
          if (socket) socket.send(data);
        } catch (e) {
          onerror(String(e && e.message ? e.message : e));
        }
      },
      (code, reason) => {
        dropped = true;
        try {
          if (socket) socket.close(code, reason);
        } catch (e) {
          /* already gone */
        }
      },
    ];
  }
}
