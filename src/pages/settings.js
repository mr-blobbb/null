/* NULL — settings.js
   Binds every control on /settings.html. Recently played has its own clear
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
    var gc = d.qs("#glowCustom");
    if (gc) gc.style.display = p.glow === "custom" ? "" : "none";
    var gc1 = d.qs("#glowColor1");
    var gc2 = d.qs("#glowColor2");
    if (gc1) gc1.value = p.glowColor1 || "#35c3f2";
    if (gc2) gc2.value = p.glowColor2 || "#a86bff";

    /* performance switch */
    var sw = d.qs("#perfSwitch");
    if (sw) sw.checked = !!p.perf;

    /* tab preset */
    var sel = d.qs("#tabSelect");
    if (sel) {
      sel.value = p.tab;
      N.dom.selSync(sel);
    }
    paintTabPreview();
    paintGmail();

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
  }

  function paintTabPreview() {
    var p = N.tab.current();
    var img = d.qs("#tabPrev img");
    var b = d.qs("#tabPrev .tp-name");
    var s = d.qs("#tabPrev .tp-sub");
    if (p) {
      img.src = p.icon;
      img.style.display = "";
      b.textContent = N.tab.titleFor(p);
      s.textContent = p.name;
    }
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
        refresh();
      });
    });

    /* glow */
    var gsel = d.qs("#glowSelect");
    if (gsel) {
      gsel.addEventListener("change", function () {
        N.prefs.set("glow", gsel.value);
        N.theme.setGlow(gsel.value);
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
        d.toast(sw.checked ? "Performance mode on" : "Performance mode off");
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

  function init() {
    if (inited) return;
    inited = true;

    /* build accent swatches */
    var row = d.qs("#accentRow");
    if (row) {
      N.theme.ACCENTS.forEach(function (a) {
        row.appendChild(
          d.h("button", {
            type: "button",
            class: "swatch-btn",
            "data-val": a.id,
          }, [
            d.h("span", {
              class: "accent-dot",
              style: a.c1
                ? { background: a.c1 }
                : { background: document.documentElement.dataset.theme === "light" ? "#1c1d21" : "#e8eaef" },
            }),
            a.name,
          ]),
        );
      });
    }
    var sel = d.qs("#tabSelect");
    if (sel) {
      N.tab.list.forEach(function (p) {
        sel.appendChild(d.h("option", { value: p.id }, p.name + " \u2014 " + N.tab.titleFor(p)));
      });
      /* custom-styled dropdown, not the native <select> */
      N.dom.upgradeSelect(sel);
    }
    var gsel = d.qs("#glowSelect");
    if (gsel) N.dom.upgradeSelect(gsel);

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
