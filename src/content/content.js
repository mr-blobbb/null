/* NULL · content.js
   Hand-edited site content that search + the home dashboard read.
   The game/app/proxy library itself lives in src/catalog/generated-catalog.js
   (rebuilt by the updater); announcements and page descriptions live here. */
window.NULL_CONTENT = {
  announcements: [
    {
      id: "live",
      title: "NULL is live",
      date: "2026-09-13",
      category: "notice",
      desc: "NULL is up. Around 2,300 games, plus apps and proxies, all in one place and all running in your browser. No account, no install, nothing to sign up for. Pick something from the library and it plays.",
    },
    {
      id: "start-here",
      title: "Start here",
      date: "2026-09-12",
      category: "info",
      link: "/about.html",
      desc: "New around here? The search bar finds games and apps by name, and the tabs up top split everything into games, apps and proxies. Settings handles your theme, the tab disguise and the panic key. The About page walks through the rest.",
    },
    {
      id: "shop-basics",
      title: "How the shop works",
      date: "2026-09-11",
      category: "info",
      link: "/shop.html",
      desc: "Playing games banks XP, XP turns into coins, and coins buy themes, particle effects and a few extras in the Shop. It is all local: no real money, no payment, nothing charged. Open the Shop and see what is in stock.",
    },
  ],

  /* Shop-unlocked beta builds. These never appear in the auto-discovered
     library: buying them in /shop merges them in at runtime (see
     catalog.js).

     `file` has to point at a build that is really in the repo. A missing one
     404s the shop tile and fails check-links, so a beta can only be listed
     while its game folder is there. Empty means the Shop shows no beta
     section at all (see shop.js). */
  betas: [],

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
      desc: "The whole game library, built from what's in the folders, with warnings, labels and a player shell.",
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
      desc: "What’s new on NULL.",
      kw: "news updates changelog posts",
    },
    {
      title: "Schedule",
      url: "/schedule.html",
      grp: "Pages",
      desc: "The school schedule: Regular and Homeroom/WIN days, live countdown, editable period names and lunch period.",
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
      desc: "Spend coins earned by playing on custom themes and effects, the custom background image, and the theme and particle editor.",
      kw: "shop store coins xp unlock buy theme rewards editor background",
    },
    {
      title: "Settings",
      url: "/settings.html",
      grp: "Pages",
      desc: "Theme, accent, layout compactness, seasonal and holiday themes, background image, tab presets, performance and Mini-Perf.",
      kw: "preferences theme accent tab cloak performance density compact comfy spacious seasonal holiday halloween background",
    },
    {
      title: "About",
      url: "/about.html",
      grp: "Info",
      desc: "What NULL is, who made it, and how to add your own games.",
      kw: "about what is how works readme",
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
      desc: "What NULL stores, where it is stored, and what it never collects.",
      kw: "privacy policy data local storage gdpr ccpa",
    },
    {
      title: "Terms",
      url: "/terms.html",
      grp: "Info",
      desc: "The agreement covering your use of NULL.",
      kw: "terms of service rules agreement use",
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
      desc: "NULL’s open license, the GNU AGPL version 3.",
      kw: "license agpl gnu copyleft open source",
    },

    /* The hidden pages. Nothing links them from the nav, but they are typed
       in like any other page so search can turn them up. `body: false` keeps
       the page text out of the index: blob alone would otherwise match half
       the site's vocabulary. */
    {
      title: "Void",
      url: "/void.html",
      grp: "Hidden",
      kind: "egg",
      icon: "eye",
      body: false,
      desc: "An entirely black page with one small line in the middle. The void awaits, and it does not explain itself.",
      kw: "void black blank dark nothing easter egg hidden lmao",
    },
    {
      title: "Blob",
      url: "/blob.html",
      grp: "Hidden",
      kind: "egg",
      icon: "eye",
      body: false,
      desc: "A page that types blob lines at you, semi fast, forever. Not a mascot. A lifestyle.",
      kw: "blob typing stream wobble easter egg hidden joke nldev",
    },
    {
      title: "Time",
      url: "/time.html",
      grp: "Hidden",
      kind: "egg",
      icon: "clock",
      body: false,
      desc: "The clock page. NULL is open from midnight to 8:00 AM, and this tells you exactly where you stand.",
      kw: "time clock midnight 8am vampire hours schedule easter egg hidden",
    },
    {
      title: "Credits",
      url: "/credits.html",
      grp: "Hidden",
      kind: "egg",
      icon: "star",
      body: false,
      desc: "The credits roll, and a skip button that does not skip anything.",
      kw: "credits roll thanks people skip easter egg hidden",
    },
  ],
};
