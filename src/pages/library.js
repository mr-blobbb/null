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

    /* ---------- filters as a sidebar or a top row ----------
       Ultrawide screens get the labels down the left as a sidebar; anything
       narrower gets the chip row in the toolbar, and Settings can force
       either one (prefs "libNav": auto | rail | bar). The chips are the same
       nodes in both cases: this only re-parents them, so buildChips() and
       everything that follows stays as it was. */
    var rail = d.qs("#libRail");
    var railBody = d.qs("#libRailBody");
    var libBody = d.qs(".lib-body");
    var wide = window.matchMedia ? window.matchMedia("(min-width: 1600px)") : null;

    function railWanted() {
      var pref = N.prefs.get("libNav");
      if (pref === "rail") return true;
      if (pref === "bar") return false;
      return !!(wide && wide.matches);
    }

    function layout() {
      var on = railWanted() && !!rail && !!railBody && !!libBody;
      document.documentElement.dataset.libMode = on ? "rail" : "bar";
      if (!libBody) return;
      if (on) {
        if (rowHost.parentNode !== railBody) railBody.appendChild(rowHost);
      } else if (rowHost.parentNode !== libBody) {
        libBody.insertBefore(rowHost, libBody.firstChild);
      }
    }

    /* ---------- pinned toolbar ----------
       The library scrolls inside #scrollview, not the window, and a plain
       position:sticky bar landed a fixed distance below the nav there (the
       scroller's own top edge plus the nav's height) instead of flush under
       it. So the bar is pinned by measurement instead: a spacer holds its
       place in the flow, and the moment that spacer reaches the nav's real
       bottom edge the bar goes fixed exactly there, spanning the scroller.
       It releases again as soon as you scroll back to the top, and follows a
       nav that changes height (an extension widget mounting, a resize). */
    var bar = d.qs(".toolbar");
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

    /* reset chip: one click back to the unfiltered view. Hidden until a
       filter or a search is actually doing something. */
    var resetBtn = d.h("button", {
      type: "button",
      class: "btn btn-outline btn-sm",
      hidden: true,
      onclick: function () {
        activeLabel = "All";
        query = "";
        if (input) input.value = "";
        buildChips();
        paint();
        if (input) input.focus();
      },
    }, [d.icon("x"), "Reset"]);
    if (rowHost && resetBtn) rowHost.appendChild(resetBtn);

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
      if (resetBtn) resetBtn.hidden = activeLabel === "All" && !query.trim();
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
      var btn = d.qs("#btnMarathon");
      var box = d.qs("#marathonBox");
      var btnWrap = d.qs("#btnMarathonWrap");
      /* the settings toggle can disable the feature entirely */
      if (N.prefs.get("marathon") === false) {
        if (btnWrap) btnWrap.hidden = true;
        if (mWrap) mWrap.hidden = true;
        return;
      }
      /* marathon folds into a small popover so the toolbar stays one row */
      function setBox(open) {
        if (box) box.hidden = !open;
        if (btn) btn.setAttribute("aria-expanded", String(open));
        if (open && mSel) N.dom.selSync(mSel);
      }
      if (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          setBox(box && box.hidden);
        });
      }
      document.addEventListener("click", function (e) {
        if (!box || box.hidden) return;
        if (box.contains(e.target) || (btn && btn.contains(e.target))) return;
        setBox(false);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && box && !box.hidden) setBox(false);
      });
      if (!mSel) return;
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
      /* label on the left, count on the right: reads as a list in the rail
         and as a normal chip in the top row */
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
            buildChips();
            paint();
          },
        }, kids);
      }
      /* the reset chip lives at the end: insert before it so it stays last */
      rowHost.textContent = "";
      rowHost.appendChild(resetBtn);
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

    layout();
    buildChips();
    renderFavs();
    renderRecs();
    bindMarathon();
    if (wide && wide.addEventListener) wide.addEventListener("change", layout);
    N.bus.on("sync", layout); /* Settings changed the layout in another tab */
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
