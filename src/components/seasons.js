/* NULL — seasons.js
   Seasonal theme: a light ambient pass driven by the calendar.
   Sets html[data-season] so CSS can tint the page, and when the user's
   accent is off, fills --ac-* with the season's colors. Also drops a
   drifting particle layer behind everything — fall leaves, winter snow,
   spring petals, summer light motes. Particles are hand-drawn inline
   SVGs (data URIs), so no emoji and no external assets. Skipped on the
   player and 404, in performance mode, and for reduced-motion users.
   The dev console can force a season via prefs.seasonOverride. */
(function () {
  var N = (window.N = window.N || {});
  var root = document.documentElement;

  var SEASONS = [
    { id: "winter", label: "Winter", hint: "snow drifts behind everything", months: [11, 0, 1], size: [10, 18], n: 22 },
    { id: "spring", label: "Spring", hint: "blossom petals float behind everything", months: [2, 3, 4], size: [11, 20], n: 14 },
    { id: "summer", label: "Summer", hint: "light motes drift behind everything", months: [5, 6, 7], size: [8, 16], n: 12 },
    { id: "fall", label: "Fall", hint: "leaves drift behind everything", months: [8, 9, 10], size: [14, 26], n: 16 },
  ];

  /* used for --ac-* when the user hasn't picked their own accent */
  var COLORS = {
    fall: { c1: "#d98e3d", c2: "#e6b45f" },
    winter: { c1: "#7fb4e8", c2: "#b9d8f5" },
    spring: { c1: "#e291b0", c2: "#f0b8cf" },
    summer: { c1: "#d9b64a", c2: "#f0d98c" },
  };

  /* one SVG shape per season; {C} is swapped for a color per particle */
  var SVG = {
    /* leaf — Material "eco" glyph, filled */
    fall: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="{C}" d="M6.05 8.05c-2.73 2.73-2.73 7.15-.02 9.88 1.47-3.4 4.09-6.24 7.36-7.93-2.77 2.34-4.71 5.61-5.39 9.32 2.6 1.23 5.8.78 7.95-1.37C19.43 14.47 20 4 20 4S9.53 4.57 6.05 8.05z"/></svg>',
    /* snowflake — three crossing lines, 6-point silhouette */
    winter: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="{C}" stroke-width="1.6" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M20.7 7L3.3 17"/></svg>',
    /* petal — a soft teardrop */
    spring: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="{C}" d="M12 2C17 8 19.5 12.5 12 22 4.5 12.5 7 8 12 2Z"/></svg>',
    /* sparkle — Material "auto_awesome" glyph */
    summer: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="{C}" d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5z"/></svg>',
  };

  var PALETTES = {
    fall: ["#c97b3a", "#d9a441", "#a85a32", "#e0b45f"],
    winter: ["#eef1f6", "#d9dee8", "#ffffff"],
    spring: ["#e291b0", "#f0b8cf", "#d97b9c", "#f3cfe0"],
    summer: ["#e6c35c", "#f0d98c", "#f5e3a8"],
  };

  function detect() {
    /* dev-console preview wins over the calendar */
    var ov = N.prefs.get("seasonOverride");
    if (ov) {
      var hit = SEASONS.find(function (s) {
        return s.id === ov;
      });
      if (hit) return hit;
    }
    var m = new Date().getMonth();
    return (
      SEASONS.find(function (s) {
        return s.months.indexOf(m) >= 0;
      }) || SEASONS[3]
    );
  }

  /* ---------- particle layer ---------- */
  var fx = null;

  function gated() {
    return (
      document.body.classList.contains("player-page") ||
      document.body.classList.contains("page-404")
    );
  }

  function spawn() {
    var s = detect();
    var perf = N.prefs.get("perf");
    var reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (N.prefs.data.seasonal === false || gated() || perf || reduced) return;
    if (fx && fx.el.isConnected) return;

    var svg = SVG[s.id];
    var palette = PALETTES[s.id];
    var size = s.size;
    var el = document.createElement("div");
    el.className = "season-fx";
    el.setAttribute("aria-hidden", "true");
    for (var i = 0; i < s.n; i++) {
      var p = document.createElement("span");
      p.className = "sf-p";
      var uri =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(svg.replace("{C}", palette[i % palette.length]));
      p.style.backgroundImage = "url(\"" + uri + "\")";
      var px = (size[0] + Math.random() * (size[1] - size[0])).toFixed(1);
      p.style.width = px + "px";
      p.style.height = px + "px";
      p.style.left = (Math.random() * 100).toFixed(2) + "%";
      p.style.opacity = (0.3 + Math.random() * 0.45).toFixed(2);
      p.style.animationDelay = (-Math.random() * 18).toFixed(2) + "s";
      p.style.animationDuration = (9 + Math.random() * 11).toFixed(2) + "s";
      p.style.setProperty("--sf-sway", (Math.random() * 120 - 60).toFixed(0) + "px");
      p.style.setProperty("--sf-rot", (Math.random() * 520 - 260).toFixed(0) + "deg");
      el.appendChild(p);
    }
    document.body.appendChild(el);
    fx = { el: el };
    if (document.hidden) el.classList.add("sf-hidden");
  }

  function kill() {
    if (!fx) return;
    if (fx.el.parentNode) fx.el.parentNode.removeChild(fx.el);
    fx = null;
  }

  /* ---------- accent + season flag ---------- */
  function accentApply() {
    var on = N.prefs.data.seasonal !== false;
    if (!on) {
      root.removeAttribute("data-season");
      if (!N.prefs.data.accent || N.prefs.data.accent === "off") {
        root.style.removeProperty("--ac-1");
        root.style.removeProperty("--ac-2");
      }
      return;
    }
    var s = detect();
    root.dataset.season = s.id;
    /* seasonal colors only when the user hasn't picked their own accent */
    if (!N.prefs.data.accent || N.prefs.data.accent === "off") {
      var c = COLORS[s.id];
      root.style.setProperty("--ac-1", c.c1);
      root.style.setProperty("--ac-2", c.c2);
    }
  }

  function refresh() {
    accentApply();
    kill();
    if (!document.hidden) spawn();
  }

  /* pause particle animation while the tab is hidden */
  document.addEventListener("visibilitychange", function () {
    if (fx) fx.el.classList.toggle("sf-hidden", document.hidden);
  });

  refresh();

  N.seasons = {
    now: detect,
    refresh: refresh,
    /* dev console: force a season, follow the calendar, or turn it off */
    pick: function (id) {
      if (!id || id === "off") {
        N.prefs.set("seasonal", false);
        N.prefs.set("seasonOverride", null);
      } else if (id === "auto") {
        N.prefs.set("seasonal", true);
        N.prefs.set("seasonOverride", null);
      } else {
        N.prefs.set("seasonal", true);
        N.prefs.set("seasonOverride", id);
      }
      refresh();
    },
  };
})();