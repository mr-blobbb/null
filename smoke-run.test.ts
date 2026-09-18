/* The loader that reads a stashed game and runs it in this document instead of
   a frame. happy-dom plays the browser: the interesting parts are all about the
   DOM — whether a relative URL was rewritten, whether a stylesheet aimed at
   <body> still means anything inside a shadow root, and whether the page's
   scripts were re-created in the order they were written rather than dropped on
   the floor the way HTML parsing drops them.

   Nothing here executes a script: this harness does not run any. A browser
   does run a script inserted into a shadow tree, which is what the loader
   relies on, so what is checked is that the script arrives — with its text, its
   order and its address intact — and not that it ran. */

import { expect, test } from "bun:test";
import { Window } from "happy-dom";

const win = new Window({ url: "https://null.test/" });
const gl = globalThis as unknown as Record<string, unknown>;
gl.window = win;
gl.document = win.document;
gl.DOMParser = win.DOMParser;

const { mountInline, baseOf, rebased, retarget, absolutize } = await import("./src/lib/rungame");

const FILE = "https://raw.githack.com/ubg-py/seraph/main/games/slope/index.html";
const DIR = "https://raw.githack.com/ubg-py/seraph/main/games/slope/";

const PAGE = `<!doctype html><html class="g"><head>
  <base href="${DIR}">
  <style>body { background: #123; } .hud { color: #f00 }</style>
  <link rel="stylesheet" href="style.css">
  <script src="engine.js"></script>
</head><body class="play" style="margin:0">
  <canvas id="c"></canvas>
  <img src="art/a.png">
  <img src="data:image/gif;base64,R0lGOD" srcset="art/b.png 1x, art/c.png 2x">
  <a href="https://example.com/x">out</a>
  <script>window.__ran = (window.__ran || 0) + 1;</script>
</body></html>`;

test("the base is the page's own when it names one", () => {
  expect(baseOf(PAGE, FILE)).toBe(DIR);
  expect(baseOf("<html><body>x</body></html>", FILE)).toBe(DIR);
});

test("rebasing leaves a page that names its own base alone", () => {
  /* byte for byte: nothing is added to a page that already says where it
     lives, because a second base would win and point at the wrong place */
  expect(rebased(PAGE, FILE)).toBe(PAGE);
  expect(rebased("<html><head></head><body>x</body></html>", FILE)).toContain(`<base href="${DIR}">`);
});

test("rules aimed at html, body and :root are pointed at the wrapper", () => {
  const out = retarget("body { color: red } .hud, html .x { top: 0 } :root{--a:1}");
  expect(out).toContain(".null-root { color: red }");
  expect(out).toContain(".null-root .x");
  expect(out).toContain(".null-root{--a:1}");
  expect(retarget(".hud { color: #f00 }")).toBe(".hud { color: #f00 }");
});

test("every address in a copy resolves against the stash", () => {
  const probe = win.document.createElement("div");
  probe.innerHTML = `<img src="art/a.png"><a href="/x">y</a><img src="data:image/gif;base64,AAA"><i srcset="art/b.png 1x, art/c.png 2x"></i>`;
  absolutize(probe, DIR);
  const imgs = probe.querySelectorAll("img");
  expect(imgs[0].getAttribute("src")).toBe(`${DIR}art/a.png`);
  expect(probe.querySelector("a")?.getAttribute("href")).toBe("https://raw.githack.com/x");
  expect(imgs[1].getAttribute("src")).toBe("data:image/gif;base64,AAA");
  expect(probe.querySelector("i")?.getAttribute("srcset")).toBe(`${DIR}art/b.png 1x, ${DIR}art/c.png 2x`);
});

test("a page mounts in a shadow root with its parts in the right places", () => {
  const host = win.document.createElement("div");
  win.document.body.append(host);
  const base = mountInline(host as unknown as HTMLElement, PAGE, FILE);
  const shadow = host.shadowRoot as unknown as ShadowRoot | null;

  expect(base).toBe(DIR);
  expect(shadow).not.toBeNull();
  if (!shadow) return;

  /* the markup, minus the scripts, which are rebuilt below it */
  expect(shadow.querySelector("canvas")).not.toBeNull();
  expect(shadow.querySelector(".null-root")?.className).toContain("play");
  expect(shadow.querySelector("img")?.getAttribute("src")).toBe(`${DIR}art/a.png`);
  expect(shadow.querySelector("link")?.getAttribute("href")).toBe(`${DIR}style.css`);

  /* the page's own CSS survives, aimed at the wrapper instead of at body */
  const css = [...shadow.querySelectorAll("style")].map((s) => s.textContent ?? "").join("\n");
  expect(css).toContain(".null-root { background: #123; }");
  expect(css).toContain(".hud { color: #f00 }");

  /* scripts are re-created in order rather than parsed and dropped */
  const scripts = [...shadow.querySelectorAll("script")];
  expect(scripts.length).toBe(2);
  expect(scripts[0].getAttribute("src")).toBe(`${DIR}engine.js`);
  expect((scripts[0] as unknown as { async: boolean }).async).toBe(false);
  expect(scripts[1].textContent).toContain("window.__ran");
});
