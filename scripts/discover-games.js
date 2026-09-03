/* NULL — discover-games.js
   Scans games/ (and, via scanDir, apps/). A folder counts when it contains
   an HTML file. Optional metadata:
     Label.txt     each line → one or more label chips
                   "Label: Action Puzzle Singleplayer" → Action, Puzzle, Singleplayer
     Warning.txt   Title: ... / Description: ...
     meta.txt      Name: ... / Description: ...  (optional overrides)
   Thumbnails: any png/jpg/jpeg/webp/gif/svg, slug-named files preferred. */
import fs from "node:fs";
import path from "node:path";

const IMG = ["png", "jpg", "jpeg", "webp", "gif", "svg"];

export function pretty(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map(function (w) {
      return w[0].toUpperCase() + w.slice(1);
    })
    .join(" ");
}

function readLines(abs) {
  try {
    return fs
      .readFileSync(abs, "utf8")
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
  } catch (err) {
    return [];
  }
}

export function parseLabels(dir) {
  const out = [];
  readLines(path.join(dir, "Label.txt")).forEach(function (line) {
    let v = line;
    if (/^Label:\s*/i.test(v)) v = v.replace(/^Label:\s*/i, "");
    v.split(/\s+/)
      .filter(Boolean)
      .forEach(function (tok) {
        if (out.indexOf(tok) < 0) out.push(tok);
      });
  });
  return out;
}

export function parseWarning(dir) {
  const lines = readLines(path.join(dir, "Warning.txt"));
  if (!lines.length) return null;
  let title = "";
  const desc = [];
  let readingDesc = false;
  lines.forEach(function (line) {
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
  return {
    title: title || "Heads up",
    description: desc.join("\n"),
  };
}

function parseMeta(dir) {
  const meta = {};
  readLines(path.join(dir, "meta.txt")).forEach(function (line) {
    if (/^Name:\s*/i.test(line)) meta.name = line.replace(/^Name:\s*/i, "");
    else if (/^Description:\s*/i.test(line))
      meta.description = line.replace(/^Description:\s*/i, "");
  });
  return meta;
}

function findThumb(dir, slug) {
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    return null;
  }
  const imgs = files.filter(function (f) {
    return IMG.indexOf(f.split(".").pop().toLowerCase()) >= 0;
  });
  if (!imgs.length) return null;
  const named = imgs.find(function (f) {
    return f.replace(/\.[^.]+$/, "").toLowerCase() === slug.toLowerCase();
  });
  return named || imgs[0];
}

/* scan a content folder. kindBase: "games" | "apps" */
export function scanDir(rootDir, kindBase) {
  const base = path.join(rootDir, kindBase);
  const items = [];
  let skipped = [];
  let dirs = [];
  try {
    dirs = fs.readdirSync(base, { withFileTypes: true });
  } catch (err) {
    return { items: items, skipped: skipped };
  }

  dirs
    .filter(function (d) {
      return d.isDirectory() && !/^[._]/.test(d.name);
    })
    .forEach(function (d) {
      const dir = path.join(base, d.name);
      let files = [];
      try {
        files = fs.readdirSync(dir);
      } catch (err) {}
      const htmls = files
        .filter(function (f) {
          return f.toLowerCase().endsWith(".html");
        })
        .sort();
      if (!htmls.length) {
        skipped.push(d.name + " (no html file yet)");
        return;
      }
      const file =
        htmls.find(function (f) {
          return f.toLowerCase().replace(/\.html$/, "") === d.name.toLowerCase();
        }) || htmls[0];
      const meta = parseMeta(dir);
      const slug = d.name;
      const thumb = findThumb(dir, slug);
      items.push({
        id: slug,
        name: meta.name || pretty(slug),
        desc:
          meta.description ||
          "Found automatically in " +
            kindBase +
            "/" +
            slug +
            " \u2014 part of the NULL library.",
        file: "/" + kindBase + "/" + slug + "/" + file,
        thumb: thumb ? "/" + kindBase + "/" + slug + "/" + thumb : null,
        labels: parseLabels(dir),
        warning: parseWarning(dir),
      });
    });

  items.sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });
  return { items: items, skipped: skipped };
}

export function discoverGames(rootDir) {
  return scanDir(rootDir, "games");
}
