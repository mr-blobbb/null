/* NULL — content.js
   Hand-edited site content that search + the home dashboard read.
   Games, apps and proxies are discovered automatically (see scripts/);
   announcements and page descriptions live here on purpose. */
window.NULL_CONTENT = {
  announcements: [
    {
      id: "welcome",
      title: "Welcome to NULL",
      date: "2026-08-24",
      category: "update",
      desc: "NULL is up: a plain black-and-white hub for games, apps, proxies and tools. Recently played, tab cloaks and themes all live in your browser \u2014 nothing is uploaded anywhere.",
    },
    {
      id: "new-games",
      title: "Library refresh \u2014 PULSE, TRACE & FLIP",
      date: "2026-08-26",
      category: "update",
      desc: "New first-party games landed in the library. Drop more folders into games/ and re-run the catalog build to add them automatically.",
    },
    {
      id: "school-starts",
      title: "Schedule is loaded",
      date: "2026-08-17",
      category: "notice",
      desc: "The schedule is live on the home page and the Schedule page: Regular days Monday/Wednesday/Friday, Homeroom/WIN on Tuesday/Thursday, with a live time-left clock. Rename your periods and pick your lunch period (4\u20136) right on the page.",
    },
    {
      id: "releases",
      title: "Standalone releases",
      date: "2026-09-01",
      category: "update",
      desc: "NULL Mini, Lite and Regular are generated as single-file builds in /releases. Each is fully standalone \u2014 no CSS, JS or catalog files needed.",
      link: "/releases/null-regular.html",
    },
  ],

  pages: [
    {
      title: "Home",
      url: "/",
      grp: "Pages",
      desc: "NULL home: search everything, featured library items, recently played and the live school schedule.",
      kw: "home dashboard start welcome hub search",
    },
    {
      title: "Games",
      url: "/games.html",
      grp: "Library",
      desc: "Auto-discovered game library with warnings, labels and a player shell.",
      kw: "play game arcade fun library",
    },
    {
      title: "Apps",
      url: "/apps.html",
      grp: "Library",
      desc: "Apps and tools that run inside the NULL player.",
      kw: "tools utilities app calculator",
    },
    {
      title: "Proxies",
      url: "/proxies.html",
      grp: "Library",
      desc: "External sites NULL links out to, with manual status markers.",
      kw: "external links sites status",
    },
    {
      title: "Announcements",
      url: "/announcements.html",
      grp: "Pages",
      desc: "What\u2019s new on NULL.",
      kw: "news updates changelog posts",
    },
    {
      title: "Schedule",
      url: "/schedule.html",
      grp: "Pages",
      desc: "The school schedule \u2014 Regular and Homeroom/WIN days, live countdown, editable period names and lunch period.",
      kw: "school bell time class period day lunch homeroom win",
    },
    {
      title: "Backups",
      url: "/backups.html",
      grp: "Pages",
      desc: "Alternate places to reach NULL if this domain goes down.",
      kw: "mirror alternate domain access link",
    },
    {
      title: "Settings",
      url: "/settings.html",
      grp: "Pages",
      desc: "Theme, accent, tab presets, performance mode.",
      kw: "preferences theme accent tab cloak performance",
    },
    {
      title: "About",
      url: "/about.html",
      grp: "Info",
      desc: "What NULL is and how it works.",
      kw: "about what is how works",
    },
    {
      title: "District",
      url: "/district.html",
      grp: "Info",
      desc: "District information page.",
      kw: "school district naperville 203",
    },
    {
      title: "Privacy",
      url: "/privacy.html",
      grp: "Info",
      desc: "What NULL stores (it stays on your device).",
      kw: "privacy data local storage",
    },
    {
      title: "Terms",
      url: "/terms.html",
      grp: "Info",
      desc: "Terms for using NULL.",
      kw: "terms rules use",
    },
    {
      title: "Cookies",
      url: "/cookies.html",
      grp: "Info",
      desc: "How NULL handles cookies.",
      kw: "cookies storage tracking",
    },
    {
      title: "License",
      url: "/license.html",
      grp: "Info",
      desc: "NULL\u2019s open license.",
      kw: "license mit open source",
    },
  ],
};
