/* NULL · settings.js
   Binds every control on /settings, and owns the page's own chrome: the
   section rail with its filter and scroll-spy, plus the fold state of the
   cards that are only set once.

   Recently played has its own clear button on the home page, and the Danger
   Zone holds whole-app resets only. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var FOLD_KEY = "null:setFolds";
  /* the narrowest window the side rail is drawn in (extra.css agrees: its
     rail block is a min-width query on the same number) */
  var RAIL_MIN = 420;
  var inited = false;
  var filterQ = "";
  var accentDot = null;

  /* what each performance tier actually does, said once */
  var PERF_NOTE = {
    off: "Everything NULL has: full motion, glow, blur, backdrops and particles.",
    on: "Animations shortened, hover movement, glow and shadows dropped, and the theme backdrop and particles stay off.",
    ultra:
      "Nothing animated at all, no particles, no glow, no blur, and only what is on screen is drawn. Most visual settings stop doing anything while this is on.",
  };

  /* ---------- small helpers ---------- */
  function show(el, on) {
    if (el) el.hidden = !on;
  }
  function setText(sel, text) {
    var el = d.qs(sel);
    if (el) el.textContent = text;
  }
  /* one segment group, one selected option */
  function segPaint(sel, val) {
    d.qsa(sel + " button").forEach(function (b) {
      b.classList.toggle("on", b.dataset.val === val);
    });
  }

  /* ============================================================
     paint: read the prefs back onto every control
     ============================================================ */
  function refresh() {
    var p = N.prefs.data;
    paintTheme(p);
    buildAccentRow();
    paintAccent(p);
    paintPerf(p);
    paintDensity();
    paintNavLayout();
    paintClock();
    paintMini();
    paintGlow();
    paintSeason();
    paintSeasonPick();
    paintBg();
    paintEditorRow();
    paintCustom();
    paintSmart();
    paintTab();
    paintCloak();
    paintPanic();
    paintExtras(p);
    paintInstall();
    paintData();
    paintPacks();
    paintParts();
    /* a rebuild drops the filter's classes, so put them back */
    if (filterQ) applyFilter(filterQ);
  }

  /* ---------- theme ---------- */
  function paintTheme(p) {
    var light = p.theme === "light";
    var sw = d.qs("#themeSwitch");
    if (sw) sw.checked = light;
    setText("#themeHint", light ? "Light, NULL inverted." : "Dark, NULL's default.");
  }

  /* ---------- accent ----------
     Rebuilt, not filled once: the Shop's custom-colour unlock adds its own
     swatch, and that can happen while this page is open (a dev-console
     grant, or another NULL window). */
  function buildAccentRow() {
    var row = d.qs("#accentRow");
    if (!row) return;
    row.textContent = "";
    var plain = document.documentElement.dataset.theme === "light" ? "#1c1d21" : "#e8eaef";
    function swatch(id, name, bg) {
      var b = d.h("button", { type: "button", class: "swatch-btn", "data-val": id, title: name }, [
        d.h("span", { class: "accent-dot", style: { background: bg } }),
        name,
      ]);
      b.addEventListener("click", function () {
        N.prefs.set("accent", id);
        N.theme.setAccent(id);
        if (N.seasons) N.seasons.refresh(); /* re-assert seasonal colours when accent = off */
        refresh();
      });
      row.appendChild(b);
    }
    N.theme.ACCENTS.forEach(function (a) {
      swatch(a.id, a.name, a.c1 || plain);
    });
    if (N.theme.customOn && N.theme.customOn()) {
      swatch("custom", "Custom", N.prefs.get("accentColor") || "#6cc7ff");
    }
  }

  function paintAccent(p) {
    d.qsa("#accentRow .swatch-btn").forEach(function (b) {
      b.classList.toggle("on", b.dataset.val === p.accent);
    });
    var all = N.theme.ACCENTS.concat(N.theme.extraAccents());
    var a = all.filter(function (x) {
      return x.id === p.accent;
    })[0];
    setText("#accentHint", a ? a.name : "One colour, or a whole theme pack.");
    var hex = p.accentColor || "#6cc7ff";
    var swatch = d.qs("#accentRow .swatch-btn[data-val=\"custom\"] .accent-dot");
    if (swatch) swatch.style.background = hex;
    if (accentDot) accentDot.setValue(hex);
  }

  /* ---------- performance ---------- */
  function paintPerf(p) {
    var level = p.perf === "ultra" ? "ultra" : p.perf ? "on" : "off";
    segPaint("#perfSeg", level);
    setText("#perfNote", PERF_NOTE[level]);
  }

  function paintDensity() {
    segPaint("#densitySeg", N.prefs.get("density") || "regular");
  }

  function paintNavLayout() {
    segPaint("#navSeg", N.prefs.get("navLayout") === "side" ? "side" : "bar");
  }

  function paintClock() {
    var sw = d.qs("#clockSwitch");
    if (sw) sw.checked = N.prefs.get("showClock") !== false;
  }

  function paintMini() {
    var sw = d.qs("#miniPerfSwitch");
    if (sw) sw.checked = !!N.prefs.get("miniPerf");
  }

  /* ---------- glow border ---------- */
  function glowName(id) {
    var g = (N.theme.GLOWS || []).filter(function (x) {
      return x.id === id;
    })[0];
    return (g && g.name) || "Off";
  }

  function paintGlow() {
    var id = N.prefs.get("glow");
    var sel = d.qs("#glowSelect");
    if (sel) {
      sel.value = id;
      N.dom.selSync(sel);
    }
    show(d.qs("#glowCustom"), id === "custom");
    var keys = ["glowColor1", "glowColor2"];
    d.qsa("#glowColors .cdot").forEach(function (dot, i) {
      if (dot.setValue) dot.setValue(N.prefs.get(keys[i]) || (i ? "#a86bff" : "#35c3f2"));
    });
    var sw = d.qs("#cometSwitch");
    if (sw) sw.checked = !!N.prefs.get("glowComet");
    setText("#glowVal", id === "custom" ? "Custom" : glowName(id));
  }

  /* ---------- seasonal theme ---------- */
  function seasonLabel(id) {
    if (!id || !N.seasons || !N.seasons.options) return null;
    var t = N.seasons.options().filter(function (x) {
      return x.id === id;
    })[0];
    return t ? t.label : null;
  }

  function paintSeason() {
    var on = N.prefs.data.seasonal !== false;
    var s = N.seasons ? N.seasons.now() : null;
    var sw = d.qs("#seasonalSwitch");
    if (sw) sw.checked = on;
    if (s) {
      setText("#seasonalLbl", on ? s.label + " theme on" : "Turn on " + s.label + " theme?");
      setText("#seasonalHint", s.hint + " · switches automatically with the seasons");
      var chip = d.qs("#seasonalChip");
      if (chip) {
        chip.textContent = s.label;
        show(chip, on);
      }
    }
    var pick = seasonLabel(N.prefs.get("seasonVariant"));
    setText("#seasonVal", on ? pick || (s ? s.label : "On") : "Off");
  }

  /* the themes that go with the season we're in: Fall offers Fall and
     Halloween, Winter offers Winter and Holidays. Automatic follows the
     calendar, holiday windows included. */
  function paintSeasonPick() {
    var row = d.qs("#seasonSeg");
    if (!row || !N.seasons || !N.seasons.options) return;
    var on = N.prefs.data.seasonal !== false;
    show(d.qs("#seasonPickRow"), on);
    var picked = N.prefs.get("seasonVariant") || "";
    var opts = N.seasons.options();
    row.textContent = "";
    var auto = d.h("button", { type: "button", "data-val": "", title: "Follow the calendar" }, "Automatic");
    if (!picked) auto.classList.add("on");
    row.appendChild(auto);
    opts.forEach(function (t) {
      var b = d.h("button", { type: "button", "data-val": t.id, title: t.hint }, t.label);
      if (picked === t.id) b.classList.add("on");
      row.appendChild(b);
    });
    var hint = d.qs("#seasonPickHint");
    if (hint && opts.length) {
      var autoNow = opts.filter(function (t) {
        return t.auto;
      })[0];
      hint.textContent =
        "Every theme for the season you're in: " +
        opts
          .map(function (t) {
            return t.label;
          })
          .join(", ") +
        ". " +
        (autoNow ? autoNow.label + " is what the calendar would pick today." : "");
    }
  }

  /* ---------- background image (Shop unlock) ---------- */
  function bgOn() {
    return !!(N.econ && N.econ.isUnlocked("fx", "custombg"));
  }

  function paintBg() {
    var body = d.qs("#bgBody");
    var locked = d.qs("#bgLocked");
    if (!body || !locked) return;
    var on = bgOn();
    body.hidden = !on;
    locked.hidden = on;
    var url = (N.prefs.get("bgImage") || "").trim();
    if (!on) setText("#bgVal", "Locked");
    else setText("#bgVal", url ? "Set" : "Off");
    if (!on) return;
    var p = N.prefs.data;
    var field = d.qs("#bgUrl");
    if (field && document.activeElement !== field) field.value = p.bgImage || "";
    var fit = d.qs("#bgFit");
    if (fit) {
      fit.value = p.bgFit || "cover";
      N.dom.selSync(fit);
    }
    var dim = d.qs("#bgDim");
    if (dim) dim.value = String(p.bgDim == null ? 0.35 : p.bgDim);
    var blur = d.qs("#bgBlur");
    if (blur) blur.value = String(p.bgBlur || 0);
  }

  /* the theme & particle editor is a Shop unlock too */
  function paintEditorRow() {
    show(d.qs("#packEditorRow"), !!(N.econ && N.econ.isUnlocked("fx", "editor")));
  }

  /* ---------- smart tab cloak ---------- */
  function paintSmart() {
    var on = !!N.prefs.get("smartTab");
    var sw = d.qs("#smartTabSwitch");
    if (sw) sw.checked = on;
    show(d.qs("#smartTabWrap"), on);
    var sel = d.qs("#smartTabMin");
    if (sel) {
      sel.value = String(N.prefs.get("smartTabMin") || 5);
      N.dom.selSync(sel);
    }
  }

  /* ---------- browser tab ---------- */
  function paintTab() {
    var sel = d.qs("#tabSelect");
    if (sel) {
      sel.value = N.prefs.get("tab");
      N.dom.selSync(sel);
    }
    var cur = (N.tab && N.tab.current && N.tab.current()) || {};
    setText("#tabVal", cur.name || "Default");
    paintTabPreview();
    paintGmail();
    paintCustomTab();
  }

  function paintTabPreview() {
    var p = N.tab.current();
    var img = d.qs("#tabPrev img");
    var b = d.qs("#tabPrev .tp-name");
    var s = d.qs("#tabPrev .tp-sub");
    if (!p) return;
    if (p.icon) {
      img.src = p.icon;
      img.style.display = "";
    } else {
      img.style.display = "none";
    }
    b.textContent = N.tab.titleFor(p);
    s.textContent = p.name;
  }

  function paintCustomTab() {
    var p = N.prefs.data;
    show(d.qs("#tabCustomWrap"), p.tab === "custom");
    var ti = d.qs("#tabCustomTitle");
    if (ti && document.activeElement !== ti) ti.value = (p.tabCustom && p.tabCustom.title) || "";
    var ii = d.qs("#tabCustomIcon");
    if (ii && document.activeElement !== ii) ii.value = (p.tabCustom && p.tabCustom.icon) || "";
    var ui = d.qs("#tabCustomUrl");
    if (ui && document.activeElement !== ui) ui.value = (p.tabCustom && p.tabCustom.url) || "";
  }

  function paintGmail() {
    var p = N.prefs.data;
    show(d.qs("#gmailWrap"), p.tab === "gmail");
    var addr = d.qs("#gmailAddr");
    if (addr && document.activeElement !== addr) addr.value = p.gmailAddr;
    var unread = d.qs("#gmailUnread");
    if (unread && document.activeElement !== unread) unread.value = p.gmailUnread;
  }

  /* ---------- privacy and cloaking ---------- */
  function paintCloak() {
    var sw = d.qs("#cloakRedirectSwitch");
    var on = N.prefs.get("cloakRedirect") !== false;
    if (sw) sw.checked = on;
    setText("#cloakVal", on ? "Redirect on" : "Stays on NULL");
    var info = d.qs("#cloakTargetInfo");
    if (!info) return;
    var to = N.cloak && N.cloak.target ? N.cloak.target() : null;
    var preset = N.tab.current() || {};
    if (!on) {
      info.textContent = "Off. After cloaking, this tab stays on NULL.";
    } else if (!to) {
      info.textContent =
        "This tab preset has no real site of its own" +
        (preset.id === "custom" ? ". Add one under the custom tab fields." : ", so this tab stays on NULL.");
    } else {
      info.textContent =
        "The cloaked window opens first, then this tab goes to " + to + ", so the address bar matches the tab title.";
    }
  }

  /* ---------- library extras ---------- */
  function paintExtras(p) {
    var rsw = d.qs("#recsSwitch");
    if (rsw) rsw.checked = p.recs !== false;
    var cfsw = d.qs("#confettiSwitch");
    if (cfsw) cfsw.checked = p.confetti !== false;
    var on = [p.recs !== false, p.confetti !== false].filter(function (b) {
      return b;
    }).length;
    setText("#extrasVal", on === 0 ? "All off" : on + " of 2 on");
  }

  /* ---------- install as an app ---------- */
  function paintInstall() {
    var btn = d.qs("#installBtn");
    var hint = d.qs("#installHint");
    if (!btn || !hint || !N.install) return;
    btn.hidden = true;
    if (N.install.installed()) {
      hint.textContent = "Installed: NULL is running as its own app.";
      setText("#installVal", "Installed");
    } else if (N.install.ready()) {
      btn.hidden = false;
      hint.textContent = "This browser can install NULL right now.";
      setText("#installVal", "Ready");
    } else {
      hint.textContent = 'Not offered by the browser yet. It appears once NULL is served over https, or use "How?".';
      setText("#installVal", "Not available");
    }
  }

  /* ---------- local data summary ---------- */
  function paintData() {
    var size = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("null:") === 0) size += (localStorage.getItem(k) || "").length * 2;
      }
    } catch (err) {}
    var kb = size / 1024;
    setText(
      "#dataInfo",
      N.recent.list().length +
        " recent · " +
        N.favs.list().length +
        " favorites · ~" +
        kb.toFixed(1) +
        " KB stored locally",
    );
    setText("#dataVal", kb < 1 ? "Under 1 KB" : kb.toFixed(0) + " KB");
  }

  /* ---------- panic key ---------- */
  function paintPanic() {
    var key = N.prefs.get("panicKey") || "`";
    var cap = d.qs("#panicKey");
    if (cap) cap.textContent = key;
    setText("#panicVal", key === " " ? "Space" : key);
    var url = d.qs("#panicUrl");
    if (url && document.activeElement !== url) url.value = N.prefs.get("panicUrl") || "";
    var sw = d.qs("#panicSwitch");
    if (sw) sw.checked = (N.prefs.get("panicMode") || "single") === "double";
  }

  /* ---------- custom accent (Shop unlock) ---------- */
  function paintCustom() {
    var rowEl = d.qs("#accentCustomRow");
    if (!rowEl) return;
    var on = !!(N.theme.customOn && N.theme.customOn());
    rowEl.hidden = !on;
    if (on && accentDot) accentDot.setValue(N.prefs.get("accentColor") || "#6cc7ff");
  }

  /* ============================================================
     theme packs
     Free packs are always available; Shop packs show veiled until bought.
     Each card previews the real backdrop through theme.js, so settings and
     the Shop can never disagree about what a pack looks like. Your own
     crafted pack is the same card with an edit and a delete button added.
     ============================================================ */
  function applyPack(p) {
    if (!p) {
      N.prefs.set("accent", "off");
      N.theme.setAccent("off");
    } else {
      N.theme.setAccent(p.id);
      N.prefs.set("accent", p.id);
    }
    if (N.seasons) N.seasons.refresh();
    refresh();
    d.toast(p ? "Wearing " + p.name : "Accent back to plain", { icon: p ? "pen" : "ban" });
  }

  /* The edit + delete buttons your own pack or particle set gets. Nothing else
     about the card changes: the palette, the tint and the follow-the-theme
     toggle all live in the editor, which is where there is room for them, so a
     crafted card sits in the grid exactly like every other theme. */
  function craftBtns(kind, p) {
    var isPack = kind === "pack";
    function iconBtn(icon, label, cls, onClick) {
      return d.h(
        "button",
        { type: "button", class: "btn " + cls + " btn-sm", title: label, "aria-label": label, onclick: onClick },
        [d.icon(icon)],
      );
    }
    return [
      iconBtn("wrench", "Edit this " + (isPack ? "theme" : "particle set"), "btn-outline", function () {
        if (N.editor && N.editor.open) N.editor.open(refresh, isPack ? "theme" : "part");
        else d.toast("The editor could not load here.", { type: "err" });
      }),
      iconBtn("trash", "Delete this " + (isPack ? "theme" : "particle set"), "btn-outline-danger", function () {
        deleteCraft(kind, p);
      }),
    ];
  }

  function deleteCraft(kind, p) {
    var isPack = kind === "pack";
    N.modal.open({
      title: "Delete " + (isPack ? "your theme pack" : "your particle set") + "?",
      icon: "trash",
      iconTone: "danger",
      body:
        "<p>This removes <b>" +
        (p.name || "it") +
        "</b> from this browser for good. Anything wearing it goes back to none.</p>" +
        "<p style='color:var(--text-2)'>The editor itself stays unlocked, so you can build another one.</p>",
      actions: [
        { label: "Cancel", variant: "outline" },
        {
          label: "Delete",
          variant: "danger",
          onClick: function () {
            N.theme.removeCraft(isPack ? "pack" : "part");
            refresh();
            d.toast(isPack ? "Theme pack deleted" : "Particle set deleted", { icon: "trash" });
          },
        },
      ],
    });
  }

  function packCard(p) {
    var owned = !!(p.free || N.econ.isUnlocked("theme", p.id));
    var applied = N.prefs.get("accent") === p.id;
    var foot = d.h("div", { class: "shop-foot" });
    if (owned) {
      foot.appendChild(
        d.h("span", { class: "chip ok" }, [d.h("span", { class: "dot" }), p.free ? "Free" : p.crafted ? "Yours" : "Unlocked"]),
      );
      /* .shop-foot is space-between, so the chip keeps the left and this row
         keeps the right: same foot, same height, same card as any theme */
      var acts = d.h("div", { class: "craft-row" });
      if (p.crafted) {
        craftBtns("pack", p).forEach(function (b) {
          acts.appendChild(b);
        });
      }
      acts.appendChild(
        d.h(
          "button",
          {
            type: "button",
            class: "btn " + (applied ? "btn-primary" : "btn-outline") + " btn-sm",
            onclick: function () {
              applyPack(applied ? null : p);
            },
          },
          applied ? [d.icon("check"), "Applied"] : [d.icon("pen"), "Apply"],
        ),
      );
      foot.appendChild(acts);
    } else {
      foot.appendChild(d.h("span", { class: "chip price-chip" }, [d.icon("coin"), String(p.price)]));
      foot.appendChild(d.h("a", { class: "btn btn-outline btn-sm", href: N.url("/shop") }, [d.icon("store"), "Shop"]));
    }

    var strip = d.h(
      "div",
      { class: "pack-strip" },
      (p.colors || [p.c1, p.c2]).map(function (c) {
        return d.h("i", { style: { background: c } });
      }),
    );
    var card = d.h(
      "article",
      {
        class:
          "shop-card pack-card glass" +
          (owned ? " owned" : " locked") +
          (p.crafted ? " crafted" : "") +
          (applied ? " playing" : ""),
      },
      [
        N.theme.packThumb(p, { lock: !owned }),
        strip,
        d.h("div", { class: "shop-info" }, [
          d.h("h3", null, p.name),
          d.h("p", null, p.desc || ""),
          d.h(
            "div",
            { class: "chips-row" },
            (p.tags || []).map(function (t) {
              return d.h("span", { class: "chip" }, t);
            }),
          ),
        ]),
        foot,
      ],
    );
    return card;
  }

  function paintPacks() {
    var grid = d.qs("#packGrid");
    if (!grid || !N.theme.allPacks) return;
    var packs = N.theme.allPacks();
    grid.textContent = "";
    packs.forEach(function (p) {
      grid.appendChild(packCard(p));
    });
    var on = packs.filter(function (p) {
      return p.id === N.prefs.get("accent");
    })[0];
    setText("#packVal", on ? "Wearing " + on.name : "None");
  }

  /* ============================================================
     background particles
     Free ones are always wearable, the rest preview veiled and point at the
     Shop. Applying the one already on switches particles back off.
     ============================================================ */
  function applyParts(p) {
    var id = p ? p.id : "none";
    N.theme.setParticles(id);
    N.prefs.set("particles", id);
    refresh();
    d.toast(p ? "Particles: " + p.name : "Background particles off", { icon: "sparkle" });
  }

  function partCard(p) {
    var owned = !!(p.free || N.econ.isUnlocked("particle", p.id));
    var applied = N.prefs.get("particles") === p.id;
    var foot = d.h("div", { class: "shop-foot" });
    if (owned) {
      foot.appendChild(
        d.h("span", { class: "chip ok" }, [d.h("span", { class: "dot" }), p.free ? "Free" : p.crafted ? "Yours" : "Unlocked"]),
      );
      /* .shop-foot is space-between, so the chip keeps the left and this row
         keeps the right: same foot, same height, same card as any theme */
      var acts = d.h("div", { class: "craft-row" });
      if (p.crafted) {
        craftBtns("part", p).forEach(function (b) {
          acts.appendChild(b);
        });
      }
      acts.appendChild(
        d.h(
          "button",
          {
            type: "button",
            class: "btn " + (applied ? "btn-primary" : "btn-outline") + " btn-sm",
            onclick: function () {
              applyParts(applied ? null : p);
            },
          },
          applied ? [d.icon("check"), "Applied"] : [d.icon("pen"), "Apply"],
        ),
      );
      foot.appendChild(acts);
    } else {
      foot.appendChild(d.h("span", { class: "chip price-chip" }, [d.icon("coin"), String(p.price)]));
      foot.appendChild(d.h("a", { class: "btn btn-outline btn-sm", href: N.url("/shop") }, [d.icon("store"), "Shop"]));
    }

    var strip = p.colors
      ? d.h(
          "div",
          { class: "pack-strip" },
          p.colors.map(function (c) {
            return d.h("i", { style: { background: c } });
          }),
        )
      : null;
    var card = d.h(
      "article",
      {
        class:
          "shop-card pack-card glass" +
          (owned ? " owned" : " locked") +
          (p.crafted ? " crafted" : "") +
          (applied ? " playing" : ""),
      },
      [
        N.theme.partThumb(p, { lock: !owned }),
        strip,
        d.h("div", { class: "shop-info" }, [
          d.h("h3", null, p.name),
          d.h("p", null, p.desc || ""),
          d.h(
            "div",
            { class: "chips-row" },
            (p.tags || []).map(function (t) {
              return d.h("span", { class: "chip" }, t);
            }),
          ),
        ]),
        foot,
      ],
    );
    return card;
  }

  function paintParts() {
    var grid = d.qs("#partGrid");
    if (!grid || !N.theme.allParticles) return;
    var list = N.theme.allParticles();
    grid.textContent = "";
    list.forEach(function (p) {
      grid.appendChild(partCard(p));
    });
    var on = list.filter(function (p) {
      return p.id === N.prefs.get("particles");
    })[0];
    setText("#partVal", on ? on.name : "Off");
  }

  /* ============================================================
     the rail: one link per section, a filter, and a scroll-spy
     ============================================================ */
  function setRailOn(id) {
    d.qsa("#railList .rail-link").forEach(function (b) {
      b.classList.toggle("on", b.dataset.target === id);
    });
  }

  function buildRail() {
    var list = d.qs("#railList");
    if (!list) return;
    list.textContent = "";
    d.qsa(".set-group").forEach(function (g) {
      /* NB: data-ic, not data-icon. shell.js hydrates every [data-icon]
         element in place, and on anything but a <span> it empties the
         element first: on a whole section that would wipe the cards. */
      var link = d.h(
        "a",
        { class: "rail-link", href: "#" + g.id, "data-target": g.id },
        [d.icon(g.dataset.ic || "settings"), d.h("span", null, g.dataset.label || g.id)],
      );
      link.addEventListener("click", function (e) {
        e.preventDefault();
        if (g.scrollIntoView) g.scrollIntoView({ behavior: "smooth", block: "start" });
        if (history.replaceState) history.replaceState(null, "", "#" + g.id);
        setRailOn(g.id);
      });
      list.appendChild(link);
    });
  }

  function spy() {
    var groups = d.qsa(".set-group");
    if (!groups.length) return;
    function run() {
      var nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nh")) || 60;
      var line = nav + 44;
      var best = groups[0].id;
      groups.forEach(function (g) {
        if (g.getBoundingClientRect().top <= line) best = g.id;
      });
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) best = groups[groups.length - 1].id;
      setRailOn(best);
    }
    var raf = null;
    window.addEventListener(
      "scroll",
      function () {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          run();
        });
      },
      { passive: true },
    );
    run();
  }

  /* Filter the cards by text. A group with nothing left in it goes too, and
     a card that matches is opened so the hit is actually on screen. */
  function applyFilter(q) {
    filterQ = q;
    var needle = (q || "").trim().toLowerCase();
    var any = false;
    d.qsa("[data-card]").forEach(function (card) {
      var hit = !needle || (card.textContent || "").toLowerCase().indexOf(needle) >= 0;
      card.classList.toggle("gone", !hit);
      if (hit) any = true;
    });
    d.qsa(".set-group").forEach(function (g) {
      var live = g.querySelectorAll("[data-card]:not(.gone)").length > 0;
      g.classList.toggle("gone", !!needle && !live);
    });
    if (needle) {
      d.qsa("[data-card]:not(.gone)").forEach(function (card) {
        if (card.dataset.fold) setFold(card, true, false);
      });
      setRailOn();
    } else {
      paintFolds();
    }
    show(d.qs("#setEnd"), !!needle && !any);
  }

  /* ============================================================
     folding: cards that are only set once keep their state in storage
     ============================================================ */
  function folds() {
    return N.store.read(FOLD_KEY, {}) || {};
  }

  function setFold(card, open, remember) {
    card.setAttribute("data-open", open ? "1" : "0");
    var btn = card.querySelector(".set-toggle");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (remember) {
      var all = folds();
      all[card.dataset.fold] = open ? 1 : 0;
      N.store.write(FOLD_KEY, all);
    }
  }

  function paintFolds() {
    var saved = folds();
    d.qsa("[data-fold]").forEach(function (card) {
      var key = card.dataset.fold;
      var open = key in saved ? !!saved[key] : card.getAttribute("data-open") === "1";
      setFold(card, open, false);
    });
  }

  function bindFolds() {
    d.qsa(".set-toggle").forEach(function (btn) {
      var card = btn.closest("[data-fold]");
      if (!card) return;
      btn.addEventListener("click", function () {
        setFold(card, card.getAttribute("data-open") !== "1", true);
      });
    });
  }

  /* ============================================================
     bind: the controls themselves
     ============================================================ */
  function bind() {
    /* theme: one switch, not two buttons */
    var tsw = d.qs("#themeSwitch");
    if (tsw) {
      tsw.addEventListener("change", function () {
        var t = tsw.checked ? "light" : "dark";
        N.theme.setTheme(t);
        N.prefs.set("theme", t);
        refresh();
        d.toast(t === "light" ? "Light theme on" : "Dark theme on", { icon: t === "light" ? "sun" : "moon" });
      });
    }

    /* glow border */
    var gsel = d.qs("#glowSelect");
    if (gsel) {
      gsel.addEventListener("change", function () {
        N.prefs.set("glow", gsel.value);
        paintGlow(); /* the colour pickers follow the select no matter what */
        try {
          N.theme.setGlow(gsel.value);
        } catch (err) {
          /* never let a theme hiccup block the UI update */
        }
        refresh();
        d.toast("Glow: " + (gsel.options[gsel.selectedIndex] || {}).textContent);
      });
    }
    var csw = d.qs("#cometSwitch");
    if (csw) {
      csw.addEventListener("change", function () {
        N.prefs.set("glowComet", csw.checked);
        N.theme.setComet(csw.checked);
        d.toast(csw.checked ? "Comet mode on" : "Comet mode off");
      });
    }

    /* performance: one tier, plus Mini-Perf which stacks with any of them */
    var pseg = d.qs("#perfSeg");
    if (pseg) {
      pseg.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        var val = b.dataset.val;
        var level = val === "ultra" ? "ultra" : val === "on" ? true : false;
        N.prefs.set("perf", level);
        N.theme.setPerf(level);
        if (N.seasons) N.seasons.refresh(); /* particles skip performance mode */
        paintPerf(N.prefs.data);
        d.toast(
          val === "ultra"
            ? "Ultra-Performance mode on"
            : val === "on"
              ? "Performance mode on"
              : "Performance mode off",
        );
      });
    }
    var mp = d.qs("#miniPerfSwitch");
    if (mp) {
      mp.addEventListener("change", function () {
        N.theme.setMiniPerf(mp.checked);
        d.toast(mp.checked ? "Mini-Perf on: only what's on screen is drawn" : "Mini-Perf off");
      });
    }

    /* layout compactness */
    var dseg = d.qs("#densitySeg");
    if (dseg) {
      dseg.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        N.theme.setDensity(b.dataset.val);
        paintDensity();
        d.toast("Layout: " + b.textContent);
      });
    }

    /* the site's own nav: side rail or top bar */
    var nseg = d.qs("#navSeg");
    if (nseg) {
      nseg.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        N.theme.setNavLayout(b.dataset.val);
        paintNavLayout();
        /* a rail needs a window with room beside it. Say so, rather than
           leaving a chosen setting looking like it did nothing. */
        if (b.dataset.val === "side" && window.innerWidth < RAIL_MIN) {
          d.toast(
            "Side rail is on. It appears in a window " + RAIL_MIN + "px wide or more: this one is " + window.innerWidth + "px, so the top bar stays.",
            { icon: "warn", hold: 6000 },
          );
          return;
        }
        d.toast("Navigation: " + b.textContent);
      });
    }

    /* the site's own period clock, in the nav and in the player */
    var csw = d.qs("#clockSwitch");
    if (csw) {
      csw.addEventListener("change", function () {
        N.prefs.set("showClock", csw.checked);
        if (N.clock && N.clock.apply) N.clock.apply();
        d.toast(csw.checked ? "Period clock on" : "Period clock off", { icon: "clock" });
      });
    }

    /* seasonal theme */
    var ssw = d.qs("#seasonalSwitch");
    if (ssw) {
      ssw.addEventListener("change", function () {
        N.prefs.set("seasonal", ssw.checked);
        N.prefs.set("seasonOverride", null); /* settings follows the calendar */
        if (N.seasons) N.seasons.refresh();
        paintSeason();
        paintSeasonPick();
        var s = N.seasons ? N.seasons.now() : null;
        d.toast(ssw.checked && s ? s.label + " theme on" : "Seasonal theme off");
      });
    }
    var sseg = d.qs("#seasonSeg");
    if (sseg) {
      sseg.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b || !N.seasons) return;
        var t = N.seasons.setVariant(b.dataset.val || null);
        paintSeason();
        paintSeasonPick();
        d.toast(
          t && N.prefs.get("seasonVariant") ? t.label + " theme on" : "Seasonal theme follows the calendar",
        );
      });
    }

    /* background image */
    var bgUrl = d.qs("#bgUrl");
    var bgTimer = null;
    if (bgUrl) {
      bgUrl.addEventListener("input", function () {
        clearTimeout(bgTimer);
        bgTimer = setTimeout(function () {
          N.theme.setBg({ bgImage: bgUrl.value.trim() });
          paintBg();
        }, 350);
      });
      bgUrl.addEventListener("change", function () {
        clearTimeout(bgTimer);
        N.theme.setBg({ bgImage: bgUrl.value.trim() });
        paintBg();
        d.toast(bgUrl.value.trim() ? "Background image set" : "Background image cleared", { icon: "check" });
      });
    }
    var bgUp = d.qs("#bgUpload");
    var bgFile = d.qs("#bgFile");
    if (bgUp && bgFile) {
      bgUp.addEventListener("click", function () {
        bgFile.click();
      });
      bgFile.addEventListener("change", function () {
        var f = bgFile.files && bgFile.files[0];
        bgFile.value = "";
        if (!f) return;
        if (f.size > 1200000) {
          d.toast("That picture is too big to keep in this browser. Try one under about 1 MB, or paste a link.", {
            type: "err",
          });
          return;
        }
        var reader = new FileReader();
        reader.onerror = function () {
          d.toast("Could not read that file.", { type: "err" });
        };
        reader.onload = function () {
          N.theme.setBg({ bgImage: String(reader.result) });
          paintBg();
          d.toast("Background image set", { icon: "check" });
        };
        reader.readAsDataURL(f);
      });
    }
    var bgClr = d.qs("#bgClear");
    if (bgClr) {
      bgClr.addEventListener("click", function () {
        N.theme.setBg({ bgImage: "" });
        paintBg();
        d.toast("Background image removed");
      });
    }
    var bgFit = d.qs("#bgFit");
    if (bgFit) {
      N.dom.upgradeSelect(bgFit);
      bgFit.addEventListener("change", function () {
        N.theme.setBg({ bgFit: bgFit.value });
      });
    }
    var bgDim = d.qs("#bgDim");
    if (bgDim) {
      bgDim.addEventListener("input", function () {
        N.theme.setBg({ bgDim: parseFloat(bgDim.value) });
      });
    }
    var bgBlur = d.qs("#bgBlur");
    if (bgBlur) {
      bgBlur.addEventListener("input", function () {
        N.theme.setBg({ bgBlur: parseFloat(bgBlur.value) });
      });
    }

    /* the editor (Shop unlock) */
    var opEd = d.qs("#openEditor");
    if (opEd) {
      opEd.addEventListener("click", function () {
        if (N.editor && N.editor.open) N.editor.open(refresh);
        else d.toast("The editor could not load here.", { type: "err" });
      });
    }

    /* smart tab cloak */
    var stsw = d.qs("#smartTabSwitch");
    if (stsw) {
      stsw.addEventListener("change", function () {
        N.prefs.set("smartTab", stsw.checked);
        if (stsw.checked) N.tab.smartStart();
        else N.tab.smartStop();
        refresh();
        d.toast(stsw.checked ? "Smart Tab Cloak on" : "Smart Tab Cloak off");
      });
    }
    var stm = d.qs("#smartTabMin");
    if (stm) {
      stm.addEventListener("change", function () {
        N.prefs.set("smartTabMin", parseInt(stm.value, 10) || 5);
        if (N.prefs.get("smartTab")) N.tab.smartStart();
        d.toast("Tab rotates every " + stm.value + " min");
      });
    }

    /* install as an app */
    if (N.install) {
      N.bus.on("installReady", paintInstall);
      var inBtn = d.qs("#installBtn");
      if (inBtn) {
        inBtn.addEventListener("click", function () {
          N.install.prompt().then(function (outcome) {
            if (outcome === "accepted") d.toast("Installing NULL…", { icon: "check" });
            paintInstall();
          });
        });
      }
      var inHelp = d.qs("#installHelp");
      if (inHelp) {
        inHelp.addEventListener("click", function () {
          N.modal.open({
            title: "Install NULL in Chrome",
            icon: "download",
            body:
              "<p>Chrome can turn NULL into its own app window with its own icon:</p>" +
              "<p>Just click the <b>Install</b> button right here on this page.</p>" +
              "<p>NULL will instantly open in a clean window with no tabs or address bar.</p>",
            actions: [{ label: "Got it", variant: "primary" }],
          });
        });
      }
      paintInstall();
    }

    /* library extras */
    var rsw = d.qs("#recsSwitch");
    if (rsw) {
      rsw.addEventListener("change", function () {
        N.prefs.set("recs", rsw.checked);
        paintExtras(N.prefs.data);
        d.toast(rsw.checked ? "Because you played: on" : "Because you played: off");
      });
    }
    var cfsw = d.qs("#confettiSwitch");
    if (cfsw) {
      cfsw.addEventListener("change", function () {
        N.prefs.set("confetti", cfsw.checked);
        paintExtras(N.prefs.data);
        d.toast(cfsw.checked ? "Period confetti: on" : "Period confetti: off");
      });
    }

    /* export / import */
    var ex = d.qs("#btnDataExport");
    if (ex) ex.addEventListener("click", exportData);
    var im = d.qs("#btnDataImport");
    var imFile = d.qs("#dataFile");
    if (im && imFile) {
      im.addEventListener("click", function () {
        imFile.click();
      });
      imFile.addEventListener("change", function () {
        var f = imFile.files && imFile.files[0];
        if (f) importData(f);
        imFile.value = "";
      });
    }

    /* cloak the whole site */
    var cBlank = d.qs("#btnCloakBlank");
    if (cBlank) {
      cBlank.addEventListener("click", function () {
        if (N.cloak) N.cloak.site("blank");
      });
    }
    var cBlob = d.qs("#btnCloakBlob");
    if (cBlob) {
      cBlob.addEventListener("click", function () {
        if (N.cloak) N.cloak.site("blob");
      });
    }
    var cRed = d.qs("#cloakRedirectSwitch");
    if (cRed) {
      cRed.addEventListener("change", function () {
        N.prefs.set("cloakRedirect", cRed.checked);
        paintCloak();
        d.toast(cRed.checked ? "This tab will follow the preset" : "This tab stays on NULL");
      });
    }

    /* tab preset */
    var sel = d.qs("#tabSelect");
    if (sel) {
      sel.addEventListener("change", function () {
        N.prefs.set("tab", sel.value);
        N.tab.apply();
        refresh();
        d.toast("Tab preset: " + (N.tab.current() || {}).name);
      });
    }
    var tcTitle = d.qs("#tabCustomTitle");
    if (tcTitle) {
      tcTitle.addEventListener("input", function () {
        saveTabCustom({ title: tcTitle.value });
      });
    }
    var tcIcon = d.qs("#tabCustomIcon");
    if (tcIcon) {
      tcIcon.addEventListener("input", function () {
        saveTabCustom({ icon: tcIcon.value });
      });
    }
    var tcUrl = d.qs("#tabCustomUrl");
    if (tcUrl) {
      tcUrl.addEventListener("input", function () {
        saveTabCustom({ url: tcUrl.value.trim() });
        paintCloak();
      });
    }
    var tcUpload = d.qs("#btnCustomIconUpload");
    var tcFile = d.qs("#tabCustomFile");
    if (tcUpload && tcFile) {
      tcUpload.addEventListener("click", function () {
        tcFile.click();
      });
      tcFile.addEventListener("change", function () {
        var f = tcFile.files && tcFile.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          saveTabCustom({ icon: reader.result });
          if (tcIcon) tcIcon.value = reader.result;
          d.toast("Favicon uploaded", { icon: "check" });
        };
        reader.readAsDataURL(f);
        tcFile.value = "";
      });
    }

    var addr = d.qs("#gmailAddr");
    if (addr) {
      addr.addEventListener("input", function () {
        N.prefs.set("gmailAddr", addr.value || "you@gmail.com");
        if (N.prefs.get("tab") === "gmail") {
          N.tab.apply();
          paintTabPreview();
        }
      });
    }
    var unread = d.qs("#gmailUnread");
    if (unread) {
      unread.addEventListener("input", function () {
        var n = parseInt(unread.value, 10);
        N.prefs.set("gmailUnread", isNaN(n) ? 0 : Math.max(0, n));
        if (N.prefs.get("tab") === "gmail") {
          N.tab.apply();
          paintTabPreview();
        }
      });
    }

    /* another NULL window edited something: show its values here too.
       "eco" covers a Shop purchase or a dev-console grant from this one. */
    N.bus.on("sync", refresh);
    N.bus.on("eco", refresh);
  }

  /* save a piece of the custom tab preset and re-apply it live */
  function saveTabCustom(patch) {
    var cur = N.prefs.get("tabCustom") || {};
    N.prefs.set("tabCustom", Object.assign({}, cur, patch));
    N.tab.apply();
    paintTabPreview();
  }

  /* ---------- panic key ---------- */
  var capturing = false;

  function bindPanic() {
    var cap = d.qs("#panicKey");
    var hint = d.qs("#panicKeyHint");
    if (cap) {
      cap.addEventListener("click", function () {
        capturing = true;
        cap.classList.add("on");
        if (hint) hint.textContent = "Press any key… (Esc cancels)";
      });
    }
    document.addEventListener(
      "keydown",
      function (e) {
        if (!capturing) return;
        e.preventDefault();
        e.stopPropagation();
        capturing = false;
        if (cap) cap.classList.remove("on");
        if (hint) hint.textContent = "Click, then press any key";
        if (e.key === "Escape") return;
        N.prefs.set("panicKey", e.key);
        paintPanic();
        d.toast("Panic key: " + (e.key === " " ? "Space" : e.key), { icon: "check" });
      },
      true,
    );

    var url = d.qs("#panicUrl");
    if (url) {
      url.addEventListener("input", function () {
        var v = url.value.trim();
        if (!v) return;
        if (!/^https?:\/\//i.test(v)) v = "https://" + v;
        N.prefs.set("panicUrl", v);
      });
      url.addEventListener("blur", function () {
        if (!url.value.trim()) {
          N.prefs.set("panicUrl", "https://classroom.google.com");
          url.value = N.prefs.get("panicUrl");
        }
      });
    }

    var sw = d.qs("#panicSwitch");
    if (sw) {
      sw.addEventListener("change", function () {
        N.prefs.set("panicMode", sw.checked ? "double" : "single");
        paintPanic();
        d.toast(sw.checked ? "Double press on" : "Single press on");
      });
    }
  }

  /* ---------- danger zone ---------- */
  function bindDanger() {
    var rs = d.qs("#dangerReset");
    if (rs) {
      rs.addEventListener("click", function () {
        N.modal.open({
          title: "Reset appearance?",
          icon: "settings",
          iconTone: "danger",
          body:
            "<p>This returns theme, accent, tab preset and performance mode to their defaults. Your recently played list is <b>not</b> touched.</p>",
          actions: [
            { label: "Cancel", variant: "outline" },
            {
              label: "Reset",
              variant: "danger",
              onClick: function () {
                N.prefs.reset();
                N.theme.applyAll();
                refresh();
                d.toast("Appearance reset to defaults", { icon: "refresh" });
              },
            },
          ],
        });
      });
    }
    var wd = d.qs("#dangerWipe");
    if (wd) {
      wd.addEventListener("click", function () {
        N.modal.open({
          title: "Wipe all NULL data?",
          icon: "trash",
          iconTone: "danger",
          body:
            "<p>This permanently removes everything stored on this device for NULL:</p>" +
            "<p>• Recently played<br>• Preferences &amp; settings<br>• Coins, unlocks and your own theme<br>• Seen-flag markers (welcome modal etc.)</p>" +
            "<p>There is no undo.</p>",
          actions: [
            { label: "Cancel", variant: "outline" },
            {
              label: "Wipe everything",
              variant: "danger",
              onClick: function () {
                [
                  "null:prefs",
                  "null:recent",
                  "null:favs",
                  "null:flags",
                  "null:econ",
                  "null:craft",
                  "null:setFolds",
                ].forEach(function (k) {
                  N.store.del(k);
                });
                location.reload();
              },
            },
          ],
        });
      });
    }
  }

  /* ============================================================
     export / import
     localStorage is scoped to one origin, so a NULL profile cannot follow you
     from googleslides2026.github.io to an about:blank clone, a blob: window or
     a preview URL: which NULL deliberately doesn't have a server for. A
     backup file is the honest way to carry the profile across.
     ============================================================ */
  var PREFIX = "null:";

  function exportData() {
    var bag = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) bag[k] = localStorage.getItem(k);
      }
    } catch (err) {}
    var n = Object.keys(bag).length;
    var payload = { app: "null", v: 1, at: new Date().toISOString(), data: bag };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = d.h("a", { href: url, download: "null-data-" + new Date().toISOString().slice(0, 10) + ".json" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 4000);
    d.toast("Downloaded " + n + " saved item" + (n === 1 ? "" : "s"), { icon: "check" });
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onerror = function () {
      d.toast("Could not read that file.", { type: "err" });
    };
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (err) {
        d.toast("That file isn't valid JSON.", { type: "err" });
        return;
      }
      var bag = parsed && parsed.data;
      if (!bag || typeof bag !== "object") {
        d.toast("That doesn't look like a NULL backup.", { type: "err" });
        return;
      }
      var keys = Object.keys(bag).filter(function (k) {
        return k.indexOf(PREFIX) === 0;
      });
      if (!keys.length) {
        d.toast("That backup has no NULL data in it.", { type: "err" });
        return;
      }

      N.modal.open({
        title: "Load " + keys.length + " saved item" + (keys.length === 1 ? "" : "s") + "?",
        icon: "upload",
        body:
          "<p>This swaps the NULL data stored in this browser for what's in the file, then reloads.</p>" +
          "<p style='color:var(--text-2)'>There is no undo: the file is your backup.</p>",
        actions: [
          { label: "Cancel", variant: "outline" },
          {
            label: "Load it",
            variant: "primary",
            onClick: function () {
              try {
                var have = [];
                for (var i = 0; i < localStorage.length; i++) {
                  var k = localStorage.key(i);
                  if (k && k.indexOf(PREFIX) === 0) have.push(k);
                }
                have.forEach(function (k) {
                  if (keys.indexOf(k) < 0) localStorage.removeItem(k);
                });
                keys.forEach(function (k) {
                  localStorage.setItem(k, String(bag[k]));
                });
              } catch (err) {
                d.toast("Could not write the backup. Storage may be full.", { type: "err" });
                return;
              }
              location.reload();
            },
          },
        ],
      });
    };
    reader.readAsText(file);
  }

  /* ============================================================
     build the controls that are made in JS
     ============================================================ */
  function init() {
    if (inited) return;
    inited = true;

    /* the custom accent itself: one big colour circle */
    var accRow = d.qs("#accentCustomRow");
    var accHolder = d.qs("#accentCustom");
    if (accHolder) {
      accentDot = d.colorDot(
        N.prefs.get("accentColor") || accHolder.dataset.cdot || "#6cc7ff",
        function (v) {
          N.theme.setCustomAccent(v);
          if (N.seasons) N.seasons.refresh();
          paintAccent(N.prefs.data);
        },
        { big: true, title: "Custom accent colour" },
      );
      accHolder.replaceWith(accentDot);
    }
    if (accRow) accRow.hidden = !(N.theme.customOn && N.theme.customOn());

    /* the two custom glow colours */
    var glowRow = d.qs("#glowColors");
    if (glowRow) {
      glowRow.textContent = "";
      [
        ["glowColor1", "Colour 1"],
        ["glowColor2", "Colour 2"],
      ].forEach(function (pair) {
        var dot = d.colorDot(
          N.prefs.get(pair[0]),
          function (v) {
            N.prefs.set(pair[0], v);
            if (N.prefs.get("glow") === "custom") N.theme.setGlow("custom");
          },
          { title: pair[1] },
        );
        glowRow.appendChild(d.h("span", { class: "cdot-pick" }, [dot, d.h("span", null, pair[1])]));
      });
    }

    /* tab preset list: show the actual tab name the preset produces,
       "Untitled document - Google Docs", not "Google Docs: Untitled …" */
    var sel = d.qs("#tabSelect");
    if (sel) {
      N.tab.list.forEach(function (p) {
        var label = p.id === "custom" ? p.name : N.tab.titleFor(p);
        sel.appendChild(d.h("option", { value: p.id }, label));
      });
      N.dom.upgradeSelect(sel);
    }
    var gsel = d.qs("#glowSelect");
    if (gsel) N.dom.upgradeSelect(gsel);
    var stm = d.qs("#smartTabMin");
    if (stm) N.dom.upgradeSelect(stm);

    /* the rail: filter + spy + folds */
    buildRail();
    bindFolds();
    paintFolds();
    spy();
    var find = d.qs("#setFind");
    if (find) {
      var runFilter = d.debounce(function () {
        applyFilter(find.value);
      }, 120);
      find.addEventListener("input", runFilter);
      find.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          find.value = "";
          applyFilter("");
        }
      });
    }
    var clear = d.qs("#setClear");
    if (clear) {
      clear.addEventListener("click", function () {
        var find2 = d.qs("#setFind");
        if (find2) find2.value = "";
        applyFilter("");
      });
    }

    bind();
    bindPanic();
    bindDanger();
    refresh();

    /* an incoming #section link should land on the right card */
    var hash = (location.hash || "").replace("#", "");
    if (hash) {
      var target = d.qs("#" + hash);
      if (target && target.classList.contains("set-group")) setRailOn(hash);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
