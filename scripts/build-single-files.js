/* NULL — build-single-files.js
   Generates releases/null-mini.html, null-lite.html and null-regular.html.
   Each release is ONE self-contained HTML file: the full stylesheet and the
   core runtime are inlined, the catalog is embedded (small first-party games
   and apps are embedded as data: URIs so they still work standalone), and a
   small tier-driven shell renders the views. Nothing is fetched at runtime
   from the main project.

   Run with: bun run releases   (or node scripts/build-single-files.js)
   The generated files are build output — edit the scripts, not the files. */
import fs from "node:fs";
import path from "node:path";
import { discoverContent } from "./discover-content.js";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "releases");

const css = fs.readFileSync(path.join(ROOT, "src/styles/global.css"), "utf8");
const favicon = fs.readFileSync(path.join(ROOT, "public/favicon.svg"), "utf8");

function read(p) {
  try {
    return fs.readFileSync(path.join(ROOT, p), "utf8");
  } catch (err) {
    return null;
  }
}

function b64(file) {
  return fs.readFileSync(path.join(ROOT, file)).toString("base64");
}

const FALLBACK_THUMB = {
  game: "data:image/svg+xml;base64," + b64("public/fallback-assets/thumb-game.svg"),
  app: "data:image/svg+xml;base64," + b64("public/fallback-assets/thumb-app.svg"),
  proxy: "data:image/svg+xml;base64," + b64("public/fallback-assets/thumb-proxy.svg"),
};

const MAX_EMBED_HTML = 160 * 1024; // embed only small first-party html files

