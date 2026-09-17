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
    puzzle: "\ue87b", // extension
  };

  function icon(name, cls) {
    var span = document.createElement("span");
    span.className = "msr" + (cls ? " " + cls : "");
    span.setAttribute("aria-hidden", "true");
    span.textContent = P[name] || P.help;
    return span;
  }

  /* ---------- NULL's own icon set ----------
     The older glyphs above come from the icon font the build subsets. These
     are the newer drawings: plain inline SVG on one 24px grid, stroked in
     currentColor, so they render offline, scale to any size and take the
     theme's ink without a font request.

     Each entry is a list of drawing commands: ["M", ...] is a path, ["C",
     cx, cy, r] a circle, ["R", x, y, w, h, rx] a rectangle. Keeping them as
     data rather than markup means one builder emits every icon, so stroke
     width and line caps never drift between them. */
  var SVGNS = "http://www.w3.org/2000/svg";
  var IP = {
    /* the rail */
    home: [
      ["M", 3.5, 10.6, 12, 3.6, 20.5, 10.6],
      ["M", 5.8, 9.4, 5.8, 19.6, 18.2, 19.6, 18.2, 9.4],
      ["M", 10, 19.6, 10, 14.6, 14, 14.6, 14, 19.6],
    ],
    games: [
      ["M", 7.4, 8.4, 16.6, 8.4, 20.6, 12.4, 20.6, 15.4, 17.2, 17.4, 15.2, 15.2, 8.8, 15.2, 6.8, 17.4, 3.4, 15.4, 3.4, 12.4, 7.4, 8.4],
      ["M", 7.6, 11.9, 7.6, 15.3],
      ["M", 5.9, 13.6, 9.3, 13.6],
      ["C", 16.4, 11.6, 1.15],
      ["C", 18.2, 13.4, 1.15],
    ],
    /* a chain of two links: an app is a way out to somewhere else */
    apps: [
      ["M", 10.2, 13.8, 7.9, 16.1, 4, 12.2, 8, 8.2, 6.2, 6.4, 4, 6.4, 2.2, 8.2],
      ["M", 13.8, 10.2, 16.1, 7.9, 20, 11.8, 16, 15.8, 17.8, 17.6, 20, 17.6, 21.8, 15.8],
    ],
    globe: [
      ["C", 12, 12, 8.6],
      ["M", 3.6, 12, 20.4, 12],
      ["M", 12, 3.4, 12, 20.6],
      ["M", 12, 3.4, 15.4, 7.6, 15.4, 16.4, 12, 20.6],
      ["M", 12, 3.4, 8.6, 7.6, 8.6, 16.4, 12, 20.6],
    ],
    bag: [
      ["M", 4.6, 8.2, 19.4, 8.2, 18.4, 20.4, 5.6, 20.4, 4.6, 8.2],
      ["M", 9, 8.2, 9, 5.9, 15, 5.9, 15, 8.2],
      ["M", 4.6, 12.4, 19.4, 12.4],
    ],
    person: [
      ["C", 12, 8.2, 3.5],
      ["M", 5, 20.4, 7.4, 15.4, 16.6, 15.4, 19, 20.4],
    ],
    scroll: [
      ["M", 8.2, 4.2, 17.4, 4.2, 19.4, 6.2, 19.4, 15.8],
      ["M", 19.4, 18.2, 17.4, 20.2, 6.6, 20.2, 4.6, 18.2, 4.6, 6.2, 6.6, 4.2],
      ["M", 9.4, 9, 14.6, 9],
      ["M", 9.4, 12.6, 14.6, 12.6],
      ["M", 9.4, 16.2, 12.4, 16.2],
    ],
    puzzle: [
      ["M", 9.4, 3.6, 14.6, 3.6, 14.6, 6.2, 18.6, 6.2, 18.6, 10.2, 21, 10.2, 21, 15.4, 18.6, 15.4, 18.6, 20.4, 10.2, 20.4, 5.4, 20.4, 5.4, 15.4, 3, 15.4, 3, 10.2, 5.4, 10.2, 5.4, 6.2, 9.4, 6.2],
    ],
    sliders: [
      ["M", 4, 7.4, 20, 7.4],
      ["M", 4, 12, 20, 12],
      ["M", 4, 16.6, 20, 16.6],
      ["C", 9, 7.4, 1.7],
      ["C", 16, 12, 1.7],
      ["C", 7.4, 16.6, 1.7],
    ],

    /* interface */
    plus: [["M", 12, 5.4, 12, 18.6], ["M", 5.4, 12, 18.6, 12]],
    x: [["M", 6.4, 6.4, 17.6, 17.6], ["M", 17.6, 6.4, 6.4, 17.6]],
    check: [["M", 5, 12.6, 10, 17.4, 19, 6.6]],
    search: [["C", 10.8, 10.8, 6.4], ["M", 15.4, 15.4, 20, 20]],
    trash: [
      ["M", 4.6, 6.8, 19.4, 6.8],
      ["M", 9.4, 6.8, 9.4, 4.6, 14.6, 4.6, 14.6, 6.8],
      ["M", 6.6, 6.8, 7.6, 20, 16.4, 20, 17.4, 6.8],
      ["M", 10.4, 10.2, 10.4, 16.6],
      ["M", 13.6, 10.2, 13.6, 16.6],
    ],
    grid: [
      ["R", 4, 4, 6, 6, 1.6],
      ["R", 14, 4, 6, 6, 1.6],
      ["R", 4, 14, 6, 6, 1.6],
      ["R", 14, 14, 6, 6, 1.6],
    ],
    link: [["M", 10.4, 13.6, 13.6, 10.4], ["M", 9.2, 7.6, 11.6, 5.2, 12.4, 5.2], ["M", 14.8, 16.4, 12.4, 18.8, 11.6, 18.8]],
    dice: [
      ["R", 4, 4, 16, 16, 3.4],
      ["C", 9, 9, 1.2],
      ["C", 15, 15, 1.2],
      ["C", 15, 9, 1.2],
      ["C", 9, 15, 1.2],
    ],
    star: [
      ["M", 12, 3.6, 14.6, 9.2, 20.6, 9.9, 16.1, 14, 17.4, 19.9, 12, 16.9, 6.6, 19.9, 7.9, 14, 3.4, 9.9, 9.4, 9.2],
    ],
    coin: [
      ["C", 12, 12, 8.2],
      ["M", 12, 6.4, 12, 17.6],
      ["M", 14.6, 9.2, 9.4, 9.2, 9.4, 12, 14.6, 12, 14.6, 14.8, 9.4, 14.8],
    ],
    gift: [
      ["R", 3.6, 9.4, 16.8, 10.8, 1.6],
      ["M", 5.2, 9.4, 5.2, 6.4, 8.4, 5.2, 12, 8.4],
      ["M", 18.8, 9.4, 18.8, 6.4, 15.6, 5.2, 12, 8.4],
      ["M", 12, 9.4, 12, 20.2],
      ["M", 3.6, 13.4, 20.4, 13.4],
    ],
    lock: [
      ["R", 5, 10.4, 14, 9.8, 1.8],
      ["M", 8.4, 10.4, 8.4, 7.4, 15.6, 7.4, 15.6, 10.4],
      ["M", 12, 14, 12, 16.6],
    ],
    unlock: [
      ["R", 5, 10.4, 14, 9.8, 1.8],
      ["M", 8.4, 10.4, 8.4, 7.4, 15.6, 7.4, 15.6, 5.2],
      ["M", 12, 14, 12, 16.6],
    ],
    sparkle: [
      ["M", 12, 3.4, 13.8, 10.2, 20.6, 12, 13.8, 13.8, 12, 20.6, 10.2, 13.8, 3.4, 12, 10.2, 10.2],
    ],
    tag: [["M", 4, 4, 10.6, 4, 20, 13.4, 13.4, 20, 4, 10.6, 4, 4], ["C", 8, 8, 1.4]],
    pencil: [
      ["M", 4.4, 19.6, 5.4, 15.4, 15.8, 5, 19, 8.2, 8.6, 18.6, 4.4, 19.6],
      ["M", 13.6, 7.2, 16.8, 10.4],
    ],
    camera: [
      ["R", 3.4, 7.4, 17.2, 12.4, 2.4],
      ["M", 8.6, 7.4, 10, 4.8, 14, 4.8, 15.4, 7.4],
      ["C", 12, 13.6, 3.2],
    ],
    clock: [["C", 12, 12, 8.4], ["M", 12, 7.2, 12, 12.2, 15.6, 14.2]],
    trophy: [
      ["M", 7, 4.4, 17, 4.4, 15.6, 11.4, 12, 13.4, 8.4, 11.4, 7, 4.4],
      ["M", 7.4, 6, 4.4, 6, 4.4, 8, 6.6, 10],
      ["M", 16.6, 6, 19.6, 6, 19.6, 8, 17.4, 10],
      ["M", 12, 13.4, 12, 17.4],
      ["M", 8.4, 19.6, 15.6, 19.6],
    ],
    cloudUp: [
      ["M", 7.4, 17.6, 5.4, 17.6, 4, 14.6, 5.6, 11.8, 8.6, 11.4, 9.6, 8.2, 12.6, 6.8, 15.8, 8, 17.4, 10.8, 19.6, 11.6, 20.4, 14.4, 19, 17.2, 16.6, 17.6, 16, 17.6],
      ["M", 12, 20.4, 12, 13.6],
      ["M", 9.4, 16, 12, 13.4, 14.6, 16],
    ],
    cloudDown: [
      ["M", 7.4, 17.6, 5.4, 17.6, 4, 14.6, 5.6, 11.8, 8.6, 11.4, 9.6, 8.2, 12.6, 6.8, 15.8, 8, 17.4, 10.8, 19.6, 11.6, 20.4, 14.4, 19, 17.2, 16.6, 17.6, 16, 17.6],
      ["M", 12, 13.4, 12, 20.4],
      ["M", 9.4, 17.8, 12, 20.4, 14.6, 17.8],
    ],
    chevD: [["M", 6.4, 9.6, 12, 15.2, 17.6, 9.6]],
    chevR: [["M", 9.6, 6.4, 15.2, 12, 9.6, 17.6]],
    arrowR: [["M", 4.6, 12, 19.4, 12], ["M", 13.4, 6.2, 19.4, 12, 13.4, 17.8]],
    filter: [["M", 3.6, 6.4, 20.4, 6.4, 14, 13.6, 14, 19.6, 10, 17.6, 10, 13.6, 3.6, 6.4]],
    info: [["C", 12, 12, 8.6], ["M", 12, 11, 12, 16.4], ["C", 12, 8.2, 0.9]],
    warn: [
      ["M", 12, 3.8, 21.4, 20, 2.6, 20, 12, 3.8],
      ["M", 12, 9.6, 12, 14.4],
      ["C", 12, 16.8, 0.9],
    ],
    scale: [
      ["M", 12, 4, 12, 20],
      ["M", 5.4, 6.6, 18.6, 6.6],
      ["M", 3.4, 14, 7.4, 14, 5.4, 8.6, 3.4, 14],
      ["M", 16.6, 14, 20.6, 14, 18.6, 8.6, 16.6, 14],
    ],
    cookie: [
      ["C", 12, 12, 8.6],
      ["C", 9.4, 9.4, 1],
      ["C", 15, 10.6, 1],
      ["C", 11.4, 14.6, 1],
      ["C", 15.6, 15.4, 1],
    ],
    ban: [["C", 12, 12, 8.4], ["M", 6.2, 6.2, 17.8, 17.8]],
    beaker: [
      ["M", 9, 3.6, 9, 9.4, 4.6, 17.6, 4.6, 20.2, 19.4, 20.2, 19.4, 17.6, 15, 9.4, 15, 3.6],
      ["M", 7.6, 3.6, 16.4, 3.6],
    ],
    save: [
      ["R", 4.4, 4.4, 15.2, 15.2, 2.4],
      ["M", 8.6, 4.4, 8.6, 9.4, 15.4, 9.4, 15.4, 4.4],
      ["R", 8, 13.4, 8, 6.2, 1.4],
    ],
    download: [["M", 12, 3.6, 12, 15.4], ["M", 7.4, 11, 12, 15.6, 16.6, 11], ["M", 4.6, 19.6, 19.4, 19.6]],
    upload: [["M", 12, 15.6, 12, 3.8], ["M", 7.4, 8.4, 12, 3.8, 16.6, 8.4], ["M", 4.6, 19.6, 19.4, 19.6]],
    file: [
      ["M", 6, 3.6, 14, 3.6, 18, 7.6, 18, 20.4, 6, 20.4, 6, 3.6],
      ["M", 13.6, 3.8, 13.6, 8, 17.8, 8],
    ],
    school: [
      ["M", 3, 10, 12, 5.4, 21, 10, 12, 14.6, 3, 10],
      ["M", 6.6, 12, 6.6, 17, 12, 19.6, 17.4, 17, 17.4, 12],
    ],
    menu: [["M", 4, 7, 20, 7], ["M", 4, 12, 20, 12], ["M", 4, 17, 20, 17]],
    /* a box-end spanner: the head is a ring, the handle runs off it. Used by
       the Changelog to mark what a release tweaked. */
    wrench: [
      ["C", 16.8, 7.2, 3.4],
      ["M", 14.4, 9.6, 5, 19],
      ["M", 3.6, 20.4, 5.6, 18.4],
    ],
  };

  /* Build one icon. Size is the box in px; the stroke scales with it so a
     16px icon in a toolbar keeps the same visual weight as a 24px one. */
  function svgIcon(name, size, stroke) {
    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", size || 20);
    svg.setAttribute("height", size || 20);
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.className.baseVal = "ic";
    var cmds = IP[name];
    if (!cmds) return svg;

    cmds.forEach(function (c) {
      var el;
      if (c[0] === "C") {
        el = document.createElementNS(SVGNS, "circle");
        el.setAttribute("cx", c[1]);
        el.setAttribute("cy", c[2]);
        el.setAttribute("r", c[3]);
      } else if (c[0] === "R") {
        el = document.createElementNS(SVGNS, "rect");
        el.setAttribute("x", c[1]);
        el.setAttribute("y", c[2]);
        el.setAttribute("width", c[3]);
        el.setAttribute("height", c[4]);
        el.setAttribute("rx", c[5]);
      } else {
        el = document.createElementNS(SVGNS, "path");
        el.setAttribute("d", c.join(" "));
      }
      svg.appendChild(el);
    });
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", stroke || 1.6);
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    return svg;
  }

  /* Fill in [data-i="name"] placeholders left in static markup, the same way
     shell.js fills in the older [data-icon] ones. */
  function paintIcons(root) {
    qsa("[data-i]", root).forEach(function (el) {
      var size = Number(el.dataset.iSize || 20);
      el.textContent = "";
      el.appendChild(svgIcon(el.dataset.i, size));
    });
  }

  /* ---------- section heading ----------
     The Settings page hand-writes its card heads: an icon in its own box, a
     title, and a line under it. Labs and Extensions are built from JS, so
     they cannot do that by hand, and a loose glyph next to a raw string is
     exactly what they used to look like. Same shape, one builder. */
  function secHead(name, title, sub) {
    return h("h2", { class: "set-h sec-head" }, [
      h("span", { class: "set-ic" }, [icon(name)]),
      h("span", { class: "set-htxt" }, [h("b", null, title), sub ? h("span", null, sub) : null]),
    ]);
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

  /* the newer hairline set, under its own name so nothing that still asks
     for d.icon() (the font glyphs) changes behaviour */
  N.icons = { svg: svgIcon, paint: paintIcons, names: Object.keys(IP) };

  N.dom = {
    h: h,
    qs: qs,
    qsa: qsa,
    icon: icon,
    secHead: secHead,
    icons: P,
    svg: svgIcon,
    paintIcons: paintIcons,
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
  /* The served folder is worked out by store.js, which the full pages load.
     The hidden pages load this file alone, so ask for it politely instead of
     assuming it is there. */
  N.dom.fbFor = function (kind) {
    var p = N.dom.fb[kind] || N.dom.fb.game;
    /* keep=true: a fallback thumb is a real file, not a page */
    return N.url ? N.url(p, true) : p;
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
