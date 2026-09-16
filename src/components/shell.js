/* NULL · shell.js
   Shared chrome: top navigation (icon-only links + mobile drawer), search
   trigger, theme toggle, footer, custom scrollbar attachment, back-to-top
   and the global keyboard bits (SGGAMES, panic key, "/" to search). */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  /* the narrowest window the side rail is drawn in. extra.css agrees: its
     rail block is a min-width query on the same number, and Settings says so
     out loud when a visitor picks the rail in a window too small for it. */
  var RAIL_MIN = 420;

  function railMode() {
    return document.documentElement.dataset.nav === "side" && window.innerWidth >= RAIL_MIN;
  }

  /* NULL mark = the Material "block" glyph: a circle with a slash. */
  function logoMark() {
    return d.h("span", { class: "brand-mark", "aria-hidden": "true" }, [
      d.icon("ban"),
    ]);
  }

  function brandEl() {
    var el = d.h("a", { class: "brand", href: N.url("/"), "aria-label": "NULL home" }, [
      logoMark(),
      d.h("span", { class: "brand-name" }, "NULL"),
    ]);
    bindBrand(el);
    return el;
  }

  /* The NULL mark snaps on hover. A plain :hover on the anchor only fired
     once per visit to the whole logo, so moving between the mark and the
     wordmark looked dead. Entering either half replays it instead. */
  function bindBrand(el) {
    var ic = el.querySelector(".brand-mark .msr");
    if (!ic) return;
    ["brand-mark", "brand-name"].forEach(function (name) {
      var part = el.querySelector("." + name);
      if (!part) return;
      part.addEventListener("mouseenter", function () {
        ic.classList.remove("snap");
        void ic.offsetWidth; /* reflow, so the animation restarts */
        ic.classList.add("snap");
      });
    });
  }

  /* ---------- the More button ----------
     The rail holds four doors; everything else on the site is behind this one
     button, so the four can sit far apart instead of becoming a wall of
     icons. The panel is measured onto the button rather than hung off CSS:
     the nav is a top bar on some screens and a left rail on others, and a
     rail has no room below the button (it used to fly out near the top of the
     window, nowhere near what was clicked). In the rail it opens beside the
     button, in the bar it drops underneath.

     What is inside comes from the router's More list, and the installed
     extension popups are listed under the same heading: the menu the old
     extensions button owned is one click away, just one click further out. */
  function moreNav() {
    var wrap = d.h("div", { class: "more-wrap more-nav" });
    var btn = d.h(
      "button",
      {
        type: "button",
        class: "nav-link" + (N.router.inMore("/extensions") ? " on" : ""),
        title: "All pages",
        "aria-label": "All pages",
        "aria-expanded": "false",
        "data-ic": "more",
      },
      [d.icon("list"), d.h("span", { class: "nl-txt" }, "More")],
    );
    var menu = d.h("div", { class: "more-menu elev" });

    /* rebuilt on every open: an extension can be installed, run or disabled
       while the page is up */
    function fill() {
      menu.textContent = "";
      N.router.MORE.forEach(function (g) {
        menu.appendChild(d.h("div", { class: "mg" }, g.name));
        g.links.forEach(function (l) {
          menu.appendChild(
            d.h("a", { class: "mi" + (N.router.isActive(l.url) ? " on" : ""), href: N.url(l.url) }, [
              d.icon(l.icon),
              d.h("span", null, l.t),
            ]),
          );
        });
      });
      menu.appendChild(d.h("div", { class: "mg" }, "Extensions"));
      var extHost = d.h("div", { class: "em-list" });
      menu.appendChild(extHost);
      if (N.ext) N.ext.menu(extHost, close);
    }

    function place() {
      var r = btn.getBoundingClientRect();
      var gap = 8;
      var w = menu.offsetWidth || 300;
      var h = menu.offsetHeight || 320;
      var left;
      var top;
      if (railMode()) {
        left = r.right + gap;
        top = Math.min(r.top, window.innerHeight - 12 - h);
      } else {
        left = r.left;
        if (left + w > window.innerWidth - 12) left = Math.max(12, r.right - w);
        top = r.bottom + gap;
      }
      left = Math.min(Math.max(12, left), Math.max(12, window.innerWidth - w - 12));
      top = Math.max(12, top);
      menu.style.position = "fixed";
      menu.style.left = Math.round(left) + "px";
      menu.style.top = Math.round(top) + "px";
      menu.style.right = "auto";
      menu.style.maxHeight = Math.max(200, window.innerHeight - top - 16) + "px";
    }

    function close() {
      wrap.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
    function open() {
      fill();
      /* the unread / something-to-claim dots live on link hrefs, and the panel
         was just rebuilt: put them back before it is measured */
      paintAnnDots();
      paintShopDot();
      place();
      wrap.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (wrap.classList.contains("open")) close();
      else open();
    });
    document.addEventListener("click", function (e) {
      if (wrap.classList.contains("open") && !wrap.contains(e.target)) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
    window.addEventListener("resize", function () {
      if (wrap.classList.contains("open")) place();
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    return wrap;
  }

  /* ---------- the rest of the site, listed while the rail is open ---------
     Four doors sit in the rail; everything else is written out here, under
     the More row, as a small two-column list. It is hidden the whole time
     the rail is shut (extra.css only reveals it while the rail is hovered or
     holds the keyboard), so the collapsed rail is the four doors and nothing
     else, and an open one shows a visitor where the rest of the site went.

     Only the router's pages are listed: the installed extension popups stay
     in the More flyout, which is also the path on a touch screen, where the
     rail can never be hovered open. */
  function railRest() {
    var box = d.h("div", { class: "rail-rest" });
    var groups = N.router.MORE.concat([{ name: "More", links: [N.router.LINKS.extensions] }]);
    groups.forEach(function (g) {
      box.appendChild(d.h("div", { class: "rg" }, g.name));
      g.links.forEach(function (l) {
        box.appendChild(
          d.h(
            "a",
            {
              class: "rr" + (N.router.isActive(l.url) ? " on" : ""),
              href: N.url(l.url),
            },
            l.t,
          ),
        );
      });
    });
    return box;
  }

  /* ---------- topbar ---------- */
  function topbar() {
    var bar = d.h("div", { class: "topbar" });

    bar.appendChild(brandEl());

    /* primary links: icon-only, no Home (the brand mark is home) */
    var links = d.h("nav", { class: "nav-links" });
    N.router.PRIMARY.forEach(function (l) {
      /* the name rides along in the markup: the side rail shows it when it
         opens, the top bar just lets it sit there clipped */
      var a = d.h("a", {
        class: "nav-link" + (N.router.isActive(l.url) ? " on" : ""),
        href: N.url(l.url),
        title: l.t,
        "aria-label": l.t,
        "data-ic": l.id,
      }, [d.icon(l.icon), d.h("span", { class: "nl-txt" }, l.t)]);
      if (l.id === "announcements") a.appendChild(annDotEl());
      links.appendChild(a);
    });
    /* the rest of the site, one button further out: see moreNav(). The rail
       writes them out under that button as well; see railRest(). */
    links.appendChild(moreNav());
    links.appendChild(railRest());
    bar.appendChild(links);

    /* the mount point extensions get for their own nav chrome (see ext.js's
       slot()): a strip under the links, in the rail or in the bar */
    bar.appendChild(d.h("div", { "data-slot": "nav", class: "nav-slot" }));

    /* the site's own period clock (see periodClock) */
    bar.appendChild(d.h("span", { class: "clock-slot", "data-clock": "nav" }));

    /* Right actions. The bar used to carry a search field and a light/dark
       flip as well: both are gone. Search is "/" anywhere, the front door's
       own box, and the first row of the mobile drawer; the theme switch is a
       real setting in Settings. */
    var actions = d.h("div", { class: "top-actions" });

    var burger = d.h("button", {
      type: "button",
      class: "btn-icon btn-outline burger",
      title: "Menu",
      "aria-label": "Open menu",
    }, [d.icon("menu")]);
    burger.addEventListener("click", function () {
      drawerOv.classList.toggle("open");
      document.body.style.overflow = drawerOv.classList.contains("open") ? "hidden" : "";
    });
    actions.appendChild(burger);
    bar.appendChild(actions);

    /* mobile drawer */
    var drawer = d.h("div", { class: "drawer elev" });
    drawer.appendChild(
      d.h("div", { class: "drawer-head" }, [
        brandEl(),
        d.h("button", {
          type: "button",
          class: "btn-icon btn-ghost",
          "aria-label": "Close menu",
          onclick: function () {
            drawerOv.classList.remove("open");
            document.body.style.overflow = "";
          },
        }, [d.icon("x")]),
      ]),
    );
    /* search, first thing in the drawer: without a nav field this is how a
       phone reaches it */
    var drawerSearch = d.h("button", { type: "button", class: "drawer-search" }, [
      d.icon("search"),
      d.h("span", null, "Search NULL"),
    ]);
    drawerSearch.addEventListener("click", function () {
      drawerOv.classList.remove("open");
      document.body.style.overflow = "";
      N.search.open();
    });
    drawer.appendChild(drawerSearch);
    N.router.GROUPS.forEach(function (g) {
      drawer.appendChild(d.h("div", { class: "mg" }, g.name));
      g.links.forEach(function (l) {
        var mi = d.h("a", { class: "mi" + (N.router.isActive(l.url) ? " on" : ""), href: N.url(l.url) }, [
          d.icon(l.icon),
          d.h("span", null, l.t),
        ]);
        if (l.url === "/announcements") mi.appendChild(annDotEl());
        drawer.appendChild(mi);
      });
    });
    drawer.appendChild(
      d.h("div", { class: "drawer-foot" }, "Local-first: nothing leaves your browser."),
    );
    var drawerOv = d.h("div", { class: "drawer-ov" }, [drawer]);
    drawerOv.addEventListener("mousedown", function (e) {
      if (e.target === drawerOv) {
        drawerOv.classList.remove("open");
        document.body.style.overflow = "";
      }
    });

    bar.appendChild(drawerOv);
    return bar;
  }

  /* ---------- unread announcements dot on the nav icon ---------- */
  function annDotEl() {
    return d.h("span", { class: "nav-dot", "aria-hidden": "true" });
  }
  function paintAnnDots() {
    if (!N.ann) return;
    var unread = N.ann.unread();
    d.qsa('a[href="' + N.url("/announcements") + '"]').forEach(function (a) {
      var dot = a.querySelector(".nav-dot");
      if (unread && !dot) a.appendChild(annDotEl());
      else if (!unread && dot) dot.remove();
    });
  }
  N.bus.on("annSeen", paintAnnDots);

  /* ---------- "something to claim" dot on the Shop icon ----------
     Lights while the daily crate is unopened or a quest / achievement is
     waiting to be paid out, so the loop is visible from any page. */
  function paintShopDot() {
    if (!N.econ) return;
    var st = N.econ.state();
    var ready = st.canSpin || st.questsReady > 0 || st.achReady > 0;
    d.qsa('a[href="' + N.url("/shop") + '"]').forEach(function (a) {
      var dot = a.querySelector(".nav-dot");
      if (ready && !dot) a.appendChild(d.h("span", { class: "nav-dot", "aria-hidden": "true" }));
      else if (!ready && dot) dot.remove();
    });
  }
  N.bus.on("eco", paintShopDot);
  N.bus.on("daily", paintShopDot);

  /* another NULL window sharing this origin (a second tab, the installed app,
     a cloaked about:blank / blob: copy) just changed the stored settings:
     adopt them here instead of looking stale until the next reload */
  N.bus.on("sync", function () {
    if (N.theme) N.theme.applyAll();
    if (N.tab) N.tab.apply();

    if (N.seasons) N.seasons.refresh();
    paintAnnDots();
    paintShopDot();
  });

  /* ---------- footer ---------- */
  function footer() {
    var inner = d.h("div", { class: "inner" });
    inner.appendChild(
      d.h("div", { class: "blurb" }, [
        brandEl(),
        d.h("p", null,
          "A massive site filled with ~2,300 games, and so much more. Developed by Mr Blob and NULL Labs to bring you the best alternative to SG Games ever! (Also bro our school had like 2 games sites 😭)"),
      ]),
    );
    N.router.FOOT.forEach(function (col) {
      var wrap = d.h("div", { class: "col" }, [d.h("h4", null, col.name)]);
      col.links.forEach(function (l) {
        wrap.appendChild(d.h("a", { href: N.url(l.url) }, l.t));
      });
      inner.appendChild(wrap);
    });
    /* extensions can mount here too (ext.js's slot("footer")) */
    inner.appendChild(d.h("div", { "data-slot": "foot", class: "foot-slot" }));
var foot = d.h("footer", { class: "site-foot" }, [inner]); 
foot.appendChild( 
  d.h("div", { class: "bottom" }, [ 
    "© " + new Date().getFullYear() + " NULL Labs · Developed by Mr Blob", 
  ]), 
); 
return foot; 
}


  /* ---------- back to top ---------- */
  function backTop() {
    var btn = d.h("button", {
      type: "button",
      class: "btn-icon btn-outline back-top elev",
      "aria-label": "Back to top",
    }, [d.icon("up")]);
    var scroller = document.body.classList.contains("lb") ? d.qs("#scrollview") : window;
    var shown = false;
    function onScroll() {
      var y = scroller === window
        ? window.scrollY || document.documentElement.scrollTop
        : scroller.scrollTop;
      if (y > 700 && !shown) {
        shown = true;
        btn.classList.add("show");
      } else if (y <= 700 && shown) {
        shown = false;
        btn.classList.remove("show");
      }
    }
    btn.addEventListener("click", function () {
      if (scroller === window) window.scrollTo({ top: 0, behavior: "smooth" });
      else scroller.scrollTo({ top: 0, behavior: "smooth" });
    });
    (scroller === window ? window : scroller).addEventListener("scroll", onScroll, { passive: true });
    document.body.appendChild(btn);
  }

  /* ---------- keyboard ---------- */
  function shortcuts() {
    document.addEventListener("keydown", function (e) {
      var typing = isTyping(e.target);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        N.search.open();
        return;
      }
      if (typing) return;
      panicCheck(e);
    });
  }

  /* ---------- panic key ---------- */
  var panicLast = 0;
  function panicCheck(e) {
    var p = N.prefs;
    var key = p.get("panicKey") || "`";
    if (e.key !== key) return;
    e.preventDefault();
    var now = Date.now();
    if (p.get("panicMode") === "double") {
      if (now - panicLast <= 400) {
        panicLast = 0;
        run();
      } else {
        panicLast = now;
      }
    } else {
      run();
    }
    function run() {
      var url = p.get("panicUrl") || "https://classroom.google.com";
      try {
        window.location.replace(url);
      } catch (err) {
        window.location.href = url;
      }
    }
  }

  /* ============================================================
     the hidden pages, and how you fall into them
       /void     hold Backspace and the page erases line by line
       /blob     a small orb sits in the corner during period four
       /time     type the current half of the day, or outlast midnight
       /credits  the shop's completion reward (see shop.js)
     ============================================================ */
  var VOID_URL = N.url("/void");
  var BLOB_URL = N.url("/blob");
  var TIME_URL = N.url("/time");

  function isTyping(t) {
    return (
      !!t &&
      (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
    );
  }

  /* the eggs stay off the player, and nothing fires over another overlay */
  function eggsAllowed() {
    var b = document.body;
    return !b.classList.contains("player-page") && !b.classList.contains("no-chrome");
  }
  function eggsReady() {
    return (
      eggsAllowed() &&
      !d.qs(".modal-ov.open") &&
      !d.qs(".search-ov.open") &&
      !d.qs(".dc-ov") &&
      !d.qs(".dc-gate")
    );
  }

  /* ---------- /void: hold Backspace ----------
     A tap does nothing. Keep holding and the page is wiped away in thin
     horizontal lines, bottom to top; let go early and it snaps back. The
     hold has to run to the end (or the void is not impressed). */
  var HOLD_MS = 150; // a tap never starts the wipe
  var ERASE_MS = 1900; // hold this long to finish it
  var LINE_PX = 12; // one erased line (matches the stripe period in extra.css)
  var eraseEl = null;
  var eraseRaf = 0;
  var eraseAt = 0;
  var holdTimer = 0;

  function eraseBegin() {
    if (eraseEl) return;
    var ov = d.h("div", { class: "erase-ov", "aria-hidden": "true" }, [
      d.h("div", { class: "erase-fill" }),
      d.h("div", { class: "erase-edge" }),
      d.h("div", { class: "erase-hint" }, "keep holding to erase"),
    ]);
    document.body.appendChild(ov);
    eraseEl = ov;
    eraseAt = Date.now();
    requestAnimationFrame(eraseStep);
    setTimeout(function () {
      if (eraseEl === ov) ov.classList.add("holding");
    }, 220);
  }

  function eraseStep() {
    if (!eraseEl) return;
    var p = Math.min(1, (Date.now() - eraseAt) / ERASE_MS);
    /* snap to whole lines so it reads as one line at a time, not a slide */
    var h = Math.min(window.innerHeight, Math.round((p * window.innerHeight) / LINE_PX) * LINE_PX);
    var fill = d.qs(".erase-fill", eraseEl);
    var edge = d.qs(".erase-edge", eraseEl);
    if (fill) fill.style.height = h + "px";
    if (edge) edge.style.bottom = h + "px";
    if (p >= 1) {
      eraseFinish();
      return;
    }
    eraseRaf = requestAnimationFrame(eraseStep);
  }

  function eraseFinish() {
    cancelAnimationFrame(eraseRaf);
    var ov = eraseEl;
    eraseEl = null;
    if (ov) {
      /* last line falls: drop the stripes and close the screen out */
      ov.classList.add("filled");
      var fill = d.qs(".erase-fill", ov);
      var edge = d.qs(".erase-edge", ov);
      if (fill) fill.style.height = "100%";
      if (edge) edge.style.bottom = "100%";
    }
    setTimeout(function () {
      location.href = VOID_URL;
    }, 150);
  }

  function eraseCancel() {
    cancelAnimationFrame(eraseRaf);
    var ov = eraseEl;
    eraseEl = null;
    if (!ov) return;
    ov.classList.add("out");
    var fill = d.qs(".erase-fill", ov);
    var edge = d.qs(".erase-edge", ov);
    if (fill) fill.style.height = "0px";
    if (edge) edge.style.bottom = "0px";
    setTimeout(function () {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }, 260);
  }

  function armErase() {
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Backspace" || e.repeat) return;
      if (isTyping(e.target) || !eggsReady()) return;
      e.preventDefault();
      if (eraseEl || holdTimer) return;
      holdTimer = setTimeout(function () {
        holdTimer = 0;
        eraseBegin();
      }, HOLD_MS);
    });
    function stop() {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = 0;
      }
      if (eraseEl) eraseCancel();
    }
    document.addEventListener("keyup", function (e) {
      if (e.key === "Backspace") stop();
    });
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
    });
  }

  /* ---------- /time: type the current half of the day ----------
     "am" before noon, "pm" after. The chunk resets on any non-letter so a
     word that merely ends in am/pm does not count. */
  function armTimeCode() {
    var chunk = "";
    document.addEventListener("keydown", function (e) {
      if (e.repeat) return;
      var k = e.key;
      if (!k || k.length !== 1 || !/[a-z]/i.test(k)) {
        chunk = "";
        return;
      }
      if (isTyping(e.target)) {
        chunk = "";
        return;
      }
      chunk = (chunk + k.toLowerCase()).slice(-8);
      var frame = new Date().getHours() < 12 ? "am" : "pm";
      if (chunk === frame && eggsReady()) {
        chunk = "";
        location.href = TIME_URL;
      }
    });
  }

  /* ---------- midnight: the day rolls over with confetti ---------- */
  function midnightParty() {
    N.modal.open({
      title: "Midnight",
      icon: "clock",
      body:
        "<p>It is officially a new day. NULL is awake from <b>midnight to 8:00 AM</b>, so the halls are yours.</p>" +
        "<p style='color:var(--text-2)'>The <b>/time</b> page has the live clock, if you want to watch it with us.</p>",
      actions: [
        { label: "Stay up", variant: "outline" },
        {
          label: "Open /time",
          variant: "primary",
          onClick: function () {
            location.href = TIME_URL;
          },
        },
      ],
    });
    /* confetti() guards itself for ~2.6 s, so space the bursts out past it */
    confetti();
    setTimeout(confetti, 2700);
    setTimeout(confetti, 5400);
  }

  function midnightTick() {
    var now = new Date();
    if (now.getHours() !== 0 || now.getMinutes() !== 0) return;
    if (!eggsReady()) return; /* another overlay owns the screen: try again */
    var key = "midnight:" + now.toDateString();
    if (N.flags.get(key)) return;
    N.flags.set(key);
    midnightParty();
  }

  function armMidnight() {
    midnightTick();
    setInterval(midnightTick, 10000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) midnightTick();
    });
  }

  /* ---------- /blob: the orb that shows up in period four ----------
     One click swaps the face to -𐃷-; a second, at least a second later,
     drops you on /blob. */
  var orbEl = null;
  var orbArmedAt = 0;
  /* the dev console can force the orb on or off, or hand it back to the
     schedule (null) */
  var orbForced = null;

  function periodFourNow() {
    if (!N.schedule || !N.schedule.blocksFor) return false;
    var info = N.schedule.todayInfo();
    if (!info || !info.type) return false;
    var blocks = N.schedule.blocksFor(info.type);
    var now = new Date();
    var secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].n !== 4) continue;
      var s = N.schedule.parseHM(blocks[i].start) * 60;
      var e = N.schedule.parseHM(blocks[i].end) * 60;
      return secs >= s && secs < e;
    }
    return false;
  }

  function paintOrb() {
    var want = orbForced === null ? periodFourNow() : !!orbForced;
    if (want && eggsAllowed()) orbShow();
    else if (orbEl) orbHide();
  }

  /* nldev: force the face on, force it off, then back on the schedule */
  function orbToggle() {
    orbForced = orbForced === null ? true : orbForced ? false : null;
    paintOrb();
    return orbForced;
  }

  function orbShow() {
    if (orbEl) return;
    var face = d.h("span", { class: "orb-face" }, "•𐃷•");
    var btn = d.h(
      "button",
      {
        type: "button",
        class: "blob-orb",
        title: "•𐃷•",
        "aria-label": "blob",
        onclick: function () {
          var now = Date.now();
          if (!orbArmedAt) {
            orbArmedAt = now;
            face.textContent = "-𐃷-";
            btn.classList.add("armed");
            return;
          }
          if (now - orbArmedAt < 1000) return; // cooldown between the two clicks
          location.href = BLOB_URL;
        },
      },
      [face],
    );
    document.body.appendChild(btn);
    orbEl = btn;
  }

  function orbHide() {
    var el = orbEl;
    orbEl = null;
    orbArmedAt = 0;
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function armOrb() {
    paintOrb();
    setInterval(paintOrb, 10000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) paintOrb();
    });
  }

  /* ---------- cloaking: open the whole site in about:blank / blob: ----------
     There is no API for "are popups allowed?", so NULL learns it the one way a
     page can: the first time a cloak window fails to open, it remembers. From
     then on it does not fire a doomed window.open at all: it just shows the
     warning and asks for popups, with a Try again for once they're enabled. */
  var POPUP_KEY = "popupsBlocked";

  function popupsBlocked() {
    return !!N.prefs.get(POPUP_KEY);
  }

  function noteBlocked() {
    N.prefs.set(POPUP_KEY, true);
  }

  function noteAllowed() {
    if (N.prefs.get(POPUP_KEY)) N.prefs.set(POPUP_KEY, false);
  }

  function cloakBlocked(mode) {
    N.modal.open({
      title: "Popups are blocked",
      icon: "warn",
      iconTone: "danger",
      body:
        "<p>Your browser is blocking popups, so cloaked windows <b>can’t open</b>. NULL won’t keep firing them until that changes.</p>" +
        "<p>Allow popups for NULL (usually the icon at the right of the address bar), then press <b>Try again</b>.</p>",
      actions: [
        { label: "Close", variant: "outline" },
        {
          label: "Try again",
          variant: "primary",
          onClick: function () {
            noteAllowed();
            N.cloak.site(mode);
          },
        },
      ],
    });
  }

  /* A tiny shell document that frames the real site in an iframe. Used for
     both modes: about:blank gets this written into the blank window, blob:
     gets it served from a blob: URL. The tab title/favicon come from the
     active tab preset either way. */
  function cloakShell() {
    var p = N.tab.current();
    return (
      "<!doctype html><html><head><meta charset='utf-8'><title>" +
      N.tab.titleFor(p) +
      "</title><link rel='icon' href='" +
      (p.icon || N.url("/public/favicon.svg")) +
      "'></head>" +
      "<body style='margin:0'><iframe src='" +
      location.origin +
      N.base +
      "' style='width:100vw;height:100vh;border:0'></iframe></body></html>"
    );
  }

  /* Popup blockers can refuse the open but still hand back a WindowProxy
     (or kill the tab a moment later). In every failure case we make sure
     nothing is left open: close the window, show the warning only.
     `to` is the preset's real site: once the cloaked window is up, this tab
     navigates there so the address bar matches the name on the tab. */
  function cloakOpen(url, mode, shell, to) {
    var w = null;
    try {
      w = window.open(url, "_blank");
    } catch (err) {
      w = null;
    }
    if (!w) {
      noteBlocked();
      cloakBlocked(mode);
      return;
    }
    if (mode === "blank") {
      /* about:blank windows share the opener's origin: write the shell in */
      try {
        w.document.open();
        w.document.write(shell);
        w.document.close();
      } catch (err) {
        try {
          w.close();
        } catch (e2) {}
        noteBlocked();
        cloakBlocked(mode);
        return;
      }
    }
    /* some blockers cancel the tab right after it opens: if the browser
       closed it, don't leave a stray tab and don't pretend it worked */
    noteAllowed();
    setTimeout(function () {
      if (w.closed) {
        noteBlocked();
        cloakBlocked(mode);
      }
    }, 800);
    if (to) {
      /* the cloaked copy is already open and loaded from here, so handing
         this tab over to the real site costs nothing */
      d.toast("Opening " + hostOf(to) + " in this tab", { icon: "ban" });
      setTimeout(function () {
        location.href = to;
      }, 700);
      return;
    }
    d.toast(mode === "blank" ? "Opened NULL in about:blank" : "Opened NULL in blob:", {
      icon: "ban",
    });
  }

  /* the host of a redirect target, for the toast: never throws on junk */
  function hostOf(url) {
    try {
      return new URL(url).hostname;
    } catch (err) {
      return url;
    }
  }

  /* where this tab hands over to: the current preset's real site, unless the
     user turned the redirect off in Settings */
  function cloakTarget() {
    if (N.prefs.get("cloakRedirect") === false) return null;
    return N.tab.url ? N.tab.url() : null;
  }

  N.cloak = {
    /* has the browser been seen blocking NULL's popups? */
    blocked: popupsBlocked,
    markBlocked: noteBlocked,
    clear: noteAllowed,
    /* the address this tab would become: settings shows it before you click */
    target: cloakTarget,
    site: function (mode) {
      /* if popups are known to be blocked, don't even try to open about:blank
         or blob:: warn, and let the user enable them first */
      if (popupsBlocked()) {
        cloakBlocked(mode);
        return;
      }
      var shell = cloakShell();
      var url = mode === "blob" ? URL.createObjectURL(new Blob([shell], { type: "text/html" })) : "about:blank";
      cloakOpen(url, mode, shell, cloakTarget());
    },
  };

  /* ---------- confetti (grayscale) ----------
     Fired when a class period ends. Toggleable via prefs.confetti.
     Also exposed as N.fx.confetti for the dev console. */
  var confettiBusy = false;
  function confetti() {
    if (confettiBusy) return;
    confettiBusy = true;
    setTimeout(function () { confettiBusy = false; }, 2600);
    var ov = d.h("div", { class: "cf-ov", "aria-hidden": "true" });
    /* two shop unlocks decide the palette: rainbow beats gold, and without
       either NULL stays grayscale */
    var cols = ["#f5f5f6", "#c9c9cf", "#a1a1aa", "#71717a", "#52525b"];
    if (N.econ && N.econ.isUnlocked("fx", "rainbowconfetti")) {
      cols = ["#ff5f5f", "#ffa64d", "#ffd93d", "#6ee07a", "#4db8ff", "#b98cff", "#ff7ad9"];
    } else if (N.econ && N.econ.isUnlocked("fx", "goldconfetti")) {
      cols = ["#ffd45e", "#ffb020", "#ffe9a8", "#f5c542", "#ffdf8a"];
    }
    for (var i = 0; i < 80; i++) {
      var p = d.h("span", { class: "cf-p" + (Math.random() < 0.5 ? " s" : "") });
      p.style.left = Math.random() * 100 + "%";
      p.style.background = cols[i % cols.length];
      p.style.setProperty("--cf-drift", (Math.random() * 220 - 110).toFixed(0) + "px");
      p.style.setProperty("--cf-rot", (Math.random() * 720 - 360).toFixed(0) + "deg");
      p.style.animationDuration = (2 + Math.random() * 1.4).toFixed(2) + "s";
      p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + "s";
      ov.appendChild(p);
    }
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("on"); });
    setTimeout(function () {
      ov.classList.remove("on");
      setTimeout(function () {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
      }, 400);
    }, 3400);
  }

  /* ---------- the period clock ----------
     The schedule is the site's own data, so the clock that counts it down is
     part of the site too, not an extension: it rides in the nav bar, in the
     side rail (where it keeps just the dot and the time) and in the player's
     widget strip, which has no nav bar of its own. One ticker drives every
     copy on the page, and the whole thing hides itself when there is nothing
     to count. Settings can switch it off. */
  var clocks = [];
  var clockEvery = null;

  function clockChip() {
    var chip = d.h("span", { class: "pclock", hidden: true }, [
      d.h("i", { class: "pclock-dot", "aria-hidden": "true" }),
      d.h("b", { class: "pclock-name" }, ""),
      d.h("span", { class: "pclock-time" }, ""),
      d.h("span", { class: "pclock-next", "data-rail-hide": "1" }, ""),
    ]);
    clocks.push({
      root: chip,
      name: chip.querySelector(".pclock-name"),
      time: chip.querySelector(".pclock-time"),
      next: chip.querySelector(".pclock-next"),
    });
    return chip;
  }

  /* what there is to say right now, or null when there is nothing: no
     schedule on this page, no school today, or the last bell already rang */
  function clockNow() {
    var S = N.schedule;
    if (!S || !S.todayInfo || !S.blocksFor || !S.live) return null;
    try {
      var info = S.todayInfo();
      if (!info || !info.type) return null;
      var live = S.live(S.blocksFor(info.type), new Date());
      if (!live.block) return null;
      var secs = Math.max(0, live.passing ? live.secToNext : live.secLeft);
      return {
        name: live.passing ? "Passing" : live.block.name,
        left: Math.floor(secs / 60) + ":" + ("0" + (secs % 60)).slice(-2),
        next: live.next ? live.next.name + " at " + live.next.start : "last bell of the day",
      };
    } catch (err) {
      return null;
    }
  }

  function paintClocks() {
    var now = clockNow();
    clocks.forEach(function (c) {
      c.root.hidden = !now;
      if (!now) return;
      c.name.textContent = now.name;
      c.time.textContent = now.left;
      c.next.textContent = now.next;
      c.root.title = now.name + " · " + now.left + " left · " + now.next;
    });
  }

  /* (re)build every clock on the page: Settings calls this when the switch
     moves, and a schedule edit can move the bells under it */
  function buildClocks() {
    clocks = [];
    d.qsa("[data-clock]").forEach(function (slot) {
      slot.textContent = "";
      if (N.prefs.get("showClock") !== false) slot.appendChild(clockChip());
    });
    paintClocks();
  }

  function mountClocks() {
    buildClocks();
    if (clockEvery) return;
    clockEvery = setInterval(paintClocks, 1000);
    N.bus.on("sched", buildClocks);
  }

  /* ---------- period bells ----------
     Confetti has to land ON the bell, not within half a minute of it: the
     schedule is read to find the seconds left in the current block (or in
     the passing period) and a single timer is aimed at that instant. Both
     bells fire: a period ending (which is when the passing period starts)
     and the passing period ending (which is when class starts). The key of
     the block we're in changes at each one, so "it changed" is the trigger. */
  var schedTimer = null;
  var lastKey = null;

  function blockKey() {
    if (!N.schedule) return null;
    var info = N.schedule.todayInfo();
    if (!info.type) return null;
    var lv = N.schedule.live(N.schedule.blocksFor(info.type));
    if (!lv.block) return "end";
    return lv.i + (lv.passing ? "p" : "");
  }

  /* aim the timer at the next bell; a little past the second so the clock
     has definitely rolled over when we look */
  function armBell() {
    if (schedTimer) clearTimeout(schedTimer);
    schedTimer = null;
    if (!N.schedule) return;
    var info = N.schedule.todayInfo();
    var ms = null;
    if (info.type) {
      var lv = N.schedule.live(N.schedule.blocksFor(info.type));
      if (lv.block) ms = lv.secLeft * 1000 + 120;
    }
    /* nothing left today (or no school): look again in a minute */
    schedTimer = setTimeout(ring, ms == null || ms <= 0 ? 60000 : Math.min(ms, 900000));
  }

  function ring() {
    schedTimer = null;
    var key = blockKey();
    /* only a real bell: never the end of the day, never a first reading */
    if (lastKey !== null && key && key !== "end" && key !== lastKey) {
      if (N.prefs.get("confetti") !== false && !document.hidden) confetti();
    }
    lastKey = key;
    armBell();
  }

  function watchPeriodEnd() {
    if (!N.schedule || schedTimer) return;
    /* the player and the hidden pages run without the site chrome: the
       schedule is there for extension widgets, but no bells, no confetti */
    if (document.body.classList.contains("no-chrome")) return;
    lastKey = blockKey();
    armBell();
    /* timers are throttled in a background tab, so never celebrate a bell
       that went by while this window was hidden: just re-sync and re-aim */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      lastKey = blockKey();
      armBell();
    });
  }

  /* ============================================================
     screensaver: after two idle minutes a dim glass overlay fades
     in: drifting grayscale game art, a live clock and a wake hint.
     Any pointer or key wakes it. Skipped on the player / 404 and
     whenever an overlay is already open.
     ============================================================ */
  var SS_DELAY = 120000; // 2 minutes idle
  var ssTimer = null;
  var ssEl = null;
  var ssClockInt = null;

  function ssGated() {
    return (
      document.body.classList.contains("player-page") ||
      document.body.classList.contains("page-404") ||
      document.body.classList.contains("no-chrome") ||
      !!d.qs(".modal-ov.open") ||
      !!d.qs(".search-ov.open") ||
      document.hidden
    );
  }

  function ssHide() {
    if (!ssEl) return;
    var el = ssEl;
    ssEl = null;
    clearInterval(ssClockInt);
    el.classList.remove("on");
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 500);
    ssArm();
  }

  function ssClock() {
    if (!ssEl) return;
    var el = d.qs(".ss-clock", ssEl);
    var now = new Date();
    var h = now.getHours() % 12 || 12;
    var m = now.getMinutes();
    var s = now.getSeconds();
    var ap = now.getHours() >= 12 ? "PM" : "AM";
    if (el) el.textContent = h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s + " " + ap;
  }

  function ssShow() {
    if (ssEl || ssGated()) {
      ssArm();
      return;
    }
    var games = N.catalog.games().filter(function (g) {
      return g.thumb;
    });
    var ov = d.h("div", { class: "ss-ov", "aria-hidden": "true" });
    ov.appendChild(d.h("div", { class: "ss-vign" }));
    var art = d.h("div", { class: "ss-art" });
    var count = Math.min(18, Math.max(6, games.length));
    for (var i = 0; i < count; i++) {
      var g = games[Math.floor(Math.random() * games.length)];
      var img = d.h("img", { src: g.thumb, alt: "", draggable: "false" });
      img.addEventListener("error", function (e) {
        if (e.target && e.target.parentNode) e.target.parentNode.removeChild(e.target);
      });
      var slow = i % 2 === 1;
      var tile = d.h("div", { class: "ss-tile" + (slow ? " slow" : "") }, [img]);
      tile.style.left = (4 + Math.random() * 82) + "%";
      tile.style.top = (6 + Math.random() * 74) + "%";
      tile.style.setProperty("--ss-drift", (10 + Math.random() * 26).toFixed(1) + "px");
      tile.style.animationDuration = (slow ? 26 + Math.random() * 14 : 15 + Math.random() * 18).toFixed(1) + "s";
      tile.style.animationDelay = (-Math.random() * 34).toFixed(1) + "s";
      art.appendChild(tile);
    }
    ov.appendChild(art);
    ov.appendChild(d.h("div", { class: "ss-brand" }, [d.icon("ban"), "NULL"]));
    ov.appendChild(d.h("div", { class: "ss-clock" }, "-:--"));
    ov.appendChild(
      d.h("div", { class: "ss-date" },
        new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })),
    );
    ov.appendChild(d.h("div", { class: "ss-hint" }, "move mouse or press any key"));
    document.body.appendChild(ov);
    ssEl = ov;
    requestAnimationFrame(function () {
      ov.classList.add("on");
    });
    ssClock();
    ssClockInt = setInterval(ssClock, 1000);
  }

  function ssArm() {
    clearTimeout(ssTimer);
    ssTimer = setTimeout(ssShow, SS_DELAY);
  }

  function ssWake() {
    ssHide();
    ssArm();
  }

  /* immediate screensaver (dev console button): bypasses the idle wait */
  function ssNow() {
    ssHide();
    ssShow();
  }

  function initSs() {
    if (ssGated()) return;
    ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"].forEach(function (ev) {
      document.addEventListener(ev, ssWake, { passive: true });
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) ssHide();
      else ssArm();
    });
    ssArm();
  }

  /* ---------- performance-mode suggestion ----------
     Weak devices (low device memory / few cores) get a one-time nudge to
     turn on performance mode, plus a friendly "close some tabs" tip. */
  function perfSuggest() {
    if (N.prefs.get("perf")) return;
    if (N.flags.get("perfSuggest")) return;
    var mem = navigator.deviceMemory; // Chrome only: undefined elsewhere
    var cores = navigator.hardwareConcurrency;
    var weak =
      (mem && mem <= 4) ||
      (!mem && cores && cores <= 4) ||
      (cores && cores <= 2);
    if (!weak) return;
    setTimeout(function () {
      if (document.body.classList.contains("player-page") || document.body.classList.contains("page-404")) return;
      if (d.qs(".modal-ov.open")) return;
      N.flags.set("perfSuggest");
      N.modal.open({
        title: "Performance mode",
        icon: "zap",
        body:
          "<p>NULL noticed this device looks a bit underpowered.</p>" +
          "<p>Performance mode disables hover effects, glow and heavy shadows for a smoother experience. You can flip it anytime in Settings.</p>" +
          "<p style='color:var(--text-2)'>Closing extra tabs and apps can also free up memory and speed things up.</p>",
        actions: [
          { label: "Not now", variant: "outline" },
          {
            label: "Turn on performance mode",
            variant: "primary",
            onClick: function () {
              N.prefs.set("perf", true);
              N.theme.setPerf(true);
              d.toast("Performance mode on", { icon: "zap" });
            },
          },
        ],
      });
    }, 2600);
  }

  /* ---------- measured frame rate ----------
     Device memory is a guess; the frame rate isn't. We sample rAF quietly
     in the background and, if two windows in a row come in under FPS_FLOOR,
     offer Ultra-Performance mode once. The flag is set whether or not the
     offer is taken, so nobody gets asked twice. */
  var FPS_FLOOR = 20;

  function ultraOn() {
    N.prefs.set("perf", "ultra");
    N.theme.setPerf("ultra");
    d.toast("Ultra-Performance mode on", { icon: "zap" });
  }

  /* returns true once the offer is spent, or already was. While another
     modal owns the screen we hold off and try again next window, so the one
     and only ask never gets swallowed. */
  function fpsOffer(fps) {
    if (N.flags.get("ultraSuggest")) return true;
    if (d.qs(".modal-ov.open")) return false;
    N.flags.set("ultraSuggest");
    N.modal.open({
      title: "Turn on Ultra-Performance mode?",
      icon: "zap",
      body:
        "<p>NULL measured this device at about <b>" +
        Math.round(fps) +
        " fps</b>, which is slow enough to feel sticky.</p>" +
        "<p>Ultra-Performance mode drops every animation, particle and effect, and only draws what is on screen. NULL looks plainer, and moves a lot faster.</p>" +
        "<p style='color:var(--text-2)'>You can switch it back off any time in Settings.</p>",
      actions: [
        { label: "Keep it as is", variant: "outline" },
        { label: "Enable Ultra mode", variant: "primary", onClick: ultraOn },
      ],
    });
    return true;
  }

  function fpsWatch() {
    if (N.prefs.get("perf") === "ultra") return;
    if (N.flags.get("ultraSuggest")) return;
    /* the player runs real games: heavy there is normal, not a problem */
    if (document.body.classList.contains("no-chrome")) return;
    if (!window.requestAnimationFrame) return;
    var frames = 0;
    var slow = 0;
    var t0 = 0;
    function tick(now) {
      if (N.prefs.get("perf") === "ultra") return;
      if (!t0) t0 = now;
      frames++;
      var span = now - t0;
      if (span < 2500) {
        requestAnimationFrame(tick);
        return;
      }
      var fps = (frames * 1000) / span;
      /* a background tab pauses rAF, which would otherwise read as 0 fps */
      slow = document.hidden ? 0 : fps < FPS_FLOOR ? slow + 1 : 0;
      frames = 0;
      t0 = now;
      if (slow >= 2 && fpsOffer(fps)) return;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- weekly wrap-up ----------
     Once a week (Monday-keyed), the first page load after the week rolls
     over shows a summary of the previous week's plays. Fires on every page
     (shell runs everywhere), ~1.2 s after load so it never fights the
     first-run welcome chain on the home page. */
  function wrapupModal(weekKey, s) {
    var mon = new Date(weekKey + "T00:00:00");
    var end = new Date(mon.getTime());
    end.setDate(end.getDate() + 6);
    var range =
      mon.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " - " +
      end.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    var html =
      "<p style='margin:0 0 4px;color:#a3a3a3;font-size:14px;'>Your NULL week: <b style='color:var(--text)'>" +
      range +
      "</b>. Everything below is local to your browser.</p>";
    html +=
      "<div class='wu-stats'>" +
      "<div class='wu-stat'><b>" + s.total + "</b><span>plays</span></div>" +
      "<div class='wu-stat'><b>" + s.distinct + "</b><span>games & apps</span></div>" +
      "<div class='wu-stat'><b>" + (s.top.length ? s.top[0].n : 0) + "</b><span>top item</span></div>" +
      "</div>";
    if (s.top.length) {
      html += "<div class='wu-top'><b>Most played</b>";
      s.top.forEach(function (t, i) {
        var e = N.catalog.find(t.k, t.id);
        var name = e ? e.name : t.id;
        html +=
          "<div class='wu-item'><span class='wu-rank'>" +
          (i + 1) +
          "</span>" +
          d.escHtml(name) +
          "<span class='wu-count'>" + t.n + "×</span></div>";
      });
      html += "</div>";
    }
    html +=
      "<p style='margin:14px 0 0;font-size:12.5px;color:#737373;'>New week: the log restarts today. See you next Monday.</p>";

    N.modal.open({
      title: "Your week in NULL",
      icon: "ann",
      body: html,
      actions: [{ label: "Got it", variant: "primary" }],
    });
  }

  function wrapupCheck() {
    if (!N.week || !N.modal) return;
    var prev = N.week.rollover();
    if (!prev) return;
    var key = "wrapup:" + prev.week;
    if (N.flags.get(key)) return;
    N.flags.set(key);
    wrapupModal(prev.week, N.week.summary(prev.plays));
  }

  /* dev-console / debug entry: show the current week's wrap-up on demand */
  N.wrapup = {
    check: wrapupCheck,
    show: function () {
      if (!N.week || !N.modal) return false;
      var s = N.week.summary();
      if (!s.total) return false;
      wrapupModal(N.week.key(), s);
      return true;
    },
  };

  function init() {
    /* clean urls: a visitor landing on /shop.html gets /shop in the address
       bar, so every NULL url is the same shape. Skipped on the 404 page,
       whose address GitHub keeps for the redirect dance to work. */
    if (N.cleanAddress) N.cleanAddress();

    /* resolve [data-icon] placeholders left in static HTML */
    d.qsa("[data-icon]").forEach(function (el) {
      var ic = d.icon(el.dataset.icon);
      if (el.tagName === "SPAN") {
        el.replaceWith(ic);
      } else {
        el.textContent = "";
        el.appendChild(ic);
      }
    });

    var raw = document.body.classList.contains("no-chrome");
    if (!raw) {
      var navMount = d.qs('[data-mount="nav"]');
      var footMount = d.qs('[data-mount="foot"]');
      if (navMount) navMount.appendChild(topbar());
      if (footMount) footMount.appendChild(footer());
    }

    N.modal.armSgGames();
    shortcuts();
    N.tab.apply();
    N.tab.smartStart();
    initSs();
    watchPeriodEnd();
    mountClocks();

    /* the hidden pages: hold Backspace, the period-four orb, the clock codes */
    armErase();
    armTimeCode();
    armOrb();
    armMidnight();

    /* weekly wrap-up: slightly delayed so it stacks above (never under)
       the first-run welcome chain on the home page */
    setTimeout(wrapupCheck, 1200);
    perfSuggest();
    /* give the first paint time to settle before judging the frame rate */
    setTimeout(fpsWatch, 5000);
    paintAnnDots();
    paintShopDot();

    /* PWA: register the root service worker so NULL is installable and the
       shell works offline. Dev/preview hosts skip it *and* clean up after
       themselves: a cached shell there means stale assets (a cached
       JS-wrapped stylesheet leaves every page unstyled). */
    if ("serviceWorker" in navigator) {
      var host = location.hostname;
      var devHost =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        /(^|\.)(freebuff|daytona|vly|preview|local)\./.test(host) ||
        /daytona|freebuff|preview/.test(host);
      if (devHost) {
        navigator.serviceWorker
          .getRegistrations()
          .then(function (rs) {
            rs.forEach(function (r) {
              r.unregister();
            });
          })
          .catch(function () {});
        if (window.caches) {
          caches
            .keys()
            .then(function (keys) {
              keys.forEach(function (k) {
                caches.delete(k);
              });
            })
            .catch(function () {});
        }
      } else {
        window.addEventListener("load", function () {
          navigator.serviceWorker.register(N.url("sw.js")).catch(function () {});
        });
      }
    }

    /* custom scrollbar on library pages */
    if (document.body.classList.contains("lb")) {
      var sv = d.qs("#scrollview");
      if (sv) N.scroll.attach(sv);
    }
    if (!raw) backTop();
  }

  /* ---------- install as an app (PWA) ----------
     Chrome fires beforeinstallprompt once the manifest + service worker
     requirements are met. We stash the event so Settings can trigger the
     real browser prompt on demand instead of relying on the address-bar
     icon alone. */
  var installEvt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    installEvt = e;
    N.bus.emit("installReady");
  });
  window.addEventListener("appinstalled", function () {
    installEvt = null;
    N.bus.emit("installReady");
  });
  N.install = {
    installed: function () {
      return (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true
      );
    },
    ready: function () {
      return !!installEvt;
    },
    prompt: function () {
      if (!installEvt) return Promise.resolve("unavailable");
      var evt = installEvt;
      installEvt = null;
      evt.prompt();
      return evt.userChoice.then(function (r) {
        N.bus.emit("installReady");
        return (r && r.outcome) || "dismissed";
      });
    },
  };

  N.shell = {
    init: init,
    screensaverNow: ssNow,
    /* dev console: the blob orb and the midnight party on demand */
    orb: orbToggle,
    midnightNow: midnightParty,
  };
  N.fx = { confetti: confetti };
  N.perf = { ultra: ultraOn, watchFps: fpsWatch, floor: FPS_FLOOR };
  /* the site's own period clock: what is on now, and the switch Settings uses */
  N.clock = { apply: buildClocks, now: clockNow };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
