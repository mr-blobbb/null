PROXIES
=======

Two different things live under this name.

The SHELF is a hand-written list in src/lib/catalog.ts of sites worth having
one click away:

  {
    id: "internet-archive",
    name: "Internet Archive",
    kind: "proxy",
    url: "https://archive.org/",
    labels: ["Archive", "Books"],
    status: "All Good",          // or "Issue" / "Blocked"
  }

`status` is shown on the card and in the confirmation before a site opens.
It is a person's judgement, not a live check.

The WINDOW is the address bar at the top of the Proxies page. Type a domain
into it and the page loads inside NULL. The chain it is built for is

  NULL  ->  Scramjet / Ultraviolet  ->  Wisp relay  ->  the site

A browser cannot fetch another origin, which is the entire reason the relay
exists. The relay address and which engine to use are settings, stored with
the rest of the preferences, on the page and in src/lib/themes.ts.

Until a relay answers, the window says so in words and offers the site in a
real tab, rather than showing a blank frame and calling it done.
