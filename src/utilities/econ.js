 /* NULL · econ.js
   The NULL economy, fully local. Coins are paid for playtime, not for level:
   three a minute while a game is on screen and the tab is awake, plus 30
   coins every fifteen minutes on the site (see PLAY_PER_SEC and the play
   clock near the bottom). XP still banks as a bonus on top, and off it, for
   boosts. Coins unlock shop items: cosmetics, beta games, custom theme
   accents and the XP boost. Nothing ever leaves the browser.

   Unlock state lives in null:eco:
     { time, xp, coins, next, pend, boostUntil, unlocks: { games, themes, particles, fx },
       earned, buys, plays, seen, day, dgames, dsecs, dplays, qclaim, ach, qtotal,
       spins, spinDay, spinStreak, spinStreakDay, streak, lastPlayDay }

   Also owns progress: daily quests, permanent achievements and the once-a-day
   crate, all fed by trackPlay() / bank() and all paid out in coins. */
(function () {
  var N = (window.N = window.N || {});

  var KEY = "null:eco";
  var STEP = 1800; // 30 minutes of play per XP grant
  var XP_RATE = 10; // XP per STEP
  var COIN_EVERY = 100; // XP per coin milestone
  var COIN_AMOUNT = 30; // coins per milestone
  var BOOST_MS = 24 * 3600000; // XP boost lasts 24h
  var DAY = 86400000;

  function dayKey(t) {
    var n = new Date(t == null ? Date.now() : t);
    var m = n.getMonth() + 1;
    var d = n.getDate();
    return n.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
  }

  var data = N.store.read(KEY, {
    time: 0,
    xp: 0,
    coins: 0,
    next: COIN_EVERY,
    pend: 0,
    boostUntil: 0,
    unlocks: { games: [], themes: [], particles: [], fx: [] },
  });

  /* saves from before quests/achievements/crate existed get the new counters
     filled in, so a returning player keeps every coin and unlock */
  (function migrate() {
    var changed = false;
    function def(key, val) {
      if (data[key] === undefined) {
        data[key] = val;
        changed = true;
      }
    }
    if (!data.unlocks) {
      data.unlocks = {};
      changed = true;
    }
    ["games", "themes", "particles", "fx"].forEach(function (k) {
      if (!Array.isArray(data.unlocks[k])) {
        data.unlocks[k] = [];
        changed = true;
      }
    });
    def("earned", data.coins || 0); // coins banked over the account's life
    def("buys", 0);
    def("plays", 0);
    def("seen", []);
    def("day", dayKey());
    def("dgames", []);
    def("dsecs", 0);
    def("dplays", 0);
    def("qclaim", []);
    def("ach", []);
    def("qtotal", 0);
    def("spins", 0);
    def("spinDay", null);
    def("spinStreak", 0);
    def("spinStreakDay", null);
    def("streak", 0);
    def("lastPlayDay", null);
    if (changed) N.store.write(KEY, data);
  })();

  function save() {
    N.store.write(KEY, data);
  }

  /* another NULL window (a second tab, the installed app, a cloaked copy)
     may have spent coins or earned XP: re-read so the two agree */
  function reload() {
    var fresh = N.store.read(KEY, null);
    if (fresh) data = fresh;
  }
  if (N.sync) N.sync.register(reload);

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
      desc: "Neon '86: perspective grid floor, glowing horizon and a magenta sun.",
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
      parts: [{ k: "rain", n: 48, sp: "top" }],
      tint: ["#04180c", "#02060a"],
      desc: "Phosphor terminal: glyph rain falls behind a faint scanline haze.",
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
      desc: "Award-show gold: sweeping light shafts over warm film grain.",
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
      parts: [{ k: "ribbon", n: 14 }, { k: "star", n: 28 }],
      tint: ["#06181e", "#05060f"],
      desc: "Polar curtains: shimmering ribbons and glowing stars drift past.",
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
      parts: [{ k: "star", n: 96 }, { k: "starfar", n: 44 }, { k: "dust", n: 16 }],
      tint: ["#0b0a22", "#04040c"],
      desc: "Deep field: a dense twinkling starfield over a slow nebula bloom.",
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
      parts: [{ k: "smoke", n: 22, sp: "bottom" }, { k: "cloud", n: 7 }],
      tint: ["#120f2a", "#07121a"],
      desc: "Smoke lounge: soft puffs rise and drift through pastel cloud banks.",
      tags: ["Smoke", "Cloud banks", "Silky"],
    },
    /* the flagship pack, and the only one that ignores its own palette: it is
       painted from the live glow-border colours instead (theme.js publishes
       them as --glow-1..4), so the page and the border glow as one thing */
    {
      id: "neon",
      name: "Neon",
      price: 200,
      glowAccent: true,
      c1: "#00e5ff",
      c2: "#b14bff",
      colors: ["#00e5ff", "#b14bff", "#ff2d95", "#6cff9e"],
      bg: "neon",
      parts: [{ k: "neonTube", n: 12 }, { k: "neonPulse", n: 16 }, { k: "star", n: 22 }],
      tint: ["#050512", "#010103"],
      desc: "A glowing wireframe room lit by your glow border: tubes, halo blooms and floor grid all take the border's colours.",
      tags: ["Glow tubes", "Follows your glow", "Most expensive"],
    },
  ];

  /* Free packs: always available, deliberately quieter than the shop's.
     They reuse the same backdrop engine with fewer particles. */
  var FREE_PACKS = [
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
      parts: [{ k: "cloud", n: 5 }],
      tint: ["#101820", "#080b0f"],
      desc: "Cold morning haze: a few slow clouds, nothing else moving.",
      tags: ["Free", "Haze", "Slow"],
    },
  ];
  /* Ambient background particles: a layer of motion that runs behind every
     page, on its own or over a theme pack. `parts` lists the kinds and how
     many: theme.js turns that into DOM and extra.css draws each kind. Free
     particles are monochrome (mono) so they read in both site themes; shop
     particles carry their own little palette. */
  var FREE_PARTICLES = [
    {
      id: "motes",
      name: "Motes",
      free: true,
      price: 0,
      mono: true,
      desc: "Flat dots in hairline rings, rising slowly through wide panes of glass.",
      tags: ["Free", "Subtle", "Slow"],
      parts: [
        { k: "mote", n: 34, sp: "bottom" },
        { k: "bloom", n: 8, sp: "bottom" },
      ],
    },
    {
      id: "haze",
      name: "Haze",
      free: true,
      price: 0,
      mono: true,
      desc: "Wide frost panes, curling hairline wisps and a scatter of far-off specks.",
      tags: ["Free", "Clouds"],
      parts: [
        { k: "haze", n: 6 },
        { k: "wisp", n: 9 },
        { k: "speck", n: 20 },
      ],
    },
    {
      id: "twinkle",
      name: "Twinkle",
      free: true,
      price: 0,
      mono: true,
      desc: "Pin-prick dots that fade in and out, with slow hairline flares.",
      tags: ["Free", "Twinkle"],
      parts: [
        { k: "spark", n: 36 },
        { k: "flare", n: 8 },
      ],
    },
    /* Constellation used to sit here as a free pick. It is the front door's
       own backdrop now (home.js, via theme.js's netLayer), so there is
       nothing left to choose: the home page always has it and no other page
       needs a second copy of the same canvas. */
  ];

  var PARTICLES = [
    {
      id: "fireflies",
      name: "Fireflies",
      price: 70,
      colors: ["#ffe98a", "#ffd45e", "#fff6c9", "#f2a93b"],
      desc: "Small warm orbs wandering on long arcs, each trailing a short fading line.",
      tags: ["Glow", "Trails", "Wandering"],
      parts: [
        { k: "firefly", n: 22 },
        { k: "trail", n: 20 },
        { k: "speck", n: 22 },
      ],
    },
    {
      id: "embers",
      name: "Embers",
      price: 80,
      colors: ["#ff8a3d", "#ffb020", "#ff4d2e", "#ffe0a3"],
      desc: "Sparks climb off the bottom edge, flicker, and drag thin wisps up with them.",
      tags: ["Rising", "Flicker", "Smoke"],
      parts: [
        { k: "ember", n: 38, sp: "bottom" },
        { k: "bloom", n: 14, sp: "bottom" },
        { k: "wisp", n: 10, sp: "bottom" },
      ],
    },
    {
      id: "bubbles",
      name: "Bubbles",
      price: 80,
      colors: ["#9fe6ff", "#c9f2ff", "#7cc4ff", "#ffffff"],
      desc: "Hairline bubbles with one glint of light, rising and swelling out of sight.",
      tags: ["Rising", "Rings", "Glint"],
      parts: [
        { k: "bubble", n: 22, sp: "bottom" },
        { k: "glint", n: 18 },
        { k: "bloom", n: 8, sp: "bottom" },
      ],
    },
    {
      id: "starlight",
      name: "Starlight",
      price: 90,
      colors: ["#ffffff", "#dceaff", "#bcd4ff", "#ffffff"],
      desc: "Four-point stars fade in and out among slow cross flares and tiny specks.",
      tags: ["Stars", "Flares", "Depth"],
      parts: [
        { k: "sparkle", n: 28 },
        { k: "flare", n: 14 },
        { k: "speck", n: 28 },
      ],
    },
    {
      id: "plasma",
      name: "Plasma",
      price: 110,
      colors: ["#a86bff", "#3d8bff", "#ff4fa8", "#4fe0c8"],
      desc: "Soft colour fields roll slowly across the page over wide panes of glass.",
      tags: ["Colour", "Swirl", "Slow"],
      parts: [
        { k: "plasma", n: 8 },
        { k: "swirl", n: 3 },
        { k: "bloom", n: 7 },
      ],
    },
    {
      id: "warp",
      name: "Warp",
      price: 120,
      colors: ["#ffffff", "#9fe6ff", "#c9c2ff", "#ffffff"],
      desc: "Hairline rings open out of dead centre while streaks race past: lightspeed.",
      tags: ["Speed", "Radial", "Tunnel"],
      parts: [
        { k: "tunnel", n: 26, sp: "center" },
        { k: "warp", n: 90, sp: "center" },
        { k: "speck", n: 30 },
      ],
    },
  ];

  var BOOSTS = [
    { id: "xpboost", name: "XP boost", price: 30, desc: "Double XP for 24 hours: every 30 minutes banks 20 XP." },
  ];
  /* ---------- the cosmetics ----------
     kind decides which shelf an item sits on in the Shop (avatar / effect /
     tag); was is the crossed-out "before" price, which is set by hand so the
     numbers look like prices instead of round placeholders. */
  var COSMETICS = [
    /* avatar decorations: a loop that runs around the picture */
    { id: "orbit", kind: "avatar", name: "Orbit", price: 780, was: 920, desc: "A ring of light circling your picture." },
    { id: "halo", kind: "avatar", name: "Halo", price: 960, was: 1140, desc: "A soft ring that never quite touches." },
    { id: "eclipse", kind: "avatar", name: "Eclipse", price: 1040, was: 1240, desc: "A dark disc sliding across your edge." },
    { id: "stardust", kind: "avatar", name: "Stardust", price: 1180, was: 1400, desc: "Slow sparkles drifting off the frame." },
    { id: "prism", kind: "avatar", name: "Prism", price: 1240, was: 1460, desc: "A rotating band of colour round the rim." },
    { id: "signal", kind: "avatar", name: "Signal", price: 1320, was: 1560, desc: "Scanlines rolling up your picture." },
    { id: "solar", kind: "avatar", name: "Solar flare", price: 1480, was: 1720, desc: "A hot arc that laps you, once a loop." },
    { id: "rift", kind: "avatar", name: "Rift", price: 1600, was: 1880, desc: "Two rings spinning opposite ways." },

    /* profile effects: a moving layer over the whole card */
    { id: "doves", kind: "effect", name: "Doves", price: 980, was: 1180, desc: "Doves in flight across your card." },
    { id: "glitch", kind: "effect", name: "Glitch", price: 1120, was: 1340, desc: "Your card, thoroughly datamoshed." },
    { id: "duckpond", kind: "effect", name: "Duck Pond", price: 1260, was: 1480, desc: "Lily pads above, sunbeams below." },
    { id: "rainfall", kind: "effect", name: "Rainfall", price: 880, was: 1040, desc: "Fine rain over everything." },
    { id: "embers", kind: "effect", name: "Embers", price: 1060, was: 1260, desc: "Slow orange sparks rising off the card." },
    { id: "aurora", kind: "effect", name: "Aurora", price: 1420, was: 1660, desc: "Bands of light drifting behind the card." },

    /* name tags: a chip that sits next to your name */
    { id: "tstar", kind: "tag", name: "STAR", price: 720, was: 880, color: "#f0c85a", desc: "effortlessly" },
    { id: "tcool", kind: "tag", name: "COOL", price: 760, was: 900, color: "#6cc7ff", desc: "effortlessly" },
    { id: "ttuff", kind: "tag", name: "TUFF", price: 820, was: 980, color: "#e2686a", desc: "Certified tuff" },
    { id: "tspecial", kind: "tag", name: "SPECIAL", price: 900, was: 1080, color: "#c08bff", desc: "One of a kind" },
    { id: "taura", kind: "tag", name: "AURA", price: 960, was: 1140, color: "#58c98e", desc: "+1000 aura" },
    { id: "tname", kind: "tag", name: "NAME", price: 720, was: 860, color: "#b9b9c0", desc: "It just says NAME" },
    { id: "tlarp", kind: "tag", name: "LARP", price: 1040, was: 1240, color: "#ff8a5c", desc: "None of it was real" },
  ];

  var FX = [
    { id: "goldconfetti", name: "Golden confetti", price: 30, desc: "Period-end confetti drops in gold instead of grayscale." },
    { id: "rainbowconfetti", name: "Rainbow confetti", price: 60, desc: "Period-end confetti drops in every colour of the rainbow. Wins over golden if you own both." },
    { id: "customaccent", name: "Custom accent color", price: 80, desc: "Unlocks a color picker in Settings, so your accent can be any color at all." },
    { id: "custombg", name: "Custom background image", price: 100, desc: "Unlocks a background picture in Settings: paste a link or upload a file, then set how it fits, how far it dims behind the page and how soft it is." },
    { id: "editor", name: "Theme & particle editor", price: 150, desc: "Unlocks the editor in the Shop: build your own theme pack and particle set, pick the colours, tint, backdrop art and exactly what drifts through it." },
  ];

  /* the Shop sells FX plus the cosmetics; the cosmetics are kept in their own
     list so the shelf order stays readable and priceFor() still finds them */
  var ALL_FX = FX.concat(COSMETICS);

  /* the editor's two creations are stored by theme.js (null:craft) and owned
     for as long as the editor is. They are never bought on their own. */
  var CRAFT_PACK = "mypack";
  var CRAFT_PART = "mypart";
  function editorOn() {
    return ownedList("fx").indexOf("editor") >= 0;
  }

  function boosted() {
    return data.boostUntil > Date.now();
  }

  /* low-level: every internal caller saves once at the end of its own change */
  function addCoins(n) {
    data.coins += n;
    data.earned += n;
  }

  /* public: hand the player coins and persist it, so a caller outside this
     file can never leave the new balance sitting in memory only */
  function giveCoins(n) {
    addCoins(n);
    save();
    N.bus.emit("eco");
    /* extensions hear about it too (ext.js). Guarded: the economy runs before
       the extension runtime exists on some pages */
    if (N.ext) N.ext.emit("coins:earn", { n: n, total: data.coins });
    return data.coins;
  }

  /* ---------- daily rollover ----------
     Quest progress, playtime counters and the crate are per-day; XP, coins
     and unlocks are permanent. */
  function ensureDay() {
    var t = dayKey();
    if (data.day === t) return;
    data.day = t;
    data.dgames = [];
    data.dsecs = 0;
    data.dplays = 0;
    data.qclaim = [];
    save();
    N.bus.emit("eco");
  }

  /* Bank playtime. Returns { xp, coins } gained so callers can celebrate. */
  function bank(seconds) {
    if (!(seconds > 0)) return { xp: 0, coins: 0 };
    ensureDay();
    data.time += seconds;
    data.dsecs += seconds;
    data.pend += seconds;
    var xp = 0;
    while (data.pend >= STEP) {
      data.pend -= STEP;
      data.xp += boosted() ? XP_RATE * 2 : XP_RATE;
      xp += boosted() ? XP_RATE * 2 : XP_RATE;
    }
    var coins = 0;
    while (data.xp >= data.next) {
      addCoins(COIN_AMOUNT);
      coins += COIN_AMOUNT;
      data.next += COIN_EVERY;
    }
    save();
    if (N.ext) {
      if (xp) N.ext.emit("xp:gain", { n: xp, xp: data.xp, level: data.next });
      if (coins) N.ext.emit("coins:earn", { n: coins, total: data.coins, from: "play" });
    }
    return { xp: xp, coins: coins };
  }

  /* ---------- progress signals ----------
     catalog.js calls trackPlay() once per launch, so quests, streaks and the
     achievement counters all read from one place. Only games count. */
  function trackPlay(kind, id) {
    if (kind !== "game" || !id) return;
    ensureDay();
    data.plays += 1;
    data.dplays += 1;
    if (data.dgames.indexOf(id) < 0) data.dgames.push(id);
    if (data.seen.indexOf(id) < 0) data.seen.push(id);
    var today = dayKey();
    if (data.lastPlayDay !== today) {
      data.streak = data.lastPlayDay === dayKey(Date.now() - DAY) ? (data.streak || 0) + 1 : 1;
      data.lastPlayDay = today;
    }
    save();
    N.bus.emit("eco");
  }

  /* ---------- daily quests ----------
     Three rotate in per day, picked from the date so they stay put all day
     and change overnight without storing a schedule. Claiming pays coins. */
  var QUEST_POOL = [
    { id: "warmup", name: "Warm up", hint: "Play a game", metric: "plays", goal: 1, reward: 5 },
    { id: "sprint", name: "Quick sprint", hint: "Play 2 games", metric: "plays", goal: 2, reward: 8 },
    { id: "explorer", name: "Explorer", hint: "Play 3 different games", metric: "games", goal: 3, reward: 12 },
    { id: "sampler", name: "Sampler", hint: "Play 4 different games", metric: "games", goal: 4, reward: 16 },
    { id: "focus", name: "Deep focus", hint: "Play for 15 minutes", metric: "secs", goal: 900, reward: 15 },
    { id: "haul", name: "Long haul", hint: "Play for 30 minutes", metric: "secs", goal: 1800, reward: 25 },
  ];

  function dayHash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function metricVal(m) {
    if (m === "plays") return data.dplays;
    if (m === "games") return data.dgames.length;
    if (m === "secs") return data.dsecs;
    return 0;
  }
  function quests() {
    ensureDay();
    var h = dayHash(data.day);
    var out = [];
    for (var i = 0; i < 3; i++) {
      var q = QUEST_POOL[(h + i * 2) % QUEST_POOL.length];
      var prog = Math.min(metricVal(q.metric), q.goal);
      out.push({
        id: q.id,
        name: q.name,
        hint: q.hint,
        metric: q.metric,
        reward: q.reward,
        goal: q.goal,
        prog: prog,
        done: prog >= q.goal,
        claimed: data.qclaim.indexOf(q.id) >= 0,
      });
    }
    return out;
  }
  function claimQuest(id) {
    var q = quests().filter(function (x) {
      return x.id === id;
    })[0];
    if (!q || !q.done || q.claimed) return { ok: false };
    data.qclaim.push(id);
    data.qtotal += 1;
    addCoins(q.reward);
    save();
    N.bus.emit("eco");
    if (N.ext) N.ext.emit("quest:done", { id: id, coins: q.reward });
    return { ok: true, reward: q.reward };
  }

  /* ---------- achievements ----------
     Permanent milestones. `val` reads the live counters, so bars fill as you
     play; claiming pays coins once. */
  function stats() {
    return {
      plays: data.plays,
      diff: data.seen.length,
      secs: data.time,
      xp: data.xp,
      earned: data.earned,
      buys: data.buys,
      themes: (data.unlocks.themes || []).length,
      particles: (data.unlocks.particles || []).length,
      quests: data.qtotal,
      spins: data.spins,
      streak: data.streak,
    };
  }
  var ACHS = [
    { id: "first", name: "First steps", hint: "Play your first game", reward: 10, goal: 1, val: function (s) { return s.plays; } },
    { id: "sampler", name: "Sampler", hint: "Play 5 different games", reward: 25, goal: 5, val: function (s) { return s.diff; } },
    { id: "collector", name: "Collector", hint: "Play 12 different games", reward: 60, goal: 12, val: function (s) { return s.diff; } },
    { id: "regular", name: "Creature of habit", hint: "Launch games 25 times", reward: 30, goal: 25, val: function (s) { return s.plays; } },
    { id: "hour", name: "One hour in", hint: "Play for 1 hour", reward: 30, goal: 3600, val: function (s) { return s.secs; } },
    { id: "deep", name: "Five hours deep", hint: "Play for 5 hours", reward: 80, goal: 18000, val: function (s) { return s.secs; } },
    { id: "grinder", name: "Grinder", hint: "Reach 250 XP", reward: 30, goal: 250, val: function (s) { return s.xp; } },
    { id: "purse", name: "Coin purse", hint: "Bank 150 coins", reward: 20, goal: 150, val: function (s) { return s.earned; } },
    { id: "spender", name: "Big spender", hint: "Buy something in the Shop", reward: 20, goal: 1, val: function (s) { return s.buys; } },
    { id: "designer", name: "Interior designer", hint: "Own 3 theme packs", reward: 40, goal: 3, val: function (s) { return s.themes; } },
    { id: "atmos", name: "Atmosphere", hint: "Own 2 particle sets", reward: 30, goal: 2, val: function (s) { return s.particles; } },
    { id: "runner", name: "Quest runner", hint: "Claim 7 daily quests", reward: 50, goal: 7, val: function (s) { return s.quests; } },
    { id: "lucky", name: "Lucky", hint: "Open the crate 5 times", reward: 25, goal: 5, val: function (s) { return s.spins; } },
    { id: "streak3", name: "Three in a row", hint: "Play 3 days in a row", reward: 35, goal: 3, val: function (s) { return s.streak; } },
  ];
  function achievements() {
    ensureDay();
    var s = stats();
    return ACHS.map(function (a) {
      var v = Math.min(a.val(s), a.goal);
      return {
        id: a.id,
        name: a.name,
        hint: a.hint,
        reward: a.reward,
        goal: a.goal,
        prog: v,
        done: v >= a.goal,
        claimed: data.ach.indexOf(a.id) >= 0,
      };
    });
  }
  function claimAch(id) {
    var a = achievements().filter(function (x) {
      return x.id === id;
    })[0];
    if (!a || !a.done || a.claimed) return { ok: false };
    data.ach.push(id);
    addCoins(a.reward);
    save();
    N.bus.emit("eco");
    if (N.ext) N.ext.emit("quest:done", { id: id, coins: a.reward, ach: true });
    return { ok: true, reward: a.reward };
  }

  /* ---------- daily crate ----------
     One free open per day, weighted toward small coin drops with a rare
     jackpot, plus a +5/day streak bonus so coming back keeps paying. */
  var SPIN_POOL = [
    { type: "coins", amount: 5, w: 26 },
    { type: "coins", amount: 10, w: 24 },
    { type: "coins", amount: 15, w: 20 },
    { type: "coins", amount: 25, w: 14 },
    { type: "coins", amount: 40, w: 9 },
    { type: "xp", amount: 20, w: 5 },
    { type: "coins", amount: 75, w: 2 },
  ];
  function canSpin() {
    ensureDay();
    return data.spinDay !== data.day;
  }
  /* what the streak *would* be if you opened the crate today */
  function spinStreak() {
    ensureDay();
    if (data.spinStreakDay === data.day) return data.spinStreak || 1;
    return data.spinStreakDay === dayKey(Date.now() - DAY) ? (data.spinStreak || 0) + 1 : 1;
  }
  function spin() {
    ensureDay();
    if (data.spinDay === data.day) return { ok: false, reason: "already" };
    var total = SPIN_POOL.reduce(function (n, p) {
      return n + p.w;
    }, 0);
    var r = Math.random() * total;
    var acc = 0;
    var prize = SPIN_POOL[SPIN_POOL.length - 1];
    for (var i = 0; i < SPIN_POOL.length; i++) {
      acc += SPIN_POOL[i].w;
      if (r < acc) {
        prize = SPIN_POOL[i];
        break;
      }
    }
    data.spinStreak = spinStreak();
    data.spinStreakDay = data.day;
    data.spinDay = data.day;
    data.spins += 1;
    var bonus = Math.min(25, (data.spinStreak - 1) * 5);
    if (prize.type === "xp") data.xp += prize.amount;
    else addCoins(prize.amount);
    if (bonus) addCoins(bonus);
    save();
    N.bus.emit("eco");
    if (N.ext) {
      N.ext.emit("crate:open", { coins: prize.type === "coins" ? prize.amount + bonus : bonus, streak: data.spinStreak });
      if (prize.type === "coins") N.ext.emit("coins:earn", { n: prize.amount + bonus, total: data.coins, from: "crate" });
    }
    return { ok: true, type: prize.type, amount: prize.amount, bonus: bonus, streak: data.spinStreak };
  }

  /* ---------- unlocks ----------
     "game" unlocks are the shop's beta builds, which come from the
     hand-maintained content.js list: the same list the Shop page renders. */
  function listFor(type) {
    if (type === "theme") return THEMES;
    if (type === "particle") return PARTICLES;
    if (type === "boost") return BOOSTS;
    if (type === "fx") return ALL_FX;
    if (type === "game") return (window.NULL_CONTENT && window.NULL_CONTENT.betas) || [];
    return [];
  }
  function keyFor(type) {
    if (type === "game") return "games";
    if (type === "particle") return "particles";
    return type;
  }
  function ownedList(type) {
    var u = data.unlocks || {};
    return u[keyFor(type)] || [];
  }
  /* free theme packs + free particles are owned by everyone */
  function isFree(type, id) {
    if (type === "theme") {
      return FREE_PACKS.some(function (p) {
        return p.id === id;
      });
    }
    if (type === "particle") {
      return FREE_PARTICLES.some(function (p) {
        return p.id === id;
      });
    }
    return false;
  }
  function isUnlocked(type, id) {
    if (type === "boost") return boosted();
    if (type === "theme" && id === CRAFT_PACK) return editorOn();
    if (type === "particle" && id === CRAFT_PART) return editorOn();
    if (isFree(type, id)) return true;
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

  /* Buy an item. Returns { ok, reason }: no partial state on failure. */
  function buy(type, id) {
    var price = priceFor(type, id);
    if (!price) return { ok: false, reason: isFree(type, id) ? "free" : "unknown item" };
    if (isUnlocked(type, id)) return { ok: false, reason: "already owned" };
    if (data.coins < price) return { ok: false, reason: "not enough coins" };
    data.coins -= price;
    data.buys += 1;
    if (N.ext) {
      N.ext.emit("coins:spend", { n: price, total: data.coins, type: type, id: id });
      N.ext.emit("unlock", { type: type, id: id });
    }
    if (type === "boost") {
      data.boostUntil = Date.now() + BOOST_MS;
    } else {
      var u = data.unlocks || (data.unlocks = { games: [], themes: [], particles: [], fx: [] });
      var key = keyFor(type);
      (u[key] = u[key] || []).push(id);
    }
    save();
    N.bus.emit("eco");
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

  /* everything permanent in the shop, owned. Boosts are excluded on purpose:
     they are a timed consumable, not an unlock. shop.js watches this for the
     credits hand-off. */
  function shopComplete() {
    var kinds = { theme: THEMES, particle: PARTICLES, fx: FX };
    var done = Object.keys(kinds).every(function (type) {
      return kinds[type].every(function (it) {
        return !it.price || isUnlocked(type, it.id);
      });
    });
    if (!done) return false;
    var betas = (window.NULL_CONTENT && window.NULL_CONTENT.betas) || [];
    return betas.every(function (b) {
      return isUnlocked("game", b.id);
    });
  }

  /* dev console: own every permanent shop item at once, coins untouched.
     Timed boosts are skipped (they expire, they are not an unlock) and beta
     games go through the same grant path so catalog.js picks them up. */
  function unlockAll() {
    var groups = { theme: THEMES, particle: PARTICLES, fx: FX };
    var n = 0;
    Object.keys(groups).forEach(function (type) {
      groups[type].forEach(function (it) {
        if (!it.price || isUnlocked(type, it.id)) return;
        grant(type, it.id);
        n++;
      });
    });
    var betas = (window.NULL_CONTENT && window.NULL_CONTENT.betas) || [];
    betas.forEach(function (b) {
      if (isUnlocked("game", b.id)) return;
      grant("game", b.id);
      n++;
    });
    return n;
  }

  /* dev console / debugging: unlock an item without spending coins, so a
     backdrop can be checked without grinding 20 hours of playtime first. */
  function grant(type, id) {
    if (isFree(type, id)) return { ok: true };
    if (type === "boost") {
      data.boostUntil = Date.now() + BOOST_MS;
    } else {
      var u = data.unlocks || (data.unlocks = { games: [], themes: [], particles: [], fx: [] });
      var key = keyFor(type);
      var list = u[key] || (u[key] = []);
      if (list.indexOf(id) < 0) list.push(id);
    }
    save();
    if (N.ext) N.ext.emit("unlock", { type: type, id: id });
    return { ok: true };
  }

  /* ---------- the play clock ----------
     Coins come from time, not from a level: three a minute while a game or
     an app is actually open, paid a coin at a time so the number in the Shop
     moves while you play, plus a 30 coin milestone every 15 minutes on the
     site.

     "Actually open" is the whole design. The clock does not run until
     play(true) is called (the player does it when a game opens), it stops the
     moment the tab is hidden, and it stops again after a minute and a half
     with no keystroke, click, scroll or pointer move. A page left open on a
     desk overnight earns nothing. */
  var PLAY_PER_SEC = 3 / 60; // 3 a minute: 15 every five
  var IDLE_MS = 90 * 1000;
  var MILESTONE_S = 15 * 60;
  var MILESTONE_COINS = 30;

  var clock = { on: false, carry: 0, ran: 0, idle: 0, at: 0, timer: 0 };

  function clockLive() {
    return clock.on && !document.hidden && clock.idle < IDLE_MS;
  }

  function clockTick() {
    var now = Date.now();
    var secs = Math.min(5, Math.max(0, (now - clock.at) / 1000));
    clock.at = now;
    if (!clockLive()) return;

    clock.ran += secs;
    clock.carry += secs * PLAY_PER_SEC;
    var whole = Math.floor(clock.carry);
    if (whole > 0) {
      clock.carry -= whole;
      giveCoins(whole);
      N.bus.emit("playCoins", { coins: whole, milestone: false });
    }
    if (clock.ran >= MILESTONE_S) {
      clock.ran -= MILESTONE_S;
      giveCoins(MILESTONE_COINS);
      N.bus.emit("playCoins", { coins: MILESTONE_COINS, milestone: true });
    }
  }

  /* one set of listeners for the whole site, put on the first time the clock
     runs: nothing ever touches the machine while no game is open */
  function clockListen() {
    if (clock.timer) return;
    function wake() {
      clock.idle = 0;
    }
    ["pointermove", "pointerdown", "keydown", "wheel", "scroll", "touchstart"].forEach(function (ev) {
      window.addEventListener(ev, wake, { passive: true });
    });
    clock.timer = setInterval(function () {
      if (!clock.on) return;
      /* the idle count only ever climbs here; wake() is what knocks it back
         down, so once it passes the limit nothing is paid until real input */
      clock.idle += 1;
      clockTick();
    }, 1000);
  }

  /* the player turns the clock on when a game opens and off when it closes */
  function play(on) {
    on = !!on;
    if (on === clock.on) return;
    clock.on = on;
    clock.at = Date.now();
    if (on) clockListen();
    N.bus.emit("playState", on);
  }

  N.econ = {
    THEMES: THEMES,
    /* the Shop's own shelves (see COSMETICS above) */
    COSMETICS: COSMETICS,
    /* the play clock: play(true) while a game is open, play(false) when it is not */
    play: play,
    playState: function () {
      return { on: clock.on, ran: Math.round(clock.ran), live: clockLive(), idle: clock.idle };
    },
    FREE_PACKS: FREE_PACKS,
    PARTICLES: PARTICLES,
    FREE_PARTICLES: FREE_PARTICLES,
    BOOSTS: BOOSTS,
    FX: FX,
    state: function () {
      ensureDay();
      return {
        time: data.time,
        xp: data.xp,
        coins: data.coins,
        next: data.next,
        boosted: boosted(),
        boostUntil: data.boostUntil,
        streak: data.streak,
        plays: data.plays,
        earned: data.earned,
        canSpin: canSpin(),
        spinStreak: spinStreak(),
        questsReady: quests().filter(function (q) {
          return q.done && !q.claimed;
        }).length,
        achReady: achievements().filter(function (a) {
          return a.done && !a.claimed;
        }).length,
      };
    },
    bank: bank,
    buy: buy,
    grant: grant,
    unlockAll: unlockAll,
    reload: reload,
    isUnlocked: isUnlocked,
    shopComplete: shopComplete,
    unlockedBetas: unlockedBetas,
    /* progress: quests, achievements and the daily crate */
    trackPlay: trackPlay,
    quests: quests,
    claimQuest: claimQuest,
    achievements: achievements,
    claimAch: claimAch,
    canSpin: canSpin,
    spin: spin,
    spinStreak: spinStreak,
    spinPool: SPIN_POOL,
    stats: stats,
    /* dev console: hand out coins / reset daily progress */
    giveCoins: giveCoins,
    newDay: function () {
      data.day = "";
      data.spinDay = null;
      ensureDay();
    },
  };
})();