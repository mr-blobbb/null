/* NULL · eggs.js
   Shared bits for the hidden pages (/void, /blob, /time, /credits): the little
   popup they all fire, and the typewriter /blob runs on. Nothing on the normal
   site uses either, so this file is only ever loaded by an egg page. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  /* clean urls on the egg pages too: they skip shell.js (no nav, no footer,
     nothing to init), so the address rewrite happens here instead */
  if (N.cleanAddress) N.cleanAddress();

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = list[i];
      list[i] = list[j];
      list[j] = t;
    }
    return list;
  }

  /* ---------- popups ----------
     A small glass card somewhere random, gone after a moment. Position is
     measured in viewport pixels, so it stays put while the page scrolls. */
  function pop(text, opts) {
    if (!d) return null;
    opts = opts || {};
    var el = d.h("div", { class: "egg-pop", role: "status" }, text);
    var w = 240;
    var h = 64;
    var pad = 16;
    var roomX = Math.max(0, window.innerWidth - w - pad * 2);
    var roomY = Math.max(0, window.innerHeight - h - pad * 2);
    el.style.left = Math.round(pad + Math.random() * roomX) + "px";
    el.style.top = Math.round(pad + Math.random() * roomY) + "px";
    el.style.setProperty("--rot", (Math.random() * 7 - 3.5).toFixed(2) + "deg");
    document.body.appendChild(el);
    if (N.ext) N.ext.emit("egg:pop", { text: String(text) });
    setTimeout(
      function () {
        el.classList.add("out");
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 260);
      },
      opts.hold || 2600,
    );
    return el;
  }

  /* ---------- typewriter ----------
     Types one line at a time into `box`, forever. The pool is reshuffled each
     pass, so a modest list still feels like it never ends. A line starting
     with ">" is styled as the louder voice. Lines are removed from the top
     once `cap` of them are on screen. */
  function stream(box, lines, opts) {
    if (!d || !box || !lines || !lines.length) return;
    opts = opts || {};
    var cps = opts.cps || 46; // characters per second
    var pause = opts.pause || 640; // beat between finished lines
    var cap = opts.cap || 90;
    var every = Math.max(8, Math.round(1000 / cps));
    var pool = shuffle(lines.slice());

    function line() {
      if (!pool.length) pool = shuffle(lines.slice());
      var text = pool.pop();
      var loud = text.charAt(0) === ">";
      if (loud) text = text.slice(1);

      var out = document.createElement("span");
      var caret = d.h("i", { class: "caret" });
      var row = d.h("div", { class: "blob-line" + (loud ? " b" : "") }, [out, caret]);
      box.appendChild(row);
      while (box.children.length > cap) box.removeChild(box.firstChild);

      var i = 0;
      (function tick() {
        if (i >= text.length) {
          caret.remove();
          setTimeout(line, pause);
          return;
        }
        /* a few characters at a time: same speed, far fewer timers */
        var n = Math.min(text.length - i, 1 + Math.floor(Math.random() * 3));
        out.textContent += text.slice(i, i + n);
        i += n;
        setTimeout(tick, every * n);
      })();
    }

    line();
  }

  N.eggs = { pop: pop, stream: stream, shuffle: shuffle };
})();
