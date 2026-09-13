/* NULL · catalog-tool.js
   The pure half of the static catalog builder: the same text parsing the old
   scripts/discover-*.js did, with the filesystem swapped out. The page script
   (src/pages/tools.js) fetches a folder's files; everything here takes plain
   text and hands back catalog entries, so it stays testable on its own. */
(function () {
  var N = (window.N = window.N || {});

  var IMG = ["png", "jpg", "jpeg", "webp", "gif", "svg"];
  var KIND_BASE = ["games", "apps", "proxies"];

  function pretty(slug) {
    return slug
      .split(/[-_]+/)
      .filter(Boolean)
      .map(function (w) {
        return w[0].toUpperCase() + w.slice(1);
      })
      .join(" ");
  }

  function lines(text) {
    return String(text == null ? "" : text)
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
  }

  /* Label.txt: every line is one or more chips. "Label: Action Puzzle" and a
     bare "Action Puzzle" both work, and "2 Player" stays one label. */
  function parseLabels(text) {
    var out = [];
    var toks = [];
    lines(text).forEach(function (line) {
      var v = line;
      if (/^Label:\s*/i.test(v)) v = v.replace(/^Label:\s*/i, "");
      v.split(/\s+/)
        .filter(Boolean)
        .forEach(function (t) {
          toks.push(t);
        });
    });
    for (var i = 0; i < toks.length; i++) {
      var lab = toks[i];
      if (/^\d+$/.test(lab) && toks[i + 1] && !/^\d+$/.test(toks[i + 1])) {
        lab = lab + " " + toks[++i];
      }
      if (out.indexOf(lab) < 0) out.push(lab);
    }
    return out;
  }

  /* Warning.txt: Title: … plus a Description: that runs on over following lines */
  function parseWarning(text) {
    var ls = lines(text);
    if (!ls.length) return null;
    var title = "";
    var desc = [];
    var readingDesc = false;
    ls.forEach(function (line) {
      if (/^Title:\s*/i.test(line)) {
        readingDesc = false;
        title = line.replace(/^Title:\s*/i, "");
      } else if (/^Description:\s*/i.test(line)) {
        readingDesc = true;
        desc.push(line.replace(/^Description:\s*/i, ""));
      } else if (readingDesc) {
        desc.push(line);
      }
    });
    if (!title && !desc.length) return null;
    return { title: title || "Heads up", description: desc.join("\n") };
  }

  /* meta.txt: Name: / Description: / Added: YYYY-MM-DD, and any #hot line */
  function parseMeta(text) {
    var meta = {};
    lines(text).forEach(function (line) {
      if (/^Name:\s*/i.test(line)) {
        meta.name = line.replace(/^Name:\s*/i, "");
      } else if (/^Description:\s*/i.test(line)) {
        meta.description = line.replace(/^Description:\s*/i, "");
      } else if (/^Added:\s*/i.test(line)) {
        var t = Date.parse(line.replace(/^Added:\s*/i, ""));
        if (!isNaN(t)) meta.at = t;
      } else if (/#hot/i.test(line)) {
        meta.hot = true;
      }
    });
    return meta;
  }

  /* proxies/<slug>/proxy.txt: Link: (or Url:), Description:, Status: */
  function parseProxy(text) {
    if (text == null) return null;
    var out = { link: "", desc: "", status: "" };
    var inDesc = false;
    String(text)
      .split(/\r?\n/)
      .forEach(function (line) {
        if (/^\s*(link|url):\s*/i.test(line)) {
          inDesc = false;
          out.link = line.replace(/^\s*(link|url):\s*/i, "").trim();
        } else if (/^\s*description:\s*/i.test(line)) {
          inDesc = true;
          out.desc = line.replace(/^\s*description:\s*/i, "").trim();
        } else if (/^\s*status:\s*/i.test(line)) {
          inDesc = false;
          out.status = line.replace(/^\s*status:\s*/i, "").trim();
        } else if (inDesc && line.trim()) {
          out.desc += (out.desc ? " " : "") + line.trim();
        }
      });
    return out;
  }

  var STATUSES = ["All Good", "Issue", "Blocked"];

  function proxyEntry(slug, text) {
    var conf = parseProxy(text);
    if (!conf || !conf.link) return null;
    return {
      id: slug,
      name: pretty(slug),
      url: conf.link,
      desc: conf.desc || "External destination, opens in a new tab.",
      status: STATUSES.indexOf(conf.status) >= 0 ? conf.status : "",
    };
  }

  /* a game or app entry. `files` holds whatever the page managed to fetch:
     { html, thumb, labels, warning, meta }: any of them may be missing. */
  function entry(kind, slug, files) {
    files = files || {};
    var meta = parseMeta(files.meta);
    return {
      id: slug,
      name: meta.name || pretty(slug),
      desc:
        meta.description ||
        "Found in " + kind + "/" + slug + ". No description written yet.",
      file: "/" + kind + "/" + slug + "/" + (files.html || slug + ".html"),
      thumb: files.thumb ? "/" + kind + "/" + slug + "/" + files.thumb : null,
      labels: parseLabels(files.labels),
      warning: parseWarning(files.warning),
      at: meta.at || null,
      hot: !!meta.hot,
    };
  }

  /* the file names worth probing for, best first */
  function htmlCandidates(slug) {
    return [slug + ".html", "index.html"];
  }
  function thumbCandidates(slug) {
    var out = [];
    IMG.forEach(function (ext) {
      out.push(slug + "." + ext);
    });
    ["cover", "thumb", "thumbnail"].forEach(function (base) {
      IMG.forEach(function (ext) {
        out.push(base + "." + ext);
      });
    });
    return out;
  }

  /* paste → [{ kind, slug }]. Accepts folder paths, full file paths, a
     bulleted list, or the output of `find` / a file tree. */
  function folders(text) {
    var seen = {};
    var out = [];
    lines(text)
      .map(function (l) {
        return l
          .replace(/^[\s|*+-]+/, "")
          .replace(/^\.\//, "")
          .replace(/^\/+/, "")
          .replace(/\s*[\\|].*$/, "") // tolerate pasted trees with trailing notes
          .replace(/\s+/g, "");
      })
      .filter(Boolean)
      .forEach(function (p) {
        var parts = p.split("/").filter(Boolean);
        var kind = parts[0];
        if (KIND_BASE.indexOf(kind) < 0) return;
        if (parts.length < 2) return;
        var slug = parts[1];
        if (/^[._]/.test(slug)) return; // hidden / private folders are skipped
        if (/\.(html|png|jpe?g|webp|gif|svg|txt)$/i.test(slug)) return; // a bare file at the root
        var key = kind + "/" + slug;
        if (seen[key]) return;
        seen[key] = 1;
        out.push({ kind: kind, slug: slug });
      });
    return out;
  }

  var HEADER = [
    "/* ============================================================",
    "   NULL · generated-catalog.js",
    "   The catalog the site reads. Build it with /tools: paste your",
    "   games/ apps/ proxies/ folders, copy the output over this file.",
    "   Safe to edit by hand: it is plain data, and it is the only place",
    "   the library is registered.",
    "   ============================================================ */",
  ].join("\n");

  /* catalog object → the exact source of generated-catalog.js */
  function source(cat, stamp) {
    return (
      HEADER +
      "\nwindow.NULL_CATALOG = " +
      JSON.stringify(
        {
          site: cat.site || "NULL",
          generatedAt: stamp || new Date().toISOString(),
          games: cat.games || [],
          apps: cat.apps || [],
          proxies: cat.proxies || [],
        },
        null,
        2,
      ) +
      ";\n"
    );
  }

  N.catalogTool = {
    IMG: IMG,
    pretty: pretty,
    parseLabels: parseLabels,
    parseWarning: parseWarning,
    parseMeta: parseMeta,
    parseProxy: parseProxy,
    proxyEntry: proxyEntry,
    entry: entry,
    htmlCandidates: htmlCandidates,
    thumbCandidates: thumbCandidates,
    folders: folders,
    source: source,
    header: HEADER,
  };
})();
