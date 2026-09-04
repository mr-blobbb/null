/* NULL — schedule.js (page)
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

    /* live strip — only when looking at the real today */
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
      hosts.grid.appendChild(editorGrid(blocks));
      return;
    }
    var now = new Date();
    var lv = liveMode ? S.live(blocks, now) : null;
    lastNow = lv && lv.block ? lv.i : -1;
    lastPass = lv && lv.block && lv.passing ? lv.i : null;
    hosts.grid.appendChild(S.grid(blocks, lastNow, { live: liveMode, passing: lastPass }));
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
    }, [d.icon("pen"), "Edit names & lunch"]);
    btn.addEventListener("click", function () {
      editing = true;
      buildEditBar();
      paintGrid(S.blocksFor(S.weekType(chosen)), false);
      hosts.editPanel.style.display = "";
    });
    hosts.editBar.appendChild(btn);
  }

  function editorGrid(blocks) {
    var c = S.conf();
    var wrap = d.h("div", { class: "sched-editor" });

    /* lunch selector */
    var lunchRow = d.h("div", { class: "ed-row ed-lunch" }, [
      d.h("div", { class: "ed-txt" }, [
        d.h("b", null, "Lunch period"),
        d.h("span", null, "Pick which of periods 4\u20136 you have lunch. That block reads Lunch; the others stay editable."),
      ]),
      d.h("div", { class: "seg lunch-seg", role: "group", "aria-label": "Lunch period" }, [4, 5, 6].map(function (n) {
        return d.h("button", {
          type: "button",
          class: "chip chip-btn" + (c.lunch === n ? " on" : ""),
          "data-lunch": String(n),
          onclick: function () {
            wrap.querySelectorAll("[data-lunch]").forEach(function (b) {
              b.classList.toggle("on", b.dataset.lunch === String(n));
            });
          },
        }, "Period " + n);
      })),
    ]);
    wrap.appendChild(lunchRow);

    /* name inputs */
    blocks.forEach(function (b) {
      var label;
      var input = null;
      if (b.fixed) {
        label = d.h("span", { class: "s-name fixed" }, b.name + (b.lunch ? "" : " \u2014 fixed"));
      } else {
        input = d.h("input", {
          type: "text",
          class: "ed-input",
          maxlength: 34,
          value: b.name,
          placeholder: S.defaultName(b.n),
          "aria-label": "Name for period " + b.n,
        });
        label = input;
      }
      var row = d.h("div", { class: "sched-row ed-row" + (b.lunch ? " lunch" : "") }, [
        d.h("span", { class: "s-no" }, b.n ? "P" + b.n : "\u2014"),
        label,
        d.h("span", { class: "s-time" }, S.spanText(b)),
      ]);
      wrap.appendChild(row);
    });

    /* save / cancel */
    var foot = d.h("div", { class: "ed-foot" }, [
      d.h("span", { class: "hint" }, "Changes save to this browser only."),
      d.h("span", { class: "sp" }),
      d.h("button", { type: "button", class: "btn btn-ghost btn-sm", id: "edCancel" }, "Cancel"),
      d.h("button", { type: "button", class: "btn btn-primary btn-sm", id: "edSave" }, [d.icon("check"), "Save"]),
    ]);
    wrap.appendChild(foot);

    var sel = wrap.querySelector("[data-lunch=\"" + c.lunch + "\"]");
    if (sel) sel.classList.add("on");

    /* bind save/cancel after insertion */
    setTimeout(function () {
      var save = wrap.querySelector("#edSave");
      var cancel = wrap.querySelector("#edCancel");
      if (cancel) {
        cancel.addEventListener("click", function () {
          editing = false;
          buildEditBar();
          hosts.editPanel.style.display = "none";
          paintBody();
        });
      }
      if (save) {
        save.addEventListener("click", function () {
          var names = {};
          var lunch = 5;
          var on = wrap.querySelector(".seg [data-lunch].on");
          if (on) lunch = parseInt(on.dataset.lunch, 10);
          wrap.querySelectorAll(".ed-input").forEach(function (inp, idx) {
            var row = inp.closest(".sched-row");
            var n = row ? parseInt((row.querySelector(".s-no") || { textContent: "" }).textContent.replace(/\D/g, ""), 10) : NaN;
            if (isNaN(n) || !n) return;
            var v = inp.value.trim();
            names[n] = v || S.defaultName(n);
          });
          S.saveConf({ lunch: lunch, names: names });
          editing = false;
          buildEditBar();
          hosts.editPanel.style.display = "none";
          paintBody();
          d.toast("Schedule saved", { icon: "check" });
        });
      }
    }, 0);

    return wrap;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
