/* NULL: cards.js
   Card renderers (games/apps/proxies) plus the viewport-based "chunk"
   virtualization used by the big library pages: rows near the viewport are
   rendered, rows far away are unloaded, and total height is preserved so
   the scrollbar never jumps. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var META = {
    game: { icon: "game", label: "Game", play: "Play", fb: d.fb.game, minW: 168 },
    app: { icon: "grid", label: "App", play: "Open", fb: d.fb.app, minW: 168 },
    proxy: { icon: "proxy", label: "Proxy", play: "Visit", fb: d.fb.proxy, minW: 232 },
  };

  var KIND = { game: "game", app: "app", proxy: "proxy" };

  /* ---------- corner badges (thumbnail pills) ----------
     NEW: stamped by discovery from meta.txt "Added: YYYY-MM-DD", 14 days
     HOT: opt-in via a "#hot" line in meta.txt */
  function badgeEl(b) {
    var kids = [];
    if (b.icon) kids.push(d.icon(b.icon));
    if (b.txt) kids.push(b.txt);
    return d.h("span", { class: "tb " + b.cls, title: b.title || "" }, kids);
  }

  function badgesFor(entry) {
    var out = [];
    if (entry.at && entry.at <= Date.now() && Date.now() - entry.at < 14 * 86400000) {
      out.push({ cls: "b-new", txt: "NEW", title: "Added recently" });
    }
    if (entry.hot) out.push({ cls: "b-hot", txt: "HOT", title: "Trending on NULL" });
    return out;
  }

  /* ---------- thumb (games/apps only: proxies use rows) ---------- */
  function thumbEl(entry, kind) {
    var media = d.h("div", { class: "tmedia" });
    if (entry.thumb) {
      var img = d.h("img", {
        src: entry.thumb,
        alt: "",
        loading: "lazy",
        decoding: "async",
        onload: function () {
          img.classList.add("loaded");
        },
      });
      d.bindImgFallback(img, kind);
      media.appendChild(img);
    }
    /* name badge: drawn on the thumbnail so the title can never be
       squeezed out of view (the virtualized grid rows keep the body
       name hidden; featured/recs rails use the body name below) */
    media.appendChild(d.h("span", { class: "tname-badge", title: entry.name }, entry.name));
    /* corner badges (NEW / HOT) */
    var badges = badgesFor(entry);
    if (badges.length) {
      var host = d.h("div", { class: "tbadges" });
      badges.forEach(function (b) {
        host.appendChild(badgeEl(b));
      });
      media.appendChild(host);
    }
    return media;
  }

  /* ---------- proxy row (no images: plain list entry) ---------- */
  function proxyRow(entry) {
    var el = d.h("div", {
      class: "tcard proxy-row",
      role: "button",
      tabindex: "0",
      "aria-label": "Proxy: " + entry.name,
    }, [
      d.h("div", { class: "pr-main" }, [
        d.h("h3", { class: "tname", title: entry.name }, entry.name),
        d.h("p", { class: "tdesc" }, entry.desc || "External destination in the NULL proxy list."),
      ]),
      d.h("div", { class: "pr-side" }, [
        statusChip(entry.status),
        d.h("button", { type: "button", class: "btn btn-primary btn-sm", onclick: function (e) {
            e.stopPropagation();
            N.launch.proxy(entry);
          } }, [d.icon("ext"), "Visit"]),
      ]),
    ]);
    el.addEventListener("click", function () { N.launch.proxy(entry); });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        N.launch.proxy(entry);
      }
    });
    return el;
  }

  /* ---------- label pills ---------- */
  function chipsFor(entry, max) {
    var chips = [];
    var labels = entry.labels || [];
    labels.slice(0, max == null ? 3 : max).forEach(function (l) {
      chips.push(d.h("span", { class: "chip" }, l));
    });
    if (labels.length > 3 && (max == null || max >= 3)) {
      chips.push(
        d.h("span", { class: "chip more-chips", title: labels.slice(3).join(", ") }, "+" + (labels.length - 3)),
      );
    }
    return chips;
  }

  function statusChip(status) {
    if (!status) return null;
    var tone = status === "All Good" ? "ok" : status === "Blocked" ? "bad" : "warn";
    return d.h("span", { class: "chip " + tone, title: "Manual status" }, [
      d.h("span", { class: "dot" }),
      status,
    ]);
  }

  /* ---------- favorites star ---------- */
  function favBtn(entry, kind) {
    if (kind === "proxy") return null;
    var on = N.favs.has(kind, entry.id);
    var btn = d.h("button", {
      type: "button",
      class: "fav" + (on ? " on" : ""),
      "aria-label": on ? "Remove from favorites" : "Add to favorites",
      title: on ? "Remove from favorites" : "Add to favorites",
    }, [d.icon("star")]);
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var now = N.favs.toggle(kind, entry.id);
      btn.classList.toggle("on", now);
      btn.setAttribute("aria-label", now ? "Remove from favorites" : "Add to favorites");
      d.toast(now ? "Added to favorites" : "Removed from favorites", { icon: "star" });
    });
    return btn;
  }

  /* ---------- main card ---------- */
  function card(entry, kind) {
    if (kind === KIND.proxy) return proxyRow(entry);
    var meta = META[kind];
    var open = function () {
      if (kind === KIND.game) N.launch.game(entry);
      else N.launch.app(entry);
    };

    var body = d.h("div", { class: "tbody" }, [
      d.h("h3", { class: "tname", title: entry.name }, entry.name),
      d.h("div", { class: "chips-row" }, kind === "proxy" ? [statusChip(entry.status), null] : chipsFor(entry)),
      d.h("p", { class: "tdesc" }, entry.desc || meta.label + " in the NULL library."),
    ]);

    /* no play button: the whole card is the click target (plus a star) */
    var foot = d.h("div", { class: "tfoot tfoot-solo" }, [
      favBtn(entry, kind),
    ]);

    var el = d.h("article", {
      class: "tcard",
      role: "button",
      tabindex: "0",
      "aria-label": meta.label + ": " + entry.name,
    }, [
      thumbEl(entry, kind),
      body,
      foot,
    ]);
    el.addEventListener("click", open);
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
    return el;
  }

  /* ---------- compact row (recent / favorites lists) ---------- */
  function row(entry, kind, opts) {
    opts = opts || {};
    var meta = META[kind];
    var ic;
    if (entry.thumb) {
      var img = d.h("img", { src: entry.thumb, alt: "", loading: "lazy" });
      d.bindImgFallback(img, kind);
      ic = d.h("div", { class: "ric" }, [img]);
    } else {
      ic = d.h("div", { class: "ric" }, [d.icon(meta.icon)]);
    }
    var open = function () {
      if (kind === "proxy") N.launch.proxy(entry);
      else if (kind === "game") N.launch.game(entry);
      else N.launch.app(entry);
    };
    var el = d.h("div", { class: "rec-row", role: "button", tabindex: "0" }, [
      ic,
      d.h("div", { class: "rtxt" }, [
        d.h("b", null, entry.name),
        d.h("span", null, opts.sub || meta.label),
      ]),
      d.h("span", { class: "chip kind-chip" }, meta.label),
    ]);
    el.addEventListener("click", open);
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        open();
      }
    });
    return el;
  }

  function empty(title, msg) {
    return d.h("div", { class: "empty" }, [
      d.icon("search"),
      d.h("b", null, title || "Nothing here yet"),
      d.h("p", null, msg || ""),
    ]);
  }

  /* ============================================================
     virtualized grid: Minecraft-chunk style row windows
     ============================================================ */
  function vgrid(host, cfg) {
    cfg = cfg || {};
    var items = cfg.items || [];
    var cardH = cfg.cardH || 258;
    var gap = cfg.gap || 18;
    var minW = cfg.minW || 168;
    var buffer = cfg.buffer || 2;
    var scrollEl = cfg.scroll || window;
    var renderItem = cfg.render || card;

    var cols = 1;
    var rows = [];
    var rowH = cardH + gap;
    var firstVis = -1;
    var lastVis = -1;
    var raf = null;
    var destroyed = false;
    var ratio = 0;

    function colsFor() {
      var w = host.clientWidth || host.parentElement.clientWidth || 800;
      var c = Math.floor((w + gap) / (minW + gap));
      return Math.max(1, c);
    }

    function topScroll() {
      if (scrollEl === window) return window.scrollY || document.documentElement.scrollTop;
      return scrollEl.scrollTop || 0;
    }
    function viewH() {
      if (scrollEl === window) return window.innerHeight;
      return scrollEl.clientHeight || window.innerHeight;
    }

    function build() {
      host.innerHTML = "";
      rows = [];
      var n = items.length;
      var rCount = n ? Math.ceil(n / cols) : 0;
      host.style.height = rCount ? rCount * rowH - gap + "px" : "0px";
      host.classList.add("vgrid");
      for (var r = 0; r < rCount; r++) {
        var rowEl = d.h("div", {
          class: "vrow",
          style: {
            top: r * rowH + "px",
            height: cardH + "px",
            gridTemplateColumns: "repeat(" + cols + ", minmax(0,1fr))",
          },
        });
        rowEl.filled = false;
        rowEl._r = r;
        host.appendChild(rowEl);
        rows.push(rowEl);
      }
      firstVis = -1;
      lastVis = -1;
    }

    function fillRow(r) {
      var rowEl = rows[r];
      if (!rowEl || rowEl.filled) return;
      var start = r * cols;
      var end = Math.min(items.length, start + cols);
      var frag = document.createDocumentFragment();
      for (var i = start; i < end; i++) {
        frag.appendChild(renderItem(items[i], i));
      }
      rowEl.appendChild(frag);
      rowEl.classList.add("fill");
      rowEl.filled = true;
    }
    function clearRow(r) {
      var rowEl = rows[r];
      if (!rowEl || !rowEl.filled) return;
      rowEl.textContent = "";
      rowEl.classList.remove("fill");
      rowEl.filled = false;
    }

    function paint() {
      var st = topScroll();
      var vh = viewH();
      var f = Math.floor(st / rowH) - buffer;
      var l = Math.ceil((st + vh) / rowH) + buffer;
      f = Math.max(0, f);
      l = Math.min(rows.length - 1, l);
      if (f === firstVis && l === lastVis && f !== -1) return;
      firstVis = f;
      lastVis = l;
      for (var r = 0; r < rows.length; r++) {
        if (r >= f && r <= l) fillRow(r);
        else clearRow(r);
      }
    }

    function schedulePaint() {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        if (!destroyed) paint();
      });
    }

    function saveRatio() {
      var max = host.scrollHeight - viewH();
      ratio = max > 0 ? topScroll() / max : 0;
    }
    function restoreRatio() {
      var max = host.scrollHeight - viewH();
      if (max > 0) {
        if (scrollEl === window) window.scrollTo(0, ratio * max);
        else scrollEl.scrollTop = ratio * max;
      }
    }

    function resize() {
      if (destroyed) return;
      saveRatio();
      var c = colsFor();
      if (c !== cols) {
        cols = c;
        build();
        restoreRatio();
        schedulePaint();
      }
    }

    function update(newItems, opts) {
      items = newItems || [];
      cols = colsFor();
      if (opts && opts.resetScroll && scrollEl !== window) scrollEl.scrollTop = 0;
      else if (opts && opts.resetScroll) window.scrollTo(0, 0);
      build();
      schedulePaint();
    }

    cols = colsFor();
    build();
    /* paint once immediately: never leave a full grid of blank rows if a
       later hook (rAF / observer) is unavailable in this browser */
    paint();
    schedulePaint();

    var onScroll = function () {
      schedulePaint();
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resize);
    var ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(function () {
        resize();
      });
      if (host.isConnected) ro.observe(host);
    }
    /* safety: if rows are still empty shortly after setup (exotic embeds),
       force a repaint so the library is never a blank page */
    var fallback = setTimeout(function () {
      if (!destroyed) paint();
    }, 400);

    return {
      update: update,
      destroy: function () {
        destroyed = true;
        if (raf) cancelAnimationFrame(raf);
        clearTimeout(fallback);
        scrollEl.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", resize);
        if (ro) ro.disconnect();
      },
    };
  }

  N.cards = {
    META: META,
    card: card,
    row: row,
    chipsFor: chipsFor,
    statusChip: statusChip,
    favBtn: favBtn,
    empty: empty,
    vgrid: vgrid,
  };
})();