function thumbFor(kind, entry) {
  if (entry.thumb) {
    const abs = path.join(ROOT, entry.thumb.replace(/^\//, ""));
    if (fs.existsSync(abs)) {
      const ext = entry.thumb.split(".").pop().toLowerCase();
      const mime =
        ext === "svg"
          ? "image/svg+xml"
          : ext === "png"
            ? "image/png"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : ext === "webp"
                ? "image/webp"
                : ext === "gif"
                  ? "image/gif"
                  : "application/octet-stream";
      return "data:" + mime + ";base64," + b64(entry.thumb.replace(/^\//, ""));
    }
  }
  return FALLBACK_THUMB[kind];
}

function embedHtml(entry) {
  const abs = path.join(ROOT, entry.file.replace(/^\//, ""));
  if (!fs.existsSync(abs)) return null;
  const size = fs.statSync(abs).size;
  if (size > MAX_EMBED_HTML) return null;
  const html = fs.readFileSync(abs, "utf8");
  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}

function buildReleaseCatalog(catalog) {
  const games = catalog.games.map(function (g) {
    return {
      id: g.id,
      name: g.name,
      desc: g.desc,
      file: g.file,
      data: embedHtml(g),
      thumb: thumbFor("game", g),
      labels: g.labels,
      warning: g.warning,
    };
  });
  const apps = catalog.apps.map(function (a) {
    return {
      id: a.id,
      name: a.name,
      desc: a.desc,
      file: a.file,
      data: embedHtml(a),
      thumb: thumbFor("app", a),
      labels: a.labels,
      warning: a.warning,
    };
  });
  const proxies = catalog.proxies.map(function (p) {
    return {
      id: p.id,
      name: p.name,
      desc: p.desc,
      url: p.url,
      status: p.status,
      thumb: thumbFor("proxy", p),
    };
  });
  return { games: games, apps: apps, proxies: proxies };
}

/* extra css just for the release shell */
const RELEASE_CSS = `
.rel-shell{max-width:1120px;margin:0 auto;padding:14px 16px 80px}
.rel-top{position:sticky;top:0;z-index:80;display:flex;align-items:center;gap:10px;
  padding:10px 14px;border:1px solid var(--line);border-radius:16px;
  background:var(--bg-2)}
.rel-top .sp{flex:1}
.rel-nav{display:flex;flex-wrap:wrap;gap:6px;padding:12px 0 6px}
.rel-view{margin-top:14px}
.rel-hero{border-radius:26px;padding:26px 26px 22px;margin-top:8px}
.rel-hero h1{font-size:clamp(30px,6vw,52px);letter-spacing:-.03em;margin:4px 0 10px}
.rel-hero p{color:var(--text-2);max-width:560px;line-height:1.6}
.rel-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.libgrid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(208px,1fr))}
.libgrid .tcard{width:100%}
.view-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:8px 0 14px}
.view-head h2{font-size:22px}
.view-head .field{margin-left:auto;min-width:200px;flex:1;max-width:300px}
.panel+.panel{margin-top:16px}
.foot{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);color:var(--text-2);font-size:12.5px;
  display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:center}
.lines p{margin:8px 0}
`;

const CORE_JS = [
  "src/utilities/store.js",
  "src/utilities/dom.js",
  "src/utilities/modal.js",
  "src/utilities/theme.js",
  "src/components/tabpresets.js",
  "src/catalog/catalog.js",
  "src/components/cards.js",
];

/* ============================================================
   Release application module (plain JS, no template literals) —
   a self-contained mini-shell that renders NULL's views.
   ============================================================ */
const APP_JS = String.raw`
(function () {
  var N = window.N;
  var d = N.dom;
  var C = window.NULL_CONTENT || { announcements: [], pages: [] };
  var TIER = window.RELEASE_TIER || "regular";
  var root = document.getElementById("rel");
  var viewHost = null;
  var state = { q: "", kind: "game", page: "home" };
  var first = true;

  var NAV = {
    mini: ["home", "games", "apps", "settings"],
    lite: ["home", "games", "apps", "proxies", "schedule", "settings"],
    regular: ["home", "games", "apps", "proxies", "announcements", "schedule", "backups", "settings"]
  };
  var NAV_T = { home: "Home", games: "Games", apps: "Apps", proxies: "Proxies",
    announcements: "News", schedule: "Schedule", backups: "Backups", settings: "Settings" };

  function cat() { return window.NULL_CATALOG || { games: [], apps: [], proxies: [] }; }

  function go(page) {
    state.page = page;
    try { location.hash = page; } catch (e) {}
    paintNav();
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- header ---------- */
  function header() {
    var h = d.h("div", { class: "rel-top glass-2" });
    var mark = d.h("span", { class: "brand-mark" });
    mark.innerHTML = '<svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor"><rect x="1.6" y="1.6" width="28.8" height="28.8" rx="9.5" stroke-opacity="0.35" stroke-width="1.6"/><circle cx="16" cy="16" r="7.6" stroke-width="2.6"/><path d="M11.3 11.3l9.4 9.4" stroke-width="2.6" stroke-linecap="round"/></svg>';
    var name = d.h("span", { class: "brand-name" }, "NULL");
    var chip = d.h("span", { class: "chip accent" }, TIER.toUpperCase() + " \u00b7 standalone");
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
    theme.appendChild(d.icon("sun"));
    paintThemeIcon(theme);
    h.appendChild(mark);
    h.appendChild(name);
    h.appendChild(chip);
    h.appendChild(d.h("span", { class: "sp" }));
    h.appendChild(theme);
    return h;
  }

  function paintThemeIcon(btn) {
    btn.textContent = "";
    btn.appendChild(d.icon(document.documentElement.dataset.theme === "light" ? "moon" : "sun"));
  }

  function nav() {
    var el = d.h("div", { class: "rel-nav" });
    (NAV[TIER] || NAV.lite).forEach(function (p) {
      var b = d.h("button", {
        type: "button",
        class: "chip chip-btn" + (state.page === p ? " on" : ""),
        onclick: function () { go(p); }
      }, p === "games" ? NAV_T[p] : NAV_T[p]);
      el.appendChild(b);
    });
    return el;
  }

  function paintNav() {
    var bar = root.querySelector(".rel-nav");
    if (bar) bar.remove();
    root.querySelector(".rel-top").insertAdjacentElement("afterend", nav());
  }

  /* ---------- player overlay ---------- */
  function openPlayer(entry, kind) {
    var run = function () {
      N.recent.add(kind, entry.id);
      N.tab.apply();
      var overlay = d.h("div", { class: "player", style: { zIndex: "400" } });
      var load = d.h("div", { class: "player-loading" }, [d.h("div", { class: "spin" }), d.h("span", null, "starting\u2026")]);
      var frame = d.h("iframe", { title: entry.name, style: { width: "100%", height: "100%", border: "0", background: "#0c0c0f" } });
      frame.addEventListener("load", function () { load.remove(); });
      frame.src = entry.data || entry.file;
      var bar = d.h("div", { class: "player-bar" });
      var back = d.h("button", { type: "button", class: "btn-icon btn-ghost", onclick: function () { overlay.remove(); document.body.style.overflow = ""; } });
      back.appendChild(d.icon("back"));
      var meta = d.h("div", { class: "player-meta" }, [
        d.h("b", null, entry.name),
        d.h("span", null, (kind === "game" ? "Game" : "App") + " \u00b7 NULL " + TIER)
      ]);
      var fsBtn = d.h("button", { type: "button", class: "btn-icon btn-outline", title: "Fullscreen", style: { width: "38px", height: "38px", borderRadius: "11px" } });
      fsBtn.appendChild(d.icon("max"));
      fsBtn.addEventListener("click", function () {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (overlay.requestFullscreen) overlay.requestFullscreen();
      });
      var actions = d.h("div", { class: "player-actions" }, [fsBtn]);
      bar.appendChild(back);
      bar.appendChild(meta);
      bar.appendChild(actions);
      var wrap = d.h("div", { class: "player-frame" }, [load, frame]);
      overlay.appendChild(bar);
      overlay.appendChild(wrap);
      document.body.appendChild(overlay);
      document.body.style.overflow = "hidden";
    };
    if (entry.warning) {
      N.modal.open({
        title: entry.warning.title || "Heads up",
        icon: "warn",
        iconTone: "warn",
        body: "<p>" + (entry.warning.description || "").replace(/\n/g, "<br>") + "</p>",
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

  function launch(entry, kind) {
    if (kind === "proxy") { N.launch.proxy(entry); return; }
    openPlayer(entry, kind);
  }

  /* ---------- views ---------- */
  function emptyState(box, title, msg) {
    box.appendChild(N.cards.empty(title, msg));
  }

  function libraryView(kindList, kind) {
    var view = d.h("div", { class: "rel-view" });
    var label = kind === "game" ? "Games" : kind === "app" ? "Apps" : "Proxies";
    var items = kindList;
    var filter = d.h("input", { type: "text", placeholder: "Filter " + label.toLowerCase(), "aria-label": "Filter" });
    var count = d.h("span", { class: "chip", style: { marginLeft: "auto" } });
    var head = d.h("div", { class: "view-head" }, [
      d.h("h2", null, label),
      kind !== "proxy" ? d.h("button", { type: "button", class: "chip chip-btn", onclick: function () {
          var list = cat()[kind === "game" ? "games" : "apps"];
          if (list.length) launch(list[Math.floor(Math.random() * list.length)], kind);
        } }, "surprise me") : null,
      d.h("span", { class: "field", style: { maxWidth: "260px", flex: "1", minWidth: "150px" } }, [d.icon("search"), filter]),
      count
    ]);
    view.appendChild(head);
    var grid = d.h("div");
    view.appendChild(grid);

    function paint() {
      grid.textContent = "";
      count.textContent = "";
      var q = state.q.toLowerCase().trim();
      var shown = items.filter(function (e) {
        if (!q) return true;
        return (e.name + " " + (e.labels || []).join(" ") + " " + (e.desc || "")).toLowerCase().indexOf(q) >= 0;
      });
      count.textContent = shown.length + "/" + items.length;
      if (!shown.length) {
        emptyState(grid, "No matches", "Try another filter.");
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

  function homeView() {
    var view = d.h("div", { class: "rel-view" });
    var c = cat();
    var hero = d.h("div", { class: "hero glass-2" }, [
      d.h("span", { class: "hero-eyebrow" }, "NULL \u2014 " + TIER + " \u00b7 standalone single file"),
      d.h("h1", null, "Games, apps & tools."),
      d.h("p", { class: "sub" }, "This is a self-contained NULL build. Favorites, history and settings below are shared with the main site (same browser). Everything else is right here in this one file.")
    ]);
    var actions = d.h("div", { class: "hero-actions" }, [
      d.h("button", { type: "button", class: "btn btn-primary", onclick: function () {
          var g = c.games;
          if (g.length) launch(g[Math.floor(Math.random() * g.length)], "game");
          else d.toast("No games yet.", { type: "err" });
        } }, "Play a random game"),
      d.h("button", { type: "button", class: "btn btn-outline", onclick: function () { go("games"); } }, "Browse games"),
      d.h("span", { class: "chip accent" }, c.games.length + " games \u00b7 " + c.apps.length + " apps \u00b7 " + c.proxies.length + " proxies")
    ]);
    hero.appendChild(actions);
    view.appendChild(hero);

    var recent = d.h("div", { class: "panel glass", style: { marginTop: "16px" } });
    view.appendChild(recent);

    function paintRecent() {
      recent.textContent = "";
      recent.appendChild(d.h("div", { class: "panel-head" }, [
        d.h("h2", null, "Recently played"),
        d.h("button", { type: "button", class: "btn btn-outline-danger btn-sm", onclick: function () { N.recent.clear(); paintRecent(); } }, "Clear list")
      ]));
      var list = d.h("div", { class: "rec-list" });
      var items = N.recent.list().map(function (r) {
        var listKind = r.k === "app" ? cat().apps : r.k === "proxy" ? cat().proxies : cat().games;
        var e = listKind.filter(function (x) { return x.id === r.id; })[0];
        return e ? { e: e, k: r.k } : null;
      }).filter(Boolean).slice(0, 6);
      if (!items.length) {
        recent.appendChild(N.cards.empty("Nothing played yet", "Open something from the library and it lands here."));
        return;
      }
      items.forEach(function (it) { list.appendChild(N.cards.row(it.e, it.k)); });
      recent.appendChild(list);
    }
    paintRecent();
    return view;
  }

  function favsView(recents) {
    var view = d.h("div", { class: "rel-view" });
    var label = recents ? "Recently played" : "Favorites";
    var box = d.h("div", { class: "panel glass", style: { padding: "16px" } });
    view.appendChild(d.h("div", { class: "view-head" }, [
      d.h("h2", null, label),
      d.h("button", { type: "button", class: "btn btn-outline-danger btn-sm", style: { marginLeft: "auto" }, onclick: function () {
          if (recents) N.recent.clear();
          else N.favs.clear();
          paint();
        } }, recents ? "Clear list" : "Clear favorites")
    ]));
    view.appendChild(box);

    function paint() {
      box.textContent = "";
      var src = recents ? N.recent.list() : N.favs.list();
      var items = src.map(function (r) {
        var k = r.k;
        var listKind = k === "app" ? cat().apps : k === "proxy" ? cat().proxies : cat().games;
        var e = listKind.filter(function (x) { return x.id === r.id; })[0];
        return e ? { e: e, k: k } : null;
      }).filter(Boolean);
      if (!items.length) {
        box.appendChild(N.cards.empty(recents ? "Nothing yet" : "No favorites yet", recents ? "Open items from the library." : "Star games and apps from the library."));
        return;
      }
      var list = d.h("div", { class: "rec-list" });
      items.forEach(function (it) {
        var row = N.cards.row(it.e, it.k);
        var x = d.h("button", { type: "button", class: "fav-row" + (!recents ? " on" : ""), title: recents ? "Remove" : "Remove from favorites", onclick: function (ev) {
            ev.stopPropagation();
            if (recents) N.recent.remove(it.k, it.e.id);
            else N.favs.remove(it.k, it.e.id);
            paint();
          } });
        x.appendChild(d.icon(recents ? "x" : "star"));
        row.appendChild(x);
        list.appendChild(row);
      });
      box.appendChild(list);
    }
    paint();
    return view;
  }

  function scheduleView() {
    var S = N.schedule;
    var view = d.h("div", { class: "rel-view" });
    view.appendChild(d.h("div", { class: "view-head" }, [d.h("h2", null, "School schedule")]));
    var panel = d.h("div", { class: "panel glass" });
    view.appendChild(panel);

    var info = S.todayInfo();
    if (!info.type) {
      panel.appendChild(d.h("p", { style: { color: "var(--text-2)" } }, info.dayName + " \u2014 no school. Monday is a Regular day."));
      return view;
    }
    var blocks = S.blocksFor(info.type);
    var head = d.h("div", { class: "today-card" }, [
      d.h("span", { class: "chip" + (info.type === "win" ? " accent" : "") }, info.type === "win" ? "Homeroom/WIN day" : "Regular schedule"),
      d.h("b", { class: "tc-date" }, info.full),
      d.h("span", { class: "tc-note" }, info.kind.note)
    ]);
    panel.appendChild(head);
    var ls = S.liveStrip(blocks);
    panel.appendChild(ls.el);
    var lv = S.live(blocks);
    var idx = lv.block ? lv.i : -1;
    panel.appendChild(S.grid(blocks, idx, { live: true }));
    panel.appendChild(d.h("p", { class: "sched-note" }, "Times are sample bells. Rename periods and pick a lunch period on the full site's /schedule.html."));
    setInterval(function () {
      if (!document.body.contains(panel)) return;
      var nv = S.live(blocks);
      ls.paint(nv);
      panel.querySelectorAll(".sched-row").forEach(function (r, i) {
        r.classList.toggle("now", i === (nv.block ? nv.i : -1));
      });
    }, 1000);
    return view;
  }

  function announcementsView() {
    var view = d.h("div", { class: "rel-view" });
    view.appendChild(d.h("div", { class: "view-head" }, [d.h("h2", null, "Announcements")]));
    var list = d.h("div", { class: "ann-grid" });
    (C.announcements || []).forEach(function (a) {
      var card = d.h("div", { class: "ann-card glass" }, [
        d.h("div", { class: "ann-top" }, [d.h("span", { class: "chip accent" }, a.category || "info"), d.h("span", { class: "ann-date" }, a.date)]),
        d.h("h3", null, a.title),
        d.h("p", null, a.desc)
      ]);
      list.appendChild(card);
    });
    view.appendChild(list);
    return view;
  }

  function backupsView() {
    var view = d.h("div", { class: "rel-view" });
    view.appendChild(d.h("div", { class: "view-head" }, [d.h("h2", null, "Backup links")]));
    view.appendChild(d.h("p", { class: "lines", style: { color: "var(--text-2)", marginBottom: "14px" } }, "If NULL goes down on this domain, check these next \u2014 in priority order. Statuses are set by hand."));
    var rows = [
      { t: "Primary domain", u: "/", s: "All Good", d: "The main site." },
      { t: "Mirror", u: "https://example.net/null", s: "All Good", d: "Replace with a real mirror URL." },
      { t: "Alternate", u: "https://example.net/null-alt", s: "Issue", d: "Sample entry \u2014 replace me." }
    ];
    var box = d.h("div", { class: "mirror-list" });
    rows.forEach(function (m, i) {
      var tone = m.s === "All Good" ? "ok" : m.s === "Blocked" ? "bad" : "warn";
      var a = d.h("a", { class: "btn btn-outline btn-sm", href: m.u, target: "_blank", rel: "noopener" }, "Open");
      box.appendChild(d.h("div", { class: "mirror glass" }, [
        d.h("span", { class: "m-num" }, String(i + 1)),
        d.h("div", { class: "m-body" }, [
          d.h("h3", null, [m.t, d.h("span", { class: "chip " + tone }, m.s)]),
          d.h("p", null, m.d)
        ]),
        a
      ]));
    });
    view.appendChild(box);
    return view;
  }

  function settingsView() {
    var view = d.h("div", { class: "rel-view" });
    var card = d.h("div", { class: "set-card glass" }, [
      d.h("h2", { class: "set-title" }, "Appearance"),
      themeRow(card),
      accentRow(card),
      perfRow(card)
    ]);
    var tabCard = d.h("div", { class: "set-card glass", style: { marginTop: "14px" } }, [
      d.h("h2", { class: "set-title" }, "Browser tab"),
      tabRow(tabCard),
      dataRow(tabCard)
    ]);
    view.appendChild(card);
    view.appendChild(tabCard);
    return view;
  }

  function themeRow(card) {
    var row = d.h("div", { class: "set-row" }, [
      d.h("div", { class: "lbl-txt" }, [d.h("b", null, "Theme"), d.h("span", null, "Dark or Light \u2014 NULL inverted.")]),
      d.h("div", { class: "seg" }, [
        segBtn("dark", "Dark", function () { N.prefs.set("theme", "dark"); N.theme.setTheme("dark"); paintSegs(row); }),
        segBtn("light", "Light", function () { N.prefs.set("theme", "light"); N.theme.setTheme("light"); paintSegs(row); })
      ])
    ]);
    card.appendChild(row);
    return row;
  }
  function segBtn(val, label, fn) {
    return d.h("button", { type: "button", class: "on" === "" ? "" : "", onclick: fn }, label);
  }
  function paintSegs(row) {
    var cur = N.prefs.get("theme");
    row.querySelectorAll(".seg button").forEach(function (b, i) {
      b.classList.toggle("on", (i === 0 && cur === "dark") || (i === 1 && cur === "light"));
    });
  }
  function accentRow(card) {
    var row = d.h("div", { class: "set-row" }, [
      d.h("div", { class: "lbl-txt" }, [d.h("b", null, "Accent"), d.h("span", null, "Restrained \u2014 grayscale stays.")]),
      d.h("div", { class: "glow-row" })
    ]);
    var box = row.lastChild;
    N.theme.ACCENTS.forEach(function (a) {
      var b = d.h("button", {
        type: "button",
        class: "chip chip-btn" + (N.prefs.get("accent") === a.id ? " on" : ""),
        onclick: function () {
          N.prefs.set("accent", a.id);
          N.theme.setAccent(a.id);
          box.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); });
          b.classList.add("on");
        }
      }, a.name);
      box.appendChild(b);
    });
    card.appendChild(row);
    return row;
  }
  function glowRow(card) {
    var row = d.h("div", { class: "set-row" }, [
      d.h("div", { class: "lbl-txt" }, [d.h("b", null, "Glow border"), d.h("span", null, "Default is Off.")]),
      d.h("div", { class: "glow-row" })
    ]);
    var box = row.lastChild;
    N.theme.GLOWS.forEach(function (g) {
      var b = d.h("button", {
        type: "button",
        class: "chip chip-btn" + (N.prefs.get("glow") === g.id ? " on" : ""),
        onclick: function () {
          N.prefs.set("glow", g.id);
          N.theme.setGlow(g.id);
          box.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); });
          b.classList.add("on");
        }
      }, g.name);
      box.appendChild(b);
    });
    card.appendChild(row);
    return row;
  }
  function perfRow(card) {
    var row = d.h("div", { class: "set-row" }, [
      d.h("div", { class: "lbl-txt" }, [d.h("b", null, "Performance mode"), d.h("span", null, "Disables hover movement and shadows on slower devices.")]),
      (function () {
        var lab = d.h("label", { class: "switch" });
        var sw = d.h("input", { type: "checkbox", checked: !!N.prefs.get("perf") });
        sw.addEventListener("change", function () {
          N.prefs.set("perf", sw.checked);
          N.theme.setPerf(sw.checked);
        });
        lab.appendChild(sw);
        lab.appendChild(d.h("span", { class: "track" }));
        return lab;
      })()
    ]);
    card.appendChild(row);
    return row;
  }
  function tabRow(card) {
    var row = d.h("div", { class: "set-row" }, [
      d.h("div", { class: "lbl-txt", style: { flex: "1" } }, [
        d.h("b", null, "Tab preset"),
        d.h("span", null, "Overrides the browser tab title & icon.")
      ]),
      (function () {
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
        return sel;
      })()
    ]);
    card.appendChild(row);
    return row;
  }
  function dataRow(card) {
    var row = d.h("div", { class: "set-row" }, [
      d.h("div", { class: "lbl-txt" }, [
        d.h("b", null, "NULL data on this device"),
        d.h("span", null, N.recent.list().length + " recent \u00b7 " + N.favs.list().length + " favorites")
      ]),
      d.h("button", {
        type: "button",
        class: "btn btn-outline-danger btn-sm",
        onclick: function () {
          N.modal.confirm({
            title: "Wipe all NULL data?",
            icon: "trash",
            iconTone: "danger",
            body: "<p>Removes recent, favorites, prefs and flags for this browser. No undo.</p>",
            okLabel: "Wipe everything",
            okVariant: "danger",
            onOk: function () {
              ["null:prefs", "null:recent", "null:favs", "null:flags"].forEach(function (k) { N.store.del(k); });
              location.reload();
            }
          });
        }
      }, "Wipe data")
    ]);
    card.appendChild(row);
    return row;
  }

  function render() {
    if (viewHost) viewHost.remove();
    viewHost = d.h("div", { class: "rel-view" });
    var page = state.page;
    var c = cat();
    if (page === "home") viewHost = homeView();
    else if (page === "games") viewHost = libraryView(c.games, "game");
    else if (page === "apps") viewHost = libraryView(c.apps, "app");
    else if (page === "proxies") viewHost = libraryView(c.proxies, "proxy");
    else if (page === "schedule") viewHost = scheduleView();
    else if (page === "announcements") viewHost = announcementsView();
    else if (page === "backups") viewHost = backupsView();
    else if (page === "settings") viewHost = settingsView();
    else viewHost = homeView();
    root.appendChild(viewHost);
  }

  function boot() {
    root.appendChild(header());
    root.appendChild(nav());
    var h = (location.hash || "").replace("#", "");
    if ((NAV[TIER] || []).indexOf(h) >= 0) state.page = h;
    N.theme.applyAll();
    N.tab.apply();
    N.modal.armSgGames();
    render();
    var foot = d.h("div", { class: "foot" });
    foot.textContent = "NULL " + TIER + " \u00b7 single-file build \u00b7 " + new Date().getFullYear() + " \u00b7 favorites/recent/settings live in this browser";
    root.appendChild(foot);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
`;

function concatJs(catalog, contentJs, tier, withSchedule) {
  const parts = [];
  parts.push("window.RELEASE_TIER = " + JSON.stringify(tier) + ";");
  parts.push("window.NULL_CATALOG = " + JSON.stringify(catalog) + ";");
  if (contentJs) parts.push(contentJs);
  CORE_JS.forEach(function (f) {
    const code = read(f);
    if (code) parts.push(code);
  });
  if (withSchedule) parts.push(read("src/components/schedule.js") || "");
  parts.push(APP_JS);
  return parts.join("\n;\n");
}

function buildRelease(tier, catalog) {
  const relCatalog = buildReleaseCatalog(catalog);
  const regular = tier === "regular";
  const content = read("src/content/content.js");
  const withSchedule = tier !== "mini";
  const js = concatJs(relCatalog, content, tier, withSchedule);

  const html =
    "<!doctype html>\n" +
    '<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta name="color-scheme" content="dark light">\n' +
    "<title>" +
    tierName(tier) +
    "</title>\n" +
    '<link rel="icon" href="data:image/svg+xml;base64,' +
    Buffer.from(favicon).toString("base64") +
    '">\n' +
    "<style>\n" +
    css +
    RELEASE_CSS +
    "</style>\n" +
    '<script>\n(function () { try { var p = JSON.parse(localStorage.getItem("null:prefs") || "{}"); ' +
    'document.documentElement.dataset.theme = p.theme === "light" ? "light" : "dark"; ' +
    'if (p.perf) document.documentElement.dataset.perf = "1"; ' +
    'if (p.glow && p.glow !== "off") document.documentElement.dataset.glow = p.glow; ' +
    "} catch (e) {} })();\n</" +
    "script>\n</head>\n" +
    '<body>\n<div id="rel" class="rel-shell"></div>\n' +
    "<script>\n" +
    js +
    "\n</" +
    "script>\n</body>\n</html>\n";

  return html;
}

function tierName(tier) {
  return tier === "mini" ? "NULL Mini" : tier === "lite" ? "NULL Lite" : "NULL Regular";
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const catalog = discoverContent(ROOT);

const TIERS = [
  { id: "mini", label: "NULL Mini" },
  { id: "lite", label: "NULL Lite" },
  { id: "regular", label: "NULL Regular" },
];

TIERS.forEach(function (t) {
  const html = buildRelease(t.id, catalog);
  const file = path.join(OUT_DIR, "null-" + t.id + ".html");
  fs.writeFileSync(file, html);
  console.log(
    "wrote " + path.relative(ROOT, file) + "  (" + Math.round(html.length / 1024) + " KB)",
  );
});
