/* NULL — discover-proxies.js
   Each proxies/<slug>/ folder needs a proxy.txt file:

     Link: https://example.com/
     Description: What it is.
     Status: All Good        (All Good | Issue | Blocked — manual)

   Folder names beginning with . or _ are ignored. */
import fs from "node:fs";
import path from "node:path";

function pretty(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map(function (w) {
      return w[0].toUpperCase() + w.slice(1);
    })
    .join(" ");
}

function parseProxyFile(abs) {
  let content = "";
  try {
    content = fs.readFileSync(abs, "utf8");
  } catch (err) {
    return null;
  }
  const out = { link: "", desc: "", status: "" };
  const lines = content.split(/\r?\n/);
  let inDesc = false;
  lines.forEach(function (line) {
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

export function discoverProxies(rootDir) {
  const base = path.join(rootDir, "proxies");
  const proxies = [];
  const skipped = [];
  let dirs = [];
  try {
    dirs = fs.readdirSync(base, { withFileTypes: true });
  } catch (err) {
    return { proxies: proxies, skipped: skipped };
  }

  dirs
    .filter(function (d) {
      return d.isDirectory() && !/^[._]/.test(d.name);
    })
    .forEach(function (d) {
      const dir = path.join(base, d.name);
      let conf = parseProxyFile(path.join(dir, "proxy.txt"));
      if (!conf) conf = parseProxyFile(path.join(dir, "url.txt"));
      if (!conf || !conf.link) {
        skipped.push(d.name + " (no proxy.txt with a Link:)");
        return;
      }
      const valid = ["All Good", "Issue", "Blocked"];
      proxies.push({
        id: d.name,
        name: pretty(d.name),
        url: conf.link,
        desc: conf.desc || "External destination \u2014 opens in a new tab.",
        status: valid.indexOf(conf.status) >= 0 ? conf.status : "",
      });
    });

  proxies.sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });
  return { proxies: proxies, skipped: skipped };
}
