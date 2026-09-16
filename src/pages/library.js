/* NULL · library.js
   Powers the Games, Apps and Proxies pages: one flat tool row (filter, sort,
   a label dropdown and the count) over the discovered catalog, rendered into
   the chunk-virtualized grid. Labels are still real filters, they just live
   behind one button now instead of a wall of chips. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  function kindOf(body) {
    var pg = (body.dataset.page || "").replace("Page", "");
    return pg === "games" || pg === "apps" || pg === "proxies" ? pg : "games";
  }

  /* tile heights: roughly square in the virtualized grid, so the vgrid's
     fixed row maths still holds at every width */
  var CARD_H = { games: 190, apps: 190, proxies: 190 };

  function init() {
    var kind = kindOf(document.body);
    var list = kind === "apps" ? N.catalog.apps() : kind === "proxies" ? N.catalog.proxies() : N.catalog.games();
    var favKind = kind === "apps" ? "app" : kind === "proxies" ? "proxy" : "game";
    var listMode = kind === "proxies"; // proxies are a plain vertical list

    var bar = d.qs(".lib-bar");
    var panel = d.qs("#labelRow");
    var labelBtn = d.qs("#btnLabels");
    var labelN = d.qs("#labelCount");
    var input = d.qs("#libSearch");
    var countEl = d.qs("#count");
    var grid = d.qs("#grid");
    var favSec = d.qs("#favSec");
    var emptyBox = d.qs("#empty");
    var scroller = d.qs("#scrollview");

    var activeLabel = "All";
    var query = "";
    var sortMode = "name"; // name = A-Z, id = folder label, plays = popularity, new = recently added
    var gridApi = null;

    /* ---------- the label dropdown ----------
       One button, one panel. Open state lives on the bar so the pinned bar
       carries it along while you scroll, and a click anywhere else, Escape or
       a pick closes it. */
    function labelsOpen() {
      return !!panel && !panel.hidden;
    }
    function setLabels(on) {
      if (!panel || !labelBtn) return;
      panel.hidden = !on;
      labelBtn.setAttribute("aria-expanded", String(!!on));
    }
    if (labelBtn) {
      labelBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        setLabels(!labelsOpen());
      });
    }
    if (panel) panel.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    document.addEventListener("click", function () {
      if (labelsOpen()) setLabels(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && labelsOpen()) setLabels(false);
    });

    /* ---------- pinned tool bar ----------
       The library scrolls inside #scrollview, not the window, and a plain
       position:sticky bar landed a fixed distance below the nav there (the
       scroller's own top edge plus the nav's height) instead of flush under
       it. So the bar is pinned by measurement instead: a spacer holds its
       place in the flow, and the moment that spacer reaches the nav's real
       bottom edge the bar goes fixed exactly there, spanning the scroller.
       It releases again as soon as you scroll back to the top, and follows a
       nav that changes height (an extension widget mounting, a resize). */
    if (bar && scroller) {
      var fill = d.h("div", { class: "tool-fill", "aria-hidden": "true" });
      bar.parentNode.insertBefore(fill, bar);
      var pinned = false;
      /* the bar's resting box (centred page column, own width). Measured with
         the class off, so the pinned bar keeps the same geometry the page
         shows rather than stretching across the whole scroller. */
      var geo = null;

      /* the nav's real bottom edge. --nh is the design height; this is what
         is on screen, which is what the bar has to sit under. A rail sits
         beside the page instead of above it, so there is nothing to clear. */
      function navBottom() {
        var nav = d.qs(".topbar");
        if (!nav || document.documentElement.dataset.nav === "side") return 0;
        var box = nav.getBoundingClientRect();
        return box.height ? Math.max(0, Math.round(box.bottom)) : 0;
      }

      function measure() {
        var off = bar.classList.contains("pinned");
        if (off) {
          bar.classList.remove("pinned");
          bar.style.left = bar.style.width = bar.style.top = "";
        }
        var box = bar.getBoundingClientRect();
        geo = { left: Math.round(box.left), width: Math.round(box.width) };
        if (off) bar.classList.add("pinned");
      }

      function place() {
        if (!geo) measure();
        bar.style.left = geo.left + "px";
        bar.style.width = geo.width + "px";
        bar.style.top = navBottom() + "px";
      }

      function sync() {
        var want = navBottom();
        var on = fill.getBoundingClientRect().top <= want;
        if (on !== pinned) {
          pinned = on;
          /* the bar's own margins are what leaves the gap above and below it
             in the flow, and pinning drops them, so the spacer has to carry
             them: measured here, before the class swap moves anything. */
          var cs = window.getComputedStyle(bar);
          var air = (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
          bar.classList.toggle("pinned", on);
          fill.style.height = on ? bar.offsetHeight + air + "px" : "";
        }
        if (pinned) place();
      }

      function resize() {
        geo = null;
        sync();
      }

      scroller.addEventListener("scroll", sync, { passive: true });
      window.addEventListener("resize", resize);
      /* an extension widget can grow the nav, and a retexture can change the
         page column: re-measure on either */
      if (N.bus) {
        N.bus.on("ext", resize);
        N.bus.on("theme", resize);
      }
      sync();
    }

    /* reset button: one click back to the unfiltered view. Hidden until a
       filter or a search is actually doing something. */
    var resetBtn = d.h("button", {
      type: "button",
      class: "lib-reset",
      hidden: true,
      onclick: function () {
        activeLabel = "All";
        query = "";
        if (input) input.value = "";
        buildLabels();
        paint();
        if (input) input.focus();
      },
    }, [d.icon("x"), "Reset"]);
    if (bar) bar.appendChild(resetBtn);

    function sorted(arr) {
      var copy = arr.slice();
      if (sortMode === "plays") {
        /* popularity: HOT entries lead, then whatever this browser plays most,
           ties broken A-Z */
        copy.sort(function (a, b) {
          return (
            (b.hot ? 1 : 0) - (a.hot ? 1 : 0) ||
            N.plays.count(favKind, b.id) - N.plays.count(favKind, a.id) ||
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          );
        });
      } else if (sortMode === "new") {
        /* newest Added date first; entries without a date sink to the bottom */
        copy.sort(function (a, b) {
          return (
            (b.at || 0) - (a.at || 0) ||
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          );
        });
      } else {
        copy.sort(function (a, b) {
          var ka = sortMode === "id" ? a.id || "" : a.name || "";
          var kb = sortMode === "id" ? b.id || "" : b.name || "";
          return ka.localeCompare(kb, undefined, { sensitivity: "base" });
        });
      }
      return copy;
    }

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
      return sorted(out);
    }

    /* favorites box: sits above the grid, hides when empty */
    function renderFavs() {
      if (!favSec || favKind === "proxy") return;
      var favs = N.favs
        .list()
        .filter(function (f) {
          return f.k === favKind;
        })
        .map(function (f) {
          return N.catalog.find(f.k, f.id);
        })
        .filter(Boolean);
      if (!favs.length) {
        favSec.hidden = true;
        favSec.textContent = "";
        return;
      }
      favSec.hidden = false;
      favSec.textContent = "";
      favSec.appendChild(
        d.h("div", { class: "panel-head" }, [
          d.h("h2", null, [d.icon("star"), "Favorites"]),
          d.h("span", { class: "hint" }, favs.length + (favs.length === 1 ? " item" : " items")),
        ]),
      );
      var g = d.h("div", { class: "fav-grid" });
      favs.forEach(function (e) {
        g.appendChild(N.cards.card(e, favKind));
      });
      favSec.appendChild(g);
    }

    function paint() {
      var items = filtered();
      if (countEl) {
        countEl.textContent = items.length === list.length ? list.length + "" : items.length + " / " + list.length;
      }
      if (resetBtn) resetBtn.hidden = activeLabel === "All" && !query.trim();
      if (labelBtn) labelBtn.classList.toggle("on", activeLabel !== "All");
      if (labelN) {
        labelN.hidden = activeLabel === "All";
        labelN.textContent = activeLabel;
      }
      if (listMode) {
        /* plain list: proxies render as one-column rows, no virtualization */
        grid.textContent = "";
        items.forEach(function (e) {
          grid.appendChild(N.cards.card(e, "proxy"));
        });
      } else if (gridApi) {
        gridApi.update(items, { resetScroll: false });
      }

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

    /* ---------- "because you played" (games) / "recently opened" (apps) ---------- */
    function renderRecs() {
      var sec = d.qs("#recSec");
      if (!sec || kind === "proxies") return;
      if (kind === "games" && N.prefs.get("recs") === false) {
        sec.hidden = true;
        sec.textContent = "";
        return;
      }
      var favK = kind === "apps" ? "app" : "game";
      var recent = N.recent
        .list()
        .filter(function (r) {
          return r.k === favK;
        })
        .map(function (r) {
          return N.catalog.find(favK, r.id);
        })
        .filter(Boolean);
      if (!recent.length) {
        sec.hidden = true;
        sec.textContent = "";
        return;
      }
      sec.hidden = false;
      sec.textContent = "";

      if (kind === "games") {
        var seed = recent[0];
        var games = N.catalog.games();
        function shared(g) {
          var n = 0;
          (g.labels || []).forEach(function (l) {
            if ((seed.labels || []).indexOf(l) >= 0) n++;
          });
          return n;
        }
        var cands = games.filter(function (g) {
          return g.id !== seed.id;
        });
        cands.sort(function (a, b) {
          return shared(b) - shared(a) || a.name.localeCompare(b.name);
        });
        var picks = cands.slice(0, 4);
        /* top up with random picks when shared labels run dry */
        var guard = 0;
        while (picks.length < 4 && guard < cands.length * 2) {
          var g = cands[Math.floor(Math.random() * cands.length)];
          if (picks.indexOf(g) < 0) picks.push(g);
          guard++;
        }
        sec.appendChild(
          d.h("div", { class: "panel-head" }, [
            d.h("h2", null, [d.icon("heart"), "Because you played ", d.h("b", null, seed.name)]),
          ]),
        );
        var sug = d.h("div", { class: "lib-sugs" });
        picks.forEach(function (g) {
          sug.appendChild(N.cards.card(g, "game"));
        });
        sec.appendChild(sug);
        return;
      }

      /* apps: a simple row of what you opened last */
      sec.appendChild(
        d.h("div", { class: "panel-head" }, [
          d.h("h2", null, [d.icon("clock2"), "Recently opened"]),
        ]),
      );
      var sug2 = d.h("div", { class: "lib-sugs" });
      recent.slice(0, 4).forEach(function (a) {
        sug2.appendChild(N.cards.card(a, "app"));
      });
      sec.appendChild(sug2);
    }

    /* ---------- the label list ---------- */
    function buildLabels() {
      if (!panel) return;
      panel.textContent = "";
      var counts = {};
      list.forEach(function (e) {
        (e.labels || []).forEach(function (l) {
          counts[l] = (counts[l] || 0) + 1;
        });
      });
      var labels = Object.keys(counts).sort();
      function chip(label, on, extra) {
        var kids = [d.h("span", { class: "ch-t" }, label)];
        if (extra !== undefined && extra !== null) {
          kids.push(d.h("span", { class: "ch-n" }, String(extra)));
        }
        return d.h("button", {
          type: "button",
          class: "chip chip-btn" + (on ? " on" : ""),
          onclick: function () {
            activeLabel = label;
            buildLabels();
            paint();
            setLabels(false);
          },
        }, kids);
      }
      panel.appendChild(chip("All", activeLabel === "All", list.length));
      labels.forEach(function (l) {
        panel.appendChild(chip(l, activeLabel === l, counts[l]));
      });
    }

    /* quick filter */
    if (input) {
      input.addEventListener("input", d.debounce(function () {
        query = input.value;
        paint();
      }, 90));
      /* ArrowDown from the filter drops into the first grid card; the cards
         are real buttons, so arrow/Enter navigation keeps working from there */
      input.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowDown") return;
        var cards = d.qsa("#grid .tcard[tabindex='0']");
        if (!cards.length) return;
        e.preventDefault();
        cards[0].focus();
      });
    }

    /* sort dropdown (custom-styled via dom.upgradeSelect) */
    var sortSel = d.qs("#sortSel");
    if (sortSel) {
      N.dom.upgradeSelect(sortSel);
      sortSel.addEventListener("change", function () {
        sortMode = sortSel.value || "name";
        paint();
      });
    }

    buildLabels();
    renderFavs();
    renderRecs();
    N.bus.on("favs", function () {
      renderFavs();
      paint();
    });
    N.bus.on("recent", renderRecs);

    /* the dev console can push placeholder entries into the catalog while a
       page is open: rebuild the list, labels and grid when it does */
    N.bus.on("catalog", function () {
      list = kind === "apps" ? N.catalog.apps() : kind === "proxies" ? N.catalog.proxies() : N.catalog.games();
      buildLabels();
      renderFavs();
      renderRecs();
      paint();
    });

    if (!listMode) {
      /* the tile is exactly as tall as the row the vgrid reserves, so the
         squares line up with the chunk maths */
      grid.style.setProperty("--tile-h", CARD_H[kind] + "px");
      gridApi = N.cards.vgrid(grid, {
        items: filtered(),
        cardH: CARD_H[kind],
        minW: 170,
        gap: 14,
        buffer: 2,
        scroll: scroller || window,
        render: function (entry) {
          return N.cards.card(entry, kind === "apps" ? "app" : "game");
        },
      });
    } else {
      grid.classList.add("lib-list");
    }
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
