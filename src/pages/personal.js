/* NULL — personal.js
   Powers /recent.html and /favorites.html. Clear buttons act immediately,
   with no confirmation (per spec, these live here — not in Settings). */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var MODE = { recent: "recent", favorites: "favorites" };
  var inited = false;

  function itemRow(entry, kind, sub) {
    var meta = N.cards.META[kind];
    var ic = d.h("div", { class: "ric" }, [d.icon(meta.icon)]);
    if (entry.thumb) {
      var img = d.h("img", { src: entry.thumb, alt: "", loading: "lazy" });
      d.bindImgFallback(img, kind);
      ic.textContent = "";
      ic.appendChild(img);
    }
    var row = d.h("div", { class: "rec-row glass", role: "button", tabindex: "0" }, [
      ic,
      d.h("div", { class: "rtxt" }, [
        d.h("b", null, entry.name),
        d.h("span", null, sub),
      ]),
      d.h("span", { class: "chip kind-chip" }, meta.label),
    ]);
    var open = function () {
      if (kind === "proxy") N.launch.proxy(entry);
      else if (kind === "game") N.launch.game(entry);
      else N.launch.app(entry);
    };
    row.addEventListener("click", open);
    row.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        open();
      }
    });
    return row;
  }

  function init() {
    if (inited) return;
    inited = true;

    var mode = document.body.dataset.page === "favorites" ? MODE.favorites : MODE.recent;
    var box = d.qs("#list");
    var count = d.qs("#count");
    var clearBtn = d.qs("#clearBtn");

    function render() {
      box.textContent = "";
      var raw =
        mode === MODE.favorites
          ? N.favs.list().map(function (f) {
              var e = N.catalog.find(f.k, f.id);
              return e ? { e: e, k: f.k, at: 0 } : null;
            })
          : N.recent.list().map(function (r) {
              var e = N.catalog.find(r.k, r.id);
              return e ? { e: e, k: r.k, at: r.at } : null;
            });
      var items = raw.filter(Boolean);

      if (count) count.textContent = items.length + (items.length === 1 ? " item" : " items");

      if (!items.length) {
        box.appendChild(
          N.cards.empty(
            mode === MODE.favorites ? "No favorites yet" : "Nothing here yet",
            mode === MODE.favorites
              ? "Star games and apps from the library to collect them here."
              : "Open games and apps from the library \u2014 they\u2019ll show up here.",
          ),
        );
        return;
      }

      var listEl = d.h("div", { class: "rec-list" });
      items.forEach(function (it) {
        var sub =
          (N.KIND_LABEL[it.k] || "") + (it.at ? " \u00b7 " + N.dt.ago(it.at) : "");
        var row = itemRow(it.e, it.k, sub);

        /* trailing control: favorites → filled star (remove), recent → x (remove) */
        var extra = d.h("button", {
          type: "button",
          class: "fav-row" + (mode === MODE.favorites ? " on" : ""),
          title: mode === MODE.favorites ? "Remove from favorites" : "Remove from recent",
          "aria-label": mode === MODE.favorites ? "Remove from favorites" : "Remove from recent",
        }, [d.icon(mode === MODE.favorites ? "star" : "x")]);
        extra.addEventListener("click", function (e) {
          e.stopPropagation();
          if (mode === MODE.favorites) N.favs.remove(it.k, it.e.id);
          else N.recent.remove(it.k, it.e.id);
          render();
        });
        row.appendChild(extra);
        listEl.appendChild(row);
      });
      box.appendChild(listEl);
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (mode === MODE.favorites) N.favs.clear();
        else N.recent.clear();
        render();
        d.toast(mode === MODE.favorites ? "Favorites cleared" : "Recently played cleared");
      });
    }

    N.bus.on(mode === MODE.favorites ? "favs" : "recent", render);
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
