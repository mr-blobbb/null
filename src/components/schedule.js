/* NULL · schedule.js
   The school schedule component.

   Three day types:
     • reg: Monday / Friday: seven 46-minute class periods, 7:45 start.
     • win: Tuesday / Thursday: same periods with a Homeroom/WIN block
              added after Period 2 (the following bells shift to fit it).
     • late: Wednesday: late arrival, first bell at 9:00.

   One of periods 4/5/6 is your lunch period (settable on /schedule/,
   default 5). That row reads "Lunch" instead of a class name.

   Times below are sample data, and they are the starting point rather than
   the law: /schedule's editor can rename periods, move the bells, add
   periods and remove them, per day type. Whatever it saves lands in
   null:sched under "types", and nothing read back out of storage is trusted
   (see sanitize) because that storage is editable by hand.

   Rendered compact on the home dashboard and full-size on /schedule, which
   also exposes the editor. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var TEMPLATES = {
    /* n = period number. start/end in 12-hour clock strings. */
    reg: [
      { n: 1, start: "7:45", end: "8:35" },
      { n: 2, start: "8:41", end: "9:34" },
      { n: 3, start: "9:40", end: "10:30" },
      { n: 4, start: "10:36", end: "11:26" },
      { n: 5, start: "11:32", end: "12:22" },
      { n: 6, start: "12:28", end: "1:18" },
      { n: 7, start: "1:24", end: "2:14" },
      { n: 8, start: "2:20", end: "3:10"},
    ],
    /* win days insert Homeroom/WIN after Period 2 and push the rest back */
    win: [
      { n: 1, start: "7:45", end: "8:30" },
      { n: 2, start: "8:35", end: "9:20" },
      { key: "win", start: "9:25", end: "10:10" },
      { n: 3, start: "10:15", end: "11:00" },
      { n: 4, start: "11:05", end: "11:50" },
      { n: 5, start: "11:55", end: "12:40" },
      { n: 6, start: "12:45", end: "1:30" },
      { n: 7, start: "1:35", end: "2:20" },
      { n: 8, start: "2:25", end: "3:10"},
    ],
    /* late arrival Wednesdays: everything shifts to a 9:00 start */
    late: [
      { n: 1, start: "9:00", end: "9:42" },
      { n: 2, start: "9:47", end: "10:29" },
      { n: 3, start: "10:34", end: "11:16" },
      { n: 4, start: "11:21", end: "12:03" },
      { n: 5, start: "12:08", end: "12:49" },
      { n: 6, start: "12:54", end: "1:36" },
      { n: 7, start: "1:41", end: "2:23" },
      { n: 8, start: "2:28", end: "3:10"}
    ],
  };

  var KIND = {
    reg: {
      label: "Regular schedule",
      short: "Regular",
      note: "EASY!",
    },
    win: {
      label: "Homeroom/WIN",
      short: "Homeroom/WIN",
      note: "Okay, so homeroom is fine, but I hate WIN.",
    },
    late: {
      label: "Late arrival",
      short: "Late arrival",
      note: "FINALLY I CAN SLEEP IN!!!",
    },
  };

  /* Monday(1) → Friday(5); Sun(0)/Sat(6) have no school */
  var WEEK = { 1: "reg", 2: "win", 3: "late", 4: "win", 5: "reg" };

  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  var KEY = "null:sched";

  /* ---------- config (names, lunch and bell times, saved locally) ---------- */
  /* A stored block is { n } or { key: "win" }, plus start and end. Anything
     that does not look like that is dropped rather than loaded, so a bad
     hand-edit in localStorage cannot take the schedule page down. */
  function sanitize(list) {
    if (!Array.isArray(list)) return null;
    var out = [];
    list.forEach(function (t) {
      if (!t || typeof t !== "object") return;
      var start = String(t.start || "").trim();
      var end = String(t.end || "").trim();
      if (!start || !end) return;
      var row = { start: start, end: end };
      if (t.key) row.key = String(t.key);
      else {
        var n = parseInt(t.n, 10);
        if (!n) return;
        row.n = n;
      }
      out.push(row);
    });
    return out.length ? out : null;
  }

  var TYPES = ["reg", "win", "late"];

  function conf() {
    var c = N.store.read(KEY, null) || {};
    var lunch = c.lunch >= 4 && c.lunch <= 6 ? c.lunch : 5;
    var names = c.names && typeof c.names === "object" ? c.names : {};
    var types = {};
    TYPES.forEach(function (k) {
      var clean = sanitize(c.types && c.types[k]);
      if (clean) types[k] = clean;
    });
    return { lunch: lunch, names: names, types: types };
  }

  function saveConf(c) {
    N.store.write(KEY, { lunch: c.lunch, names: c.names || {}, types: c.types || {} });
    N.bus.emit("sched");
  }

  function saveLunch(lunch) {
    var c = conf();
    c.lunch = lunch;
    saveConf(c);
  }

  /* the bell times in force for a day type: whatever was saved, or the
     template above. Always a fresh copy, so an editor can hold one and
     scribble on it without touching the stored one. */
  function timesFor(type) {
    var c = conf();
    var list = c.types[type] || TEMPLATES[type] || TEMPLATES.reg;
    return list.map(function (t) {
      return t.key ? { key: t.key, start: t.start, end: t.end } : { n: t.n, start: t.start, end: t.end };
    });
  }

  /* ---------- what the editor enforces ----------
     One list of rules, in one place, so the page, the tick in the strip and
     the countdown all mean the same thing by a valid schedule: every row
     has a readable start and end, ends after it starts, sits inside a
     school day, and does not start inside the period before it. */
  var DAY_START = 6 * 60 + 30; // 6:30 AM
  var DAY_END = 19 * 60; // 7:00 PM

  function check(list) {
    var errs = [];
    if (!list || !list.length) return ["A day needs at least one period."];
    var prevEnd = -1;
    list.forEach(function (t, i) {
      var label = t.key === "win" ? "Homeroom/WIN" : "Period " + t.n;
      var s = parseHM(t.start);
      var e = parseHM(t.end);
      var bad = false;
      if (s < 0) {
        errs.push(label + ': "' + t.start + '" is not a time. Write it like 7:45 or 12:30.');
        bad = true;
      }
      if (e < 0) {
        errs.push(label + ': "' + t.end + '" is not a time. Write it like 8:35 or 1:20.');
        bad = true;
      }
      if (bad) return;
      if (s < DAY_START || e > DAY_END) {
        errs.push(label + " sits outside a school day (6:30 AM to 7:00 PM).");
        return;
      }
      if (e <= s) {
        errs.push(label + " ends at " + fmtHM(e) + ", which is not after " + fmtHM(s) + ".");
        return;
      }
      if (s < prevEnd) {
        errs.push(label + " starts at " + fmtHM(s) + ", inside the period before it (ends " + fmtHM(prevEnd) + ").");
      } else if (s === prevEnd) {
        errs.push(label + " starts the moment the period before it ends. Leave a minute for passing.");
      }
      prevEnd = e;
    });
    return errs;
  }

  /* the next free number and a suggested slot, so Add always produces a row
     a person can just accept */
  function suggest(list) {
    var last = list[list.length - 1];
    var top = 0;
    list.forEach(function (t) {
      if (t.n && t.n > top) top = t.n;
    });
    var start = last && parseHM(last.end) > 0 ? parseHM(last.end) + 5 : 7 * 60 + 45;
    return { n: top + 1, start: fmtHM(start), end: fmtHM(start + 46) };
  }

  function defaultName(n) {
    return "Period " + n;
  }

  /* ---------- time helpers ---------- */
  /* Bell times are 12-hour strings ("7:45", "12:41", "1:31"). All blocks
     fall between 7 AM and ~3 PM, so hours 1-6 mean afternoon and 12 means noon. */
  function parseHM(s) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
    if (!m) return -1;
    var h = parseInt(m[1], 10);
    var min = parseInt(m[2], 10);
    if (h === 12) h = 12; // noon, not midnight
    else if (h < 7) h += 12; // 1-6 → PM
    return h * 60 + min;
  }

  function fmtHM(mins) {
    if (mins < 0) return "";
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    var ap = h >= 12 ? "PM" : "AM";
    var hh = h % 12 === 0 ? 12 : h % 12;
    return hh + ":" + (m < 10 ? "0" : "") + m + " " + ap;
  }

  function spanText(b) {
    return fmtHM(parseHM(b.start)) + " - " + fmtHM(parseHM(b.end));
  }

  function nowMinutes() {
    var n = new Date();
    return n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60;
  }

  /* ---------- day info ---------- */
  function weekType(wi) {
    return WEEK[wi] || null;
  }

  function todayInfo(now) {
    now = now || new Date();
    var wi = now.getDay();
    var type = weekType(wi);
    return {
      d: now,
      wi: wi,
      dayName: WEEKDAYS[wi],
      full: now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      dateLine: now.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
      type: type, // "reg" | "win" | null (weekend)
      kind: type ? KIND[type] : null,
    };
  }

  /* ---------- resolved block list for a day type ---------- */
  /* Each block: { n (or null for WIN), key, name, start, end, fixed }
     fixed rows (WIN, Lunch) cannot be renamed. */
  function blocksFor(type) {
    var c = conf();
    return (c.types[type] || TEMPLATES[type] || TEMPLATES.reg).map(function (t) {
      var b = {
        n: t.n || null,
        key: t.key || ("p" + t.n),
        start: t.start,
        end: t.end,
      };
      if (t.key === "win") {
        b.name = "Homeroom/WIN";
        b.fixed = true;
      } else if (t.n === c.lunch) {
        b.name = "Lunch";
        b.fixed = true; // lunch rows are never renamed
        b.lunch = true;
      } else {
        b.name = c.names[t.n] || defaultName(t.n);
      }
      return b;
    });
  }

  /* Current block info for a list of resolved blocks.
     Returns { i, block|null, next|null, secLeft, secToNext, passing }
     secLeft = seconds left in the current block (0 if none).
     During a gap between blocks, passing = true and block describes the
     passing period (ends when the next block starts). */
  function live(blocks, now) {
    now = now || new Date();
    var secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    var out = { i: -1, block: null, next: null, secLeft: 0, secToNext: 0, passing: false };
    for (var i = 0; i < blocks.length; i++) {
      var s = parseHM(blocks[i].start) * 60;
      var e = parseHM(blocks[i].end) * 60;
      if (secs >= s && secs < e) {
        out.i = i;
        out.block = blocks[i];
        out.secLeft = Math.max(0, e - secs);
        if (i + 1 < blocks.length) out.next = blocks[i + 1];
        return out;
      }
      if (secs < s) {
        /* gap between the previous block and this one: passing period */
        if (i > 0) {
          out.i = i;
          out.passing = true;
          out.block = { key: "pass", n: null, name: "Passing period", start: blocks[i - 1].end, end: blocks[i].start };
          out.secLeft = s - secs;
        }
        out.next = blocks[i];
        out.secToNext = s - secs;
        return out;
      }
    }
    return out; // after the last block
  }

  /* full date for a chosen weekday index (Mon..Fri → the *next* occurrence) */
  function nextDateFor(wi, from) {
    from = from || new Date();
    var delta = (wi - from.getDay() + 7) % 7;
    var d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + delta);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  /* ---------- shared row element ---------- */
  function rowEl(b, idx, isNow, opts) {
    opts = opts || {};
    var cells = [
      d.h("span", { class: "s-no" }, b.n ? "P" + b.n : "-"),
      d.h("span", { class: "s-name" }, b.name),
      d.h("span", { class: "s-time" }, spanText(b)),
    ];
    if (isNow) cells.unshift(d.h("span", { class: "nowtag" }, "NOW"));
    var attrs = { class: "sched-row" + (isNow ? " now" : ""), "data-key": b.key };
    if (b.lunch) attrs.style = { background: "var(--glass-bg-2)" };
    return d.h("div", attrs, cells);
  }

  /* Render the day-type chips (full page only). */
  function dayChips(chosen, onChange) {
    var row = d.h("div", { class: "sched-days", role: "tablist", "aria-label": "Pick a day" });
    for (var wi = 1; wi <= 5; wi++) {
      (function (wi) {
        var t = weekType(wi);
        var on = chosen === wi;
        row.appendChild(
          d.h("button", {
            type: "button",
            role: "tab",
            "aria-selected": on ? "true" : "false",
            class: "chip chip-btn" + (on ? " on" : ""),
            onclick: function () {
              onChange(wi);
            },
          }, [WEEKDAYS[wi].slice(0, 3), " · ", t ? KIND[t].short : "Regular"]),
        );
      })(wi);
    }
    return row;
  }

  /* Grid of rows for a resolved block list. nowIdx = -1 to show none.
     In live mode a "Passing period" row is injected between blocks while
     a passing period is actually happening (opts.passing = its index). */
  function grid(blocks, nowIdx, opts) {
    opts = opts || {};
    var g = d.h("div", { class: "sched-grid" });
    blocks.forEach(function (b, i) {
      if (opts.live !== false && opts.passing === i) {
        var pb = { key: "pass", n: null, name: "Passing period", start: blocks[i - 1] ? blocks[i - 1].end : b.start, end: b.start };
        g.appendChild(rowEl(pb, i, opts.live !== false && nowIdx === i, opts));
      }
      g.appendChild(rowEl(b, i, opts.live !== false && i === nowIdx && opts.passing == null, opts));
    });
    return g;
  }

  /* ============================================================
     Compact live "now / next / time left" strip.
     refresh(box) is called every second with seconds-left numbers.
     ============================================================ */
  function liveStrip(blocks) {
    var badge = d.h("div", { class: "ls-badge" }, [
      d.h("span", { class: "dot" }),
      d.h("b", { class: "ls-name" }, "-"),
      d.h("span", { class: "ls-time" }, ""),
    ]);
    var count = d.h("div", { class: "ls-count" }, [d.h("span", { class: "ls-left" }, "0:00"), d.h("span", { class: "ls-cap" }, "left")]);
    var next = d.h("div", { class: "ls-next" }, [d.h("span", { class: "ls-cap" }, "next"), d.h("b", null, "-")]);
    var el = d.h("div", { class: "live-strip" }, [badge, count, next]);
    function paint(lv) {
      var b = lv.block;
      if (b) {
        badge.classList.add("on");
        badge.querySelector(".ls-name").textContent = b.name;
        badge.querySelector(".ls-time").textContent = spanText(b);
        count.querySelector(".ls-left").textContent = fmtClock(lv.secLeft);
        count.querySelector(".ls-cap").textContent = b.passing || lv.passing ? "until class starts" : "left";
        count.classList.remove("idle");
      } else {
        badge.classList.remove("on");
        var nx = lv.next;
        /* more than an hour until the next block (before school, long gap)
         : a 437:38 countdown is noise, so just say "Before school" */
        var early = nx && lv.secToNext > 3600;
        badge.querySelector(".ls-name").textContent = nx
          ? early
            ? "Before school"
            : "Up next: " + nx.name
          : "School’s out";
        badge.querySelector(".ls-time").textContent = nx ? spanText(nx) : "See you tomorrow";
        count.querySelector(".ls-left").textContent = nx && !early ? fmtClock(lv.secToNext) : "-";
        count.classList.add("idle");
        if (nx && !early && lv.secToNext > 0) count.querySelector(".ls-cap").textContent = "until it starts";
        else if (nx && !early) count.querySelector(".ls-cap").textContent = "left";
        else if (nx) count.querySelector(".ls-cap").textContent = "see " + nx.name;
        else count.querySelector(".ls-cap").textContent = "left";
      }
      var nb = lv.next;
      if (nb) {
        next.querySelector("b").textContent = nb.name + " · " + fmtHM(parseHM(nb.start));
      } else {
        next.querySelector("b").textContent = "No more blocks today";
      }
    }
    function fmtClock(s) {
      var m = Math.floor(s / 60);
      var r = Math.floor(s % 60);
      return m + ":" + (r < 10 ? "0" : "") + r;
    }
    return { el: el, paint: paint };
  }

  /* ============================================================
     Public render entry points
     ============================================================ */

  /* Full page: today card content (badge + date + note). */
  function todayCard(wi) {
    var info = wi == null ? todayInfo() : null;
    var isToday = wi == null || wi === new Date().getDay();
    var type = isToday ? weekType(wi == null ? info.wi : wi) : weekType(wi);
    var label = isToday
      ? todayInfo().dayName + ", " + todayInfo().dateLine
      : nextDateFor(wi);
    var card = d.h("div", { class: "today-card" });
    card.appendChild(
      d.h("span", {
        class: "chip" + (type && type !== "reg" ? " accent" : ""),
      }, type ? (type === "win" ? "Homeroom/WIN day" : type === "late" ? "Late arrival day" : "Regular schedule") : "No school"),
    );
    card.appendChild(d.h("b", { class: "tc-date" }, label));
    card.appendChild(
      d.h("span", { class: "tc-note" }, type ? KIND[type].note : "Weekend: see you on Monday."),
    );
    return card;
  }

  N.schedule = {
    TEMPLATES: TEMPLATES,
    KIND: KIND,
    WEEK: WEEK,
    conf: conf,
    saveConf: saveConf,
    saveLunch: saveLunch,
    timesFor: timesFor,
    check: check,
    suggest: suggest,
    defaultName: defaultName,
    parseHM: parseHM,
    fmtHM: fmtHM,
    spanText: spanText,
    weekType: weekType,
    todayInfo: todayInfo,
    blocksFor: blocksFor,
    live: live,
    rowEl: rowEl,
    dayChips: dayChips,
    grid: grid,
    liveStrip: liveStrip,
    todayCard: todayCard,
    nextDateFor: nextDateFor,
  };
})();