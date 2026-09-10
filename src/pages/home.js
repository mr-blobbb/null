/* NULL — home.js
   Dashboard logic: the featured rail (first 10 library items), recently
   played with random/clear, a live "today" schedule card, announcements,
   the first-launch welcome modal and the popup/redirect explanation. */
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

  /* ---------- recently played ---------- */
  function renderRecents() {
    var box = d.qs("#recList");
    if (!box) return;
    box.textContent = "";
    var items = N.recent
      .list()
      .map(function (r) {
        var e = N.catalog.find(r.k, r.id);
        return e ? { e: e, k: r.k, at: r.at } : null;
      })
      .filter(Boolean)
      .slice(0, 8);
    if (!items.length) {
      box.appendChild(
        N.cards.empty("Nothing played yet", "Open something from Games or Apps and it will show up here."),
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
        location.href = a.link || "/announcements.html";
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
    if (N.flags.get("popup")) return;
    N.modal.open({
      title: "Popups & redirects",
      icon: "ext",
      body:
        "<p>Some NULL features \u2014 cloaking, about:blank / blob: modes, and opening external proxies \u2014 ask the browser to allow <b>popups</b> and <b>redirects</b>.</p>" +
        "<p>That\u2019s NULL requesting permission for its own functionality. It is <b>not</b> malicious, and the browser stays in control of every permission prompt.</p>",
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
