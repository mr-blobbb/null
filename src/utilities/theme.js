/* NULL — theme.js
   Applies theme / accent / glow / performance prefs to <html>.
   Accent palettes are mid-tone so they read on both dark and light surfaces.

   Glow borders are fully driven from here: a self-contained <style> is
   injected so the chosen preset works regardless of page. Presets are
   blue+green, rainbow, blue+purple and a custom two-color option. */
(function () {
  var N = (window.N = window.N || {});
  var root = document.documentElement;

  var ACCENTS = [
    { id: "off", name: "None" },
    { id: "ice", name: "Ice", c1: "#5aa7e0", c2: "#8ec4ec" },
    { id: "mint", name: "Mint", c1: "#3dbf8f", c2: "#74d8b2" },
    { id: "amber", name: "Amber", c1: "#d9a441", c2: "#e6c06f" },
    { id: "ember", name: "Ember", c1: "#e2704a", c2: "#ef9a78" },
    { id: "violet", name: "Violet", c1: "#8f7cf0", c2: "#b3a6f5" },
    { id: "rose", name: "Rose", c1: "#e26f9c", c2: "#efa0bd" },
  ];

  /* glow is a simple on/off full-screen edge glow — never a per-card
     border. Enabled it paints a fixed inset glow around the whole viewport
     using the accent color (grayscale fallback when accent is off). */
  var GLOWS = [
    { id: "off", name: "Off" },
    { id: "on", name: "On" },
  ];

  function setGlow(on) {
    var cur = document.getElementById("null-glow-el");
    if (!on || on === "off" || on === false) {
      delete root.dataset.glow;
      if (cur) cur.remove();
      return;
    }
    root.dataset.glow = "on";
    if (cur) return;
    var el = document.createElement("div");
    el.id = "null-glow-el";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  }

  function setTheme(t) {
    root.dataset.theme = t === "light" ? "light" : "dark";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t === "light" ? "#f2f2f4" : "#09090b";
    N.bus.emit("theme", t);
  }

  function setAccent(id) {
    var a = ACCENTS.find(function (x) {
      return x.id === id;
    });
    if (a && a.c1) {
      root.style.setProperty("--ac-1", a.c1);
      root.style.setProperty("--ac-2", a.c2 || a.c1);
    } else {
      root.style.removeProperty("--ac-1");
      root.style.removeProperty("--ac-2");
    }
  }

  function setPerf(on) {
    if (on) root.dataset.perf = "1";
    else delete root.dataset.perf;
  }

  function applyAll() {
    var p = N.prefs.data;
    setTheme(p.theme);
    setAccent(p.accent);
    setPerf(p.perf);
    setGlow(p.glow);
  }

  N.theme = {
    ACCENTS: ACCENTS,
    GLOWS: GLOWS,
    setTheme: setTheme,
    setAccent: setAccent,
    setGlow: setGlow,
    setPerf: setPerf,
    applyAll: applyAll,
  };

  N.theme.applyAll();
})();