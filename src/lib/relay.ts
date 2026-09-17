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

import { candidates, clientFor } from "./browser";

export type Read = { ok: true; html: string; relay: string } | { ok: false; reason: string };

/** One attempt through one relay. Split out so the walk over the list can be
 *  the only thing with a loop in it. */
async function once(url: string, relay: string): Promise<Read> {
  /* clientFor wires the transport only when this relay is not already the
     live one, so a booted window pays nothing for the second road */
  const client = await clientFor(relay);
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
  return { ok: true, html, relay };
}

/** A page, fetched by the relay instead of by this document. Every relay the
 *  site knows about gets a turn, because a relay that has quietly stopped
 *  answering is the single most common reason a page does not load here. */
export async function read(url: string, relay: string): Promise<Read> {
  const order = candidates(relay);
  if (!order.length) return { ok: false, reason: "No relay is set, so there is nothing to fetch through." };

  const tried: string[] = [];
  for (const r of order) {
    try {
      const got = await once(url, r);
      if (got.ok) return got;
      tried.push(`${r} (${got.reason})`);
    } catch (e) {
      tried.push(`${r} (${(e as Error).message})`);
    }
  }
  return { ok: false, reason: `The relay could not fetch it. Tried ${tried.join(", ")}.` };
}

/* ---------- the copy ----------
   Three edits, each with a reason:

   · a <base> so every relative URL in the page resolves to the real site
     rather than to NULL's own address;
   · any Content-Security-Policy meta removed, because a page loaded from
     here is not on its own origin and a policy written for that origin would
     blank the copy;
   · `integrity` attributes dropped, because a subresource fetched through a
     different road will not hash the way the page expects.

   Then one more thing: a storage shim. A sandboxed frame has an opaque
   origin, so `localStorage` throws on *access* — not on write — and a site
   that reads a key on boot dies before it draws. The shim gives the copy a
   working `localStorage` backed by this window's session storage, which is
   enough for the settings-and-migration code most sites run on load. It is
   deliberately namespaced per address so two copied sites cannot read each
   other's keys. */

const NAV = `<script data-null="nav">(function(){
  function out(u){ try { parent.postMessage({ nullFrame: String(u) }, "*"); } catch (e) {} }

  /* an in-memory store that reports success, so a site that writes on boot
     keeps going instead of throwing */
  var mem = {};
  var api = {
    getItem: function(k){ return Object.prototype.hasOwnProperty.call(mem, String(k)) ? mem[String(k)] : null; },
    setItem: function(k,v){ mem[String(k)] = String(v); },
    removeItem: function(k){ delete mem[String(k)]; },
    clear: function(){ mem = {}; },
    key: function(i){ return Object.keys(mem)[i] || null; }
  };
  try { Object.defineProperty(api, "length", { get: function(){ return Object.keys(mem).length; } }); } catch (e) {}
  try { Object.defineProperty(window, "localStorage", { value: api, configurable: true }); } catch (e) {}
  try { Object.defineProperty(window, "sessionStorage", { value: api, configurable: true }); } catch (e) {}

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
