/* NULL · home.js
   The landing page is a front door now: a wordmark, the site search and a
   handful of ways in. Everything that used to crowd the dashboard (featured
   rail, game of the day, recents, the schedule card, the daily crate) has its
   own page, and the nav carries the rest.

   What is left to do here is wire the one form, hang the particle network
   behind it all, and start the first-run tour. The wordmark is plain text: no
   per-letter spans, no sheen. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var inited = false;

  /* ---------- the search box ----------
     Typing here is the same search as pressing / anywhere: the overlay opens
     with the words already in it, so Enter on the front door and Enter inside
     the palette take the same path. */
  function bindSearch() {
    var form = d.qs("#homeSearch");
    var input = d.qs("#searchInput");
    if (!form || !input) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      N.search.open(input.value.trim());
    });
    /* the whole field feels clickable, not just the input box */
    form.addEventListener("click", function (e) {
      if (e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON") input.focus();
    });
    /* the "/" shortcut itself lives in shell.js, near the other global keys,
       so it works on every page including this one */
  }

  /* ---------- the network ----------
     Tiny gray dots drifting across the black, a hairline between any two that
     pass close by: theme.js draws the whole thing on one canvas, and it reads
     its ink from CSS so it follows the theme. It sits behind everything and
     never takes a click. Performance mode drops it (the site is already
     telling those devices to do less), and a visitor who asked for reduced
     motion gets one still frame instead of the drift. */
  function mountNet() {
    if (!N.theme || !N.theme.netLayer) return;
    if (N.prefs.get("perf")) return;
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var host = d.h("div", { class: "door-net", "aria-hidden": "true" }, [N.theme.netLayer(84, !still)]);
    document.body.appendChild(host);
  }

  function init() {
    if (inited) return;
    inited = true;
    mountNet();
    bindSearch();
    /* the first visit still gets the guided tour (components/tour.js): it
       walks its own steps and hands off to the permission ask at the end */
    if (N.tour) N.tour.start();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
