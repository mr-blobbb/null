/* NULL · relay.ts
   The second road into a site: read the page itself, draw it here.

   Ultraviolet is the first road — it rewrites every request inside a service
   worker. That is the better one, and it is what the window uses whenever it
   can register a worker. But a service worker is not always available (a page
   inside someone else's frame, a browser that refuses one, an origin that is
   not ours to control), and when it is not there the old answer was a dead
   end.

   So: ask the relay for the page over the same transport Ultraviolet uses,
   put a <base> in it so its own scripts, styles and pictures resolve against
   the real origin, and draw the result in a sandboxed frame. The far site is
   never *framed* — it is copied — so a site that refuses to be framed, which
   is exactly what aether.cx does with `x-frame-options: DENY`, never gets the
   chance to refuse.

   The frame is opaque on purpose: `allow-scripts` lets the copy run, and the
   absence of `allow-same-origin` means the copy can never touch NULL — no
   reading our storage, no navigating this window. Navigation it *wants* to do
   comes back as a message, and the window fetches the new address the same
   way. What the copy cannot do without an origin, it cannot do; that line is
   worth more than a page that half works. */

const WORKER = "/baremux/worker.js";
const TRANSPORT = "/epoxy/epoxy-bundled.js";

export type Read = { ok: true; html: string } | { ok: false; reason: string };

/** A page, fetched by the relay instead of by this document. */
export async function read(url: string, relay: string): Promise<Read> {
  if (!relay) return { ok: false, reason: "No relay is set, so there is nothing to fetch through." };
  try {
    const { BareClient, BareMuxConnection } = await import("@mercuryworkshop/bare-mux");
    /* Re-pointing an already-running transport is cheap and keeps this module
       usable on its own, without the service worker ever being involved. */
    const connection = new BareMuxConnection(WORKER);
    await connection.setTransport(TRANSPORT, [{ wisp: relay }]);

    const client = new BareClient(WORKER);
    const res = await client.fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    } as RequestInit);

    if (res.status >= 400 && res.status !== 403) {
      return { ok: false, reason: `The site answered ${res.status} ${res.statusText}.` };
    }
    const html = await res.text();
    if (!html.trim()) return { ok: false, reason: "The site answered with an empty page." };
    return { ok: true, html };
  } catch (e) {
    return { ok: false, reason: `The relay could not fetch it (${(e as Error).message}).` };
  }
}

/* ---------- the copy ----------
   Three edits, each with a reason:

   · a <base> so every relative URL in the page resolves to the real site
     rather than to NULL's own address;
   · any Content-Security-Policy meta removed, because a page loaded from
     here is not on its own origin and a policy written for that origin would
     blank the copy;
   · `integrity` attributes dropped, because a subresource fetched through a
     different road will not hash the way the page expects. */

const NAV = `<script data-null="nav">(function(){
  function out(u){ try { parent.postMessage({ nullFrame: String(u) }, "*"); } catch (e) {} }
  document.addEventListener("click", function(e){
    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#") return;
    e.preventDefault();
    out(a.href);
  }, true);
  document.addEventListener("submit", function(e){
    var f = e.target;
    if (!f || !f.action) return;
    e.preventDefault();
    var q = "";
    try { q = new URLSearchParams(new FormData(f)).toString(); } catch (err) {}
    out(f.action + ((f.method || "get").toLowerCase() === "get" && q ? "?" + q : ""));
  }, true);
  try {
    var b = document.createElement("base");
    b.target = "_self";
    document.head && document.head.prepend(b);
  } catch (e) {}
})()</script>`;

export function prepare(html: string, url: string): string {
  let out = html
    .replace(/<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, "")
    .replace(/\sintegrity\s*=\s*("[^"]*"|'[^']*')/gi, "");

  const base = `<base href="${url.replace(/"/g, "&quot;")}">`;
  if (/<head[^>]*>/i.test(out)) out = out.replace(/<head[^>]*>/i, (m) => m + base + NAV);
  else out = base + NAV + out;

  return out;
}
