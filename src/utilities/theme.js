/* NULL — theme.js
   Applies theme / accent / glow / performance prefs to <html>.
   Accent palettes are mid-tone so they read on both dark and light surfaces.

   Glow is a full-screen neon border — a fixed ring pinned to the very edge
   of the viewport, animated in a continuous loop. Presets: blue+purple,
   purple+green, rainbow and a custom two-color option. */
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

  /* Glow border presets. Each preset paints a bright ring around the whole
     viewport edge (theme.js injects the overlay; global.css animates it). */
  var GLOWS = [
    { id: "off", name: "Off", colors: null },
    { id: "bp", name: "Blue + Purple", colors: ["#3d8bff", "#a86bff"] },
    { id: "pg", name: "Purple + Green", colors: ["#a95bff", "#2fe58f"] },
    { id: "rainbow", name: "Rainbow", colors: ["#ff3b5c", "#ffb020", "#ffe94a", "#35e88f", "#38b6ff", "#a26bff"] },
    { id: "custom", name: "Custom", colors: null },
  ];

  /* legacy ids from the old on/off + card-scan presets → blue+purple */
  function normalize(id) {
    if (!id || id === "off" || id === false) return "off";
    var known = GLOWS.some(function (g) {
      return g.id === id;
    });
    return known ? id : "bp";
  }

  function colorsFor(id) {
    var g = GLOWS.find(function (x) {
      return x.id === id;
    });
    if (id === "custom") {
      var c1 = N.prefs.get("glowColor1") || "#35c3f2";
      var c2 = N.prefs.get("glowColor2") || "#a86bff";
      return [c1, c2];
    }
    return (g && g.colors) || ["#3d8bff", "#a86bff"];
  }

  /* conic-gradient string with a few equal stops around the circle */
  function conic(colors) {
    var stops = colors
      .map(function (c, i) {
        var a = Math.round((i / colors.length) * 360);
        return c + " " + a + "deg";
      })
      .join(", ");
    return "conic-gradient(from var(--nga), " + stops + ")";
  }

  function build() {
    var cur = document.getElementById("null-glow-el");
    if (cur) return cur;
    var el = document.createElement("div");
    el.id = "null-glow-el";
    el.setAttribute("aria-hidden", "true");
    var ring = document.createElement("i");
    ring.className = "ng-ring";
    var halo = document.createElement("i");
    halo.className = "ng-halo";
    el.appendChild(ring);
    el.appendChild(halo);
    document.body.appendChild(el);
    return el;
  }

  function setGlow(raw) {
    var id = normalize(raw);
    var on = id !== "off";
    var cur = document.getElementById("null-glow-el");
    if (!on) {
      delete root.dataset.glow;
      if (cur) cur.remove();
      return;
    }
    root.dataset.glow = id;
    var el = build();
    var bg = conic(colorsFor(id));
    el.querySelector(".ng-ring").style.background = bg;
    el.querySelector(".ng-halo").style.background = bg;
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
