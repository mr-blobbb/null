/* NULL · home.js
   The front door. Five things happen here:

     1. the wordmark, which is pure CSS
     2. one line of greeting, picked at random on every load
     3. the search box, which opens the same palette "/" does
     4. the row of circles: two fixed, the rest the visitor's own shortcuts
     5. a band of cards running past the window forever

   Everything a visitor can change (their shortcuts) lives in prefs, so it
   follows them through a reload, a second tab and the installed app. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  /* ---------- 2 · the line ----------
     Hand-written, one per mood, no rarity weights: whatever comes up is what
     you get. The point is that the site says something different each time,
     not that some of them are rare. */
  var LINES = [
    "you have a 0.01% chance of getting this message",
    "well hello there",
    "i switched to linux",
    "woah",
    "penguins !",
    "made by mr blob",
    "thanks to all our beta testers!",
    "betrayal...",
    "sggames isn't the best game site, null is!",
    "you're pretty cool",
    "why is this site down sm i swear",
    "zzz",
    "yummy",
    "null on top fr",
    "tech no night",
    "also try [literally nothing all my other sites dont exist anymore]",
    "taste the spaghetti code",
    "that's it for now",
    "fatality",
    "i worked very hard",
    "splishy splash",
    "made in...HTML?",
    "and for you sir?",
    "some things might take a bit to load, sorry :(",
  ];

  /* ---------- 4 · shortcuts ----------
     The keys of the router's links, in the order they sit on the front door.
     A visitor can drop any of them and add their own; the two fixed circles
     are drawn from this same list so a shortcut can never duplicate one. */
  var DEFAULT_QL = ["games", "apps", "proxies", "extensions", "settings"];

  /* null:// paths, the short form the Add sheet asks for */
  var PATHS = {
    home: "/",
    g: "/games/",
    games: "/games/",
    a: "/apps/",
    apps: "/apps/",
    p: "/proxies/",
    proxeis: "/proxies/",
    shop: "/shop",
    prof: "/profile",
    me: "/profile",
    profile: "/profile",
    log: "/changelog",
    changelog: "/changelog",
    ext: "/extensions",
    extensions: "/extensions",
    ann: "/announcements",
    set: "/settings",
    settings: "/settings",
  };

  /* "null://g", "g", "null://games/" all mean the same thing */
  function resolvePath(raw) {
    var s = String(raw || "").trim().toLowerCase().replace(/^null:\/\//, "").replace(/\/+$/, "");
    if (!s) return null;
    if (s.charAt(0) === "/") return s;
    return PATHS[s] || null;
  }

  function linkFor(url) {
    var all = N.router.ALL;
    for (var i = 0; i < all.length; i++) {
      if (all[i].url === url) return all[i];
    }
    return null;
  }

  function quickList() {
    var saved = N.prefs.get("quickLinks");
    if (!Array.isArray(saved)) return DEFAULT_QL.slice();
    return saved.filter(function (k) {
      return !!N.router.LINKS[k];
    });
  }

  function quickIcon(url) {
    var l = linkFor(url);
    return l ? l.icon : "link";
  }

  /* ---------- a plain sheet ----------
     Small helper for the two popups here: heavy blur behind, a hairline box,
     an X in the corner with nothing drawn around it. */
  function sheet(opts) {
    var head = d.h("div", { class: "sh-head" }, [
      opts.icon ? d.h("span", { class: "sh-ic" }, [N.icons.svg(opts.icon, 20)]) : null,
      d.h("h2", null, opts.title),
      d.h(
        "button",
        { type: "button", class: "bt bt--x", "aria-label": "Close", onclick: close },
        [N.icons.svg("x", 18)],
      ),
    ]);
    var box = d.h("div", { class: "sh" + (opts.wide ? " sh--wide" : "") }, [head]);
    if (opts.body) box.appendChild(opts.body);
    if (opts.foot) box.appendChild(opts.foot);

    var ov = d.h("div", { class: "sh-ov", role: "dialog", "aria-modal": "true", "aria-label": opts.title }, [box]);
    ov.addEventListener("mousedown", function (e) {
      if (e.target === ov) close();
    });
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    function close() {
      document.removeEventListener("keydown", onKey);
      ov.remove();
      if (opts.onClose) opts.onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.appendChild(ov);
    var first = box.querySelector("input, button:not(.bt--x)");
    if (first) first.focus();
    return { close: close, el: ov };
  }

  /* ---------- the Add sheet ---------- */
  function addSheet() {
    var label = d.h("input", { type: "text", placeholder: "e.g., Games", maxlength: "24", autocomplete: "off" });
    var path = d.h("input", { type: "text", placeholder: "e.g., null://g", autocomplete: "off", spellcheck: "false" });
    var note = d.h("p", { class: "sh-note", style: "display:none" });

    var body = d.h("div", null, [
      d.h("label", { class: "sh-field" }, [d.h("span", null, "Label"), d.h("span", { class: "fld" }, [label])]),
      d.h("label", { class: "sh-field" }, [d.h("span", null, "Internal path"), d.h("span", { class: "fld" }, [path])]),
      note,
    ]);

    var self = sheet({
      title: "Add Shortcut",
      icon: "grid",
      body: body,
      foot: d.h("div", { class: "sh-foot" }, [
        d.h("button", { type: "button", class: "bt", onclick: function () { self.close(); } }, "Cancel"),
        d.h("button", { type: "button", class: "bt bt--fill", onclick: submit }, "Add"),
      ]),
    });

    function fail(msg) {
      note.textContent = msg;
      note.style.display = "";
    }

    function submit() {
      var url = resolvePath(path.value);
      if (!label.value.trim()) return fail("Give it a label first.");
      if (!url) return fail('That path is not one of ours. Try "null://g" or "/shop".');
      var list = N.prefs.get("quickLinks");
      list = (Array.isArray(list) ? list : DEFAULT_QL).slice();
      list.push("@" + url + "|" + label.value.trim().slice(0, 24));
      N.prefs.set("quickLinks", list);
      self.close();
      drawLinks();
    }
    label.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });
    path.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });
  }

  /* ---------- the All Apps sheet ---------- */
  function appsSheet() {
    var grid = d.h("div", { class: "ap-grid" });
    N.router.ALL.forEach(function (l) {
      grid.appendChild(
        d.h("a", { class: "ap", href: N.url(l.url) }, [
          N.icons.svg(l.icon, 18),
          d.h("span", null, l.t),
        ]),
      );
    });
    sheet({
      title: "Apps",
      icon: "grid",
      wide: true,
      body: grid,
      foot: d.h("div", { class: "sh-foot" }, [
        d.h("span", { class: "sh-note" }, "Every page null has."),
      ]),
    });
  }

  /* ---------- 4 · draw the row ---------- */
  function circle(icon, label, cls) {
    return d.h("span", { class: "ql-c" }, [N.icons.svg(icon, 24)]);
  }

  function drawLinks() {
    var host = d.qs("#hmLinks");
    if (!host) return;
    host.textContent = "";

    /* the two fixed circles, in the order they were asked for: All Apps
       first, then Add, then the visitor's own row */
    var all = d.h("div", { class: "ql ql--fixed" }, [
      d.h("button", { type: "button", class: "ql-c", "aria-label": "All Apps", onclick: appsSheet }, [
        N.icons.svg("grid", 24),
      ]),
      d.h("span", { class: "ql-n" }, "All Apps"),
    ]);
    host.appendChild(all);

    var add = d.h("div", { class: "ql ql--fixed" }, [
      d.h("button", { type: "button", class: "ql-c", "aria-label": "Add a shortcut", onclick: addSheet }, [
        N.icons.svg("plus", 24),
      ]),
      d.h("span", { class: "ql-n" }, "Add"),
    ]);
    host.appendChild(add);

    quickList().forEach(function (key) {
      var url;
      var label;
      var icon;
      var id;
      if (key.charAt(0) === "@") {
        /* a shortcut the visitor wrote: "@<url>|<label>" */
        var bits = key.slice(1).split("|");
        url = bits[0];
        label = bits[1] || url;
        icon = quickIcon(url);
        id = key;
      } else {
        var l = N.router.LINKS[key];
        if (!l) return;
        url = l.url;
        label = l.t;
        icon = l.icon;
        id = key;
      }
      var a = d.h("a", { class: "ql-c", href: N.url(url), "aria-label": label }, [N.icons.svg(icon, 24)]);
      var x = d.h(
        "button",
        {
          type: "button",
          class: "ql-x",
          "aria-label": "Remove " + label + " shortcut",
          onclick: function (e) {
            e.preventDefault();
            var list = N.prefs.get("quickLinks");
            list = (Array.isArray(list) ? list : DEFAULT_QL).slice().filter(function (k) {
              return k !== id;
            });
            N.prefs.set("quickLinks", list);
            drawLinks();
          },
        },
        [N.icons.svg("trash", 13)],
      );
      host.appendChild(
        d.h("div", { class: "ql" }, [a, x, d.h("span", { class: "ql-n" }, label)]),
      );
    });
  }

  /* ---------- 5 · the band ----------
     One real quote, then placeholders. The list is written out twice inside
     one track and the track slides exactly half its own width, so the loop
     has no seam and no reset to watch for. Hovering holds it still. */
  var LOREM =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

  var CARDS = [
    {
      name: "mr blob",
      role: "Owner of Null",
      txt: "Null is one of, if not the most modern games site. It has all the latest features, good speeds, smooth UI, and overall just works.",
    },
    { name: "pixelpet", role: "Beta tester", txt: "Been here since the first build. It keeps getting faster and I keep not studying." },
    { name: "n0va", role: "Player", txt: "The library loads before I finish clicking. That is the whole review." },
    { name: "slug", role: "Lurker", txt: "I do not comment. I am commenting now. That is how good the new search is." },
    { name: "tabs_overload", role: "Proxeis enjoyer", txt: "Nineteen tabs open and it is still smooth." },
    { name: "matcha", role: "Beta tester", txt: "Themes actually change the whole site now, not just the button colour." },
    { name: "antivirus", role: "Player", txt: "somehow this is the only site that loads on the school wifi" },
    { name: "coin_goblin", role: "Shop regular", txt: "I have 4,000 coins and no plan. Working as intended." },
    { name: "quill", role: "Beta tester", txt: "Flat, black, quick. Nothing to look at, which is exactly the point." },
    { name: "hf_", role: "Player", txt: "the period clock lives in my rail now and honestly it has saved me twice" },
    { name: "anonymous", role: "Someone", txt: "who keeps writing these placeholder testimonials" },
    { name: "you?", role: "Not yet", txt: "Your card could be here, which is a strange thing to put on an about strip." },
  ];

  function card(c) {
    return d.h("article", { class: "mc" }, [
      d.h("div", { class: "mc-top" }, [
        /* where the tiny square avatar goes: a plain box until there is art */
        d.h("span", { class: "mc-av", "aria-hidden": "true" }),
        d.h("span", { class: "mc-name" }, c.name),
        d.h("span", { class: "mc-dot" }, "∙"),
        d.h("span", { class: "mc-role" }, c.role),
      ]),
      d.h("p", { class: "mc-txt" }, c.txt),
      d.h("p", { class: "mc-lor" }, LOREM),
    ]);
  }

  function drawStrip() {
    var host = d.qs("#hmStrip");
    if (!host) return;
    var track = d.h("div", { class: "hm-track" });
    /* two passes: the second is what the first slides into */
    for (var pass = 0; pass < 2; pass++) {
      CARDS.forEach(function (c) {
        track.appendChild(card(c));
      });
    }
    host.appendChild(track);
  }

  /* ---------- the corner readout ---------- */
  function drawMeta() {
    var host = d.qs("#hmMeta");
    if (!host) return;
    var ms = 0;
    try {
      var t = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      ms = t && t.duration ? Math.round(t.duration) : Math.round(performance.now());
    } catch (e) {
      ms = Math.round(performance.now());
    }
    var meta = N.meta || { version: "1.0.0", build: "20260916" };
    host.textContent = "";
    host.appendChild(d.h("div", null, "Page: " + ms + " ms"));
    host.appendChild(d.h("div", null, "v" + meta.version + " ∙ " + meta.build));
  }

  /* ---------- 3 · search ---------- */
  function bindSearch() {
    var form = d.qs("#homeSearch");
    var input = d.qs("#searchInput");
    if (!form || !input) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      N.search.open(input.value.trim());
    });
    form.addEventListener("click", function (e) {
      if (e.target.tagName !== "INPUT") input.focus();
    });
  }

  function init() {
    if (N.icons) N.icons.paint();
    var line = d.qs("#hmLine");
    if (line) line.textContent = LINES[Math.floor(Math.random() * LINES.length)];
    drawLinks();
    drawStrip();
    drawMeta();
    bindSearch();
    /* the band is a fixed number of cards: nothing to re-measure on resize */
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
