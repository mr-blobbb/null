/* NULL — theme.js
   Applies theme / accent / glow / performance prefs to <html>.
   Accent palettes are mid-tone so they read on both dark and light surfaces.

   Glow is a slim full-screen neon border: a 5px ring pinned to the
   viewport edge with a soft 5px glow hugging it. The gradient rotates in
   a continuous loop; optional comet mode adds a bright streak that
   travels the border. Moving the cursor close to an edge lights up only
   the piece of border near the cursor. Presets crossfade into each
   other instead of snapping. */
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
    { id: "lime", name: "Lime", c1: "#9cc94e", c2: "#c0e07e" },
    { id: "teal", name: "Teal", c1: "#2fc4b6", c2: "#6fe0d4" },
    { id: "scarlet", name: "Scarlet", c1: "#ff0000", c2: "#f08f8f" },
    { id: "plum", name: "Plum", c1: "#b564e0", c2: "#d19af0" },
    { id: "ocean", name: "Ocean", c1: "#4b86e0", c2: "#84adee" },
  ];

  /* shop-unlocked theme accents. econ.js owns the item catalog; theme.js
     only needs the color data for rendering + applying. */
  function extraAccents() {
    if (!N.econ || !N.econ.THEMES) return [];
    return N.econ.THEMES.filter(function (t) {
      return N.econ.isUnlocked("theme", t.id);
    });
  }

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

  /* The ring layers are drawn with mask-composite. Browsers without it
     would paint the full-viewport gradient over the whole screen, so the
     glow is disabled there instead of breaking the page. */
  var masksOK = (function () {
    if (typeof CSS === "undefined" || !CSS.supports) return true;
    try {
      return CSS.supports("mask-composite", "exclude") || CSS.supports("-webkit-mask-composite", "xor");
    } catch (err) {
      return true;
    }
  })();

  /* ---------- glow element ---------- */
  var elState = null; // { el, ring, glow, glow2, comet, flareBand }
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
    var glow2 = layerEl("glow2");
    var glow = layerEl("glow");
    [ring, glow2, glow].forEach(function (l) {
      if (bg) l.style.background = bg;
    });
    el.appendChild(ring);
    el.appendChild(glow2);
    el.appendChild(glow);
    var comet = null;
    if (cometOn) {
      comet = layerEl("comet");
      if (bg) comet.style.background = cometBg(colorsFor(curId));
      el.appendChild(comet);
    }
    /* proximity flare: bright wedge of ring that follows the cursor */
    var flare = layerEl("flare");
    var flareBand = layerEl("flare-band");
    if (bg) flareBand.style.background = bg;
    flare.appendChild(flareBand);
    el.appendChild(flare);
    document.body.appendChild(el);
    elState = { el: el, ring: ring, glow: glow, glow2: glow2, comet: comet, flareBand: flareBand };
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
    var host = kind === "flareBand" ? st.flare : old.parentNode;
    host.insertBefore(n, old);
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

  /* cursor proximity: only the piece of border near the pointer reacts.
     We track the distance to the nearest edge (0..1 flare strength) and
     the cursor's angle around the viewport center, which aims the flare
     wedge at the right segment. */
  var proxOn = false;
  var proxRaf = null;
  var proxX = -999;
  var proxY = -999;
  function proxMove(e) {
    proxX = e.clientX;
    proxY = e.clientY;
    if (proxRaf) return;
    proxRaf = requestAnimationFrame(function () {
      proxRaf = null;
      var st = elState;
      if (!st || !st.el.isConnected) return;
      var w = window.innerWidth;
      var h = window.innerHeight;
      var d = Math.min(proxX, w - proxX, proxY, h - proxY);
      var v = N.dom.clamp(1 - d / 80, 0, 1);
      var deg = (Math.atan2(proxX - w / 2, -(proxY - h / 2)) * 180) / Math.PI;
      st.el.style.setProperty("--ng-prox", v);
      st.el.style.setProperty("--ng-cur", (deg + 360) % 360 + "deg");
      st.el.classList.toggle("ng-near", v > 0.02);
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
    if (id === "off" || !masksOK) {
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
    setLayerBg("glow", bg);
    setLayerBg("glow2", bg);
    setLayerBg("flareBand", bg);
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
    var a = ACCENTS.concat(extraAccents()).find(function (x) {
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
    extraAccents: extraAccents,
    setTheme: setTheme,
    setAccent: setAccent,
    setGlow: setGlow,
    setComet: setComet,
    setPerf: setPerf,
    applyAll: applyAll,
  };

  N.theme.applyAll();
})();
