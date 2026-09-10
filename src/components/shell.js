/* NULL — shell.js
   Shared chrome: top navigation (icon-only links + mobile drawer), search
   trigger, theme toggle, footer, custom scrollbar attachment, back-to-top
   and the global keyboard bits (SGGAMES, panic key, "/" to search). */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  /* NULL mark = the Material "block" glyph: a circle with a slash. */
  function logoMark() {
    return d.h("span", { class: "brand-mark", "aria-hidden": "true" }, [
      d.icon("ban"),
    ]);
  }

  function brandEl() {
    return d.h("a", { class: "brand", href: "/", "aria-label": "NULL home" }, [
      logoMark(),
      d.h("span", { class: "brand-name" }, "NULL"),
    ]);
  }

  /* ---------- topbar ---------- */
  function topbar() {
    var bar = d.h("div", { class: "topbar" });

    bar.appendChild(brandEl());

    /* primary links — icon-only, no Home (the brand mark is home) */
    var links = d.h("nav", { class: "nav-links" });
    N.router.PRIMARY.forEach(function (l) {
      links.appendChild(
        d.h("a", {
          class: "nav-link" + (N.router.isActive(l.url) ? " on" : ""),
          href: l.url,
          title: l.t,
          "aria-label": l.t,
        }, [d.icon(l.icon)]),
      );
    });
    bar.appendChild(links);

    /* search trigger */
    var searchBtn = d.h("button", {
      type: "button",
      class: "searchbox field",
      "aria-label": "Search",
      title: "Search NULL  ( / )",
    }, [
      d.icon("search"),
      d.h("span", { class: "sb-txt", style: { color: "var(--text-2)", fontSize: "14px" } }, "Search NULL"),
    ]);
    searchBtn.addEventListener("click", function () {
      N.search.open();
    });
    bar.appendChild(searchBtn);

    /* right actions */
    var actions = d.h("div", { class: "top-actions" });
    var themeBtn = d.h("button", {
      type: "button",
      class: "btn-icon btn-outline",
      title: "Toggle theme",
      "aria-label": "Toggle theme",
    });
    themeBtn.appendChild(themeIcon());
    themeBtn.addEventListener("click", function () {
      var next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      N.theme.setTheme(next);
      N.prefs.set("theme", next);
      themeBtn.textContent = "";
      themeBtn.appendChild(themeIcon());
      d.toast(next === "light" ? "Light mode on" : "Dark mode on", { icon: next === "light" ? "sun" : "moon" });
    });
    actions.appendChild(themeBtn);

    var burger = d.h("button", {
      type: "button",
      class: "btn-icon btn-outline burger",
      title: "Menu",
      "aria-label": "Open menu",
    }, [d.icon("menu")]);
    burger.addEventListener("click", function () {
      drawerOv.classList.toggle("open");
      document.body.style.overflow = drawerOv.classList.contains("open") ? "hidden" : "";
    });
    actions.appendChild(burger);
    bar.appendChild(actions);

    /* mobile drawer */
    var drawer = d.h("div", { class: "drawer elev" });
    drawer.appendChild(
      d.h("div", { class: "drawer-head" }, [
        brandEl(),
        d.h("button", {
          type: "button",
          class: "btn-icon btn-ghost",
          "aria-label": "Close menu",
          onclick: function () {
            drawerOv.classList.remove("open");
            document.body.style.overflow = "";
          },
        }, [d.icon("x")]),
      ]),
    );
    N.router.GROUPS.forEach(function (g) {
      drawer.appendChild(d.h("div", { class: "mg" }, g.name));
      g.links.forEach(function (l) {
        drawer.appendChild(
          d.h("a", { class: "mi" + (N.router.isActive(l.url) ? " on" : ""), href: l.url }, [
            d.icon(l.icon),
            d.h("span", null, l.t),
          ]),
        );
      });
    });
    drawer.appendChild(
      d.h("div", { class: "drawer-foot" }, "Local-first \u2014 nothing leaves your browser."),
    );
    var drawerOv = d.h("div", { class: "drawer-ov" }, [drawer]);
    drawerOv.addEventListener("mousedown", function (e) {
      if (e.target === drawerOv) {
        drawerOv.classList.remove("open");
        document.body.style.overflow = "";
      }
    });

    bar.appendChild(drawerOv);
    return bar;
  }

  function themeIcon() {
    return d.icon(
      document.documentElement.dataset.theme === "light" ? "moon" : "sun",
    );
  }

  /* ---------- footer ---------- */
  function footer() {
    var inner = d.h("div", { class: "inner" });
    inner.appendChild(
      d.h("div", { class: "blurb" }, [
        brandEl(),
        d.h("p", null,
          "A massive site filled with ~2,300 games, and so much more. Developed by Mr Blob and NULL Labs to bring you the best alternative to SG Games ever! (Also bro our school had like 2 games sites 😭)"),
      ]),
    );
    N.router.FOOT.forEach(function (col) {
      var wrap = d.h("div", { class: "col" }, [d.h("h4", null, col.name)]);
      col.links.forEach(function (l) {
        wrap.appendChild(d.h("a", { href: l.url }, l.t));
      });
      inner.appendChild(wrap);
    });
var foot = d.h("footer", { class: "site-foot" }, [inner]); 
foot.appendChild( 
  d.h("div", { class: "bottom" }, [ 
    "\u00a9 " + new Date().getFullYear() + " NULL Labs \u00b7 Developed by Mr Blob", 
  ]), 
); 
return foot; 
}


  /* ---------- back to top ---------- */
  function backTop() {
    var btn = d.h("button", {
      type: "button",
      class: "btn-icon btn-outline back-top elev",
      "aria-label": "Back to top",
    }, [d.icon("up")]);
    var scroller = document.body.classList.contains("lb") ? d.qs("#scrollview") : window;
    var shown = false;
    function onScroll() {
      var y = scroller === window
        ? window.scrollY || document.documentElement.scrollTop
        : scroller.scrollTop;
      if (y > 700 && !shown) {
        shown = true;
        btn.classList.add("show");
      } else if (y <= 700 && shown) {
        shown = false;
        btn.classList.remove("show");
      }
    }
    btn.addEventListener("click", function () {
      if (scroller === window) window.scrollTo({ top: 0, behavior: "smooth" });
      else scroller.scrollTo({ top: 0, behavior: "smooth" });
    });
    (scroller === window ? window : scroller).addEventListener("scroll", onScroll, { passive: true });
    document.body.appendChild(btn);
  }

  /* ---------- keyboard ---------- */
  function shortcuts() {
    document.addEventListener("keydown", function (e) {
      var t = e.target;
      var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        N.search.open();
        return;
      }
      if (typing) return;
      panicCheck(e);
    });
  }

  /* ---------- panic key ---------- */
  var panicLast = 0;
  function panicCheck(e) {
    var p = N.prefs;
    var key = p.get("panicKey") || "`";
    if (e.key !== key) return;
    e.preventDefault();
    var now = Date.now();
    if (p.get("panicMode") === "double") {
      if (now - panicLast <= 400) {
        panicLast = 0;
        run();
      } else {
        panicLast = now;
      }
    } else {
      run();
    }
    function run() {
      var url = p.get("panicUrl") || "https://classroom.google.com";
      try {
        window.location.replace(url);
      } catch (err) {
        window.location.href = url;
      }
    }
  }

  /* ---------- cloaking: open the whole site in about:blank / blob: ---------- */
  function cloakBlocked() {
    N.modal.open({
      title: "Popup blocked",
      icon: "warn",
      iconTone: "danger",
      body:
        "<p>The browser blocked the popup, so the cloaked window <b>won&rsquo;t open</b>.</p>" +
        "<p>Allow popups for NULL (usually via the icon in the address bar) and try again.</p>",
      actions: [{ label: "Okay", variant: "primary" }],
    });
  }

  /* A tiny shell document that frames the real site in an iframe. Used for
     both modes: about:blank gets this written into the blank window, blob:
     gets it served from a blob: URL. The tab title/favicon come from the
     active tab preset either way. */
  function cloakShell() {
    var p = N.tab.current();
    return (
      "<!doctype html><html><head><meta charset='utf-8'><title>" +
      N.tab.titleFor(p) +
      "</title><link rel='icon' href='" +
      (p.icon || "/public/favicon.svg") +
      "'></head>" +
      "<body style='margin:0'><iframe src='" +
      location.origin +
      "/' style='width:100vw;height:100vh;border:0'></iframe></body></html>"
    );
  }

  /* Popup blockers can refuse the open but still hand back a WindowProxy
     (or kill the tab a moment later). In every failure case we make sure
     nothing is left open — close the window, show the warning only. */
  function cloakOpen(url, mode, shell) {
    var w = null;
    try {
      w = window.open(url, "_blank");
    } catch (err) {
      w = null;
    }
    if (!w) {
      cloakBlocked();
      return;
    }
    if (mode === "blank") {
      /* about:blank windows share the opener's origin — write the shell in */
      try {
        w.document.open();
        w.document.write(shell);
        w.document.close();
      } catch (err) {
        try {
          w.close();
        } catch (e2) {}
        cloakBlocked();
        return;
      }
    }
    /* some blockers cancel the tab right after it opens — if the browser
       closed it, don't leave a stray tab and don't pretend it worked */
    setTimeout(function () {
      if (w.closed) cloakBlocked();
    }, 800);
    d.toast(mode === "blank" ? "Opened NULL in about:blank" : "Opened NULL in blob:", {
      icon: "ban",
    });
  }

  N.cloak = {
    site: function (mode) {
      var shell = cloakShell();
      var url = mode === "blob" ? URL.createObjectURL(new Blob([shell], { type: "text/html" })) : "about:blank";
      cloakOpen(url, mode, shell);
    },
  };

  /* ---------- confetti (grayscale) ----------
     Fired when a class period ends. Toggleable via prefs.confetti.
     Also exposed as N.fx.confetti for the dev console. */
  var confettiBusy = false;
  function confetti() {
    if (confettiBusy) return;
    confettiBusy = true;
    setTimeout(function () { confettiBusy = false; }, 2600);
    var ov = d.h("div", { class: "cf-ov", "aria-hidden": "true" });
    var cols = ["#f5f5f6", "#c9c9cf", "#a1a1aa", "#71717a", "#52525b"];
    for (var i = 0; i < 80; i++) {
      var p = d.h("span", { class: "cf-p" + (Math.random() < 0.5 ? " s" : "") });
      p.style.left = Math.random() * 100 + "%";
      p.style.background = cols[i % cols.length];
      p.style.setProperty("--cf-drift", (Math.random() * 220 - 110).toFixed(0) + "px");
      p.style.setProperty("--cf-rot", (Math.random() * 720 - 360).toFixed(0) + "deg");
      p.style.animationDuration = (2 + Math.random() * 1.4).toFixed(2) + "s";
      p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + "s";
      ov.appendChild(p);
    }
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("on"); });
    setTimeout(function () {
      ov.classList.remove("on");
      setTimeout(function () {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
      }, 400);
    }, 3400);
  }

  /* watch the schedule every 30s; the moment a block boundary is crossed,
     celebrate (once per boundary). */
  var schedWatcher = null;
  var lastKey = "";
  function watchPeriodEnd() {
    if (!N.schedule || schedWatcher) return;
    function check() {
      if (document.hidden) return;
      if (N.prefs.get("confetti") === false) return;
      var info = N.schedule.todayInfo();
      if (!info.type) return;
      var blocks = N.schedule.blocksFor(info.type);
      var lv = N.schedule.live(blocks);
      var key = lv.block ? lv.i + (lv.passing ? "p" : "") : "end";
      if (lastKey && lastKey !== key && key !== "end") confetti();
      lastKey = key;
    }
    check();
    schedWatcher = setInterval(check, 30000);
  }

  /* ============================================================
     screensaver — after two idle minutes a dim glass overlay fades
     in: drifting grayscale game art, a live clock and a wake hint.
     Any pointer or key wakes it. Skipped on the player / 404 and
     whenever an overlay is already open.
     ============================================================ */
  var SS_DELAY = 120000; // 2 minutes idle
  var ssTimer = null;
  var ssEl = null;
  var ssClockInt = null;

  function ssGated() {
    return (
      document.body.classList.contains("player-page") ||
      document.body.classList.contains("page-404") ||
      document.body.classList.contains("no-chrome") ||
      !!d.qs(".modal-ov.open") ||
      !!d.qs(".search-ov.open") ||
      document.hidden
    );
  }

  function ssHide() {
    if (!ssEl) return;
    var el = ssEl;
    ssEl = null;
    clearInterval(ssClockInt);
    el.classList.remove("on");
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 500);
    ssArm();
  }

  function ssClock() {
    if (!ssEl) return;
    var el = d.qs(".ss-clock", ssEl);
    var now = new Date();
    var h = now.getHours() % 12 || 12;
    var m = now.getMinutes();
    var s = now.getSeconds();
    var ap = now.getHours() >= 12 ? "PM" : "AM";
    if (el) el.textContent = h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s + " " + ap;
  }

  function ssShow() {
    if (ssEl || ssGated()) {
      ssArm();
      return;
    }
    var games = N.catalog.games().filter(function (g) {
      return g.thumb;
    });
    var ov = d.h("div", { class: "ss-ov", "aria-hidden": "true" });
    ov.appendChild(d.h("div", { class: "ss-vign" }));
    var art = d.h("div", { class: "ss-art" });
    var count = Math.min(18, Math.max(6, games.length));
    for (var i = 0; i < count; i++) {
      var g = games[Math.floor(Math.random() * games.length)];
      var img = d.h("img", { src: g.thumb, alt: "", draggable: "false" });
      img.addEventListener("error", function (e) {
        if (e.target && e.target.parentNode) e.target.parentNode.removeChild(e.target);
      });
      var slow = i % 2 === 1;
      var tile = d.h("div", { class: "ss-tile" + (slow ? " slow" : "") }, [img]);
      tile.style.left = (4 + Math.random() * 82) + "%";
      tile.style.top = (6 + Math.random() * 74) + "%";
      tile.style.setProperty("--ss-drift", (10 + Math.random() * 26).toFixed(1) + "px");
      tile.style.animationDuration = (slow ? 26 + Math.random() * 14 : 15 + Math.random() * 18).toFixed(1) + "s";
      tile.style.animationDelay = (-Math.random() * 34).toFixed(1) + "s";
      art.appendChild(tile);
    }
    ov.appendChild(art);
    ov.appendChild(d.h("div", { class: "ss-brand" }, [d.icon("ban"), "NULL"]));
    ov.appendChild(d.h("div", { class: "ss-clock" }, "\u2014:--"));
    ov.appendChild(
      d.h("div", { class: "ss-date" },
        new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })),
    );
    ov.appendChild(d.h("div", { class: "ss-hint" }, "move mouse or press any key"));
    document.body.appendChild(ov);
    ssEl = ov;
    requestAnimationFrame(function () {
      ov.classList.add("on");
    });
    ssClock();
    ssClockInt = setInterval(ssClock, 1000);
  }

  function ssArm() {
    clearTimeout(ssTimer);
    ssTimer = setTimeout(ssShow, SS_DELAY);
  }

  function ssWake() {
    ssHide();
    ssArm();
  }

  /* immediate screensaver (dev console button) — bypasses the idle wait */
  function ssNow() {
    ssHide();
    ssShow();
  }

  function initSs() {
    if (ssGated()) return;
    ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"].forEach(function (ev) {
      document.addEventListener(ev, ssWake, { passive: true });
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) ssHide();
      else ssArm();
    });
    ssArm();
  }

  /* ---------- marathon mode: auto-switch games on a timer ----------
     The ticker lives here so it keeps running on any NULL page. The games
     page owns the controls; prefs hold the interval (marathonMin) and the
     next-fire time (marathonAt). */
  var marathonTimer = null;
  function marathonTick() {
    if (document.hidden) return;
    if (N.prefs.get("marathon") === false) return; // feature disabled in settings
    var min = parseInt(N.prefs.get("marathonMin"), 10) || 0;
    if (!min) {
      if (marathonTimer) {
        clearInterval(marathonTimer);
        marathonTimer = null;
      }
      return;
    }
    var at = parseInt(N.prefs.get("marathonAt"), 10) || 0;
    if (!at || Date.now() < at) return;
    /* due — launch a random game directly, no warning modal mid-marathon */
    N.prefs.set("marathonAt", Date.now() + min * 60000);
    var g = N.catalog.games();
    if (!g.length) return;
    var pick = g[Math.floor(Math.random() * g.length)];
    N.recent.add("game", pick.id);
    location.href = N.launch.playerUrl("game", pick.id);
  }
  function initMarathon() {
    if (marathonTimer) return;
    if (parseInt(N.prefs.get("marathonMin"), 10) > 0) marathonTick();
    marathonTimer = setInterval(marathonTick, 1000);
  }

  /* ---------- weekly wrap-up ----------
     Once a week (Monday-keyed), the first page load after the week rolls
     over shows a summary of the previous week's plays. Fires on every page
     (shell runs everywhere), ~1.2 s after load so it never fights the
     first-run welcome chain on the home page. */
  function wrapupModal(weekKey, s) {
    var mon = new Date(weekKey + "T00:00:00");
    var end = new Date(mon.getTime());
    end.setDate(end.getDate() + 6);
    var range =
      mon.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " \u2013 " +
      end.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    var html =
      "<p style='margin:0 0 4px;color:#a3a3a3;font-size:14px;'>Your NULL week \u2014 <b style='color:var(--text)'>" +
      range +
      "</b>. Everything below is local to your browser.</p>";
    html +=
      "<div class='wu-stats'>" +
      "<div class='wu-stat'><b>" + s.total + "</b><span>plays</span></div>" +
      "<div class='wu-stat'><b>" + s.distinct + "</b><span>games &amp; apps</span></div>" +
      "<div class='wu-stat'><b>" + (s.top.length ? s.top[0].n : 0) + "</b><span>top item</span></div>" +
      "</div>";
    if (s.top.length) {
      html += "<div class='wu-top'><b>Most played</b>";
      s.top.forEach(function (t, i) {
        var e = N.catalog.find(t.k, t.id);
        var name = e ? e.name : t.id;
        html +=
          "<div class='wu-item'><span class='wu-rank'>" +
          (i + 1) +
          "</span>" +
          d.escHtml(name) +
          "<span class='wu-count'>" + t.n + "\u00d7</span></div>";
      });
      html += "</div>";
    }
    html +=
      "<p style='margin:14px 0 0;font-size:12.5px;color:#737373;'>New week \u2014 the log restarts today. See you next Monday.</p>";

    N.modal.open({
      title: "Your week in NULL",
      icon: "ann",
      body: html,
      actions: [{ label: "Got it", variant: "primary" }],
    });
  }

  function wrapupCheck() {
    if (!N.week || !N.modal) return;
    var prev = N.week.rollover();
    if (!prev) return;
    var key = "wrapup:" + prev.week;
    if (N.flags.get(key)) return;
    N.flags.set(key);
    wrapupModal(prev.week, N.week.summary(prev.plays));
  }

  /* dev-console / debug entry: show the current week's wrap-up on demand */
  N.wrapup = {
    check: wrapupCheck,
    show: function () {
      if (!N.week || !N.modal) return false;
      var s = N.week.summary();
      if (!s.total) return false;
      wrapupModal(N.week.key(), s);
      return true;
    },
  };

  function init() {
    /* resolve [data-icon] placeholders left in static HTML */
    d.qsa("[data-icon]").forEach(function (el) {
      var ic = d.icon(el.dataset.icon);
      if (el.tagName === "SPAN") {
        el.replaceWith(ic);
      } else {
        el.textContent = "";
        el.appendChild(ic);
      }
    });

    var raw = document.body.classList.contains("no-chrome");
    if (!raw) {
      var navMount = d.qs('[data-mount="nav"]');
      var footMount = d.qs('[data-mount="foot"]');
      if (navMount) navMount.appendChild(topbar());
      if (footMount) footMount.appendChild(footer());
    }

    N.modal.armSgGames();
    shortcuts();
    N.tab.apply();
    N.tab.smartStart();
    initMarathon();
    initSs();
    watchPeriodEnd();

    /* weekly wrap-up — slightly delayed so it stacks above (never under)
       the first-run welcome chain on the home page */
    setTimeout(wrapupCheck, 1200);

    /* custom scrollbar on library pages */
    if (document.body.classList.contains("lb")) {
      var sv = d.qs("#scrollview");
      if (sv) N.scroll.attach(sv);
    }
    if (!raw) backTop();
  }

  N.shell = { init: init, screensaverNow: ssNow };
  N.fx = { confetti: confetti };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
