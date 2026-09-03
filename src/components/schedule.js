/* NULL — schedule.js
   The permanent school schedule component.
   Shown in compact form on the home dashboard and full size on
   /schedule.html. Edit the SCHEDULE object below — that is all that needs
   to change when the real day changes. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var SCHEDULE = {
    week: ["A", "B", "A", "B", "A"], // Monday → Friday day types
    note: "Sample times — edit src/components/schedule.js to match the real bell schedule.",
    days: {
      A: {
        label: "A Day",
        blocks: [
          { name: "Period 1", course: "", time: "7:45 – 8:31" },
          { name: "Period 2", course: "", time: "8:35 – 9:21" },
          { name: "Period 3", course: "", time: "9:25 – 10:11" },
          { name: "Period 4", course: "", time: "10:15 – 11:01" },
          { name: "Lunch", course: "", time: "11:05 – 11:45" },
          { name: "Period 5", course: "", time: "11:49 – 12:35" },
          { name: "Period 6", course: "", time: "12:39 – 1:25" },
          { name: "Period 7", course: "", time: "1:29 – 2:15" },
        ],
      },
      B: {
        label: "B Day",
        blocks: [
          { name: "Period 1", course: "", time: "7:45 – 8:31" },
          { name: "Period 2", course: "", time: "8:35 – 9:21" },
          { name: "Period 3", course: "", time: "9:25 – 10:11" },
          { name: "Period 5", course: "", time: "10:15 – 11:01" },
          { name: "Lunch", course: "", time: "11:05 – 11:45" },
          { name: "Period 4", course: "", time: "11:49 – 12:35" },
          { name: "Period 6", course: "", time: "12:39 – 1:25" },
          { name: "Period 7", course: "", time: "1:29 – 2:15" },
        ],
      },
    },
  };

  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function dayType(weekdayIdx) {
    // weekdayIdx: 0 Sun .. 6 Sat
    if (weekdayIdx === 0 || weekdayIdx === 6) return null;
    return SCHEDULE.week[weekdayIdx - 1];
  }

  function parseStart(t) {
    var m = /(\d{1,2}):(\d{2})/.exec(t || "");
    if (!m) return -1;
    var h = parseInt(m[1], 10) % 12;
    if (t.indexOf("PM") >= 0) h += 12;
    var min = parseInt(m[2], 10);
    if (m[1] === "12" && t.indexOf("PM") >= 0) h = 12;
    if (m[1] === "12" && t.indexOf("AM") >= 0) h = 0;
    return h * 60 + min;
  }

  function nowIndex(blocks) {
    var now = new Date();
    var cur = now.getHours() * 60 + now.getMinutes();
    for (var i = 0; i < blocks.length; i++) {
      var start = parseStart(blocks[i].time);
      var end = blocks[i + 1] ? parseStart(blocks[i + 1].time) : 24 * 60;
      if (start >= 0 && cur >= start && cur < end) return i;
    }
    return -1;
  }

  function todayInfo() {
    var now = new Date();
    var wi = now.getDay();
    var dt = dayType(wi);
    return {
      weekday: wi,
      dayName: WEEKDAYS[wi],
      type: dt, // "A" | "B" | null (weekend)
      dateLabel: now.toLocaleDateString(undefined, { month: "long", day: "numeric" }),
    };
  }

  function rowEl(block, idx, isNow) {
    return d.h(
      "div",
      { class: "sched-row" + (isNow ? " now" : "") },
      [
        isNow ? d.h("span", { class: "nowtag" }, "NOW") : null,
        d.h("span", { class: "per" }, block.name),
        d.h("span", { class: "crs" }, block.course || "\u2014"),
        d.h("span", { class: "tm" }, block.time),
      ],
    );
  }

  /* render(el, opts) — opts: { mini: bool } */
  function render(el, opts) {
    opts = opts || {};
    el.innerHTML = "";
    var info = todayInfo();
    var wrap = d.h("div", { class: "sched-wrap" + (opts.mini ? " sched-mini" : "") });

    /* day-of-week chips */
    var chipRow = d.h("div", { class: "sched-days", role: "tablist" });
    var activeW = info.weekday; // Mon..Fri default: today when school day
    var chosen = { w: info.weekday, forced: false };

    for (var i = 1; i <= 5; i++) {
      (function (i) {
        var dt = dayType(i);
        var on = chosen.w === i;
        var chip = d.h(
          "button",
          {
            type: "button",
            class: "chip chip-btn" + (on ? " on" : ""),
            onclick: function () {
              chosen.w = i;
              render(el, opts);
            },
          },
          [WEEKDAYS[i].slice(0, 3), dt ? " \u00b7 " + dt : ""],
        );
        chipRow.appendChild(chip);
      })(i);
    }
    wrap.appendChild(chipRow);

    if (info.type == null && chosen.w === info.weekday) {
      // weekend: only when viewing the real today
      wrap.appendChild(
        d.h("div", { class: "sched-nodays" }, [
          d.h("b", null, info.dayName + " \u2014 no school."),
          d.h("span", null, " See you Monday \u2014 it\u2019s an " + dayType(1) + " Day."),
        ]),
      );
    } else {
      var type = dayType(chosen.w) || "A";
      var day = SCHEDULE.days[type];
      var grid = d.h("div", { class: "sched-grid" });
      var nIdx = chosen.w === info.weekday ? nowIndex(day.blocks) : -1;
      day.blocks.forEach(function (b, idx) {
        grid.appendChild(rowEl(b, idx, idx === nIdx));
      });
      wrap.appendChild(grid);
      wrap.appendChild(d.h("div", { class: "sched-note" }, [SCHEDULE.note]));
    }
    el.appendChild(wrap);
  }

  N.schedule = {
    render: render,
    data: SCHEDULE,
    today: todayInfo,
  };
})();
