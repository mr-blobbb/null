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

  /* ---------- icons ---------- */
  var P = {
    home: '<path d="M3 11 12 3l9 8"/><path d="M5 10.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9.5"/>',
    game:
      '<path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.59C2.6 9.42 2 14.46 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.41-1.41A2 2 0 0 1 9.83 16h4.34a2 2 0 0 1 1.41.59L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.55-.6-6.58-.69-7.41A4 4 0 0 0 17.32 5z"/><path d="M6 11h4M8 9v4"/><circle cx="16.2" cy="12.4" r="0.6" fill="currentColor" stroke="none"/><circle cx="18.4" cy="10.4" r="0.6" fill="currentColor" stroke="none"/>',
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
    proxy:
      '<circle cx="12" cy="12" r="9"/><path d="M3.5 12h17"/><path d="M12 3a14.5 14.5 0 0 1 0 18 14.5 14.5 0 0 1 0-18z"/>',
    ann:
      '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    sched:
      '<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M16 2v4M8 2v4M3 9.5h18"/><path d="M8.5 14.5l2.5 2.5 4.5-5"/>',
    backups:
      '<rect x="2.5" y="3" width="19" height="5" rx="1.5"/><path d="M4 8v10.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    settings:
      '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1.5 14h5M9.5 8h5M17.5 16h5"/>',
    clock:
      '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    star:
      '<path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.7l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95z"/>',
    search:
      '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    chevR: '<path d="m9 6 6 6-6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    back: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    play: '<path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8z" fill="currentColor" stroke="none"/>',
    warn:
      '<path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.72 3h17a2 2 0 0 0 1.72-3L13.7 3.86a2 2 0 0 0-3.4 0z"/><path d="M12 9v4.5"/><path d="M12 17.2h.01"/>',
    ext:
      '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.5"/>',
    max:
      '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
    min:
      '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
    refresh:
      '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20.5 14.1A8.6 8.6 0 0 1 9.9 3.5a8.6 8.6 0 1 0 10.6 10.6z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11.5V16.5"/><path d="M12 7.6h.01"/>',
    trash:
      '<path d="M3.5 6.5h17"/><path d="M8.5 6.5V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M18.5 6.5 17.6 19a2 2 0 0 1-2 1.9H8.4a2 2 0 0 1-2-1.9L5.5 6.5"/><path d="M10 11v6M14 11v6"/>',
    up: '<path d="M12 20V5"/><path d="m5 12 7-7 7 7"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    file:
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    tab: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22H20v-2.5H6.5A2.5 2.5 0 0 1 4 19.5z"/>',
    school:
      '<path d="m3 9.5 9-5.5 9 5.5"/><path d="M5.5 12v7.5M9 12v7.5M15 12v7.5M18.5 12v7.5M2.5 19.5h19"/>',
    scale: '<path d="M12 3v18M5 7h14M7 7l-3.5 7a3 3 0 0 0 5 0L5 7M19 7l-3.5 7a3 3 0 0 0 5 0L19 7M8 21h8"/>',
    cookie:
      '<circle cx="12" cy="12" r="9"/><path d="M12 5.5a1.4 1.4 0 0 0 1.4-1.4A1.4 1.4 0 0 1 14.8 4.5a1.4 1.4 0 0 1-1.4 1.4A1.4 1.4 0 0 0 12 7.3a1.4 1.4 0 0 1-1.4 1.4A1.4 1.4 0 0 0 12 10a1.4 1.4 0 0 1 1.4 1.4 1.4 1.4 0 0 0 2.8 0A1.4 1.4 0 0 1 15.6 10"/><path d="M17 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM8.5 15.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>',
    zap: '<path d="M13 2 3 14h7l-1 8 11-13h-7l1-7z"/>',
    shuffle:
      '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/>',
    list:
      '<path d="M8.5 6h12M8.5 12h12M8.5 18h12"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    heart:
      '<path d="M19.5 5.6a4.9 4.9 0 0 0-7-.2L12 5.9l-.5-.5a4.95 4.95 0 1 0-7 7l.5.5L12 19.9l7-7 .5-.5a4.9 4.9 0 0 0 0-6.8z"/>',
    chrome: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5h0a10.3 10.3 0 0 1 8.6 14.5L15.7 10"/>',
    pen: '<path d="M4 20h4L19.5 8.5a2.12 2.12 0 0 0-3-3L5 17 4 20z"/><path d="m13.5 6.5 3 3"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    clock2: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar:
      '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/>',
  };

  function icon(name, cls) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.9");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    if (cls) svg.setAttribute("class", cls);
    svg.innerHTML = P[name] || P.info;
    return svg;
  }

  N.dom = {
    h: h,
    qs: qs,
    qsa: qsa,
    icon: icon,
    icons: P,
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
