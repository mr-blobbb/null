/* NULL — scroll.js
   Custom overlay scrollbar for the library pages (games / apps / proxies).
   The native page scrollbar is hidden; a slim frosted pill tracks scroll.
   The page itself keeps scrolling normally. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  function attach(container) {
    if (!container) return null;
    /* one rail per container */
    if (container._nullRail) return container._nullRail;

    container.style.position = "relative";
    var rail = d.h("div", { class: "rail", "aria-hidden": "true" });
    var thumb = d.h("div", { class: "th" });
    rail.appendChild(thumb);
    container.appendChild(rail);

    var hideTimer = null;
    var dragging = false;

    function size() {
      var sh = container.scrollHeight;
      var ch = container.clientHeight;
      if (sh <= ch + 2) {
        rail.classList.remove("show");
        return;
      }
      var th = Math.max(46, (ch / sh) * ch);
      thumb.style.height = th + "px";
      pos();
    }

    function pos() {
      var sh = container.scrollHeight - container.clientHeight;
      var ch = container.clientHeight;
      if (sh <= 0) return;
      var maxTop = ch - thumb.offsetHeight - 8;
      var p = (container.scrollTop / sh) * maxTop;
      thumb.style.top = Math.max(4, p) + "px";
    }

    function wake() {
      size();
      rail.classList.add("show");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        if (!dragging) rail.classList.remove("show");
      }, 1400);
    }

    var ticking = false;
    container.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(function () {
            pos();
            wake();
            ticking = false;
          });
        }
      },
      { passive: true },
    );

    rail.addEventListener("mouseenter", wake);
    rail.addEventListener("mouseleave", function () {
      if (!dragging) rail.classList.remove("show");
    });

    thumb.addEventListener("pointerdown", function (e) {
      dragging = true;
      rail.classList.add("drag");
      thumb.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    thumb.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var rect = rail.getBoundingClientRect();
      var sh = container.scrollHeight - container.clientHeight;
      var maxTop = rect.height - thumb.offsetHeight;
      var y = e.clientY - rect.top - thumb.offsetHeight / 2;
      var ratio = d.clamp(y / maxTop, 0, 1);
      container.scrollTop = ratio * sh;
    });
    function up(e) {
      dragging = false;
      rail.classList.remove("drag");
      try {
        thumb.releasePointerCapture(e.pointerId);
      } catch (err) {}
      wake();
    }
    thumb.addEventListener("pointerup", up);
    thumb.addEventListener("pointercancel", up);

    var ro = new ResizeObserver(function () {
      wake();
    });
    ro.observe(container);

    window.addEventListener("resize", wake);
    wake();

    container._nullRail = { rail: rail, size: size, destroy: function () {
        ro.disconnect();
        window.removeEventListener("resize", wake);
        rail.remove();
        delete container._nullRail;
      } };
    return container._nullRail;
  }

  N.scroll = { attach: attach };
})();
