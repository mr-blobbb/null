/* Throwaway diagnostic: load the live games page in headless Chromium,
   wait for the grid to render, and report every card name + computed style. */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("CONSOLE: " + m.text());
  });
  await page.goto("http://localhost:5173/games", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const cards = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll(".tcard").forEach((c, i) => {
      const name = c.querySelector(".tname");
      const cs = name ? getComputedStyle(name) : null;
      const rect = name ? name.getBoundingClientRect() : null;
      out.push({
        i,
        text: name ? name.textContent : null,
        display: cs ? cs.display : null,
        visibility: cs ? cs.visibility : null,
        opacity: cs ? cs.opacity : null,
        w: rect ? Math.round(rect.width) : null,
        h: rect ? Math.round(rect.height) : null,
        color: cs ? cs.color : null,
        fontSize: cs ? cs.fontSize : null,
        overflow: cs ? cs.overflow : null,
      });
    });
    return out;
  });

  console.log("cards found:", cards.length);
  cards.forEach((c) => {
    console.log(
      "card " + c.i + ": name=" + JSON.stringify(c.text) +
      " display=" + c.display + " vis=" + c.visibility +
      " op=" + c.opacity + " size=" + c.w + "x" + c.h +
      " color=" + c.color + " fs=" + c.fontSize + " overflow=" + c.overflow
    );
  });
  console.log("js errors:", errors.length ? errors : "none");
  await browser.close();
})();