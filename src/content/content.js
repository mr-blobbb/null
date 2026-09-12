/* NULL — content.js
   Hand-edited site content that search + the home dashboard read.
   The game/app/proxy library itself lives in src/catalog/generated-catalog.js
   (built with /tools); announcements and page descriptions live here. */
window.NULL_CONTENT = {
  announcements: [
    {
      id: "welcome",
      title: "Welcome to NULL",
      date: "2026-08-24",
      category: "notice",
      desc: "Welcome to NULL, a new alternative to SG Games developed by Mr Blob, hosting over 2,300 games, apps, and proxies, prioritizing the user first, always.",
    },
    {
      id: "welcome",
      title: "How to use",
      date: "2026-08-26",
      category: "notice",
      desc: "Please read our TOS, Privacy Policy, and District policy to learn more about our rules!",
    },
  ],

  /* Shop-unlocked beta builds. These never appear in the auto-discovered
     library — buying them in /shop merges them in at runtime (see
     catalog.js). Point `file` at the real beta build whenever one exists. */
  betas: [
    {
      id: "beta-simon",
      name: "Simon: Deluxe",
      date: "2026-09-08",
      desc: "Beta branch of SIMON \u2014 faster rounds and double-tap combos. Beta-only, unlocked in the Shop.",
      file: "/games/simon/simon.html",
      labels: ["beta", "memory"],
      price: 60,
    },
    {
      id: "beta-void",
      name: "Void: Nightshift",
      date: "2026-09-08",
      desc: "An experimental VOID variant with a colder palette. Beta-only, unlocked in the Shop.",
      file: "/games/void/void.html",
      labels: ["beta", "arcade"],
      price: 60,
    },
    {
      id: "beta-trace",
      name: "Trace: Ghost Mode",
      date: "2026-09-08",
      desc: "Beta branch of TRACE \u2014 trails linger longer. Beta-only, unlocked in the Shop.",
      file: "/games/trace/trace.html",
      labels: ["beta", "precision"],
      price: 60,
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
      url: "/games/",
      grp: "Library",
      desc: "Auto-discovered game library with warnings, labels and a player shell.",
      kw: "play game arcade fun library",
    },
    {
      title: "Apps",
      url: "/apps/",
      grp: "Library",
      desc: "Apps and tools that run inside the NULL player.",
      kw: "tools utilities app calculator",
    },
    {
      title: "Proxies",
      url: "/proxies/",
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
      title: "Shop",
      url: "/shop.html",
      grp: "Extras",
      desc: "Spend coins earned by playing on beta games, custom themes and effects.",
      kw: "shop store coins xp unlock buy beta theme rewards",
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
