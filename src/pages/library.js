/* NULL · library.js
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
    var favKind = kind === "apps" ? "app" : kind === "proxies" ? "proxy" : "game";
    var listMode = kind === "proxies"; // proxies are a plain vertical list

    var rowHost = d.qs("#labelRow");
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
      if (countEl) countEl.textContent = items.length + " / " + list.length;
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

    /* ---------- "because you played": games page only ---------- */
    function renderRecs() {
      var sec = d.qs("#recSec");
      if (!sec || kind !== "games") return;
      if (N.prefs.get("recs") === false) {
        sec.hidden = true;
        sec.textContent = "";
        return;
      }
      var recent = N.recent
        .list()
        .filter(function (r) {
          return r.k === "game";
        })
        .map(function (r) {
          return N.catalog.find("game", r.id);
        })
        .filter(Boolean);
      if (!recent.length) {
        sec.hidden = true;
        sec.textContent = "";
        return;
      }
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
      sec.hidden = false;
      sec.textContent = "";
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
    }

    /* ---------- marathon mode (games page controls) ---------- */
    var mSel = d.qs("#marathonSel");
    var mWrap = d.qs("#marathonWrap");
    var mCustom = d.qs("#marathonCustom");
    var mCount = d.qs("#marathonCount");
    var mStop = d.qs("#btnMarathonStop");
    var mTimer = null;

    function fmtClock(s) {
      var m = Math.floor(s / 60);
      var r = Math.floor(s % 60);
      return m + ":" + (r < 10 ? "0" : "") + r;
    }
    function marPaint() {
      if (!mWrap) return;
      var min = parseInt(N.prefs.get("marathonMin"), 10) || 0;
      mWrap.hidden = !min;
      if (!mSel) return;
      /* sync the select to the armed state; never fight the user while
         they're mid-way through picking "Custom minutes…" */
      if (min > 0) {
        var want = min >= 2 && min <= 5 ? String(min) : "custom";
        if (mSel.value !== want) {
          mSel.value = want;
          N.dom.selSync(mSel);
        }
      }
      var showingCustom = mSel.value === "custom";
      if (mCustom) {
        mCustom.style.display = showingCustom ? "" : "none";
        if (showingCustom && !mCustom.value && min > 0) mCustom.value = String(min);
      }
    }
    function marTick() {
      if (!mCount) return;
      if (!document.body.contains(mCount)) {
        clearInterval(mTimer);
        return;
      }
      var min = parseInt(N.prefs.get("marathonMin"), 10) || 0;
      if (!min) {
        mCount.textContent = "-";
        return;
      }
      var left = Math.max(0, Math.ceil((parseInt(N.prefs.get("marathonAt"), 10) || 0) - Date.now()) / 1000);
      mCount.textContent = fmtClock(left);
    }
    function marArm(min) {
      N.prefs.set("marathonMin", min);
      N.prefs.set("marathonAt", min ? Date.now() + min * 60000 : 0);
      marPaint();
      d.toast(min ? "Marathon on: next switch in " + min + " min" : "Marathon off", {
        icon: min ? "clock2" : "x",
      });
    }
    /* turning marathon on asks first: Cancel keeps it off */
    function marathonConfirm(min) {
      N.modal.open({
        title: "Marathon mode",
        icon: "clock2",
        body:
          "<p><b>Marathon mode</b> auto-launches a random game every " +
          min +
          " minute" +
          (min === 1 ? "" : "s") +
          ", anywhere on NULL, even while you’re in the middle of something.</p>" +
          "<p>Stop it anytime from the games toolbar or in Settings.</p>",
        actions: [
          { label: "Cancel", variant: "outline", onClick: function () { marArm(0); } },
          { label: "Okay, proceed", variant: "primary", onClick: function () { marArm(min); } },
        ],
      });
    }
    function marTurnOn(min) {
      /* already running? just change the interval: no need to ask again */
      if (parseInt(N.prefs.get("marathonMin"), 10) > 0) marArm(min);
      else marathonConfirm(min);
    }
    function bindMarathon() {
      if (!mSel) return;
      /* the settings toggle can disable the feature entirely */
      if (N.prefs.get("marathon") === false) {
        var selWrap = d.qs("#marathonSelWrap");
        if (selWrap) selWrap.hidden = true;
        if (mWrap) mWrap.hidden = true;
        return;
      }
      N.dom.upgradeSelect(mSel);
      mSel.addEventListener("change", function () {
        var v = mSel.value;
        if (v === "0") {
          marArm(0);
          return;
        }
        if (v === "custom") {
          marPaint();
          if (mCustom) mCustom.focus();
          return;
        }
        marTurnOn(parseInt(v, 10));
      });
      if (mCustom) {
        mCustom.addEventListener("change", function () {
          var n = parseInt(mCustom.value, 10);
          if (n > 0 && mSel && mSel.value === "custom") marTurnOn(n);
        });
        mCustom.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            var n = parseInt(mCustom.value, 10);
            if (n > 0) marTurnOn(n);
          }
        });
      }
      if (mStop) {
        mStop.addEventListener("click", function () {
          marArm(0);
        });
      }
      marPaint();
      mTimer = setInterval(marTick, 1000);
      marTick();
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
        }, label + (extra ? " · " + extra : ""));
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

    /* sort dropdown (custom-styled via dom.upgradeSelect) */
    var sortSel = d.qs("#sortSel");
    if (sortSel) {
      N.dom.upgradeSelect(sortSel);
      sortSel.addEventListener("change", function () {
        sortMode = sortSel.value || "name";
        paint();
      });
    }

    buildChips();
    renderFavs();
    renderRecs();
    bindMarathon();
    N.bus.on("favs", function () {
      renderFavs();
      paint();
    });
    N.bus.on("recent", renderRecs);

    /* the dev console can push placeholder entries into the catalog while a
       page is open: rebuild the list, chips and grid when it does */
    N.bus.on("catalog", function () {
      list = kind === "apps" ? N.catalog.apps() : kind === "proxies" ? N.catalog.proxies() : N.catalog.games();
      if (rowHost) buildChips();
      renderFavs();
      renderRecs();
      paint();
    });

    if (!listMode) {
      gridApi = N.cards.vgrid(grid, {
        items: filtered(),
        cardH: CARD_H[kind],
        minW: 168,
        gap: 18,
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
