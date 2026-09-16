/* NULL · store.js
   localStorage-backed user data: preferences, flags, recent items, favorites.
   Everything for a given visitor lives under four keys. */
(function () {
  var N = (window.N = window.N || {});

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }
  function write(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (err) {
      /* private mode / quota: ignore */
    }
  }
  function del(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {}
  }

  N.store = { read: read, write: write, del: del };

  /* ---------- where NULL lives ----------
     The pages link to each other with paths relative to the folder NULL is
     served from, so the same files run at a domain root and under a subfolder
     (github.io/some-repo/, say). The JS keeps asking for pages by their site
     path (N.url("/shop")), which needs that folder. It is worked out
     once, from the address this script was loaded at: everything above the
     page is the folder, except the content folder the page itself sits in.

     FOLDERS is that last part: the folders holding pages of their own. A new
     one has to be added here as well as on disk, and check-pages fails if the
     two disagree.

     One page cannot be read that way. A static host answers a missing address
     with 404.html and keeps the address, so /typo/deep would look like a
     folder two levels down. That page names the folder itself, with data-root
     on <html>. */
  var FOLDERS = ["games", "apps", "proxies"];

  function asBase(folder) {
    folder = String(folder || "").replace(/^\/+|\/+$/g, "");
    return folder ? "/" + folder + "/" : "/";
  }

  var segs = location.pathname.replace(/[^/]*$/, "").split("/").filter(Boolean);
  if (segs.length && FOLDERS.indexOf(segs[segs.length - 1]) > -1) segs.pop();
  var root = document.documentElement.getAttribute("data-root");
  N.base = root ? asBase(root) : asBase(segs.join("/"));
  /* clean urls: pages are asked for by extensionless site path ("/shop"),
     the same shape a visitor sees in the address bar. On a static host they
     are answered by the .html file (see sw.js and 404.html). Pass keep=true
     for real files (a game's own .html inside its folder, a thumbnail):
     those keep their extension or the host would not serve them. */
  N.url = function (path, keep) {
    var clean = String(path == null ? "" : path).replace(/^\/+/, "");
    if (!keep) clean = clean.replace(/\.html$/, "");
    return N.base + clean;
  };

  /* a visitor can land on /shop.html (typed, an old link, a host without
     rewrite support): rewrite the address bar to /shop without a reload so
     every NULL url is one shape. Folder pages rewrite to /games/, home keeps
     /. The 404 page skips this: its address is a path that does not exist
     and GitHub keeps it that way on purpose. */
  N.cleanAddress = function () {
    var p = location.pathname;
    var isRoot = p === "/" || p === "/index.html";
    if (!/\.html$/.test(p) || isRoot || document.documentElement.hasAttribute("data-root")) return;
    var clean = /\/index\.html$/.test(p) ? p.replace(/index\.html$/, "") : p.replace(/\.html$/, "");
    try {
      history.replaceState(null, "", clean + location.search + location.hash);
    } catch (err) {}
  };

  /* ---------- tiny pub/sub used to refresh lists when favorites/recent change ---------- */
  var busMap = {};
  N.bus = {
    on: function (type, fn) {
      (busMap[type] = busMap[type] || []).push(fn);
    },
    off: function (type, fn) {
      busMap[type] = (busMap[type] || []).filter(function (f) {
        return f !== fn;
      });
    },
    emit: function (type, data) {
      (busMap[type] || []).forEach(function (fn) {
        fn(data);
      });
    },
  };

  /* ---------- preferences ---------- */
  var PREFS_KEY = "null:prefs";
  var DEFAULTS = {
    theme: "dark", // dark | light
    accent: "off", // palette id from theme.js
    particles: "none", // ambient background particle id from econ.js
    glow: "off", // glow preset id from theme.js
    glowColor1: "#35c3f2", // custom glow color 1
    glowColor2: "#a86bff", // custom glow color 2
    glowComet: false, // comet streak traveling around the glow border
    tab: "slides", // tab preset id from tabpresets.js (default: Google Slides)
    tabCustom: {}, // custom tab preset: { title, icon }
    recs: true, // "Because you played" suggestions on the games page
    marathon: true, // marathon mode feature enabled (settings toggle)
    confetti: true, // celebrate when a class period ends
    marathonMin: 0, // marathon mode: 0 = off, else minutes between switches
    marathonAt: 0, // timestamp of the next auto-switch (ms)
    perf: false, // performance mode: false | true | "ultra" (see perf.css)
    cloakRedirect: true, // hand this tab to the preset's real site when cloaking
    gmailAddr: "you@gmail.com",
    gmailUnread: 0,
    panicKey: "`",
    panicUrl: "https://classroom.google.com",
    panicMode: "single", // single | double (two presses within 400 ms)
    seasonal: false, // seasonal theme follows the calendar (leaves, snow, petals, light)
    seasonOverride: null, // dev-console season preview: "fall" | "winter" | ... | null = calendar
    smartTab: false, // smart tab cloak: rotate tab presets on a timer
    smartTabMin: 5, // smart tab cloak: minutes between rotations
    density: "regular", // layout compactness: regular | comfy | spacious | compact
    miniPerf: false, // Mini-Perf: unload off-screen blocks, strip nothing
    navLayout: "side", // "side": the hover-expand left rail, "bar": the top bar
    seasonVariant: null, // seasonal/holiday pick; null follows the calendar
    bgImage: "", // custom page background (Shop unlock): a URL or a data URL
    bgFit: "cover", // cover | contain | tile
    bgDim: 0.35, // 0..1 tint over the image so the page stays readable
    bgBlur: 0, // px of blur on the image
  };

  N.prefs = (function () {
    var data = Object.assign({}, DEFAULTS, read(PREFS_KEY, {}));
    return {
      defaults: DEFAULTS,
      data: data,
      get: function (k) {
        return k in data ? data[k] : DEFAULTS[k];
      },
      set: function (k, v) {
        data[k] = v;
        write(PREFS_KEY, data);
      },
      patch: function (obj) {
        Object.assign(data, obj);
        write(PREFS_KEY, data);
      },
      reset: function () {
        data = Object.assign({}, DEFAULTS);
        write(PREFS_KEY, data);
        return data;
      },
      /* re-read from storage after another NULL window wrote (see N.sync).
         Patched in place so every `N.prefs.data` reference stays valid. */
      reload: function () {
        var fresh = Object.assign({}, DEFAULTS, read(PREFS_KEY, {}));
        Object.keys(data).forEach(function (k) {
          if (!(k in fresh)) delete data[k];
        });
        Object.assign(data, fresh);
        return data;
      },
    };
  })();

  /* ---------- one-shot flags (welcome modal, popup note, ...) ---------- */
  var FLAGS_KEY = "null:flags";
  N.flags = (function () {
    var data = read(FLAGS_KEY, {});
    return {
      get: function (k) {
        return !!data[k];
      },
      set: function (k) {
        if (!data[k]) {
          data[k] = 1;
          write(FLAGS_KEY, data);
        }
      },
      clear: function () {
        data = {};
        del(FLAGS_KEY);
      },
      reload: function () {
        var fresh = read(FLAGS_KEY, {});
        Object.keys(data).forEach(function (k) {
          delete data[k];
        });
        Object.assign(data, fresh);
      },
    };
  })();

  /* ---------- recently played / opened ---------- */
  var RECENT_KEY = "null:recent";
  N.recent = (function () {
    var items = read(RECENT_KEY, []);
    function save() {
      write(RECENT_KEY, items);
      N.bus.emit("recent");
    }
    return {
      list: function () {
        return items.slice();
      },
      add: function (kind, id) {
        items = items.filter(function (r) {
          return !(r.k === kind && r.id === id);
        });
        items.unshift({ k: kind, id: id, at: Date.now() });
        if (items.length > 30) items = items.slice(0, 30);
        save();
      },
      remove: function (kind, id) {
        items = items.filter(function (r) {
          return !(r.k === kind && r.id === id);
        });
        save();
      },
      clear: function () {
        items = [];
        save();
      },
      reload: function () {
        items = read(RECENT_KEY, []);
      },
    };
  })();

  /* ---------- favorites ---------- */
  var FAVS_KEY = "null:favs";
  N.favs = (function () {
    var items = read(FAVS_KEY, []);
    function save() {
      write(FAVS_KEY, items);
      N.bus.emit("favs");
    }
    return {
      list: function () {
        return items.slice();
      },
      has: function (kind, id) {
        return items.some(function (f) {
          return f.k === kind && f.id === id;
        });
      },
      toggle: function (kind, id) {
        var i = items.findIndex(function (f) {
          return f.k === kind && f.id === id;
        });
        if (i >= 0) {
          items.splice(i, 1);
        } else {
          items.unshift({ k: kind, id: id });
        }
        save();
        return i < 0;
      },
      remove: function (kind, id) {
        items = items.filter(function (f) {
          return !(f.k === kind && f.id === id);
        });
        save();
      },
      clear: function () {
        items = [];
        save();
      },
      reload: function () {
        items = read(FAVS_KEY, []);
      },
    };
  })();

  /* ---------- play counts (local per browser: powers "most played") ---------- */
  var PLAYS_KEY = "null:plays";
  N.plays = (function () {
    var data = read(PLAYS_KEY, {});
    return {
      tap: function (kind, id) {
        var k = kind + ":" + id;
        data[k] = (data[k] || 0) + 1;
        write(PLAYS_KEY, data);
      },
      count: function (kind, id) {
        return data[kind + ":" + id] || 0;
      },
      reload: function () {
        data = read(PLAYS_KEY, {});
      },
    };
  })();

  /* ---------- weekly play log (games/apps launched per week) ----------
     Powers the weekly wrap-up modal: every launch is stamped with the week
     it happened in (Monday-keyed), so once a week rolls over the previous
     week's log can be summarized and shown, then the log resets. */
  function mondayOf(date) {
    var x = new Date(date.getTime());
    x.setHours(0, 0, 0, 0);
    var day = x.getDay() || 7; // Sunday = 7 so the week starts on Monday
    x.setDate(x.getDate() - day + 1);
    return x.toISOString().slice(0, 10);
  }

  var WEEK_KEY = "null:week";
  N.week = (function () {
    var data = read(WEEK_KEY, { week: mondayOf(new Date()), plays: [] });
    function save() {
      write(WEEK_KEY, data);
    }
    return {
      key: function () {
        return data.week;
      },
      log: function (kind, id) {
        var wk = mondayOf(new Date());
        if (data.week !== wk) data = { week: wk, plays: [] };
        data.plays.push({ k: kind, id: id, at: Date.now() });
        save();
      },
      /* week changed? returns the finished week { week, plays } when it had
         plays (caller shows the wrap-up), otherwise null. Always resets the
         log to the current week. */
      rollover: function () {
        var wk = mondayOf(new Date());
        if (data.week === wk) return null;
        var prev = data;
        data = { week: wk, plays: [] };
        save();
        return prev.plays.length ? prev : null;
      },
      snapshot: function () {
        return data;
      },
      reset: function () {
        data = { week: mondayOf(new Date()), plays: [] };
        save();
      },
      reload: function () {
        data = read(WEEK_KEY, { week: mondayOf(new Date()), plays: [] });
      },
      summary: function (plays) {
        plays = plays || data.plays;
        var byItem = {};
        plays.forEach(function (p) {
          var key = p.k + ":" + p.id;
          byItem[key] = byItem[key] || { k: p.k, id: p.id, n: 0 };
          byItem[key].n++;
        });
        var items = Object.keys(byItem)
          .map(function (k) {
            return byItem[k];
          })
          .sort(function (a, b) {
            return b.n - a.n;
          });
        return {
          total: plays.length,
          distinct: items.length,
          top: items.slice(0, 3),
        };
      },
    };
  })();

  /* ---------- announcements seen-state ----------
     Powers the unread dot on the Announcements nav icon + the page dot.
     "Seen" = the latest announcement date the visitor has viewed. */
  var ANN_SEEN = "null:annSeen";
  N.ann = {
    latest: function () {
      var list = (window.NULL_CONTENT && window.NULL_CONTENT.announcements) || [];
      var latest = "";
      list.forEach(function (a) {
        if (a.date > latest) latest = a.date;
      });
      return latest;
    },
    seen: function () {
      return N.store.read(ANN_SEEN, "");
    },
    unread: function () {
      var latest = this.latest();
      return !!latest && this.seen() < latest;
    },
    markSeen: function () {
      var latest = this.latest();
      if (!latest) return;
      N.store.write(ANN_SEEN, latest);
      N.bus.emit("annSeen");
    },
  };

  /* ---------- small date helpers ---------- */
  N.dt = {
    ago: function (ts) {
      var s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
      if (s < 60) return "just now";
      var m = Math.floor(s / 60);
      if (m < 60) return m + "m ago";
      var h = Math.floor(m / 60);
      if (h < 24) return h + "h ago";
      var d = Math.floor(h / 24);
      if (d < 7) return d + "d ago";
      return new Date(ts).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    },
    fmt: function (dateStr) {
      var d = new Date(dateStr);
      if (isNaN(d)) return dateStr;
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    },
  };

  /* ---------- live sync between NULL windows ----------
     One origin shares one storage area, and every same-origin way of running
     NULL shares it: a second tab, the installed app window, and the cloaked
     about:blank / blob: windows (they frame the real site). The browser fires
     `storage` in the *other* windows whenever one of them writes, so they can
     stay in step with no server. A genuinely different origin: another host
     or a preview link: can never see it; that is what the Settings backup
     file is for. */
  var reloaders = [
    N.prefs.reload,
    N.flags.reload,
    N.recent.reload,
    N.favs.reload,
    N.plays.reload,
    N.week.reload,
  ];

  function resync() {
    reloaders.forEach(function (fn) {
      try {
        fn();
      } catch (err) {}
    });
    N.bus.emit("sync");
  }

  N.sync = {
    /* modules holding their own cache (the economy) register a reload here */
    register: function (fn) {
      reloaders.push(fn);
    },
    now: resync,
    watch: function () {
      window.addEventListener("storage", function (e) {
        /* a null key means localStorage.clear() somewhere on this origin */
        if (e.key && e.key.indexOf("null:") !== 0) return;
        resync();
      });
      /* a backgrounded window can be throttled and miss events; catch up when
         it comes back to the front instead of staying stale */
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) resync();
      });
    },
  };

  N.sync.watch();
})();
