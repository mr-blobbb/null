import { JSDOM, VirtualConsole } from "jsdom";
const vc = new VirtualConsole();
const errs=[]; vc.on("jsdomError", (e)=>errs.push(String(e.message||e)));
const dom = await JSDOM.fromFile("settings.html", { runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc });
await new Promise((r) => dom.window.addEventListener("load", r));
await new Promise((r) => setTimeout(r, 500));
const w=dom.window,d=w.document;
const seg=d.querySelector("#navSeg");
console.log("seg exists:", !!seg, "buttons:", seg? seg.querySelectorAll("button").length : 0);
console.log("seg outerHTML:", seg ? seg.outerHTML.replace(/\s+/g," ").slice(0,300) : "");
console.log("classes on buttons:", [...(seg?seg.querySelectorAll("button"):[])].map(b=>b.className+"/"+b.dataset.val));
try { w.N.theme.setNavLayout("side"); } catch(e){ console.log("setNavLayout threw", e.message); }
console.log("after direct setNavLayout data-nav:", JSON.stringify(d.documentElement.dataset.nav));
console.log("errors:", errs.slice(0,3));
process.exit(0);
