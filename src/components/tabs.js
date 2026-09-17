/* NULL · tabs.js
   The tab bar.

   NULL's pages are separate documents, one per address, which is what makes
   the site work on a static host. This puts a browser's shape on top of that:
   every page you open becomes a tab named by its null:// address, the strip
   remembers the tabs you have open across visits (localStorage), and the tab
   you are on is the one that is lit.

   Opening a tab is a real navigation — the same link the rail uses — so a tab
   is a page, a reload goes where you were, and Back still works. Closing the
   tab you are on moves you to the one beside it, exactly like a browser would.

   The "+" on the right is the All Apps sheet: every door in one list, which
   is also the way to a page on a phone, where the rail is a strip of icons
   with nowhere to hover. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var KEY = "null:tabs";
  var MAX = 12;

  function read() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.filter(function (id) {
        return !!N.router.LINKS[id] || id === "player";
      });
    } catch (e) {
      return [];
    }
  }

  function write(ids) {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
    } catch (e) {
      /* private mode, or storage full: the strip still works this visit */
    }
  }

  function currentId() {
    var c = N.router.current();
    return c ? c.id : null;
  }

  var ids = [];

  /* the current page joins the strip and moves to the end, the way a browser
     puts the tab you just opened next to the ones already there */
  function sync() {
    ids = read();
    var me = currentId();
    if (!me) return;
    var at = ids.indexOf(me);
    if (at !== -1) ids.splice(at, 1);
    ids.push(me);
    if (ids.length > MAX) ids = ids.slice(ids.length - MAX);
    write(ids);
  }

  function close(id) {
    if (ids.indexOf(id) === -1) return;
    var wasActive = id === currentId();
    var at = ids.indexOf(id);
    ids.splice(at, 1);
    write(ids);
    if (!wasActive) {
      draw();
      return;
    }
    var next = ids[at] || ids[at - 1] || "home";
    go(next);
  }

  function go(id) {
    var l = N.router.LINKS[id];
    if (!l) return;
    location.href = N.url(l.url);
  }

  /* ---------- drawing ---------- */
  var strip = null;

  function tabEl(id) {
    var link = N.router.LINKS[id];
    var on = id === currentId();
    var label = link ? link.t : id;
    var host = link ? link.host : id;

    var x = d.h("button", {
      type: "button",
      class: "tb2-x",
      "aria-label": "Close " + label,
      tabindex: "-1",
    }, [N.icons.svg("x", 12, 2)]);

    var tab = d.h(
      "a",
      {
        class: "tb2-t" + (on ? " on" : ""),
        href: link ? N.url(link.url) : N.url("/"),
        title: "null://" + host,
      },
      [
        d.h("span", { class: "tb2-ic" }, [N.icons.svg(link ? link.icon : "file", 14)]),
        d.h("span", { class: "tb2-host" }, "null://" + host),
        on ? null : d.h("span", { class: "tb2-name" }, label),
        x,
      ],
    );

    x.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      close(id);
    });
    return tab;
  }

  /* the All Apps sheet: every door, with its icon and name */
  function allApps() {
    var grid = d.h("div", { class: "tb2-grid" });
    N.router.ALL.forEach(function (l) {
      grid.appendChild(
        d.h("a", { class: "tb2-app", href: N.url(l.url) }, [
          d.h("span", { class: "tb2-app-ic" }, [N.icons.svg(l.icon, 19)]),
          d.h("span", { class: "tb2-app-t" }, [d.h("b", null, l.t), d.h("span", null, "null://" + l.host)]),
        ]),
      );
    });

    var box = d.h("div", { class: "tb2-sheet" }, [
      d.h("div", { class: "tb2-sheet-head" }, [
        d.h("span", { class: "tb2-ic" }, [N.icons.svg("grid", 18)]),
        d.h("b", null, "Apps"),
        d.h("button", { type: "button", class: "tb2-x tb2-x--bare", "aria-label": "Close", onclick: close_ }, [
          N.icons.svg("x", 17),
        ]),
      ]),
      grid,
    ]);
    var ov = d.h("div", { class: "tb2-ov", role: "dialog", "aria-label": "All apps" }, [box]);

    function onKey(e) {
      if (e.key === "Escape") close_();
    }
    function close_() {
      document.removeEventListener("keydown", onKey);
      ov.remove();
    }
    ov.addEventListener("mousedown", function (e) {
      if (e.target === ov) close_();
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(ov);
  }

  function draw() {
    if (!strip) return;
    strip.textContent = "";

    strip.appendChild(
      d.h("a", { class: "tb2-brand", href: N.url("/"), title: "null://home" }, [N.icons.svg("ban", 15)]),
    );

    var list = d.h("div", { class: "tb2-list" });
    ids.forEach(function (id) {
      list.appendChild(tabEl(id));
    });
    strip.appendChild(list);

    strip.appendChild(
      d.h("button", { type: "button", class: "tb2-add", title: "All apps", "aria-label": "All apps", onclick: allApps }, [
        N.icons.svg("plus", 15),
      ]),
    );

    /* keep the tab you are on in view when the strip is longer than the window */
    var on = d.qs(".tb2-t.on", strip);
    if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function build() {
    if (document.body.classList.contains("no-chrome")) return;
    if (d.qs("#tb2")) return;
    strip = d.h("nav", { class: "tb2", id: "tb2", "aria-label": "Open pages" });
    document.body.insertBefore(strip, document.body.firstChild);
    document.documentElement.dataset.tabs = "on";
    sync();
    draw();
    /* an extension, another tab, or the search palette can change the list */
    window.addEventListener("storage", function (e) {
      if (e.key === KEY) {
        ids = read();
        draw();
      }
    });
  }

  N.tabs = {
    build: build,
    list: function () {
      return read();
    },
    close: close,
    host: N.router.host,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
