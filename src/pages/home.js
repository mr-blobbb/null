/* NULL — home.js
   Dashboard logic: live counts, recently played, favorites preview,
   announcements preview, the permanent schedule mini view, plus the
   first-launch welcome modal and the popup/redirect explanation modal. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;
  var C = window.NULL_CONTENT || {};

  var inited = false;

  function stat(id, n) {
    var el = d.qs("#" + id);
    if (el) el.textContent = n;
  }

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
    items.forEach(function (it) {
      var row = N.cards.row(it.e, it.k, {
        sub: (N.KIND_LABEL[it.k] || "") + " \u00b7 " + N.dt.ago(it.at),
      });
      box.appendChild(row);
    });
  }

  function renderFavs() {
    var box = d.qs("#favList");
    if (!box) return;
    box.textContent = "";
    var favs = N.favs
      .list()
      .map(function (f) {
        var e = N.catalog.find(f.k, f.id);
        return e ? { e: e, k: f.k } : null;
      })
      .filter(Boolean)
      .slice(0, 5);
    if (!favs.length) {
      box.appendChild(
        N.cards.empty("No favorites yet", "Tap the star on any game or app to keep it here."),
      );
      return;
    }
    favs.forEach(function (f) {
      box.appendChild(N.cards.row(f.e, f.k));
    });
  }

  function renderAnn() {
    var box = d.qs("#annHome");
    if (!box) return;
    box.textContent = "";
    var list = (C.announcements || []).slice(0, 3);
    list.forEach(function (a) {
      var tone = a.category === "notice" ? "accent" : "";
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
        "<p><b>NULL</b> is a frosted, black-and-white hub \u2014 games, apps, proxies and tools in one clean place.</p>" +
        "<p>Everything here runs in your browser:</p>" +
        "<p style='font-size:13.5px'>\u2022 Favorites &amp; recently played are saved locally<br>" +
        "\u2022 Themes, accents, glow borders &amp; tab presets are yours to tune<br>" +
        "\u2022 NULL never uploads anything \u2014 no servers, no accounts</p>",
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

  function bind() {
    d.qsa("#btnRandom, #btnRandom2").forEach(function (rnd) {
      rnd.addEventListener("click", N.launch.randomGame);
    });

    var clr = d.qs("#btnClearRec");
    if (clr) {
      clr.addEventListener("click", function () {
        N.recent.clear();
        d.toast("Recently played cleared");
      });
    }

    d.qsa(".js-search").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault();
        N.search.open();
      });
    });
  }

  function init() {
    if (inited) return;
    inited = true;

    var c = N.catalog.counts();
    stat("stGames", c.games);
    stat("stApps", c.apps);
    stat("stProxies", c.proxies);
    stat("tGames", c.games);
    stat("tApps", c.apps);
    stat("tProxies", c.proxies);

    renderRecents();
    renderFavs();
    renderAnn();

    var schedEl = d.qs("#schedHome");
    if (schedEl) N.schedule.render(schedEl, { mini: true });

    N.bus.on("recent", renderRecents);
    N.bus.on("favs", renderFavs);

    bind();
    welcome();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
