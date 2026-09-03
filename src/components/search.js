/* NULL — search.js
   Global search: games, apps, proxies, announcements and site pages.
   Opens as a frosted overlay from anywhere; results reuse NULL cards/rows. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;
  var C = window.NULL_CONTENT || { announcements: [], pages: [] };

  function buildIndex() {
    var idx = [];
    N.catalog.games().forEach(function (g) {
      idx.push({
        kind: "game",
        icon: "game",
        title: g.name,
        sub: "Game" + (g.labels && g.labels.length ? " \u00b7 " + g.labels.slice(0, 3).join(" ") : ""),
        hay: (g.name + " " + g.desc + " " + (g.labels || []).join(" ") + " game play").toLowerCase(),
        run: function () {
          N.launch.game(g);
        },
        thumb: N.catalog.thumb("game", g),
      });
    });
    N.catalog.apps().forEach(function (a) {
      idx.push({
        kind: "app",
        icon: "grid",
        title: a.name,
        sub: "App",
        hay: (a.name + " " + a.desc + " " + (a.labels || []).join(" ") + " app tool").toLowerCase(),
        run: function () {
          N.launch.app(a);
        },
        thumb: N.catalog.thumb("app", a),
      });
    });
    N.catalog.proxies().forEach(function (p) {
      idx.push({
        kind: "proxy",
        icon: "proxy",
        title: p.name,
        sub: "Proxy \u00b7 " + (p.status || "external"),
        hay: (p.name + " " + p.desc + " " + p.url + " proxy link external").toLowerCase(),
        run: function () {
          N.launch.proxy(p);
        },
        thumb: N.catalog.thumb("proxy", p),
      });
    });
    (C.pages || []).forEach(function (pg) {
      idx.push({
        kind: "page",
        icon: "list",
        title: pg.title,
        sub: "Page",
        hay: (pg.title + " " + pg.desc + " " + pg.kw + " " + pg.grp).toLowerCase(),
        run: function () {
          location.href = pg.url;
        },
      });
    });
    (C.announcements || []).forEach(function (a) {
      idx.push({
        kind: "announcement",
        icon: "ann",
        title: a.title,
        sub: "Announcement \u00b7 " + d0(a.date),
        hay: (a.title + " " + a.desc + " " + a.category + " announcement news").toLowerCase(),
        run: function () {
          location.href = "/announcements.html";
        },
      });
    });
    return idx;
  }

  function d0(s) {
    try {
      return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch (e) {
      return s;
    }
  }

  function search(q, idx) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var tokens = q.split(/\s+/);
    var out = [];
    idx.forEach(function (it) {
      if (!tokens.every(function (t) {
          return it.hay.indexOf(t) >= 0;
        })) return;
      var rank = it.title.toLowerCase().indexOf(q) === 0 ? 0 : it.title.toLowerCase().indexOf(q) >= 0 ? 1 : 2;
      out.push({ it: it, rank: rank });
    });
    out.sort(function (a, b) {
      return a.rank - b.rank || a.it.title.length - b.it.title.length;
    });
    return out;
  }

  var GROUP = {
    game: "Games",
    app: "Apps",
    proxy: "Proxies",
    page: "Pages",
    announcement: "Announcements",
  };

  function open(initial) {
    var idx = buildIndex();
    var sel = 0;
    var rows = [];

    var input = d.h("input", {
      type: "text",
      placeholder: "Search games, apps, proxies, pages\u2026",
      value: initial || "",
      "aria-label": "Search NULL",
    });
    var inputRow = d.h("div", { class: "search-input" }, [
      d.icon("search"),
      input,
      d.h("span", { class: "kbd" }, "esc"),
    ]);

    var results = d.h("div", { class: "search-results", role: "listbox" });
    var panel = d.h("div", { class: "search-panel glass-2 elev" }, [inputRow, results]);
    var ov = d.h("div", { class: "search-ov" }, [panel]);

    function clear() {
      rows.forEach(function (r) {
        r.el.classList.remove("sel");
      });
      rows = [];
      sel = 0;
    }

    function render(q) {
      results.textContent = "";
      clear();
      var hits = search(q, idx);
      if (!q) {
        /* suggestions when empty */
        results.appendChild(d.h("div", { class: "sr-group" }, "Jump to"));
        [
          { t: "Home", u: "/", i: "home" },
          { t: "Games", u: "/games.html", i: "game" },
          { t: "Apps", u: "/apps.html", i: "grid" },
          { t: "Schedule", u: "/schedule.html", i: "sched" },
          { t: "Settings", u: "/settings.html", i: "settings" },
        ].forEach(function (s) {
          var el = rowEl({ title: s.t, sub: s.u, icon: s.i, run: function () { location.href = s.u; } });
          results.appendChild(el);
          rows.push(el);
        });
        return;
      }
      if (!hits.length) {
        results.appendChild(d.h("div", { class: "sr-none" }, [
          "Nothing matches \u201c" + q + "\u201d \u2014 try \u201cgames\u201d, \u201cpulse\u201d or \u201cschedule\u201d.",
        ]));
        return;
      }
      var byGroup = {};
      hits.slice(0, 36).forEach(function (h) {
        var k = h.it.kind;
        (byGroup[k] = byGroup[k] || []).push(h);
      });
      Object.keys(byGroup).forEach(function (k) {
        var head = d.h("div", { class: "sr-group" }, GROUP[k] || k);
        results.appendChild(head);
        byGroup[k].slice(0, 6).forEach(function (h) {
          var el = rowEl(h.it);
          results.appendChild(el);
          rows.push(el);
        });
      });
    }

    function rowEl(it) {
      var ic;
      if (it.thumb) {
        var im = d.h("img", { src: it.thumb, alt: "" });
        d.bindImgFallback(im, it.kind === "proxy" ? "proxy" : it.kind);
        ic = d.h("div", { class: "sr-ic" }, [im]);
      } else {
        ic = d.h("div", { class: "sr-ic" }, [d.icon(it.icon || "list")]);
      }
      var el = d.h("button", {
        type: "button",
        class: "sr-row",
        role: "option",
        onclick: function () {
          finish(it);
        },
      }, [
        ic,
        d.h("span", { class: "sr-txt" }, [
          d.h("b", null, it.title),
          d.h("span", null, it.sub || ""),
        ]),
        d.h("span", { class: "chip" }, GROUP[it.kind] || it.kind),
      ]);
      el._it = it;
      return el;
    }

    function finish(it) {
      close();
      it.run();
    }

    function move(dir) {
      if (!rows.length) return;
      if (rows[sel]) rows[sel].el.classList.remove("sel");
      sel = (sel + dir + rows.length) % rows.length;
      rows[sel].el.classList.add("sel");
      rows[sel].el.scrollIntoView({ block: "nearest" });
    }

    function onKey(e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (rows[sel]) finish(rows[sel].el._it);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    input.addEventListener("keydown", onKey);
    input.addEventListener("input", d.debounce(function () {
      render(input.value);
    }, 70));

    function close() {
      ov.classList.remove("open");
      setTimeout(function () {
        ov.remove();
        document.body.style.overflow = "";
      }, 180);
    }
    ov.addEventListener("mousedown", function (e) {
      if (e.target === ov) close();
    });

    document.body.appendChild(ov);
    requestAnimationFrame(function () {
      ov.classList.add("open");
      document.body.style.overflow = "hidden";
      input.focus();
    });
    render(initial || "");
  }

  N.search = { open: open };
})();
