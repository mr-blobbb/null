/* NULL — schedule.js (page) */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  function init() {
    var el = d.qs("#schedFull");
    if (!el) return;
    N.schedule.render(el, { mini: false });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
