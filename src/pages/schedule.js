/* NULL · schedule.js (page)
   Full schedule view: today card (Regular vs Homeroom/WIN), live now/next
   countdown, the per-day block list, and the editor for period names and
   the lunch period (4 / 5 / 6). Names + lunch choice persist locally. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;
  var S = N.schedule;

  var chosen = null; // weekday index 1..5
  var editing = false;
  var timer = null;
  var lastNow = -1;
  var lastPass = null;
  var hosts = {};

  function init() {
    hosts = {
      chips: d.qs("#schedChips"),
      today: d.qs("#todayCard"),
      live: d.qs("#liveBox"),
      grid: d.qs("#schedGridBox"),
      note: d.qs("#schedNote"),
      editBar: d.qs("#editBar"),
      editPanel: d.qs("#editPanel"),
    };
    if (!hosts.grid) return;

    var today = S.todayInfo();
    chosen = today.wi >= 1 && today.wi <= 5 ? today.wi : 1;

    buildEditBar();
    paintChips();
    paintBody();

    N.bus.on("sched", function () {
      if (!editing) paintBody();
    });
  }

  /* ---------- chips ---------- */
  function paintChips() {
    hosts.chips.textContent = "";
    hosts.chips.appendChild(
      S.dayChips(chosen, function (wi) {
        chosen = wi;
        paintChips();
        paintBody();
      }),
    );
  }

  function isRealToday() {
    return chosen === new Date().getDay();
  }

  /* ---------- body ---------- */
  function paintBody() {
    var type = S.weekType(chosen) || "reg";
    var blocks = S.blocksFor(type);

    /* today card */
    hosts.today.textContent = "";
    hosts.today.appendChild(S.todayCard(chosen));

    /* live strip: only when looking at the real today */
    hosts.live.textContent = "";
    hosts.live.style.display = isRealToday() && S.weekType(chosen) ? "" : "none";
    if (isRealToday() && S.weekType(chosen)) {
      var ls = S.liveStrip(blocks);
      hosts.live.appendChild(ls.el);
      paintLive(ls);
      startTimer(ls);
    } else {
      stopTimer();
    }

    /* grid */
    paintGrid(blocks, isRealToday());

    /* note */
    hosts.note.textContent =
      "Be sure to be on time, if you're late, it means less time to play here!";
  }
  function paintLive(ls) {
    if (!ls) return;
    var now = new Date();
    var lv = S.live(S.blocksFor(S.weekType(chosen)), now);
    ls.paint(lv);
    var i = lv.block ? lv.i : -1;
    var pass = lv.block && lv.passing ? lv.i : null;
    if ((i !== lastNow || pass !== lastPass) && !editing) {
      lastNow = i;
      lastPass = pass;
      /* rebuild so the passing-period row appears/disappears in place */
      var blocks = S.blocksFor(S.weekType(chosen));
      var g = S.grid(blocks, i, { live: true, passing: pass });
      hosts.grid.textContent = "";
      hosts.grid.appendChild(g);
    }
  }

  function paintGrid(blocks, liveMode) {
    hosts.grid.textContent = "";
    if (editing) {
      hosts.grid.appendChild(editorGrid());
      return;
    }
    var now = new Date();
    var lv = liveMode ? S.live(blocks, now) : null;
    lastNow = lv && lv.block ? lv.i : -1;
    lastPass = lv && lv.block && lv.passing ? lv.i : null;
    hosts.grid.appendChild(S.grid(blocks, lastNow, { live: liveMode, passing: lastPass }));
  }

  /* leave the editor and put the real schedule back on screen */
  function leave() {
    editing = false;
    buildEditBar();
    hosts.editPanel.style.display = "none";
    paintBody();
  }

  /* ---------- ticking ---------- */
  function startTimer(ls) {
    stopTimer();
    timer = setInterval(function () {
      if (document.hidden) return;
      paintLive(ls);
    }, 1000);
  }
  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  /* ---------- editor ---------- */
  function buildEditBar() {
    hosts.editBar.textContent = "";
    var btn = d.h("button", {
      type: "button",
      class: "btn btn-outline btn-sm",
      id: "editBtn",
    }, [d.icon("pen"), editing ? "Editing the schedule" : "Edit the schedule"]);
    btn.addEventListener("click", function () {
      if (editing) return;
      editing = true;
      buildEditBar();
      paintGrid(S.blocksFor(S.weekType(chosen)), false);
      hosts.editPanel.style.display = "";
      hosts.editPanel.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    hosts.editBar.appendChild(btn);
  }

  /* The panel edits one day type's bell schedule at a time: names, start and
     end times, which period is lunch, plus adding and removing periods. It
     works on a draft, and Save runs the rules in N.schedule.check first, so a
     period with no time, an end before its start or a period that starts
     inside the one before it never reaches storage. */
  function editorGrid() {
    var type = S.weekType(chosen) || "reg";
    var c = S.conf();
    var draft = S.timesFor(type);
    var names = Object.assign({}, c.names);
    var lunch = c.lunch;

    var rowsHost = d.h("div", { class: "sched-editor" });
    var errBox = d.h("div", { class: "ed-errs", hidden: true });
    var lunchSeg = d.h("div", { class: "seg lunch-seg", role: "group", "aria-label": "Lunch period" });
    var wrap = d.h("div", null, []);

    /* a row is fixed only while it is wearing a name it does not own: WIN
       and whichever period lunch is */
    function fixedFor(t) {
      if (t.key === "win") return "Homeroom/WIN";
      if (t.n === lunch) return "Lunch";
      return null;
    }

    function timeField(value, label, onInput) {
      var input = d.h("input", {
        type: "text",
        class: "ed-input ed-time",
        value: value,
        inputmode: "numeric",
        placeholder: "7:45",
        "aria-label": label,
      });
      input.addEventListener("input", function () {
        onInput(input.value);
      });
      return input;
    }

    function paintLunch() {
      lunchSeg.textContent = "";
      var options = draft.filter(function (t) {
        return t.n >= 4 && t.n <= 6;
      });
      if (!options.length) {
        lunchSeg.appendChild(d.h("span", { class: "hint" }, "No period 4, 5 or 6 on this day."));
        return;
      }
      options.forEach(function (t) {
        lunchSeg.appendChild(
          d.h(
            "button",
            {
              type: "button",
              class: "chip chip-btn" + (lunch === t.n ? " on" : ""),
              onclick: function () {
                lunch = t.n;
                paintLunch();
                paintRows();
              },
            },
            "Period " + t.n,
          ),
        );
      });
    }

    function paintRows() {
      rowsHost.textContent = "";
      draft.forEach(function (t, i) {
        var fixed = fixedFor(t);
        var nameEl;
        if (fixed) {
          nameEl = d.h("span", { class: "s-name fixed" }, fixed + (t.key === "win" ? "" : ": lunch"));
        } else {
          nameEl = d.h("input", {
            type: "text",
            class: "ed-input",
            maxlength: 34,
            value: names[t.n] || "",
            placeholder: S.defaultName(t.n),
            "aria-label": "Name for period " + t.n,
          });
          nameEl.addEventListener("input", function () {
            names[t.n] = nameEl.value.trim();
          });
        }

        var x = d.h(
          "button",
          { type: "button", class: "ed-x", title: "Remove this period", "aria-label": "Remove this period" },
          [d.icon("x")],
        );
        x.addEventListener("click", function () {
          draft.splice(i, 1);
          paintLunch();
          paintRows();
        });

        rowsHost.appendChild(
          d.h("div", { class: "sched-row ed-row ed-times-row" + (t.n === lunch ? " lunch" : "") }, [
            d.h("span", { class: "s-no" }, t.n ? "P" + t.n : "-"),
            nameEl,
            d.h("span", { class: "ed-times" }, [
              timeField(t.start, "Start time for " + (t.n ? "period " + t.n : "homeroom"), function (v) {
                t.start = v;
              }),
              d.h("i", null, "to"),
              timeField(t.end, "End time for " + (t.n ? "period " + t.n : "homeroom"), function (v) {
                t.end = v;
              }),
            ]),
            x,
          ]),
        );
      });

      /* add a period: numbered after the last one, slotted right after the
         last bell, so the row it makes already passes validation */
      var add = d.h("button", { type: "button", class: "btn btn-outline btn-sm" }, "Add a period");
      add.addEventListener("click", function () {
        var sug = S.suggest(draft);
        draft.push({ n: sug.n, start: sug.start, end: sug.end });
        paintLunch();
        paintRows();
      });
      rowsHost.appendChild(d.h("div", { class: "ed-add" }, [add]));
    }

    function fail(errs) {
      errBox.textContent = "";
      errBox.hidden = false;
      errs.slice(0, 6).forEach(function (m) {
        errBox.appendChild(d.h("p", null, [d.icon("warn"), m]));
      });
      if (errs.length > 6) {
        errBox.appendChild(d.h("p", null, [d.icon("warn"), "...and " + (errs.length - 6) + " more."]));
      }
      errBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    function save() {
      var clean = draft.map(function (t) {
        var row = { start: String(t.start || "").trim(), end: String(t.end || "").trim() };
        if (t.key) row.key = t.key;
        else row.n = t.n;
        return row;
      });
      var errs = S.check(clean);
      if (errs.length) {
        fail(errs);
        return;
      }
      errBox.hidden = true;
      var types = c.types || {};
      types[type] = clean;
      S.saveConf({ lunch: lunch, names: names, types: types });
      leave();
      d.toast("Schedule saved", { icon: "check" });
    }

    var reset = d.h("button", { type: "button", class: "btn btn-ghost btn-sm" }, [d.icon("refresh"), "School defaults"]);
    var foot = d.h("div", { class: "ed-foot" }, [
      d.h("span", { class: "hint" }, "Changes save to this browser only."),
      d.h("span", { class: "sp" }),
      reset,
      d.h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: leave }, "Cancel"),
      d.h("button", { type: "button", class: "btn btn-primary btn-sm", onclick: save }, [d.icon("check"), "Save"]),
    ]);

    wrap.appendChild(
      d.h("div", { class: "ed-row ed-lunch" }, [
        d.h("div", { class: "ed-txt" }, [
          d.h("b", null, "Lunch period"),
          d.h("span", null, "Which of periods 4-6 you have lunch. That row reads Lunch and keeps its time editable."),
        ]),
        lunchSeg,
      ]),
    );
    wrap.appendChild(
      d.h("p", { class: "ed-hint" }, "Times are written the way a bell schedule reads: 7:45, 12:30, 1:20. Periods cannot overlap and cannot end before they start."),
    );
    wrap.appendChild(errBox);
    wrap.appendChild(rowsHost);
    wrap.appendChild(foot);

    reset.addEventListener("click", function () {
      draft = (S.TEMPLATES[type] || S.TEMPLATES.reg).map(function (t) {
        return t.key ? { key: t.key, start: t.start, end: t.end } : { n: t.n, start: t.start, end: t.end };
      });
      errBox.hidden = true;
      paintLunch();
      paintRows();
      d.toast("Back to the sample bell schedule");
    });

    paintLunch();
    paintRows();
    return wrap;
  }


  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
