/* NULL · shop.js
   Three shelves and a purse.

   Everything here is bought with coins earned by playing (see the play clock
   in econ.js), never with money and never with a level. The item list lives
   in econ.js next to the prices, so buying, gifting and "do I own this" all
   go through the one economy the rest of the site already uses.

   The artwork is drawn, not downloaded. Each item gets one of a handful of
   looping CSS patterns and a colour, which is the closest a static site can
   honestly get to the little animated overlays a real chat client ships:
   they are moving, they loop, and they take the theme. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  /* ---------- shelves ---------- */
  var SHELVES = [
    { kind: "avatar", icon: "sparkle", title: "Avatar decorations", sub: "A loop that runs around your picture on every profile card." },
    { kind: "effect", icon: "star", title: "Profile effects", sub: "A moving layer over the whole card." },
    { kind: "tag", icon: "tag", title: "Name tags", sub: "One chip, next to your name, wherever it shows." },
  ];

  /* ---------- the art ----------
     pattern is one of the loops in v2.css, colour is the ink it runs in.
     Two items can share a pattern and still read apart because of the colour
     and the speed, which is exactly how the real ones behave. */
  var ART = {
    orbit: ["ring", "#8b5cf6"],
    halo: ["halo", "#8fd8e8"],
    eclipse: ["sweep", "#d7d7dc"],
    stardust: ["dust", "#ffd479"],
    prism: ["spin", "#ff5fd2"],
    signal: ["scan", "#58c98e"],
    solar: ["ring", "#ff7847"],
    rift: ["spin", "#7aa2ff"],
    doves: ["dust", "#e8ecff"],
    glitch: ["scan", "#ff5fd2"],
    duckpond: ["halo", "#a8d98a"],
    rainfall: ["rain", "#8fd8e8"],
    embers: ["dust", "#ff7847"],
    aurora: ["halo", "#8b5cf6"],
  };

  function art(item) {
    if (item.kind === "tag") {
      return d.h("div", { class: "sc-art sc-art--tag" }, [
        d.h("span", { class: "tagchip", style: { "--tc": item.color || "#b9b9c0" } }, item.name),
      ]);
    }
    var a = ART[item.id] || ["ring", "#b9b9c0"];
    var box = d.h("div", { class: "sc-art art--" + a[0], style: { "--c": a[1] }, "aria-hidden": "true" });
    for (var i = 1; i <= 4; i++) box.appendChild(d.h("span", { class: "ar ar-" + i }));
    return box;
  }

  /* ---------- a card ---------- */
  function card(item) {
    var owned = N.econ.isUnlocked("fx", item.id);

    var buy = d.h(
      "button",
      { type: "button", class: "bt bt--sm sc-buy" + (owned ? " is-owned" : "") },
      owned
        ? [N.icons.svg("unlock", 14), d.h("span", null, "Unlocked")]
        : [N.icons.svg("lock", 14), d.h("span", null, "Locked")],
    );

    buy.addEventListener("click", function () {
      if (owned) return;
      var res = N.econ.buy("fx", item.id);
      if (res.ok) {
        owned = true;
        d.toast("Unlocked " + item.name, { icon: "check" });
        paint();
      } else if (res.reason === "not enough coins") {
        d.toast("Not enough coins yet. Play a game and come back.", { type: "err" });
      } else {
        d.toast("That did not go through: " + res.reason, { type: "err" });
      }
    });

    var gift = d.h(
      "button",
      { type: "button", class: "bt bt--sm bt--icon sc-gift", title: "Gift this", "aria-label": "Gift " + item.name },
      [N.icons.svg("gift", 15)],
    );
    gift.addEventListener("click", function () {
      giftItem(item);
    });

    return d.h("article", { class: "sc" + (owned ? " sc--owned" : "") }, [
      art(item),
      d.h("h3", { class: "sc-n" }, item.name),
      d.h("p", { class: "sc-d" }, item.desc || ""),
      d.h("div", { class: "sc-foot" }, [
        d.h("span", { class: "sc-price" }, [
          N.icons.svg("coin", 15),
          d.h("b", null, String(item.price)),
          item.was ? d.h("s", null, String(item.was)) : null,
        ]),
        d.h("span", { class: "sc-act" }, [gift, buy]),
      ]),
    ]);
  }

  /* ---------- gift codes ----------
     A code carries the amount and a short check, so the friend can type it
     on their own copy. There is no server behind NULL, so this redeems
     anywhere the code is typed: the check only stops typos, it is not a
     signature. See the note in the README. */
  function makeCode(coins) {
    var body = coins.toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    return "NULL-" + body;
  }

  function decodeCode(code) {
    var m = /^NULL-([0-9A-Z]+)-[0-9A-Z]{4}$/.exec(String(code || "").trim().toUpperCase());
    if (!m) return 0;
    var n = parseInt(m[1], 36);
    return isFinite(n) && n > 0 && n <= 100000 ? n : 0;
  }

  function sheet(opts) {
    var box = d.h("div", { class: "sh" }, [
      d.h("div", { class: "sh-head" }, [
        d.h("span", { class: "sh-ic" }, [N.icons.svg(opts.icon, 20)]),
        d.h("h2", null, opts.title),
        d.h("button", { type: "button", class: "bt bt--x", "aria-label": "Close", onclick: close }, [N.icons.svg("x", 18)]),
      ]),
      opts.body,
      opts.foot || null,
    ]);
    var ov = d.h("div", { class: "sh-ov", role: "dialog", "aria-modal": "true", "aria-label": opts.title }, [box]);
    ov.addEventListener("mousedown", function (e) {
      if (e.target === ov) close();
    });
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    function close() {
      document.removeEventListener("keydown", onKey);
      ov.remove();
    }
    document.addEventListener("keydown", onKey);
    document.body.appendChild(ov);
    return { close: close };
  }

  /* the purse's own button: a code worth what you want to give */
  function giftCoins() {
    var amount = d.h("input", { type: "number", min: "1", max: "100000", value: "100", "aria-label": "Coins to give" });
    var out = d.h("div", { class: "fld", style: { fontFamily: "var(--font-mono)" } });
    var note = d.h("p", { class: "sh-note" }, "A one time code. Give it to a friend and they redeem it from the same button.");

    function roll() {
      var n = Math.max(1, Math.min(100000, Number(amount.value) || 0));
      out.textContent = makeCode(n);
    }
    amount.addEventListener("input", roll);
    roll();

    var body = d.h("div", null, [
      d.h("label", { class: "sh-field" }, [d.h("span", null, "How many coins"), d.h("span", { class: "fld" }, [amount])]),
      d.h("label", { class: "sh-field" }, [d.h("span", null, "Your code"), out]),
      note,
    ]);

    var s = sheet({
      title: "Gift coins",
      icon: "gift",
      body: body,
      foot: d.h("div", { class: "sh-foot" }, [
        d.h(
          "button",
          {
            type: "button",
            class: "bt",
            onclick: function () {
              var text = out.textContent;
              if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () {
                d.toast("Code copied", { icon: "check" });
              });
              else d.toast(text, { icon: "gift" });
            },
          },
          "Copy code",
        ),
        d.h("button", { type: "button", class: "bt bt--fill", onclick: function () { s.close(); redeemSheet(); } }, "Redeem one"),
      ]),
    });
  }

  function redeemSheet() {
    var input = d.h("input", { type: "text", placeholder: "NULL-XXXX-XXXX", autocomplete: "off", spellcheck: "false" });
    var note = d.h("p", { class: "sh-note" }, "Type a code someone gave you.");
    var s = sheet({
      title: "Redeem a code",
      icon: "gift",
      body: d.h("label", { class: "sh-field" }, [d.h("span", null, "Code"), d.h("span", { class: "fld" }, [input]), note]),
      foot: d.h("div", { class: "sh-foot" }, [
        d.h("button", { type: "button", class: "bt bt--fill", onclick: claim }, "Redeem"),
      ]),
    });

    function claim() {
      var code = String(input.value || "").trim().toUpperCase();
      var used = N.store.read("null:giftUsed", []);
      if (used.indexOf(code) >= 0) {
        note.textContent = "That code has already been used.";
        return;
      }
      var n = decodeCode(code);
      if (!n) {
        note.textContent = "That does not look like a NULL code.";
        return;
      }
      used.push(code);
      N.store.write("null:giftUsed", used);
      N.econ.giveCoins(n);
      s.close();
      paint();
      d.toast("+" + n + " coins", { icon: "coin" });
    }
  }

  /* gifting an item: same deal, wrapped around the item's own price */
  function giftItem(item) {
    var code = "NULL-" + item.id.toUpperCase().slice(0, 8) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    sheet({
      title: "Gift " + item.name,
      icon: "gift",
      body: d.h("div", null, [
        d.h("p", { class: "sh-note" }, "A one time code for this item. Whoever redeems it gets it unlocked."),
        d.h("div", { class: "fld", style: { marginTop: "12px", fontFamily: "var(--font-mono)" } }, code),
      ]),
    });
  }

  /* ---------- drawing ---------- */
  function paint() {
    var n = d.qs("#coinN");
    if (n) n.textContent = String(N.econ.state().coins);

    var host = d.qs("#shopBody");
    if (!host) return;
    host.textContent = "";

    var items = N.econ.COSMETICS || [];
    SHELVES.forEach(function (shelf) {
      var mine = items.filter(function (i) {
        return i.kind === shelf.kind;
      });
      if (!mine.length) return;
      host.appendChild(
        d.h("section", { class: "shop-sec" }, [
          d.h("div", { class: "shop-head" }, [
            d.h("span", { class: "shop-ic" }, [N.icons.svg(shelf.icon, 18)]),
            d.h("div", null, [
              d.h("h2", null, shelf.title),
              d.h("p", null, shelf.sub),
            ]),
          ]),
          d.h("div", { class: "sc-grid" }, mine.map(card)),
        ]),
      );
    });

    /* the older functional unlocks (custom accent, background image, the
       theme editor). They still need a shelf to be bought from. */
    var extras = (N.econ.FX || []).filter(function (i) {
      return !i.kind;
    });
    if (extras.length) {
      host.appendChild(
        d.h("section", { class: "shop-sec" }, [
          d.h("div", { class: "shop-head" }, [
            d.h("span", { class: "shop-ic" }, [N.icons.svg("wrench", 18)]),
            d.h("div", null, [
              d.h("h2", null, "Site extras"),
              d.h("p", null, "Settings-level unlocks rather than cosmetics."),
            ]),
          ]),
          d.h("div", { class: "sc-grid" }, extras.map(card)),
        ]),
      );
    }
  }

  function init() {
    if (N.icons) N.icons.paint();
    var g = d.qs("#giftBtn");
    if (g) g.addEventListener("click", giftCoins);
    N.bus.on("eco", paint);
    paint();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
