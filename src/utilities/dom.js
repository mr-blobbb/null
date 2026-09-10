/* NULL — dom.js
   Tiny DOM helpers + inline SVG icon set (drawn, no icon font, no network). */
(function () {
  var N = (window.N = window.N || {});

  /* ---------- element builder ----------
     h("button", { class: "btn", onclick: fn }, "Label")
     children: string | Node | array of those.
  */
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var key in attrs) {
      var v = attrs[key];
      if (v == null || v === false) continue;
      if (key === "class") el.className = v;
      else if (key === "html") el.innerHTML = v;
      else if (key === "style" && typeof v === "object") {
        for (var p in v) el.style[p] = v[p];
      } else if (key === "dataset") {
        for (var d in v) el.dataset[d] = v[d];
      } else if (key.indexOf("on") === 0 && typeof v === "function") {
        el.addEventListener(key.slice(2).toLowerCase(), v);
      } else if (key === "value") {
        el.value = v;
      } else if (key === "checked") {
        el.checked = v;
      } else {
        el.setAttribute(key, v === true ? "" : v);
      }
    }
    if (children != null) {
      var list = Array.isArray(children) ? children : [children];
      list.forEach(function (c) {
        if (c == null) return;
        el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return el;
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* ---------- icons (Google Material Symbols Rounded) ---------- */
  var P = {
    home: "home",
    game: "sports_esports",
    grid: "apps",
    proxy: "public",
    ann: "campaign",
    sched: "calendar_month",
    backups: "archive",
    settings: "settings",
    clock: "schedule",
    clock2: "timer",
    star: "star",
    search: "search",
    x: "close",
    chevD: "expand_more",
    chevR: "chevron_right",
    menu: "menu",
    back: "arrow_back",
    play: "play_arrow",
    warn: "warning",
    ext: "open_in_new",
    max: "fullscreen",
    min: "fullscreen_exit",
    refresh: "refresh",
    sun: "light_mode",
    moon: "dark_mode",
    info: "info",
    trash: "delete",
    up: "arrow_upward",
    ban: "block",
    file: "description",
    tab: "tab",
    book: "menu_book",
    school: "school",
    scale: "balance",
    cookie: "cookie",
    zap: "bolt",
    lock: "lock",
    shuffle: "shuffle",
    list: "list",
    heart: "favorite",
    chrome: "language",
    pen: "edit",
    check: "check",
    calendar: "event",
    copy: "content_copy",
    upload: "upload",
    download: "download",
    save: "save",
  };

  function icon(name, cls) {
    var span = document.createElement("span");
    span.className = "msr" + (cls ? " " + cls : "");
    span.setAttribute("aria-hidden", "true");
    span.textContent = P[name] || "help";
    return span;
  }

  /* ---------- custom selects (upgrade a native <select> in place) ---------- */
  var openSel = null;
  function closeSel() {
    if (!openSel) return;
    openSel.root.classList.remove("open");
    if (openSel.btn) openSel.btn.setAttribute("aria-expanded", "false");
    openSel = null;
  }
  document.addEventListener("click", function (e) {
    if (openSel && !openSel.root.contains(e.target)) closeSel();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSel();
  });

  /* refresh the visible label/selected state for an upgraded select */
  function selSync(sel) {
    if (!sel || !sel.dataset || !sel.dataset.upgraded) return;
    var i = sel.selectedIndex;
    var o = i >= 0 ? sel.options[i] : null;
    if (sel._valEl) sel._valEl.textContent = o ? o.textContent : "";
    if (!sel._listEl) return;
    Array.prototype.forEach.call(sel._listEl.children, function (ob) {
      var on = !!o && ob.getAttribute("data-v") === o.value;
      ob.classList.toggle("on", on);
      ob.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  /* replace the native widget with a styled button + option list.
     The original <select> stays in the DOM (hidden) and still receives
     change events, so existing handlers keep working untouched. */
  function upgradeSelect(sel) {
    if (!sel || sel.dataset.upgraded) return;
    sel.dataset.upgraded = "1";
    sel.classList.add("csel-src");
    sel.setAttribute("tabindex", "-1");
    sel.setAttribute("aria-hidden", "true");

    var root = h("span", { class: "csel" });
    sel.parentNode.insertBefore(root, sel);
    root.appendChild(sel);

    var val = h("span", { class: "csel-val" });
    var chev = icon("chevD");
    chev.classList.add("csel-chev");
    var btn = h(
      "button",
      { type: "button", class: "csel-btn", "aria-haspopup": "listbox", "aria-expanded": "false" },
      [val, chev],
    );
    if (sel.getAttribute("aria-label")) btn.setAttribute("aria-label", sel.getAttribute("aria-label"));

    var list = h("div", { class: "csel-list", role: "listbox" });
    Array.prototype.forEach.call(sel.options, function (o) {
      var ob = h(
        "button",
        { type: "button", role: "option", class: "csel-opt", "data-v": o.value },
        o.textContent,
      );
      ob.addEventListener("click", function () {
        if (sel.value !== o.value) {
          sel.value = o.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
        closeSel();
        selSync(sel);
      });
      list.appendChild(ob);
    });
    root.appendChild(btn);
    root.appendChild(list);

    btn.addEventListener("click", function () {
      if (openSel && openSel.root === root) {
        closeSel();
        return;
      }
      closeSel();
      root.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      openSel = { root: root, btn: btn };
    });

    sel._valEl = val;
    sel._listEl = list;
    selSync(sel);
    return sel;
  }

  N.dom = {
    h: h,
    qs: qs,
    qsa: qsa,
    icon: icon,
    icons: P,
    upgradeSelect: upgradeSelect,
    selSync: selSync,
  };

  /* fallback thumbnails by kind */
  N.dom.fb = {
    game: "/public/fallback-assets/thumb-game.svg",
    app: "/public/fallback-assets/thumb-app.svg",
    proxy: "/public/fallback-assets/thumb-proxy.svg",
  };
  N.dom.fbFor = function (kind) {
    return N.dom.fb[kind] || N.dom.fb.game;
  };
  N.dom.bindImgFallback = function (img, kind) {
    img.addEventListener("error", function () {
      img.src = N.dom.fbFor(kind);
    });
  };

  /* ---------- toasts ---------- */
  var toastBox = null;
  function toast(msg, opts) {
    opts = opts || {};
    if (!toastBox) {
      toastBox = h("div", { class: "toasts", "aria-live": "polite" });
      document.body.appendChild(toastBox);
    }
    var t = h(
      "div",
      { class: "toast glass-2" + (opts.type === "err" ? " err" : "") },
      [
        icon(opts.type === "err" ? "warn" : opts.icon || "info"),
        h("span", null, msg),
      ],
    );
    toastBox.appendChild(t);
    setTimeout(function () {
      t.classList.add("out");
      setTimeout(function () {
        t.remove();
      }, 320);
    }, opts.hold || 3400);
  }

  N.dom.toast = toast;

  /* ---------- misc ---------- */
  N.dom.debounce = function (fn, wait) {
    var timer = null;
    return function () {
      var self = this,
        args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(self, args);
      }, wait);
    };
  };

  N.dom.clamp = function (n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  };
})();
