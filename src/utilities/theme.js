/* NULL · theme.js
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

  /* every theme pack you can actually wear: the free ones plus whatever the
     Shop has unlocked. econ.js owns the catalogs; theme.js only needs the
     data for rendering + applying. */
  function extraAccents() {
    if (!N.econ) return [];
    var free = N.econ.FREE_PACKS || [];
    var paid = N.econ.THEMES || [];
    return free.concat(
      paid.filter(function (t) {
        return N.econ.isUnlocked("theme", t.id);
      }),
    );
  }

  /* ---------- theme packs ----------
     A shop theme does more than recolor the accent: it sets a whole palette
     (--pk-1..4), a page tint (--pk-bg-1/2), html[data-pack] and an animated
     backdrop. Backdrops are generic layers: three <i> layers plus an
     optional particle host: that extra.css styles per data-pack id. They
     are skipped in performance mode, for reduced motion, and on the player
     and 404 pages, same as the seasonal particles. */
  var packEl = null;
  var curPack = null;
  var PK_VARS = ["--pk-1", "--pk-2", "--pk-3", "--pk-4", "--pk-bg-1", "--pk-bg-2"];

  function packFor(id) {
    return (
      extraAccents().find(function (p) {
        return p.id === id;
      }) || null
    );
  }

  function packAllowed() {
    if (N.prefs.data.perf) return false;
    if (
      document.body.classList.contains("player-page") ||
      document.body.classList.contains("page-404")
    )
      return false;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return true;
  }

  /* ---------- palette ---------- */
  function packVars(p) {
    var colors = p.colors && p.colors.length ? p.colors : [p.c1, p.c2];
    var tint = p.tint || ["#0e0e12", "#08080b"];
    var vars = {};
    for (var i = 0; i < 4; i++) {
      vars["--pk-" + (i + 1)] = colors[i] || colors[colors.length - 1];
    }
    vars["--pk-bg-1"] = tint[0];
    vars["--pk-bg-2"] = tint[1];
    return vars;
  }

  /* ---------- backdrop art ----------
     Every pack draws the same three layers (pf-a/b/c, styled per pack) plus
     one host per particle kind. Particles carry their randomness as custom
     props, so extra.css decides the shape and motion of each kind. */
  var CUSTOM_ID = "custom";

  /* where a kind's particles start when the pack doesn't say */
  var KIND_START = {
    rain: "top",
    smoke: "bottom",
  };

  function rnd(a, b) {
    return a + Math.random() * (b - a);
  }

  function partHost(part, scale) {
    var host = document.createElement("span");
    host.className = "pf-p pf-p-" + part.k;
    var start = part.sp || KIND_START[part.k] || "spread";
    var n = Math.max(1, Math.round((part.n || 0) * scale));
    for (var i = 0; i < n; i++) {
      var b = document.createElement("b");
      b.style.left = rnd(-4, 104).toFixed(1) + "%";
      b.style.top =
        start === "top"
          ? rnd(-24, -6).toFixed(1) + "%"
          : start === "bottom"
            ? rnd(74, 112).toFixed(1) + "%"
            : rnd(0, 100).toFixed(1) + "%";
      b.style.setProperty("--s", rnd(1.3, 3.8).toFixed(2) + "px");
      b.style.setProperty("--dx", (Math.random() < 0.5 ? -1 : 1) * rnd(18, 160).toFixed(0) + "px");
      b.style.setProperty("--o", rnd(0.45, 0.95).toFixed(2));
      b.style.setProperty("--rot", rnd(-30, 30).toFixed(0) + "deg");
      b.style.setProperty("--dur", rnd(3, 9).toFixed(2));
      b.style.setProperty("--delay", rnd(0, 18).toFixed(2));
      host.appendChild(b);
    }
    return host;
  }

  /* one builder for both the live full-screen layer and the shop/settings
     previews: same markup, same CSS, so a preview never lies */
  function packArt(p, cls, opts) {
    opts = opts || {};
    var el = document.createElement("div");
    el.className = cls;
    el.setAttribute("data-pack", p.id);
    el.setAttribute("aria-hidden", "true");
    ["a", "b", "c"].forEach(function (k) {
      var i = document.createElement("i");
      i.className = "pf-" + k;
      el.appendChild(i);
    });
    var scale = opts.scale || 1;
    (p.parts || []).forEach(function (part) {
      el.appendChild(partHost(part, scale));
    });
    if (opts.vars) {
      var vars = packVars(p);
      for (var k in vars) el.style.setProperty(k, vars[k]);
    }
    return el;
  }

  function packPreview(p, opts) {
    return packArt(p, "pack-preview", { vars: true, scale: (opts && opts.scale) || 0.25 });
  }

  /* a card-sized preview, optionally veiled for a pack that isn't owned yet */
  function packThumb(p, opts) {
    var thumb = document.createElement("div");
    thumb.className = "pack-thumb";
    thumb.appendChild(packPreview(p));
    if (opts && opts.lock) {
      var veil = document.createElement("div");
      veil.className = "pack-lock";
      veil.appendChild(N.dom.icon("lock"));
      thumb.appendChild(veil);
    }
    return thumb;
  }

  /* every pack that exists: free first, then the Shop's */
  function allPacks() {
    if (!N.econ) return [];
    return (N.econ.FREE_PACKS || []).concat(N.econ.THEMES || []);
  }

  function killPack() {
    if (packEl && packEl.parentNode) packEl.parentNode.removeChild(packEl);
    packEl = null;
  }

  function buildPack(p) {
    if (!p || !p.bg || !packAllowed()) return;
    if (packEl && packEl.isConnected && packEl.dataset.pack === p.id) return;
    killPack();
    packEl = packArt(p, "pack-fx");
    document.body.appendChild(packEl);
    if (document.hidden) packEl.classList.add("pf-paused");
  }

  function applyPack(p) {
    if (!p) {
      PK_VARS.forEach(function (k) {
        root.style.removeProperty(k);
      });
      root.removeAttribute("data-pack");
      killPack();
      return;
    }
    var vars = packVars(p);
    for (var k in vars) root.style.setProperty(k, vars[k]);
    root.dataset.pack = p.id;
    buildPack(p);
  }

  /* ---------- ambient particles ----------
     A layer of drifting motion that sits behind the page on its own, or on
     top of a theme pack. econ.js owns the catalog (free + Shop); this file
     builds the DOM from a particle's `parts` list and extra.css draws each
     kind. Same gating as a backdrop: no particles in performance mode, for
     reduced-motion users, or on the player / 404 pages. */
  var partEl = null;
  var curPart = null;

  function allParticles() {
    if (!N.econ) return [];
    return (N.econ.FREE_PARTICLES || []).concat(N.econ.PARTICLES || []);
  }

  function particleFor(id) {
    return (
      allParticles().find(function (p) {
        return p.id === id;
      }) || null
    );
  }

  /* free particles are everyone's; the rest must be unlocked in the Shop */
  function partOwned(p) {
    return !!p && (p.free || (N.econ && N.econ.isUnlocked("particle", p.id)));
  }

  /* NB: named ptHost, not partHost: the theme-pack builder above owns that
     name, and a second declaration would shadow it for the whole file. */
  function ptHost(part, scale) {
    var host = document.createElement("span");
    host.className = "pt-p pt-p-" + part.k;
    var n = Math.max(1, Math.round((part.n || 0) * scale));
    var center = part.sp === "center";
    for (var i = 0; i < n; i++) {
      var b = document.createElement("b");
      /* depth: far particles are smaller, dimmer and take a little blur, which
         is what turns a flat field of dots into a space you can look into */
      var z = rnd(0.45, 1.4);
      b.style.left = center ? "50%" : rnd(-6, 106).toFixed(1) + "%";
      b.style.top = center
        ? "50%"
        : part.sp === "bottom"
          ? rnd(72, 112).toFixed(1) + "%"
          : rnd(-10, 100).toFixed(1) + "%";
      b.style.setProperty("--z", z.toFixed(2));
      b.style.setProperty("--s", (rnd(1.6, 4.2) * z).toFixed(2) + "px");
      b.style.setProperty("--dx", (Math.random() < 0.5 ? -1 : 1) * rnd(18, 200).toFixed(0) + "px");
      b.style.setProperty("--o", (rnd(0.5, 1) * (0.5 + z * 0.5)).toFixed(2));
      b.style.setProperty("--rot", rnd(-40, 40).toFixed(0) + "deg");
      b.style.setProperty("--spin", (Math.random() < 0.5 ? -1 : 1) * rnd(90, 720).toFixed(0) + "deg");
      b.style.setProperty("--dur", rnd(3, 9).toFixed(2));
      b.style.setProperty("--delay", rnd(0, 18).toFixed(2));
      /* warp streams outward from the middle, so it needs an angle + a
         distance instead of a left/top start point */
      if (part.k === "warp") {
        b.style.setProperty("--ang", rnd(0, 360).toFixed(0) + "deg");
        b.style.setProperty("--dist", rnd(55, 150).toFixed(0) + "vh");
        b.style.setProperty("--dur", rnd(1.2, 3).toFixed(2));
      }
      if (part.k === "tunnel") {
        b.style.setProperty("--dur", rnd(2.2, 5).toFixed(2));
      }
      host.appendChild(b);
    }
    return host;
  }

  function partArt(p, cls, opts) {
    opts = opts || {};
    var el = document.createElement("div");
    el.className = cls;
    el.setAttribute("data-part", p.id);
    el.setAttribute("aria-hidden", "true");
    var scale = opts.scale || 1;
    (p.parts || []).forEach(function (part) {
      el.appendChild(ptHost(part, scale));
    });
    /* mono particles get their colors from CSS so they follow dark/light;
       the rest are fed their own palette inline */
    if (!p.mono && p.colors) {
      var colors = p.colors;
      for (var i = 0; i < 4; i++) {
        el.style.setProperty("--pt-" + (i + 1), colors[i] || colors[colors.length - 1]);
      }
    }
    return el;
  }

  function partPreview(p, opts) {
    return partArt(p, "part-preview", { scale: (opts && opts.scale) || 0.3 });
  }

  function partThumb(p, opts) {
    var thumb = document.createElement("div");
    thumb.className = "part-thumb";
    thumb.appendChild(partPreview(p));
    if (opts && opts.lock) {
      var veil = document.createElement("div");
      veil.className = "part-lock";
      veil.appendChild(N.dom.icon("lock"));
      thumb.appendChild(veil);
    }
    return thumb;
  }

  function killPart() {
    if (partEl && partEl.parentNode) partEl.parentNode.removeChild(partEl);
    partEl = null;
  }

  function buildPart(p) {
    if (!p || !partOwned(p) || !(p.parts || []).length || !packAllowed()) return;
    if (partEl && partEl.isConnected && partEl.dataset.part === p.id) return;
    killPart();
    partEl = partArt(p, "part-fx");
    document.body.appendChild(partEl);
    if (document.hidden) partEl.classList.add("pt-paused");
  }

  function applyPart(p) {
    if (!p) {
      killPart();
      return;
    }
    buildPart(p);
  }

  function setParticles(id) {
    var p = particleFor(id);
    curPart = p ? p.id : null;
    applyPart(partOwned(p) ? p : null);
  }

  /* ---------- custom accent ----------
     A Shop unlock (econ fx "customaccent"): the accent can be any color, and
     the second tone is derived from it so gradients keep working. */
  function lighten(hex, amt) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return hex;
    var v = parseInt(m[1], 16);
    function mix(c) {
      return Math.round(c + (255 - c) * amt);
    }
    return "#" + ((1 << 24) + (mix((v >> 16) & 255) << 16) + (mix((v >> 8) & 255) << 8) + mix(v & 255)).toString(16).slice(1);
  }

  function customPair(hex) {
    var c1 = hex || N.prefs.get("accentColor") || "#6cc7ff";
    return [c1, lighten(c1, 0.36)];
  }

  function customOn() {
    return !!(N.econ && N.econ.isUnlocked("fx", "customaccent"));
  }

  /* pause the backdrop + particles while the tab is hidden */
  document.addEventListener("visibilitychange", function () {
    if (packEl) packEl.classList.toggle("pf-paused", document.hidden);
    if (partEl) partEl.classList.toggle("pt-paused", document.hidden);
  });

  /* Glow presets. Colors are ordered around the ring and the gradient
     starts + ends on the same color, so the loop is seamless and every
     transition between colors is soft. */
  var GLOWS = [
    { id: "off", name: "Off", colors: null },
    { id: "bp", name: "Blue + Purple", colors: ["#3d8bff", "#7d6bff", "#a86bff"] },
    { id: "pg", name: "Purple + Green", colors: ["#a95bff", "#63e0c8", "#2fe58f"] },
    { id: "rainbow", name: "Rainbow", colors: ["#ff4d6d", "#ffb020", "#ffe94a", "#35e88f", "#38b6ff", "#a26bff"] },
    { id: "nnhs", name: "NNHS", colors: ["#bd5500ff", "#06005dff", "#007bffff"] },
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

  /* Neon's own tube colours, used whenever the glow border is off so the pack
     still has a palette to glow with. With the border on it borrows the exact
     colours the border is running, so page and pack glow as one. */
  var NEON_DEFAULT = ["#00e5ff", "#b14bff", "#ff2d95", "#6cff9e"];

  /* Publish the active glow palette as --glow-1..4 on <html>. Pack art reads
     them (see the Neon backdrop in extra.css), so switching the glow preset
     re-inks the backdrop too. Returns true when the palette actually moved. */
  function publishGlowVars(id) {
    var colors = id && id !== "off" ? colorsFor(id) : NEON_DEFAULT;
    var changed = false;
    for (var i = 0; i < 4; i++) {
      var key = "--glow-" + (i + 1);
      var val = colors[i] || colors[colors.length - 1];
      if (root.style.getPropertyValue(key) !== val) changed = true;
      root.style.setProperty(key, val);
    }
    if (id && id !== "off") root.dataset.glowOn = "1";
    else delete root.dataset.glowOn;
    return changed;
  }

  /* seamless conic gradient: equal stops around the circle, ending on the
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
  var elState = null; // { el, ring, glow, glow2, comet }
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
    document.body.appendChild(el);
    elState = { el: el, ring: ring, glow: glow, glow2: glow2, comet: comet };
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
    /* every layer host sits directly inside #null-glow-el, so the new
       layer goes in front of the old one and then crossfades over it */
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

  /* Neon's accent pairs with the glow palette (--glow-1/-2), with Neon's own
     tubes as the fallback for when the vars aren't published yet */
  function paintNeonAccent() {
    root.style.setProperty("--ac-1", root.style.getPropertyValue("--glow-1") || NEON_DEFAULT[0]);
    root.style.setProperty("--ac-2", root.style.getPropertyValue("--glow-2") || NEON_DEFAULT[1]);
  }

  function setGlow(raw) {
    var id = normalize(raw);
    /* the Neon pack is drawn from the glow palette, so a palette change has
       to rebuild it: no other pack cares */
    if (publishGlowVars(id) && curPack === "neon") {
      killPack();
      buildPack(packFor("neon"));
      paintNeonAccent();
    }
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
    if (cometOn) setLayerBg("comet", cometBg(colors));
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
    if (id === CUSTOM_ID && customOn()) {
      var pair = customPair();
      root.style.setProperty("--ac-1", pair[0]);
      root.style.setProperty("--ac-2", pair[1]);
    } else if (a && a.c1) {
      root.style.setProperty("--ac-1", a.c1);
      root.style.setProperty("--ac-2", a.c2 || a.c1);
    } else {
      root.style.removeProperty("--ac-1");
      root.style.removeProperty("--ac-2");
    }
    var p = packFor(id);
    curPack = p ? p.id : null;
    /* Neon takes its accent from the glow palette, so the UI can never drift
       away from the tubes behind it */
    if (p && p.glowAccent) paintNeonAccent();
    applyPack(p);
  }

  /* perf is false | true | "ultra". Ultra is performance mode plus no
     animation, no effect layers and no off-screen paint: see perf.css. */
  function setPerf(level) {
    var ultra = level === "ultra";
    var on = !!level;
    if (ultra) root.dataset.perf = "ultra";
    else if (on) root.dataset.perf = "1";
    else delete root.dataset.perf;
    /* performance mode drops the pack backdrop and particles; leaving it
       restores whichever ones were on */
    if (on) {
      killPack();
      killPart();
    } else {
      buildPack(packFor(curPack));
      buildPart(particleFor(curPart));
    }
  }

  function applyAll() {
    var p = N.prefs.data;
    setTheme(p.theme);
    setPerf(p.perf);
    /* glow first: Neon's backdrop is built from the glow palette, so the
       vars have to exist before the pack is built (avoids a rebuild) */
    cometOn = !!p.glowComet;
    setGlow(p.glow);
    setAccent(p.accent);
    setParticles(p.particles);
  }

  N.theme = {
    ACCENTS: ACCENTS,
    GLOWS: GLOWS,
    extraAccents: extraAccents,
    /* shop + settings share this so a preview can never drift from the real
       thing: same builder, same CSS, different container class */
    packPreview: packPreview,
    packThumb: packThumb,
    allPacks: allPacks,
    packVars: packVars,
    /* particles: same builder-and-preview deal as packs */
    partPreview: partPreview,
    partThumb: partThumb,
    allParticles: allParticles,
    particleFor: particleFor,
    setParticles: setParticles,
    /* rebuild particles after perf / season / reduced-motion changes */
    refreshParts: function () {
      applyPart(particleFor(curPart));
    },
    customOn: customOn,
    setCustomAccent: function (hex) {
      N.prefs.set("accentColor", hex);
      N.prefs.set("accent", CUSTOM_ID);
      setAccent(CUSTOM_ID);
    },
    packFor: packFor,
    /* rebuild the backdrop after unrelated prefs (perf, season) change */
    refreshPack: function () {
      applyPack(packFor(curPack));
    },
    setTheme: setTheme,
    setAccent: setAccent,
    setGlow: setGlow,
    setComet: setComet,
    setPerf: setPerf,
    applyAll: applyAll,
  };

  N.theme.applyAll();
})();
