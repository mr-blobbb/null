/* NULL: devconsole.js
   Hidden developer console. Type "nldev" anywhere (case-insensitive, only
   letters/digits count) to open a full-screen glass terminal overlay.

   Layout, top to bottom: a header with live stats and a filter box, a grid of
   tool cards, and a terminal-style log. Every card is one flat list of pill
   buttons, no fixed rows, so a section can grow or shrink without looking
   ragged, and the cards pair up two-per-row unless they need the full width.

   Two rules keep it from going stale:
     · anything the site already registers (glow palettes, accents, theme
       packs, particle sets, tab presets) is listed from that registry, so a
       new pack or palette shows up here for free;
     · a button can declare `on()` and lights up while its setting is the
       active one, so the console doubles as a readout of current state. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  /* ---------- nldev detector (same pattern as the SGGAMES egg) ---------- */
  var seq = "";
  function armCode() {
    document.addEventListener("keydown", function (e) {
      if (e.repeat) return;
      if (open || gate) return; // don't re-trigger while it's up
      var k = e.key;
      if (k && k.length === 1 && /[a-zA-Z0-9]/.test(k)) {
        seq = (seq + k.toLowerCase()).slice(-8);
        if (seq === "nldev") {
          seq = "";
          openGate();
        }
      }
    });
  }

  /* ---------- state ---------- */
  var open = false;
  var gate = null;
  var ov = null;
  var logBox = null;
  var findBox = null;
  var lastCat = "";
  var groups = []; // [{ card, items: [{ el, label, on }] }]

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function log(msg, tone) {
    if (!logBox) return;
    var line = document.createElement("div");
    line.className = "dc-line" + (tone ? " " + tone : "");
    var t = new Date();
    var hh = t.getHours() % 12 || 12;
    var mm = t.getMinutes();
    var ss = t.getSeconds();
    line.innerHTML =
      "<span class='dc-t'>" +
      (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss +
      "</span>" + esc(msg);
    logBox.appendChild(line);
    while (logBox.children.length > 120) logBox.removeChild(logBox.firstChild);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function ok(m) { log(m); }
  function err(m) { log(m, "err"); }

  /* ---------- clear everything ----------
     Factory reset deletes the keys NULL knows about, which is the honest
     thing for resetting your own progress. This is the debugging nuke:
     every key on the origin (known or not, including the extension registry
     and each extension's own storage), session storage, every cache and the
     service worker registrations, then a reload into a blank slate. */
  function wipeAll() {
    var jobs = [];
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    try {
      if (window.caches && caches.keys) {
        jobs.push(
          caches.keys().then(function (keys) {
            return Promise.all(
              keys.map(function (k) {
                return caches.delete(k);
              }),
            );
          }),
        );
      }
    } catch (e) {}
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        jobs.push(
          navigator.serviceWorker.getRegistrations().then(function (rs) {
            return Promise.all(
              rs.map(function (r) {
                return r.unregister();
              }),
            );
          }),
        );
      }
    } catch (e) {}
    try {
      if (window.indexedDB && indexedDB.databases) {
        jobs.push(
          indexedDB.databases().then(function (dbs) {
            (dbs || []).forEach(function (db) {
              if (db && db.name) {
                try {
                  indexedDB.deleteDatabase(db.name);
                } catch (e) {}
              }
            });
          }),
        );
      }
    } catch (e) {}
    return Promise.all(jobs).catch(function () {});
  }

  /* ---------- placeholder library (stress test) ----------
     Dev-only fake entries pushed into the live catalog so the library, the
     virtual grid, search and the featured rail can be loaded up without
     touching the repo. They live under null:devseed and are merged back in on
     every page load, so what you seeded is still there after a reload or a
     trip to another page. "Some placeholders" wipes them again. */
  var SEED_KEY = "null:devseed";
  var SEED_KINDS = { game: "games", app: "apps", proxy: "proxies" };
  var SEED_WORDS = [
    "Void", "Nova", "Echo", "Prism", "Cobalt", "Lunar", "Static", "Zenith",
    "Orbit", "Fractal", "Onyx", "Rift", "Halo", "Quartz", "Drift", "Pixel",
    "Comet", "Vector", "Nimbus", "Ash",
  ];
  var SEED_TAILS = [
    "Runner", "Puzzle", "Arena", "Tactics", "Rush", "Quest", "Shift", "Blitz",
    "Cascade", "Trials",
  ];
  var SEED_LABELS = ["Action", "Puzzle", "Arcade", "Chill", "2 Player", "Retro"];

  function seedStore() {
    var bag = N.store.read(SEED_KEY, null);
    return bag && typeof bag === "object" ? bag : {};
  }

  function seedCount(bag) {
    var n = 0;
    Object.keys(SEED_KINDS).forEach(function (k) {
      n += ((bag || seedStore())[SEED_KINDS[k]] || []).length;
    });
    return n;
  }

  /* the first real file in the library, so seeded entries still launch
     instead of tripping the "files are missing" toast */
  function realFile(kind) {
    var list = kind === "game" ? N.catalog.games() : kind === "app" ? N.catalog.apps() : [];
    for (var i = 0; i < list.length; i++) {
      if (!list[i].dev && list[i].file) return list[i].file;
    }
    return null;
  }

  function seedEntry(kind, i) {
    var id = "ph-" + kind + "-" + i;
    var name =
      SEED_WORDS[i % SEED_WORDS.length] + " " +
      SEED_TAILS[Math.floor(i / SEED_WORDS.length) % SEED_TAILS.length];
    var lap = Math.floor(i / (SEED_WORDS.length * SEED_TAILS.length));
    if (lap) name += " " + (lap + 1);
    var desc =
      i % 4 === 0
        ? ""
        : "Placeholder entry " + (i + 1) + ": seeded by the dev console for a load test." +
          (i % 5 === 0
            ? " This one carries a deliberately long description so the card has to deal with a line or three of wrapping text."
            : "");
    var labels = [SEED_LABELS[i % SEED_LABELS.length], "placeholder"];
    if (kind === "proxy") {
      return {
        id: id, name: name, url: "https://example.com/", dev: true,
        desc: desc || "Placeholder proxy.",
        status: i % 6 === 0 ? "Issue" : "All Good",
      };
    }
    return {
      id: id, name: name, desc: desc, dev: true,
      file: realFile(kind),
      thumb: d.fbFor(kind),
      labels: labels,
      at: i % 5 === 0 ? Date.now() - i * 3600000 : 0, // exercises the NEW badge
      hot: i % 7 === 0, // exercises the HOT badge
    };
  }

  /* replace whatever is in the live catalog with the stored seed */
  function applySeed() {
    var raw = window.NULL_CATALOG;
    if (!raw) return;
    var bag = seedStore();
    Object.keys(SEED_KINDS).forEach(function (kind) {
      var key = SEED_KINDS[kind];
      var kept = (raw[key] || []).filter(function (e) {
        return !e.dev;
      });
      raw[key] = kept.concat(bag[key] || []);
    });
    N.bus.emit("catalog");
  }

  function feed(kind, n) {
    var key = SEED_KINDS[kind];
    var bag = seedStore();
    var have = (bag[key] || []).length;
    var add = [];
    for (var i = 0; i < n; i++) add.push(seedEntry(kind, have + i));
    bag[key] = (bag[key] || []).concat(add);
    N.store.write(SEED_KEY, bag);
    applySeed();
    refreshStats();
    ok("+" + n + " " + key + ": " + bag[key].length + " placeholders in the library");
  }

  function clearSeed() {
    var total = seedCount();
    if (!total) return err("no placeholders seeded");
    N.store.del(SEED_KEY);
    applySeed();
    refreshStats();
    ok("removed " + total + " placeholders");
  }

  /* merge a stored seed before any page script runs, so a page loaded with
     placeholders already in place never flickers from the real catalog */
  if (seedCount()) applySeed();

  /* ---------- helpers over real site systems ---------- */
  /* the seeded count is the one stat worth shouting about, so it is marked
     here and the html view turns the marker into <b>: the log line and the
     header want the same numbers in different dress */
  function statParts() {
    var g = (N.catalog && N.catalog.games ? N.catalog.games() : []).length;
    var a = (N.catalog && N.catalog.apps ? N.catalog.apps() : []).length;
    var p = (N.catalog && N.catalog.proxies ? N.catalog.proxies() : []).length;
    var rec = N.recent ? N.recent.list().length : 0;
    var fav = N.favs ? N.favs.list().length : 0;
    var eco = N.econ ? N.econ.state() : null;
    var out = [
      g + (eco ? "+" + (N.econ.unlockedBetas ? N.econ.unlockedBetas().length : 0) : "") + " games",
      a + " apps",
      p + " proxies",
      rec + " recent",
      fav + " favorites",
    ];
    if (eco) out.push(eco.coins + " coins", eco.xp + " xp");
    var seeded = seedCount();
    if (seeded) out.push("@" + seeded + " placeholder" + (seeded === 1 ? "" : "s"));
    return out;
  }

  function statsText() {
    return statParts().map(function (s) {
      return s.charAt(0) === "@" ? s.slice(1) : s;
    }).join(" · ");
  }

  function statsHtml() {
    return statParts().map(function (s) {
      return s.charAt(0) === "@" ? "<b>" + s.slice(1) + "</b>" : s;
    }).join(" · ");
  }

  function anyItem(kind) {
    var list =
      kind === "app" ? N.catalog.apps() :
      kind === "proxy" ? N.catalog.proxies() :
      N.catalog.games();
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  function launchItem(kind, entry) {
    if (!entry) return err("no items in that library");
    if (kind === "proxy") {
      N.launch.proxy(entry);
    } else {
      N.recent.add(kind, entry.id);
      location.href = N.launch.playerUrl(kind, entry.id);
    }
  }

  function setAccent(id) {
    if (!N.theme) return err("theme module missing");
    N.theme.setAccent(id);
    N.prefs.set("accent", id);
  }

  function setGlow(id) {
    if (!N.theme) return err("theme module missing");
    N.theme.setGlow(id);
    N.prefs.set("glow", id);
  }

  /* theme packs are shop items; the console grants them so a backdrop can be
     previewed without buying it first. Free packs don't need the grant. */
  function setPack(id) {
    if (!N.theme) return err("theme module missing");
    if (N.econ) N.econ.grant("theme", id);
    N.theme.setAccent(id);
    N.prefs.set("accent", id);
    if (N.seasons) N.seasons.refresh();
  }

  function setParticles(id) {
    if (!N.theme) return err("theme module missing");
    if (id !== "none" && N.econ) N.econ.grant("particle", id);
    N.theme.setParticles(id);
    N.prefs.set("particles", id);
  }

  function applyTab(id) {
    var p = N.tab.get(id);
    if (!p) return err("unknown preset: " + id);
    N.prefs.set("tab", id);
    N.tab.apply();
    ok("tab preset → " + p.name + (N.tab.titleFor ? " (“" + N.tab.titleFor(p) + "”)" : ""));
  }

  /* ---------- button + section builders ----------
     A button is { label, icon, run, on? }: `on` is optional and only says
     whether the setting it toggles is the active one right now. */
  function b(label, icon, run, on) {
    return { label: label, icon: icon, run: run, on: on || null };
  }

  function prefIs(key, val) {
    return function () {
      return N.prefs.get(key) === val;
    };
  }

  function packButtons() {
    return N.theme.allPacks().map(function (p) {
      return b(p.name, "pen", function () {
        setPack(p.id);
        ok("theme pack → " + p.name + (p.free ? " (free)" : " (granted)"));
      }, prefIs("accent", p.id));
    });
  }

  function particleButtons() {
    var list = N.theme.allParticles().map(function (p) {
      return b(p.name, "sparkle", function () {
        setParticles(p.id);
        ok("particles → " + p.name + (p.free ? " (free)" : " (granted)"));
      }, prefIs("particles", p.id));
    });
    return list.concat([
      b("None", "ban", function () {
        setParticles("none");
        ok("particles → none");
      }, prefIs("particles", "none")),
    ]);
  }

  function accentButtons() {
    var list = N.theme.ACCENTS.map(function (a) {
      return b(a.name, "pen", function () {
        setAccent(a.id);
        ok("accent → " + a.name);
      }, prefIs("accent", a.id));
    });
    /* custom accent is a shop item; the console grants it so the picker path
       can be exercised without buying it first */
    list.push(
      b("Custom accent", "pen", function () {
        if (N.econ) N.econ.grant("fx", "customaccent");
        N.theme.setCustomAccent(N.prefs.get("accentColor") || "#6cc7ff");
        ok("accent → custom (picker unlocked)");
      }, prefIs("accent", "custom")),
    );
    return list;
  }

  function glowButtons() {
    return N.theme.GLOWS.filter(function (g) {
      /* the custom palette only exists once the picker is unlocked */
      return g.id !== "custom" || (N.theme.customOn && N.theme.customOn());
    }).map(function (g) {
      return b(g.name, "zap", function () {
        setGlow(g.id);
        ok("glow → " + g.name);
      }, prefIs("glow", g.id));
    });
  }

  function tabButtons() {
    return (N.tab.list || []).map(function (p) {
      return b(p.name, "tab", function () {
        applyTab(p.id);
      }, prefIs("tab", p.id));
    });
  }

  var SEASONS = [
    ["Spring", "petal"], ["Summer", "sparkle"], ["Fall", "leaf"], ["Winter", "snow"],
  ];

  function seasonButtons() {
    var list = [
      b("Auto (calendar)", "calendar", function () {
        N.seasons.pick("auto");
        ok("season → follows the calendar");
      }, function () {
        return N.prefs.get("seasonal") === true && !N.prefs.get("seasonOverride");
      }),
      b("Off", "ban", function () {
        N.seasons.pick("off");
        ok("seasonal theme off");
      }, function () {
        return !N.prefs.get("seasonal");
      }),
    ];
    SEASONS.forEach(function (s) {
      list.push(
        b(s[0], s[1], function () {
          N.seasons.pick(s[0].toLowerCase());
          ok("season → " + s[0] + " (preview)");
        }, function () {
          return N.prefs.get("seasonal") === true && N.prefs.get("seasonOverride") === s[0].toLowerCase();
        }),
      );
    });
    return list;
  }

  function perfButtons() {
    return [
      b("Performance on", "zap", function () {
        N.prefs.set("perf", true);
        N.theme.setPerf(true);
        ok("performance mode on: no glow, particles or pack");
      }, function () {
        return N.prefs.get("perf") === true;
      }),
      b("Ultra-Performance", "zap", function () {
        N.prefs.set("perf", "ultra");
        N.theme.setPerf("ultra");
        ok("ultra mode on: no animation, no effects, off-screen paint skipped");
      }, prefIs("perf", "ultra")),
      b("Perf off", "ban", function () {
        N.prefs.set("perf", false);
        N.theme.setPerf(false);
        ok("performance mode off: glow, particles and pack restored");
      }, function () {
        return !N.prefs.get("perf");
      }),
    ];
  }

  /* built fresh each time the console opens: packs, particles, accents and
     presets all come out of the modules that own them */
  function buildSections() {
    return [
      {
        name: "stress test", icon: "grid", wide: true,
        items: [
          b("50 games", "grid", function () { feed("game", 50); }),
          b("250 games", "grid", function () { feed("game", 250); }),
          b("1,000 games", "grid", function () { feed("game", 1000); }),
          b("50 apps", "grid", function () { feed("app", 50); }),
          b("250 apps", "grid", function () { feed("app", 250); }),
          b("25 proxies", "proxy", function () { feed("proxy", 25); }),
          b("100 proxies", "proxy", function () { feed("proxy", 100); }),
          b("Clear placeholders", "trash", clearSeed),
        ],
      },
      {
        name: "launch", icon: "play",
        items: [
          b("Random game", "play", function () {
            var e = anyItem("game");
            ok("launching “" + (e ? e.name : "?") + "”");
            setTimeout(function () { launchItem("game", e); }, 150);
          }),
          b("Random app", "grid", function () {
            var e = anyItem("app");
            ok("launching “" + (e ? e.name : "?") + "”");
            setTimeout(function () { launchItem("app", e); }, 150);
          }),
          b("Random proxy", "proxy", function () {
            var e = anyItem("proxy");
            ok("opening “" + (e ? e.name : "?") + "” (confirm will show)");
            setTimeout(function () { launchItem("proxy", e); }, 150);
          }),
          b("Open the shop", "store", function () {
            ok("heading to the shop");
            setTimeout(function () { location.href = N.url("/shop"); }, 150);
          }),
          b("Player, missing id", "file", function () {
            ok("opening the player with an id that does not exist");
            setTimeout(function () { location.href = N.launch.playerUrl("game", "nope-not-a-game"); }, 150);
          }),
        ],
      },
      {
        name: "look", icon: "pen", wide: true,
        items: [
          b("Dark", "moon", function () {
            N.theme.setTheme("dark");
            N.prefs.set("theme", "dark");
            ok("theme → dark");
          }, prefIs("theme", "dark")),
          b("Light", "sun", function () {
            N.theme.setTheme("light");
            N.prefs.set("theme", "light");
            ok("theme → light");
          }, prefIs("theme", "light")),
          b("Comet", "zap", function () {
            var on = !N.prefs.get("glowComet");
            N.theme.setComet(on);
            N.prefs.set("glowComet", on);
            ok("glow comet " + (on ? "on" : "off"));
          }, function () {
            return !!N.prefs.get("glowComet");
          }),
        ]
          .concat(glowButtons())
          .concat(accentButtons())
          .concat(perfButtons()),
      },
      { name: "theme packs", icon: "star", wide: true, items: packButtons() },
      { name: "particles", icon: "sparkle", wide: true, items: particleButtons() },
      { name: "fx", icon: "star", items: [
        b("Confetti burst", "star", function () {
          N.fx.confetti();
          ok("confetti fired");
        }),
        b("Triple confetti", "star", function () {
          N.fx.confetti();
          setTimeout(function () { N.fx.confetti(); }, 350);
          setTimeout(function () { N.fx.confetti(); }, 700);
          ok("3 bursts queued");
        }),
        b("Toast (info)", "info", function () {
          d.toast("Dev toast: all systems nominal", { icon: "info" });
          ok("toast shown");
        }),
        b("Toast (error)", "warn", function () {
          d.toast("Dev error toast", { icon: "warn", type: "err", hold: 4000 });
          ok("error toast shown");
        }),
        b("Screensaver", "clock", function () {
          document.dispatchEvent(new Event("dc-ss"));
          ok("screensaver requested");
        }),
      ] },
      { name: "modals", icon: "info", items: [
        b("Warning", "warn", function () {
          N.modal.open({
            title: "Heads up (sample warning)",
            icon: "warn",
            iconTone: "warn",
            body: "<p>Keyboard needed. Arrow keys move, space jumps. This is how a game's Warning.txt renders.</p>",
            dismissible: false,
            actions: [
              { label: "Go back", variant: "outline" },
              { label: "Okay", variant: "primary" },
            ],
          });
          ok("warning modal shown");
        }),
        b("Confirm", "check", function () {
          N.modal.confirm({
            title: "Dev confirm",
            body: "<p>This is what a NULL confirm looks like.</p>",
            onOk: function () { ok("confirm accepted"); },
          });
          ok("confirm dialog shown");
        }),
        b("Danger", "trash", function () {
          N.modal.open({
            title: "Danger sample",
            icon: "warn",
            iconTone: "danger",
            body: "<p>This is how a danger modal renders. Nothing was harmed.</p>",
            actions: [{ label: "Phew", variant: "danger" }],
          });
          ok("danger modal shown");
        }),
        b("Stack 3", "list", function () {
          for (var i = 3; i >= 1; i--) {
            (function (n) {
              N.modal.open({
                title: "Modal #" + n,
                icon: "info",
                body: "<p>Stacked modal " + n + " of 3. Close top first.</p>",
                actions: [{ label: "Next", variant: "primary" }],
              });
            })(i);
          }
          ok("3 modals stacked (top closes first)");
        }),
        b("Weekly wrap-up", "ann", function () {
          if (!N.wrapup || !N.wrapup.show()) return err("nothing in this week's log yet: try “Seed weekly log”");
          ok("weekly wrap-up shown");
        }),
        b("SGGAMES egg", "zap", function () {
          if (N.modal.showSgGames) N.modal.showSgGames();
          else err("egg not exported");
          ok("SGGAMES egg shown");
        }),
      ] },
      { name: "tab presets", icon: "tab", items: tabButtons() },
      { name: "seasonal", icon: "leaf", items: seasonButtons() },
      { name: "economy", icon: "coin", items: [
        b("Bank 5h playtime", "coin", function () {
          if (!N.econ) return err("economy module missing");
          var got = N.econ.bank(5 * 3600);
          ok("banked 5h → +" + got.xp + " xp, +" + got.coins + " coins (now " + N.econ.state().coins + " coins)");
          refreshStats();
        }),
        b("Add 200 coins", "coin", function () {
          if (!N.econ) return err("economy module missing");
          var now = N.econ.giveCoins(200);
          ok("200 coins added (now " + now + ", saved)");
          refreshStats();
        }),
        b("Finish today's quests", "check", function () {
          if (!N.econ) return err("economy module missing");
          var games = N.catalog.games().slice(0, 5);
          if (!games.length) return err("library empty");
          games.forEach(function (g) { N.econ.trackPlay("game", g.id); });
          N.econ.bank(2400);
          ok("today's quests should all be claimable in the Shop");
          refreshStats();
        }),
        b("Daily crate", "gift", function () {
          if (!N.daily) return err("the crate only exists on Home and Shop");
          N.daily.openCrate(function () { refreshStats(); });
          ok("crate modal opened");
        }),
        b("Roll over the day", "refresh", function () {
          if (!N.econ) return err("economy module missing");
          N.econ.newDay();
          ok("new day: quests and the crate are fresh");
          refreshStats();
        }),
        b("Unlock everything", "unlock", function () {
          if (!N.econ || !N.econ.unlockAll) return err("economy module missing");
          var n = N.econ.unlockAll();
          ok(n + " shop items unlocked: every theme, particle set and effect");
          refreshStats();
        }),
        b("Reset economy", "trash", function () {
          N.store.del("null:eco");
          ok("economy wiped: reload to reset balances");
          refreshStats();
        }),
      ] },
      { name: "data", icon: "backups", items: [
        b("Seed recents (5)", "play", function () {
          var games = N.catalog.games();
          if (!games.length) return err("library empty");
          for (var i = 0; i < 5; i++) {
            var g = games[Math.floor(Math.random() * games.length)];
            N.recent.add("game", g.id);
            N.plays.tap("game", g.id);
          }
          ok("5 recents + plays seeded");
          refreshStats();
        }),
        b("Seed weekly log", "clock", function () {
          if (!N.week) return err("week module missing");
          var pool = N.catalog.games().slice(0, 4).map(function (g) {
            return { k: "game", id: g.id };
          }).concat(N.catalog.apps().slice(0, 2).map(function (a) {
            return { k: "app", id: a.id };
          }));
          if (!pool.length) return err("library empty");
          for (var i = 0; i < 12; i++) {
            var p = pool[Math.floor(Math.random() * pool.length)];
            N.week.log(p.k, p.id);
          }
          ok("12 plays seeded into this week: open “Weekly wrap-up”");
        }),
        b("Clear recents", "trash", function () {
          N.recent.clear();
          ok("recents cleared");
          refreshStats();
        }),
        b("Clear favorites", "trash", function () {
          N.favs.clear();
          ok("favorites cleared");
          refreshStats();
        }),
        b("Reset play counts", "trash", function () {
          N.store.del("null:plays");
          ok("play counts wiped");
          refreshStats();
        }),
        b("Clear search history", "trash", function () {
          N.store.del("null:searches");
          ok("search history wiped");
        }),
        b("Reset first-run flags", "info", function () {
          N.flags.clear();
          ok("flags reset: welcome, popup and customize prompt return next visit");
        }),
        b("Factory reset", "warn", function () {
          N.modal.confirm({
            title: "Factory reset?",
            icon: "warn",
            iconTone: "danger",
            body: "<p>Wipes every NULL preference, flag, recent, favorite, play count, weekly log, history and seeded placeholder from this browser. This cannot be undone.</p>",
            okLabel: "Wipe everything",
            okVariant: "danger",
            onOk: function () {
              [
                "null:prefs", "null:flags", "null:recent", "null:favs", "null:plays",
                "null:searches", "null:sched", "null:lunch", "null:week", "null:eco",
                "null:annSeen", SEED_KEY,
              ].forEach(N.store.del);
              ok("factory reset done: reloading");
              setTimeout(function () { location.reload(); }, 600);
            },
          });
        }),
        b("Clear everything", "warn", function () {
          N.modal.confirm({
            title: "Clear everything?",
            icon: "warn",
            iconTone: "danger",
            body:
              "<p>Stronger than a factory reset. This erases <b>everything</b> this browser holds for NULL: preferences, economy, XP, coins, quests, achievements, unlocks, installed extensions and their own storage, crafted themes and particles, schedule edits, favorites, recents, play counts, search history, the weekly log, every flag, tour state, settings folds, every other storage key, the caches and the installed service worker.</p>" +
              "<p style='color:var(--bad)'>There is no undo. The page reloads into a NULL that has never seen this browser.</p>",
            okLabel: "Erase everything",
            okVariant: "danger",
            onOk: function () {
              ok("wiping every key, cache and worker…");
              wipeAll().then(function () {
                setTimeout(function () { location.reload(); }, 500);
              });
            },
          });
        }),
      ] },
      { name: "pages", icon: "wrench", items: [
        b("404 page", "warn", function () {
          ok("opening 404.html");
          location.href = N.url("/404.html");
        }),
        b("Reload", "refresh", function () { location.reload(); }),
      ] },
      /* the newer surfaces: the manager, the lab and the hidden map */
      { name: "surfaces", icon: "puzzle", items: [
        b("Extensions", "puzzle", function () {
          ok("opening the extensions manager");
          location.href = N.url("/extensions");
        }),
        b("Labs", "beaker", function () {
          ok("opening labs");
          location.href = N.url("/labs");
        }),
        b("Root map", "code", function () {
          ok("opening /root: nothing links there on purpose");
          location.href = N.url("/root");
        }),
      ] },
      /* the hidden pages: nothing on the site links them, so this card is how
         you get there without typing the address */
      { name: "eggs", icon: "eye", items: [
        b("Void", "ban", function () {
          ok("opening the void");
          location.href = N.url("/void");
        }),
        b("Blob", "code", function () {
          ok("opening blob");
          location.href = N.url("/blob");
        }),
        b("Time", "clock", function () {
          ok("opening time");
          location.href = N.url("/time");
        }),
        b("Credits", "star", function () {
          ok("opening credits");
          location.href = N.url("/credits");
        }),
        b("Blob face on/off", "eye", function () {
          var st = N.shell && N.shell.orb ? N.shell.orb() : null;
          ok(st === true ? "blob face forced on" : st === false ? "blob face forced off" : "blob face back on the schedule");
        }),
        b("Midnight modal", "clock", function () {
          if (N.shell && N.shell.midnightNow) N.shell.midnightNow();
          ok("midnight modal + confetti fired");
        }),
      ] },
    ];
  }

  /* ---------- console shell ---------- */
  function headEl() {
    var head = d.h("div", { class: "dc-head" });
    head.appendChild(
      d.h("div", { class: "dc-brand" }, [
        d.icon("ban"),
        d.h("b", null, "NULL DEVCONSOLE"),
        d.h("span", { class: "dc-ver", html: "v2.0 · " + statsHtml() }),
      ]),
    );

    findBox = d.h("input", {
      type: "search",
      class: "dc-find",
      placeholder: "Filter tools…",
      "aria-label": "Filter dev tools",
      autocomplete: "off",
      spellcheck: "false",
      oninput: function () { filter(findBox.value); },
    });

    head.appendChild(
      d.h("div", { class: "dc-actions" }, [
        findBox,
        d.h("button", {
          type: "button", class: "btn btn-ghost btn-sm dc-btn",
          title: "Copy console log", "aria-label": "Copy console log",
          onclick: function () {
            var txt = logBox ? Array.prototype.map.call(logBox.children, function (l) { return l.textContent; }).join("\n") : "";
            /* writeText resolves async: a rejected promise would slip past try/catch */
            function fallback() {
              var done = false;
              try {
                var ta = document.createElement("textarea");
                ta.value = txt;
                ta.style.cssText = "position:fixed;opacity:0;top:0";
                document.body.appendChild(ta);
                ta.select();
                done = !!document.execCommand && document.execCommand("copy");
                document.body.removeChild(ta);
              } catch (e2) {}
              if (done) d.toast("Log copied", { icon: "copy" });
              else err("clipboard unavailable");
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(txt).then(
                function () { d.toast("Log copied", { icon: "copy" }); },
                function () { fallback(); }
              );
            } else {
              fallback();
            }
          },
        }, [d.icon("copy"), "Copy log"]),
        d.h("button", {
          type: "button", class: "btn btn-ghost btn-sm dc-btn",
          title: "Close (Esc)", "aria-label": "Close console",
          onclick: hide,
        }, [d.icon("x"), "Close"]),
      ]),
    );
    return head;
  }

  function sectionsEl() {
    var wrap = d.h("div", { class: "dc-cols" });
    groups = [];
    buildSections().forEach(function (s) {
      var card = d.h("section", { class: "dc-card glass" + (s.wide ? " wide" : "") });
      card.appendChild(
        d.h("h3", { class: "dc-card-h" }, [
          d.icon(s.icon),
          s.name,
          d.h("span", { class: "dc-n" }, String(s.items.length)),
        ]),
      );
      var row = d.h("div", { class: "dc-row" });
      var items = [];
      s.items.forEach(function (it) {
        var el = d.h("button", {
          type: "button", class: "dc-b",
          onclick: function () {
            it.run();
            paint();
          },
        }, [d.icon(it.icon), it.label]);
        row.appendChild(el);
        items.push({ el: el, label: it.label.toLowerCase(), on: it.on });
      });
      card.appendChild(row);
      wrap.appendChild(card);
      groups.push({ card: card, name: s.name.toLowerCase(), items: items });
    });
    return wrap;
  }

  /* the filter box: match a button by label, or a whole card by its name */
  function filter(q) {
    var term = (q || "").trim().toLowerCase();
    groups.forEach(function (g) {
      var whole = term && g.name.indexOf(term) >= 0;
      var shown = 0;
      g.items.forEach(function (it) {
        var hit = !term || whole || it.label.indexOf(term) >= 0;
        it.el.hidden = !hit;
        if (hit) shown++;
      });
      g.card.hidden = !shown;
    });
  }

  /* light up whatever is currently applied */
  function paint() {
    groups.forEach(function (g) {
      g.items.forEach(function (it) {
        if (!it.on) return;
        it.el.classList.toggle("on", !!it.on());
      });
    });
  }

  /* ---------- password gate ----------
     A speed bump, not security: this file is served to the browser, so the
     password is readable by anyone who looks for it. It keeps the console out
     of the way of casual hands. The programmatic door (N.dev.show) skips it:
     by then you have the source open anyway. */
  var PW = "mynameisblob123";

  function closeGate() {
    if (!gate) return;
    var el = gate;
    gate = null;
    document.body.style.overflow = "";
    el.classList.remove("on");
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 200);
  }

  function openGate() {
    if (gate || open) return;

    var input = d.h("input", {
      type: "password",
      class: "dc-gate-in",
      placeholder: "Password",
      autocomplete: "off",
      "aria-label": "Dev console password",
    });
    var errEl = d.h("p", { class: "dc-gate-err", role: "alert" });

    var form = d.h("form", {
      class: "dc-gate-box glass-2 elev",
      onsubmit: function (e) {
        e.preventDefault();
        if (input.value === PW) {
          closeGate();
          show();
          return;
        }
        errEl.textContent = "Wrong password.";
        input.value = "";
        form.classList.remove("shake");
        void form.offsetWidth; /* restart the animation */
        form.classList.add("shake");
        input.focus();
      },
    }, [
      d.h("span", { class: "dc-gate-ic" }, [d.icon("lock")]),
      d.h("b", { class: "dc-gate-title" }, "NULL DEVCONSOLE"),
      d.h("p", { class: "dc-gate-sub" }, "This one is behind a password."),
      input,
      errEl,
      d.h("div", { class: "dc-gate-actions" }, [
        d.h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: closeGate }, "Cancel"),
        d.h("button", { type: "submit", class: "btn btn-primary btn-sm" }, "Unlock"),
      ]),
    ]);

    gate = d.h("div", {
      class: "dc-gate",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "NULL dev console locked",
    }, [form]);
    document.body.appendChild(gate);
    document.body.style.overflow = "hidden";

    function fadeIn() {
      if (gate) gate.classList.add("on");
    }
    requestAnimationFrame(fadeIn);
    setTimeout(fadeIn, 60);
    /* focus after the keystroke that opened the gate has finished, or the
       "v" from "nldev" lands in the field */
    setTimeout(function () {
      if (gate) input.focus();
    }, 90);
  }

  function show() {
    if (open) return;
    open = true;
    lastCat = document.title;
    document.title = "█ NULL DEVCONSOLE";

    ov = d.h("div", { class: "dc-ov", role: "dialog", "aria-label": "NULL dev console" });
    var box = d.h("div", { class: "dc-box glass-2 elev" });
    box.appendChild(headEl());
    box.appendChild(sectionsEl());

    logBox = d.h("div", { class: "dc-log", "aria-live": "polite" });
    box.appendChild(logBox);
    ov.appendChild(box);
    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";

    paint();
    log("devconsole attached: type nldev to reopen");
    log("session: " + statsText());

    function fadeIn() { ov.classList.add("on"); }
    requestAnimationFrame(fadeIn);
    /* rAF pauses in background tabs: never leave the console invisible */
    setTimeout(fadeIn, 60);
  }

  function hide() {
    if (!open || !ov) return;
    open = false;
    if (document.title.indexOf("█") === 0) document.title = lastCat || "NULL";
    ov.classList.remove("on");
    document.body.style.overflow = "";
    var el = ov;
    ov = null;
    logBox = null;
    findBox = null;
    groups = [];
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 220);
  }

  function refreshStats() {
    var v = d.qs(".dc-ver", ov);
    if (v) v.innerHTML = "v2.0 · " + statsHtml();
  }

  /* wire the screensaver button into shell.js's screensaver via a custom event */
  document.addEventListener("dc-ss", function () {
    if (N.shell && N.shell.screensaverNow) N.shell.screensaverNow();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (gate) {
      e.preventDefault();
      closeGate();
    } else if (open) {
      e.preventDefault();
      hide();
    }
  });

  armCode();
  /* the door in for anything that isn't a keystroke (the real devtools
     console, a test): show() and hide() are both idempotent */
  N.dev = { show: show, hide: hide };
})();
