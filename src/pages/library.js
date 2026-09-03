/* NULL — library.js
   Powers the Games, Apps and Proxies pages: label chips + quick filter over
   the discovered catalog, rendered into the chunk-virtualized grid. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  function kindOf(body) {
    var pg = (body.dataset.page || "").replace("Page", "");
    return pg === "games" || pg === "apps" || pg === "proxies" ? pg : "games";
  }

  var CARD_H = { games: 270, apps: 270, proxies: 268 };

  function init() {
    var kind = kindOf(document.body);
    var list = kind === "apps" ? N.catalog.apps() : kind === "proxies" ? N.catalog.proxies() : N.catalog.games();

    var rowHost = d.qs("#labelRow");
    var input = d.qs("#libSearch");
    var countEl = d.qs("#count");
    var grid = d.qs("#grid");
    var emptyBox = d.qs("#empty");
    var scroller = d.qs("#scrollview");

    var activeLabel = "All";
    var query = "";
    var gridApi = null;

    function filtered() {
      var q = query.trim().toLowerCase();
      var out = list.filter(function (e) {
        var okLabel = activeLabel === "All" || (e.labels || []).indexOf(activeLabel) >= 0;
        var okQ =
          !q ||
          (e.name || "").toLowerCase().indexOf(q) >= 0 ||
          (e.desc || "").toLowerCase().indexOf(q) >= 0 ||
          (e.labels || []).join(" ").toLowerCase().indexOf(q) >= 0;
        return okLabel && okQ;
      });
      return out;
    }

    function paint() {
      var items = filtered();
      if (countEl) countEl.textContent = items.length + " / " + list.length;
      if (gridApi) gridApi.update(items, { resetScroll: false });

      var showEmpty = !items.length;
      if (emptyBox) {
        emptyBox.textContent = "";
        if (showEmpty) {
          emptyBox.appendChild(
            N.cards.empty(
              query ? "No matches" : "Nothing here yet",
              query
                ? "Try a different search or clear the filters."
                : "Add a folder to the " + kind + "/ directory and rebuild the catalog (see README).",
            ),
          );
        }
      }
      grid.style.display = showEmpty ? "none" : "";
    }

    /* label chips */
    function buildChips() {
      rowHost.textContent = "";
      var counts = {};
      list.forEach(function (e) {
        (e.labels || []).forEach(function (l) {
          counts[l] = (counts[l] || 0) + 1;
        });
      });
      var labels = Object.keys(counts).sort();
      function chip(label, on, extra) {
        return d.h("button", {
          type: "button",
          class: "chip chip-btn" + (on ? " on" : ""),
          onclick: function () {
            activeLabel = label;
            buildChips();
            paint();
          },
        }, label + (extra ? " \u00b7 " + extra : ""));
      }
      rowHost.appendChild(chip("All", activeLabel === "All", list.length));
      labels.forEach(function (l) {
        rowHost.appendChild(chip(l, activeLabel === l, counts[l]));
      });
      rowHost.scrollLeft = 0;
    }

    /* quick filter */
    if (input) {
      input.addEventListener("input", d.debounce(function () {
        query = input.value;
        paint();
      }, 90));
    }

    buildChips();

    gridApi = N.cards.vgrid(grid, {
      items: filtered(),
      cardH: CARD_H[kind],
      minW: kind === "proxies" ? 236 : 168,
      gap: 18,
      buffer: 2,
      scroll: scroller || window,
      render: function (entry) {
        return N.cards.card(entry, kind === "apps" ? "app" : kind === "proxies" ? "proxy" : "game");
      },
    });
    paint();

    /* keep grid width accurate after images/fonts settle */
    window.addEventListener("load", function () {
      if (gridApi) gridApi.update(filtered());
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
