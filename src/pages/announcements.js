/* NULL · announcements.js
   The feed: the newest post gets the hero card at the top, everything else
   runs down a timeline with the date in the gutter. Category chips filter it,
   the same way labels work on the library pages. Posts come from content.js
   (announcements array), newest first. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;
  var C = window.NULL_CONTENT || {};

  /* one tone + one glyph per category, so a post reads at a glance */
  var CATS = {
    update: { tone: "ok", icon: "refresh", label: "update" },
    notice: { tone: "accent", icon: "ann", label: "notice" },
    event: { tone: "accent", icon: "sparkle", label: "event" },
    info: { tone: "", icon: "info", label: "info" },
  };
  function cat(id) {
    return CATS[id] || CATS.info;
  }

  function posts() {
    return (C.announcements || []).slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
  }

  /* "about a minute read" beats "3 paragraphs", and it is honest for a post
     this short: 200 words a minute, floored at one */
  function readTime(text) {
    var words = String(text || "").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200)) + " min read";
  }

  function dateParts(iso) {
    var dt = new Date(iso);
    if (isNaN(dt)) return { day: "--", mon: "---", full: iso };
    return {
      day: String(dt.getDate()),
      mon: dt.toLocaleDateString(undefined, { month: "short" }),
      full: N.dt.fmt(iso),
    };
  }

  var filter = "All";

  /* ---------- the hero: newest post ---------- */
  function hero(a) {
    var c = cat(a.category);
    var box = d.h("article", { class: "ann-hero glass" });
    box.appendChild(
      d.h("div", { class: "ann-hero-glow", "aria-hidden": "true" }),
    );
    box.appendChild(
      d.h("div", { class: "ann-hero-top" }, [
        d.h("span", { class: "chip accent latest-chip" }, [d.icon("sparkle"), "latest"]),
        d.h("span", { class: "chip " + c.tone }, [d.icon(c.icon), c.label]),
        d.h("span", { class: "ann-when" }, dateParts(a.date).full + " · " + readTime(a.desc)),
      ]),
    );
    box.appendChild(d.h("h2", { class: "ann-hero-title" }, a.title));
    box.appendChild(d.h("p", { class: "ann-hero-desc" }, a.desc));
    if (a.link) {
      box.appendChild(
        d.h("a", { class: "btn btn-primary btn-sm ann-hero-go", href: N.url(a.link) }, [
          "Open",
          d.icon("chevR"),
        ]),
      );
    }
    return box;
  }

  /* ---------- one line of the timeline ---------- */
  function entry(a) {
    var c = cat(a.category);
    var dp = dateParts(a.date);
    var row = d.h("div", { class: "ann-row" }, [
      d.h("div", { class: "ann-gutter" }, [
        d.h("span", { class: "ann-day" }, dp.day),
        d.h("span", { class: "ann-mon" }, dp.mon),
      ]),
      d.h("div", { class: "ann-line", "aria-hidden": "true" }, [
        d.h("i", { class: "ann-node" }),
      ]),
      d.h("article", { class: "ann-card glass" }, [
        d.h("div", { class: "ann-top" }, [
          d.h("span", { class: "chip " + c.tone }, [d.icon(c.icon), c.label]),
          d.h("span", { class: "ann-date" }, dp.full + " · " + readTime(a.desc)),
        ]),
        d.h("h3", null, a.title),
        d.h("p", null, a.desc),
        a.link
          ? d.h("a", { class: "ann-link", href: N.url(a.link) }, ["Open ", d.icon("chevR")])
          : null,
      ]),
    ]);
    return row;
  }

  /* ---------- category chips ---------- */
  function tools(list) {
    var host = d.qs("#annTools");
    if (!host) return;
    host.textContent = "";
    var counts = {};
    list.forEach(function (a) {
      var k = cat(a.category).label;
      counts[k] = (counts[k] || 0) + 1;
    });
    var row = d.h("div", { class: "filter-row ann-filter", role: "group", "aria-label": "Filter announcements" });
    function chip(label, n) {
      return d.h("button", {
        type: "button",
        class: "chip chip-btn" + (filter === label ? " on" : ""),
        onclick: function () {
          filter = label;
          paint();
        },
      }, [d.h("span", { class: "ch-t" }, label), d.h("span", { class: "ch-n" }, String(n))]);
    }
    row.appendChild(chip("All", list.length));
    Object.keys(counts)
      .sort()
      .forEach(function (k) {
        row.appendChild(chip(k, counts[k]));
      });
    host.appendChild(row);

    var last = list.length ? dateParts(list[0].date).full : "";
    host.appendChild(
      d.h("span", { class: "ann-sum" }, [
        d.icon("clock"),
        list.length + (list.length === 1 ? " post" : " posts"),
        last ? " · last one " + last : "",
      ]),
    );
  }

  /* ---------- paint ---------- */
  function paint() {
    var all = posts();
    var topHost = d.qs("#annTop");
    var listHost = d.qs("#annList");
    if (!listHost) return;
    listHost.textContent = "";
    if (topHost) topHost.textContent = "";

    tools(all);

    if (!all.length) {
      listHost.appendChild(
        N.cards.empty("No announcements", "Check back soon. New games and updates land here first."),
      );
      return;
    }

    /* the hero is always the newest post, whatever the filter says: it is
       the one thing on the page you came here to read */
    if (topHost) topHost.appendChild(hero(all[0]));

    var rest = all.slice(1).filter(function (a) {
      return filter === "All" || cat(a.category).label === filter;
    });
    if (!rest.length) {
      listHost.appendChild(
        N.cards.empty(
          filter === "All" ? "Nothing else yet" : "Nothing in " + filter,
          filter === "All"
            ? "That is the only post so far. More land here as NULL updates."
            : "Try another category, or All.",
        ),
      );
      return;
    }
    rest.forEach(function (a, i) {
      var row = entry(a);
      row.style.setProperty("--i", i);
      listHost.appendChild(row);
    });
    watch();
  }

  /* rows lift in as they are scrolled to, once each */
  function watch() {
    if (typeof IntersectionObserver === "undefined") {
      d.qsa(".ann-row").forEach(function (el) {
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
    d.qsa(".ann-row").forEach(function (el) {
      io.observe(el);
    });
  }

  /* Unread dot: a small green pulse sits at the top-left (before the
     eyebrow) when an announcement is newer than the last one seen. Being
     on this page means it's been seen, so after a moment it's recorded
     (which also clears the nav icon dot via the annSeen bus event) and the
     page dot fades out. */
  function unreadDot() {
    if (!N.ann || !N.ann.unread()) return;
    var eye = d.qs(".page-head .eyebrow");
    if (!eye) return;
    var dot = d.h("span", {
      class: "ann-dot",
      title: "New announcements",
      "aria-label": "New announcements",
    });
    eye.insertBefore(dot, eye.firstChild);
    setTimeout(function () {
      N.ann.markSeen();
      dot.classList.add("gone");
      setTimeout(function () {
        if (dot.parentNode) dot.parentNode.removeChild(dot);
      }, 700);
    }, 3000);
  }

  function init() {
    unreadDot();
    paint();
    N.bus.on("catalog", paint);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
