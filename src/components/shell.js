/* NULL — shell.js
   Shared chrome: top navigation (with More menu + mobile drawer), search
   trigger, theme toggle, footer, custom scrollbar attachment, back-to-top
   and the global keyboard bits (SGGAMES, "/" to search). */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  function logoMark() {
    var el = d.h("span", { class: "brand-mark", "aria-hidden": "true" });
    el.innerHTML =
      '<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor">' +
      '<rect x="1.6" y="1.6" width="28.8" height="28.8" rx="9.5" stroke-opacity="0.35" stroke-width="1.6"/>' +
      '<circle cx="16" cy="16" r="7.6" stroke-width="2.6"/>' +
      '<path d="M11.3 11.3l9.4 9.4" stroke-width="2.6" stroke-linecap="round"/>' +
      "</svg>";
    return el;
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

    /* primary links */
    var links = d.h("nav", { class: "nav-links" });
    N.router.PRIMARY.forEach(function (l) {
      links.appendChild(
        d.h("a", { class: "nav-link" + (N.router.isActive(l.url) ? " on" : ""), href: l.url }, [
          d.icon(l.icon),
          d.h("span", null, l.t),
        ]),
      );
    });

    /* More dropdown */
    var moreBtn = d.h("button", { type: "button", class: "nav-link", id: "moreBtn" }, [
      d.icon("list"),
      d.h("span", null, "More"),
      d.icon("chevD"),
    ]);
    var menu = d.h("div", { class: "more-menu glass-2", id: "moreMenu" });
    N.router.GROUPS.forEach(function (g) {
      menu.appendChild(d.h("div", { class: "mg" }, g.name));
      g.links.forEach(function (l) {
        menu.appendChild(
          d.h("a", { class: "mi" + (N.router.isActive(l.url) ? " on" : ""), href: l.url }, [
            d.icon(l.icon),
            d.h("span", null, l.t),
          ]),
        );
      });
    });
    var moreWrap = d.h("div", { class: "more-wrap" }, [moreBtn, menu]);
    moreBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      moreWrap.classList.toggle("open");
      drawerOv.classList.remove("open");
    });
    document.addEventListener("click", function (e) {
      if (!moreWrap.contains(e.target)) moreWrap.classList.remove("open");
    });

    bar.appendChild(links);
    bar.appendChild(moreWrap);

    /* search trigger */
    var searchBtn = d.h("button", {
      type: "button",
      class: "searchbox field",
      "aria-label": "Search",
      title: "Search NULL  ( / )",
    }, [
      d.icon("search"),
      d.h("span", { style: { color: "var(--text-2)", fontSize: "14px" } }, "Search NULL"),
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
      moreWrap.classList.remove("open");
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
          "A frosted, black-and-white hub for games, apps, proxies and tools. NULL is local-first: preferences, history and favorites never leave your browser."),
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
        "\u00a9 " + new Date().getFullYear() + " NULL \u00b7 static-first \u00b7 no servers, no accounts",
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
      }
    });
  }

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
