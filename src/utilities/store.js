/* NULL — store.js
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
      /* private mode / quota — ignore */
    }
  }
  function del(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {}
  }

  N.store = { read: read, write: write, del: del };

  /* tiny pub/sub used to refresh lists when favorites/recent change */
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
    perf: false, // performance mode
    gmailAddr: "you@gmail.com",
    gmailUnread: 0,
    panicKey: "`",
    panicUrl: "https://classroom.google.com",
    panicMode: "single", // single | double (two presses within 400 ms)
    seasonal: false, // seasonal theme follows the calendar (leaves, snow, petals, light)
    seasonOverride: null, // dev-console season preview: "fall" | "winter" | ... | null = calendar
    smartTab: false, // smart tab cloak: rotate tab presets on a timer
    smartTabMin: 5, // smart tab cloak: minutes between rotations
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
    };
  })();

  /* ---------- play counts (local per browser — powers "most played") ---------- */
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
    };
  })();

  /* ---------- weekly play log (games/apps launched per week) ----------
     Powers the weekly wrap-up modal: every launch is stamped with the week
     it happened in (Monday-keyed), so once a week rolls over the previous
     week's log can be summarized and shown — then the log resets. */
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
})();
