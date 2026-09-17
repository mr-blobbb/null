/* NULL · library.js
   One page for Games, Apps and Proxeis. The page name decides which list is
   on screen; everything else is identical on purpose, because the three are
   the same job: find a thing, open the thing.

   A tile is a square and a name. No description, no label chips, no badges.
   The category is still there (it is what the library is built from) but it
   is hidden behind search instead of printed on every card. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  /* the three pages differ by: which list, which favorite kind, which glyph
     stands in when there is no artwork, and what the thing is called */
  var KINDS = {
    games: { list: "games", fav: "game", icon: "games", one: "game", many: "games" },
    apps: { list: "apps", fav: "app", icon: "apps", one: "app", many: "apps" },
    proxies: { list: "proxies", fav: "proxy", icon: "globe", one: "proxy", many: "proxeis" },
  };

  function init() {
    var page = (document.body.dataset.page || "games").replace("Page", "");
    var cfg = KINDS[page] || KINDS.games;

    var input = d.qs("#libSearch");
    var sortSel = d.qs("#sortSel");
    var randBtn = d.qs("#btnRandom");
    var countEl = d.qs("#count");
    var chipsEl = d.qs("#libChips");
    var grid = d.qs("#grid");
    var emptyEl = d.qs("#empty");

    var list = [];
    var query = "";
    var sortMode = "name";
    var chip = "all"; // all | favs

    function load() {
      list = N.catalog[cfg.list]() || [];
    }

    /* ---------- filtering ---------- */
    function matches(e, q) {
      if (!q) return true;
      /* name first, then the hidden category words: searching "puzzle" still
         finds a puzzle game even though no tile prints the label */
      if ((e.name || "").toLowerCase().indexOf(q) >= 0) return true;
      if ((e.labels || []).join(" ").toLowerCase().indexOf(q) >= 0) return true;
      if ((e.desc || "").toLowerCase().indexOf(q) >= 0) return true;
      return (e.id || "").toLowerCase().indexOf(q) >= 0;
    }

    function sorted(arr) {
      var copy = arr.slice();
      if (sortMode === "plays") {
        copy.sort(function (a, b) {
          return (
            (b.hot ? 1 : 0) - (a.hot ? 1 : 0) ||
            N.plays.count(cfg.fav, b.id) - N.plays.count(cfg.fav, a.id) ||
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          );
        });
      } else if (sortMode === "new") {
        copy.sort(function (a, b) {
          return (b.at || 0) - (a.at || 0) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        });
      } else {
        var key = sortMode === "id" ? "id" : "name";
        copy.sort(function (a, b) {
          return String(a[key] || "").localeCompare(String(b[key] || ""), undefined, { sensitivity: "base" });
        });
      }
      return copy;
    }

    function isFav(e) {
      return N.favs.has(cfg.fav, e.id);
    }

    function visible() {
      var q = query.trim().toLowerCase();
      var out = list.filter(function (e) {
        return matches(e, q) && (chip !== "favs" || isFav(e));
      });
      return sorted(out);
    }

    /* ---------- a tile ---------- */
    function tile(e) {
      var sq = d.h("span", { class: "tl-sq" + (e.thumb ? "" : " tl-sq--none") });
      if (e.thumb) {
        sq.style.backgroundImage = 'url("' + String(e.thumb).replace(/"/g, "%22") + '")';
      } else {
        /* no artwork: a lighter square and one big glyph, so the grid keeps
           its rhythm instead of growing holes */
        sq.appendChild(d.h("span", { class: "tl-fb" }, [N.icons.svg(cfg.icon, 40, 1.3)]));
      }

      var open = d.h("button", { type: "button", class: "tl", "aria-label": "Open " + e.name }, [
        sq,
        d.h("span", { class: "tl-n" }, e.name || e.id),
      ]);
      open.addEventListener("click", function () {
        N.launch[cfg.fav](e);
      });

      var star = d.h(
        "button",
        {
          type: "button",
          class: "tl-st" + (isFav(e) ? " on" : ""),
          "aria-pressed": isFav(e) ? "true" : "false",
          "aria-label": (isFav(e) ? "Remove " : "Add ") + (e.name || e.id) + " favorites",
          title: "Favorite",
        },
        [N.icons.svg("star", 14)],
      );
      star.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var now = N.favs.toggle(cfg.fav, e.id);
        star.classList.toggle("on", now);
        star.setAttribute("aria-pressed", now ? "true" : "false");
        paint();
      });

      return d.h("div", { class: "tl-w" }, [open, star]);
    }

    /* ---------- the two chips ---------- */
    function chips(favCount) {
      chipsEl.textContent = "";
      function cp(id, label, icon, n) {
        var b = d.h(
          "button",
          {
            type: "button",
            class: "cp" + (chip === id ? " on" : ""),
            "aria-pressed": chip === id ? "true" : "false",
          },
          [N.icons.svg(icon, 16), d.h("span", null, label), d.h("span", { class: "cp-n" }, String(n))],
        );
        b.addEventListener("click", function () {
          chip = id;
          paint();
        });
        return b;
      }
      chipsEl.appendChild(cp("all", "All", cfg.icon, list.length));
      chipsEl.appendChild(cp("favs", "Favorites", "star", favCount));
    }

    function paint() {
      var favCount = list.filter(isFav).length;
      var items = visible();

      chips(favCount);

      /* "1000 of 1000" while everything is showing, "3 of 1000" once it is not */
      if (countEl) {
        var total = chip === "favs" ? favCount : list.length;
        countEl.textContent = items.length + " of " + total;
      }

      grid.textContent = "";
      grid.hidden = !items.length;
      items.forEach(function (e) {
        grid.appendChild(tile(e));
      });

      if (emptyEl) {
        if (items.length) {
          emptyEl.hidden = true;
          emptyEl.textContent = "";
        } else {
          emptyEl.hidden = false;
          var msg;
          if (chip === "favs" && !favCount) {
            msg = "No favorites yet — star a " + cfg.one + " to save it here.";
          } else if (query.trim()) {
            msg = 'No ' + cfg.many + ' matching "' + query.trim() + '"';
          } else {
            msg = "Nothing here yet. Add a folder to the " + cfg.many + "/ directory and rebuild the catalog.";
          }
          emptyEl.textContent = msg;
        }
      }
    }

    /* ---------- wiring ---------- */
    if (input) {
      input.addEventListener(
        "input",
        d.debounce(function () {
          query = input.value;
          paint();
        }, 80),
      );
      input.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && input.value) {
          input.value = "";
          query = "";
          paint();
        }
      });
    }

    if (sortSel) {
      d.upgradeSelect(sortSel);
      sortSel.addEventListener("change", function () {
        sortMode = sortSel.value || "name";
        paint();
      });
    }

    if (randBtn) {
      randBtn.addEventListener("click", function () {
        var pool = visible();
        if (!pool.length) {
          d.toast("Nothing to pick from in this view.", { type: "err" });
          return;
        }
        N.launch[cfg.fav](pool[Math.floor(Math.random() * pool.length)]);
      });
    }

    N.bus.on("favs", paint);
    /* the dev console can seed placeholder entries into the live catalog */
    N.bus.on("catalog", function () {
      load();
      paint();
    });

    load();
    paint();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
