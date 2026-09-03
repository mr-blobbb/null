/* NULL — theme.js
   Applies theme / accent / glow / performance prefs to <html>.
   Accent palettes are mid-tone so they read on both dark and light surfaces. */
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
      root.style.setProperty("--glow-c", a.c1);
    } else {
      root.style.removeProperty("--ac-1");
      root.style.removeProperty("--ac-2");
      root.style.removeProperty("--glow-c");
    }
  }

  function setGlow(g) {
    if (g && g !== "off") root.dataset.glow = g;
    else delete root.dataset.glow;
  }

  function setPerf(on) {
    if (on) root.dataset.perf = "1";
    else delete root.dataset.perf;
  }

  function applyAll() {
    var p = N.prefs.data;
    setTheme(p.theme);
    setAccent(p.accent);
    setGlow(p.glow);
    setPerf(p.perf);
  }

  N.theme = {
    ACCENTS: ACCENTS,
    GLOWS: [
      { id: "off", name: "Off" },
      { id: "flow", name: "Flow" },
      { id: "drift", name: "Drift" },
      { id: "pulse", name: "Pulse" },
    ],
    setTheme: setTheme,
    setAccent: setAccent,
    setGlow: setGlow,
    setPerf: setPerf,
    applyAll: applyAll,
  };

  N.theme.applyAll();
})();
