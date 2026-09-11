/* NULL — daily.js
   The daily loop on top of the economy: a once-a-day crate (a real modal
   with a spinning reel), three rotating daily quests and the permanent
   achievement list. Everything pays coins; nothing is bought or uploaded. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  function fmtTime(sec) {
    var m = Math.floor(sec / 60);
    if (m < 60) return m + "m";
    var h = Math.floor(m / 60);
    var rm = m % 60;
    return h + "h" + (rm ? " " + rm + "m" : "");
  }

  /* claimable first, then still-in-progress, then already paid out, so the
     next thing to do is always at the top of the list */
  function order(list) {
    function rank(x) {
      return x.claimed ? 2 : x.done ? 0 : 1;
    }
    return list.slice().sort(function (a, b) {
      return rank(a) - rank(b);
    });
  }

  /* ---------- shared progress row ----------
     Used by both the quests list and the achievements list: icon, name,
     hint, a bar, and either a Claim button, a "Claimed" chip or the prize. */
  function progRow(item, iconName, opts) {
    var pct = Math.max(4, Math.round((item.prog / item.goal) * 100));
    var side;
    if (item.claimed) {
      side = d.h("span", { class: "chip ok" }, [d.h("span", { class: "dot" }), "Claimed"]);
    } else if (item.done) {
      side = d.h(
        "button",
        {
          type: "button",
          class: "btn btn-primary btn-sm pg-claim",
          onclick: function () {
            var r = opts.claim(item.id);
            if (!r.ok) return;
            d.toast("+" + r.reward + " coins", { icon: "coin" });
            if (N.fx && N.fx.confetti) N.fx.confetti();
            if (opts.after) opts.after();
          },
        },
        ["Claim +" + item.reward],
      );
    } else {
      side = d.h("span", { class: "chip price-chip" }, [d.icon("coin"), String(item.reward)]);
    }

    return d.h(
      "div",
      { class: "pg-row" + (item.done && !item.claimed ? " ready" : "") + (item.claimed ? " done" : "") },
      [
        d.h("div", { class: "pg-ic" }, [d.icon(iconName)]),
        d.h("div", { class: "pg-main" }, [
          d.h("div", { class: "pg-top" }, [
            d.h("b", null, item.name),
            d.h("span", { class: "pg-meta" }, opts.label(item)),
          ]),
          d.h("div", { class: "pg-sub" }, item.hint),
          d.h(
            "div",
            {
              class: "pg-bar",
              role: "progressbar",
              "aria-label": item.name + " progress",
              "aria-valuemin": 0,
              "aria-valuemax": item.goal,
              "aria-valuenow": item.prog,
            },
            [d.h("i", { style: { width: pct + "%" } })],
          ),
        ]),
        d.h("div", { class: "pg-side" }, [side]),
      ],
    );
  }

  /* ---------- quests ---------- */
  function questList(after) {
    var box = d.h("div", { class: "pg-list" });
    order(N.econ.quests()).forEach(function (q) {
      box.appendChild(
        progRow(q, "zap", {
          claim: N.econ.claimQuest,
          after: after,
          label: function (it) {
            if (it.metric === "secs") return fmtTime(it.prog) + " / " + fmtTime(it.goal);
            return it.prog + " / " + it.goal;
          },
        }),
      );
    });
    return box;
  }

  /* ---------- achievements ---------- */
  function achList(after) {
    var box = d.h("div", { class: "pg-list" });
    order(N.econ.achievements()).forEach(function (a) {
      box.appendChild(
        progRow(a, "trophy", {
          claim: N.econ.claimAch,
          after: after,
          label: function (it) {
            return it.claimed ? it.goal + " / " + it.goal : it.prog + " / " + it.goal;
          },
        }),
      );
    });
    return box;
  }

  /* ---------- crate modal ---------- */
  function prizeTable() {
    var row = d.h("div", { class: "crate-tiers" });
    N.econ.spinPool.forEach(function (p) {
      row.appendChild(
        d.h("span", { class: "chip" + (p.amount >= 75 ? " accent" : "") }, [
          d.icon(p.type === "xp" ? "boost" : "coin"),
          p.type === "xp" ? p.amount + " XP" : String(p.amount),
        ]),
      );
    });
    return row;
  }

  function openCrate(after) {
    var can = N.econ.canSpin();
    var st = N.econ.state();

    var reel = d.h("div", { class: "crate-num" }, can ? "?" : "\u2014");
    var note = d.h(
      "p",
      { class: "crate-note" },
      can
        ? "Day " + st.spinStreak + " streak \u00b7 +" + Math.min(25, (st.spinStreak - 1) * 5) + " bonus coins"
        : "Streak: " + st.spinStreak + " day" + (st.spinStreak === 1 ? "" : "s") + " \u00b7 back tomorrow",
    );
    var btn = d.h(
      "button",
      { type: "button", class: "btn btn-primary crate-btn", disabled: !can },
      can ? [d.icon("gift"), "Open the crate"] : [d.icon("check"), "Opened today"],
    );

    var box = d.h("div", { class: "crate-box" }, [d.h("span", { class: "crate-ic" }, [d.icon("gift")])]);
    var body = d.h("div", { class: "crate" }, [
      box,
      reel,
      note,
      btn,
      d.h("p", { class: "crate-cap" }, "What's inside"),
      prizeTable(),
    ]);

    if (can) {
      btn.addEventListener("click", function () {
        var res = N.econ.spin();
        if (!res.ok) return;
        btn.disabled = true;
        btn.textContent = "Opening\u2026";
        box.classList.add("rolling");
        reel.classList.add("rolling");

        /* tease a few values, then land on the real prize */
        var ticks = 0;
        var iv = setInterval(function () {
          ticks++;
          var p = N.econ.spinPool[Math.floor(Math.random() * N.econ.spinPool.length)];
          reel.textContent = p.type === "xp" ? p.amount + " XP" : String(p.amount);
          if (ticks < 14) return;
          clearInterval(iv);
          box.classList.remove("rolling");
          box.classList.add("open");
          reel.classList.remove("rolling");
          reel.classList.add("won");
          reel.textContent = res.type === "xp" ? res.amount + " XP" : res.amount + " coins";
          note.textContent =
            "Nice!" +
            (res.bonus ? " +" + res.bonus + " streak bonus" : "") +
            " \u00b7 spend it in the Shop";
          btn.textContent = "See you tomorrow";
          d.toast("Crate: +" + res.amount + (res.type === "xp" ? " XP" : " coins"), { icon: "coin" });
          if (N.fx && N.fx.confetti) N.fx.confetti();
          if (after) after();
        }, 80);
      });
    }

    N.modal.open({
      title: "Daily crate",
      icon: "gift",
      body: body,
      actions: [{ label: "Done", variant: "outline" }],
    });
  }

  /* ---------- home strip ----------
     A compact card: how the crate is looking, how many quests are ready, and
     a way into the Shop for the full list. */
  function homeStrip() {
    var host = d.qs("#dailyStrip");
    if (!host) return;
    var st = N.econ.state();
    var quests = N.econ.quests();
    var ready = quests.filter(function (q) {
      return q.done && !q.claimed;
    }).length;
    var done = quests.filter(function (q) {
      return q.claimed;
    }).length;

    host.textContent = "";
    host.classList.toggle("ready", st.canSpin || ready > 0);
    host.appendChild(d.h("div", { class: "daily-ic" }, [d.icon("gift")]));
    host.appendChild(
      d.h("div", { class: "daily-txt" }, [
        d.h("b", null, "Daily crate"),
        d.h(
          "span",
          null,
          st.canSpin
            ? "One free open today \u00b7 day " + st.spinStreak + " streak"
            : "Opened today \u00b7 streak " + st.spinStreak,
        ),
      ]),
    );
    host.appendChild(
      d.h("div", { class: "daily-chips" }, [
        d.h("span", { class: "chip" }, "Quests " + done + "/" + quests.length),
        ready ? d.h("span", { class: "chip accent" }, ready + " to claim") : null,
        st.streak ? d.h("span", { class: "chip" }, [d.icon("star"), st.streak + " day streak"]) : null,
      ]),
    );
    var acts = d.h("div", { class: "daily-acts" });
    if (st.canSpin) {
      acts.appendChild(
        d.h("button", { type: "button", class: "btn btn-primary btn-sm", onclick: function () {
            openCrate(refresh);
          } }, [d.icon("gift"), "Open"]),
      );
    }
    acts.appendChild(d.h("a", { class: "btn btn-outline btn-sm", href: "/shop" }, [d.icon("store"), "Quests"]));
    host.appendChild(acts);
  }

  function refresh() {
    if (d.qs("#dailyStrip")) homeStrip();
    N.bus.emit("daily");
  }

  N.daily = {
    openCrate: openCrate,
    homeStrip: homeStrip,
    questList: questList,
    achList: achList,
    refresh: refresh,
  };

  /* keep the home strip honest when coins/progress change anywhere */
  N.bus.on("eco", function () {
    if (d.qs("#dailyStrip")) homeStrip();
  });
  N.bus.on("sync", function () {
    if (d.qs("#dailyStrip")) homeStrip();
  });
})();
