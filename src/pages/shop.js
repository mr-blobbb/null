/* NULL · shop.js
   The Shop page: shows the local economy (playtime → XP → coins) and lets
   coins unlock beta games, theme accents, the XP boost and effects. All
   state lives in null:eco: nothing is purchased with real money. */
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

  function betas() {
    return (window.NULL_CONTENT && window.NULL_CONTENT.betas) || [];
  }

  function betaEntry(b) {
    return {
      id: b.id,
      name: b.name,
      desc: b.desc,
      file: b.file,
      thumb: b.thumb || null,
      labels: b.labels || [],
    };
  }

  /* ---------- buying ---------- */
  function buy(type, id, name, price) {
    var st = N.econ.state();
    if (st.coins < price) {
      d.toast("Not enough coins yet. Keep playing to earn more!", { type: "err", icon: "coin" });
      return;
    }
    N.modal.confirm({
      title: "Unlock " + name + "?",
      icon: "coin",
      body:
        "<p>This spends <b>" + price + " coins</b>. You have <b>" + st.coins + "</b>.</p>" +
        "<p style='color:var(--text-2)'>Everything is local: reloading or switching devices keeps your unlocks in this browser only.</p>",
      okLabel: "Buy for " + price,
      onOk: function () {
        var r = N.econ.buy(type, id);
        if (!r.ok) {
          d.toast(r.reason === "not enough coins" ? "Not enough coins yet." : "Could not unlock that.", { type: "err" });
          return;
        }
        d.toast("Unlocked: " + name, { icon: "check" });
        if (N.fx && N.fx.confetti) N.fx.confetti();
        render();
        /* owning every last thing in the shop rolls the credits, once */
        if (N.econ.shopComplete && N.econ.shopComplete() && !N.flags.get("credits:shop")) {
          N.flags.set("credits:shop");
          d.toast("That was the last one. Rolling credits.", { icon: "star" });
          setTimeout(function () {
            location.href = "/credits.html";
          }, 1100);
        }
      },
    });
  }

  function priceChip(price) {
    return d.h("span", { class: "chip price-chip" }, [d.icon("coin"), String(price)]);
  }

  function buyBtn(type, id, name, price) {
    return d.h(
      "button",
      {
        type: "button",
        class: "btn btn-primary btn-sm",
        onclick: function () {
          buy(type, id, name, price);
        },
      },
      ["Unlock"],
    );
  }

  function ownedChip(text) {
    return d.h("span", { class: "chip ok" }, [d.h("span", { class: "dot" }), text || "Owned"]);
  }

  /* ---------- balance bar ---------- */
  function renderBar() {
    var host = d.qs("#ecoBar");
    if (!host) return;
    var st = N.econ.state();
    host.textContent = "";

    var sinceMilestone = st.xp % 100;
    var toNext = 100 - sinceMilestone;

    var bar = d.h("div", { class: "eco-bar glass" }, [
      d.h("div", { class: "eco-coin" }, [
        d.h("span", { class: "eco-coin-ic" }, [d.icon("coin")]),
        d.h("div", { class: "eco-coin-num" }, [
          d.h("b", null, String(st.coins)),
          d.h("span", null, "coins"),
        ]),
      ]),
      d.h("div", { class: "eco-prog" }, [
        d.h("div", { class: "eco-prog-head" }, [
          d.h("b", null, st.xp + " XP"),
          d.h("span", null, toNext + " XP until +30 coins"),
        ]),
        d.h("div", { class: "eco-track" }, [
          d.h("i", { style: { width: Math.min(100, sinceMilestone) + "%" } }),
        ]),
      ]),
      d.h("div", { class: "eco-mini" }, [d.h("b", null, fmtTime(st.time)), d.h("span", null, "time played")]),
      d.h("div", { class: "eco-mini" }, [d.h("b", null, String(st.xp)), d.h("span", null, "total XP")]),
    ]);

    if (st.boosted) {
      var left = Math.max(0, st.boostUntil - Date.now());
      var hrs = Math.floor(left / 3600000);
      var mins = Math.round((left % 3600000) / 60000);
      bar.appendChild(
        d.h("span", { class: "chip accent boost-chip" }, [
          d.icon("boost"),
          "XP boost · " + hrs + "h " + mins + "m left",
        ]),
      );
    }
    if (st.streak > 0) {
      bar.appendChild(d.h("span", { class: "chip" }, [d.icon("star"), st.streak + " day streak"]));
    }

    host.appendChild(bar);

    var note = d.h("p", { class: "eco-note" }, [
      "Every 30 minutes in the player banks 10 XP. Every 100 XP banks 30 coins.",
    ]);
    host.appendChild(note);
  }

  /* ---------- sections ---------- */
  function section(title, icon, hint) {
    var sec = d.h("section", { class: "section" });
    sec.appendChild(
      d.h("div", { class: "section-head" }, [
        d.h("h2", null, [d.icon(icon), " " + title]),
        d.h("span", { class: "hint" }, hint || ""),
      ]),
    );
    return sec;
  }

  function betaCard(b) {
    var owned = N.econ.isUnlocked("game", b.id);
    var thumb = d.h("div", { class: "shop-thumb" });
    if (b.thumb) thumb.appendChild(d.h("img", { src: b.thumb, alt: "", loading: "lazy" }));
    else thumb.appendChild(d.icon(owned ? "game" : "lock"));

    var foot = d.h("div", { class: "shop-foot" });
    if (owned) {
      foot.appendChild(ownedChip("Unlocked"));
      foot.appendChild(
        d.h(
          "button",
          {
            type: "button",
            class: "btn btn-primary btn-sm",
            onclick: function () {
              var e = betaEntry(b);
              if (b.labels && b.labels[0] === "app") N.launch.app(e);
              else N.launch.game(e);
            },
          },
          [d.icon("play"), "Play"],
        ),
      );
    } else {
      foot.appendChild(priceChip(b.price || 60));
      foot.appendChild(buyBtn("game", b.id, b.name, b.price || 60));
    }

    return d.h("article", { class: "shop-card glass" + (owned ? " owned" : "") }, [
      thumb,
      d.h("div", { class: "shop-info" }, [
        d.h("h3", null, b.name),
        d.h("p", null, b.desc || ""),
        d.h("div", { class: "chips-row" }, N.cards.chipsFor({ labels: b.labels || [] }, 2)),
      ]),
      foot,
    ]);
  }

  /* ---------- theme packs ----------
     A pack card previews the real thing: theme.js builds the same layer
     markup the live backdrop uses, scoped to the card and fed the pack's
     palette inline, so what you see is what the site becomes. */
  function packThumb(t) {
    return N.theme.packThumb(t, { lock: !N.econ.isUnlocked("theme", t.id) });
  }

  function themeCard(t) {
    var owned = N.econ.isUnlocked("theme", t.id);
    var applied = N.prefs.get("accent") === t.id;
    var foot = d.h("div", { class: "shop-foot" });
    if (owned) {
      foot.appendChild(ownedChip("Unlocked"));
      foot.appendChild(
        d.h(
          "button",
          {
            type: "button",
            class: "btn btn-outline btn-sm",
            onclick: function () {
              N.theme.setAccent(t.id);
              N.prefs.set("accent", t.id);
              if (N.seasons) N.seasons.refresh();
              d.toast((applied ? "Re-applied " : "Theme set to ") + t.name, { icon: "pen" });
              render();
            },
          },
          applied ? [d.icon("check"), "Applied"] : [d.icon("pen"), "Apply"],
        ),
      );
    } else {
      foot.appendChild(priceChip(t.price));
      foot.appendChild(buyBtn("theme", t.id, t.name, t.price));
    }

    var tags = d.h("div", { class: "chips-row" });
    (t.tags || []).forEach(function (x) {
      tags.appendChild(d.h("span", { class: "chip" }, x));
    });

    return d.h("article", { class: "shop-card pack-card glass" + (owned ? " owned" : "") + (applied ? " playing" : "") }, [
      packThumb(t),
      d.h("div", { class: "pack-strip" }, (t.colors || [t.c1, t.c2]).map(function (c) {
        return d.h("i", { style: { background: c } });
      })),
      d.h("div", { class: "shop-info" }, [
        d.h("h3", null, t.name),
        d.h("p", null, t.desc || ""),
        tags,
      ]),
      foot,
    ]);
  }

  /* ---------- background particles ----------
     Motion only, no palette: each card previews the real layer through
     theme.js, so a preview can never drift from what the site becomes. */
  function partCard(p) {
    var owned = N.econ.isUnlocked("particle", p.id);
    var applied = N.prefs.get("particles") === p.id;
    var foot = d.h("div", { class: "shop-foot" });
    if (owned) {
      foot.appendChild(ownedChip("Unlocked"));
      foot.appendChild(
        d.h(
          "button",
          {
            type: "button",
            class: "btn " + (applied ? "btn-primary" : "btn-outline") + " btn-sm",
            onclick: function () {
              setParts(applied ? "none" : p.id);
            },
          },
          applied ? [d.icon("check"), "Applied"] : [d.icon("pen"), "Apply"],
        ),
      );
    } else {
      foot.appendChild(priceChip(p.price));
      foot.appendChild(buyBtn("particle", p.id, p.name, p.price));
    }

    return d.h("article", { class: "shop-card pack-card glass" + (owned ? " owned" : "") + (applied ? " playing" : "") }, [
      N.theme.partThumb(p, { lock: !owned }),
      d.h("div", { class: "pack-strip" }, (p.colors || []).map(function (c) {
        return d.h("i", { style: { background: c } });
      })),
      d.h("div", { class: "shop-info" }, [
        d.h("h3", null, p.name),
        d.h("p", null, p.desc || ""),
        d.h("div", { class: "chips-row" }, (p.tags || []).map(function (t) {
          return d.h("span", { class: "chip" }, t);
        })),
      ]),
      foot,
    ]);
  }

  /* apply a particle (or "none" to clear it) and refresh the page */
  function setParts(id) {
    N.theme.setParticles(id);
    N.prefs.set("particles", id);
    var p = N.theme.particleFor(id);
    d.toast(p ? "Particles: " + p.name : "Background particles off", { icon: "sparkle" });
    render();
  }

  function row(item, type) {
    var owned = N.econ.isUnlocked(type, item.id);
    var foot = d.h("div", { class: "shop-foot" });
    if (owned) {
      foot.appendChild(ownedChip(type === "boost" ? "Active" : "Unlocked"));
    } else {
      foot.appendChild(priceChip(item.price));
      foot.appendChild(buyBtn(type, item.id, item.name, item.price));
    }
    return d.h("div", { class: "shop-row glass" + (owned ? " owned" : "") }, [
      d.h("div", { class: "shop-row-ic" }, [d.icon(type === "boost" ? "boost" : "sparkle")]),
      d.h("div", { class: "shop-row-txt" }, [d.h("b", null, item.name), d.h("span", null, item.desc || "")]),
      foot,
    ]);
  }

  /* the two fx unlocks that need somewhere to go once they're owned: the
     background image is set in Settings, the editor opens right here */
  function fxRow(f) {
    var owned = N.econ.isUnlocked("fx", f.id);
    var box = row(f, "fx");
    if (owned && f.id === "custombg") {
      box.querySelector(".shop-foot").appendChild(
        d.h("a", { class: "btn btn-outline btn-sm", href: "/settings.html" }, [d.icon("settings"), "Settings"]),
      );
    }
    return box;
  }

  /* the editor, once it's owned: one row that says what's built and opens it */
  function editorSection() {
    var sec = section("Your theme & particles", "wrench", "built here, saved to this browser");
    var mine = N.theme.craftPack ? N.theme.craftPack() : null;
    var mineP = N.theme.craftPart ? N.theme.craftPart() : null;
    var art = (N.theme.ART || []).find(function (a) {
      return mine && a.id === mine.art;
    });
    var what = [];
    if (mine) what.push(mine.name + " (" + (art ? art.name : "backdrop") + ")");
    if (mineP) what.push(mineP.name);
    var foot = d.h("div", { class: "shop-foot" }, [
      d.h(
        "button",
        {
          type: "button",
          class: "btn btn-primary btn-sm",
          onclick: function () {
            if (N.editor) N.editor.open(render);
          },
        },
        [d.icon("wrench"), mine || mineP ? "Open editor" : "Build something"],
      ),
    ]);
    sec.appendChild(
      d.h("div", { class: "shop-rows" }, [
        d.h("div", { class: "shop-row glass ready" }, [
          d.h("div", { class: "shop-row-ic" }, [d.icon("pen")]),
          d.h("div", { class: "shop-row-txt" }, [
            d.h("b", null, "Theme & particle editor"),
            d.h(
              "span",
              null,
              what.length
                ? "Yours so far: " + what.join(" · ")
                : "Nothing built yet. Pick four colors, a backdrop and what drifts through it.",
            ),
          ]),
          foot,
        ]),
      ]),
    );
    return sec;
  }

  /* ---------- daily loop ---------- */
  function dailyRow() {
    var st = N.econ.state();
    var box = d.h("div", { class: "shop-rows" });
    var foot = d.h("div", { class: "shop-foot" });
    if (st.canSpin) {
      foot.appendChild(
        d.h(
          "button",
          {
            type: "button",
            class: "btn btn-primary btn-sm",
            onclick: function () {
              N.daily.openCrate(render);
            },
          },
          [d.icon("gift"), "Open"],
        ),
      );
    } else {
      foot.appendChild(ownedChip("Opened today"));
    }
    box.appendChild(
      d.h("div", { class: "shop-row glass" + (st.canSpin ? " ready" : "") }, [
        d.h("div", { class: "shop-row-ic" }, [d.icon("gift")]),
        d.h("div", { class: "shop-row-txt" }, [
          d.h("b", null, st.canSpin ? "A crate is waiting" : "Crate opened today"),
          d.h(
            "span",
            null,
            "Day " + st.spinStreak + " streak · 5-75 coins or 20 XP, with a streak bonus",
          ),
        ]),
        foot,
      ]),
    );
    return box;
  }

  /* ---------- render ---------- */
  function render() {
    renderBar();
    var body = d.qs("#shopBody");
    if (!body) return;
    body.textContent = "";
    var st = N.econ.state();
    var achs = N.econ.achievements();
    var won = achs.filter(function (a) {
      return a.claimed;
    }).length;

    var crateSec = section("Daily crate", "gift", st.canSpin ? "waiting for you" : "one free open every day");
    crateSec.appendChild(dailyRow());
    body.appendChild(crateSec);

    var questSec = section(
      "Daily quests",
      "zap",
      st.questsReady ? st.questsReady + " ready to claim" : "resets at midnight",
    );
    questSec.appendChild(N.daily.questList(render));
    body.appendChild(questSec);

    var betaSec = section("Beta games", "game", "unlocked builds join your library");
    var betaGrid = d.h("div", { class: "shop-grid" });
    var list = betas();
    if (!list.length) {
      betaGrid.appendChild(N.cards.empty("No beta builds yet", "New beta games land here as they're ready."));
    } else {
      list.forEach(function (b) {
        betaGrid.appendChild(betaCard(b));
      });
    }
    betaSec.appendChild(betaGrid);
    body.appendChild(betaSec);

    var themeSec = section("Theme packs", "pen", "a palette *and* a live backdrop");
    var themeGrid = d.h("div", { class: "shop-grid" });
    N.econ.THEMES.forEach(function (t) {
      themeGrid.appendChild(themeCard(t));
    });
    themeSec.appendChild(themeGrid);
    body.appendChild(themeSec);

    var partSec = section("Background particles", "sparkle", "ambient motion on every page");
    var partGrid = d.h("div", { class: "shop-grid" });
    N.econ.PARTICLES.forEach(function (p) {
      partGrid.appendChild(partCard(p));
    });
    partSec.appendChild(partGrid);
    partSec.appendChild(
      d.h("p", { class: "eco-note" }, [
        "Motes, Haze, Twinkle and Constellation are free in Settings. These ones are the loud stuff.",
      ]),
    );
    body.appendChild(partSec);

    var boostSec = section("Boosts", "boost", "speed up earning");
    var boostBox = d.h("div", { class: "shop-rows" });
    N.econ.BOOSTS.forEach(function (b) {
      boostBox.appendChild(row(b, "boost"));
    });
    boostSec.appendChild(boostBox);
    body.appendChild(boostSec);

    var fxSec = section("Effects", "sparkle", "cosmetic unlocks");
    var fxBox = d.h("div", { class: "shop-rows" });
    N.econ.FX.forEach(function (f) {
      fxBox.appendChild(fxRow(f));
    });
    fxSec.appendChild(fxBox);
    fxSec.appendChild(
      d.h("p", { class: "eco-note" }, [
        "The background image unlocks a picture picker in Settings; the editor unlocks the section right below this one.",
      ]),
    );
    body.appendChild(fxSec);

    if (N.econ.isUnlocked("fx", "editor") && N.editor) body.appendChild(editorSection());

    var achSec = section(
      "Achievements",
      "trophy",
      st.achReady ? st.achReady + " ready to claim" : won + " of " + achs.length + " unlocked",
    );
    achSec.appendChild(N.daily.achList(render));
    body.appendChild(achSec);
  }

  function init() {
    if (!N.econ || !N.daily) return;
    render();
    /* coins earned or spent in another NULL window show up here live, and any
       quest / achievement claim anywhere repaints the list */
    N.bus.on("sync", render);
    N.bus.on("eco", render);
    N.bus.on("daily", render);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();