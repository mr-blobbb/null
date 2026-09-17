/* NULL · router.js
   The site's navigation model in one place: every destination, what it is
   called, which icon it wears and where it points. The rail, the All Apps
   sheet, the mobile drawer and the palette are all built from this table, so
   a new page is a line here and it shows up everywhere at once.

   Pages are plain HTML files. Extensionless site paths ("/shop") are what a
   visitor sees in the address bar: GitHub Pages answers those through
   404.html and the service worker covers them offline, while "/games/" style
   folder links hit the directory index directly. */
(function () {
  var N = (window.N = window.N || {});

  var LINKS = {
    home: { id: "home", t: "Home", url: "/", icon: "home" },
    games: { id: "games", t: "Games", url: "/games/", icon: "games" },
    apps: { id: "apps", t: "Apps", url: "/apps/", icon: "apps" },
    proxies: { id: "proxies", t: "Proxeis", url: "/proxies/", icon: "globe" },
    shop: { id: "shop", t: "Shop", url: "/shop", icon: "bag" },
    profile: { id: "profile", t: "Profile", url: "/profile", icon: "person" },
    changelog: { id: "changelog", t: "Changelog", url: "/changelog", icon: "scroll" },
    extensions: { id: "extensions", t: "Extensions", url: "/extensions", icon: "puzzle" },
    settings: { id: "settings", t: "Settings", url: "/settings", icon: "sliders" },
    announcements: { id: "announcements", t: "Announcements", url: "/announcements", icon: "ann" },
    schedule: { id: "schedule", t: "Schedule", url: "/schedule", icon: "clock" },
    labs: { id: "labs", t: "Labs", url: "/labs", icon: "beaker" },
    backups: { id: "backups", t: "Backups", url: "/backups", icon: "save" },
    about: { id: "about", t: "About", url: "/about", icon: "info" },
    district: { id: "district", t: "District", url: "/district", icon: "school" },
    license: { id: "license", t: "License", url: "/license", icon: "scale" },
    privacy: { id: "privacy", t: "Privacy", url: "/privacy", icon: "lock" },
    terms: { id: "terms", t: "Terms", url: "/terms", icon: "file" },
    cookies: { id: "cookies", t: "Cookies", url: "/cookies", icon: "cookie" },
  };

  /* ---------- the rail ----------
     Five doors at the top, four at the bottom, and a deliberate gap between
     them. That gap is the point: the rail is a spine, not a list, and the
     empty middle is what keeps the icons legible at a glance. */
  var RAIL_TOP = [LINKS.home, LINKS.games, LINKS.apps, LINKS.proxies, LINKS.shop];
  var RAIL_BOTTOM = [LINKS.profile, LINKS.changelog, LINKS.extensions, LINKS.settings];

  /* kept for the code that still asks for "the primary links": the top half
     of the rail is what a nav is, the bottom half is where you go about you */
  var PRIMARY = RAIL_TOP;

  /* everything the All Apps sheet lists, in reading order. Home is first
     because it is the way back, and the four footer-only pages come last. */
  var ALL = [
    LINKS.home,
    LINKS.games,
    LINKS.apps,
    LINKS.proxies,
    LINKS.shop,
    LINKS.profile,
    LINKS.changelog,
    LINKS.extensions,
    LINKS.announcements,
    LINKS.schedule,
    LINKS.labs,
    LINKS.backups,
    LINKS.settings,
  ];

  var MORE = [
    { name: "Browse", links: [LINKS.announcements, LINKS.schedule, LINKS.labs, LINKS.backups] },
    { name: "About", links: [LINKS.about, LINKS.district, LINKS.license, LINKS.privacy, LINKS.terms, LINKS.cookies] },
  ];

  var GROUPS = [{ name: "NULL", links: ALL }].concat(MORE);

  var FOOT = [
    {
      name: "Explore",
      links: [
        { t: "Home", url: "/" },
        { t: "Games", url: "/games/" },
        { t: "Apps", url: "/apps/" },
        { t: "Proxeis", url: "/proxies/" },
        { t: "Shop", url: "/shop" },
        { t: "Extensions", url: "/extensions" },
      ],
    },
    {
      name: "About",
      links: [
        { t: "About NULL", url: "/about" },
        { t: "Privacy", url: "/privacy" },
        { t: "Terms", url: "/terms" },
        { t: "License", url: "/license" },
      ],
    },
  ];

  function norm(s) {
    if (s.length > 1 && s.charAt(s.length - 1) === "/") s = s.slice(0, -1);
    if (s.slice(-11) === "/index.html") s = s.slice(0, -11);
    return s.replace(/\.html$/, "");
  }

  function isActive(url) {
    var p = location.pathname;
    /* strip the folder NULL is served from, so the same table lights up the
       right item at a domain root and under a project path alike */
    if (N.base && N.base !== "/" && p.indexOf(N.base) === 0) p = "/" + p.slice(N.base.length);
    if (url === "/") return p === "/" || p === "/index.html";
    var dir = norm(p);
    var target = norm(url);
    return dir === target || dir === target + ".html";
  }

  function inMore(url) {
    return MORE.some(function (g) {
      return g.links.some(function (l) {
        return isActive(l.url);
      });
    });
  }

  N.router = {
    LINKS: LINKS,
    RAIL_TOP: RAIL_TOP,
    RAIL_BOTTOM: RAIL_BOTTOM,
    PRIMARY: PRIMARY,
    ALL: ALL,
    MORE: MORE,
    GROUPS: GROUPS,
    FOOT: FOOT,
    isActive: isActive,
    inMore: inMore,
    all: function () {
      return ALL.slice();
    },
  };
})();
