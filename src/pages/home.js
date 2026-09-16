/* NULL · home.js
   Dashboard logic: the featured rail, the daily crate strip, recently
   played games with random/clear, a live "today" schedule card,
   announcements, the first-launch welcome modal and the popup/redirect
   explanation. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;
  var S = N.schedule;
  var C = window.NULL_CONTENT || {};

  var inited = false;
  var schedTimer = null;

  /* ---------- featured picks ----------
     The games you want on the home page, in order. Type any of these and it
     lands in the Featured rail:

       "hollow-knight"    the folder name (games/hollow-knight)
       "Hollow Knight"    the display name, case does not matter
       "hollow knight"    spaces and dashes are ignored when matching

     A name that matches nothing is skipped, so a typo costs you one card
     instead of the whole rail. Leave a slot empty (or list fewer than ten)
     and the rest fills with the first games in the library. Apps are never
     featured here: this rail is games only. */
  var FEATURED = [
    "hollow-knight",
  ];
  var FEATURED_MAX = 10;

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

  /* ---------- masthead counts ----------
     Live totals in the top-right of the hero band. Empty libraries just
     drop the matching part (and the whole line if there is nothing). */
  function renderMastStats() {
    var el = d.qs("#mastStats");
    if (!el) return;
    function n(count, one, many) {
      return count ? count.toLocaleString() + " " + (count === 1 ? one : many) : "";
    }
    var parts = [
      n(N.catalog.games().length, "game", "games"),
      n(N.catalog.apps().length, "app", "apps"),
      n(N.catalog.proxies().length, "proxy", "proxies"),
    ].filter(Boolean);
    el.textContent = parts.join(" · ");
    el.hidden = !parts.length;
  }

  /* ---------- featured rail ---------- */
  function key(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/[\s_-]/g, "");
  }

  function pickFeatured(games) {
    var out = [];
    function taken(g) {
      return out.indexOf(g) >= 0;
    }
    FEATURED.forEach(function (want) {
      var k = key(want);
      if (!k) return;
      var hit = games.find(function (g) {
        return key(g.id) === k || key(g.name) === k;
      });
      if (hit && !taken(hit)) out.push(hit);
    });
    /* unused slots go to the front of the library so the rail stays full */
    games.forEach(function (g) {
      if (out.length < FEATURED_MAX && !taken(g)) out.push(g);
    });
    return out.slice(0, FEATURED_MAX);
  }

  function renderFeatured() {
    var track = d.qs("#featTrack");
    var hint = d.qs("#featHint");
    if (!track) return;
    track.textContent = "";
    var games = N.catalog.games();
    var list = pickFeatured(games);
    if (!list.length) {
      track.appendChild(
        d.h("div", { class: "feat-empty" }, "The library is empty: add folders to games/ and rebuild the catalog."),
      );
      if (hint) hint.textContent = "";
      return;
    }
    if (hint) {
      hint.textContent = "Hand-picked · " + games.length + " game" + (games.length === 1 ? "" : "s") + " in the library";
    }
    list.forEach(function (g) {
      track.appendChild(N.cards.card(g, "game"));
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
      d.h("p", { class: "gotd-desc" }, g.desc || "A game in the NULL library: fresh pick every day."),
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
     from the date (same tip all day, fresh tomorrow: no storage needed). */
  var TIPS = [
    "Type <b>sggames</b> anywhere to open the silly little easter egg :P",
    "The <b>panic key</b> (backtick by default) jumps you to a safe page instantly. Set it in Settings.",
    "Tab cloaking is free: pick a Google preset in Settings and your tab title + icon change instantly.",
    "Play 30 minutes and you earn <b>10 XP</b>, and every 100 XP banks 30 coins for the Shop.",
    "The <b>screensaver</b> kicks in after two idle minutes. Move the mouse or press any key to wake it.",
    "Star a game to favorite it; favorites show up in the drawer and are searchable.",
    "Seasonal mode is off by default. Flip it on in Settings for falling leaves, snow or petals.",
    "Smart tab cloak rotates your tab preset on a timer while you play. It pauses when the tab is hidden.",
    "Game saves that live in localStorage can be downloaded and even shared with a friend from the player bar.",
    "Search understands labels: try “arcade”, “memory” or “calculator” to filter results.",
    "Marathon mode auto-switches games on a timer: the games page owns the controls.",
    "Open the <b>daily crate</b> for free coins: the streak bonus grows every day you come back.",
    "Daily quests and achievements pay coins in the <b>Shop</b>: a dot on its icon means something is waiting.",
    "Press <b>/</b> anywhere to jump into search without touching the mouse.",
    "Want to save, share or protect your progress on your favorite games? Press the save card to download a save file, directly to your device!",
    "Did you know that you can download offline, singlefile versions of NULL? Just go to our Github Repository, click Releases, and download either regular, lite, or mini versions of our site!",
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
    var i = 0;
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
        sub: (N.KIND_LABEL[it.k] || "") + " · " + N.dt.ago(it.at),
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
      row.style.setProperty("--i", i++);
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
          d.h("span", null, N.dt.fmt(a.date) + " · " + a.desc),
        ]),
      ]);
      card.addEventListener("click", function () {
        location.href = N.url(a.link || "/announcements");
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
          d.h("b", null, info.dayName + ": no school."),
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

  /* ---------- first run ----------
     The welcome modal grew up into the tour (components/tour.js): it opens
     here on the home page, walks the library, the shop and settings, and
     then chains the permission ask and the Settings nudge wherever it
     happens to finish. home.js just hands over. */
  function firstRun() {
    if (N.tour) N.tour.start();
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

  /* ---------- hero animation prep ----------
     The tagline lifts in word by word and the NULL wordmark letter by
     letter, then the wordmark runs a slow sheen on a loop. Pure CSS after
     this: we only split the text into spans and hand each one an index.
     Without JS the plain text stays exactly as it is. */
  function prepHero() {
    var tag = d.qs("#mastTag");
    if (tag) {
      var words = tag.textContent.trim().split(/\s+/);
      tag.textContent = "";
      words.forEach(function (w, i) {
        tag.appendChild(d.h("span", { class: "w", style: { "--i": i } }, w));
        if (i < words.length - 1) tag.appendChild(document.createTextNode(" "));
      });
    }
    var wm = d.qs(".mast-null");
    if (wm) {
      var text = wm.textContent;
      wm.textContent = "";
      text.split("").forEach(function (ch, i) {
        wm.appendChild(d.h("span", { class: "l", style: { "--i": i } }, ch));
      });
    }
  }

  /* ---------- section reveals ----------
     Sections below the fold slide up softly the first time they scroll in.
     One observer, .in-view is left on, nothing unobserves mid-scroll. If the
     browser has no IntersectionObserver (or JS dies) html.no-io unhides
     everything from CSS instead. */
  function watchReveals() {
    if (typeof IntersectionObserver === "undefined") {
      document.documentElement.classList.add("no-io");
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in-view");
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    d.qsa(".reveal, .mast-null, .tip-card, .feat-panel").forEach(function (el) {
      io.observe(el);
    });
  }

  function init() {
    if (inited) return;
    inited = true;
    prepHero();
    renderMastStats();
    bindSearch();
    renderFeatured();
    renderGotd();
    renderTip();
    if (N.daily) N.daily.homeStrip();
    renderRecents();
    renderAnn();
    renderSchedHome();
    bind();
    watchReveals();
    N.bus.on("recent", renderRecents);
    /* the dev console can change the catalog under us: keep the counts and
       the featured rail honest */
    N.bus.on("catalog", function () {
      renderMastStats();
      renderFeatured();
      renderGotd();
    });
    N.bus.on("sched", function () {
      if (document.body.contains(d.qs("#schedHome"))) renderSchedHome();
    });
    firstRun();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();