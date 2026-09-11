/* NULL — tools.js
   The static catalog builder (/tools). The browser cannot list a directory, so
   you paste your content folders; this probes them over HTTP, reads the same
   Label.txt / Warning.txt / meta.txt / proxy.txt the old Node scripts read, and
   hands back the exact source of src/catalog/generated-catalog.js. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;
  var T = N.catalogTool;

  function setStatus(text, tone) {
    var el = d.qs("#toolStatus");
    if (!el) return;
    el.textContent = text || "";
    el.className = "tool-status" + (tone ? " " + tone : "");
  }

  /* ---------- probing ----------
     HEAD first (cheap), GET as a fallback for hosts that dislike HEAD. A miss
     is a 404 on GitHub Pages and on the dev server, which is what we want. */
  function exists(url) {
    return fetch(url, { method: "HEAD", cache: "no-store" })
      .then(function (r) {
        return r.ok;
      })
      .catch(function () {
        return fetch(url, { cache: "no-store" })
          .then(function (r) {
            return r.ok;
          })
          .catch(function () {
            return false;
          });
      });
  }

  function readText(url) {
    return fetch(url, { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.text() : null;
      })
      .catch(function () {
        return null;
      });
  }

  function firstHit(base, names) {
    var i = 0;
    function next() {
      if (i >= names.length) return Promise.resolve(null);
      var name = names[i++];
      return exists(base + name).then(function (hit) {
        return hit ? name : next();
      });
    }
    return next();
  }

  /* one folder → one catalog entry (or null when it has nothing to launch) */
  function scanFolder(item) {
    var base = "/" + item.kind + "/" + item.slug + "/";
    if (item.kind === "proxies") {
      return readText(base + "proxy.txt").then(function (txt) {
        return txt == null ? readText(base + "url.txt") : txt;
      }).then(function (txt) {
        return T.proxyEntry(item.slug, txt);
      });
    }
    return Promise.all([
      firstHit(base, T.htmlCandidates(item.slug)),
      firstHit(base, T.thumbCandidates(item.slug)),
      readText(base + "Label.txt"),
      readText(base + "Warning.txt"),
      readText(base + "meta.txt"),
    ]).then(function (r) {
      if (!r[0]) return null; // no html file → nothing to launch, like the old scanner
      return T.entry(item.kind, item.slug, {
        html: r[0],
        thumb: r[1],
        labels: r[2],
        warning: r[3],
        meta: r[4],
      });
    });
  }

  /* ---------- rendering ---------- */
  function previewRow(kind, e) {
    var media = d.h("div", { class: "tool-thumb" });
    if (e.thumb) media.appendChild(d.h("img", { src: e.thumb, alt: "", loading: "lazy" }));
    else media.appendChild(d.icon(kind === "proxy" ? "proxy" : kind === "app" ? "grid" : "game"));

    var chips = d.h("div", { class: "chips-row" });
    if (kind === "proxy") {
      chips.appendChild(d.h("span", { class: "chip" }, e.status || "No status"));
    } else {
      if (e.hot) chips.appendChild(d.h("span", { class: "chip accent" }, "HOT"));
      if (e.at) chips.appendChild(d.h("span", { class: "chip" }, "Added " + N.dt.fmt(new Date(e.at).toISOString().slice(0, 10))));
      (e.labels || []).slice(0, 4).forEach(function (l) {
        chips.appendChild(d.h("span", { class: "chip" }, l));
      });
      if (e.warning) chips.appendChild(d.h("span", { class: "chip" }, "Warning"));
    }

    return d.h("div", { class: "tool-row" }, [
      media,
      d.h("div", { class: "tool-info" }, [
        d.h("b", null, e.name),
        d.h("span", { class: "tool-path" }, e.file || e.url || e.id),
        chips,
      ]),
      d.h("span", { class: "chip" }, kind),
    ]);
  }

  function paint(cat, skipped) {
    var prev = d.qs("#toolPreview");
    var notes = d.qs("#toolNotes");
    prev.textContent = "";
    notes.textContent = "";

    var groups = [
      { kind: "game", list: cat.games, label: "Games" },
      { kind: "app", list: cat.apps, label: "Apps" },
      { kind: "proxy", list: cat.proxies, label: "Proxies" },
    ];
    groups.forEach(function (g) {
      if (!g.list.length) return;
      prev.appendChild(d.h("div", { class: "tool-group" }, g.label + " \u00b7 " + g.list.length));
      g.list.forEach(function (e) {
        prev.appendChild(previewRow(g.kind, e));
      });
    });

    var total = cat.games.length + cat.apps.length + cat.proxies.length;
    d.qs("#toolCount").textContent =
      total + " entr" + (total === 1 ? "y" : "ies") + " \u00b7 built " + cat.generatedAt.slice(0, 10);

    if (skipped.length) {
      notes.appendChild(d.h("b", null, "Skipped"));
      var ul = d.h("ul", { class: "tool-skipped" });
      skipped.forEach(function (s) {
        ul.appendChild(d.h("li", null, s));
      });
      notes.appendChild(ul);
    }

    d.qs("#toolOutSec").hidden = total === 0;
    d.qs("#toolCodeSec").hidden = total === 0;
    d.qs("#toolCode").value = T.source(cat);
    return total;
  }

  function scan() {
    var raw = d.qs("#toolPaths").value;
    var found = T.folders(raw);
    if (!found.length) {
      setStatus("No games/, apps/ or proxies/ folders found in that list.", "warn");
      return;
    }
    var btn = d.qs("#toolScan");
    btn.disabled = true;
    var cat = { site: "NULL", generatedAt: new Date().toISOString(), games: [], apps: [], proxies: [] };
    var skipped = [];
    var done = 0;

    function step(i) {
      if (i >= found.length) {
        cat.games.sort(byName);
        cat.apps.sort(byName);
        cat.proxies.sort(byName);
        btn.disabled = false;
        var total = paint(cat, skipped);
        var skippedNote = skipped.length ? " \u00b7 " + skipped.length + " skipped" : "";
        setStatus("Scanned " + found.length + " folder" + (found.length === 1 ? "" : "s") + " \u2192 " + total + " entries" + skippedNote + ".", "ok");
        return;
      }
      var it = found[i];
      setStatus("Scanning " + (i + 1) + " / " + found.length + " \u2014 " + it.kind + "/" + it.slug + "\u2026");
      scanFolder(it)
        .then(function (entry) {
          if (!entry) {
            skipped.push(it.kind + "/" + it.slug + (it.kind === "proxies" ? " (no proxy.txt with a Link:)" : " (no html file yet)"));
          } else {
            cat[it.kind].push(entry);
          }
          done++;
          step(i + 1);
        })
        .catch(function (err) {
          skipped.push(it.kind + "/" + it.slug + " (scan failed: " + (err && err.message) + ")");
          step(i + 1);
        });
    }
    step(0);
  }

  function byName(a, b) {
    return a.name.localeCompare(b.name);
  }

  /* ---------- actions ---------- */
  function prefillCurrent() {
    var raw = window.NULL_CATALOG || {};
    var out = [];
    (raw.games || []).forEach(function (g) {
      out.push("games/" + g.id);
    });
    (raw.apps || []).forEach(function (a) {
      out.push("apps/" + a.id);
    });
    (raw.proxies || []).forEach(function (p) {
      out.push("proxies/" + p.id);
    });
    d.qs("#toolPaths").value = out.join("\n");
    setStatus(out.length + " folders filled in from the current catalog \u2014 add or remove lines, then scan.", "ok");
  }

  function copyCode() {
    var code = d.qs("#toolCode");
    function fallback() {
      code.removeAttribute("readonly");
      code.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (err) {}
      code.setAttribute("readonly", "");
      d.toast(ok ? "Catalog copied" : "Select the text and copy manually", { type: ok ? "" : "err", icon: "check" });
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code.value).then(function () {
        d.toast("Catalog copied \u2014 paste it into src/catalog/generated-catalog.js", { icon: "check" });
      }, fallback);
    } else {
      fallback();
    }
  }

  function download() {
    var blob = new Blob([d.qs("#toolCode").value], { type: "text/javascript" });
    var url = URL.createObjectURL(blob);
    var a = d.h("a", { href: url, download: "generated-catalog.js" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
    d.toast("Downloaded generated-catalog.js", { icon: "check" });
  }

  function init() {
    if (!T) return;
    var run = d.qs("#toolScan");
    if (run) run.addEventListener("click", scan);
    var pre = d.qs("#toolExample");
    if (pre) pre.addEventListener("click", prefillCurrent);
    var clr = d.qs("#toolClear");
    if (clr) {
      clr.addEventListener("click", function () {
        d.qs("#toolPaths").value = "";
        d.qs("#toolOutSec").hidden = true;
        d.qs("#toolCodeSec").hidden = true;
        setStatus("");
      });
    }
    var cp = d.qs("#toolCopy");
    if (cp) cp.addEventListener("click", copyCode);
    var dl = d.qs("#toolDownload");
    if (dl) dl.addEventListener("click", download);

    var paths = d.qs("#toolPaths");
    if (paths) {
      paths.addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") scan();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
