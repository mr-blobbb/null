/* NULL — player.js
   The shared NULL player. A frosted chrome bar surrounds the game/app iframe;
   the game fills the rest of the screen. Handles fullscreen, tab-preset
   overrides inside the iframe, and the about:blank / blob: cloaking modes
   (popup permissions permitting — the browser stays in control). */
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
    if (kindEl) kindEl.textContent = (N.KIND_LABEL[p.k] || "Item") + " \u00b7 NULL";

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

    /* frame */
    function hideLoad() {
      if (loadEl) loadEl.remove();
      d.qsa(".player-note").forEach(function (n) {
        n.remove();
      });
    }
    var note = d.h("div", { class: "player-note" }, "Esc exits fullscreen \u00b7 arrow/WASD keys work when the game is focused");
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
        /* cross-origin content — skip, the outer tab still shows the preset */
      }
    });
    /* mobile note (once, touch devices — keyboard-friendly, nothing disabled) */
    var touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (touch && !N.flags.get(MOBILE_NOTE)) {
      setTimeout(function () {
        N.flags.set(MOBILE_NOTE);
        N.modal.open({
          title: "NULL on your phone",
          icon: "info",
          body:
            "<p>This game runs in the NULL player. Bluetooth or attached keyboards keep working wherever the browser allows \u2014 nothing here disables keyboard controls.</p>" +
            "<p>Fullscreen gives you the biggest view.</p>",
          actions: [{ label: "Continue", variant: "primary" }],
        });
      }, 800);
    }

    /* fullscreen */
    var fsBtn = d.qs("#btnFull");
    var fsIc = d.qs("#btnFull").querySelector("svg");
    function fsIcon() {
      return document.fullscreenElement ? "min" : "max";
    }
    function updateFsIcon() {
      if (fsIc) fsIc.innerHTML = d.icon(fsIcon()).innerHTML;
      fsBtn.title = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
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
      document.addEventListener("fullscreenchange", updateFsIcon);
      updateFsIcon();
    }

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

    /* back */
    var backBtn = d.qs("#btnBack");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        var back = "/" + (p.k === "app" ? "apps" : p.k === "proxy" ? "proxies" : "games") + ".html";
        if (history.length > 1) history.back();
        else location.href = back;
      });
    }

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
        var w = null;
        try {
          w = window.open("about:blank", "_blank");
        } catch (err) {}
        if (!w) {
          d.toast("Popup blocked \u2014 allow popups for NULL.", { type: "err" });
          return;
        }
        writeBlank(w, N.tab.titleFor(pset()), pset().icon);
        d.toast("Opened in an about:blank window", { icon: "ban" });
      });
      d.qs("#cloakBlob").addEventListener("click", function () {
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
            if (!w) d.toast("Popup blocked \u2014 allow popups for NULL.", { type: "err" });
          })
          .catch(function () {
            d.toast("Couldn\u2019t read the file for blob: mode.", { type: "err" });
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
