/* NULL · rungame.ts
   Read a stashed game and run it here, in this document, with no frame.

   A frame is the honest way to run a stranger's page: it gets its own
   document, its own globals and no way into ours. But a browser, a parent
   frame or a site's own headers can all decide a frame will not be shown — and
   a frame that is refused reads to a player as "this page is blocked". So
   there is a second road, and it is this file.

   Four things have to be true for a copied page to run, and each one is a step
   below:

   · its markup has to go somewhere scripts can run — a shadow root, so the
     site's CSS cannot reach in and the game's CSS cannot leak out;
   · its pictures, styles and scripts have to point back at the stash rather
     than at NULL, so every URL in the copy is made absolute;
   · its scripts have to be *created* rather than parsed, because markup
     inserted as HTML runs none of them: each one is rebuilt in the order it
     was written, with `async = false` so that order holds;
   · its relative requests at runtime — a level file, a sprite sheet — resolve
     against the document, so the caller puts a <base> in for as long as the
     game is on screen. See useStashBase() in the player. */

/** Read a page, by whichever road will answer.
 *
 *  This document's own fetch first: it is the fastest by far, and the stashes
 *  that run the library send the one header that makes it legal. When that
 *  fails — no CORS header on the host, or a stash that does not like where the
 *  request came from — the site's own relay is asked instead. That is the
 *  reader the proxy window already uses: it makes the request somewhere else
 *  and hands the page back, which is the only way to read a page whose host
 *  decides who may ask. */
export async function readPage(url: string): Promise<string> {
  try {
    return await grab(url);
  } catch (direct) {
    const { read } = await import("./relay");
    const { prefs } = await import("./themes");
    const got = await read(url, prefs.get().relay);
    if (got.ok) return got.html;
    throw new Error(`${(direct as Error).message}; through the relay, ${got.reason}`);
  }
}

/** A stashed page, with one retry. Raw GitHub answers 429 when a page asks it
 *  for a dozen files at once, and a game that needs clicking twice is a game
 *  that looks broken the first time. */
export async function grab(url: string): Promise<string> {
  for (let go = 0; ; go++) {
    const res = await fetch(url, { credentials: "omit" });
    if (res.ok) return res.text();
    if (go === 0 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 700));
      continue;
    }
    throw new Error(`it answered ${res.status}`);
  }
}

/** Our own floor under the page: a full-bleed stage, and nothing else that the
 *  game's own stylesheet cannot overrule. */
const FLOOR = `
  :host { display: block; position: absolute; inset: 0; }
  .null-root, .null-root * { box-sizing: border-box; }
  .null-root {
    position: absolute; inset: 0; overflow: hidden;
    color-scheme: dark; background: #000;
    font-family: system-ui, sans-serif; font-size: 14px;
  }
  .null-root canvas { display: block; }
  .null-root img { max-width: 100%; }
`;

/** A page's own CSS talks to `html`, `body` and `:root`, none of which exist
 *  inside a shadow root. They are pointed at the wrapper that stands in for
 *  them, so a game whose stylesheet says `body { background: black }` gets a
 *  black background instead of a white box. */
export function retarget(css: string): string {
  return css.replace(/(^|[},])(\s*)(html|body|:root)\b/gim, "$1$2.null-root");
}

/** Every address in the copy, resolved against the page it came from. */
export function absolutize(scope: ParentNode, base: string) {
  const one = (raw: string | null) => {
    if (!raw || /^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(raw.trim())) return null;
    try {
      return new URL(raw, base).href;
    } catch {
      return null;
    }
  };
  scope.querySelectorAll<HTMLElement>("[src], [href], [poster], [data], [action]").forEach((el) => {
    for (const attr of ["src", "href", "poster", "data", "action"]) {
      const fixed = one(el.getAttribute(attr));
      if (fixed) el.setAttribute(attr, fixed);
    }
  });
  scope.querySelectorAll<HTMLElement>("[srcset]").forEach((el) => {
    const fixed = (el.getAttribute("srcset") ?? "")
      .split(",")
      .map((part) => {
        const [url, size] = part.trim().split(/\s+/);
        const abs = one(url);
        return abs ? `${abs}${size ? ` ${size}` : ""}` : null;
      })
      .filter(Boolean)
      .join(", ");
    if (fixed) el.setAttribute("srcset", fixed);
  });
}

