import { JSDOM, VirtualConsole } from "jsdom";
const vc = new VirtualConsole();
vc.on("jsdomError", ()=>{}); vc.on("error",()=>{});
const dom = await JSDOM.fromFile("settings.html", { runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc });
await new Promise((r) => dom.window.addEventListener("load", r));
await new Promise((r) => setTimeout(r, 500));
const w=dom.window,d=w.document;
for (const id of ["themeSwitch","perfSeg","densitySeg","navSeg","libNavSeg","seasonSeg","accentRow"]) {
  const el=d.getElementById(id);
  if (!el) { console.log(id, "-> MISSING"); continue; }
  if (el.tagName==="DIV" && el.classList.contains("seg")) {
    console.log(id, [...el.querySelectorAll("button")].map(b=>b.dataset.val+(b.classList.contains("on")?"*":"")).join(","));
  } else if (id==="themeSwitch") console.log(id, "checked="+el.checked);
  else console.log(id, "children="+el.children.length);
}
console.log("prefs navLayout:", w.N.prefs.get("navLayout"));
process.exit(0);
