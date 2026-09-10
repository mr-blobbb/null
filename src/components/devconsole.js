/* NULL — devconsole.js
   Hidden developer console. Type "nldev" anywhere (case-insensitive, only
   letters/digits count) to open a full-screen glass terminal overlay:
   a header with live stats, action sections with buttons wired to real site
   behavior (confetti, toasts, modals, random launches, tab presets, data
   maintenance) and a terminal-style log. No page-specific code needed —
   loaded on every NULL page. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  /* ---------- nldev detector (same pattern as the SGGAMES egg) ---------- */
  var seq = "";
  function armCode() {
    document.addEventListener("keydown", function (e) {
      if (e.repeat) return;
      if (open) return; // don't re-trigger while the console is up
      var k = e.key;
      if (k && k.length === 1 && /[a-zA-Z0-9]/.test(k)) {
        seq = (seq + k.toLowerCase()).slice(-8);
        if (seq === "nldev") {
          seq = "";
          show();
        }
      }
    });
  }

  /* ---------- state ---------- */
  var open = false;
  var ov = null;
  var logBox = null;
  var statsBox = null;
  var lastCat = "";

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

  /* ---------- helpers over real site systems ---------- */
  function statsHtml() {
    var g = (N.catalog && N.catalog.games ? N.catalog.games() : []).length;
    var a = (N.catalog && N.catalog.apps ? N.catalog.apps() : []).length;
    var p = (N.catalog && N.catalog.proxies ? N.catalog.proxies() : []).length;
    var rec = N.recent ? N.recent.list().length : 0;
    var fav = N.favs ? N.favs.list().length : 0;
    return (
      g + " games &middot; " + a + " apps &middot; " + p + " proxies &middot; " +
      rec + " recent &middot; " + fav + " favorites"
    );
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

  function applyTab(id) {
    var p = N.tab.get(id);
    if (!p) return err("unknown preset: " + id);
    N.prefs.set("tab", id);
    N.tab.apply();
    ok("tab preset \u2192 " + p.name + (N.tab.titleFor ? " (\u201c" + N.tab.titleFor(p) + "\u201d)" : ""));
  }

  /* ---------- action sections ---------- */
  var SECTIONS = [
    {
      name: "effects",
      icon: "zap",
      rows: [
        [
          { label: "Confetti burst", icon: "star", run: function () { N.fx.confetti(); ok("confetti fired"); } },
          { label: "Triple confetti", icon: "star", run: function () {
              N.fx.confetti(); setTimeout(function () { N.fx.confetti(); }, 350);
              setTimeout(function () { N.fx.confetti(); }, 700);
              ok("3 bursts queued");
            } },
          { label: "Toast (info)", icon: "info", run: function () { d.toast("Dev toast \u2014 all systems nominal", { icon: "info" }); ok("toast shown"); } },
          { label: "Toast (error)", icon: "warn", run: function () { d.toast("Dev error toast", { icon: "warn", type: "err", hold: 4000 }); ok("error toast shown"); } },
        ],
        [
          { label: "Glow: Blue+Purple", icon: "zap", run: function () { setGlow("bp"); ok("glow \u2192 Blue + Purple"); } },
          { label: "Glow: Rainbow", icon: "zap", run: function () { setGlow("rainbow"); ok("glow \u2192 Rainbow"); } },
          { label: "Glow: Off", icon: "ban", run: function () { setGlow("off"); ok("glow \u2192 off"); } },
          { label: "Comet toggle", icon: "zap", run: function () {
              var on = !N.prefs.get("glowComet");
              N.theme.setComet(on);
              N.prefs.set("glowComet", on);
              ok("comet " + (on ? "on" : "off"));
            } },
        ],
        [
          { label: "Accent: Ice", icon: "pen", run: function () { setAccent("ice"); ok("accent \u2192 Ice"); } },
          { label: "Accent: Violet", icon: "pen", run: function () { setAccent("violet"); ok("accent \u2192 Violet"); } },
          { label: "Accent: Ember", icon: "pen", run: function () { setAccent("ember"); ok("accent \u2192 Ember"); } },
          { label: "Accent: Off", icon: "ban", run: function () { setAccent("off"); ok("accent \u2192 off"); } },
        ],
      ],
    },
    {
      name: "modals",
      icon: "info",
      rows: [
        [
          { label: "Welcome modal", icon: "info", run: function () {
              N.modal.open({
                title: "Welcome to NULL",
                icon: "ban",
                body: "<p>The ultimate browser-based hub \u2014 unblocked, fast, and built for you.</p>",
                actions: [{ label: "Continue", variant: "primary" }],
              });
              ok("welcome modal shown");
            } },
          { label: "Popup note", icon: "ext", run: function () {
              N.modal.open({
                title: "Popups & redirects",
                icon: "ext",
                body: "<p>Some NULL features ask the browser to allow popups and redirects.</p>",
                actions: [{ label: "Please accept", variant: "primary" }],
              });
              ok("popup note shown");
            } },
          { label: "Confirm dialog", icon: "check", run: function () {
              N.modal.confirm({ title: "Dev confirm", body: "<p>This is what a NULL confirm looks like.</p>", onOk: function () { ok("confirm accepted"); } });
              ok("confirm dialog shown");
            } },
          { label: "SGGAMES egg", icon: "zap", run: function () {
              if (N.modal.showSgGames) N.modal.showSgGames();
              else err("egg not exported \u2014 type sggames");
            } },
        ],
        [
          { label: "Game warning", icon: "warn", run: function () {
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
            } },
          { label: "Danger modal", icon: "trash", run: function () {
              N.modal.open({
                title: "Danger sample",
                icon: "warn",
                iconTone: "danger",
                body: "<p>This is how a danger modal renders. Nothing was harmed.</p>",
                actions: [{ label: "Phew", variant: "danger" }],
              });
              ok("danger modal shown");
            } },
          { label: "Stack 3 modals", icon: "list", run: function () {
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
            } },
        ],
      ],
    },
    {
      name: "launchers",
      icon: "play",
      rows: [
        [
          { label: "Random game", icon: "play", run: function () {
              var e = anyItem("game");
              ok("launching \u201c" + (e ? e.name : "?") + "\u201d");
              setTimeout(function () { launchItem("game", e); }, 150);
            } },
          { label: "Random app", icon: "grid", run: function () {
              var e = anyItem("app");
              ok("launching \u201c" + (e ? e.name : "?") + "\u201d");
              setTimeout(function () { launchItem("app", e); }, 150);
            } },
          { label: "Random proxy", icon: "proxy", run: function () {
              var e = anyItem("proxy");
              ok("opening \u201c" + (e ? e.name : "?") + "\u201d (confirm will show)");
              setTimeout(function () { launchItem("proxy", e); }, 150);
            } },
          { label: "Open player (blank)", icon: "file", run: function () {
              location.href = N.launch.playerUrl("game", "void");
            } },
        ],
        [
          { label: "Armed marathon +5m", icon: "clock", run: function () {
              if (N.prefs.get("marathon") === false) return err("marathon disabled in settings");
              N.prefs.set("marathonMin", 5);
              N.prefs.set("marathonAt", Date.now() + 5 * 60000);
              ok("marathon armed: next switch in 5:00");
            } },
          { label: "Marathon due now", icon: "zap", run: function () {
              if (N.prefs.get("marathon") === false) return err("marathon disabled in settings");
              N.prefs.set("marathonMin", 5);
              N.prefs.set("marathonAt", 1);
              ok("marathon fired \u2014 ticker will switch in \u2264 1s");
            } },
          { label: "Disarm marathon", icon: "ban", run: function () {
              N.prefs.set("marathonMin", 0);
              N.prefs.set("marathonAt", 0);
              ok("marathon disarmed");
            } },
        ],
      ],
    },
    {
      name: "tab presets",
      icon: "tab",
      rows: [
        [
          { label: "Google Slides", icon: "tab", run: function () { applyTab("slides"); } },
          { label: "Google Docs", icon: "tab", run: function () { applyTab("docs"); } },
          { label: "Google Classroom", icon: "tab", run: function () { applyTab("gclass"); } },
          { label: "Kahoot", icon: "tab", run: function () { applyTab("kahoot"); } },
        ],
        [
          { label: "Calculator", icon: "tab", run: function () { applyTab("search"); } },
          { label: "NULL", icon: "tab", run: function () { applyTab("null"); } },
          { label: "Custom tab", icon: "pen", run: function () { applyTab("custom"); } },
        ],
      ],
    },
    {
      name: "screensaver & view",
      icon: "sun",
      rows: [
        [
          { label: "Trigger screensaver", icon: "clock", run: function () {
              var evt = new Event("dc-ss");
              document.dispatchEvent(evt);
              ok("screensaver requested");
            } },
          { label: "Theme: Dark", icon: "moon", run: function () {
              N.theme.setTheme("dark"); N.prefs.set("theme", "dark");
              ok("theme \u2192 dark");
            } },
          { label: "Theme: Light", icon: "sun", run: function () {
              N.theme.setTheme("light"); N.prefs.set("theme", "light");
              ok("theme \u2192 light");
            } },
          { label: "Back to top", icon: "up", run: function () {
              var sv = d.qs("#scrollview");
              if (sv) sv.scrollTo({ top: 0, behavior: "smooth" });
              else window.scrollTo({ top: 0, behavior: "smooth" });
              ok("scrolled to top");
            } },
        ],
      ],
    },
    {
      name: "data & maintenance",
      icon: "trash",
      rows: [
        [
          { label: "Seed recents (5)", icon: "play", run: function () {
              var games = N.catalog.games();
              if (!games.length) return err("library empty");
              for (var i = 0; i < 5; i++) {
                var g = games[Math.floor(Math.random() * games.length)];
                N.recent.add("game", g.id);
                N.plays.tap("game", g.id);
              }
              ok("5 recents + plays seeded");
              refreshStats();
            } },
          { label: "Clear recents", icon: "trash", run: function () {
              N.recent.clear(); ok("recents cleared"); refreshStats();
            } },
          { label: "Clear favorites", icon: "trash", run: function () {
              N.favs.clear(); ok("favorites cleared"); refreshStats();
            } },
          { label: "Reset play counts", icon: "trash", run: function () {
              N.store.del("null:plays"); ok("play counts wiped"); refreshStats();
            } },
        ],
        [
          { label: "Reset first-run flags", icon: "info", run: function () {
              N.flags.clear(); ok("flags reset \u2014 welcome + popup modals return next visit");
            } },
          { label: "Clear search history", icon: "trash", run: function () {
              N.store.del("null:searches");
              ok("search history wiped");
            } },
          { label: "Factory reset", icon: "warn", run: function () {
              N.modal.confirm({
                title: "Factory reset?",
                icon: "warn",
                iconTone: "danger",
                body: "<p>Wipes every NULL preference, flag, recent, favorite, play count and history from this browser. This cannot be undone.</p>",
                okLabel: "Wipe everything",
                okVariant: "danger",
                onOk: function () {
                  ["null:prefs", "null:flags", "null:recent", "null:favs", "null:plays", "null:searches", "null:sched", "null:lunch"].forEach(N.store.del);
                  ok("factory reset done \u2014 reloading");
                  setTimeout(function () { location.reload(); }, 600);
                },
              });
            } },
          { label: "Reload page", icon: "refresh", run: function () { location.reload(); } },
        ],
      ],
    },
  ];

  /* ---------- console shell ---------- */
  function headEl() {
    var head = d.h("div", { class: "dc-head" });
    head.appendChild(
      d.h("div", { class: "dc-brand" }, [
        d.icon("ban"),
        d.h("b", null, "NULL DEVCONSOLE"),
        d.h("span", { class: "dc-ver" }, "v1.0 \u00b7 " + statsHtml()),
      ]),
    );
    head.appendChild(
      d.h("div", { class: "dc-actions" }, [
        d.h("button", {
          type: "button", class: "btn btn-ghost btn-sm dc-btn",
          title: "Copy console log", "aria-label": "Copy console log",
          onclick: function () {
            var txt = logBox ? Array.prototype.map.call(logBox.children, function (l) { return l.textContent; }).join("\n") : "";
            try {
              navigator.clipboard.writeText(txt);
              d.toast("Log copied", { icon: "copy" });
            } catch (e) { err("clipboard unavailable"); }
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
    SECTIONS.forEach(function (s) {
      var card = d.h("section", { class: "dc-card glass" });
      card.appendChild(d.h("h3", { class: "dc-card-h" }, [d.icon(s.icon), s.name]));
      s.rows.forEach(function (row) {
        var r = d.h("div", { class: "dc-row" });
        row.forEach(function (b) {
          r.appendChild(
            d.h("button", {
              type: "button", class: "dc-b",
              onclick: function () { b.run(); },
            }, [d.icon(b.icon), b.label]),
          );
        });
        card.appendChild(r);
      });
      wrap.appendChild(card);
    });
    return wrap;
  }

  function show() {
    if (open) return;
    open = true;
    lastCat = document.title;
    document.title = "\u2588 NULL DEVCONSOLE";

    ov = d.h("div", { class: "dc-ov", role: "dialog", "aria-label": "NULL dev console" });
    var box = d.h("div", { class: "dc-box glass-2 elev" });
    box.appendChild(headEl());
    box.appendChild(sectionsEl());

    logBox = d.h("div", { class: "dc-log", "aria-live": "polite" });
    box.appendChild(logBox);
    ov.appendChild(box);
    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";

    log("devconsole attached \u2014 type nldev to reopen");
    log("session: " + statsHtml());

    requestAnimationFrame(function () { ov.classList.add("on"); });
  }

  function hide() {
    if (!open || !ov) return;
    open = false;
    if (document.title.indexOf("\u2588") === 0) document.title = lastCat || "NULL";
    ov.classList.remove("on");
    document.body.style.overflow = "";
    var el = ov;
    ov = null;
    logBox = null;
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 220);
  }

  function refreshStats() {
    var v = d.qs(".dc-ver", ov);
    if (v) v.innerHTML = "v1.0 \u00b7 " + statsHtml();
  }

  /* wire the screensaver button into shell.js's screensaver via a custom event */
  document.addEventListener("dc-ss", function () {
    if (N.shell && N.shell.screensaverNow) N.shell.screensaverNow();
  });

  document.addEventListener("keydown", function (e) {
    if (open && e.key === "Escape") {
      e.preventDefault();
      hide();
    }
  });

  armCode();
  N.dev = { show: show, hide: hide, isOpen: function () { return open; } };
})();
