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

  /* glow presets. variant drives the CSS; flow uses two colors. */
  var GLOWS = [
    { id: "off", name: "Off" },
    { id: "spring", name: "Blue + Green", c1: "#35c3f2", c2: "#34e09a" },
    { id: "rainbow", name: "Rainbow" },
    { id: "nebula", name: "Blue + Purple", c1: "#4a7bff", c2: "#a86bff" },
    { id: "custom", name: "Custom", c1: "#35c3f2", c2: "#a86bff" },
  ];

  /* surfaces that get the glow border when a preset is active */
  var SURFACES = [
    ".tcard",
    ".panel",
    ".feat-panel",
    ".set-card",
    ".more-menu",
    ".search-panel",
    ".player-frame",
  ].join(", ");

  function glowCss(id) {
    var g = GLOWS.find(function (x) {
      return x.id === id;
    });
    var variant = id === "rainbow" ? "rainbow" : "flow";
    var c1, c2;
    if (id === "custom") {
      c1 = N.prefs.get("glowColor1") || g.c1;
      c2 = N.prefs.get("glowColor2") || g.c2;
    } else {
      c1 = g.c1;
      c2 = g.c2;
    }
    root.style.setProperty("--glow-c1", c1 || "var(--ac-1)");
    root.style.setProperty("--glow-c2", c2 || c1 || "var(--ac-1)");

    var grad =
      variant === "rainbow"
        ? "conic-gradient(from var(--ga), transparent 0 4%, #ff5f57 14%, #ffbd2e 24%, #28c840 34%, #4c8dff 44%, #af5cf7 54%, transparent 66% 100%)"
        : "conic-gradient(from var(--ga), transparent 0 8%, color-mix(in srgb, var(--glow-c1) 85%, transparent) 20%, color-mix(in srgb, var(--glow-c2) 85%, transparent) 36%, transparent 48% 100%)";

    return (
      "@property --ga{syntax:\"<angle>\";inherits:false;initial-value:0deg;}" +
      "@keyframes ga-rot{to{--ga:360deg}}" +
      "@keyframes ga-rot-rev{from{--ga:360deg}to{--ga:0deg}}" +
      "html[data-glow] " +
      SURFACES +
      "{position:relative;z-index:0;}" +
      "html[data-glow=\"" +
      variant +
      "\"] " +
      SURFACES +
      "::after{" +
      "content:\"\";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;" +
      "background:" +
      grad +
      ";-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);" +
      "-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);" +
      "mask-composite:exclude;opacity:0.9;animation:ga-rot 6s linear infinite;" +
      "pointer-events:none;z-index:-1;}" +
      "html[data-glow=\"" +
      variant +
      "\"] " +
      SURFACES +
      "::before{" +
      "content:\"\";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;" +
      "background:conic-gradient(from var(--ga), transparent 0 42%, " +
      "color-mix(in srgb, var(--glow-c1) 40%, transparent) 52%, transparent 62% 100%);" +
      "-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);" +
      "-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);" +
      "mask-composite:exclude;opacity:0.55;animation:ga-rot-rev 12s linear infinite;" +
      "pointer-events:none;z-index:-1;}"
    );
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

  function setGlow(id) {
    if (!id || id === "off") {
      delete root.dataset.glow;
      root.style.removeProperty("--glow-c1");
      root.style.removeProperty("--glow-c2");
      var cur = document.getElementById("null-glow");
      if (cur) cur.remove();
      return;
    }
    root.dataset.glow = id === "rainbow" ? "rainbow" : "flow";
    var style = document.getElementById("null-glow");
    if (!style) {
      style = document.createElement("style");
      style.id = "null-glow";
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = glowCss(id);
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