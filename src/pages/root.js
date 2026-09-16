/* NULL · root.js
   /root: the map.

   Nothing here is written down ahead of time. Every branch is read off the
   live objects, so the page cannot go stale, and anything an extension adds
   (a page, a system, a hook, a storage key) turns up in it the moment it is
   installed. That is the whole point: it is a view of the running site, not a
   documentation page pretending to be one. */
(function () {
  var N = window.N;
  var d = N.dom;

  var body = d.qs("#rootBody");
  var bar = d.qs("#rootBar");
  var branches = [];

  function size(str) {
    var n = String(str || "").length;
    if (n < 1024) return n + " B";
    return (n / 1024).toFixed(1) + " KB";
  }

  /* a row: label, value, and optionally a tone for the value */
  function row(label, value, tone) {
    return d.h("li", null, [d.h("b", null, label), d.h("i", { class: tone || "" }, String(value))]);
  }

  function branch(icon, title, note, rows) {
    var el = d.h("details", { class: "root-branch" });
    el.appendChild(
      d.h("summary", null, [
        d.icon(icon),
        d.h("b", null, title),
        d.h("span", null, note ? "· " + note : ""),
        d.h("span", { class: "dc-n" }, rows.length + ""),
      ]),
    );
    var list = d.h("ul", { class: "root-list" });
    rows.forEach(function (r) {
      list.appendChild(r);
    });
    el.appendChild(list);
    branches.push({ el: el, rows: rows });
    return el;
  }

  function count(obj) {
    if (Array.isArray(obj)) return obj.length + " entries";
    if (obj && typeof obj === "object") return Object.keys(obj).length + " keys";
    return typeof obj;
  }

  /* ---------- systems ---------- */
  function systems() {
    var names = Object.keys(window.N).sort();
    var rows = names.map(function (k) {
      var v = window.N[k];
      var kind = v === null ? "null" : typeof v;
      return row(k, kind === "object" || kind === "function" ? kind + " · " + count(v) : String(v));
    });
    return { icon: "grid", title: "Systems", note: "everything hanging off N", rows: rows };
  }

  /* ---------- pages ---------- */
  function pages() {
    var rows = [];
    N.router.PRIMARY.forEach(function (l) {
      rows.push(row(l.id, l.url + " · icon " + l.icon + (N.router.isActive(l.url) ? " · you are here" : ""), N.router.isActive(l.url) ? "ok" : ""));
    });
    N.router.GROUPS.forEach(function (g) {
      g.links.forEach(function (l) {
        rows.push(row(g.name, l.t + " → " + l.url));
      });
    });
    N.router.FOOT.forEach(function (g) {
      g.links.forEach(function (l) {
        rows.push(row("footer: " + g.name, l.t + " → " + l.url));
      });
    });
    EGGS.forEach(function (e) {
      rows.push(row("hidden", e.path + " · " + e.how));
    });
    var extPages = N.ext && N.ext.pages ? N.ext.pages() : [];
    if (extPages.length) {
      extPages.forEach(function (p) {
        rows.push(row("extension page", p.title + " · from " + p.ext, "ok"));
      });
    }
    return { icon: "list", title: "Pages", note: "nav, footer, hidden, extension views", rows: rows };
  }

  var EGGS = [
    { path: "/void", how: "hold backspace: the page erases line by line" },
    { path: "/blob", how: "during period four, the little face in the corner: click twice" },
    { path: "/time", how: "type the time frame (am/pm), or the midnight modal" },
    { path: "/credits", how: "buy out the shop, then it redirects itself" },
    { path: "/root", how: "this page: type the address, or the dev console" },
  ];

  /* ---------- look ---------- */
  function look() {
    var rows = [];
    N.prefs.data &&
      ["theme", "accent", "particles", "glow", "density", "perf", "miniPerf", "retexture", "labs", "seasonVariant"].forEach(function (k) {
        var v = N.prefs.get(k);
        rows.push(row("pref · " + k, v === undefined || v === "" || v === false || v === null ? "(off)" : String(v)));
      });
    rows.push(row("theme packs", (N.theme.allPacks ? N.theme.allPacks() : []).map(function (p) {
      return p.name || p.id;
    }).join(", ") || "none"));
    rows.push(row("particle sets", (N.theme.allParticles ? N.theme.allParticles() : []).map(function (p) {
      return p.name || p.id;
    }).join(", ") || "none"));
    rows.push(row("accents", (N.theme.ACCENTS || []).map(function (a) {
      return a.name || a.id;
    }).join(", ")));
    rows.push(row("glows", (N.theme.GLOWS || []).map(function (g) {
      return g.name || g.id;
    }).join(", ")));
    rows.push(row("backdrop art", (N.theme.ART || []).map(function (a) {
      return a.id;
    }).join(", ")));
    rows.push(row("drifting parts", (N.theme.PF_KINDS || []).join(", ")));
    rows.push(row("ambient particles", (N.theme.PT_KINDS || []).join(", ")));
    if (N.seasons) {
      rows.push(row("season now", (N.seasons.now() || {}).id || "none"));
      rows.push(row("season themes", (N.seasons.all() || []).map(function (s) {
        return s.id;
      }).join(", ")));
    }
    if (N.tab && N.tab.list) {
      rows.push(row("tab presets", N.tab.list.map(function (p) {
        return p.id;
      }).join(", ")));
    }
    if (N.gen) rows.push(row("generator schemes", N.gen.SCHEMES.join(", ")));
    return { icon: "eye", title: "Look", note: "themes, particles, seasons", rows: rows };
  }

  /* ---------- economy ---------- */
  function economy() {
    var rows = [];
    var eco = N.econ.state();
    Object.keys(eco).forEach(function (k) {
      var v = eco[k];
      rows.push(row("eco · " + k, Array.isArray(v) ? v.length + " entries" : String(v)));
    });
    rows.push(row("shop themes", N.econ.THEMES.length + " · " + N.econ.THEMES.map(function (t) {
      return t.id || t;
    }).join(", ")));
    rows.push(row("free themes", N.econ.FREE_PACKS.map(function (t) {
      return t.id || t;
    }).join(", ") || "none"));
    rows.push(row("particle items", String(N.econ.PARTICLES.length)));
    rows.push(row("boosts", N.econ.BOOSTS.map(function (b) {
      return b.id || b;
    }).join(", ") || "none"));
    rows.push(row("fx unlocks", N.econ.FX.map(function (f) {
      return f.id || f;
    }).join(", ") || "none"));
    var quests = [];
    try {
      quests = N.econ.state().questsReady;
    } catch (err) {}
    rows.push(row("quests ready to claim", quests.length ? quests.length + "" : "none"));
    return { icon: "coin", title: "Economy", note: "coins, XP, unlocks", rows: rows };
  }

  /* ---------- extensions ---------- */
  function exts() {
    var rows = [];
    var s = N.ext.summary();
    rows.push(row("installed", s.total + " · " + s.enabled + " on"));
    rows.push(row("native (.nullext)", String(s.native)));
    rows.push(row("chrome popups", String(s.chrome)));
    rows.push(row("extension pages", String(s.pages)));
    N.ext.list().forEach(function (e) {
      rows.push(
        row(
          e.id,
          e.kind + " · v" + (e.version || "?") + " · " + (e.enabled === false ? "off" : "on") + " · " + size(JSON.stringify(N.ext.data(e.id) || {})),
          e.enabled === false ? "off" : "ok",
        ),
      );
    });
    rows.push(row("hooks in use", N.ext.hookNames().join(", ") || "none"));
    N.ext.EVENTS.forEach(function (e) {
      var parts = e.split(/\s{2,}/);
      rows.push(row("event · " + parts[0], parts.slice(1).join(" ")));
    });
    return { icon: "puzzle", title: "Extensions", note: "native and popup", rows: rows };
  }

  /* ---------- storage ---------- */
  function storage() {
    var rows = [];
    var total = 0;
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        var v = localStorage.getItem(k) || "";
        total += k.length + v.length;
        keys.push([k, v]);
      }
    } catch (err) {}
    keys.sort(function (a, b) {
      return b[1].length - a[1].length;
    });
    keys.forEach(function (pair) {
      rows.push(row(pair[0], size(pair[1]) + (pair[1].length > 4000 ? " · big" : ""), pair[0].indexOf("null:ext") === 0 ? "ok" : ""));
    });
    rows.push(row("total", size("x".repeat(total)) + " across " + keys.length + " keys"));
    return { icon: "save", title: "Storage", note: "what this browser is keeping", rows: rows };
  }

  /* ---------- catalog ---------- */
  function catalog() {
    var rows = [];
    rows.push(row("games", String(N.catalog.games().length)));
    rows.push(row("apps", String(N.catalog.apps().length)));
    rows.push(row("proxies", String(N.catalog.proxies().length)));
    rows.push(row("favorites", String(N.favs.list().length)));
    rows.push(row("recent", String(N.recent.list().length)));
    /* N.plays keeps per-item counters, not a list: count the keys instead */
    rows.push(row("plays tracked", Object.keys(N.store.read("null:plays", {}) || {}).length + " items have a count"));
    rows.push(row("catalog tool", "scripts/build-catalog.js · admin at /extensions is separate"));
    rows.push(row("search index", (N.catalog.games().length + N.catalog.apps().length + N.catalog.proxies().length) + " entries scanned per query"));
    return { icon: "game", title: "Library", note: "what is in it", rows: rows };
  }

  /* ---------- build ---------- */
  function build() {
    body.textContent = "";
    branches = [];
    [systems(), pages(), look(), economy(), catalog(), exts(), storage()].forEach(function (b) {
      body.appendChild(branch(b.icon, b.title, b.note, b.rows));
    });
    if (branches[0]) branches[0].el.open = true;
    if (branches[1]) branches[1].el.open = true;
    paintBar();
  }

  function paintBar() {
    var total = branches.reduce(function (n, b) {
      return n + b.rows.length;
    }, 0);
    bar.textContent = "";
    var find = d.h("input", { class: "field", type: "text", placeholder: "filter this tree", style: { maxWidth: "260px" } });
    find.addEventListener("input", function () {
      filter(find.value);
    });
    bar.appendChild(find);
    bar.appendChild(
      d.h("button", { type: "button", class: "btn btn-outline btn-sm", onclick: function () { openAll(true); } }, [d.icon("chevD"), "Open all"]),
    );
    bar.appendChild(
      d.h("button", { type: "button", class: "btn btn-outline btn-sm", onclick: function () { openAll(false); } }, [d.icon("chevR"), "Close all"]),
    );
    bar.appendChild(
      d.h(
        "button",
        {
          type: "button",
          class: "btn btn-outline btn-sm",
          onclick: function () {
            var blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" });
            var url = URL.createObjectURL(blob);
            var a = d.h("a", { href: url, download: "null-root.json" });
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () {
              URL.revokeObjectURL(url);
            }, 4000);
            d.toast("Downloaded the map");
          },
        },
        [d.icon("download"), "Copy as JSON"],
      ),
    );
    bar.appendChild(d.h("span", { class: "root-count" }, total + " rows · " + N.catalog.games().length + " games in the catalog"));
  }

  function openAll(open) {
    branches.forEach(function (b) {
      b.el.open = open;
    });
  }

  function filter(q) {
    q = String(q || "").trim().toLowerCase();
    branches.forEach(function (b) {
      var hits = 0;
      b.rows.forEach(function (li) {
        var hit = !q || li.textContent.toLowerCase().indexOf(q) >= 0;
        li.hidden = !hit;
        if (hit) hits++;
      });
      b.el.hidden = q && !hits;
      if (q) b.el.open = !!hits;
    });
  }

  function snapshot() {
    var out = {};
    branches.forEach(function (b) {
      out[b.rows.length ? b.rows[0].parentNode.parentNode.querySelector("summary b").textContent : "?"] = b.rows.map(function (li) {
        return li.textContent;
      });
    });
    return out;
  }

  build();
  N.bus.on("ext", build);
})();
