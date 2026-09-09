/* NULL — router.js
   Single source of truth for the navigation model: which links exist, where
   they point, and which one is active on the current page. Pages are plain
   HTML files — this just keeps their menus/footers consistent. */
(function () {
  var N = (window.N = window.N || {});

  /* top nav — icon-only destinations. Home is the NULL brand mark itself,
     so it is not a separate link. The mobile drawer shows all of these. */
  var PRIMARY = [
    { id: "games", t: "Games", url: "/games.html", icon: "game" },
    { id: "apps", t: "Apps", url: "/apps.html", icon: "grid" },
    { id: "proxies", t: "Proxies", url: "/proxies.html", icon: "proxy" },
    { id: "schedule", t: "Schedule", url: "/schedule.html", icon: "sched" },
    { id: "announcements", t: "Announcements", url: "/announcements.html", icon: "ann" },
    { id: "backups", t: "Backups", url: "/backups.html", icon: "backups" },
    { id: "settings", t: "Settings", url: "/settings.html", icon: "settings" },
  ];

  /* grouped view used by the mobile drawer */
  var GROUPS = [
    {
      name: "Library",
      links: [
        { t: "Games", url: "/games.html", icon: "game" },
        { t: "Apps", url: "/apps.html", icon: "grid" },
        { t: "Proxies", url: "/proxies.html", icon: "proxy" },
      ],
    },
    {
      name: "More",
      links: [
        { t: "Announcements", url: "/announcements.html", icon: "ann" },
        { t: "Schedule", url: "/schedule.html", icon: "sched" },
        { t: "Backups", url: "/backups.html", icon: "backups" },
        { t: "Settings", url: "/settings.html", icon: "settings" },
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
        { t: "Games", url: "/games.html" },
        { t: "Apps", url: "/apps.html" },
        { t: "Proxies", url: "/proxies.html" },
        { t: "Announcements", url: "/announcements.html" },
        { t: "Schedule", url: "/schedule.html" },
        { t: "Settings", url: "/settings.html" },
      ],
    },
    {
      name: "Info",
      links: [
        { t: "About", url: "/about.html" },
        { t: "District", url: "/district.html" },
        { t: "License", url: "/license.html" },
        { t: "Privacy", url: "/privacy.html" },
        { t: "Terms", url: "/terms.html" },
        { t: "Cookies", url: "/cookies.html" },
      ],
    },
  ];

  function isActive(url) {
    var p = location.pathname;
    if (url === "/") return p === "/" || p === "/index.html";
    /* strip possible base path so /games.html always matches */
    var tail = p.split("/").pop() || "";
    if (url.indexOf(".html") > 0) return tail === url.split("/").pop();
    return p === url;
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
