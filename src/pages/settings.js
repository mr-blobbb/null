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

    /* performance switch */
    var sw = d.qs("#perfSwitch");
    if (sw) sw.checked = !!p.perf;

    /* tab preset */
    var sel = d.qs("#tabSelect");
    if (sel) sel.value = p.tab;
    paintTabPreview();
    paintGmail();

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
    }

    bind();
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
