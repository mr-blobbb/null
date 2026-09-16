/* NULL · labs.js
   The Labs page: where experiments live before they are good enough to be
   part of the site proper.

   Three kinds of thing sit here.

     experiments  little looks toggled by html[data-labs], so the CSS alone
                  turns them on everywhere (ext.css). Nothing about them
                  reaches into a page's own code.
     retextures   whole-site redesigns. Each one is a block of token and shape
                  overrides under html[data-retexture], so every page follows
                  without knowing it happened. They keep the black-and-white
                  identity: none of them introduces a new colour idea.
     generator    the procedural theme generator (procgen.js), previewed with
                  the same builders the Shop and the editor use.

   Vote links are a plain list at the top so they can be swapped for a real
   form in one place. */
(function () {
  var N = window.N;
  var d = N.dom;

  var LANGS = "labs";
  var REPO = "https://github.com/googleslides2026/googleslides2026.github.io";

  /* Swap these for your own forms (a Google Form, a Discord poll, anything)
     the day you have them: nothing else on the page cares where they point. */
  var POLLS = [
    {
      title: "Next retexture",
      desc: "Terminal, Print and Brutal are live. Say which direction the next one should take, or post your own mock.",
      label: "Open an issue",
      url: REPO + "/issues/new?labels=labs&title=" + encodeURIComponent("[Labs] next retexture: "),
    },
    {
      title: "What gets promoted",
      desc: "Everything under Experiments is a candidate for the real site. Vote for the one you want out of the lab.",
      label: "Vote",
      url: REPO + "/issues/new?labels=labs&title=" + encodeURIComponent("[Labs] promote: "),
    },
    {
      title: "Report a lab bug",
      desc: "Experiments are allowed to be rough. If one of them breaks a page, that is worth knowing before it ships.",
      label: "Report it",
      url: REPO + "/issues/new?labels=labs,bug&title=" + encodeURIComponent("[Labs] "),
    },
    {
      title: "Read the votes",
      desc: "Every open Labs thread, so you can see what everyone else asked for before you add to it.",
      label: "Discussions",
      url: REPO + "/discussions",
    },
  ];

  var EXPERIMENTS = [
    {
      id: "tilt",
      name: "Card tilt",
      desc: "Cards lean into a hover instead of just lifting. A bit much, and weirdly satisfying once you have felt a whole grid do it.",
    },
    {
      id: "vignette",
      name: "Viewport vignette",
      desc: "A soft darkening at the window edges, so the middle of the page sits in a spotlight.",
    },
    {
      id: "dense",
      name: "Denser shelves",
      desc: "Smaller library tiles: more games above the fold, smaller thumbnails. Good on a big screen.",
    },
    {
      id: "gridlines",
      name: "Blueprint grid",
      desc: "Faint grid lines behind every page. Makes the layout visible instead of implied.",
    },
  ];

  var RETEXTURES = [
    {
      id: "off",
      name: "Default",
      desc: "The site as designed: frosted glass, rounded corners, pure grayscale.",
      swatch: ["#0a0a0b", "#1c1c1f", "#e6e7ea"],
    },
    {
      id: "terminal",
      name: "Terminal",
      desc: "Monospace everywhere, square corners, uppercase labels, and a cursor blinking at the end of every heading.",
      swatch: ["#08080a", "#101214", "#7ee0b8"],
    },
    {
      id: "print",
      name: "Print",
      desc: "Paper: white surfaces, serif headings, hairline rules and no shadows or blur anywhere.",
      swatch: ["#fbfbfa", "#ffffff", "#111113"],
    },
    {
      id: "brutal",
      name: "Brutal",
      desc: "Thick borders, hard offset shadows, solid surfaces and uppercase headings. Nothing is soft.",
      swatch: ["#0a0a0b", "#ffffff", "#f5f5f6"],
    },
  ];

  var ROADMAP = [
    { tag: "live", name: "Extensions", desc: "Native .nullext files with full power, and sandboxed Chrome popups." },
    { tag: "live", name: "Retextures", desc: "Whole-site redesigns, picked above, kept black and white." },
    { tag: "live", name: "Theme generator", desc: "Rolls a complete theme set from a seed. Lives in the Shop's theme editor, not here." },
    { tag: "soon", name: "Extension store", desc: "A page of community extensions you can install in one click." },
    { tag: "soon", name: "Theme sharing", desc: "A generated theme as a link you can paste to someone." },
    { tag: "soon", name: "More retextures", desc: "Whatever wins the vote." },
  ];

  /* ---------- experiments ---------- */
  function labsOn() {
    var raw = N.prefs.get(LANGS);
    return String(raw || "")
      .split(",")
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }
  function setLabs(list) {
    var clean = list.filter(function (v, i) {
      return v && list.indexOf(v) === i;
    });
    N.prefs.set(LANGS, clean.join(","));
    if (clean.length) document.documentElement.dataset.labs = clean.join(" ");
    else delete document.documentElement.dataset.labs;
  }
  function toggleLab(id, on) {
    var list = labsOn();
    var at = list.indexOf(id);
    if (on && at < 0) list.push(id);
    if (!on && at >= 0) list.splice(at, 1);
    setLabs(list);
    paintExperiments();
    d.toast((on ? "On: " : "Off: ") + id);
  }

  function paintExperiments() {
    var host = d.qs("#labsExperiments");
    var on = labsOn();
    host.textContent = "";
    host.appendChild(d.secHead("beaker", "Experiments", "CSS-only, and instant on and off"));
    var rows = d.h("div", { class: "lab-rows" });
    EXPERIMENTS.forEach(function (x) {
      var sw = d.h("input", { type: "checkbox", checked: on.indexOf(x.id) >= 0, "aria-label": x.name });
      sw.addEventListener("change", function () {
        toggleLab(x.id, sw.checked);
      });
      rows.appendChild(
        d.h("div", { class: "lab-row" }, [
          d.h("span", { class: "lab-tag live" }, "live"),
          d.h("div", { class: "lr-txt" }, [d.h("b", null, x.name), d.h("span", null, x.desc)]),
          d.h("label", { class: "switch" }, [sw, d.h("span", { class: "track" })]),
        ]),
      );
    });
    host.appendChild(rows);
    host.appendChild(
      d.h("p", { class: "ext-note" }, "Experiments are CSS-only: they restyle what is already on the page and never touch a game, your saved data or the catalog. Turning one off is instant."),
    );
  }

  /* ---------- retextures ---------- */
  function paintRetextures() {
    var host = d.qs("#labsRetexture");
    var cur = N.prefs.get("retexture") || "off";
    host.textContent = "";
    host.appendChild(d.secHead("pen", "Retextures", "a complete redesign of every page"));
    host.appendChild(
      d.h("p", { class: "ext-note", style: { marginTop: "0", marginBottom: "14px" } }, "A retexture is a complete redesign of NULL, not a colour swap. All of them keep the black-and-white identity and every one of them applies to every page, the libraries and the player."),
    );

    var grid = d.h("div", { class: "ret-grid" });
    RETEXTURES.forEach(function (r) {
      var card = d.h("button", {
        type: "button",
        class: "ret-card " + r.id + (cur === r.id ? " on" : ""),
        onclick: function () {
          N.prefs.set("retexture", r.id);
          if (r.id === "off") delete document.documentElement.dataset.retexture;
          else document.documentElement.dataset.retexture = r.id;
          paintRetextures();
          d.toast(r.id === "off" ? "Back to the default look" : r.name + " retexture on");
        },
      });
      card.appendChild(
        d.h("span", { class: "ret-swatch" }, r.swatch.map(function (c) {
          return d.h("i", { style: { background: c } });
        })),
      );
      card.appendChild(d.h("b", null, r.name));
      card.appendChild(d.h("span", null, r.desc));
      if (cur === r.id) card.appendChild(d.h("span", { class: "lab-tag live" }, "worn"));
      grid.appendChild(card);
    });
    host.appendChild(grid);
  }

  /* ---------- the generator, which moved ----------
     Rolling a theme is part of building one, so the generator is a tab inside
     the Shop's theme editor now: a roll drops straight into the editor's own
     fields, which means you can tweak whatever it hands you instead of
     accepting or discarding the whole thing. This page keeps a pointer so
     nobody goes hunting for it. */
  function paintGen() {
    var host = d.qs("#labsGen");
    if (!host) return;
    host.textContent = "";
    host.appendChild(d.secHead("sparkle", "Theme generator", "now part of the theme editor, in the Shop"));
    host.appendChild(
      d.h("div", { class: "lab-note" }, [
        d.icon("wrench"),
        d.h("span", null, "A roll hands back a whole set: a four-colour palette, a tint, a backdrop picked to match the hue, drifting parts and a particle layer. It opens in the theme editor and writes itself into the editor's own fields, so a generated theme is editable, deletable and wears exactly like one you built by hand."),
      ]),
    );
    host.appendChild(
      d.h("div", { class: "ec-acts" }, [
        d.h("a", { class: "btn btn-primary btn-sm", href: N.url("/shop") }, [d.icon("store"), "Open the Shop"]),
      ]),
    );
  }

  /* ---------- prototype UI ---------- */
  function paintProto() {
    var host = d.qs("#labsProto");
    host.textContent = "";
    host.appendChild(d.secHead("grid", "Prototype UI", "built for real here, used nowhere else"));
    host.appendChild(
      d.h("p", { class: "ext-note", style: { marginTop: "0", marginBottom: "14px" } }, "Components that do not exist in the site yet. They are built for real here and used nowhere else, which is the point of a lab: try it, then decide."),
    );

    var row = d.h("div", { class: "proto-row" });

    /* 1. a stat strip, the kind a dashboard would want */
    var stat = d.h("div", { class: "proto-card glass" });
    stat.appendChild(d.h("b", null, "Stat strip"));
    var strip = d.h("div", { class: "proto-stats" });
    var eco = N.econ.state();
    [
      { k: "coins", v: eco.coins },
      { k: "xp", v: eco.xp },
      { k: "plays", v: eco.plays },
      { k: "streak", v: eco.streak },
    ].forEach(function (s) {
      strip.appendChild(d.h("span", { class: "proto-stat" }, [d.h("i", null, String(s.v)), d.h("em", null, s.k)]));
    });
    stat.appendChild(strip);
    stat.appendChild(d.h("span", { class: "proto-note" }, "Live numbers, drawn straight from N.econ."));
    row.appendChild(stat);

    /* 2. a segmented command bar for the libraries */
    var bar = d.h("div", { class: "proto-card glass" });
    bar.appendChild(d.h("b", null, "Library command bar"));
    var seg = d.h("div", { class: "proto-bar" });
    ["All", "Not played", "Favorites", "Hot"].forEach(function (t, i) {
      seg.appendChild(d.h("span", { class: "proto-seg" + (i === 0 ? " on" : "") }, t));
    });
    seg.appendChild(d.h("em", { class: "proto-hint" }, "/"));
    bar.appendChild(seg);
    bar.appendChild(d.h("span", { class: "proto-note" }, "One row, keyboard hints included. Not wired to a filter yet."));
    row.appendChild(bar);

    /* 3. a compact row card: the list view the libraries do not have */
    var listy = d.h("div", { class: "proto-card glass" });
    listy.appendChild(d.h("b", null, "Row card"));
    var g = N.catalog.games()[0];
    listy.appendChild(
      d.h("div", { class: "proto-rowcard" }, [
        d.h("span", { class: "proto-thumb" }, [d.icon("game")]),
        d.h("span", { class: "proto-rt" }, [d.h("b", null, g ? g.title || g.name || g.id : "No games in the catalog"), d.h("span", null, g ? (g.labels || []).slice(0, 3).join(" · ") : "add a folder to games/")]),
        d.h("span", { class: "proto-play" }, [d.icon("play")]),
      ]),
    );
    listy.appendChild(d.h("span", { class: "proto-note" }, "A list view for huge libraries. Cheap to build, easy to sort."));
    row.appendChild(listy);

    host.appendChild(row);
  }

  /* ---------- votes + roadmap ---------- */
  function paintPolls() {
    var host = d.qs("#labsPolls");
    host.textContent = "";
    host.appendChild(d.secHead("trend", "Have a say", "vote on what gets built next"));
    var grid = d.h("div", { class: "lab-polls" });
    POLLS.forEach(function (p) {
      grid.appendChild(
        d.h("div", { class: "poll-card" }, [
          d.h("b", null, p.title),
          d.h("span", null, p.desc),
          d.h("a", { class: "btn btn-outline btn-sm", href: p.url, target: "_blank", rel: "noopener" }, [d.icon("ext"), p.label]),
        ]),
      );
    });
    host.appendChild(grid);
  }

  function paintRoadmap() {
    var host = d.qs("#labsRoadmap");
    host.textContent = "";
    host.appendChild(d.secHead("list", "What is in the lab", "what is live and what is still coming"));
    var rows = d.h("div", { class: "lab-rows" });
    ROADMAP.forEach(function (r) {
      rows.appendChild(
        d.h("div", { class: "lab-row" }, [
          d.h("span", { class: "lab-tag " + r.tag }, r.tag === "live" ? "live now" : "coming"),
          d.h("div", { class: "lr-txt" }, [d.h("b", null, r.name), d.h("span", null, r.desc)]),
        ]),
      );
    });
    host.appendChild(rows);
  }

  /* ---------- note + boot ---------- */
  d.qs("#labsNote").appendChild(
    d.h("div", { class: "lab-note" }, [
      d.icon("warn"),
      d.h("span", null, [
        "Nothing here is finished. Experiments can look broken on a small screen, a retexture changes every page until you turn it off, and a generated theme overwrites the theme you built by hand (the editor keeps only one). Everything lives in this browser and none of it touches your games or your progress.",
      ]),
    ]),
  );

  paintExperiments();
  paintRetextures();
  paintGen();
  paintProto();
  paintPolls();
  paintRoadmap();
})();
