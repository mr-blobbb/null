/* NULL — announcements.js */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;
  var C = window.NULL_CONTENT || {};

  var TONE = { update: "ok", notice: "accent", event: "accent", info: "" };

  function init() {
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
