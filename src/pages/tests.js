/* NULL — tests.js
   The static test runner behind /tests. It replaces the old Node + jsdom
   scripts/*.cjs suite: the real pages are loaded into same-origin iframes and
   asserted on what they actually render, and the economy / catalog logic is
   driven directly through the modules the site ships.

   Everything is read-only except localStorage, which is snapshotted first and
   put back when the run finishes. */
(function () {
  "use strict";

  var OUT = document.getElementById("testsOut");
  var SUM = document.getElementById("testsSum");
  var counts = { pass: 0, fail: 0 };
  var list = null;

  /* ---------- report ---------- */
  function group(name) {
    list = document.createElement("div");
    list.className = "tgroup";
    var head = document.createElement("div");
    head.className = "thead";
    head.textContent = name;
    list.appendChild(head);
    OUT.appendChild(list);
    return list;
  }

  function ok(name, cond, detail) {
    if (cond) counts.pass++;
    else counts.fail++;
    var row = document.createElement("div");
    row.className = "trow " + (cond ? "ok" : "bad");
    var mark = document.createElement("span");
    mark.className = "tmark";
    mark.textContent = cond ? "ok" : "FAIL";
    var label = document.createElement("span");
    label.textContent = name;
    row.appendChild(mark);
    row.appendChild(label);
    if (!cond && detail != null) {
      var why = document.createElement("code");
      why.textContent = String(detail).slice(0, 200);
      row.appendChild(why);
    }
    (list || OUT).appendChild(row);
  }

  function note(text) {
    var p = document.createElement("p");
    p.className = "tnote";
    p.textContent = text;
    (list || OUT).appendChild(p);
  }

  function eq(name, a, b) {
    ok(name, a === b, "got " + JSON.stringify(a) + ", expected " + JSON.stringify(b));
  }

  function done() {
    SUM.textContent = counts.fail ? counts.pass + " passed \u00b7 " + counts.fail + " FAILED" : counts.pass + " checks passed";
    SUM.className = "tsum " + (counts.fail ? "bad" : "ok");
  }

  /* ---------- storage snapshot ---------- */
  var KEYS = [];
  var SNAP = {};

  function storageKeys() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("null:") === 0) out.push(k);
    }
    return out;
  }

  function snapshot() {
    KEYS = storageKeys();
    SNAP = {};
    KEYS.forEach(function (k) {
      SNAP[k] = localStorage.getItem(k);
    });
  }

  function restore() {
    storageKeys().forEach(function (k) {
      localStorage.removeItem(k);
    });
    KEYS.forEach(function (k) {
      localStorage.setItem(k, SNAP[k]);
    });
  }

  function seed(obj) {
    Object.keys(obj).forEach(function (k) {
      localStorage.setItem(k, obj[k]);
    });
  }

  function clearNullKeys() {
    storageKeys().forEach(function (k) {
      localStorage.removeItem(k);
    });
  }

  /* ---------- frames ---------- */
  var frameEl = null;

  function unmount() {
    if (frameEl && frameEl.parentNode) frameEl.parentNode.removeChild(frameEl);
    frameEl = null;
  }

  function mount(src) {
    unmount();
    return new Promise(function (resolve, reject) {
      var f = document.createElement("iframe");
      f.className = "tframe";
      f.setAttribute("title", "page under test");
      var settled = false;
      f.addEventListener("load", function () {
        if (settled) return;
        settled = true;
        setTimeout(function () {
          frameEl = f;
          resolve(f);
        }, 260);
      });
      f.src = src;
      document.getElementById("frames").appendChild(f);
      setTimeout(function () {
        if (!settled) {
          settled = true;
          reject(new Error("timed out loading " + src));
        }
      }, 12000);
    });
  }

  function W() {
    return frameEl && frameEl.contentWindow;
  }
  function D() {
    return (W() && W().document) || null;
  }
  function q(sel) {
    var d = D();
    return d ? d.querySelector(sel) : null;
  }
  function qa(sel) {
    var d = D();
    return d ? Array.prototype.slice.call(d.querySelectorAll(sel)) : [];
  }
  function txt(sel) {
    var n = q(sel);
    return n ? n.textContent : "";
  }
  function N() {
    var w = W();
    return w && w.N ? w.N : {};
  }

  /* did the stylesheet actually apply? custom properties first (a browser),
     then a rule count (works anywhere) */
  function stylesApplied(w, d) {
    try {
      if (w.getComputedStyle(d.documentElement).getPropertyValue("--r-md").trim()) return true;
    } catch (err) {}
    try {
      var sheets = d.styleSheets;
      return sheets.length > 0 && sheets[0].cssRules.length > 20;
    } catch (err) {
      return false;
    }
  }

  function fetchText(url) {
    return fetch(url, { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.text() : "";
      })
      .catch(function () {
        return "";
      });
  }

  var FRESH_ECO = {
    time: 0,
    xp: 0,
    coins: 0,
    next: 100,
    pend: 0,
    boostUntil: 0,
    unlocks: { games: [], themes: [], particles: [], fx: [] },
  };

  function freshEco() {
    localStorage.setItem("null:eco", JSON.stringify(FRESH_ECO));
    var econ = N().econ;
    if (econ) econ.reload();
    return econ;
  }

  /* ============================================================
     Suite 1 — files, styles and the service worker
     ============================================================ */
  function suiteFiles() {
    group("Files, styles and the service worker");
    return Promise.all([
      fetchText("/src/styles/extra.css"),
      fetchText("/src/styles/global.css"),
      fetchText("/sw.js"),
      fetchText("/src/catalog/generated-catalog.js"),
      fetchText("/index.html"),
      fetchText("/tools.html"),
      fetchText("/src/utilities/catalog-tool.js"),
      fetchText("/src/styles/tools.css"),
    ]).then(function (r) {
      var css = r[0];
      var sw = r[2];
      var cat = r[3];
      var home = r[4];

      ok("extra.css is reachable", css.length > 1000);
      ok("glow border inks every card surface", /html\[data-glow\][^{]*\{[^}]*--glow-1/.test(css));
      ok("Neon glows its cards too", /html\[data-pack="neon"\]\s*:is\(\.glass/.test(css));
      ok("daily crate + progress row styles exist", /\.crate-box \{/.test(css) && /\.pg-bar i \{/.test(css));
      ok("the old marquee is fully removed", css.indexOf("nsScroll") < 0 && css.indexOf(".ns-item") < 0);
      ok("tool page styles exist", /\.tool-paths/.test(r[7]) && /\.tool-card/.test(r[7]));
      ok("design tokens load with global.css", /--r-md:/.test(r[1]));

      ok("sw.js precaches daily.js", sw.indexOf("/src/components/daily.js") >= 0);
      ok("sw.js cache name bumped past v1", /const CACHE = "null-v[2-9]/.test(sw) && sw.indexOf("null-v1") < 0);

      ok("catalog file defines NULL_CATALOG", cat.indexOf("window.NULL_CATALOG") >= 0);
      ok("catalog has games/apps/proxies", /"games"/.test(cat) && /"apps"/.test(cat) && /"proxies"/.test(cat));

      ok("home has no leftover marquee markup", home.indexOf("newSec") < 0 && home.indexOf("newTrack") < 0);
      ok("home has the daily strip", home.indexOf("dailyStrip") >= 0);
      ok("tools page is present", r[5].length > 500);
      ok("catalog tool module is present", r[6].indexOf("catalogTool") >= 0);
    });
  }

  /* ============================================================
     Suite 2 — the catalog builder's parsing (pure logic)
     ============================================================ */
  function suiteCatalogTool() {
    group("Catalog builder parsing");
    return fetchText("/src/utilities/catalog-tool.js").then(function (src) {
      var w = window;
      new Function("window", src)(w);
      var T = w.N && w.N.catalogTool;
      if (!T) {
        ok("catalog tool exposes its API", false, "N.catalogTool missing");
        return;
      }
      ok("catalog tool exposes its API", true);
      eq("folder names are prettified", T.pretty("hollow-knight"), "Hollow Knight");
      eq("underscores split too", T.pretty("bits_and_pieces"), "Bits And Pieces");

      var labels = T.parseLabels("Label: Action 2 Player Puzzle\nArcade");
      eq("Label: prefix is stripped", labels.length, 4);
      ok("a number + word stays one label", labels.indexOf("2 Player") >= 0, labels.join("|"));
      ok("duplicates collapse", T.parseLabels("Action\nAction").length === 1);

      var warn = T.parseWarning("Title: Careful\nDescription: Loud sounds\nand flashing lights");
      ok("warning title parses", warn && warn.title === "Careful");
      ok("warning description runs on", warn && /flashing lights/.test(warn.description));
      ok("an empty warning is null", T.parseWarning("") === null);

      var meta = T.parseMeta("Name: Snake\nDescription: Eat apples\nAdded: 2026-08-24\n#hot");
      ok("meta name overrides", meta.name === "Snake");
      ok("meta added date parses", typeof meta.at === "number" && meta.at > 0);
      ok("#hot flips the badge", meta.hot === true);

      var px = T.parseProxy("Link: https://example.com/\nDescription: A site.\nStatus: All Good");
      ok("proxy link parses", px.link === "https://example.com/");
      ok("proxy status parses", px.status === "All Good");
      ok("a proxy without a Link: is rejected", T.proxyEntry("x", "Status: All Good") === null);

      var found = T.folders("games/snake\ngames/hollow-knight/snake.html\napps/calc\nproxies/wiki\n_drafts/sneaky\nREADME.md\nnonsense/thing");
      eq("folders() keeps games + apps + proxies", found.length, 4);
      ok("folders() skips hidden and unknown paths", !found.some(function (f) {
        return f.slug === "sneaky" || f.slug === "thing";
      }));

      var e = T.entry("games", "snake", {
        html: "snake.html",
        thumb: "snake.svg",
        labels: "Label: Arcade",
        meta: "Name: Snake\nDescription: Eat apples\n#hot",
      });
      ok("entry builds the launch path", e.file === "/games/snake/snake.html");
      ok("entry builds the thumb path", e.thumb === "/games/snake/snake.svg");
      ok("entry carries labels + hot", e.labels[0] === "Arcade" && e.hot === true);

      var out = T.source({ games: [e], apps: [], proxies: [] }, "2026-01-01T00:00:00.000Z");
      ok("source() emits runnable catalog JS", /window\.NULL_CATALOG = \{/.test(out) && /"snake"/.test(out));
      var parsed = null;
      try {
        var win = {};
        new Function("window", out)(win);
        parsed = win.NULL_CATALOG;
      } catch (err) {}
      ok("the generated source parses back to data", !!parsed && parsed.games.length === 1);
    });
  }

  /* ============================================================
     Suite 3 — economy: playtime, quests, achievements, the crate
     ============================================================ */
  function suiteEconomy() {
    group("Economy, quests, achievements and the daily crate");
    var econ = freshEco();
    if (!econ) {
      ok("economy module is loaded on the home page", false, "N.econ missing");
      return Promise.resolve();
    }
    ok("economy module is loaded on the home page", true);

    var st = econ.state();
    eq("a fresh account has no coins", st.coins, 0);
    eq("a fresh account has no plays", st.plays, 0);
    ok("the crate is available on day one", st.canSpin === true);

    econ.bank(1800);
    eq("30 minutes of play banks 10 XP", econ.state().xp, 10);

    econ.bank(1800 * 9);
    ok("100 XP banks 30 coins", econ.state().coins >= 30, "coins=" + econ.state().coins);

    var quests = econ.quests();
    eq("three daily quests rotate in", quests.length, 3);
    ok("each quest has a goal and a reward", quests.every(function (q) {
      return q.goal > 0 && q.reward > 0;
    }));

    ["snake", "simon", "pulse", "void", "trace"].forEach(function (id) {
      econ.trackPlay("game", id);
    });
    eq("every launch is counted", econ.stats().plays, 5);
    eq("different games are counted once each", econ.stats().diff, 5);
    econ.trackPlay("app", "calc");
    eq("apps do not count as games played", econ.stats().diff, 5);

    var q = econ.quests().filter(function (x) {
      return x.done && !x.claimed;
    })[0];
    ok("playing completes a daily quest", !!q, "no quest finished");
    if (q) {
      var before = econ.state().coins;
      var claimed = econ.claimQuest(q.id);
      eq("claiming a quest pays its reward", econ.state().coins, before + q.reward);
      ok("a quest cannot be claimed twice", econ.claimQuest(q.id).ok === false);
    }

    var achs = econ.achievements();
    ok("achievements are a real list", achs.length >= 12, "found " + achs.length);
    var first = achs.filter(function (a) {
      return a.id === "first";
    })[0];
    ok("playing unlocks First steps", first && first.done && !first.claimed);
    if (first) {
      var got = econ.claimAch("first");
      ok("claiming an achievement pays coins", got.ok && got.reward === 10);
      ok("an achievement cannot be claimed twice", econ.claimAch("first").ok === false);
    }

    var spin = econ.spin();
    ok("the crate opens once", spin.ok === true, JSON.stringify(spin));
    ok("the crate pays a prize", econ.state().coins > 0);
    eq("the crate locks until tomorrow", econ.canSpin(), false);
    ok("a second open the same day is refused", econ.spin().ok === false);

    /* roll the clock back a day and confirm the daily reset */
    var saved = JSON.parse(localStorage.getItem("null:eco"));
    var yesterday = new Date(Date.now() - 86400000);
    function key(d) {
      var m = d.getMonth() + 1;
      var dd = d.getDate();
      return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (dd < 10 ? "0" : "") + dd;
    }
    saved.day = key(yesterday);
    saved.spinDay = key(yesterday);
    saved.spinStreakDay = key(yesterday);
    saved.lastPlayDay = key(yesterday);
    localStorage.setItem("null:eco", JSON.stringify(saved));
    econ.reload();
    var st2 = econ.state();
    eq("a new day clears claimed quests", econ.quests().filter(function (x) {
      return x.claimed;
    }).length, 0);
    eq("a new day resets quest progress", econ.quests().reduce(function (n, x) {
      return n + x.prog;
    }, 0), 0);
    ok("the crate is available again", st2.canSpin === true);
    eq("the crate streak grows", st2.spinStreak, 2);
    econ.trackPlay("game", "snake");
    eq("playing on a new day extends the streak", econ.state().streak, 2);
    ok("coins, XP and unlocks survive the rollover", econ.state().coins > 0 && econ.state().xp > 0);
  }

  /* ============================================================
     Suite 4 — the home page
     ============================================================ */
  function suiteHome() {
    group("Home: daily strip, recents and random");
    return mount("/index.html").then(function () {
      ok("home loads the site shell", !!q(".topbar"), "no nav mounted");
      var strip = q("#dailyStrip");
      ok("the daily strip renders", !!strip);
      ok("the strip names the crate", /Daily crate/.test(txt("#dailyStrip")));
      ok("the strip shows quest progress", /Quests \d\/3/.test(txt("#dailyStrip")));
      ok("the strip links into the shop", !!q('#dailyStrip a[href="/shop"]'));
      ok("the old marquee is gone from the page", !q("#newSec") && !q(".new-track"));
      ok("the tip of the day renders", /Tip of the day/.test(txt("#tipCard")));

      var g = (N().catalog || {}).games ? N().catalog.games() : [];
      var ids = g.map(function (x) {
        return x.id;
      });
      var picked = [];
      var realAdd = N().recent.add;
      N().recent.add = function (kind, id) {
        picked.push({ kind: kind, id: id });
      };
      for (var i = 0; i < 25; i++) {
        try {
          N().launch.randomGame();
        } catch (err) {}
      }
      N().recent.add = realAdd;
      eq("play random always picks a game", picked.length, 25);
      ok("every random pick is in the game list", picked.every(function (p) {
        return p.kind === "game" && ids.indexOf(p.id) >= 0;
      }));

      return Promise.resolve();
    });
  }

  function suiteRecents() {
    group("Recently played is games only");
    var g = window.__testGameId;
    seed({
      "null:recent": JSON.stringify([
        { k: "game", id: g, at: Date.now() },
        { k: "app", id: "calc", at: Date.now() - 1000 },
      ]),
    });
    return mount("/index.html").then(function () {
      var t = txt("#recList");
      ok("the game you opened is listed", t.indexOf(window.__testGameName) >= 0, t.slice(0, 80));
      ok("an opened app is not listed", t.indexOf("Calculator") < 0, t.slice(0, 80));
    });
  }

  /* ============================================================
     Suite 5 — the shop
     ============================================================ */
  function suiteShop() {
    group("Shop: sections, counts and the glow");
    return mount("/shop.html").then(function () {
      var w = W();
      var body = txt("#shopBody");
      ["Daily crate", "Daily quests", "Beta games", "Theme packs", "Background particles", "Boosts", "Effects", "Achievements"].forEach(
        function (name) {
          ok("shop renders the " + name + " section", body.indexOf(name) >= 0);
        },
      );

      var betas = (w.NULL_CONTENT && w.NULL_CONTENT.betas) || [];
      var themes = w.N.econ.THEMES.length;
      var parts = w.N.econ.PARTICLES.length;
      eq("one card per beta, theme and particle set", qa("#shopBody .shop-card").length, betas.length + themes + parts);
      eq("one progress row per quest and achievement", qa("#shopBody .pg-row").length, 3 + w.N.econ.achievements().length);
      eq("every theme card previews its backdrop", qa("#shopBody .pack-preview").length, themes);
      eq("every particle card previews its layer", qa("#shopBody .part-preview").length, parts);
      ok("locked items show a price", qa("#shopBody .shop-card .price-chip, #shopBody .shop-row .price-chip").length > 0);

      /* the balance bar and the streak chip */
      ok("the balance bar shows the coin balance", /coins/.test(txt("#ecoBar")));

      /* glow border really reaches the cards */
      var card = q("#shopBody .shop-row") || q("#shopBody .shop-card");
      var before = w.getComputedStyle(card).boxShadow;
      w.N.theme.setGlow("bp");
      return new Promise(function (res) {
        setTimeout(res, 80);
      }).then(function () {
        var after = w.getComputedStyle(card).boxShadow;
        ok("glow border is applied to <html>", w.document.documentElement.dataset.glow === "bp");
        ok("glow paints a shadow on the cards", after !== before && after !== "none", after);
        ok("the glow palette is published", !!w.document.documentElement.style.getPropertyValue("--glow-1"));
        w.N.theme.setGlow("off");
      });
    });
  }

  /* ============================================================
     Suite 6 — settings and the library pages
     ============================================================ */
  function suiteSettings() {
    group("Settings");
    return mount("/settings.html").then(function () {
      var w = W();
      ok("settings cards render", qa(".set-card").length >= 8, qa(".set-card").length + " cards");
      var packs = w.N.theme.allPacks();
      var parts = w.N.theme.allParticles();
      eq("one row per theme pack (paid + free)", qa("#packGrid .pack-card").length, packs.length);
      eq("one row per particle set (free + shop)", qa("#partGrid .pack-card").length, parts.length);
      ok("the packs card lists both free and paid", packs.length >= 8, "found " + packs.length);
      ok("the particles card is populated", parts.length >= 9, "found " + parts.length);
      ok("theme switch is present", qa("#themeSeg button").length === 2);
      ok("glow presets are listed", qa("#glowSelect option").length >= 4);
      ok("custom glow colours are available", !!q("#glowColor1") && !!q("#glowColor2"));
      ok("performance mode toggle exists", !!q("#perfSwitch"));
      ok("data export/import exists", !!q("#btnDataExport") && !!q("#btnDataImport"));
      ok("install-as-app row exists", !!q("#installBtn") && !!q("#installHint"));
      ok("accent swatches render", qa("#accentRow .swatch-btn, #accentRow button").length >= 6);
    });
  }

  function suiteLibrary() {
    group("Library pages");
    var games = 0;
    return mount("/games/index.html")
      .then(function () {
        var w = W();
        games = w.N.catalog.games().length;
        ok("games page mounts the scroll view", !!q("#scrollview"));
        ok("games cards render", qa("#grid .tcard").length > 0, qa("#grid .tcard").length + " cards");
        ok("the label filter row is built", qa("#labelRow button").length > 0);
        ok("the count is shown", /\d/.test(txt("#count")));
        return mount("/proxies/index.html");
      })
      .then(function () {
        var w = W();
        eq("proxies page lists every proxy", qa("#grid .tcard").length, w.N.catalog.proxies().length);
        return mount("/apps/index.html");
      })
      .then(function () {
        var w = W();
        eq("apps page lists every app", qa("#grid .tcard").length, w.N.catalog.apps().length);
        ok("the games catalog is non-empty", games > 0);
      });
  }

  /* ============================================================
     Suite 7 — every page boots and keeps its styling
     ============================================================ */
  function suitePages() {
    group("Every page boots");
    var pages = [
      "/index.html",
      "/games/index.html",
      "/apps/index.html",
      "/proxies/index.html",
      "/schedule.html",
      "/announcements.html",
      "/settings.html",
      "/shop.html",
      "/backups.html",
      "/about.html",
      "/privacy.html",
      "/terms.html",
      "/cookies.html",
      "/license.html",
      "/district.html",
      "/tools.html",
      "/404.html",
      "/player.html?k=game&id=snake",
    ];
    var chain = Promise.resolve();
    pages.forEach(function (p) {
      chain = chain.then(function () {
        return mount(p).then(function () {
          var w = W();
          var d = w.document;
          ok(p + " loads with styles", stylesApplied(w, d), "stylesheet did not apply");
          if (p.indexOf("player.html") === 0) {
            ok(p + " mounts the player", !!d.querySelector("#playerFrame, .player, iframe"), "no player markup");
          } else if (p.indexOf("/games/") === 0 || p.indexOf("/apps/") === 0 || p.indexOf("/proxies/") === 0) {
            ok(p + " keeps its nav", !!d.querySelector(".topbar"));
          } else if (p.indexOf("404") < 0 && p.indexOf("tools") < 0) {
            ok(p + " mounts its nav and main", !!d.querySelector(".topbar") && !!d.querySelector("#main"));
          } else {
            ok(p + " renders its body", !!d.body.textContent.length);
          }
        });
      });
    });
    return chain;
  }

  /* ============================================================
     Runner
     ============================================================ */
  function run() {
    OUT.textContent = "";
    counts.pass = 0;
    counts.fail = 0;
    SUM.textContent = "Running\u2026";
    SUM.className = "tsum";

    snapshot();
    clearNullKeys();

    var steps = [
      ["Static files and styles", suiteFiles],
      ["Catalog builder", suiteCatalogTool],
      ["Pages boot", suitePages],
      ["Economy", suiteEconomy],
      ["Home", suiteHome],
      ["Recently played", suiteRecents],
      ["Shop", suiteShop],
      ["Settings", suiteSettings],
      ["Library", suiteLibrary],
    ];

    var chain = Promise.resolve();
    steps.forEach(function (s) {
      chain = chain.then(function () {
        return Promise.resolve()
          .then(s[1])
          .catch(function (err) {
            ok(s[0] + " suite ran", false, (err && err.message) || err);
          });
      });
    });

    return chain
      .then(function () {
        unmount();
        restore();
        done();
      })
      .catch(function (err) {
        unmount();
        restore();
        ok("the test run completed", false, (err && err.message) || err);
        done();
      });
  }

  function boot() {
    var again = document.getElementById("testsRun");
    if (again) again.addEventListener("click", run);
    var back = document.getElementById("testsRestore");
    if (back) {
      back.addEventListener("click", function () {
        restore();
        SUM.textContent = "Your saved data was restored.";
        SUM.className = "tsum ok";
      });
    }
    /* remember a real game so the recents suite has something to seed */
    fetchText("/src/catalog/generated-catalog.js").then(function (src) {
      var win = {};
      try {
        new Function("window", src)(win);
        var g = (win.NULL_CATALOG && win.NULL_CATALOG.games) || [];
        window.__testGameId = g.length ? g[0].id : "snake";
        window.__testGameName = g.length ? g[0].name : "Snake";
      } catch (err) {
        window.__testGameId = "snake";
        window.__testGameName = "Snake";
      }
      run();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
