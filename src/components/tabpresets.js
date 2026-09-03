/* NULL — tabpresets.js
   Configurable browser-tab presets. One preset list, hardcoded here — no
   per-preset folders. Each preset has a favicon reference and a tab title.
   The selected preset overrides every NULL page title/favicon, including
   game/app pages opened inside the player (same-origin).

   Icons: official Google/GStatic assets where they exist, otherwise the
   real domain via Google's public favicon service (s2). Default = the
   "Untitled Slide - Google Slides" style title. */
(function () {
  var N = (window.N = window.N || {});

  var s2 = function (domain) {
    return "https://www.google.com/s2/favicons?domain=" + domain + "&sz=64";
  };
  var G = {
    slides: "https://ssl.gstatic.com/docs/presentations/images/favicon5.ico",
    sheets: "https://ssl.gstatic.com/docs/spreadsheets/images/spreadsheet_favicon_2020q4.ico",
    docs: "https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico",
    drive: "https://ssl.gstatic.com/docs/doclist/images/drive_2022_32dp.png",
    gmail: "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico",
    calendar: "https://ssl.gstatic.com/calendar/images/dynamicproduct_2020_32dp.png",
    classroom: "https://ssl.gstatic.com/classroom/ic_product_classroom_32.png",
    keep: "https://ssl.gstatic.com/keep/ic_keep_2022_32dp.png",
    maps: "https://ssl.gstatic.com/maps/maps_2023_32dp.png",
  };

  var PRESETS = [
    { id: "slides", name: "Default (Google Slides)", title: "Untitled Slide - Google Slides", icon: G.slides },
    { id: "null", name: "NULL", title: "NULL", icon: "/public/favicon.svg" },
    { id: "home", name: "Home", title: "Naperville Community Unit School District 203", icon: s2("naperville203.org") },
    { id: "noredink", name: "NoRedInk", title: "NoRedInk", icon: s2("noredink.com") },
    { id: "kahoot", name: "Kahoot", title: "Kahoot!", icon: s2("kahoot.it") },
    { id: "campus", name: "Infinite Campus", title: "Infinite Campus", icon: s2("infinitecampus.com") },
    { id: "desmos", name: "Desmos", title: "Desmos", icon: s2("desmos.com") },
    { id: "canvas", name: "Canvas", title: "Canvas", icon: s2("canvaslms.com") },
    { id: "canva", name: "Canva", title: "Canva", icon: s2("canva.com") },
    { id: "britannica", name: "Encyclopedia Britannica", title: "Encyclopedia Britannica", icon: s2("britannica.com") },
    { id: "docs", name: "Google Docs", title: "Untitled document - Google Docs", icon: G.docs },
    { id: "sheets", name: "Google Sheets", title: "Untitled spreadsheet - Google Sheets", icon: G.sheets },
    { id: "search", name: "Calculator", title: "calculator - Google Search", icon: "https://www.google.com/favicon.ico" },
    { id: "maps", name: "Google Maps", title: "Google Maps", icon: G.maps },
    { id: "keep", name: "Google Keep", title: "Google Keep", icon: G.keep },
    { id: "drive", name: "Google Drive", title: "My Drive - Google Drive", icon: G.drive },
    { id: "gclass", name: "Google Classroom", title: "Home", icon: G.classroom },
    { id: "gcal", name: "Google Calendar", title: "Google Calendar", icon: G.calendar },
    { id: "gmail", name: "Gmail", title: null, icon: G.gmail },
  ];

  function get(id) {
    return PRESETS.find(function (p) {
      return p.id === id;
    });
  }

  function titleFor(p) {
    if (!p) return "NULL";
    if (p.id === "gmail") {
      var addr = N.prefs.get("gmailAddr") || "you@gmail.com";
      var unread = parseInt(N.prefs.get("gmailUnread"), 10) || 0;
      return "Inbox" + (unread > 0 ? " (" + unread + ")" : "") + " - " + addr;
    }
    return p.title || p.name || "NULL";
  }

  function current() {
    return get(N.prefs.get("tab")) || get("slides");
  }

  function apply() {
    var p = current();
    var fav = document.getElementById("favicon");
    if (fav && p && p.icon) fav.setAttribute("href", p.icon);
    document.title = titleFor(p);
    N.tab.applied = p;
    return p;
  }

  N.tab = {
    list: PRESETS,
    get: get,
    current: current,
    titleFor: titleFor,
    apply: apply,
  };
})();
