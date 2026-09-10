/* NULL — seasons.js
   Seasonal theme: a light ambient pass driven by the calendar.
   Sets html[data-season] so CSS can tint the page, and when the user's
   accent is off, fills --ac-* with the season's colors. Also drops a
   drifting particle layer behind everything — fall leaves, winter snow,
   spring petals, summer light motes. Skipped on the player and 404, in
   performance mode, and for reduced-motion users. */
(function () {
  var N = (window.N = window.N || {});
  var root = document.documentElement;

  var SEASONS = [
    { id: "winter", label: "Winter", hint: "snow drifts behind everything", months: [11, 0, 1], chars: ["\u2744\ufe0f"], n: 22 },
    { id: "spring", label: "Spring", hint: "blossom petals float behind everything", months: [2, 3, 4], chars: ["\u{1F338}"], n: 14 },
    { id: "summer", label: "Summer", hint: "light motes drift behind everything", months: [5, 6, 7], chars: ["\u2726"], n: 12 },
    { id: "fall", label: "Fall", hint: "leaves drift behind everything", months: [8, 9, 10], chars: ["\u{1F342}", "\u{1F341}"], n: 16 },
  ];

  /* used for --ac-* when the user hasn't picked their own accent */
  var COLORS = {
    fall: { c1: "#d98e3d", c2: "#e6b45f" },
    winter: { c1: "#7fb4e8", c2: "#b9d8f5" },
    spring: { c1: "#e291b0", c2: "#f0b8cf" },
    summer: { c1: "#d9b64a", c2: "#f0d98c" },
  };

  function detect() {
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

    var el = document.createElement("div");
    el.className = "season-fx";
    el.setAttribute("aria-hidden", "true");
    for (var i = 0; i < s.n; i++) {
      var p = document.createElement("span");
      p.className = "sf-p";
      p.textContent = s.chars[i % s.chars.length];
      p.style.left = (Math.random() * 100).toFixed(2) + "%";
      p.style.fontSize = (10 + Math.random() * 13).toFixed(1) + "px";
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
  };
})();