/* NULL · dom.js
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
  /* ---------- icon glyphs ----------
     Each name maps to a codepoint in the icon font NULL ships, rather than to
     the ligature it was written as. NULL carries a ~90 KB cut of Material
     Symbols instead of the full 5 MB font (see scripts/build-font.js), and a
     cut that small only keeps the icons themselves: ligature formation needs
     every letter, and the font's layout closure then drags all ~3,600 Google
     icons back in. The ligature each codepoint came from is in the comment,
     which is also what the build script reads to find a glyph when a name is
     still spelled out in words. */
  var P = {
    home: "\ue88a", // home
    game: "\ue6ec", // sports_esports
    grid: "\ue5c3", // apps
    proxy: "\ue80b", // public
    ann: "\uef49", // campaign
    sched: "\uebcc", // calendar_month
    backups: "\ue149", // archive
    settings: "\ue8b8", // settings
    clock: "\ue192", // schedule
    clock2: "\ue425", // timer
    star: "\ue838", // star
    search: "\ue8b6", // search
    x: "\ue14c", // close
    chevD: "\ue5cf", // expand_more
    chevR: "\ue409", // chevron_right
    menu: "\ue5d2", // menu
    back: "\ue5c4", // arrow_back
    play: "\ue037", // play_arrow
    warn: "\ue002", // warning
    ext: "\ue895", // open_in_new
    max: "\ue5d0", // fullscreen
    min: "\ue5d1", // fullscreen_exit
    refresh: "\ue5d5", // refresh
    sun: "\ue518", // light_mode
    moon: "\ue51c", // dark_mode
    info: "\ue88e", // info
    trash: "\ue872", // delete
    up: "\ue5d8", // arrow_upward
    ban: "\ue033", // block
    file: "\ue873", // description
    tab: "\ue8d8", // tab
    book: "\uea19", // menu_book
    school: "\ue80c", // school
    scale: "\ueaf6", // balance
    cookie: "\ueaac", // cookie
    zap: "\uea0b", // bolt
    lock: "\ue88d", // lock
    shuffle: "\ue043", // shuffle
    list: "\ue896", // list
    heart: "\ue87d", // favorite
    chrome: "\ue894", // language
    pen: "\ue150", // edit
    check: "\ue5ca", // check
    calendar: "\ue24f", // event
    copy: "\ue14d", // content_copy
    upload: "\ue2c6", // upload
    download: "\ue171", // download
    save: "\ue161", // save
    leaf: "\uea35", // eco
    snow: "\ueb3b", // ac_unit
    petal: "\ue545", // local_florist
    sparkle: "\ue65f", // auto_awesome
    coin: "\uef63", // payments
    store: "\uea12", // storefront
    boost: "\ueb9b", // rocket_launch
    trophy: "\ue71a", // emoji_events
    gift: "\ue8b1", // redeem
    unlock: "\ue898", // lock_open
    tip: "\ue0f0", // lightbulb
    trend: "\ue8e5", // trending_up
    wrench: "\ue869", // build
    code: "\ue86f", // code
    beaker: "\uea4b", // science
    eye: "\ue417", // visibility
    pause: "\ue034", // pause
    help: "\ue887", // help
  };

  function icon(name, cls) {
    var span = document.createElement("span");
    span.className = "msr" + (cls ? " " + cls : "");
    span.setAttribute("aria-hidden", "true");
    span.textContent = P[name] || P.help;
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

  /* ---------- colour dots ----------
     A circle showing the colour, with the real <input type="color"> stretched
     invisibly across it, so clicking the circle opens the browser's own
     picker. A far nicer target than the bare native swatch, and it reads as
     the colour it currently holds. onPick fires on every change. */
  function colorDot(value, onPick, opts) {
    opts = opts || {};
    var dot = h("label", {
      class: "cdot" + (opts.big ? " cdot--lg" : ""),
      title: opts.title || value,
    });
    var input = h("input", { type: "color", value: value, "aria-label": opts.title || "Color" });
    dot.style.setProperty("--cdot", value);
    dot.appendChild(input);
    input.addEventListener("input", function () {
      dot.style.setProperty("--cdot", input.value);
      dot.title = input.value;
      onPick(input.value);
    });
    /* let a caller move the dot from code (a card rebuilt after a save, say)
       without reaching inside it */
    dot.setValue = function (v) {
      input.value = v;
      dot.style.setProperty("--cdot", v);
      dot.title = v;
    };
    return dot;
  }

  N.dom = {
    h: h,
    qs: qs,
    qsa: qsa,
    icon: icon,
    icons: P,
    colorDot: colorDot,
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
