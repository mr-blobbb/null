/* NULL · tabpresets.js
   Configurable browser-tab presets. One preset list, hardcoded here: no
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

  /* `url` is where the real site lives. When a cloak window opens, this tab
     can hand over to that address so the address bar matches the tab the
     site is calling itself (see N.tab.url and shell.js). NULL itself has no
     url: cloaking it and redirecting would just point back here. */
  var PRESETS = [
    { id: "slides", name: "Google Slides", title: "Untitled Slide - Google Slides", icon: G.slides, url: "https://docs.google.com/presentation/u/0/" },
    { id: "null", name: "NULL", title: "NULL", icon: "/public/favicon.svg", url: null },
    { id: "home", name: "Home", title: "Naperville Community Unit School District 203", icon: s2("naperville203.org"), url: "https://www.naperville203.org/" },
    { id: "noredink", name: "NoRedInk", title: "NoRedInk", icon: s2("noredink.com"), url: "https://www.noredink.com/" },
    { id: "kahoot", name: "Kahoot", title: "Kahoot!", icon: s2("kahoot.it"), url: "https://kahoot.it/" },
    { id: "campus", name: "Infinite Campus", title: "Infinite Campus", icon: s2("infinitecampus.com"), url: "https://www.infinitecampus.com/" },
    { id: "desmos", name: "Desmos", title: "Desmos", icon: s2("desmos.com"), url: "https://www.desmos.com/calculator" },
    { id: "canvas", name: "Canvas", title: "Canvas", icon: s2("canvaslms.com"), url: "https://canvas.instructure.com/" },
    { id: "canva", name: "Canva", title: "Canva", icon: s2("canva.com"), url: "https://www.canva.com/" },
    { id: "britannica", name: "Encyclopedia Britannica", title: "Encyclopedia Britannica", icon: s2("britannica.com"), url: "https://www.britannica.com/" },
    { id: "docs", name: "Google Docs", title: "Untitled document - Google Docs", icon: G.docs, url: "https://docs.google.com/document/u/0/" },
    { id: "sheets", name: "Google Sheets", title: "Untitled spreadsheet - Google Sheets", icon: G.sheets, url: "https://docs.google.com/spreadsheets/u/0/" },
    { id: "search", name: "Calculator", title: "calculator - Google Search", icon: "https://www.google.com/favicon.ico", url: "https://www.google.com/search?q=calculator" },
    { id: "maps", name: "Google Maps", title: "Google Maps", icon: G.maps, url: "https://www.google.com/maps" },
    { id: "keep", name: "Google Keep", title: "Google Keep", icon: G.keep, url: "https://keep.google.com/" },
    { id: "drive", name: "Google Drive", title: "My Drive - Google Drive", icon: G.drive, url: "https://drive.google.com/drive/my-drive" },
    { id: "gclass", name: "Google Classroom", title: "Home", icon: G.classroom, url: "https://classroom.google.com/" },
    { id: "gcal", name: "Google Calendar", title: "Google Calendar", icon: G.calendar, url: "https://calendar.google.com/" },
    { id: "gmail", name: "Gmail", title: null, icon: G.gmail, url: "https://mail.google.com/mail/u/0/" },
    /* custom preset: title/favicon/url come from prefs.tabCustom, edited in settings */
    { id: "custom", name: "Custom tab", title: null, icon: null, url: null },
  ];

  function get(id) {
    var p = PRESETS.find(function (p) {
      return p.id === id;
    });
    if (!p) return null;
    if (p.id === "custom") {
      var c = N.prefs.get("tabCustom") || {};
      return { id: "custom", name: "Custom tab", title: c.title || null, icon: c.icon || null };
    }
    return p;
  }

  function titleFor(p) {
    if (!p) return "NULL";
    if (p.id === "gmail") {
      var addr = N.prefs.get("gmailAddr") || "you@gmail.com";
      var unread = parseInt(N.prefs.get("gmailUnread"), 10) || 0;
      return "Inbox" + (unread > 0 ? " (" + unread + ")" : "") + " - " + addr;
    }
    if (p.id === "custom") return p.title || "NULL";
    return p.title || p.name || "NULL";
  }

  function current() {
    return get(N.prefs.get("tab")) || get("slides");
  }

  /* where this tab should hand over to when a cloak window opens: the real
     site behind the preset, so the address bar agrees with the tab title. */
  function urlFor(p) {
    if (!p) return null;
    if (p.id === "custom") {
      var c = N.prefs.get("tabCustom") || {};
      return c.url || null;
    }
    return p.url || null;
  }

  function apply(id) {
    var p = id ? get(id) : current();
    var fav = document.getElementById("favicon");
    /* custom presets without an icon keep the existing favicon */
    if (fav && p && p.icon) fav.setAttribute("href", p.icon);
    document.title = titleFor(p);
    N.tab.applied = p;
    return p;
  }

  /* ---------- smart tab cloak ----------
     When on, the tab cycles between the school presets on a timer set in
     settings (smartTabMin minutes). The countdown pauses while the tab
     isn't open and resumes where it left off when it comes back. The
     user's selected preset returns the moment smart cloak is turned off. */
  var ROTATE = PRESETS.filter(function (p) {
    return p.id !== "null" && p.id !== "custom";
  });
  var smartTimer = null;
  var smartDue = 0; // epoch ms of the next change; 0 = idle

  function smartRun() {
    smartDue = 0;
    var cur = N.tab.applied ? N.tab.applied.id : null;
    var pool = ROTATE.filter(function (p) {
      return p.id !== cur;
    });
    if (pool.length) apply(pool[Math.floor(Math.random() * pool.length)]);
    smartArm(parseInt(N.prefs.get("smartTabMin"), 10) * 60000 || 300000);
  }

  function smartArm(ms) {
    smartClear();
    if (N.prefs.get("smartTab") !== true) return;
    smartDue = Date.now() + ms;
    if (!document.hidden) smartTimer = setTimeout(smartRun, ms);
  }

  function smartClear() {
    if (smartTimer) {
      clearTimeout(smartTimer);
      smartTimer = null;
    }
  }

  function smartStart() {
    smartClear();
    smartDue = 0;
    smartArm(parseInt(N.prefs.get("smartTabMin"), 10) * 60000 || 300000);
  }

  function smartStop() {
    smartClear();
    smartDue = 0;
  }

  /* pause = clear the timer but keep the due time; visible = resume with
     whatever time is left */
  document.addEventListener("visibilitychange", function () {
    if (N.prefs.get("smartTab") !== true || !smartDue) return;
    if (document.hidden) smartClear();
    else smartTimer = setTimeout(smartRun, Math.max(1000, smartDue - Date.now()));
  });

  N.tab = {
    list: PRESETS,
    get: get,
    current: current,
    urlFor: urlFor,
    url: function () {
      return urlFor(current());
    },
    titleFor: titleFor,
    apply: apply,
    smartStart: smartStart,
    smartStop: smartStop,
  };
})();
