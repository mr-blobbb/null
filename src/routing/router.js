/* NULL · router.js
   The site's navigation model in one place: every destination, what it is
   called, which icon it wears, the null:// address the tab bar shows, and the
   file that answers for it. The rail, the tab bar, the All Apps sheet and the
   command palette are all built from this table, so a page that exists is a
   line here and a page that does not is a line deleted.

   Pages are plain HTML files. Extensionless site paths ("/shop") are what a
   visitor sees in the address bar: GitHub Pages answers those through
   404.html and the service worker covers them offline, while "/games/" style
   folder links hit the directory index directly. */
(function () {
  var N = (window.N = window.N || {});

  var LINKS = {
    home: { id: "home", t: "Home", url: "/", icon: "home", host: "home", file: "index.html" },
    games: { id: "games", t: "Games", url: "/games/", icon: "games", host: "g", file: "games/index.html" },
    apps: { id: "apps", t: "Apps", url: "/apps/", icon: "apps", host: "a", file: "apps/index.html" },
    proxies: { id: "proxies", t: "Proxies", url: "/proxies/", icon: "globe", host: "p", file: "proxies/index.html" },
    shop: { id: "shop", t: "Shop", url: "/shop", icon: "bag", host: "shop", file: "shop.html" },
    profile: { id: "profile", t: "Profile", url: "/profile", icon: "person", host: "me", file: "profile.html" },
    changelog: { id: "changelog", t: "Changelog", url: "/changelog", icon: "scroll", host: "log", file: "changelog.html" },
    extensions: { id: "extensions", t: "Extensions", url: "/extensions", icon: "puzzle", host: "ext", file: "extensions.html" },
    settings: { id: "settings", t: "Settings", url: "/settings", icon: "sliders", host: "set", file: "settings.html" },
    /* not a door: the window a game or a proxied site opens in */
    player: { id: "player", t: "Player", url: "/player", icon: "play", host: "play", file: "player.html" },
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

  /* everything the All Apps sheet lists, in reading order */
  var ALL = [
    LINKS.home,
    LINKS.games,
    LINKS.apps,
    LINKS.proxies,
    LINKS.shop,
    LINKS.profile,
    LINKS.changelog,
    LINKS.extensions,
    LINKS.settings,
  ];

  var MORE = [];
  var GROUPS = [{ name: "NULL", links: ALL }];

  /* the tab bar's order, and the name a tab wears before its title loads */
  var TABBED = ALL;

  function norm(s) {
    if (s.length > 1 && s.charAt(s.length - 1) === "/") s = s.slice(0, -1);
    if (s.slice(-11) === "/index.html") s = s.slice(0, -11);
    return s.replace(/\.html$/, "");
  }

  /* the path this window is on, with the folder NULL is served from removed,
     so the same table lights up the right door at a domain root and under a
     project path alike */
  function here() {
    var p = location.pathname;
    if (N.base && N.base !== "/" && p.indexOf(N.base) === 0) p = "/" + p.slice(N.base.length);
    return p;
  }

  function isActive(url) {
    var p = here();
    if (url === "/") return p === "/" || p === "/index.html";
    var dir = norm(p);
    var target = norm(url);
    return dir === target || dir === target + ".html";
  }

  /* which link this window is on, or null on a page that is nobody's door */
  function current() {
    var p = here();
    var i;
    for (i = 0; i < ALL.length; i++) {
      if (isActive(ALL[i].url)) return ALL[i];
    }
    if (norm(p) === "/player") return LINKS.player;
    return null;
  }

  /* "null://g" for the address bar of a tab */
  function host(url) {
    var i;
    for (i = 0; i < ALL.length; i++) {
      if (ALL[i].url === url) return ALL[i].host;
    }
    return norm(url).replace(/^\//, "") || "home";
  }

  function inMore() {
    return false;
  }

  N.router = {
    LINKS: LINKS,
    RAIL_TOP: RAIL_TOP,
    RAIL_BOTTOM: RAIL_BOTTOM,
    PRIMARY: PRIMARY,
    ALL: ALL,
    TABBED: TABBED,
    MORE: MORE,
    GROUPS: GROUPS,
    isActive: isActive,
    current: current,
    here: here,
    host: host,
    inMore: inMore,
    all: function () {
      return ALL.slice();
    },
  };
})();
