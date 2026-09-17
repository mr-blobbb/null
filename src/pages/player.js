/* NULL · player.js
   The shared NULL player. A frosted chrome bar surrounds the game/app iframe;
   the game fills the rest of the screen. Handles fullscreen, tab-preset
   overrides inside the iframe, and the about:blank / blob: cloaking modes
   (popup permissions permitting: the browser stays in control). */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var MOBILE_NOTE = "mobileWarn";

  function params() {
    var q = new URLSearchParams(location.search);
    return { k: q.get("k") || "game", id: q.get("id") || "" };
  }

  function init() {
    var p = params();
    var entry = N.catalog.find(p.k, p.id);

    var nameEl = d.qs("#pName");
    var kindEl = d.qs("#pKind");
    var frame = d.qs("#pFrame");
    var loadEl = d.qs("#pLoad");
    var playerRoot = d.qs("#playerRoot");

    if (!entry || (!entry.file && entry.kind !== "proxy")) {
      if (nameEl) nameEl.textContent = "Not found";
      if (kindEl) kindEl.textContent = "NULL";
      if (frame) {
        frame.remove();
        var empty = d.qs("#pEmpty");
        if (empty) empty.style.display = "grid";
      }
      return;
    }

    if (nameEl) nameEl.textContent = entry.name;
    if (kindEl) kindEl.textContent = (N.KIND_LABEL[p.k] || "Item") + " · NULL";

    N.recent.add(p.k, entry.id);
    N.tab.apply();

    /* favorite state */
    var favBtn = d.qs("#btnFav");
    var favOn = N.favs.has(p.k, entry.id);
    function paintFav() {
      if (!favBtn) return;
      favBtn.classList.toggle("on", favOn);
      favBtn.title = favOn ? "Remove from favorites" : "Add to favorites";
    }
    paintFav();
    if (favBtn) {
      favBtn.addEventListener("click", function () {
        favOn = N.favs.toggle(p.k, entry.id);
        paintFav();
      });
    }

    /* ---------- playtime → coins ----------
       Coins come from time now, not from XP: three a minute while this game
       is open, plus a milestone every fifteen. The clock itself lives in
       econ.js, because it has to know about idle and hidden tabs; all the
       player does is tell it a game is on. */
    function paintCoins() {
      var el = d.qs("#pCoinVal");
      if (el && N.econ) el.textContent = N.econ.state().coins;
    }
    function trackTime() {
      if (!N.econ || !N.econ.play) return;
      N.econ.play(true);
      /* banked a coin at a time, so the count in the bar moves as you play */
      N.bus.on("playCoins", function (e) {
        paintCoins();
        if (e && e.milestone) {
          d.toast("+" + e.coins + " coins: 15 minutes on NULL", { icon: "coin" });
          if (N.fx && N.fx.confetti) N.fx.confetti();
        }
      });
      window.addEventListener("beforeunload", function () {
        N.econ.play(false);
      });
    }
    paintCoins();
    trackTime();

    /* frame */
    function hideLoad() {
      if (loadEl) loadEl.remove();
      d.qsa(".player-note").forEach(function (n) {
        n.remove();
      });
    }
    var note = d.h("div", { class: "player-note" }, "Esc exits fullscreen · arrow/WASD keys work when the game is focused");
    playerRoot.appendChild(note);

    frame.src = entry.file;
    frame.addEventListener("load", function () {
      hideLoad();
      /* override the inner document's title + favicon with the tab preset */
      try {
        var inner = frame.contentDocument;
        var pset = N.tab.current();
        if (inner && pset) {
          inner.title = N.tab.titleFor(pset);
          var ic = inner.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
          if (ic && pset.icon) ic.href = pset.icon;
        }
      } catch (err) {
        /* cross-origin content: skip, the outer tab still shows the preset */
      }
    });
    /* mobile note (once, touch devices: keyboard-friendly, nothing disabled) */
    var touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (touch && !N.flags.get(MOBILE_NOTE)) {
      setTimeout(function () {
        N.flags.set(MOBILE_NOTE);
        N.modal.open({
          title: "NULL on your phone",
          icon: "info",
          body:
            "<p>This game runs in the NULL player. Bluetooth or attached keyboards keep working wherever the browser allows. Nothing here disables keyboard controls.</p>" +
            "<p>Fullscreen gives you the biggest view.</p>",
          actions: [{ label: "Continue", variant: "primary" }],
        });
      }, 800);
    }

    /* fullscreen: the bar docks to the bottom edge and auto-hides;
       moving the mouse (or tapping) brings it back */
    var fsBtn = d.qs("#btnFull");
    var fsIc = d.qs("#btnFull .msr");
    var bar = d.qs(".player-bar");
    var fsTimer = null;
    function fsIconName() {
      return document.fullscreenElement ? "min" : "max";
    }
    function updateFsIcon() {
      if (fsIc) fsIc.textContent = d.icon(fsIconName()).textContent;
      if (fsBtn) fsBtn.title = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
    }
    function fsPeek() {
      if (!document.fullscreenElement) return;
      if (bar) bar.classList.add("show");
      clearTimeout(fsTimer);
      fsTimer = setTimeout(function () {
        if (bar) bar.classList.remove("show");
      }, 2400);
    }
    if (fsBtn) {
      fsBtn.addEventListener("click", function () {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          try {
            playerRoot.requestFullscreen();
          } catch (err) {}
        }
      });
      document.addEventListener("fullscreenchange", function () {
        document.body.classList.toggle("fs", !!document.fullscreenElement);
        updateFsIcon();
        if (document.fullscreenElement) fsPeek();
        else if (bar) bar.classList.remove("show");
      });
      document.addEventListener("mousemove", fsPeek);
      document.addEventListener("mousedown", fsPeek);
      updateFsIcon();
    }

    /* hide the bar: the game takes the full screen without going fullscreen,
       and a small handle stays at the bottom edge to bring the controls
       back. Same idea as the fullscreen bar, but you asked for it. */
    var barBtn = d.qs("#btnBar");
    var handle = d.qs("#barHandle");
    var HINT = "player:barhint";
    function setBarHidden(hide) {
      document.body.classList.toggle("bar-hidden", hide);
      if (handle) handle.hidden = !hide;
      if (bar) bar.classList.remove("show");
      if (barBtn) barBtn.setAttribute("aria-pressed", hide ? "true" : "false");
      if (!hide) return;
      /* wake the handle for a few seconds so it is obvious where the bar went,
         then let it settle back down over the game */
      if (handle) {
        handle.classList.add("awake");
        setTimeout(function () {
          handle.classList.remove("awake");
        }, 3800);
      }
      if (!N.flags.get(HINT)) {
        N.flags.set(HINT);
        d.toast("Bar hidden. Press H or use the handle to bring it back.", { icon: "info", hold: 4200 });
      }
    }
    if (barBtn) {
      barBtn.addEventListener("click", function () {
        setBarHidden(!document.body.classList.contains("bar-hidden"));
      });
    }
    if (handle) {
      handle.addEventListener("click", function () {
        setBarHidden(false);
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key !== "h" && e.key !== "H") return;
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      setBarHidden(!document.body.classList.contains("bar-hidden"));
    });

    /* reload */
    var rlBtn = d.qs("#btnReload");
    if (rlBtn) {
      rlBtn.addEventListener("click", function () {
        try {
          frame.contentWindow.location.reload();
        } catch (err) {
          frame.src = entry.file;
        }
      });
    }

    /* back. Leaves tell extensions too: the player:close hook is documented
       in ext.js, so it should actually fire. */
    var backBtn = d.qs("#btnBack");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        var back = N.url("/" + (p.k === "app" ? "apps" : p.k === "proxy" ? "proxies" : "games") + "/");
        if (N.ext) N.ext.emit("player:close", { entry: { kind: p.k, id: p.id } });
        if (history.length > 1) history.back();
        else location.href = back;
      });
    }

    /* ---------- localStorage save backup ----------
       Games that rely on localStorage instead of save files get a way to
       back their data up / move it to another device. NULL's own settings
       (null:* keys) are never exported or overwritten, so the .json files
       are safe to hand to a friend. */
    function gameLs() {
      var out = {};
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("null:") !== 0) out[k] = localStorage.getItem(k);
      }
      return out;
    }

    function fmtBytes(n) {
      if (n >= 1048576) return (n / 1048576).toFixed(1) + " MB";
      if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
      return n + " B";
    }

    function openSaves() {
      var data = gameLs();
      var keys = Object.keys(data);
      var bytes = keys.reduce(function (t, k) {
        return t + k.length + (data[k] || "").length * 2;
      }, 0);
      var what = p.k === "app" ? "app" : "game";

      var dlBtn = d.h("button", { type: "button", class: "btn btn-primary" }, [
        d.icon("download"),
        "Download save data",
      ]);
      var ulBtn = d.h("button", { type: "button", class: "btn btn-outline" }, [
        d.icon("upload"),
        "Upload save data",
      ]);
      var file = d.h("input", { type: "file", accept: ".json,application/json", hidden: true });

      var body = d.h("div", { class: "saves" }, [
        d.h("p", { html: "Saves your data if the " + what + " relies on <b>localStorage</b> instead of save files." }),
        d.h("div", { class: "saves-stats" }, [
          d.h("span", { class: "chip ok" }, [d.h("span", { class: "dot" }), keys.length + " saved key" + (keys.length === 1 ? "" : "s")]),
          d.h("span", { class: "chip" }, fmtBytes(bytes) + " on this device"),
        ]),
        d.h("div", { class: "saves-actions" }, [dlBtn, ulBtn, file]),
        d.h("p", { class: "saves-note", html: "Downloads a plain <b>.json</b> snapshot of the localStorage keys this " + what + " uses. NULL’s own settings are never included, so the file is safe to share: a friend can upload it and pick up right where you left off." }),
      ]);

      N.modal.open({
        title: "Game saves · localStorage",
        icon: "save",
        body: body,
        actions: [{ label: "Done", variant: "primary" }],
      });

      dlBtn.addEventListener("click", function () {
        if (!keys.length) {
          d.toast("Nothing saved yet. Play a bit and progress lands here automatically.", { type: "err" });
          return;
        }
        var snap = {
          app: "NULL",
          game: entry.name,
          id: entry.id,
          savedAt: new Date().toISOString(),
          data: data,
        };
        var url = URL.createObjectURL(new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" }));
        var a = d.h("a", { href: url, download: "null-saves-" + entry.id + ".json" });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 3000);
        d.toast("Downloaded " + keys.length + " saved key" + (keys.length === 1 ? "" : "s"), { icon: "check" });
      });

      ulBtn.addEventListener("click", function () {
        file.click();
      });
      file.addEventListener("change", function () {
        var f = file.files && file.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var snap = JSON.parse(reader.result);
            var map = snap && typeof snap === "object" && snap.data && typeof snap.data === "object" ? snap.data : snap;
            if (!map || typeof map !== "object" || Array.isArray(map)) throw new Error("bad file");
            var n = 0;
            Object.keys(map).forEach(function (k) {
              if (k.indexOf("null:") === 0) return; /* never touch NULL's own settings */
              var v = map[k];
              if (typeof v !== "string") v = JSON.stringify(v);
              localStorage.setItem(k, v);
              n++;
            });
            file.value = "";
            if (!n) {
              d.toast("That file had no game save keys.", { type: "err" });
              return;
            }
            d.toast("Restored " + n + " key" + (n === 1 ? "" : "s") + ". Reload the game if it doesn’t pick them up", { icon: "check" });
          } catch (err) {
            d.toast("That doesn’t look like valid save data.", { type: "err" });
          }
        };
        reader.readAsText(f);
      });
    }

    var svBtn = d.qs("#btnSaves");
    if (svBtn) svBtn.addEventListener("click", openSaves);

    /* cloak popover */
    var popWrap = d.qs("#cloakWrap");
    var pop = d.qs("#cloakPop");
    if (popWrap) {
      popWrap.addEventListener("click", function (e) {
        e.stopPropagation();
        popWrap.classList.toggle("open");
      });
      document.addEventListener("click", function (e) {
        if (popWrap && !popWrap.contains(e.target)) popWrap.classList.remove("open");
      });

      function pset() {
        return N.tab.current();
      }
      function writeBlank(w, title, favicon) {
        var doc = w.document;
        doc.open();
        doc.write(
          "<!doctype html><html><head><meta charset='utf-8'><title>" +
            title +
            "</title><link rel='icon' href='" +
            favicon +
            "'></head>" +
            "<body style='margin:0'><iframe src='" +
            entry.file +
            "' style='width:100vw;height:100vh;border:0'></iframe></body></html>",
        );
        doc.close();
      }

      d.qs("#cloakTab").addEventListener("click", function () {
        window.open(entry.file, "_blank");
      });
      d.qs("#cloakBlank").addEventListener("click", function () {
        if (N.cloak && N.cloak.blocked && N.cloak.blocked()) {
          d.toast("Popups are blocked. Allow popups for NULL, then try again.", { type: "err", hold: 5000 });
          return;
        }
        var w = null;
        try {
          w = window.open("about:blank", "_blank");
        } catch (err) {}
        if (!w) {
          if (N.cloak && N.cloak.markBlocked) N.cloak.markBlocked();
          d.toast("Popup blocked. Allow popups for NULL.", { type: "err" });
          return;
        }
        writeBlank(w, N.tab.titleFor(pset()), pset().icon);
        d.toast("Opened in an about:blank window", { icon: "ban" });
      });
      d.qs("#cloakBlob").addEventListener("click", function () {
        if (N.cloak && N.cloak.blocked && N.cloak.blocked()) {
          d.toast("Popups are blocked. Allow popups for NULL, then try again.", { type: "err", hold: 5000 });
          return;
        }
        fetch(entry.file)
          .then(function (r) {
            return r.ok ? r.text() : Promise.reject();
          })
          .then(function (html) {
            var p = pset();
            var out = html
              .replace(/<title[^>]*>[\s\S]*?<\/title>/i, "<title>" + N.tab.titleFor(p) + "</title>")
              .replace(
                /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*>/i,
                "<link rel='icon' href='" + p.icon + "'>",
              );
            var url = URL.createObjectURL(new Blob([out], { type: "text/html" }));
            var w = window.open(url, "_blank");
            if (!w) {
              if (N.cloak && N.cloak.markBlocked) N.cloak.markBlocked();
              d.toast("Popup blocked. Allow popups for NULL.", { type: "err" });
            }
          })
          .catch(function () {
            d.toast("Couldn’t read the file for blob: mode.", { type: "err" });
          });
      });
      d.qs("#cloakCopy").addEventListener("click", function () {
        var u = location.origin + entry.file;
        try {
          navigator.clipboard.writeText(u);
          d.toast("Link copied", { icon: "copy" });
        } catch (err) {
          d.toast("Copy not available here", { type: "err" });
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
