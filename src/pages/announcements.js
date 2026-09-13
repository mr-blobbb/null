/* NULL · announcements.js */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;
  var C = window.NULL_CONTENT || {};

  var TONE = { update: "ok", notice: "accent", event: "accent", info: "" };

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
    var box = d.qs("#annList");
    if (!box) return;
    var list = (C.announcements || []).slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
    if (!list.length) {
      box.appendChild(N.cards.empty("No announcements", "Check back soon."));
      return;
    }
    list.forEach(function (a) {
      var top = d.h("div", { class: "ann-top" }, [
        d.h("span", { class: "chip " + (TONE[a.category] || "accent") }, a.category || "info"),
        d.h("span", { class: "ann-date" }, N.dt.fmt(a.date)),
      ]);
      var card = d.h("div", { class: "ann-card glass" }, [
        top,
        d.h("h3", null, a.title),
        d.h("p", null, a.desc),
        a.link
          ? d.h("a", { class: "ann-link", href: a.link }, ["Open ", d.icon("chevR")])
          : null,
      ]);
      box.appendChild(card);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
