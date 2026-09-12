/* NULL — settings.js
   Binds every control on /settings. Recently played has its own clear
   button on the home page — it is not duplicated here. The Danger Zone only
   holds whole-app resets. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var inited = false;

  function refresh() {
    var p = N.prefs.data;

    /* theme */
    d.qsa("#themeSeg button").forEach(function (b) {
      b.classList.toggle("on", b.dataset.val === p.theme);
    });

    /* accent swatches */
    d.qsa("#accentRow .swatch-btn").forEach(function (b) {
      b.classList.toggle("on", b.dataset.val === p.accent);
    });

    /* glow preset */
    var gsel = d.qs("#glowSelect");
    if (gsel) {
      gsel.value = p.glow;
      N.dom.selSync(gsel);
    }
    paintGlow();

    /* performance switch */
    var sw = d.qs("#perfSwitch");
    if (sw) sw.checked = !!p.perf;

    /* library extras toggles */
    var rsw = d.qs("#recsSwitch");
    if (rsw) rsw.checked = p.recs !== false;
    var msw = d.qs("#marathonSwitch");
    if (msw) msw.checked = p.marathon !== false;
    var cfsw = d.qs("#confettiSwitch");
    if (cfsw) cfsw.checked = p.confetti !== false;

    /* glow comet switch */
    var csw = d.qs("#cometSwitch");
    if (csw) csw.checked = !!p.glowComet;

    /* seasonal theme */
    paintSeason();

    /* smart tab cloak */
    paintSmart();

    /* tab preset */
    var sel = d.qs("#tabSelect");
    if (sel) {
      sel.value = p.tab;
      N.dom.selSync(sel);
    }
    paintTabPreview();
    paintGmail();
    paintCustomTab();

    /* panic key */
    paintPanic();

    /* local data summary */
    var di = d.qs("#dataInfo");
    if (di) {
      var size = 0;
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf("null:") === 0) size += (localStorage.getItem(k) || "").length * 2;
        }
      } catch (err) {}
      di.textContent =
        N.recent.list().length +
        " recent \u00b7 " +
        N.favs.list().length +
        " favorites \u00b7 ~" +
        (size / 1024).toFixed(1) +
        " KB stored locally";
    }

    /* theme packs, particles + the custom picker follow their prefs */
    paintPacks();
    paintParts();
    paintCustom();
  }

  function paintTabPreview() {
    var p = N.tab.current();
    var img = d.qs("#tabPrev img");
    var b = d.qs("#tabPrev .tp-name");
    var s = d.qs("#tabPrev .tp-sub");
    if (p) {
      if (p.icon) {
        img.src = p.icon;
        img.style.display = "";
      } else {
        img.style.display = "none";
      }
      b.textContent = N.tab.titleFor(p);
      s.textContent = p.name;
    }
  }

  function paintCustomTab() {
    var p = N.prefs.data;
    var wrap = d.qs("#tabCustomWrap");
    if (wrap) wrap.style.display = p.tab === "custom" ? "" : "none";
    var ti = d.qs("#tabCustomTitle");
    if (ti && document.activeElement !== ti) ti.value = (p.tabCustom && p.tabCustom.title) || "";
    var ii = d.qs("#tabCustomIcon");
    if (ii && document.activeElement !== ii) ii.value = (p.tabCustom && p.tabCustom.icon) || "";
  }

  /* show/hide the custom glow color pickers to match the selected preset.
     Runs on every refresh AND immediately on dropdown change, so the
     pickers can never lag behind the select. */
  function paintGlow() {
    var on = N.prefs.get("glow") === "custom";
    var gc = d.qs("#glowCustom");
    if (gc) gc.style.display = on ? "" : "none";
    var gc1 = d.qs("#glowColor1");
    var gc2 = d.qs("#glowColor2");
    if (gc1) gc1.value = N.prefs.get("glowColor1") || "#35c3f2";
    if (gc2) gc2.value = N.prefs.get("glowColor2") || "#a86bff";
  }

  /* seasonal theme row — label reads "Turn on Fall theme?" while off and
     "Fall theme on" while on, with the current season as a chip */
  function paintSeason() {
    var on = N.prefs.data.seasonal !== false;
    var s = N.seasons ? N.seasons.now() : null;
    var sw = d.qs("#seasonalSwitch");
    if (sw) sw.checked = on;
    if (s) {
      var lbl = d.qs("#seasonalLbl");
      if (lbl) lbl.textContent = on ? s.label + " theme on" : "Turn on " + s.label + " theme?";
      var hint = d.qs("#seasonalHint");
      if (hint) {
        hint.textContent =
          s.hint + " \u00b7 switches automatically with the seasons";
      }
      var chip = d.qs("#seasonalChip");
      if (chip) {
        chip.textContent = s.label;
        chip.style.display = on ? "" : "none";
      }
    }
  }

  function paintSmart() {
    var on = !!N.prefs.get("smartTab");
    var sw = d.qs("#smartTabSwitch");
    if (sw) sw.checked = on;
    var wrap = d.qs("#smartTabWrap");
    if (wrap) wrap.style.display = on ? "" : "none";
    var sel = d.qs("#smartTabMin");
    if (sel) {
      sel.value = String(N.prefs.get("smartTabMin") || 5);
      N.dom.selSync(sel);
    }
  }

  /* save a piece of the custom tab preset and re-apply it live */
  function saveTabCustom(patch) {
    var cur = N.prefs.get("tabCustom") || {};
    N.prefs.set("tabCustom", Object.assign({}, cur, patch));
    N.tab.apply();
    paintTabPreview();
  }

  function paintGmail() {
    var p = N.prefs.data;
    var wrap = d.qs("#gmailWrap");
    var addr = d.qs("#gmailAddr");
    var unread = d.qs("#gmailUnread");
    if (wrap) wrap.style.display = p.tab === "gmail" ? "" : "none";
    if (addr) addr.value = p.gmailAddr;
    if (unread) unread.value = p.gmailUnread;
  }

  function bind() {
    /* theme */
    d.qsa("#themeSeg button").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.dataset.val;
        N.theme.setTheme(t);
        N.prefs.set("theme", t);
        refresh();
      });
    });

    /* accent */
    d.qsa("#accentRow .swatch-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        N.prefs.set("accent", b.dataset.val);
        N.theme.setAccent(b.dataset.val);
        if (N.seasons) N.seasons.refresh(); /* re-assert seasonal colors when accent = off */
        refresh();
      });
    });

    /* glow */
    var gsel = d.qs("#glowSelect");
    if (gsel) {
      gsel.addEventListener("change", function () {
        N.prefs.set("glow", gsel.value);
        paintGlow(); /* pickers follow the select no matter what */
        try {
          N.theme.setGlow(gsel.value);
        } catch (err) {
          /* never let a theme hiccup block the UI update */
        }
        refresh();
        d.toast("Glow: " + (gsel.options[gsel.selectedIndex] || {}).textContent);
      });
    }
    var glowC1 = d.qs("#glowColor1");
    var glowC2 = d.qs("#glowColor2");
    if (glowC1) {
      glowC1.addEventListener("input", function () {
        N.prefs.set("glowColor1", glowC1.value);
        if (N.prefs.get("glow") === "custom") N.theme.setGlow("custom");
      });
    }
    if (glowC2) {
      glowC2.addEventListener("input", function () {
        N.prefs.set("glowColor2", glowC2.value);
        if (N.prefs.get("glow") === "custom") N.theme.setGlow("custom");
      });
    }

    /* performance */
    var sw = d.qs("#perfSwitch");
    if (sw) {
      sw.addEventListener("change", function () {
        N.prefs.set("perf", sw.checked);
        N.theme.setPerf(sw.checked);
        if (N.seasons) N.seasons.refresh(); /* particles skip perf mode */
        d.toast(sw.checked ? "Performance mode on" : "Performance mode off");
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
        var s = N.seasons ? N.seasons.now() : null;
        d.toast(ssw.checked && s ? s.label + " theme on" : "Seasonal theme off");
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
    var inBtn = d.qs("#installBtn");
    var inHint = d.qs("#installHint");
    if (inBtn && N.install) {
      var paintInstall = function () {
        inBtn.hidden = true;
        if (N.install.installed()) {
          inHint.textContent = "Installed \u2014 NULL is running as its own app.";
        } else if (N.install.ready()) {
          inBtn.hidden = false;
          inHint.textContent = "This browser can install NULL right now.";
        } else {
          inHint.textContent =
            "Not offered by the browser yet \u2014 it appears once NULL is served over https, or use \"How?\".";
        }
      };
      N.bus.on("installReady", paintInstall);
      inBtn.addEventListener("click", function () {
        N.install.prompt().then(function (outcome) {
          if (outcome === "accepted") d.toast("Installing NULL\u2026", { icon: "check" });
          paintInstall();
        });
      });
      var inHelp = d.qs("#installHelp");
      if (inHelp) {
        inHelp.addEventListener("click", function () {
          N.modal.open({
            title: "Install NULL in Chrome",
            icon: "download",
            body:
"<p>Chrome can turn NULL into its own app window with its own icon:</p>" +
"<p>Just click the <b>Install</b> button right here on this page.</p>" +
"<p>NULL will instantly open in a clean window with no tabs or address bar.</p>"
,
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
        d.toast(rsw.checked ? "Because you played: on" : "Because you played: off");
      });
    }
    var msw = d.qs("#marathonSwitch");
    if (msw) {
      msw.addEventListener("change", function () {
        N.prefs.set("marathon", msw.checked);
        if (!msw.checked) {
          /* fully disarm — the games toolbar won't show any controls */
          N.prefs.set("marathonMin", 0);
          N.prefs.set("marathonAt", 0);
        }
        d.toast(msw.checked ? "Marathon mode: on" : "Marathon mode: off");
      });
    }
    var cfsw = d.qs("#confettiSwitch");
    if (cfsw) {
      cfsw.addEventListener("change", function () {
        N.prefs.set("confetti", cfsw.checked);
        d.toast(cfsw.checked ? "Period confetti: on" : "Period confetti: off");
      });
    }

    /* glow comet */
    var csw = d.qs("#cometSwitch");
    if (csw) {
      csw.addEventListener("change", function () {
        N.prefs.set("glowComet", csw.checked);
        N.theme.setComet(csw.checked);
        d.toast(csw.checked ? "Comet mode on" : "Comet mode off");
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
    /* custom tab preset builder */
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

    /* another NULL window edited something — show its values here too */
    N.bus.on("sync", refresh);

    /* danger zone */
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
        "<p>\u2022 Recently played<br>\u2022 Preferences &amp; settings<br>\u2022 Seen-flag markers (welcome modal etc.)</p>" +
        "<p>There is no undo.</p>",
          actions: [
            { label: "Cancel", variant: "outline" },
            {
              label: "Wipe everything",
              variant: "danger",
              onClick: function () {
                ["null:prefs", "null:recent", "null:favs", "null:flags"].forEach(function (k) {
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

  /* ---------- panic key ---------- */
  var capturing = false;

  function paintPanic() {
    var cap = d.qs("#panicKey");
    if (cap) cap.textContent = N.prefs.get("panicKey") || "`";
    var url = d.qs("#panicUrl");
    if (url && document.activeElement !== url) url.value = N.prefs.get("panicUrl") || "";
    var sw = d.qs("#panicSwitch");
    if (sw) sw.checked = (N.prefs.get("panicMode") || "single") === "double";
  }

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
    document.addEventListener("keydown", function (e) {
      if (!capturing) return;
      e.preventDefault();
      e.stopPropagation();
      capturing = false;
      cap.classList.remove("on");
      if (hint) hint.textContent = "Click, then press any key";
      if (e.key === "Escape") return;
      N.prefs.set("panicKey", e.key);
      paintPanic();
      d.toast("Panic key: " + (e.key === " " ? "Space" : e.key), { icon: "check" });
    }, true);

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

  /* ---------- custom accent (Shop unlock) ---------- */
  function paintCustom() {
    var rowEl = d.qs("#accentCustomRow");
    var inp = d.qs("#accentCustom");
    if (!rowEl || !inp) return;
    var on = !!(N.theme.customOn && N.theme.customOn());
    rowEl.style.display = on ? "" : "none";
    if (on) inp.value = N.prefs.get("accentColor") || "#6cc7ff";
  }

  /* ---------- theme packs ----------
     Free packs are always available; Shop packs show veiled until bought.
     Each card previews the real backdrop through theme.js, so the settings
     page and the shop can never disagree about what a pack looks like. */
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
  }

  function packCard(p) {
    var owned = !!(p.free || N.econ.isUnlocked("theme", p.id));
    var applied = N.prefs.get("accent") === p.id;
    var foot = d.h("div", { class: "shop-foot" });
    if (owned) {
      foot.appendChild(
        d.h("span", { class: "chip ok" }, [d.h("span", { class: "dot" }), p.free ? "Free" : "Unlocked"]),
      );
      foot.appendChild(
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
    } else {
      foot.appendChild(d.h("span", { class: "chip price-chip" }, [d.icon("coin"), String(p.price)]));
      foot.appendChild(d.h("a", { class: "btn btn-outline btn-sm", href: "/shop.html" }, [d.icon("store"), "Shop"]));
    }

    return d.h(
      "article",
      {
        class: "shop-card pack-card glass" + (owned ? " owned" : " locked") + (applied ? " playing" : ""),
      },
      [
        N.theme.packThumb(p, { lock: !owned }),
        d.h(
          "div",
          { class: "pack-strip" },
          (p.colors || [p.c1, p.c2]).map(function (c) {
            return d.h("i", { style: { background: c } });
          }),
        ),
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
  }

  function paintPacks() {
    var grid = d.qs("#packGrid");
    if (!grid || !N.theme.allPacks) return;
    grid.textContent = "";
    N.theme.allPacks().forEach(function (p) {
      grid.appendChild(packCard(p));
    });
  }

  /* ---------- background particles ----------
     The free ones are always wearable; the rest preview veiled and point at
     the Shop. Clicking the applied card switches particles back off. */
  function applyParts(p) {
    var id = p ? p.id : "none";
    N.theme.setParticles(id);
    N.prefs.set("particles", id);
    d.toast(p ? "Particles: " + p.name : "Background particles off", { icon: "sparkle" });
    refresh();
  }

  function partCard(p) {
    var owned = !!(p.free || N.econ.isUnlocked("particle", p.id));
    var applied = N.prefs.get("particles") === p.id;
    var foot = d.h("div", { class: "shop-foot" });
    if (owned) {
      foot.appendChild(
        d.h("span", { class: "chip ok" }, [d.h("span", { class: "dot" }), p.free ? "Free" : "Unlocked"]),
      );
      foot.appendChild(
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
    } else {
      foot.appendChild(d.h("span", { class: "chip price-chip" }, [d.icon("coin"), String(p.price)]));
      foot.appendChild(d.h("a", { class: "btn btn-outline btn-sm", href: "/shop.html" }, [d.icon("store"), "Shop"]));
    }

    return d.h(
      "article",
      {
        class: "shop-card pack-card glass" + (owned ? " owned" : " locked") + (applied ? " playing" : ""),
      },
      [
        N.theme.partThumb(p, { lock: !owned }),
        p.colors
          ? d.h(
              "div",
              { class: "pack-strip" },
              p.colors.map(function (c) {
                return d.h("i", { style: { background: c } });
              }),
            )
          : null,
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
  }

  function paintParts() {
    var grid = d.qs("#partGrid");
    if (!grid || !N.theme.allParticles) return;
    grid.textContent = "";
    N.theme.allParticles().forEach(function (p) {
      grid.appendChild(partCard(p));
    });
  }

  /* ---------- export / import ----------
     localStorage is scoped to one origin, so a NULL profile cannot follow you
     from googleslides2026.github.io to an about:blank clone, a blob: window or
     a preview URL without a server — which NULL deliberately doesn't have.
     A backup file is the honest way to carry the profile across. */
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
          "<p style='color:var(--text-2)'>There is no undo &mdash; the file is your backup.</p>",
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
                d.toast("Could not write the backup \u2014 storage may be full.", { type: "err" });
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

  function init() {
    if (inited) return;
    inited = true;

    /* accent swatches — plain single-color accents; full theme packs get
       their own card below, with previews. */
    var row = d.qs("#accentRow");
    if (row) {
      function swatch(a) {
        return d.h(
          "button",
          { type: "button", class: "swatch-btn", "data-val": a.id, title: a.name },
          [
            d.h("span", {
              class: "accent-dot",
              style: a.c1
                ? { background: a.c1 }
                : { background: document.documentElement.dataset.theme === "light" ? "#1c1d21" : "#e8eaef" },
            }),
            a.name,
          ],
        );
      }
      N.theme.ACCENTS.forEach(function (a) {
        row.appendChild(swatch(a));
      });
      /* the picker is a Shop unlock, so only offer it once it's owned */
      if (N.theme.customOn && N.theme.customOn()) {
        row.appendChild(
          d.h(
            "button",
            { type: "button", class: "swatch-btn", "data-val": "custom", title: "Your own color" },
            [
              d.h("span", {
                class: "accent-dot",
                style: { background: N.prefs.get("accentColor") || "#6cc7ff" },
              }),
              "Custom",
            ],
          ),
        );
      }
    }
    var sel = d.qs("#tabSelect");
    if (sel) {
      /* show the actual tab name the preset produces — "Untitled document -
         Google Docs", not "Google Docs \u2014 Untitled document - Google Docs" */
      N.tab.list.forEach(function (p) {
        var label = p.id === "custom" ? p.name : N.tab.titleFor(p);
        sel.appendChild(d.h("option", { value: p.id }, label));
      });
      /* custom-styled dropdown, not the native <select> */
      N.dom.upgradeSelect(sel);
    }
    var gsel = d.qs("#glowSelect");
    if (gsel) N.dom.upgradeSelect(gsel);
    var stm = d.qs("#smartTabMin");
    if (stm) N.dom.upgradeSelect(stm);
    var acc = d.qs("#accentCustom");
    if (acc) {
      acc.addEventListener("input", function () {
        N.theme.setCustomAccent(acc.value);
        if (N.seasons) N.seasons.refresh();
        refresh();
      });
    }

    bind();
    bindPanic();
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
