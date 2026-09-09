/* NULL — theme.js
   Applies theme / accent / glow / performance prefs to <html>.
   Accent palettes are mid-tone so they read on both dark and light surfaces.

   Glow is a full-screen neon border — a thin, rounded ring pinned to the
   viewport edge. It has three neon layers (crisp core line, soft inner
   glow, wide halo) that rotate at different speeds for a liquid feel.
   Optional comet mode adds a bright streak that travels the border, and
   moving the cursor close to an edge makes the glow flare slightly.
   Presets crossfade into each other instead of switching abruptly. */
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

  /* Glow presets. Colors are ordered around the ring and the gradient
     starts + ends on the same color, so the loop is seamless and every
     transition between colors is soft. */
  var GLOWS = [
    { id: "off", name: "Off", colors: null },
    { id: "bp", name: "Blue + Purple", colors: ["#3d8bff", "#7d6bff", "#a86bff"] },
    { id: "pg", name: "Purple + Green", colors: ["#a95bff", "#63e0c8", "#2fe58f"] },
    { id: "rainbow", name: "Rainbow", colors: ["#ff4d6d", "#ffb020", "#ffe94a", "#35e88f", "#38b6ff", "#a26bff"] },
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
    return (g && g.colors) || ["#3d8bff", "#7d6bff", "#a86bff"];
  }

  /* seamless conic gradient — equal stops around the circle, ending on the
     first color so the wrap point is invisible */
  function conic(colors) {
    var stops = colors
      .map(function (c, i) {
        var a = Math.round((i / colors.length) * 360);
        return c + " " + a + "deg";
      })
      .join(", ");
    return "conic-gradient(from var(--nga), " + stops + ", " + colors[0] + " 360deg)";
  }

  /* comet layer: one bright head with a soft tail, the rest transparent */
  function cometBg(colors) {
    var c = colors[0] || "#3d8bff";
    var bright = "color-mix(in srgb, " + c + " 75%, white 25%)";
    return (
      "conic-gradient(from var(--nga), transparent 0 34%, " +
      bright +
      " 45%, transparent 56% 100%)"
    );
  }

  /* ---------- glow element ---------- */
  var elState = null; // { el, ring, core, halo, comet }
  var curId = "off";
  var cometOn = false;

  function layerEl(kind) {
    var i = document.createElement("i");
    i.className = "ng-" + kind;
    return i;
  }

  function ensureEl(bg) {
    if (elState && elState.el.isConnected) return elState;
    var el = document.createElement("div");
    el.id = "null-glow-el";
    el.setAttribute("aria-hidden", "true");
    var ring = layerEl("ring");
    var core = layerEl("core");
    var halo = layerEl("halo");
    [ring, core, halo].forEach(function (l) {
      if (bg) l.style.background = bg;
    });
    el.appendChild(ring);
    el.appendChild(core);
    el.appendChild(halo);
    var comet = null;
    if (cometOn) {
      comet = layerEl("comet");
      if (bg) comet.style.background = cometBg(colorsFor(curId));
      el.appendChild(comet);
    }
    document.body.appendChild(el);
    elState = { el: el, ring: ring, core: core, halo: halo, comet: comet };
    return elState;
  }

  /* swap a layer's gradient with a crossfade: new layer fades in on top,
     old one fades out and is removed once the transition settles */
  function setLayerBg(kind, bg) {
    var st = elState;
    if (!st) return;
    var old = st[kind];
    if (!old || old.style.background === bg) return;
    var n = layerEl(kind);
    n.style.background = bg;
    n.classList.add("ng-in");
    old.parentNode.insertBefore(n, old);
    old.classList.add("ng-xf");
    void n.offsetWidth;
    n.classList.remove("ng-in");
    st[kind] = n;
    setTimeout(function () {
      if (old.parentNode) old.parentNode.removeChild(old);
    }, 850);
  }

  function setComet(on) {
    cometOn = !!on;
    if (!elState || !elState.el.isConnected || !root.dataset.glow) return;
    if (cometOn) {
      if (!elState.comet) {
        var c = layerEl("comet");
        c.style.background = cometBg(colorsFor(curId));
        c.classList.add("ng-in");
        elState.el.appendChild(c);
        void c.offsetWidth;
        c.classList.remove("ng-in");
        elState.comet = c;
      }
    } else if (elState.comet) {
      var old = elState.comet;
      old.classList.add("ng-xf");
      elState.comet = null;
      setTimeout(function () {
        if (old.parentNode) old.parentNode.removeChild(old);
      }, 850);
    }
  }

  /* cursor-proximity flare: how close is the pointer to the nearest edge?
     0 = far (no flare), 1 = right next to the border. Applied as a soft
     brightness lift on the whole ring — movement keeps running underneath. */
  var proxOn = false;
  var proxVal = 0;
  var proxRaf = null;
  function proxMove(e) {
    var d = Math.min(
      e.clientX,
      window.innerWidth - e.clientX,
      e.clientY,
      window.innerHeight - e.clientY,
    );
    proxVal = N.dom.clamp(1 - d / 90, 0, 1);
    if (proxRaf) return;
    proxRaf = requestAnimationFrame(function () {
      proxRaf = null;
      if (elState && elState.el.isConnected) {
        elState.el.style.setProperty("--ng-prox", proxVal);
      }
    });
  }
  function wireProx() {
    if (proxOn) return;
    proxOn = true;
    document.addEventListener("pointermove", proxMove, { passive: true });
  }
  function unwireProx() {
    if (!proxOn) return;
    proxOn = false;
    document.removeEventListener("pointermove", proxMove);
  }

  function setGlow(raw) {
    var id = normalize(raw);
    if (id === "off") {
      delete root.dataset.glow;
      if (elState && elState.el.isConnected) {
        var st = elState;
        elState = null;
        st.el.classList.add("ng-off");
        setTimeout(function () {
          if (st.el.parentNode) st.el.parentNode.removeChild(st.el);
        }, 600);
      }
      unwireProx();
      return;
    }
    root.dataset.glow = id;
    curId = id;
    var colors = colorsFor(id);
    var bg = conic(colors);
    var st = ensureEl(bg);
    setLayerBg("ring", bg);
    setLayerBg("core", bg);
    setLayerBg("halo", bg);
    if (cometOn) setLayerBg("comet", cometBg(colors));
    wireProx();
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
    cometOn = !!p.glowComet;
    setGlow(p.glow);
  }

  N.theme = {
    ACCENTS: ACCENTS,
    GLOWS: GLOWS,
    setTheme: setTheme,
    setAccent: setAccent,
    setGlow: setGlow,
    setComet: setComet,
    setPerf: setPerf,
    applyAll: applyAll,
  };

  N.theme.applyAll();
})();