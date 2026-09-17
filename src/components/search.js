/* NULL: search.js
   Global search: games, apps, proxies, announcements and site pages.
   Matching is fuzzy: typos up to a couple of edits on titles still hit,
   word prefixes rank highest, and matches inside descriptions/labels
   count too. Page bodies (About, Privacy, Terms, …) are fetched lazily
   and indexed, so searches can find text written inside those pages. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;
  var C = window.NULL_CONTENT || { announcements: [], pages: [] };

  /* ---------- fuzzy matching helpers ---------- */
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ");
  }

  /* Levenshtein with an early bail: returns max+1 when over the limit */
  function editDist(a, b, max) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    if (!a.length || !b.length) return Math.max(a.length, b.length);
    var prev = new Array(b.length + 1);
    var cur = new Array(b.length + 1);
    for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      var t = prev;
      prev = cur;
      cur = t;
    }
    var dist = prev[b.length];
    return dist > max ? max + 1 : dist;
  }

  /* best score for one token against one (pre-normalized) haystack string */
  function tokScore(tok, s) {
    if (!tok || !s) return 0;
    if (s === tok) return 120;
    if (s.indexOf(tok) === 0) return 108;
    var words = s.split(" ");
    var best = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (!w) continue;
      if (w === tok) return 100;
      if (w.indexOf(tok) === 0) {
        best = Math.max(best, 92);
        continue;
      }
      if (tok.length >= 3 && w.length >= tok.length) {
        var lim = tok.length >= 5 ? 2 : 1;
        if (editDist(tok, w, lim) <= lim) {
          best = Math.max(best, 70);
          continue;
        }
      }
    }
    if (best) return best;
    if (s.indexOf(tok) >= 0) return 62;
    if (tok.length >= 4 && editDist(tok, s, 2) <= 2) return 50;
    if (tok.length >= 6 && editDist(tok, s, 3) <= 3) return 42;
    return 0;
  }

  /* every token must land somewhere; scores add up.
     Fields are pre-normalized once per item (see buildIndex) so the
     hot path never re-regexes the big haystacks. */
  function scoreItem(it, toks) {
    var total = 0;
    for (var i = 0; i < toks.length; i++) {
      var best = tokScore(toks[i], it._t);
      var h = Math.floor(tokScore(toks[i], it._h) * 0.55);
      var b = Math.floor(tokScore(toks[i], it._x) * 0.45);
      if (h > best) best = h;
      if (b > best) best = b;
      if (!best) return 0;
      total += best;
    }
    return total;
  }

  /* ---------- page bodies: fetched once, cached, indexed lazily ---------- */
  var pageText = {}; // url -> text | null (null = failed)
  var live = null; // open overlay: { input, render, rebuild }

  function stripHtml(html) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function fetchPageText(pg) {
    if (pageText[pg.url] !== undefined) return;
    pageText[pg.url] = null;
    /* the site path, so a page reads itself back from the folder NULL is
       actually served from */
    var src = N.url(pg.url);
    function got(html) {
      pageText[pg.url] = stripHtml(html);
      if (live) live.rebuild();
    }
    function miss() {
      /* clean urls: a static host only serves the .html file, and the
         library pages live at games/index.html, apps/index.html… */
      var base = src.replace(/\/+$/, "");
      var alts = [base + ".html", base + "/index.html"];
      var i = 0;
      (function tryAlt() {
        if (i >= alts.length) {
          pageText[pg.url] = null;
          return;
        }
        fetch(alts[i++])
          .then(function (r) {
            return r.ok ? r.text() : Promise.reject();
          })
          .then(got)
          .catch(tryAlt);
      })();
    }
    fetch(src)
      .then(function (r) {
        return r.ok ? r.text() : Promise.reject();
      })
      .then(got)
      .catch(miss);
  }

  /* ---------- index ---------- */
  function buildIndex() {
    var idx = [];
    N.catalog.games().forEach(function (g) {
      var raw = g.name + " " + g.desc + " " + (g.labels || []).join(" ") + " game play";
      idx.push({
        kind: "game",
        icon: "game",
        title: g.name,
        _t: norm(g.name),
        _h: norm(raw),
        _x: "",
        run: function () {
          N.launch.game(g);
        },
        thumb: N.catalog.thumb("game", g),
      });
    });
    N.catalog.apps().forEach(function (a) {
      var raw = a.name + " " + a.desc + " " + (a.labels || []).join(" ") + " app tool";
      idx.push({
        kind: "app",
        icon: "grid",
        title: a.name,
        _t: norm(a.name),
        _h: norm(raw),
        _x: "",
        run: function () {
          N.launch.app(a);
        },
        thumb: N.catalog.thumb("app", a),
      });
    });
    N.catalog.proxies().forEach(function (p) {
      var raw = p.name + " " + p.desc + " " + p.url + " proxy link external";
      idx.push({
        kind: "proxy",
        icon: "proxy",
        title: p.name,
        _t: norm(p.name),
        _h: norm(raw),
        _x: "",
        run: function () {
          N.launch.proxy(p);
        },
        thumb: N.catalog.thumb("proxy", p),
      });
    });
    (C.pages || []).forEach(function (pg) {
      var raw = pg.title + " " + pg.desc + " " + pg.kw + " " + pg.grp;
      idx.push({
        kind: pg.kind || "page",
        icon: pg.icon || "list",
        title: pg.title,
        _t: norm(pg.title),
        _h: norm(raw),
        _x: norm(pageText[pg.url] || ""),
        run: function () {
          location.href = N.url(pg.url);
        },
      });
      /* the hidden pages skip body indexing: their text is the joke, and
         blob's wall of lines would match half the site's vocabulary */
      if (pg.body !== false) fetchPageText(pg);
    });
    (C.announcements || []).forEach(function (a) {
      var raw = a.title + " " + a.desc + " " + a.category + " announcement news";
      idx.push({
        kind: "announcement",
        icon: "ann",
        title: a.title,
        _t: norm(a.title),
        _h: norm(raw),
        _x: "",
        run: function () {
          location.href = N.url(a.link || "/changelog");
        },
      });
    });
    return idx;
  }

  function search(q, idx) {
    var toks = norm(q)
      .split(/\s+/)
      .filter(Boolean);
    if (!toks.length) return [];
    var out = [];
    idx.forEach(function (it) {
      var score = scoreItem(it, toks);
      if (score) out.push({ it: it, score: score });
    });
    out.sort(function (a, b) {
      return b.score - a.score || a.it.title.length - b.it.title.length;
    });
    return out;
  }

  var GROUP = {
    game: "Games",
    app: "Apps",
    proxy: "Proxies",
    page: "Pages",
    egg: "Hidden",
    announcement: "Announcements",
  };

  function open(initial) {
    var idx = buildIndex();
    var sel = 0;
    var rows = [];
    if (N.ext) N.ext.emit("search:open", { index: idx.length });

    var input = d.h("input", {
      type: "text",
      placeholder: "Search games, apps, proxies, pages…",
      value: initial || "",
      "aria-label": "Search NULL",
      spellcheck: "false",
      autocomplete: "off",
    });
    var closeBtn = d.h("button", { type: "button", class: "kbd kbd-x", title: "Close", "aria-label": "Close search" }, "esc");
    var inputRow = d.h("div", { class: "search-input" }, [d.icon("search", "si"), input, closeBtn]);

    /* One line of plain text tabs per kind that actually turned up. Filtering
       happens on the hits we already have, so it is instant and never costs
       another pass over the index. */
    var filters = d.h("div", { class: "sp-tabs" });
    var results = d.h("div", { class: "search-results", role: "listbox" });
    var count = d.h("span", { class: "sp-count" });
    var foot = d.h("div", { class: "sp-foot" }, [
      d.h("span", { class: "sp-hint" }, [d.h("span", { class: "kbd" }, "↑"), d.h("span", { class: "kbd" }, "↓"), "move"]),
      d.h("span", { class: "sp-hint" }, [d.h("span", { class: "kbd" }, "↵"), "open"]),
      count,
    ]);
    var panel = d.h("div", { class: "search-panel" }, [inputRow, filters, results, foot]);
    var ov = d.h("div", { class: "search-ov" }, [panel]);
    /* null = everything. Set by the shelf row, cleared by a query change. */
    var kind = null;
    var lastQ = null;

    function clear() {
      rows.forEach(function (r) {
        r.el.classList.remove("sel");
      });
      rows = [];
      sel = 0;
    }

    function tab(label, k, n) {
      return d.h(
        "button",
        {
          type: "button",
          class: "sp-tab" + (kind === k ? " on" : ""),
          onclick: function () {
            kind = k;
            render(lastQ || "", true);
          },
        },
        [d.h("span", null, label), n == null ? null : d.h("i", null, String(n))],
      );
    }

    function paintFilters(hits) {
      filters.textContent = "";
      var seen = {};
      var order = [];
      hits.forEach(function (h) {
        var k = h.it.kind;
        if (!seen[k]) {
          seen[k] = 0;
          order.push(k);
        }
        seen[k]++;
      });
      if (order.length < 2) {
        filters.hidden = true;
        return;
      }
      filters.hidden = false;
      filters.appendChild(tab("All", null, hits.length));
      order.forEach(function (k) {
        filters.appendChild(tab(GROUP[k] || k, k, seen[k]));
      });
    }

    function render(q, keepKind) {
      results.textContent = "";
      clear();
      if (!keepKind) kind = null;
      if (q !== lastQ) lastQ = q;
      var hits = search(q, idx);
      if (N.ext) N.ext.emit("search:query", { q: q, n: hits.length });
      paintFilters(hits);
      count.textContent = q
        ? (kind ? hits.filter(function (h) { return h.it.kind === kind; }).length : hits.length) +
          " for “" + q + "”"
        : idx.length + " things indexed";
      if (!q) {
        /* suggestions when empty */
        results.appendChild(d.h("div", { class: "sr-group" }, "Jump to"));
        [
          { t: "Home", u: N.url("/"), i: "home" },
          { t: "Games", u: N.url("/games/"), i: "games" },
          { t: "Apps", u: N.url("/apps/"), i: "apps" },
          { t: "Proxies", u: N.url("/proxies/"), i: "globe" },
          { t: "Shop", u: N.url("/shop"), i: "bag" },
          { t: "Profile", u: N.url("/profile"), i: "person" },
          { t: "Changelog", u: N.url("/changelog"), i: "scroll" },
          { t: "Extensions", u: N.url("/extensions"), i: "puzzle" },
          { t: "Settings", u: N.url("/settings"), i: "sliders" },
        ].forEach(function (s) {
          var it = {
            kind: "page",
            title: s.t,
            sub: s.u.replace(N.base, "/"),
            icon: s.i,
            run: function () {
              location.href = s.u;
            },
          };
          var el = rowEl(it);
          results.appendChild(el);
          rows.push({ el: el, _it: it });
        });
        return;
      }
      if (!hits.length) {
        results.appendChild(d.h("div", { class: "sr-none" }, [
          "Nothing matches “" + q + "”, but you got to see this funny guy: •𐃷•",
        ]));
        return;
      }
      var picked = kind
        ? hits.filter(function (h) {
            return h.it.kind === kind;
          })
        : hits;
      var byGroup = {};
      var order = [];
      picked.slice(0, 48).forEach(function (h) {
        var k = h.it.kind;
        if (!byGroup[k]) {
          byGroup[k] = [];
          order.push(k);
        }
        byGroup[k].push(h);
      });
      order.forEach(function (k) {
        var head = d.h("div", { class: "sr-group" }, [
          GROUP[k] || k,
          d.h("i", null, String(byGroup[k].length)),
        ]);
        results.appendChild(head);
        byGroup[k].slice(0, kind ? 24 : 6).forEach(function (h) {
          var el = rowEl(h.it);
          results.appendChild(el);
          rows.push({ el: el, _it: h.it });
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
        d.h("span", { class: "sr-kind" }, GROUP[it.kind] || it.kind),
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
        if (rows[sel]) finish(rows[sel]._it);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }      input.addEventListener("keydown", onKey);
    input.addEventListener("input", d.debounce(function () {
      render(input.value);
    }, 70));

    function close() {
      if (live && live.ov === ov) live = null;
      ov.classList.remove("open");
      setTimeout(function () {
        ov.remove();
        document.body.style.overflow = "";
      }, 180);
    }
    ov.addEventListener("mousedown", function (e) {
      if (e.target === ov) close();
    });
    closeBtn.addEventListener("click", close);

    /* the active overlay: page-body fetches rebuild its index live */
    live = {
      ov: ov,
      input: input,
      render: render,
      rebuild: function () {
        if (!ov.isConnected) return;
        idx = buildIndex();
        render(input.value, true);
      },
    };

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