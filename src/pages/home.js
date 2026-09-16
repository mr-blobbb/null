/* NULL · home.js
   The landing page is a front door now: a wordmark, the site search and a
   handful of ways in. Everything that used to crowd the dashboard (featured
   rail, game of the day, recents, the schedule card, the daily crate) has its
   own page, and the nav bar carries the rest.

   What is left to do here is wire the one form, and start the first-run tour.
   The wordmark is plain text: no per-letter spans, no sheen. */
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

  function init() {
    if (inited) return;
    inited = true;
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
