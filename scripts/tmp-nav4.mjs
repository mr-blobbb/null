import { JSDOM, VirtualConsole } from "jsdom";
const vc = new VirtualConsole();
const errs=[]; vc.on("jsdomError",(e)=>{const m=String(e.message||e); if(!/Could not parse CSS|Not implemented/i.test(m)) errs.push(m);});
const dom = await JSDOM.fromFile("settings.html", {
  runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.matchMedia = () => ({ matches:false, media:"", onchange:null, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}, dispatchEvent(){ return false; } });
  },
});
await new Promise((r) => dom.window.addEventListener("load", r));
await new Promise((r) => setTimeout(r, 500));
const w=dom.window,d=w.document,root=d.documentElement;
console.log("errors:", errs.slice(0,4));
console.log("navSeg:", [...d.querySelectorAll("#navSeg button")].map(b=>b.dataset.val+(b.classList.contains("on")?"*":"")).join(","));
console.log("prefs:", w.N.prefs.get("navLayout"), "data-nav:", JSON.stringify(root.dataset.nav));
const side=[...d.querySelectorAll("#navSeg button")].find(b=>b.dataset.val==="side");
side.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
await new Promise((r) => setTimeout(r, 50));
console.log("after click side -> prefs:", w.N.prefs.get("navLayout"), "data-nav:", JSON.stringify(root.dataset.nav),
  "navSeg:", [...d.querySelectorAll("#navSeg button")].map(b=>b.dataset.val+(b.classList.contains("on")?"*":"")).join(","));
const bar=[...d.querySelectorAll("#navSeg button")].find(b=>b.dataset.val==="bar");
bar.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
await new Promise((r) => setTimeout(r, 50));
console.log("after click bar  -> prefs:", w.N.prefs.get("navLayout"), "data-nav:", JSON.stringify(root.dataset.nav));
process.exit(0);
