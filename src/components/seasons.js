/* NULL: seasons.js
   Seasonal + holiday themes: a light ambient pass driven by the calendar.
   Sets html[data-season] so CSS can tint the page, and when the user's
   accent is off, fills --ac-* with the theme's colors. Also drops a
   drifting particle layer behind everything.

   A holiday is a variant of the season it lands in, not a season of its
   own: Fall offers Fall and Halloween, Winter offers Winter and Holidays.
   Both are always on the list, so you can pick either; the calendar picks
   for you otherwise, and a variant with a `window` (Halloween's last two
   weeks of October, the December holidays) wins that window.

   Particles are hand-drawn inline SVGs (data URIs), so no emoji and no
   external assets. Skipped on the player and 404, in performance mode, and
   for reduced-motion users. The dev console can force a theme via
   prefs.seasonOverride; Settings writes prefs.seasonVariant. */

(function () {
  var N = (window.N = window.N || {});
  var root = document.documentElement;

  /* ---------- shapes ----------
     One inline SVG per particle kind, and {C} is swapped for a color from
     the theme's palette. */
  var SHAPES = {
    /* leaf: Material "eco" glyph, filled */
    leaf: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="{C}" d="M6.05 8.05c-2.73 2.73-2.73 7.15-.02 9.88 1.47-3.4 4.09-6.24 7.36-7.93-2.77 2.34-4.71 5.61-5.39 9.32 2.6 1.23 5.8.78 7.95-1.37C19.43 14.47 20 4 20 4S9.53 4.57 6.05 8.05z"/></svg>',
    /* bat: two wings and a small body */
    bat: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="{C}" d="M12 7.2c1.1 0 1.9.7 2.3 1.5.6-.5 1.4-.8 2.2-.8.5 0 .9.1 1.3.3-.4-1-.6-2.1-.4-3.2-1.9.9-3.5 1.2-4.4 1.2-.4 0-.7 0-1 0s-.6 0-1 0c-.9 0-2.5-.3-4.4-1.2.2 1.1 0 2.2-.4 3.2.4-.2.8-.3 1.3-.3.8 0 1.6.3 2.2.8.4-.8 1.2-1.5 2.3-1.5zM12 10.6c-1.2 0-2.2.9-2.2 2 0 1 .7 1.8 1.6 2v1.1c0 .3.3.6.6.6s.6-.3.6-.6v-1.1c.9-.2 1.6-1 1.6-2 0-1.1-1-2-2.2-2z"/></svg>',
    /* snowflake: three crossing lines, 6-point silhouette */
    snow: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="{C}" stroke-width="1.6" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M20.7 7L3.3 17"/></svg>',
    /* star: Material "star_4" sparkle, filled */
    star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="{C}" d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5z"/></svg>',
    /* petal: a soft teardrop */
    petal: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="{C}" d="M12 2C17 8 19.5 12.5 12 22 4.5 12.5 7 8 12 2Z"/></svg>',
    /* mote: a plain soft round light, for the summer pass */
    mote: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="{C}"/></svg>',
  };

  /* ---------- themes ----------
     `kinds` is walked in order, one shape per particle, so the mix and the
     order of what falls are both visible in the list. `size` is the px
     range, `n` how many, `window` the day range a holiday claims inside its
     season, `palette` the colors the shapes take, `colors` the pair used for
     --ac-* when the visitor has no accent of their own. */
  var THEMES = {
    fall: {
      id: "fall",
      label: "Fall",
      hint: "leaves drift behind everything",
      kinds: ["leaf"],
      size: [14, 26],
      n: 16,
      palette: ["#c97b3a", "#d9a441", "#a85a32", "#e0b45f"],
      colors: { c1: "#d98e3d", c2: "#e6b45f" },
    },
    halloween: {
      id: "halloween",
      label: "Halloween",
      hint: "bats and leaves drift behind everything",
      kinds: ["bat", "bat", "leaf"],
      size: [12, 24],
      n: 18,
      window: { month: 9, from: 18, to: 31 },
      palette: ["#ff8a3d", "#a06be0", "#e0b45f", "#c97b3a"],
      colors: { c1: "#e2813d", c2: "#a06be0" },
    },
    winter: {
      id: "winter",
      label: "Winter",
      hint: "snow drifts behind everything",
      kinds: ["snow"],
      size: [10, 18],
      n: 22,
      palette: ["#eef1f6", "#d9dee8", "#ffffff"],
      colors: { c1: "#7fb4e8", c2: "#b9d8f5" },
    },
    holidays: {
      id: "holidays",
      label: "Holidays",
      hint: "snow and gold light drift behind everything",
      kinds: ["snow", "star"],
      size: [10, 20],
      n: 22,
      window: { month: 11, from: 8, to: 31 },
      palette: ["#ffffff", "#f2d98c", "#c94f4f", "#8fd6a5"],
      colors: { c1: "#c94f4f", c2: "#8fd6a5" },
    },
    spring: {
      id: "spring",
      label: "Spring",
      hint: "blossom petals float behind everything",
      kinds: ["petal"],
      size: [11, 20],
      n: 14,
      palette: ["#e291b0", "#f0b8cf", "#d97b9c", "#f3cfe0"],
      colors: { c1: "#e291b0", c2: "#f0b8cf" },
    },
    summer: {
      id: "summer",
      label: "Summer",
      hint: "light motes drift behind everything",
      kinds: ["mote"],
      size: [8, 16],
      n: 12,
      palette: ["#e6c35c", "#f0d98c", "#f5e3a8"],
      colors: { c1: "#d9b64a", c2: "#f0d98c" },
    },
  };

  /* the seasons themselves: which months they cover, and which themes they
     offer. The first variant is the plain season and the one that wins when
     no holiday window is open. */
  var SEASONS = [
    { id: "winter", months: [11, 0, 1], variants: ["winter", "holidays"] },
    { id: "spring", months: [2, 3, 4], variants: ["spring"] },
    { id: "summer", months: [5, 6, 7], variants: ["summer"] },
    { id: "fall", months: [8, 9, 10], variants: ["fall", "halloween"] },
  ];

  function seasonFor(date) {
    var m = (date || new Date()).getMonth();
    return (
      SEASONS.find(function (s) {
        return s.months.indexOf(m) >= 0;
      }) || SEASONS[0]
    );
  }

  function themeFor(id) {
    return (id && THEMES[id]) || THEMES.fall;
  }

  /* is today inside a variant's own window? */
  function inWindow(t, date) {
    if (!t.window) return false;
    var d = date || new Date();
    return d.getMonth() === t.window.month && d.getDate() >= t.window.from && d.getDate() <= t.window.to;
  }

  /* the theme the calendar alone would pick right now */
  function autoTheme(date) {
    var season = seasonFor(date);
    var hit = null;
    season.variants.forEach(function (id) {
      if (inWindow(THEMES[id], date)) hit = id;
    });
    return THEMES[hit || season.variants[0]];
  }

  function detect() {
    /* dev-console preview wins over everything */
    var ov = N.prefs.get("seasonOverride");
    if (ov && THEMES[ov]) return THEMES[ov];
    /* then the theme the visitor picked in Settings */
    var pick = N.prefs.get("seasonVariant");
    if (pick && THEMES[pick]) return THEMES[pick];
    return autoTheme();
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
    var t = detect();
    var perf = N.prefs.get("perf");
    var reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (N.prefs.data.seasonal === false || gated() || perf || reduced) return;
    if (fx && fx.el.isConnected) return;

    var el = document.createElement("div");
    el.className = "season-fx";
    el.setAttribute("aria-hidden", "true");
    for (var i = 0; i < t.n; i++) {
      var svg = SHAPES[t.kinds[i % t.kinds.length]] || SHAPES.fall || SHAPES.mote;
      var p = document.createElement("span");
      p.className = "sf-p";
      var uri =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(svg.replace("{C}", t.palette[i % t.palette.length]));
      p.style.backgroundImage = "url(\"" + uri + "\")";
      var px = (t.size[0] + Math.random() * (t.size[1] - t.size[0])).toFixed(1);
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
    var t = detect();
    root.dataset.season = t.id;
    /* seasonal colors only when the user hasn't picked their own accent */
    if (!N.prefs.data.accent || N.prefs.data.accent === "off") {
      root.style.setProperty("--ac-1", t.colors.c1);
      root.style.setProperty("--ac-2", t.colors.c2);
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
    /* the theme the calendar alone would pick, ignoring any pick or preview */
    auto: autoTheme,
    /* every theme on offer for the season we are in: Settings lists these so
       the season and its holiday are both there to choose between */
    options: function (date) {
      var season = seasonFor(date);
      var auto = autoTheme(date);
      return season.variants.map(function (id) {
        return Object.assign({}, THEMES[id], { season: season.id, auto: id === auto.id });
      });
    },
    all: function () {
      return Object.keys(THEMES).map(function (id) {
        return Object.assign({}, THEMES[id]);
      });
    },
    /* Settings: choose which theme is worn. `id` is a theme id, or null for
       "Automatic" (the calendar, holiday windows included). Clears any
       dev-console preview so the choice actually takes. */
    setVariant: function (id) {
      N.prefs.set("seasonal", true);
      N.prefs.set("seasonOverride", null);
      N.prefs.set("seasonVariant", id && THEMES[id] ? id : null);
      refresh();
      return detect();
    },
    /* dev console: force a theme, follow the calendar, or turn it off */
    pick: function (id) {
      if (!id || id === "off") {
        N.prefs.set("seasonal", false);
        N.prefs.set("seasonOverride", null);
        N.prefs.set("seasonVariant", null);
      } else if (id === "auto") {
        N.prefs.set("seasonal", true);
        N.prefs.set("seasonOverride", null);
        N.prefs.set("seasonVariant", null);
      } else {
        N.prefs.set("seasonal", true);
        N.prefs.set("seasonOverride", id);
      }
      refresh();
    },
  };
})();
