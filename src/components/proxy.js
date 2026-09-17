/* NULL · proxy.js
   The window that loads somebody else's website inside NULL.

   How the pieces fit together:

     this page  →  Scramjet  →  bare-mux  →  a Wisp relay  →  the site

   Scramjet rewrites the far page's HTML, CSS and JavaScript as they come in,
   so a site that has never heard of NULL runs inside the frame: its links stay
   inside the frame, its requests go back out through the same relay, and the
   address bar above stays ours. bare-mux is the pipe it talks through, and a
   Wisp server is the other end of that pipe — a WebSocket relay that makes the
   cross-origin requests the browser would otherwise refuse.

   That means a relay has to exist somewhere. It cannot live on GitHub Pages,
   which only serves files, so the address of one is a setting: paste in a
   Wisp URL you run or trust, or leave the default. If the relay cannot be
   reached, the window says so in plain words instead of hanging, and the
   address still opens in a real tab from the button beside it. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  /* Everything is loaded from a CDN at run time: NULL ships no build step for
     this, and GitHub Pages cannot host a WebSocket relay anyway. */
  var CDN = {
    scramjet: "https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@1.0.0/dist/",
    baremux: "https://cdn.jsdelivr.net/npm/@mercuryworkshop/bare-mux@2.1.7/dist/",
    epoxy: "https://cdn.jsdelivr.net/npm/@mercuryworkshop/epoxy-transport@2.1.7/dist/index.mjs",
  };

  /* A relay that speaks the Wisp protocol. Ours is a public one people run for
     exactly this; anyone can replace it with their own in the row below. */
  var DEFAULT_WISP = "wss://wisp.mercurywork.shop/";

  var WISP_KEY = "wispUrl";
  var ENG_KEY = "wispEngine";

  function wispUrl() {
    return String(N.prefs.get(WISP_KEY) || DEFAULT_WISP);
  }
  function engine() {
    return N.prefs.get(ENG_KEY) === "uv" ? "uv" : "scramjet";
  }

  /* ---------- turning what somebody typed into a url ---------- */
  function toUrl(raw) {
    var s = String(raw || "").trim();
    if (!s) return null;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s;
    if (/^localhost(:\d+)?(\/|$)/i.test(s)) return "http://" + s;
    if (/^[\w-]+(\.[\w-]+)+(\/|:|$)/.test(s)) return "https://" + s;
    /* a bare word is a search, the way a browser's address bar treats it */
    return "https://duckduckgo.com/?q=" + encodeURIComponent(s);
  }

  /* one load per page: the engine keeps state, and a second boot would fight
     the first for the same service worker */
  var booted = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () {
        reject(new Error("could not load " + src));
      };
      document.head.appendChild(s);
    });
  }

  async function bootScramjet(wisp) {
    if (!window.$scramjetLoad) {
      await loadScript(CDN.scramjet + "scramjet.all.js");
    }
    if (!window.$scramjetLoad) throw new Error("Scramjet did not load");

    /* the transport is what actually reaches the relay */
    var mod = await import(/* @vite-ignore */ CDN.baremux + "index.mjs");
    var conn = new mod.BareMuxConnection(CDN.baremux + "worker.js");
    await conn.setTransport(CDN.epoxy, [{ wisp: wisp }]);

    var loader = window.$scramjetLoad();
    var controller = new loader.ScramjetController({
      files: {
        wasm: CDN.scramjet + "scramjet.wasm.wasm",
        all: CDN.scramjet + "scramjet.all.js",
        sync: CDN.scramjet + "scramjet.sync.js",
      },
    });
    await controller.init();
    return controller;
  }

  async function bootUltraviolet(wisp) {
    /* Ultraviolet is the other MWS engine and the one most public relays were
       built for. It needs its own service worker registered before it can
       rewrite anything, which is why the scope matters here. */
    var mod = await import(/* @vite-ignore */ CDN.baremux + "index.mjs");
    var conn = new mod.BareMuxConnection(CDN.baremux + "worker.js");
    await conn.setTransport(CDN.epoxy, [{ wisp: wisp }]);

    var uv = await import(
      /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.10/dist/uv.bundle.mjs"
    );
    if (!uv.default || !uv.default.prototype) throw new Error("Ultraviolet did not load");
    return { ultraviolet: uv.default };
  }

  /* ---------- the window ---------- */
  var ui = null;

  function build(host) {
    var input = d.h("input", {
      type: "text",
      placeholder: "example.com — press enter",
      spellcheck: "false",
      autocomplete: "off",
      "aria-label": "Address",
    });
    var go = d.h("button", { type: "button", class: "pw-go" }, [N.icons.svg("globe", 16), "Go"]);
    var bar = d.h("form", { class: "pw-bar" }, [
      d.h("span", { class: "pw-scheme" }, [N.icons.svg("shield", 14), "wisp"]),
      input,
      go,
    ]);

    var frame = d.h("iframe", {
      src: "about:blank",
      title: "Proxied page",
      allow: "clipboard-read; clipboard-write; fullscreen; autoplay",
    });

    var idleText = d.h("div", { class: "pw-idle" }, [
      d.h("b", null, "Nothing loaded yet"),
      d.h("span", null, "Type an address above. It loads inside NULL — the far site's links, images and requests all come back through the relay, so the page you are on stays the page you are on."),
    ]);
    var frameWrap = d.h("div", { class: "pw-frame" }, [frame, idleText]);

    var err = d.h("div", { class: "pw-err", hidden: true });

    /* the relay, and which engine talks to it */
    var wispIn = d.h("input", { type: "text", value: wispUrl(), spellcheck: "false", "aria-label": "Wisp relay" });
    wispIn.addEventListener("change", function () {
      N.prefs.set(WISP_KEY, wispIn.value.trim() || DEFAULT_WISP);
      booted = null;
      d.toast("Relay set — the next address uses it", { icon: "wifi" });
    });

    var engIn = d.h("select", { "aria-label": "Engine" }, []);
    [
      { v: "scramjet", t: "Scramjet" },
      { v: "uv", t: "Ultraviolet" },
    ].forEach(function (o) {
      engIn.appendChild(d.h("option", { value: o.v, selected: engine() === o.v }, o.t));
    });
    engIn.addEventListener("change", function () {
      N.prefs.set(ENG_KEY, engIn.value);
      booted = null;
    });

    var rows = d.h("div", { class: "pw-rows" }, [
      d.h("div", { class: "pw-row" }, [
        d.h("div", { class: "pw-row-t" }, [
          d.h("b", null, "Wisp relay"),
          d.h("span", null, "The WebSocket server that makes the cross-origin requests. Swap it for your own."),
        ]),
        wispIn,
      ]),
      d.h("div", { class: "pw-row" }, [
        d.h("div", { class: "pw-row-t" }, [
          d.h("b", null, "Engine"),
          d.h("span", null, "Both rewrite the far page. Scramjet is the newer one."),
        ]),
        engIn,
      ]),
    ]);

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
    }

    async function open(raw) {
      var url = toUrl(raw);
      if (!url) return;
      err.hidden = true;
      idleText.hidden = true;
      go.disabled = true;

      try {
        if (!booted) {
          booted =
            engine() === "uv" ? await bootUltraviolet(wispUrl()) : await bootScramjet(wispUrl());
        }
        if (booted.go || booted.createFrame) {
          var f = booted.createFrame(frame) || { go: function (u) { frame.src = u; } };
          f.go(url);
        } else if (booted.ultraviolet) {
          /* Ultraviolet's classic shape: the frame just needs the rewritten
             address, and the service worker in this origin does the rest */
          frame.src = "/uv/service/" + url.replace(/^https?:\/\//, "");
        }
        var v = d.qs(".pw-visit", host);
        if (v) v.textContent = url;
      } catch (e) {
        fail(
          "The proxy could not start: " +
            ((e && e.message) || e) +
            ". A Wisp relay has to be reachable for this to work — check the relay address below, or open " +
            url +
            " in a normal tab.",
        );
      } finally {
        go.disabled = false;
      }
    }

    bar.addEventListener("submit", function (e) {
      e.preventDefault();
      open(input.value);
    });

    var outBtn = d.h("button", { type: "button", class: "bt", onclick: function () {
      var u = toUrl(input.value);
      if (u) window.open(u, "_blank", "noopener");
    } }, [N.icons.svg("ext", 15), "Open in a real tab"]);

    ui = { open: open, input: input };
    host.appendChild(d.h("div", { class: "pw" }, [bar, err, frameWrap, rows, d.h("div", { class: "st-acts" }, [outBtn])]));
    return ui;
  }

  N.proxy = {
    mount: build,
    open: function (url) {
      if (ui) ui.open(url);
    },
    toUrl: toUrl,
    defaultWisp: DEFAULT_WISP,
  };
})();
