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

  /* ---------- shop catalog ---------- */
  var THEMES = [
    { id: "synthwave", name: "Synthwave", c1: "#ff4fa8", c2: "#4fd8ff", price: 60, desc: "Pink + cyan neon accent, straight from 1986." },
    { id: "matrix", name: "Matrix", c1: "#3dff7a", c2: "#8affb2", price: 60, desc: "Phosphor-green accent for the terminal in you." },
    { id: "gold", name: "Gold", c1: "#ffd45e", c2: "#ffe9a8", price: 60, desc: "Warm gold accent. Flashy, but earned." },
  ];
  var BOOSTS = [
    { id: "xpboost", name: "XP boost", price: 30, desc: "Double XP for 24 hours — every 30 minutes banks 20 XP." },
  ];
  var FX = [
    { id: "goldconfetti", name: "Golden confetti", price: 30, desc: "Period-end confetti drops in gold instead of grayscale." },
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

  /* ---------- unlocks ---------- */
  function ownedList(type) {
    var u = data.unlocks || {};
    return u[type] || [];
  }
  function isUnlocked(type, id) {
    if (type === "boost") return boosted();
    return ownedList(type).indexOf(id) >= 0;
  }
  function priceFor(type, id) {
    var list = type === "theme" ? THEMES : type === "boost" ? BOOSTS : FX;
    var item = list.find(function (x) {
      return x.id === id;
    });
    return item ? item.price : 0;
  }

  /* Buy an item. Returns { ok, reason } — no partial state on failure. */
  function buy(type, id) {
    var price = priceFor(type, id);
    if (!price) return { ok: false, reason: "unknown item" };
    if (isUnlocked(type, id)) return { ok: false, reason: "already owned" };
    if (data.coins < price) return { ok: false, reason: "not enough coins" };
    data.coins -= price;
    if (type === "boost") {
      data.boostUntil = Date.now() + BOOST_MS;
    } else {
      var u = data.unlocks || (data.unlocks = { games: [], themes: [], fx: [] });
      (u[type] = u[type] || []).push(id);
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

  N.econ = {
    THEMES: THEMES,
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
    isUnlocked: isUnlocked,
    unlockedBetas: unlockedBetas,
  };
})();