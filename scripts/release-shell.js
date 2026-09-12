/* NULL — release-shell.js
   The app inside releases/null-{regular,mini,lite}.html. It is NOT one of the
   site's page scripts: the single-file builds ship the same runtime (store,
   theme, econ, cards, schedule, daily, search…) plus an embedded catalog whose
   entries carry their own game code as a data: URI, so everything runs with no
   server and no other files.

   What the shell owns:
     · the window chrome — header, page nav, footer
     · the views: home, games/apps/proxies, schedule, announcements, shop,
       backups, settings
     · the player overlay, and the launch hooks that make cards, search results
       and "play random" open games in it instead of navigating to a player page
       that does not exist in a single file

   Tier differences come from window.RELEASE_TIER:
     regular · everything, readable source
     mini    · same, minified by the build script
     lite    · full runtime but stripped: no theme packs, no particles, no glow,
               no shop, and performance mode is pinned on so the animations and
               backdrop effects are off. */

(function () {
  var N = window.N;
  var d = N.dom;
  var C = window.NULL_CONTENT || { announcements: [], pages: [] };
  var TIER = window.RELEASE_TIER || "regular";
  var LITE = TIER === "lite";
  var root = document.getElementById("rel");
  var viewHost = null;
  var state = { q: "", page: "home" };

  var NAV = {
    regular: ["home", "games", "apps", "proxies", "announcements", "schedule", "shop", "backups", "settings"],
    mini: ["home", "games", "apps", "proxies", "announcements", "schedule", "shop", "backups", "settings"],
    lite: ["home", "games", "apps", "proxies", "schedule", "settings"]
  };
  var NAV_T = {
    home: "Home", games: "Games", apps: "Apps", proxies: "Proxies",
    announcements: "News", schedule: "Schedule", shop: "Shop",
    backups: "Backups", settings: "Settings"
  };

  /* the embedded catalog — catalog.js and this shell read the same object */
  function cat() {
    return window.NULL_CATALOG || { games: [], apps: [], proxies: [] };
  }

  function go(page) {
    state.page = page;
    try {
      location.hash = page;
    } catch (e) {}
    paintNav();
    render();
    window.scrollTo(0, 0);
  }

  /* ============================================================
     header + nav
     ============================================================ */
  function header() {
    var h = d.h("div", { class: "rel-top glass-2" });
    var mark = d.h("span", { class: "brand-mark" });
    mark.innerHTML =
      '<svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor"><rect x="1.6" y="1.6" width="28.8" height="28.8" rx="9.5" stroke-opacity="0.35" stroke-width="1.6"/><circle cx="16" cy="16" r="7.6" stroke-width="2.6"/><path d="M11.3 11.3l9.4 9.4" stroke-width="2.6" stroke-linecap="round"/></svg>';
    var search = d.h("button", {
      type: "button",
      class: "btn btn-outline btn-sm",
      title: "Search ( / )",
      onclick: function () {
        if (N.search) N.search.open();
      }
    }, [d.icon("search"), "Search"]);
    var theme = d.h("button", {
      type: "button",
      class: "btn-icon btn-outline",
      title: "Toggle theme",
      onclick: function () {
        var next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
        N.theme.setTheme(next);
        N.prefs.set("theme", next);
        paintThemeIcon(theme);
      }
    });
    paintThemeIcon(theme);

    h.appendChild(mark);
    h.appendChild(d.h("span", { class: "brand-name" }, "NULL"));
    h.appendChild(d.h("span", { class: "chip accent" }, TIER.toUpperCase() + " \u00b7 standalone"));
    h.appendChild(d.h("span", { class: "sp" }));
    h.appendChild(search);
    h.appendChild(theme);
    return h;
  }

  function paintThemeIcon(btn) {
    btn.textContent = "";
    btn.appendChild(d.icon(document.documentElement.dataset.theme === "light" ? "moon" : "sun"));
  }

  function nav() {
    var el = d.h("div", { class: "rel-nav" });
    (NAV[TIER] || NAV.regular).forEach(function (p) {
      el.appendChild(
        d.h("button", {
          type: "button",
          class: "chip chip-btn" + (state.page === p ? " on" : ""),
          onclick: function () {
            go(p);
          }
        }, NAV_T[p]),
      );
    });
    return el;
  }

  function paintNav() {
    var bar = root.querySelector(".rel-nav");
    if (bar) bar.remove();
    var top = root.querySelector(".rel-top");
    if (top) top.insertAdjacentElement("afterend", nav());
  }

  /* ============================================================
     player overlay + playtime banking
     ============================================================ */
  var clock = null;
  var lastTick = 0;

  function clockOn() {
    if (!N.econ || !N.econ.bank) return;
    clockOff(true);
    lastTick = Date.now();
    clock = setInterval(function () {
      var secs = Math.round((Date.now() - lastTick) / 1000);
      if (secs < 5) return;
      lastTick = Date.now();
      var got = N.econ.bank(secs);
      if (got && (got.xp || got.coins)) {
        var bits = [];
        if (got.xp) bits.push("+" + got.xp + " XP");
        if (got.coins) bits.push("+" + got.coins + " coins");
        d.toast(bits.join(" \u00b7 "), { icon: "coin" });
      }
    }, 5000);
  }

  function clockOff(silent) {
    if (!clock) return;
    clearInterval(clock);
    clock = null;
    var secs = Math.round((Date.now() - lastTick) / 1000);
    if (secs > 0 && N.econ && N.econ.bank) N.econ.bank(secs);
    if (!silent && N.econ && N.econ.reload) N.econ.reload();
  }

  function openPlayer(entry, kind) {
    var run = function () {
      N.recent.add(kind, entry.id);
      if (N.econ && N.econ.trackPlay) N.econ.trackPlay(kind, entry.id);
      N.tab.apply();

      var overlay = d.h("div", { class: "player", style: { zIndex: "400" } });
      var load = d.h("div", { class: "player-loading" }, [
        d.h("div", { class: "spin" }),
        d.h("span", null, "starting\u2026")
      ]);
      var frame = d.h("iframe", {
        title: entry.name,
        style: { width: "100%", height: "100%", border: "0", background: "#0c0c0f" }
      });
      frame.addEventListener("load", function () {
        load.remove();
      });
      frame.src = entry.data || entry.file;

      var back = d.h("button", {
        type: "button",
        class: "btn-icon btn-ghost",
        onclick: function () {
          clockOff();
          overlay.remove();
          document.body.style.overflow = "";
        }
      }, [d.icon("back")]);
      var meta = d.h("div", { class: "player-meta" }, [
        d.h("b", null, entry.name),
        d.h("span", null, (kind === "game" ? "Game" : "App") + " \u00b7 NULL " + TIER)
      ]);
      var fs = d.h("button", {
        type: "button",
        class: "btn-icon btn-outline",
        title: "Fullscreen",
        style: { width: "38px", height: "38px", borderRadius: "11px" },
        onclick: function () {
          if (document.fullscreenElement) document.exitFullscreen();
          else if (overlay.requestFullscreen) overlay.requestFullscreen();
        }
      }, [d.icon("max")]);

      var bar = d.h("div", { class: "player-bar" }, [
        back,
        meta,
        d.h("div", { class: "player-actions" }, [fs])
      ]);
      overlay.appendChild(bar);
      overlay.appendChild(d.h("div", { class: "player-frame" }, [load, frame]));
      document.body.appendChild(overlay);
      document.body.style.overflow = "hidden";
      clockOn();
    };

    if (entry.warning) {
      N.modal.open({
        title: entry.warning.title || "Heads up",
        icon: "warn",
        iconTone: "warn",
        body: "<p>" + d.escHtml(entry.warning.description || "").replace(/\n/g, "<br>") + "</p>",
        dismissible: false,
        actions: [
          { label: "Go back", variant: "outline" },
          { label: "Okay", variant: "primary", onClick: run }
        ]
      });
      return;
    }
    run();
  }

  /* The site's launches navigate to /player.html. A single file has no such
     page, so every route into a game goes through the overlay above instead —
     library cards, search hits, "play random" and the dev console all call
     through N.launch. */
  N.launch.game = function (entry) {
    openPlayer(entry, "game");
  };
  N.launch.app = function (entry) {
    openPlayer(entry, "app");
  };
  N.launch.randomGame = function () {
    var games = cat().games || [];
    if (!games.length) {
      d.toast("No games in this build yet.", { type: "err" });
      return;
    }
    openPlayer(games[Math.floor(Math.random() * games.length)], "game");
  };

  /* ============================================================
     home
     ============================================================ */
  function featured() {
    var games = (cat().games || []).slice();
    var hot = games.filter(function (g) {
      return g.hot;
    });
    var fresh = games.filter(function (g) {
      return g.at && Date.now() - g.at < 14 * 86400000;
    });
    var pick = hot.concat(fresh, games).filter(function (g, i, a) {
      return a.indexOf(g) === i;
    });
    return pick.slice(0, 8);
  }

  function homeView() {
    var view = d.h("div", { class: "rel-view" });
    var c = cat();

    var hero = d.h("div", { class: "rel-hero glass-2" }, [
      d.h("span", { class: "hero-eyebrow" }, "NULL \u00b7 " + TIER + " \u00b7 standalone single file"),
      d.h("h1", null, "Games, apps & tools."),
      d.h("p", null, "A self-contained NULL build. Everything below runs from this one file \u2014 favorites, history, coins and settings are shared with the main site on this browser.")
    ]);
    hero.appendChild(
      d.h("div", { class: "rel-actions" }, [
        d.h("button", {
          type: "button",
          class: "btn btn-primary",
          onclick: function () {
            N.launch.randomGame();
          }
        }, [d.icon("zap"), "Play a random game"]),
        d.h("button", {
          type: "button",
          class: "btn btn-outline",
          onclick: function () {
            go("games");
          }
        }, "Browse games"),
        d.h("span", { class: "chip accent" }, c.games.length + " games \u00b7 " + c.apps.length + " apps \u00b7 " + c.proxies.length + " proxies")
      ]),
    );
    view.appendChild(hero);

    /* daily crate + quests (the strip's "Quests" link points at /shop.html,
       which does not exist here — send it to the Shop view instead) */
    if (!LITE && N.daily) {
      var strip = d.h("div", { class: "daily-strip glass", id: "dailyStrip" });
      view.appendChild(d.h("div", { class: "section" }, [strip]));
      N.daily.homeStrip();
      d.qsa('#dailyStrip a[href="/shop.html"]').forEach(function (a) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          go("shop");
        });
      });
    }

    var feat = featured();
    if (feat.length) {
      var panel = d.h("div", { class: "panel glass" });
      panel.appendChild(d.h("div", { class: "panel-head" }, [d.h("h2", null, "Featured")]));
      var grid = d.h("div", { class: "libgrid" });
      feat.forEach(function (g) {
        grid.appendChild(N.cards.card(g, "game"));
      });
      panel.appendChild(grid);
      view.appendChild(d.h("div", { class: "section" }, [panel]));
    }

    /* recently played — games only, same as the site */
    var recent = d.h("div", { class: "panel glass" });
    view.appendChild(d.h("div", { class: "section" }, [recent]));

    function paintRecent() {
      recent.textContent = "";
      recent.appendChild(
        d.h("div", { class: "panel-head" }, [
          d.h("h2", null, "Recently played"),
          d.h("button", {
            type: "button",
            class: "btn btn-outline-danger btn-sm",
            onclick: function () {
              N.recent.clear();
              paintRecent();
            }
          }, "Clear list")
        ]),
      );
      var items = N.recent.list().map(function (r) {
        if (r.k !== "game") return null;
        var e = (cat().games || []).filter(function (x) {
          return x.id === r.id;
        })[0];
        return e ? { e: e, k: "game" } : null;
      }).filter(Boolean).slice(0, 6);
      if (!items.length) {
        recent.appendChild(N.cards.empty("Nothing played yet", "Open a game and it lands here."));
        return;
      }
      var list = d.h("div", { class: "rec-list" });
      items.forEach(function (it) {
        list.appendChild(N.cards.row(it.e, it.k));
      });
      recent.appendChild(list);
    }
    paintRecent();

    var cols = d.h("div", { class: "home-cols section" });
    cols.appendChild(schedulePanel());
    cols.appendChild(annPanel());
    view.appendChild(cols);
    return view;
  }

  function schedulePanel() {
    var panel = d.h("div", { class: "panel" });
    panel.appendChild(
      d.h("div", { class: "panel-head" }, [
        d.h("h2", null, [d.icon("sched"), "Today\u2019s schedule"]),
        d.h("button", {
          type: "button",
          class: "more",
          onclick: function () {
            go("schedule");
          }
        }, "full page \u2192")
      ]),
    );
    var S = N.schedule;
    if (!S) {
      panel.appendChild(d.h("p", { class: "lines", style: { color: "var(--text-2)" } }, "Schedule module missing."));
      return panel;
    }
    var info = S.todayInfo();
    if (!info.type) {
      panel.appendChild(d.h("p", { class: "lines", style: { color: "var(--text-2)" } }, info.dayName + " \u2014 no school."));
      return panel;
    }
    var blocks = S.blocksFor(info.type);
    var strip = S.liveStrip(blocks);
    panel.appendChild(d.h("div", { class: "today-card" }, [
      d.h("span", { class: "chip" + (info.type === "win" ? " accent" : "") }, info.type === "win" ? "Homeroom/WIN" : "Regular"),
      d.h("b", { class: "tc-date" }, info.full)
    ]));
    panel.appendChild(strip.el);
    return panel;
  }

  function annPanel() {
    var panel = d.h("div", { class: "panel" });
    panel.appendChild(
      d.h("div", { class: "panel-head" }, [
        d.h("h2", null, [d.icon("ann"), "Announcements"]),
        d.h("button", {
          type: "button",
          class: "more",
          onclick: function () {
            go("announcements");
          }
        }, "all \u2192")
      ]),
    );
    var list = d.h("div", { class: "ann-list" });
    (C.announcements || []).slice(0, 3).forEach(function (a) {
      list.appendChild(
        d.h("button", {
          type: "button",
          class: "ann-line",
          onclick: function () {
            go("announcements");
          }
        }, [
          d.h("b", null, a.title),
          d.h("span", null, a.date || "")
        ]),
      );
    });
    panel.appendChild(list);
    return panel;
  }

  /* ============================================================
     library
     ============================================================ */
  function libraryView(kindList, kind) {
    var view = d.h("div", { class: "rel-view" });
    var label = kind === "game" ? "Games" : kind === "app" ? "Apps" : "Proxies";
    var filter = d.h("input", { type: "text", placeholder: "Filter " + label.toLowerCase(), "aria-label": "Filter" });
    var count = d.h("span", { class: "chip" });
    var head = d.h("div", { class: "view-head" }, [
      d.h("h2", null, label),
      kind !== "proxy"
        ? d.h("button", {
            type: "button",
            class: "chip chip-btn",
            onclick: function () {
              var list = kind === "game" ? cat().games : cat().apps;
              if (list && list.length) openPlayer(list[Math.floor(Math.random() * list.length)], kind);
            }
          }, "surprise me")
        : null,
      d.h("span", { class: "field", style: { maxWidth: "260px", flex: "1", minWidth: "150px" } }, [d.icon("search"), filter]),
      count
    ]);
    view.appendChild(head);
    var grid = d.h("div");
    view.appendChild(grid);

    function paint() {
      grid.textContent = "";
      var q = state.q.toLowerCase().trim();
      var shown = kindList.filter(function (e) {
        if (!q) return true;
        return (e.name + " " + (e.labels || []).join(" ") + " " + (e.desc || "")).toLowerCase().indexOf(q) >= 0;
      });
      count.textContent = shown.length + "/" + kindList.length;
      if (!shown.length) {
        grid.appendChild(N.cards.empty("No matches", "Try another filter."));
        return;
      }
      var wrap = d.h("div", { class: "libgrid" });
      shown.forEach(function (e) {
        wrap.appendChild(N.cards.card(e, kind));
      });
      grid.appendChild(wrap);
    }

    filter.value = state.q;
    filter.addEventListener("input", function () {
      state.q = filter.value;
      paint();
    });
    paint();
    return view;
  }

  /* ============================================================
     schedule / announcements / backups
     ============================================================ */
  function scheduleView() {
    var S = N.schedule;
    var view = d.h("div", { class: "rel-view" });
    view.appendChild(d.h("div", { class: "view-head" }, [d.h("h2", null, "School schedule")]));
    var panel = d.h("div", { class: "panel glass" });
    view.appendChild(panel);
    if (!S) return view;

    var info = S.todayInfo();
    if (!info.type) {
      panel.appendChild(d.h("p", { class: "lines", style: { color: "var(--text-2)" } }, info.dayName + " \u2014 no school. Monday is a Regular day."));
      return view;
    }
    var blocks = S.blocksFor(info.type);
    panel.appendChild(
      d.h("div", { class: "today-card" }, [
        d.h("span", { class: "chip" + (info.type === "win" ? " accent" : "") }, info.type === "win" ? "Homeroom/WIN day" : "Regular schedule"),
        d.h("b", { class: "tc-date" }, info.full),
        d.h("span", { class: "tc-note" }, info.kind.note)
      ]),
    );
    var strip = S.liveStrip(blocks);
    panel.appendChild(strip.el);
    var lv = S.live(blocks);
    panel.appendChild(S.grid(blocks, lv.block ? lv.i : -1, { live: true }));
    panel.appendChild(
      d.h("p", { class: "sched-note" }, "Times are the sample bells. Rename periods and pick a lunch period on the full site's /schedule.html."),
    );

    setInterval(function () {
      if (!document.body.contains(panel)) return;
      var nv = S.live(blocks);
      strip.paint(nv);
      var idx = nv.block ? nv.i : -1;
      panel.querySelectorAll(".sched-row").forEach(function (r, i) {
        r.classList.toggle("now", i === idx);
      });
      /* the moment a period ends and the next begins */
      var key = nv.block ? nv.block.name : null;
      if (key !== periodKey) {
        if (periodKey !== undefined && key && !LITE && N.fx) N.fx.confetti();
        periodKey = key;
      }
    }, 1000);
    return view;
  }
  var periodKey;

  function announcementsView() {
    var view = d.h("div", { class: "rel-view" });
    view.appendChild(d.h("div", { class: "view-head" }, [d.h("h2", null, "Announcements")]));
    var list = d.h("div", { class: "ann-grid" });
    (C.announcements || []).forEach(function (a) {
      list.appendChild(
        d.h("div", { class: "ann-card glass" }, [
          d.h("div", { class: "ann-top" }, [
            d.h("span", { class: "chip accent" }, a.category || "info"),
            d.h("span", { class: "ann-date" }, a.date)
          ]),
          d.h("h3", null, a.title),
          d.h("p", null, a.desc)
        ]),
      );
    });
    view.appendChild(list);
    return view;
  }

  function backupsView() {
    var view = d.h("div", { class: "rel-view" });
    view.appendChild(d.h("div", { class: "view-head" }, [d.h("h2", null, "Backup links")]));
    view.appendChild(
      d.h("p", { class: "lines", style: { color: "var(--text-2)", marginBottom: "14px" } }, "If NULL goes down on one host, the others still reach it. Statuses are maintained by hand."),
    );
    var rows = (C.backups || [
      { t: "Primary domain", u: "/", s: "All Good", d: "The main site." }
    ]);
    var box = d.h("div", { class: "mirror-list" });
    rows.forEach(function (m, i) {
      var tone = m.s === "All Good" ? "ok" : m.s === "Blocked" ? "bad" : "warn";
      box.appendChild(
        d.h("div", { class: "mirror glass" }, [
          d.h("span", { class: "m-num" }, String(i + 1)),
          d.h("div", { class: "m-body" }, [
            d.h("h3", null, [m.t, d.h("span", { class: "chip " + tone }, m.s)]),
            d.h("p", null, m.d)
          ]),
          d.h("a", { class: "btn btn-outline btn-sm", href: m.u, target: "_blank", rel: "noopener" }, "Open")
        ]),
      );
    });
    view.appendChild(box);
    return view;
  }

  /* ============================================================
     shop — economy, crate, quests, unlocks
     ============================================================ */
  function fmtTime(sec) {
    var m = Math.floor(sec / 60);
    if (m < 60) return m + "m";
    return Math.floor(m / 60) + "h" + (m % 60 ? " " + (m % 60) + "m" : "");
  }

  function buy(type, id, name, price) {
    var st = N.econ.state();
    if (st.coins < price) {
      d.toast("Not enough coins yet \u2014 keep playing to earn more!", { type: "err", icon: "coin" });
      return;
    }
    N.modal.confirm({
      title: "Unlock " + name + "?",
      icon: "coin",
      body: "<p>This spends <b>" + price + " coins</b>. You have <b>" + st.coins + "</b>.</p><p style='color:var(--text-2)'>Unlocks are local to this browser.</p>",
      okLabel: "Buy for " + price,
      onOk: function () {
        var r = N.econ.buy(type, id);
        if (!r.ok) {
          d.toast(r.reason === "not enough coins" ? "Not enough coins yet." : "Could not unlock that.", { type: "err" });
          return;
        }
        d.toast("Unlocked: " + name, { icon: "check" });
        if (N.fx && N.fx.confetti) N.fx.confetti();
        render();
      }
    });
  }

  function ecoBar() {
    var st = N.econ.state();
    var sinceMilestone = st.xp % 100;
    var bar = d.h("div", { class: "eco-bar glass" }, [
      d.h("div", { class: "eco-coin" }, [
        d.h("span", { class: "eco-coin-ic" }, [d.icon("coin")]),
        d.h("div", { class: "eco-coin-num" }, [d.h("b", null, String(st.coins)), d.h("span", null, "coins")])
      ]),
      d.h("div", { class: "eco-prog" }, [
        d.h("div", { class: "eco-prog-head" }, [
          d.h("b", null, st.xp + " XP"),
          d.h("span", null, 100 - sinceMilestone + " XP until +30 coins")
        ]),
        d.h("div", { class: "eco-track" }, [d.h("i", { style: { width: Math.min(100, sinceMilestone) + "%" } })])
      ]),
      d.h("div", { class: "eco-mini" }, [d.h("b", null, fmtTime(st.time)), d.h("span", null, "time played")]),
      d.h("div", { class: "eco-mini" }, [d.h("b", null, String(st.xp)), d.h("span", null, "total XP")])
    ]);
    if (st.boosted) bar.appendChild(d.h("span", { class: "chip accent" }, [d.icon("boost"), "XP boost active"]));
    if (st.streak) bar.appendChild(d.h("span", { class: "chip" }, [d.icon("star"), st.streak + " day streak"]));
    return bar;
  }

  function shopRow(thumb, info, foot) {
    return d.h("article", { class: "shop-card glass" }, [thumb, info, foot]);
  }

  function ownedFoot(owned, applied, onToggle) {
    var foot = d.h("div", { class: "shop-foot" });
    if (owned) {
      foot.appendChild(d.h("span", { class: "chip ok" }, [d.h("span", { class: "dot" }), "Unlocked"]));
      foot.appendChild(
        d.h("button", {
          type: "button",
          class: "btn " + (applied ? "btn-primary" : "btn-outline") + " btn-sm",
          onclick: onToggle
        }, applied ? [d.icon("check"), "Applied"] : [d.icon("pen"), "Apply"]),
      );
    }
    return foot;
  }

  function packCard(p) {
    var owned = !!(p.free || N.econ.isUnlocked("theme", p.id));
    var applied = N.prefs.get("accent") === p.id;
    var foot = ownedFoot(owned, applied, function () {
      if (applied) {
        N.prefs.set("accent", "off");
        N.theme.setAccent("off");
      } else {
        N.prefs.set("accent", p.id);
        N.theme.setAccent(p.id);
      }
      if (N.seasons) N.seasons.refresh();
      render();
    });
    if (!owned) {
      foot.appendChild(d.h("span", { class: "chip price-chip" }, [d.icon("coin"), String(p.price)]));
      foot.appendChild(d.h("button", {
        type: "button",
        class: "btn btn-primary btn-sm",
        onclick: function () {
          buy("theme", p.id, p.name, p.price);
        }
      }, "Unlock"));
    }
    return shopRow(
      N.theme.packThumb(p, { lock: !owned }),
      d.h("div", { class: "shop-info" }, [
        d.h("h3", null, p.name),
        d.h("p", null, p.desc || ""),
        d.h("div", { class: "chips-row" }, (p.tags || []).map(function (t) {
          return d.h("span", { class: "chip" }, t);
        }))
      ]),
      foot,
    );
  }

  function partCard(p) {
    var owned = !!(p.free || N.econ.isUnlocked("particle", p.id));
    var applied = N.prefs.get("particles") === p.id;
    var foot = ownedFoot(owned, applied, function () {
      if (applied) {
        N.prefs.set("particles", "none");
        N.theme.setParticles("none");
      } else {
        N.prefs.set("particles", p.id);
        N.theme.setParticles(p.id);
      }
      d.toast(applied ? "Background particles off" : "Particles: " + p.name, { icon: "sparkle" });
      render();
    });
    if (!owned) {
      foot.appendChild(d.h("span", { class: "chip price-chip" }, [d.icon("coin"), String(p.price)]));
      foot.appendChild(d.h("button", {
        type: "button",
        class: "btn btn-primary btn-sm",
        onclick: function () {
          buy("particle", p.id, p.name, p.price);
        }
      }, "Unlock"));
    }
    return shopRow(
      N.theme.partThumb(p, { lock: !owned }),
      d.h("div", { class: "shop-info" }, [
        d.h("h3", null, p.name),
        d.h("p", null, p.desc || ""),
        d.h("div", { class: "chips-row" }, (p.tags || []).map(function (t) {
          return d.h("span", { class: "chip" }, t);
        }))
      ]),
      foot,
    );
  }

  function shopSection(title, icon, hint, rows) {
    var sec = d.h("div", { class: "section" });
    sec.appendChild(d.h("div", { class: "section-head" }, [
      d.h("h2", null, [d.icon(icon), title]),
      d.h("span", { class: "hint" }, hint || "")
    ]));
    sec.appendChild(d.h("div", { class: "shop-grid" }, rows));
    return sec;
  }

  function shopView() {
    var view = d.h("div", { class: "rel-view" });
    view.appendChild(
      d.h("div", { class: "page-head" }, [
        d.h("h2", null, "Shop"),
        d.h("p", { style: { color: "var(--text-2)" } }, "Play to bank XP and coins \u2014 spend them here. No real money, nothing leaves this browser.")
      ]),
    );
    view.appendChild(ecoBar());

    var st = N.econ.state();
    view.appendChild(
      d.h("div", { class: "rel-actions" }, [
        d.h("button", {
          type: "button",
          class: "btn btn-primary",
          onclick: function () {
            N.daily.openCrate(function () {
              render();
            });
          }
        }, [d.icon("gift"), st.canSpin ? "Open the daily crate" : "Crate opened today"]),
        d.h("button", {
          type: "button",
          class: "btn btn-outline",
          onclick: function () {
            N.modal.open({
              title: "Daily quests",
              icon: "zap",
              body: N.daily.questList(function () {
                render();
              })
            });
          }
        }, "Daily quests"),
        d.h("button", {
          type: "button",
          class: "btn btn-outline",
          onclick: function () {
            N.modal.open({
              title: "Achievements",
              icon: "trophy",
              body: N.daily.achList(function () {
                render();
              })
            });
          }
        }, "Achievements")
      ]),
    );

    var betas = C.betas || [];
    if (betas.length) {
      view.appendChild(
        shopSection("Beta games", "game", "unlocked builds join your library", betas.map(function (b) {
          var owned = N.econ.isUnlocked("game", b.id);
          var foot = d.h("div", { class: "shop-foot" });
          if (owned) {
            foot.appendChild(d.h("span", { class: "chip ok" }, [d.h("span", { class: "dot" }), "Unlocked"]));
          } else {
            foot.appendChild(d.h("span", { class: "chip price-chip" }, [d.icon("coin"), String(b.price)]));
            foot.appendChild(d.h("button", {
              type: "button",
              class: "btn btn-primary btn-sm",
              onclick: function () {
                buy("game", b.id, b.name, b.price);
              }
            }, "Unlock"));
          }
          return shopRow(
            d.h("div", { class: "shop-thumb" }, [d.icon("game")]),
            d.h("div", { class: "shop-info" }, [d.h("h3", null, b.name), d.h("p", null, b.desc || "")]),
            foot,
          );
        })),
      );
    }

    if (!LITE) {
      view.appendChild(shopSection("Theme packs", "pen", "a palette and a live backdrop", N.econ.THEMES.map(packCard)));
      view.appendChild(shopSection("Background particles", "sparkle", "ambient motion everywhere", N.econ.PARTICLES.map(partCard)));
    }

    view.appendChild(
      shopSection("Boosts", "boost", "speed up earning", N.econ.BOOSTS.map(function (b) {
        var owned = N.econ.isUnlocked("fx", b.id);
        var foot = d.h("div", { class: "shop-foot" });
        if (owned) foot.appendChild(d.h("span", { class: "chip ok" }, [d.h("span", { class: "dot" }), "Active"]));
        else {
          foot.appendChild(d.h("span", { class: "chip price-chip" }, [d.icon("coin"), String(b.price)]));
          foot.appendChild(d.h("button", {
            type: "button",
            class: "btn btn-primary btn-sm",
            onclick: function () {
              buy("fx", b.id, b.name, b.price);
            }
          }, "Unlock"));
        }
        return shopRow(d.h("div", { class: "shop-thumb" }, [d.icon("boost")]), d.h("div", { class: "shop-info" }, [d.h("h3", null, b.name), d.h("p", null, b.desc || "")]), foot);
      })),
    );

    view.appendChild(
      shopSection("Effects", "sparkle", "cosmetic unlocks", N.econ.FX.map(function (f) {
        var owned = N.econ.isUnlocked("fx", f.id);
        var foot = d.h("div", { class: "shop-foot" });
        if (owned) foot.appendChild(d.h("span", { class: "chip ok" }, [d.h("span", { class: "dot" }), "Unlocked"]));
        else {
          foot.appendChild(d.h("span", { class: "chip price-chip" }, [d.icon("coin"), String(f.price)]));
          foot.appendChild(d.h("button", {
            type: "button",
            class: "btn btn-primary btn-sm",
            onclick: function () {
              buy("fx", f.id, f.name, f.price);
            }
          }, "Unlock"));
        }
        return shopRow(d.h("div", { class: "shop-thumb" }, [d.icon("sparkle")]), d.h("div", { class: "shop-info" }, [d.h("h3", null, f.name), d.h("p", null, f.desc || "")]), foot);
      })),
    );
    return view;
  }

  /* ============================================================
     settings
     ============================================================ */
  function settingsView() {
    var view = d.h("div", { class: "rel-view" });
    var look = d.h("div", { class: "set-card glass" }, [d.h("h2", { class: "set-title" }, "Appearance")]);
    view.appendChild(look);
    themeRow(look);
    accentRow(look);
    if (!LITE) glowRow(look);
    perfRow(look);

    if (!LITE) {
      var packs = d.h("div", { class: "set-card glass", style: { marginTop: "14px" } }, [
        d.h("h2", { class: "set-title" }, "Theme packs"),
        d.h("p", { class: "set-sub" }, "A palette and a live animated backdrop. Locked packs show what you get \u2014 nothing is hidden.")
      ]);
      view.appendChild(packs);
      packs.appendChild(d.h("div", { class: "shop-grid" }, N.theme.allPacks().map(packCard)));

      var parts = d.h("div", { class: "set-card glass", style: { marginTop: "14px" } }, [
        d.h("h2", { class: "set-title" }, "Background particles"),
        d.h("p", { class: "set-sub" }, "Ambient motion behind the whole interface.")
      ]);
      view.appendChild(parts);
      parts.appendChild(d.h("div", { class: "shop-grid" }, N.theme.allParticles().map(partCard)));
    }

    var misc = d.h("div", { class: "set-card glass", style: { marginTop: "14px" } }, [d.h("h2", { class: "set-title" }, "Browser tab & data")]);
    view.appendChild(misc);
    tabRow(misc);
    dataRow(misc);
    return view;
  }

  function seg(parent, options, current, onPick) {
    var box = d.h("div", { class: "seg" });
    options.forEach(function (o) {
      var b = d.h("button", {
        type: "button",
        class: "chip chip-btn" + (current === o.id ? " on" : ""),
        onclick: function () {
          box.querySelectorAll("button").forEach(function (x) {
            x.classList.remove("on");
          });
          b.classList.add("on");
          onPick(o.id);
        }
      }, o.name);
      box.appendChild(b);
    });
    parent.appendChild(box);
    return box;
  }

  function themeRow(card) {
    var row = d.h("div", { class: "set-row" }, [
      d.h("div", { class: "lbl-txt" }, [d.h("b", null, "Theme"), d.h("span", null, "Dark or Light \u2014 NULL inverted.")])
    ]);
    seg(row, [{ id: "dark", name: "Dark" }, { id: "light", name: "Light" }], N.prefs.get("theme"), function (id) {
      N.prefs.set("theme", id);
      N.theme.setTheme(id);
    });
    card.appendChild(row);
    return row;
  }

  function accentRow(card) {
    var box = d.h("div", { class: "glow-row" });
    var row = d.h("div", { class: "set-row" }, [
      d.h("div", { class: "lbl-txt" }, [d.h("b", null, "Accent"), d.h("span", null, "Restrained \u2014 grayscale stays.")]),
      box
    ]);
    var list = N.theme.ACCENTS.concat(N.theme.extraAccents ? N.theme.extraAccents() : []);
    var applied = N.prefs.get("accent");
    if (applied !== "off" && !list.some(function (a) {
      return a.id === applied;
    })) applied = "off";
    list.forEach(function (a) {
      var b = d.h("button", {
        type: "button",
        class: "chip chip-btn" + (applied === a.id ? " on" : ""),
        onclick: function () {
          box.querySelectorAll("button").forEach(function (x) {
            x.classList.remove("on");
          });
          b.classList.add("on");
          N.prefs.set("accent", a.id);
          N.theme.setAccent(a.id);
        }
      }, a.name);
      box.appendChild(b);
    });
    if (N.theme.customOn && N.theme.customOn()) {
      var pick = d.h("input", { type: "color", class: "field", value: N.prefs.get("accentColor") || "#6cc7ff", style: { width: "46px", height: "30px", padding: "0" } });
      pick.addEventListener("input", function () {
        N.theme.setCustomAccent(pick.value);
      });
      box.appendChild(pick);
    }
    card.appendChild(row);
    return row;
  }

  function glowRow(card) {
    var box = d.h("div", { class: "glow-row" });
    var row = d.h("div", { class: "set-row" }, [
      d.h("div", { class: "lbl-txt" }, [d.h("b", null, "Glow border"), d.h("span", null, "Re-inks the viewport edge. Neon lights the cards.")]),
      box
    ]);
    function paintG() {
      box.textContent = "";
      N.theme.GLOWS.forEach(function (g) {
        if (g.id === "custom" && N.theme.customOn && !N.theme.customOn()) return;
        var b = d.h("button", {
          type: "button",
          class: "chip chip-btn" + (N.prefs.get("glow") === g.id ? " on" : ""),
          onclick: function () {
            box.querySelectorAll("button").forEach(function (x) {
              x.classList.remove("on");
            });
            b.classList.add("on");
            N.prefs.set("glow", g.id);
            N.theme.setGlow(g.id);
            c1.hidden = c2.hidden = g.id !== "custom";
          }
        }, g.name);
        if (g.colors) {
          b.appendChild(
            d.h("span", { class: "accent-dots" }, g.colors.slice(0, 4).map(function (c) {
              return d.h("i", { style: { background: c } });
            })),
          );
        }
        box.appendChild(b);
      });
      c1.hidden = c2.hidden = N.prefs.get("glow") !== "custom";
    }
    var c1 = d.h("input", { type: "color", class: "field", value: N.prefs.get("glowColor1") || "#35c3f2", style: { width: "44px", height: "30px", padding: "0" } });
    var c2 = d.h("input", { type: "color", class: "field", value: N.prefs.get("glowColor2") || "#a86bff", style: { width: "44px", height: "30px", padding: "0" } });
    [c1, c2].forEach(function (inp) {
      inp.addEventListener("input", function () {
        N.prefs.set(inp === c1 ? "glowColor1" : "glowColor2", inp.value);
        if (N.prefs.get("glow") === "custom") N.theme.setGlow("custom");
      });
    });
    box.appendChild(c1);
    box.appendChild(c2);
    paintG();
    card.appendChild(row);
    return row;
  }

  function perfRow(card) {
    var row = d.h("div", { class: "set-row" }, [
      d.h("div", { class: "lbl-txt" }, [d.h("b", null, "Performance mode"), d.h("span", null, "Disables animation, glow, particles and blur on slower devices.")])
    ]);
    var lab = d.h("label", { class: "switch" });
    var sw = d.h("input", { type: "checkbox", checked: !!N.prefs.get("perf") });
    if (LITE) sw.disabled = true;
    sw.addEventListener("change", function () {
      N.prefs.set("perf", sw.checked);
      N.theme.setPerf(sw.checked);
    });
    lab.appendChild(sw);
    lab.appendChild(d.h("span", { class: "track" }));
    row.appendChild(lab);
    card.appendChild(row);
    return row;
  }

  function tabRow(card) {
    var sel = d.h("select", { class: "field", style: { height: "38px", maxWidth: "240px", padding: "0 10px" } });
    N.tab.list.forEach(function (p) {
      var o = d.h("option", { value: p.id }, p.name);
      if (p.id === N.prefs.get("tab")) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      N.prefs.set("tab", sel.value);
      N.tab.apply();
    });
    var row = d.h("div", { class: "set-row" }, [
      d.h("div", { class: "lbl-txt", style: { flex: "1" } }, [
        d.h("b", null, "Tab preset"),
        d.h("span", null, "Overrides the browser tab title & icon.")
      ]),
      sel
    ]);
    card.appendChild(row);
    return row;
  }

  function exportData() {
    var bag = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("null:") === 0) bag[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    var payload = { app: "null", v: 1, at: new Date().toISOString(), data: bag };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = d.h("a", { href: url, download: "null-data-" + new Date().toISOString().slice(0, 10) + ".json" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 4000);
    d.toast("Downloaded " + Object.keys(bag).length + " saved items", { icon: "check" });
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onerror = function () {
      d.toast("Could not read that file.", { type: "err" });
    };
    reader.onload = function () {
      var bag = null;
      try {
        var parsed = JSON.parse(String(reader.result));
        bag = parsed && parsed.data ? parsed.data : parsed;
      } catch (e) {}
      if (!bag || typeof bag !== "object") {
        d.toast("That is not a NULL backup file.", { type: "err" });
        return;
      }
      var n = 0;
      Object.keys(bag).forEach(function (k) {
        if (k.indexOf("null:") !== 0) return;
        try {
          localStorage.setItem(k, String(bag[k]));
          n++;
        } catch (e) {}
      });
      d.toast("Restored " + n + " items \u2014 reloading", { icon: "check" });
      setTimeout(function () {
        location.reload();
      }, 700);
    };
    reader.readAsText(file);
  }

  function dataRow(card) {
    var file = d.h("input", { type: "file", accept: "application/json,.json", style: { display: "none" } });
    file.addEventListener("change", function () {
      if (file.files && file.files[0]) importData(file.files[0]);
      file.value = "";
    });
    document.body.appendChild(file);

    var row = d.h("div", { class: "set-row" }, [
      d.h("div", { class: "lbl-txt" }, [
        d.h("b", null, "NULL data on this device"),
        d.h("span", null, N.recent.list().length + " recent \u00b7 " + N.favs.list().length + " favorites \u00b7 " + N.econ.state().coins + " coins")
      ]),
      d.h("div", { class: "icon-btn-row" }, [
        d.h("button", { type: "button", class: "btn btn-outline btn-sm", onclick: exportData }, [d.icon("download"), "Download"]),
        d.h("button", { type: "button", class: "btn btn-outline btn-sm", onclick: function () { file.click(); } }, [d.icon("upload"), "Upload"]),
        d.h("button", {
          type: "button",
          class: "btn btn-outline-danger btn-sm",
          onclick: function () {
            N.modal.confirm({
              title: "Wipe all NULL data?",
              icon: "trash",
              iconTone: "danger",
              body: "<p>Removes recent, favorites, preferences, coins and unlocks for this browser. No undo.</p>",
              okLabel: "Wipe everything",
              okVariant: "danger",
              onOk: function () {
                var keys = [];
                try {
                  for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && k.indexOf("null:") === 0) keys.push(k);
                  }
                } catch (e) {}
                keys.forEach(function (k) {
                  N.store.del(k);
                });
                location.reload();
              }
            });
          }
        }, [d.icon("trash"), "Wipe"])
      ])
    ]);
    card.appendChild(row);
    return row;
  }

  /* ============================================================
     render
     ============================================================ */
  function render() {
    if (viewHost) viewHost.remove();
    var page = state.page;
    if (page === "games") viewHost = libraryView(cat().games || [], "game");
    else if (page === "apps") viewHost = libraryView(cat().apps || [], "app");
    else if (page === "proxies") viewHost = libraryView(cat().proxies || [], "proxy");
    else if (page === "schedule") viewHost = scheduleView();
    else if (page === "announcements") viewHost = announcementsView();
    else if (page === "shop") viewHost = shopView();
    else if (page === "backups") viewHost = backupsView();
    else if (page === "settings") viewHost = settingsView();
    else viewHost = homeView();
    root.appendChild(viewHost);
  }

  function boot() {
    /* lite is the stripped build: no backdrop, no particles, no motion */
    if (LITE) {
      N.prefs.set("perf", true);
      N.prefs.set("particles", "none");
      N.prefs.set("glow", "off");
      document.documentElement.dataset.perf = "1";
    }
    root.appendChild(header());
    root.appendChild(nav());

    var h = (location.hash || "").replace("#", "");
    if ((NAV[TIER] || NAV.regular).indexOf(h) >= 0) state.page = h;

    N.theme.applyAll();
    N.tab.apply();
    N.modal.armSgGames();
    render();

    var foot = d.h("div", { class: "foot" });
    foot.appendChild(d.h("span", null, "NULL " + TIER + " \u00b7 single-file build \u00b7 " + new Date().getFullYear()));
    foot.appendChild(d.h("span", null, "Favorites, history, coins and settings live in this browser."));
    if (N.search) {
      foot.appendChild(
        d.h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: function () { N.search.open(); } }, "Search everything"),
      );
    }
    root.appendChild(foot);

    /* the site's global shortcuts (panic key, "/" to search, tab cloak) come
       from shell.js; it only wires chrome into [data-mount] nodes, which this
       build deliberately does not provide. */
    if (N.shell && N.shell.init) N.shell.init();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
