/* NULL · content.js
   Hand-edited site content that search and the palette read.
   The game/app/proxy library itself lives in src/catalog/generated-catalog.js
   (rebuilt by the updater); the posts and the page blurbs live here.

   One rule: nothing in this file may point at a page that does not exist. The
   link checker reads it, so a deleted page turns into a failed check instead
   of a dead end for a visitor. */
window.NULL_CONTENT = {
  announcements: [
    {
      id: "live",
      title: "NULL is live",
      date: "2026-09-13",
      category: "notice",
      link: "/changelog",
      desc: "NULL is up. Around 2,300 games, plus apps and proxies, all in one place and all running in your browser. No account, no install, nothing to sign up for. Pick something from the library and it plays.",
    },
    {
      id: "proxies",
      title: "The proxy window works now",
      date: "2026-09-17",
      category: "info",
      link: "/proxies/",
      desc: "Proxies is not just a list of links any more: type an address and the page loads inside NULL, rewritten as it arrives so its links and requests stay in the frame. It rides on a Wisp relay, and the address of that relay is yours to change.",
    },
    {
      id: "shop-basics",
      title: "How the shop works",
      date: "2026-09-16",
      category: "info",
      link: "/shop",
      desc: "Coins come from playing: three a minute while a game is open, plus a bonus every fifteen minutes on the site. Coins buy avatar decorations, profile effects and name tags. All of it is local, and none of it costs anything.",
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

  /* the nine doors, and nothing else: the palette shows these, the search
     ranks them, and the tab bar names them */
  pages: [
    {
      title: "Home",
      url: "/",
      grp: "Pages",
      desc: "The front door: search everything, jump to a page, and see what is new.",
      kw: "home start welcome hub search front door",
    },
    {
      title: "Games",
      url: "/games/",
      grp: "Library",
      desc: "The whole game library: one square each, searchable by name or by category.",
      kw: "play game arcade fun library",
    },
    {
      title: "Apps",
      url: "/apps/",
      grp: "Library",
      desc: "Tools and toys that run in a tab, laid out exactly like the games.",
      kw: "app tool utility library",
    },
    {
      title: "Proxies",
      url: "/proxies/",
      grp: "Library",
      desc: "Open a website inside NULL through a Wisp relay, or use the ready-made links.",
      kw: "proxy wisp relay unblock browse mirror",
    },
    {
      title: "Shop",
      url: "/shop",
      grp: "You",
      desc: "Spend the coins you earn by playing on avatar decorations, profile effects and name tags.",
      kw: "shop coins buy cosmetics decorate profile name tag gift",
    },
    {
      title: "Profile",
      url: "/profile",
      grp: "You",
      desc: "Your card: banner, picture, name, bio and library. Kept in this browser, not on a server.",
      kw: "profile account login sign in banner avatar bio me",
    },
    {
      title: "Changelog",
      url: "/changelog",
      grp: "You",
      desc: "Every release, newest first, with what was added and what was fixed.",
      kw: "changelog release notes news update version",
    },
    {
      title: "Extensions",
      url: "/extensions",
      grp: "You",
      desc: "Install .nullext extensions with full access to NULL, or import a Chrome popup.",
      kw: "extension addon nullext chrome plugin widget",
    },
    {
      title: "Settings",
      url: "/settings",
      grp: "You",
      desc: "Themes, effects, your data and the paperwork, over the top of whatever page you are on.",
      kw: "settings theme palette appearance data privacy terms cookies",
    },
  ],
};
