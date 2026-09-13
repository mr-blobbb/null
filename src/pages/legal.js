/* NULL · legal.js
   Each info page (about / privacy / terms / cookies / district / license)
   ships raw markdown inside a <script type="text/markdown"> block. This
   renders it into the .md-out container. Owners never write <h1>/<p> by hand. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  function init() {
    var src = d.qs('script[type="text/markdown"]');
    var out = d.qs(".md-out");
    if (!src || !out) return;
    var text = (src.textContent || "")
      .replace(/^\s*<!--[\s\S]*?-->\s*/g, "") // strip the WRITE MARKDOWN HERE marker
      .replace(/^\n+/, "");
    out.innerHTML = N.md.render(text);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