/** Where a copied page's relative URLs should point.
 *
 *  A page that names a base of its own keeps it: several stashes point theirs
 *  at a CDN that really does hold their files, and that CDN is right.
 *  Otherwise it is the folder the page came from. */
export function baseOf(html: string, file: string): string {
  const own = /<base[^>]+href\s*=\s*["']([^"']+)["']/i.exec(html)?.[1];
  return new URL(own || file.slice(0, file.lastIndexOf("/") + 1), file).href;
}

/** Put a page's markup, styles and scripts into `host`'s shadow root.
 *
 *  Returns the base the copy resolves against, so the caller can point the
 *  document at it for as long as the game is on screen. */
export function mountInline(host: HTMLElement, html: string, file: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const base = baseOf(html, file);
  doc.querySelectorAll("base").forEach((b) => b.remove());

  /* scripts are lifted out first: their order across head and body is the
     order they have to run in, and markup inserted as HTML would drop them */
  const scripts = [...doc.querySelectorAll("script")].map((s) => ({
    src: s.getAttribute("src"),
    type: s.getAttribute("type"),
    text: s.textContent ?? "",
  }));
  doc.querySelectorAll("script").forEach((s) => s.remove());

  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  shadow.textContent = "";

  const floor = document.createElement("style");
  floor.textContent = FLOOR;
  shadow.append(floor);

  /* the wrapper stands in for <html> and <body>, which a shadow root does not
     have — their classes and inline styles come with it */
  const wrap = document.createElement("div");
  wrap.className = "null-root";
  const htmlEl = doc.documentElement;
  const bodyEl = doc.body;
  if (htmlEl.getAttribute("class")) wrap.classList.add(...htmlEl.className.split(/\s+/).filter(Boolean));
  if (htmlEl.getAttribute("style")) wrap.setAttribute("style", htmlEl.getAttribute("style") ?? "");
  for (const child of [...doc.head.children, ...bodyEl.children]) wrap.append(child);
  if (bodyEl.getAttribute("class")) wrap.classList.add(...bodyEl.className.split(/\s+/).filter(Boolean));
  if (bodyEl.getAttribute("style")) {
    wrap.setAttribute("style", `${wrap.getAttribute("style") ?? ""} ${bodyEl.getAttribute("style")}`);
  }

  absolutize(wrap, base);
  shadow.append(wrap);

  /* the page's inline styles, retargeted now that they are in the tree */
  wrap.querySelectorAll("style").forEach((s) => {
    if (s.textContent) s.textContent = retarget(s.textContent);
  });

  /* links out of a game open a tab; they never navigate NULL away from itself */
  shadow.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement)?.closest?.("a");
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href");
    if (href && !href.startsWith("#")) window.open(href, "_blank", "noreferrer");
  });

  for (const s of scripts) {
    const el = document.createElement("script");
    if (s.type) el.type = s.type;
    if (s.src) {
      el.src = new URL(s.src, base).href;
      el.async = false; // inserted scripts are async by default, which reorders them
    } else {
      el.textContent = s.text;
    }
    shadow.append(el);
  }

  return base;
}

/** A blob has no directory, so `scripts/game.js` inside a copied page has
 *  nowhere to resolve to. Pointing the page back at the folder it came from
 *  fixes every relative asset it asks for; the ones that are not in the stash
 *  are missing either way, which is the stash's business, not ours.
 *
 *  A page that names a base of its own is left completely alone, for the same
 *  reason baseOf honours it: the first base wins. */
export function rebased(html: string, file: string): string {
  if (/<base\s/i.test(html)) return html;
  const dir = file.slice(0, file.lastIndexOf("/") + 1);
  const base = `<base href="${dir}">`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + base);
  return base + html;
}

/** Hosts that serve a page as text rather than as html, so a frame handed
 *  their URL renders the page's own source code. raw GitHub is the one the
 *  library runs into: it labels every file text/plain with nosniff. */
export const AS_TEXT = /raw\.githubusercontent\.com|gist\.githubusercontent\.com/;
