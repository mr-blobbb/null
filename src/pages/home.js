/* NULL — home.js
   Dashboard logic: the featured rail (first 10 library items), the daily
   crate strip, recently played games with random/clear, a live "today"
   schedule card, announcements, the first-launch welcome modal and the
   popup/redirect explanation. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;
  var S = N.schedule;
  var C = window.NULL_CONTENT || {};

  var inited = false;
  var schedTimer = null;

  /* ---------- search ---------- */
  function bindSearch() {
    var form = d.qs("#homeSearch");
    var input = d.qs("#searchInput");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      N.search.open(input.value.trim());
    });
    /* the whole field feels clickable */
    form.addEventListener("click", function (e) {
      if (e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON") input.focus();
    });
  }

  /* ---------- featured rail ---------- */
  function renderFeatured() {
    var track = d.qs("#featTrack");
    var hint = d.qs("#featHint");
    if (!track) return;
    track.textContent = "";
    var games = N.catalog.games();
    var apps = N.catalog.apps();
    var list = games.slice(0, 10).map(function (g) {
      return { e: g, k: "game" };
    });
    if (list.length < 10) {
      apps.slice(0, 10 - list.length).forEach(function (a) {
        list.push({ e: a, k: "app" });
      });
    }
    if (!list.length) {
      track.appendChild(
        d.h("div", { class: "feat-empty" }, "The library is empty \u2014 add folders to games/ and rebuild the catalog."),
      );
      if (hint) hint.textContent = "";
      return;
    }
    if (hint) {
      var extra = list.length > games.length ? " \u00b7 games first, then apps" : "";
      hint.textContent = games.length + " game" + (games.length === 1 ? "" : "s") + extra;
    }
    list.forEach(function (it) {
      track.appendChild(N.cards.card(it.e, it.k));
    });
  }

  /* ---------- game of the day ----------
     Deterministic pick from the date: the same game all day, a fresh
     one tomorrow, no storage needed. */
  function dayKey() {
    var n = new Date();
    var m = n.getMonth() + 1;
    var d = n.getDate();
    return n.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
  }
  function dayHash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function pickGotd() {
    var games = N.catalog.games();
    if (!games.length) return null;
    return games[dayHash(dayKey()) % games.length];
  }
  function renderGotd() {
    var host = d.qs("#gotd");
    if (!host) return;
    var g = pickGotd();
    if (!g) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    host.textContent = "";

    var thumb = d.h("div", { class: "gotd-media" });
    if (g.thumb) {
      var img = d.h("img", { src: g.thumb, alt: "", loading: "lazy", decoding: "async" });
      d.bindImgFallback(img, "game");
      thumb.appendChild(img);
    } else {
      thumb.appendChild(d.icon("game"));
    }

    var info = d.h("div", { class: "gotd-info" }, [
      d.h("div", { class: "gotd-head" }, [
        d.h("h2", null, [d.icon("calendar"), "Game of the day"]),
        d.h("span", { class: "hint" },
          new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })),
      ]),
      d.h("h3", { class: "gotd-name", title: g.name }, g.name),
      d.h("div", { class: "chips-row" }, N.cards.chipsFor(g)),
      d.h("p", { class: "gotd-desc" }, g.desc || "A game in the NULL library \u2014 fresh pick every day."),
      d.h("div", { class: "gotd-actions" }, [
        d.h("button", { type: "button", class: "btn btn-primary", onclick: function () {
            N.launch.game(g);
          } }, [d.icon("play"), "Play"]),
      ]),
    ]);
    host.appendChild(thumb);
    host.appendChild(info);
  }

  /* ---------- daily tip ----------
     One short tip a day about a real NULL feature, picked deterministically
     from the date (same tip all day, fresh tomorrow — no storage needed). */
  var TIPS = [
    "Type <b>nldev</b> anywhere to open the developer console — confetti, modals, seasons and more.",
    "The <b>panic key</b> (backtick by default) jumps you to a safe page instantly. Set it in Settings.",
    "Tab cloaking is free: pick a Google preset in Settings and your tab title + icon change instantly.",
    "Play 30 minutes and you earn <b>10 XP</b> — every 100 XP banks 30 coins for the Shop.",
    "The <b>screensaver</b> kicks in after two idle minutes — move the mouse or press any key to wake it.",
    "Star a game to favorite it; favorites show up in the drawer and are searchable.",
    "Seasonal mode is off by default — flip it on in Settings for falling leaves, snow or petals.",
    "Smart tab cloak rotates your tab preset on a timer while you play — pauses when the tab is hidden.",
    "Game saves that live in localStorage can be downloaded and even shared with a friend from the player bar.",
    "Search understands labels: try \u201carcade\u201d, \u201cmemory\u201d or \u201ccalculator\u201d to filter results.",
    "Marathon mode auto-switches games on a timer — the games page owns the controls.",
    "Open the <b>daily crate</b> for free coins — the streak bonus grows every day you come back.",
    "Daily quests and achievements pay coins in the <b>Shop</b> — a dot on its icon means something is waiting.",
    "Press <b>/</b> anywhere to jump into search without touching the mouse.",
  ];
  function renderTip() {
    var host = d.qs("#tipCard");
    if (!host) return;
    var tip = TIPS[dayHash(dayKey()) % TIPS.length];
    host.textContent = "";
    host.appendChild(
      d.h("span", { class: "tip-ic" }, [d.icon("tip")]),
    );
    var body = d.h("div", { class: "tip-body" }, [
      d.h("span", { class: "tip-kicker" }, "Tip of the day"),
      d.h("p", { html: tip }),
    ]);
    host.appendChild(body);
    var sec = d.qs("#tipSec");
    if (sec) sec.hidden = false;
  }

  /* ---------- recently played ----------
     Games only: apps and proxies opened from the library are not "played"
     and would otherwise crowd out the games you actually want back. */
  function renderRecents() {
    var box = d.qs("#recList");
    if (!box) return;
    box.textContent = "";
    var items = N.recent
      .list()
      .filter(function (r) {
        return r.k === "game";
      })
      .map(function (r) {
        var e = N.catalog.find("game", r.id);
        return e ? { e: e, k: "game", at: r.at } : null;
      })
      .filter(Boolean)
      .slice(0, 8);
    if (!items.length) {
      box.appendChild(
        N.cards.empty("Nothing played yet", "Open a game and it will show up here."),
      );
      return;
    }
    var listEl = d.h("div", { class: "rec-list" });
    items.forEach(function (it) {
      var row = N.cards.row(it.e, it.k, {
        sub: (N.KIND_LABEL[it.k] || "") + " \u00b7 " + N.dt.ago(it.at),
      });
      var x = d.h("button", {
        type: "button",
        class: "fav-row",
        title: "Remove from recent",
        "aria-label": "Remove from recent",
      }, [d.icon("x")]);
      x.addEventListener("click", function (e) {
        e.stopPropagation();
        N.recent.remove(it.k, it.e.id);
        renderRecents();
      });
      row.appendChild(x);
      listEl.appendChild(row);
    });
    box.appendChild(listEl);
  }

  /* ---------- announcements ---------- */
  function renderAnn() {
    var box = d.qs("#annHome");
    if (!box) return;
    box.textContent = "";
    var list = (C.announcements || []).slice(0, 3);
    list.forEach(function (a) {
      var card = d.h("div", { class: "rec-row" }, [
        d.h("div", { class: "ric" }, [d.icon("ann")]),
        d.h("div", { class: "rtxt" }, [
          d.h("b", null, a.title),
          d.h("span", null, N.dt.fmt(a.date) + " \u00b7 " + a.desc),
        ]),
      ]);
      card.addEventListener("click", function () {
        location.href = a.link || "/announcements";
      });
      box.appendChild(card);
    });
  }

  /* ---------- live schedule card ---------- */
  function renderSchedHome() {
    var el = d.qs("#schedHome");
    if (!el) return;
    el.textContent = "";

    var info = S.todayInfo();
    var wrap = d.h("div", { class: "sched-wrap sched-mini" });

    if (!info.type) {
      wrap.appendChild(
        d.h("div", { class: "sched-nodays" }, [
          d.h("b", null, info.dayName + " \u2014 no school."),
          d.h("span", null, " Monday is a Regular day."),
        ]),
      );
      el.appendChild(wrap);
      return;
    }

    var blocks = S.blocksFor(info.type);

    /* heading: date + day type badge */
    wrap.appendChild(
      d.h("div", { class: "hs-head" }, [
        d.h("b", null, info.dayName),
        d.h("span", null, info.dateLine),
        d.h("span", { class: "chip" + (info.type === "win" ? " accent" : "") }, info.kind.short),
      ]),
    );

    /* live now / next strip */
    var ls = S.liveStrip(blocks);
    wrap.appendChild(ls.el);

    /* today's blocks */
    var lv = S.live(blocks);
    var lastIdx = lv.block ? lv.i : -1;
    var lastPass = lv.block && lv.passing ? lv.i : null;
    var g = S.grid(blocks, lastIdx, { live: true, passing: lastPass });
    g.classList.add("home-grid");
    wrap.appendChild(g);

    el.appendChild(wrap);

    /* tick every second: countdown + NOW marker */
    clearInterval(schedTimer);
    schedTimer = setInterval(function () {
      if (!document.body.contains(el)) {
        clearInterval(schedTimer);
        return;
      }
      if (document.hidden) return;
      var nv = S.live(blocks);
      ls.paint(nv);
      var idx = nv.block ? nv.i : -1;
      var passIdx = nv.block && nv.passing ? nv.i : null;
      if (idx !== lastIdx || passIdx !== lastPass) {
        lastIdx = idx;
        lastPass = passIdx;
        /* rebuild so the passing-period row appears/disappears in place */
        var ng = S.grid(blocks, idx, { live: true, passing: passIdx });
        ng.classList.add("home-grid");
        g.replaceWith(ng);
        g = ng;
      }
    }, 1000);
  }

  /* ---------- modals ---------- */
  function welcome() {
    if (N.flags.get("welcome")) {
      popupNote();
      return;
    }
    N.modal.open({
      title: "Welcome to NULL",
      icon: "ban",
      dismissible: false,
      body:
"<p style='font-size:15px; color:#a3a3a3; margin-top:0; margin-bottom:16px;'>The ultimate browser-based hub \u2014 unblocked, fast, and built for you.</p>" +
"<p style='font-size:14px; margin-bottom:16px;'>Dive into over <b>2,300 games</b>, tons of premium apps, built-in proxies, and reliable backup links. NULL constantly updates in real-time to always stay ahead.</p>" +
"<p style='font-size:13.5px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#737373; margin-bottom:8px;'>Everything runs locally in your browser:</p>" +
"<p style='font-size:13.5px; margin-top:0; line-height:1.5;'>\u2022 Recently played games and tools save automatically to your device<br>" +
"\u2022 Open <b>Settings</b> to toggle instant tab cloaking, custom panic keys, themes, and deep visual customization<br>" +
"\u2022 NULL never uploads anything \u2014 no external servers, no tracking, and zero accounts required</p>"
,
      actions: [
        {
          label: "Continue",
          variant: "primary",
          onClick: function () {
            N.flags.set("welcome");
            popupNote();
          },
        },
      ],
    });
    /* 5-second cooldown on Continue — the copy is worth reading */
    var m = Array.prototype.slice.call(document.querySelectorAll(".modal-ov")).pop();
    var foot = m && m.querySelector(".modal-foot");
    var btn = foot && foot.querySelector("button");
    if (btn && foot) {
      foot.insertBefore(
        d.h("span", { class: "modal-cool-hint" }, "This stuff is helpful, read it!"),
        btn,
      );
      var left = 5;
      btn.disabled = true;
      btn.textContent = "Continue (" + left + ")";
      var iv = setInterval(function () {
        left--;
        if (left <= 0) {
          clearInterval(iv);
          btn.disabled = false;
          btn.textContent = "Continue";
        } else {
          btn.textContent = "Continue (" + left + ")";
        }
      }, 1000);
    }
  }

  function popupNote() {
    if (N.flags.get("popup")) {
      customizeNote();
      return;
    }
    N.modal.open({
      title: "Popups & redirects",
      icon: "ext",
      body:
        "<p>Some NULL features \u2014 cloaking, about:blank / blob: modes, and opening external proxies \u2014 ask the browser to allow <b>popups</b> and <b>redirects</b>.</p>" +
        "<p>That\u2019s NULL requesting permission for its own functionality. It is <b>not</b> malicious, and the browser stays in control of every permission prompt.</p>",
      onClose: customizeNote,
      actions: [
        {
          label: "Please accept",
          variant: "primary",
          onClick: function () {
            N.flags.set("popup");
            var w = null;
            try {
              w = window.open("about:blank", "_blank");
            } catch (err) {}
            if (w) {
              try {
                w.close();
              } catch (err) {}
            } else {
              d.toast("Popup blocked \u2014 allow popups for NULL to enable cloaking.", { type: "err", hold: 5000 });
            }
          },
        },
      ],
    });
  }

  /* one-time nudge after the welcome + popup modals: point new users at the
     customization features in Settings. "Sure" jumps straight there. */
  function customizeNote() {
    if (N.flags.get("customize")) return;
    N.modal.open({
      title: "Make NULL yours",
      icon: "pen",
      dismissible: false,
      body:
        "<p style='font-size:15px; color:#a3a3a3; margin-top:0; margin-bottom:14px;'>Would you like to customize NULL's look?</p>" +
        "<p style='font-size:13.5px; margin-top:0; margin-bottom:14px; line-height:1.55;'>Pick <b>accent colors</b> and <b>glow borders</b>, flip between <b>dark &amp; light mode</b>, cloak your tab with a <b>preset</b>, and arm a <b>panic key</b> \u2014 all in Settings, saved locally on your device.</p>" +
        "<div style='margin:0 0 14px; padding:10px 12px; border-radius:12px; background: color-mix(in srgb, var(--ac-1) 9%, transparent); border:1px solid color-mix(in srgb, var(--ac-1) 26%, transparent); font-size:13.5px; line-height:1.5;'><b>Introducing seasonal mode</b> \u2014 fall leaves, winter snow, spring petals and summer light drift behind everything, following the real seasons. Flip it on or off in Settings.</div>" +
        "<p style='font-size:13px; color:#737373; margin:0;'>Everything can be changed anytime later.</p>",
      actions: [
        {
          label: "Not right now",
          variant: "outline",
          onClick: function () {
            N.flags.set("customize");
          },
        },
        {
          label: "Sure",
          variant: "primary",
          onClick: function () {
            N.flags.set("customize");
            location.href = "/settings";
          },
        },
      ],
    });
  }

  /* ---------- buttons ---------- */
  function bind() {
    var rnd = d.qs("#btnRandom");
    if (rnd) rnd.addEventListener("click", N.launch.randomGame);

    var clr = d.qs("#btnClearRec");
    if (clr) {
      clr.addEventListener("click", function () {
        N.recent.clear();
        d.toast("Recently played cleared");
      });
    }
  }

  function init() {
    if (inited) return;
    inited = true;
    bindSearch();
    renderFeatured();
    renderGotd();
    renderTip();
    if (N.daily) N.daily.homeStrip();
    renderRecents();
    renderAnn();
    renderSchedHome();
    bind();
    N.bus.on("recent", renderRecents);
    N.bus.on("sched", function () {
      if (document.body.contains(d.qs("#schedHome"))) renderSchedHome();
    });
    welcome();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
