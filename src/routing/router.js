/* NULL — router.js
   Single source of truth for the navigation model: which links exist, where
   they point, and which one is active on the current page. Pages are plain
   HTML files — this just keeps their menus/footers consistent. */
(function () {
  var N = (window.N = window.N || {});

  /* top nav — icon-only destinations. Home is the NULL brand mark itself,
     so it is not a separate link. The mobile drawer shows all of these. */
  var PRIMARY = [
    { id: "games", t: "Games", url: "/games", icon: "game" },
    { id: "apps", t: "Apps", url: "/apps", icon: "grid" },
    { id: "proxies", t: "Proxies", url: "/proxies", icon: "proxy" },
    { id: "schedule", t: "Schedule", url: "/schedule", icon: "sched" },
    { id: "announcements", t: "Announcements", url: "/announcements", icon: "ann" },
    { id: "backups", t: "Backups", url: "/backups", icon: "backups" },
    { id: "settings", t: "Settings", url: "/settings", icon: "settings" },
  ];

  /* grouped view used by the mobile drawer */
  var GROUPS = [
    {
      name: "Library",
      links: [
        { t: "Games", url: "/games", icon: "game" },
        { t: "Apps", url: "/apps", icon: "grid" },
        { t: "Proxies", url: "/proxies", icon: "proxy" },
      ],
    },
    {
      name: "More",
      links: [
        { t: "Announcements", url: "/announcements", icon: "ann" },
        { t: "Schedule", url: "/schedule", icon: "sched" },
        { t: "Backups", url: "/backups", icon: "backups" },
        { t: "Settings", url: "/settings", icon: "settings" },
      ],
    },
  ];

  /* About / District / License / Privacy / Terms / Cookies live only in the
     footer bottom links — they are not menu destinations. */
  var FOOT = [
    {
      name: "Explore",
      links: [
        { t: "Home", url: "/" },
        { t: "Games", url: "/games" },
        { t: "Apps", url: "/apps" },
        { t: "Proxies", url: "/proxies" },
        { t: "Announcements", url: "/announcements" },
        { t: "Schedule", url: "/schedule" },
        { t: "Settings", url: "/settings" },
      ],
    },
    {
      name: "Info",
      links: [
        { t: "About", url: "/about" },
        { t: "District", url: "/district" },
        { t: "License", url: "/license" },
        { t: "Privacy", url: "/privacy" },
        { t: "Terms", url: "/terms" },
        { t: "Cookies", url: "/cookies" },
      ],
    },
  ];

  function isActive(url) {
    var p = location.pathname;
    if (url === "/") return p === "/" || p === "/index.html";
    /* match the clean url and its .html form, so nav stays highlighted
       whether the host serves /games or /games.html */
    var name = url.split("/").pop();
    var tail = p.split("/").pop() || "";
    return p === url || tail === name || tail === name + ".html";
  }

  N.router = {
    PRIMARY: PRIMARY,
    GROUPS: GROUPS,
    FOOT: FOOT,
    isActive: isActive,
    all: function () {
      return PRIMARY.concat(
        GROUPS.reduce(function (a, g) {
          return a.concat(g.links);
        }, []),
      );
    },
  };
})();
