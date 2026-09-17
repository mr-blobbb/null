/* NULL · changelog.js
   The timeline. Entries are written newest-first in RELEASES below and drawn
   as a single rail of dots: the newest one is lit, everything older is a
   hollow ring. Each entry is a version, a date, one line about the release
   and then what actually changed, marked as either added or tweaked. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  /* kind: "add" is the green plus, "fix" is the yellow wrench */
  var RELEASES = [
    {
      v: "1.2.0",
      date: "2026-09-17",
      lead: "The icon, tab and settings release: a real icon set instead of drawings made up per screen, a null:// tab bar on every page, settings as a sheet over whatever you were reading, and a proxy window that loads live sites inside NULL.",
      items: [
        ["add", "Icons now come from Lucide, an actual maintained icon set, vendored into the site so there is no font to download and nothing to request."],
        ["add", "A null:// tab bar across the site. Every page you open becomes a tab, tabs survive a reload, and the + opens the whole site map."],
        ["add", "Settings is a sheet over the page you are on, with Appearance, Data and Privacy & ToS down the side. /settings still works."],
        ["add", "The Proxies window: type an address and the page loads inside NULL through a Wisp relay, with the relay and the engine both switchable."],
        ["add", "Profile grew a banner editor with an upload and zoom step, game save backup and restore, a card gradient and a name style with eight faces."],
        ["fix", "Proxeis is spelled Proxies everywhere, which it should have been from the start."],
        ["fix", "The period clock widget is gone: it was in the way on every page and it never stayed in step."],
        ["fix", "Pages nobody could reach were deleted rather than left to rot: an unreachable page is a dead link waiting to happen."],
      ],
    },
    {
      v: "1.1.0",
      date: "2026-09-17",
      lead: "The flat rebuild. NULL lost its gradients, gained a rail, and every page was rebuilt around one square, one line of text and one colour per theme.",
      items: [
        ["add", "A rail down the left edge with hand-drawn icons: Home, Games, Apps, Proxies and Shop up top, Profile, Changelog, Extensions and Settings along the bottom."],
        ["add", "A new front door: the null wordmark, a line that changes every load, the site search, quick links you can add and remove, and a band of cards running past the window."],
        ["add", "The Changelog page."],
        ["add", "Sixteen real theme palettes that re-ink the whole site, not just the accent."],
        ["add", "Inter as the site face, with Adwaita Sans and SF Compact Text first when the machine already has them."],
        ["add", "Playtime coins: the site now pays you for the time you actually spend playing."],
        ["fix", "Library pages rebuilt as plain squares with a name bubble. No descriptions, no label walls, no badge clutter.",],
        ["fix", "The site background is a still grid of dots. Nothing drifts, nothing connects, nothing moves behind your reading."],
        ["fix", "Every box on the site uses a 2px border and a tight radius, so nothing reads as a pill any more."],
      ],
    },
    {
      v: "1.0.0",
      date: "2026-08-03",
      lead: "Welcome to NULL v1! This is the newest generation of NULL, built to last.",
      items: [
        ["add", "The Games, Apps and Proxies libraries, built automatically from the folders on disk."],
        ["add", "The shared player, with fullscreen, favorites and the browser-tab presets."],
        ["add", "Global search across games, apps, proxies and pages."],
        ["add", "The permanent school schedule, with the live period clock and period-end confetti."],
        ["add", "The Shop and the local economy, all of it stored in your own browser."],
        ["add", "Extensions: .nullext files with full access to NULL, plus imported Chrome popups."],
        ["add", "Labs, the hidden /root map, and the three single-file releases."],
        ["add", "Settings, the backup file, and the panic key."],
        ["fix", "The catalog, the link checker and the page tests, so a broken path never reaches the site again."],
      ],
    },
  ];

  function entry(rel, newest) {
    var list = d.h("ul", { class: "cl-l" });
    rel.items.forEach(function (it) {
      list.appendChild(
        d.h("li", null, [
          d.h("span", { class: "cl-b cl-b--" + it[0] }, [
            N.icons.svg(it[0] === "add" ? "plus" : "wrench", 13, 2),
          ]),
          d.h("span", null, it[1]),
        ]),
      );
    });

    var date = new Date(rel.date + "T00:00:00");
    var label = date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

    return d.h("article", { class: "cl" + (newest ? " cl--new" : "") }, [
      d.h("span", { class: "cl-dot", "aria-hidden": "true" }),
      d.h("h2", { class: "cl-v" }, ["v" + rel.v, d.h("span", null, " ∙ " + label)]),
      d.h("p", { class: "cl-d" }, rel.lead),
      list,
    ]);
  }

  function init() {
    var host = d.qs("#clBody");
    if (!host) return;
    var wrap = d.h("div", { class: "cl-wrap" });
    /* newest first, so the list is written in the order it is drawn */
    RELEASES.forEach(function (rel, i) {
      wrap.appendChild(entry(rel, i === 0));
    });
    host.appendChild(wrap);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
