import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };

function resolvePath(pathname) {
  const tries = pathname === "/" ? ["index.html"] : [pathname.replace(/^\//, ""), pathname.replace(/^\//, "") + ".html", pathname.replace(/^\//, "").replace(/\/$/, "") + "/index.html"];
  for (const t of tries) {
    const f = join(ROOT, t);
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return join(ROOT, "404.html");
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.route("https://null.test/**", async (route) => {
  const url = new URL(route.request().url());
  const file = resolvePath(url.pathname);
  const body = readFileSync(file);
  await route.fulfill({ status: file.endsWith("404.html") ? 404 : 200, contentType: TYPES[extname(file)] || "application/octet-stream", body });
});

await page.goto("https://null.test/settings", { waitUntil: "load" });
await page.waitForTimeout(600);

async function report(tag) {
  const out = await page.evaluate(() => {
    const bar = document.querySelector(".topbar");
    if (!bar) return { missing: true };
    const b = bar.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    return {
      navAttr: document.documentElement.dataset.nav || null,
      navLayout: window.N.prefs.get("navLayout"),
      rect: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)],
      direction: cs.flexDirection,
      pos: cs.position,
      bodyPadLeft: getComputedStyle(document.body).paddingLeft,
      nh: getComputedStyle(document.documentElement).getPropertyValue("--nh").trim(),
      innerW: innerWidth,
    };
  });
  console.log(tag, JSON.stringify(out));
}

await report("start  ");
await page.click('#navSeg button[data-val="side"]');
await page.waitForTimeout(300);
await report("side   ");
await page.waitForTimeout(400);
await report("side+  ");

await browser.close();
process.exit(0);
