/* NULL — shell.js
   Shared chrome: top navigation (icon-only links + mobile drawer), search
   trigger, theme toggle, footer, custom scrollbar attachment, back-to-top
   and the global keyboard bits (SGGAMES, panic key, "/" to search). */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  /* NULL mark = the Material "block" glyph: a circle with a slash. */
  function logoMark() {
    return d.h("span", { class: "brand-mark", "aria-hidden": "true" }, [
      d.icon("ban"),
    ]);
  }

  function brandEl() {
    return d.h("a", { class: "brand", href: "/", "aria-label": "NULL home" }, [
      logoMark(),
      d.h("span", { class: "brand-name" }, "NULL"),
    ]);
  }

  /* ---------- topbar ---------- */
  function topbar() {
    var bar = d.h("div", { class: "topbar" });

    bar.appendChild(brandEl());

    /* primary links — icon-only, no Home (the brand mark is home) */
    var links = d.h("nav", { class: "nav-links" });
    N.router.PRIMARY.forEach(function (l) {
      links.appendChild(
        d.h("a", {
          class: "nav-link" + (N.router.isActive(l.url) ? " on" : ""),
          href: l.url,
          title: l.t,
          "aria-label": l.t,
        }, [d.icon(l.icon)]),
      );
    });
    bar.appendChild(links);

    /* search trigger */
    var searchBtn = d.h("button", {
      type: "button",
      class: "searchbox field",
      "aria-label": "Search",
      title: "Search NULL  ( / )",
    }, [
      d.icon("search"),
      d.h("span", { class: "sb-txt", style: { color: "var(--text-2)", fontSize: "14px" } }, "Search NULL"),
    ]);
    searchBtn.addEventListener("click", function () {
      N.search.open();
    });
    bar.appendChild(searchBtn);

    /* right actions */
    var actions = d.h("div", { class: "top-actions" });
    var themeBtn = d.h("button", {
      type: "button",
      class: "btn-icon btn-outline",
      title: "Toggle theme",
      "aria-label": "Toggle theme",
    });
    themeBtn.appendChild(themeIcon());
    themeBtn.addEventListener("click", function () {
      var next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      N.theme.setTheme(next);
      N.prefs.set("theme", next);
      themeBtn.textContent = "";
      themeBtn.appendChild(themeIcon());
      d.toast(next === "light" ? "Light mode on" : "Dark mode on", { icon: next === "light" ? "sun" : "moon" });
    });
    actions.appendChild(themeBtn);

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
    N.router.GROUPS.forEach(function (g) {
      drawer.appendChild(d.h("div", { class: "mg" }, g.name));
      g.links.forEach(function (l) {
        drawer.appendChild(
          d.h("a", { class: "mi" + (N.router.isActive(l.url) ? " on" : ""), href: l.url }, [
            d.icon(l.icon),
            d.h("span", null, l.t),
          ]),
        );
      });
    });
    drawer.appendChild(
      d.h("div", { class: "drawer-foot" }, "Local-first \u2014 nothing leaves your browser."),
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

  function themeIcon() {
    return d.icon(
      document.documentElement.dataset.theme === "light" ? "moon" : "sun",
    );
  }

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
        wrap.appendChild(d.h("a", { href: l.url }, l.t));
      });
      inner.appendChild(wrap);
    });
var foot = d.h("footer", { class: "site-foot" }, [inner]); 
foot.appendChild( 
  d.h("div", { class: "bottom" }, [ 
    "\u00a9 " + new Date().getFullYear() + " NULL Labs \u00b7 Developed by Mr Blob", 
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
      var t = e.target;
      var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
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

  /* ---------- cloaking: open the whole site in about:blank / blob: ---------- */
  function cloakBlocked() {
    N.modal.open({
      title: "Popup blocked",
      icon: "warn",
      iconTone: "danger",
      body:
        "<p>The browser blocked the popup, so the cloaked window <b>won&rsquo;t open</b>.</p>" +
        "<p>Allow popups for NULL (usually via the icon in the address bar) and try again.</p>",
      actions: [{ label: "Okay", variant: "primary" }],
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
      p.icon +
      "'></head>" +
      "<body style='margin:0'><iframe src='" +
      location.origin +
      "/' style='width:100vw;height:100vh;border:0'></iframe></body></html>"
    );
  }

  /* Popup blockers can refuse the open but still hand back a WindowProxy
     (or kill the tab a moment later). In every failure case we make sure
     nothing is left open — close the window, show the warning only. */
  function cloakOpen(url, mode, shell) {
    var w = null;
    try {
      w = window.open(url, "_blank");
    } catch (err) {
      w = null;
    }
    if (!w) {
      cloakBlocked();
      return;
    }
    if (mode === "blank") {
      /* about:blank windows share the opener's origin — write the shell in */
      try {
        w.document.open();
        w.document.write(shell);
        w.document.close();
      } catch (err) {
        try {
          w.close();
        } catch (e2) {}
        cloakBlocked();
        return;
      }
    }
    /* some blockers cancel the tab right after it opens — if the browser
       closed it, don't leave a stray tab and don't pretend it worked */
    setTimeout(function () {
      if (w.closed) cloakBlocked();
    }, 800);
    d.toast(mode === "blank" ? "Opened NULL in about:blank" : "Opened NULL in blob:", {
      icon: "ban",
    });
  }

  N.cloak = {
    site: function (mode) {
      var shell = cloakShell();
      var url = mode === "blob" ? URL.createObjectURL(new Blob([shell], { type: "text/html" })) : "about:blank";
      cloakOpen(url, mode, shell);
    },
  };

  function init() {
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

    /* custom scrollbar on library pages */
    if (document.body.classList.contains("lb")) {
      var sv = d.qs("#scrollview");
      if (sv) N.scroll.attach(sv);
    }
    if (!raw) backTop();
  }

  N.shell = { init: init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
