/* NULL · about.js
   Builds the fun half of the About page: the animated wordmark, the counters,
   the "what's inside" cards, the story, the FAQ and the row of paperwork
   buttons (Terms, Privacy, Cookies, License, District) with labels that do
   not sound like a lawyer wrote them.

   The long version at the bottom is still the markdown block in about.html:
   legal.js renders it, this file never touches the copy. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var REPO = "https://github.com/googleslides2026/googleslides2026.github.io";

  /* ---------- hero: split the wordmark so the letters can cascade ---------- */
  function hero() {
    var wm = d.qs(".ab-null");
    if (wm) {
      var text = wm.textContent.trim() || "NULL";
      wm.textContent = "";
      text.split("").forEach(function (ch, i) {
        wm.appendChild(d.h("span", { style: { "--i": i } }, ch));
      });
    }
    var host = d.qs("#abActions");
    if (!host) return;

    function btn(label, icon, cls, href) {
      return d.h("a", { class: "btn " + (cls || "btn-outline") + " btn-sm", href: href }, [
        d.icon(icon),
        label,
      ]);
    }
    host.appendChild(btn("Take me to the games", "play", "btn-primary", N.url("/games/")));
    host.appendChild(btn("How the shop works", "store", "btn-outline", N.url("/shop")));
    host.appendChild(btn("The fine print in plain words", "file", "btn-outline", N.url("/terms")));

    /* copying the repo link is somehow the most fun button on the page */
    var copyBtn = d.h("button", { type: "button", class: "btn btn-outline btn-sm" }, [
      d.icon("code"),
      "Copy the repo link",
    ]);
    copyBtn.addEventListener("click", function () {
      var finish = function () {
        d.toast("Repo link copied. Build something with it.", { icon: "check" });
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(REPO).then(finish, finish);
      } else {
        finish();
      }
    });
    host.appendChild(copyBtn);
  }

  /* ---------- counters ---------- */
  function stats() {
    var host = d.qs("#abStats");
    if (!host) return;
    var cat = N.catalog;
    function n(fn) {
      try {
        var v = fn();
        return v && v.length ? v.length.toLocaleString() : "—";
      } catch (err) {
        return "—";
      }
    }
    var rows = [
      { v: n(function () { return cat.games(); }), t: "games in the library", i: "game" },
      { v: n(function () { return cat.apps(); }), t: "apps and tools", i: "grid" },
      { v: n(function () { return cat.proxies(); }), t: "proxy links out", i: "proxy" },
      { v: "0", t: "servers, accounts and trackers", i: "ban" },
      { v: "100%", t: "free, and always will be", i: "heart" },
    ];
    rows.forEach(function (r, i) {
      host.appendChild(
        d.h("div", { class: "ab-stat", style: { "--i": i } }, [
          d.icon(r.i),
          d.h("b", null, r.v),
          d.h("span", null, r.t),
        ]),
      );
    });
  }

  /* ---------- what's inside ---------- */
  var CARDS = [
    { i: "game", t: "Games", p: "A few thousand of them, with labels, warnings where they matter, and a player that just works. Star the ones you like." },
    { i: "grid", t: "Apps", p: "Small tools that open in the same player instead of sending you off to another site." },
    { i: "proxy", t: "Proxies", p: "Links out to other sites. They open in a new tab, because we do not own them and are not pretending to." },
    { i: "sched", t: "Schedule", p: "Your periods, live, with a countdown to the bell and confetti when one ends. Editable, because every school names them differently." },
    { i: "store", t: "Shop", p: "Play to earn XP, XP to earn coins, coins to buy themes, particle effects and extras. No real money, ever." },
    { i: "settings", t: "Settings", p: "Accent colors, glow, dark and light, seasonal themes, layout compactness, tab disguises, a panic key and a backup button." },
    { i: "pen", t: "The editor", p: "Build your own theme pack and particle set: four colors, a backdrop, and what drifts through it. The preview is the real thing." },
    { i: "download", t: "Offline builds", p: "Three single-file versions in Releases: regular, mini and lite. Download one, open it, done. No install." },
  ];

  function cards() {
    var host = d.qs("#abGrid");
    if (!host) return;
    CARDS.forEach(function (c, i) {
      host.appendChild(
        d.h("article", { class: "ab-card", style: { "--i": i } }, [
          d.h("span", { class: "ab-ic" }, [d.icon(c.i)]),
          d.h("b", null, c.t),
          d.h("p", null, c.p),
        ]),
      );
    });
  }

  /* ---------- the story ---------- */
  var STORY = [
    { when: "the before times", t: "Two games sites, both terrible", p: "One was blocked by week two. The other looked like it was built in 2004 and took nine seconds to load a page." },
    { when: "then", t: "NULL got built", p: "Black and white, fast, no sign ups, no ads covering the screen. Plain HTML, CSS and JavaScript, with no server to pay for or keep alive." },
    { when: "the growth spurt", t: "A few thousand games", p: "Drop a folder into games/ with an HTML file inside, push, and a GitHub Action rebuilds the library. That is the whole submission process." },
    { when: "now", t: "Live, and still shipping", p: "Themes, particles, a shop with no real money in it, a class schedule, tab disguises, a panic key and a couple of very silly easter eggs." },
    { when: "next", t: "Whatever gets added next", p: "It is a school project, so it changes when there is time. The announcements page is where new things land first." },
  ];

  function story() {
    var host = d.qs("#abStory");
    if (!host) return;
    host.appendChild(d.h("h2", null, [d.icon("clock"), "The story so far"]));
    host.appendChild(
      d.h("p", { class: "ab-sub" }, "Short version: the games sites we had were slow, ugly, or blocked. So this one got built instead."),
    );
    var box = d.h("div", { class: "ab-time" });
    STORY.forEach(function (s) {
      box.appendChild(
        d.h("div", { class: "ab-beat" }, [
          d.h("i", null, s.when),
          d.h("b", null, s.t),
          d.h("span", null, s.p),
        ]),
      );
    });
    host.appendChild(box);
  }

  /* ---------- FAQ ---------- */
  var FAQ = [
    { q: "Is it really free?", a: "Yes, and there is nothing to buy with real money. Coins are earned by playing, and they only unlock cosmetic things like themes and particle effects." },
    { q: "Do I need an account?", a: "No accounts exist. NULL has no backend at all: favourites, history, coins and settings live in your own browser." },
    { q: "Will it get blocked at my school?", a: "Possibly. That is up to your network, not us. The Backups page lists alternate places to reach it, and there are offline single-file builds in Releases if the domain itself is blocked." },
    { q: "Can I add a game?", a: "Yes. Make a folder in games/ named after the game, drop the game's HTML file in it, and optionally add Label.txt, Warning.txt, meta.txt and a thumbnail. Push, and the library rebuilds itself." },
    { q: "Why is everything black and white?", a: "Because it makes the whole site feel like one thing instead of forty pages from forty different templates. Color is something you unlock, not something that gets sprayed everywhere." },
    { q: "What does 'unblocked' actually mean?", a: "It means NULL is a plain static website, so it loads anywhere ordinary web pages load, and there is no app to install and no download to get flagged." },
    { q: "Is anything I do here visible to anyone else?", a: "No. There is no analytics, no tracking and no server that could store it. Nobody, including whoever runs NULL, can see what you played." },
  ];

  function faq() {
    var host = d.qs("#abFaq");
    if (!host) return;
    host.appendChild(d.h("h2", null, [d.icon("help"), "Questions people actually ask"]));
    host.appendChild(d.h("p", { class: "ab-sub" }, "If yours is not here, the announcements page usually answers the rest."));
    var box = d.h("div", { class: "ab-faq" });
    FAQ.forEach(function (f) {
      box.appendChild(
        d.h("details", { class: "ab-q" }, [
          d.h("summary", null, [d.icon("help"), f.q, d.icon("chevD")]),
          d.h("p", { html: f.a }),
        ]),
      );
    });
    host.appendChild(box);
  }

  /* ---------- the paperwork, with friendlier labels ---------- */
  var PAPERS = [
    { t: "Terms of Service", i: "file", u: "/terms" },
    { t: "Privacy (we collect nothing)", i: "lock", u: "/privacy" },
    { t: "Cookies (there are none)", i: "cookie", u: "/cookies" },
    { t: "License (take it and share it)", i: "code", u: "/license" },
    { t: "District notes", i: "school", u: "/district" },
  ];

  function papers() {
    var host = d.qs("#abPapers");
    if (!host) return;
    PAPERS.forEach(function (p) {
      host.appendChild(
        d.h("a", { class: "btn btn-outline btn-sm", href: N.url(p.u) }, [d.icon(p.i), p.t]),
      );
    });
  }

  /* cards fade in as they are reached, once each */
  function reveal() {
    var els = d.qsa(".ab-card");
    if (!els.length) return;
    if (typeof IntersectionObserver === "undefined") {
      els.forEach(function (el) {
        el.classList.add("in");
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (el) {
      io.observe(el);
    });
  }

  function init() {
    hero();
    stats();
    cards();
    story();
    faq();
    papers();
    reveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
