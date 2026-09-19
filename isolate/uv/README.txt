NULL · the browser stack
========================

Everything in public/ is served as-is. These four folders are the browser
from src/lib/browser.ts; only uv.config.js is written by hand.

  uv/         Ultraviolet 3.2.10 — uv.bundle.js, uv.client.js, uv.handler.js,
              uv.sw.js are copied verbatim from the npm package's dist/.
              uv.config.js is ours: it sets the prefix (/uv/service/), the
              paths, and the xor codec the page and the worker share.
  baremux/    @mercuryworkshop/bare-mux 2.1.9 — index.mjs (the client) and
              worker.js (the SharedWorker the transport runs inside).
  epoxy/      @mercuryworkshop/epoxy-tls 2.1.19 — the transport itself, with
              its wasm. This is what opens the WebSocket to the relay.
  decor/      the shop's profile-card clips (see its own README).

The chain, and why each hop exists:

  the page  ──> Ultraviolet (service worker, /uv/)   a page cannot fetch
              ──> bare-mux (SharedWorker)            another origin, and
              ──> epoxy (wasm)                       cannot pretend not to
              ──> Wisp relay (WebSocket)             be itself
              ──> the far site

The relay is the only piece a static host cannot provide, so it is a setting
(Proxies → Wisp relay), not a constant. Default is a public one.

Updating
--------
The three packages are real dependencies in package.json, so this is a copy
step, not a download:

  bun update @titaniumnetwork-dev/ultraviolet @mercuryworkshop/bare-mux \
             @mercuryworkshop/epoxy-tls
  cp node_modules/@titaniumnetwork-dev/ultraviolet/dist/{uv.bundle.js,uv.client.js,uv.handler.js,uv.sw.js} public/uv/
  cp node_modules/@mercuryworkshop/bare-mux/dist/{index.mjs,worker.js} public/baremux/
  cp node_modules/@mercuryworkshop/epoxy-tls/full/{epoxy-bundled.js,epoxy.wasm} public/epoxy/

Keep the prefix inside the worker's scope (/uv/), or the service worker will
not see the requests it is meant to rewrite.
