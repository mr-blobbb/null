/* NULL — econ.js
   The NULL economy, fully local. Playtime banks XP (10 XP per full 30
   minutes in the player, 20 while a boost is active); every 100 XP banks
   30 coins. Coins unlock shop items — beta games, custom theme accents,
   the XP boost and effects. Nothing ever leaves the browser.

   Unlock state lives in null:eco:
     { time, xp, coins, next, pend, boostUntil, unlocks: { games, themes, fx } } */
(function () {
  var N = (window.N = window.N || {});

  var KEY = "null:eco";
  var STEP = 1800; // 30 minutes of play per XP grant
  var XP_RATE = 10; // XP per STEP
  var COIN_EVERY = 100; // XP per coin milestone
  var COIN_AMOUNT = 30; // coins per milestone
  var BOOST_MS = 24 * 3600000; // XP boost lasts 24h

  var data = N.store.read(KEY, {
    time: 0,
    xp: 0,
    coins: 0,
    next: COIN_EVERY,
    pend: 0,
    boostUntil: 0,
    unlocks: { games: [], themes: [], fx: [] },
  });

  function save() {
    N.store.write(KEY, data);
  }

  /* ---------- shop catalog ----------
     Themes are full packs, not single accents: a multi-colour palette, the
     accent pair that drives the UI, and an animated backdrop. theme.js reads
     `colors` / `bg` / `tint` / `parts` when applying a pack, extra.css holds
     the art. `parts` lists the drifting particles: the key is a shape kind,
     n is how many, sp is where they start (top / bottom / spread). */
  var THEMES = [
    {
      id: "synthwave",
      name: "Synthwave",
      price: 60,
      c1: "#ff4fa8",
      c2: "#4fd8ff",
      colors: ["#ff4fa8", "#a45bff", "#4fd8ff", "#ffd166"],
      bg: "horizon",
      parts: [],
      tint: ["#2a1140", "#07091b"],
      desc: "Neon '86 — perspective grid floor, glowing horizon and a magenta sun.",
      tags: ["Grid floor", "Neon sun", "4 colors"],
    },
    {
      id: "matrix",
      name: "Matrix",
      price: 60,
      c1: "#3dff7a",
      c2: "#8affb2",
      colors: ["#39ff88", "#0aff9d", "#6fffb0", "#c8ffdd"],
      bg: "rain",
      parts: [{ k: "rain", n: 34, sp: "top" }],
      tint: ["#04180c", "#02060a"],
      desc: "Phosphor terminal — glyph rain falls behind a faint scanline haze.",
      tags: ["Code rain", "Scanlines", "Terminal"],
    },
    {
      id: "gold",
      name: "Gold",
      price: 90,
      c1: "#ffd45e",
      c2: "#ffe9a8",
      colors: ["#ffd45e", "#f2a93b", "#fff0bf", "#8a6a1f"],
      bg: "rays",
      parts: [],
      tint: ["#1d1403", "#0a0a0b"],
      desc: "Award-show gold — sweeping light shafts over warm film grain.",
      tags: ["Light shafts", "Film grain", "Warm tint"],
    },
    {
      id: "aurora",
      name: "Aurora",
      price: 90,
      c1: "#4fe0c8",
      c2: "#8f9dff",
      colors: ["#4fe0c8", "#7c8cff", "#b06bff", "#3ba0ff"],
      bg: "aurora",
      parts: [{ k: "ribbon", n: 10 }, { k: "star", n: 16 }],
      tint: ["#06181e", "#05060f"],
      desc: "Polar curtains — shimmering ribbons and glowing stars drift past.",
      tags: ["Aurora ribbons", "Stars", "Calm"],
    },
    {
      id: "cosmos",
      name: "Cosmos",
      price: 120,
      c1: "#8f9dff",
      c2: "#d18cff",
      colors: ["#8f9dff", "#e06fff", "#5ac8ff", "#ffe6a8"],
      bg: "stars",
      parts: [{ k: "star", n: 64 }, { k: "starfar", n: 30 }, { k: "dust", n: 10 }],
      tint: ["#0b0a22", "#04040c"],
      desc: "Deep field — a dense twinkling starfield over a slow nebula bloom.",
      tags: ["Starfield", "Drifting dust", "Nebula"],
    },
    {
      id: "vapor",
      name: "Vapor",
      price: 120,
      c1: "#7ef2d0",
      c2: "#ff9ad5",
      colors: ["#7ef2d0", "#ff9ad5", "#a6b8ff", "#ffe07a"],
      bg: "waves",
      parts: [{ k: "smoke", n: 14, sp: "bottom" }, { k: "cloud", n: 6 }],
      tint: ["#120f2a", "#07121a"],
      desc: "Smoke lounge — soft puffs rise and drift through pastel cloud banks.",
      tags: ["Smoke", "Cloud banks", "Silky"],
    },
  ];

  /* Free packs — always available, deliberately quieter than the shop's.
     They reuse the same backdrop engine with fewer particles. */
  var FREE_PACKS = [
    {
      id: "graphite",
      name: "Graphite",
      free: true,
      price: 0,
      c1: "#e6e7ea",
      c2: "#a2a6ae",
      colors: ["#e6e7ea", "#a2a6ae", "#6e727c", "#3a3c42"],
      bg: "vignette",
      parts: [],
      tint: ["#0d0d10", "#070709"],
      desc: "NULL's own house look — a quiet vignette and a whisper of grain.",
      tags: ["Free", "Monochrome", "Subtle"],
    },
    {
      id: "dawn",
      name: "Dawn",
      free: true,
      price: 0,
      c1: "#ff9d6b",
      c2: "#ffd0a8",
      colors: ["#ff9d6b", "#ff8fb0", "#ffd7a8", "#8f6bd6"],
      bg: "glow",
      parts: [],
      tint: ["#1a1020", "#0a0a0f"],
      desc: "A warm sunrise glow that fades into the page. No motion, no noise.",
      tags: ["Free", "Sunrise", "Static"],
    },
    {
      id: "mist",
      name: "Mist",
      free: true,
      price: 0,
      c1: "#9fd8e8",
      c2: "#c8c2f0",
      colors: ["#9fd8e8", "#c8c2f0", "#8fb8d8", "#e6f0f5"],
      bg: "mist",
      parts: [{ k: "cloud", n: 4 }],
      tint: ["#101820", "#080b0f"],
      desc: "Cold morning haze — a few slow clouds, nothing else moving.",
      tags: ["Free", "Haze", "Slow"],
    },
  ];
  var BOOSTS = [
    { id: "xpboost", name: "XP boost", price: 30, desc: "Double XP for 24 hours — every 30 minutes banks 20 XP." },
  ];
  var FX = [
    { id: "goldconfetti", name: "Golden confetti", price: 30, desc: "Period-end confetti drops in gold instead of grayscale." },
    { id: "customaccent", name: "Custom accent color", price: 80, desc: "Unlocks a color picker in Settings, so your accent can be any color at all." },
  ];

  function boosted() {
    return data.boostUntil > Date.now();
  }

  /* Bank playtime. Returns { xp, coins } gained so callers can celebrate. */
  function bank(seconds) {
    if (!(seconds > 0)) return { xp: 0, coins: 0 };
    data.time += seconds;
    data.pend += seconds;
    var xp = 0;
    while (data.pend >= STEP) {
      data.pend -= STEP;
      data.xp += boosted() ? XP_RATE * 2 : XP_RATE;
      xp += boosted() ? XP_RATE * 2 : XP_RATE;
    }
    var coins = 0;
    while (data.xp >= data.next) {
      data.coins += COIN_AMOUNT;
      coins += COIN_AMOUNT;
      data.next += COIN_EVERY;
    }
    save();
    return { xp: xp, coins: coins };
  }

  /* ---------- unlocks ----------
     "game" unlocks are the shop's beta builds, which come from the
     hand-maintained content.js list — the same list the Shop page renders. */
  function listFor(type) {
    if (type === "theme") return THEMES;
    if (type === "boost") return BOOSTS;
    if (type === "fx") return FX;
    if (type === "game") return (window.NULL_CONTENT && window.NULL_CONTENT.betas) || [];
    return [];
  }
  function keyFor(type) {
    return type === "game" ? "games" : type;
  }
  function ownedList(type) {
    var u = data.unlocks || {};
    return u[keyFor(type)] || [];
  }
  function isFreePack(id) {
    return FREE_PACKS.some(function (p) {
      return p.id === id;
    });
  }
  function isUnlocked(type, id) {
    if (type === "boost") return boosted();
    if (type === "theme" && isFreePack(id)) return true;
    return ownedList(type).indexOf(id) >= 0;
  }
  function priceFor(type, id) {
    var list = listFor(type);
    var item = list.find(function (x) {
      return x.id === id;
    });
    if (!item) return 0;
    return item.price || (type === "game" ? 60 : 0);
  }

  /* Buy an item. Returns { ok, reason } — no partial state on failure. */
  function buy(type, id) {
    var price = priceFor(type, id);
    if (!price) return { ok: false, reason: isFreePack(id) ? "free" : "unknown item" };
    if (isUnlocked(type, id)) return { ok: false, reason: "already owned" };
    if (data.coins < price) return { ok: false, reason: "not enough coins" };
    data.coins -= price;
    if (type === "boost") {
      data.boostUntil = Date.now() + BOOST_MS;
    } else {
      var u = data.unlocks || (data.unlocks = { games: [], themes: [], fx: [] });
      var key = keyFor(type);
      (u[key] = u[key] || []).push(id);
    }
    save();
    return { ok: true };
  }

  /* beta games come from hand-maintained content.js entries; econ decides
     which are unlocked so catalog.js can merge them in at runtime. */
  function unlockedBetas() {
    if (!window.NULL_CONTENT || !window.NULL_CONTENT.betas) return [];
    return window.NULL_CONTENT.betas.filter(function (b) {
      return isUnlocked("game", b.id);
    });
  }

  /* dev console / debugging: unlock an item without spending coins, so a
     backdrop can be checked without grinding 20 hours of playtime first. */
  function grant(type, id) {
    if (type === "theme" && isFreePack(id)) return { ok: true };
    if (type === "boost") {
      data.boostUntil = Date.now() + BOOST_MS;
    } else {
      var u = data.unlocks || (data.unlocks = { games: [], themes: [], fx: [] });
      var key = keyFor(type);
      var list = u[key] || (u[key] = []);
      if (list.indexOf(id) < 0) list.push(id);
    }
    save();
    return { ok: true };
  }

  N.econ = {
    THEMES: THEMES,
    FREE_PACKS: FREE_PACKS,
    BOOSTS: BOOSTS,
    FX: FX,
    state: function () {
      return {
        time: data.time,
        xp: data.xp,
        coins: data.coins,
        next: data.next,
        boosted: boosted(),
        boostUntil: data.boostUntil,
      };
    },
    bank: bank,
    buy: buy,
    grant: grant,
    isUnlocked: isUnlocked,
    unlockedBetas: unlockedBetas,
  };
})();