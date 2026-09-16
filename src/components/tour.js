/* NULL · tour.js
   The first-run tour: a spotlight that cuts a hole over whatever it is
   talking about, and a callout with an arrow pointing at it.

   It walks across pages. The step you are on is kept in sessionStorage, so
   when a step lives somewhere else the tour just navigates there and picks
   up on the far side: home, then the library, then the shop, then settings.
   Skip is always one click away and marks it done for good.

   The dim layer never swallows clicks: the page stays usable, you can try
   the thing the callout is pointing at, and it opens the permission modal
   and the Settings nudge afterwards. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var STATE = "null:tour"; // sessionStorage: the step in flight
  var DONE = "tour"; // flags: finished or skipped, never ask again

  /* ---------- the route ----------
     page = where the step lives, target = what to point at. No target means
     a centred intro card. */
  var STEPS = [
    {
      page: "home",
      mid: true,
      icon: "ban",
      kick: "welcome to null",
      title: "This is NULL",
      body:
        "A few thousand games, some apps, a few proxy links and a schedule that knows what period it is. All in your browser, nothing to install.\n" +
        "Give it thirty seconds and you will know your way around. **Skip** is right there if you would rather poke at it yourself.",
      next: "Show me around",
    },
    {
      page: "home",
      target: "#homeSearch",
      icon: "search",
      kick: "1 · finding things",
      title: "Search everything",
      body:
        "Games, apps, proxies, announcements and every page on NULL, all in one box. It forgives typos.\n" +
        "Press **/** anywhere and it opens by itself.",
    },
    {
      page: "home",
      target: ".nav-links",
      icon: "game",
      kick: "2 · the tabs up top",
      title: "Games, apps, proxies…",
      body:
        "The library, your class schedule, announcements, the shop and settings all live up here.\n" +
        "Hover an icon: they each wave back.",
    },
    {
      page: "games",
      target: "#grid",
      icon: "game",
      kick: "3 · the library, live",
      title: "This is where the games are",
      body:
        "Every game is a tile: art, name, nothing else. The labels are still there under the hood (hover a tile, or open the Labels button) and only what is on screen is drawn, so it stays quick even with thousands of them.\n" +
        "Filter, sort, star the ones you like, and the tool row pins itself under the nav while you scroll.",
    },
    {
      page: "shop",
      target: "#ecoBar",
      icon: "coin",
      kick: "4 · the shop",
      title: "Coins come from playing",
      body:
        "Time in the player banks XP, XP banks coins, coins buy themes, particle effects and a few extras. No real money, ever, and nothing leaves this browser.\n" +
        "The balance rides along as you scroll the shelves.",
    },
    {
      page: "about",
      target: ".ab-hero",
      icon: "info",
      kick: "5 · what this actually is",
      title: "About NULL",
      body:
        "One page with the whole story: what is in the library, where the coins come from, what happens to what you save, and how to put your own games in here.\n" +
        "The paperwork at the bottom (privacy, terms, license) is written by a person too.",
    },
    {
      page: "settings",
      target: ".theme-tgl",
      icon: "pen",
      kick: "6 · make it yours",
      title: "Make NULL yours",
      body:
        "Dark or light is this one switch. Two rows down you get accent colours, glow borders, seasonal themes, tab disguises and a panic key.\n" +
        "Everything saves to this device as you change it, and **Finish the tour** drops you back on the home page.",
      next: "Finish the tour",
    },
  ];

  var PAGES = { home: "/", games: "/games/", shop: "/shop", about: "/about", settings: "/settings" };

  var idx = 0;
  var open = false;
  var dim = null;
  var hole = null;
  var box = null;
  var bar = null;
  var stepEl = null;

  function page() {
    return document.body.dataset.page || "";
  }

  function saved() {
    try {
      return JSON.parse(sessionStorage.getItem(STATE) || "null");
    } catch (err) {
      return null;
    }
  }
  function save(i) {
    try {
      sessionStorage.setItem(STATE, JSON.stringify({ i: i }));
    } catch (err) {}
  }
  function clear() {
    try {
      sessionStorage.removeItem(STATE);
    } catch (err) {}
  }

  /* ---------- chrome: dim layer, hole, progress, callout ---------- */
  function build() {
    if (open) return;
    dim = d.h("div", { class: "tour-dim", "aria-hidden": "true" }, [
      d.h("div", { class: "tour-hole" }),
    ]);
    bar = d.h("div", { class: "tour-bar", "aria-hidden": "true" }, [d.h("i")]);
    box = d.h("div", { class: "tour-box", role: "dialog", "aria-live": "polite" });
    document.body.appendChild(dim);
    document.body.appendChild(bar);
    document.body.appendChild(box);
    hole = dim.querySelector(".tour-hole");
    open = true;
    requestAnimationFrame(function () {
      dim.classList.add("on");
    });
    /* capture, because the library pages scroll inside their own main */
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
  }

  function teardown() {
    if (!open) return;
    window.removeEventListener("scroll", reposition, true);
    window.removeEventListener("resize", reposition);
    if (dim) dim.remove();
    if (bar) bar.remove();
    if (box) box.remove();
    if (stepEl) stepEl.classList.remove("tour-target");
    dim = hole = box = bar = stepEl = null;
    open = false;
  }

  /* ---------- the callout body ---------- */
  function paint(i) {
    var s = STEPS[i];
    var last = i === STEPS.length - 1;
    box.className = "tour-box" + (s.mid ? " mid" : "");
    box.textContent = "";
    /* the intro card has nothing to point at, so instead of a spotlight the
       whole page behind it is blurred out (tour.css) */
    if (dim) dim.classList.toggle("mid", !!s.mid);

    var dots = d.h("div", { class: "tour-dots" });
    STEPS.forEach(function (_, n) {
      dots.appendChild(d.h("i", { class: n === i ? "on" : n < i ? "done" : "" }));
    });

    box.appendChild(
      d.h("div", { class: "tour-kick" }, [d.icon(s.icon), s.kick]),
    );
    box.appendChild(d.h("h3", null, s.title));
    String(s.body)
      .split("\n")
      .forEach(function (line) {
        box.appendChild(d.h("p", { html: inline(line) }));
      });

    var foot = d.h("div", { class: "tour-foot" });
    foot.appendChild(dots);
    foot.appendChild(
      d.h("button", {
        type: "button",
        class: "tour-skip",
        onclick: function () {
          skip();
        },
      }, i === 0 ? "Skip the tour" : "Skip"),
    );
    if (i > 0) {
      foot.appendChild(
        d.h("button", {
          type: "button",
          class: "btn btn-outline btn-sm",
          onclick: function () {
            go(i - 1);
          },
        }, "Back"),
      );
    }
    foot.appendChild(
      d.h("button", {
        type: "button",
        class: "btn btn-primary btn-sm",
        onclick: function () {
          if (last) finish(false);
          else go(i + 1);
        },
      }, s.next || (last ? "Finish" : "Next")),
    );
    box.appendChild(foot);

    if (bar) bar.firstChild.style.width = ((i + 1) / STEPS.length) * 100 + "%";
  }

  /* **bold** and nothing else: the copy is written for this, so a full
     markdown pass here would be a bigger tool than the job needs */
  function inline(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  }

  /* ---------- the spotlight ---------- */
  function targetOf(s) {
    if (!s.target) return null;
    var el = d.qs(s.target);
    if (!el) return null;
    /* an empty or hidden target (the featured rail with no games in it, a
       game-of-the-day that has nothing to show) has nothing to point at, so
       the step falls back to its centred card */
    var r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return null;
    return el;
  }

  function isFixed(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (getComputedStyle(n).position === "fixed") return true;
    }
    return false;
  }

  function reposition() {
    if (!open) return;
    var s = STEPS[idx];
    var el = targetOf(s);
    if (!el) return;
    place(el);
  }

  function place(el) {
    var pad = 10;
    var r = el.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var bw = box.offsetWidth || 340;
    var bh = box.offsetHeight || 220;
    var gap = 24;

    /* a target taller than the viewport (the game grid) gets a hole over its
       top part instead of one that runs off the screen */
    var hTop = r.top;
    var hH = Math.min(r.height, vh * 0.55);
    var hBottom = hTop + hH;

    hole.style.top = hTop - pad + "px";
    hole.style.left = r.left - pad + "px";
    hole.style.width = r.width + pad * 2 + "px";
    hole.style.height = hH + pad * 2 + "px";
    hole.style.borderRadius = Math.min(20, Math.max(12, hH / 2 + 4)) + "px";

    var side = "below";
    var top;
    var left;
    if (hBottom + gap + bh < vh) {
      side = "below";
      top = hBottom + gap;
      left = r.left + r.width / 2 - bw / 2;
    } else if (r.top - gap - bh > 0) {
      side = "above";
      top = r.top - gap - bh;
      left = r.left + r.width / 2 - bw / 2;
    } else if (r.right + gap + bw < vw) {
      side = "right";
      left = r.right + gap;
      /* ride the vertical middle of what is actually visible of the target,
         not just its top edge: on a tall card the old rule parked the box up
         near the header and left the arrow pointing at nothing in particular */
      top = r.top + Math.min(r.height, vh * 0.55) / 2 - bh / 2;
    } else {
      side = "left";
      left = r.left - gap - bw;
      top = r.top + Math.min(r.height, vh * 0.55) / 2 - bh / 2;
    }
    left = Math.max(14, Math.min(vw - bw - 14, left));
    top = Math.max(14, Math.min(vh - bh - 14, top));

    box.className = "tour-box " + side;
    box.style.top = top + "px";
    box.style.left = left + "px";

    /* the arrow rides to whichever edge the target is on, and never down into
       the footer: on a short box the old clamp ran right up to bh - 34 and
       landed on top of the buttons, which is exactly where "Finish the tour"
       sits. Reserve the footer, then keep the arrow above it. */
    var arrow = box.querySelector(".tour-arrow");
    if (!arrow) {
      arrow = d.h("span", { class: "tour-arrow", "aria-hidden": "true" });
      box.appendChild(arrow);
    }
    var foot = box.querySelector(".tour-foot");
    var reserved = (foot ? foot.offsetHeight + 14 : 46) + 20;
    if (side === "below" || side === "above") {
      arrow.style.left = Math.max(16, Math.min(bw - 34, r.left + r.width / 2 - left - 8)) + "px";
      arrow.style.top = "";
    } else {
      arrow.style.top = Math.max(16, Math.min(bh - reserved, r.top + r.height / 2 - top - 8)) + "px";
      arrow.style.left = "";
    }
  }

  /* ---------- moving ---------- */
  function show(i) {
    idx = i;
    build();
    paint(i);
    if (stepEl) stepEl.classList.remove("tour-target");
    var s = STEPS[i];
    var el = targetOf(s);
    stepEl = el;
    if (!el) {
      hole.style.top = "-9999px";
      box.className = "tour-box mid";
      box.style.top = "";
      box.style.left = "";
      return;
    }
    el.classList.add("tour-target");
    if (!isFixed(el)) {
      /* the page drifts to whatever the step is about, so nothing is ever
         pointed at from off screen */
      try {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch (err) {
        el.scrollIntoView();
      }
    }
    /* position now and again once the smooth scroll has settled */
    place(el);
    setTimeout(function () {
      if (open && STEPS[idx] === s) place(el);
    }, 300);
    setTimeout(function () {
      if (open && STEPS[idx] === s) place(el);
    }, 620);
  }

  function go(i) {
    if (i < 0) return;
    var s = STEPS[i];
    if (s.page === page()) {
      save(i);
      show(i);
      return;
    }
    /* a step on another page: remember where we are and go there */
    save(i);
    teardown();
    location.href = N.url(PAGES[s.page] || "/");
  }

  /* ---------- finishing ---------- */
  function finish(skipped) {
    N.flags.set(DONE);
    if (!skipped) N.flags.set("customize"); /* the tour already covered it */
    if (N.ext) N.ext.emit("tour:done", { skipped: !!skipped });
    clear();
    teardown();
    if (!skipped && N.fx && N.fx.confetti) N.fx.confetti();
    /* running the tour to the end puts you back where it started: home. A
       skip leaves you on the page you bailed out of, so that path keeps the
       old behaviour (ask about the popups, nudge about Settings). Navigating
       home is safe: start() shows the permission ask again there, because the
       done flag is already set. */
    var goHome = !skipped && page() !== "home";
    setTimeout(
      function () {
        if (goHome) {
          location.href = N.url("/");
          return;
        }
        prompts();
        if (skipped) nudge();
      },
      skipped ? 200 : 1200,
    );
  }

  function skip() {
    finish(true);
  }

  /* the Settings nudge, for anyone who bailed out of the tour: the tour
     covers this on its last step, a skipper never saw it */
  function nudge() {
    if (N.flags.get("customize")) return;
    N.modal.open({
      title: "Make NULL yours",
      icon: "pen",
      dismissible: false,
      body:
        "<p style='font-size:15px; color:#a3a3a3; margin-top:0; margin-bottom:14px;'>Want to make NULL look how you like?</p>" +
        "<p style='font-size:13.5px; margin-top:0; margin-bottom:14px; line-height:1.55;'>Settings has <b>accent colors</b>, <b>glow borders</b>, <b>dark and light mode</b>, tab <b>presets</b> and a <b>panic key</b>. Everything saves to this device as you change it.</p>" +
        "<p style='font-size:13px; color:#737373; margin:0;'>You can change any of it later.</p>",
      actions: [
        {
          label: "Not right now",
          variant: "outline",
          onClick: function () {
            N.flags.set("customize");
          },
        },
        {
          label: "Sure",
          variant: "primary",
          onClick: function () {
            N.flags.set("customize");
            location.href = N.url("/settings");
          },
        },
      ],
    });
  }

  /* the permission ask. Cloaking and the about:blank / blob: modes need
     popups, so it is worth saying out loud, once. */
  /* start() can run twice on the home page (its own DOMContentLoaded and
     home.js's firstRun both call it), and each call used to fire prompts()
     for a second modal. Guarded so the ask is a once-per-page thing. */
  var asked = false;
  function prompts() {
    if (N.flags.get("popup") || asked) return;
    asked = true;
    N.modal.open({
      title: "Popups & redirects",
      icon: "ext",
      body:
        "<p>Some NULL features (cloaking, about:blank / blob: modes, and opening external proxies) ask the browser to allow <b>popups</b> and <b>redirects</b>.</p>" +
        "<p>That is NULL requesting permission for its own functionality. It is <b>not</b> malicious, and the browser stays in control of every permission prompt.</p>",
      actions: [
        {
          label: "Please accept",
          variant: "primary",
          onClick: function () {
            N.flags.set("popup");
            var w = null;
            try {
              w = window.open("about:blank", "_blank");
            } catch (err) {}
            if (w) {
              /* the test window opened: popups are allowed, so cloaking is on */
              if (N.cloak && N.cloak.clear) N.cloak.clear();
              try {
                w.close();
              } catch (err) {}
            } else {
              /* remember it: cloaking will not fire another doomed popup */
              if (N.cloak && N.cloak.markBlocked) N.cloak.markBlocked();
              d.toast("Popup blocked. Allow popups for NULL to enable cloaking.", { type: "err", hold: 5000 });
            }
          },
        },
      ],
    });
  }

  /* ---------- entry point ---------- */
  function start() {
    /* inside a cloaked iframe (the about:blank / blob: copy) this page is a
       clone: storage is shared, so the tour is already done and prompts()
       would just open the permission ask a second time in the new tab. The
       ask belongs to the real tab. */
    try {
      if (window.top !== window.self) return;
    } catch (err) {
      return; /* cross-origin access threw: we are framed, same answer */
    }
    /* anyone who dismissed the old welcome modal has been here before */
    if (!N.flags.get(DONE) && N.flags.get("welcome")) N.flags.set(DONE);
    if (N.flags.get(DONE)) {
      /* already toured: on the home page the permission ask still waits,
         the same way it always did */
      if (page() === "home") prompts();
      return;
    }
    var st = saved();
    if (st && STEPS[st.i] && STEPS[st.i].page === page()) {
      show(st.i);
      return;
    }
    if (st) clear();
    /* the tour opens on the home page; land somewhere else and it waits
       until you are there */
    if (page() === "home") {
      save(0);
      show(0);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  N.tour = { start: start, prompts: prompts };
})();
