/* NULL · extensions.js
   The extensions manager.

   Four blocks: what you have installed, the views your extensions added,
   the two ways in (.nullext and a Chrome folder), and the file format itself
   so nobody has to guess. Every list is rebuilt from N.ext.list(), so the
   page, the nav menu and /root can never drift apart. */
(function () {
  var N = window.N;
  var d = N.dom;

  var host = d.qs("#extBody");
  var pageHost = d.qs("#extPages");
  var installHost = d.qs("#extInstall");
  var docHost = d.qs("#extDocs");

  function size(str) {
    var n = String(str || "").length;
    return n < 1024 ? n + " B" : (n / 1024).toFixed(1) + " KB";
  }

  function btn(label, icon, cls, onClick) {
    return d.h("button", { type: "button", class: "btn " + (cls || "btn-outline") + " btn-sm", onclick: onClick }, [
      d.icon(icon),
      label,
    ]);
  }

  /* ---------- installed ---------- */
  function card(e) {
    var native = e.kind !== "chrome";
    var el = d.h("div", { class: "ext-card glass" + (e.enabled === false ? " off" : ""), "data-ext": e.id });

    el.appendChild(
      d.h("div", { class: "ec-head" }, [
        d.h("span", { class: "ec-ic" }, [d.icon(e.icon || (native ? "code" : "puzzle"))]),
        d.h("div", { class: "ec-txt" }, [
          d.h("b", null, e.name),
          d.h("span", { class: "ec-meta" }, [
            d.h("i", { class: "ec-badge " + (native ? "full" : "pop") }, native ? "full access" : "popup only"),
            " v" + (e.version || "1.0.0") + (e.author ? " · " + e.author : ""),
          ]),
        ]),
      ]),
    );

    el.appendChild(d.h("p", { class: "ec-desc" }, e.desc || (native ? "A native NULL extension." : "An imported Chrome popup.")));

    var acts = d.h("div", { class: "ec-acts" });
    var sw = d.h("input", { type: "checkbox", checked: e.enabled !== false, "aria-label": "Enabled" });
    sw.addEventListener("change", function () {
      if (sw.checked) N.ext.enable(e.id);
      else N.ext.disable(e.id);
      d.toast((sw.checked ? "Enabled " : "Disabled ") + e.name, { icon: sw.checked ? "check" : "x" });
      paint();
    });
    acts.appendChild(d.h("label", { class: "switch", title: "On or off" }, [sw, d.h("span", { class: "track" })]));

    if (native) {
      acts.appendChild(
        btn("Run again", "play", "btn-outline", function () {
          N.ext.enable(e.id);
          d.toast("Ran " + e.name, { icon: "check" });
        }),
      );
    } else {
      acts.appendChild(
        btn("Open popup", "puzzle", "btn-primary", function () {
          N.ext.openPopup(e.id);
        }),
      );
    }
    acts.appendChild(
      btn("Remove", "trash", "btn-outline-danger", function () {
        N.modal.confirm({
          title: "Remove " + e.name + "?",
          icon: "trash",
          iconTone: "danger",
          body: native
            ? "<p>It stops running on every page and its own storage goes with it. Anything it changed in NULL (coins, unlocks, preferences) stays as it is.</p>"
            : "<p>The imported files and the popup's own storage are deleted. Nothing else is touched.</p>",
          okLabel: "Remove it",
          onOk: function () {
            N.ext.remove(e.id);
            d.toast("Removed " + e.name);
            paint();
          },
        });
      }),
    );
    el.appendChild(acts);

    /* what it is made of, in the open, because reading an extension should not
       need a devtools session */
    var files = native
      ? [
          e.css ? "css · " + size(e.css) : null,
          e.js ? "js · " + size(e.js) : null,
        ].filter(Boolean)
      : Object.keys(e.files || {}).concat(Object.keys(e.assets || {}));
    var store = size(JSON.stringify(N.ext.data(e.id) || {}));
    var del = d.h("details", { class: "ec-code" });
    del.appendChild(
      d.h("summary", null, [
        d.icon("code"),
        files.length ? files.length + " file" + (files.length === 1 ? "" : "s") + " · " + store + " stored" : store + " stored",
      ]),
    );
    var pre = d.h("pre");
    pre.textContent = native
      ? (e.css ? "/* css */\n" + e.css + "\n\n" : "") + (e.js ? "/* js */\n" + e.js : "/* nothing to show */")
      : files.map(function (f) {
          return f;
        }).join("\n");
    del.appendChild(pre);
    el.appendChild(del);
    return el;
  }

  function paint() {
    var all = N.ext.list();
    host.textContent = "";
    host.appendChild(
      d.h("h2", { class: "set-h" }, [
        d.icon("puzzle"),
        all.length ? "Installed (" + all.length + ")" : "Installed",
      ]),
    );

    if (!all.length) {
      host.appendChild(
        d.h("div", { class: "ext-empty glass" }, [
          d.icon("puzzle"),
          d.h("b", null, "Nothing installed yet."),
          d.h("span", null, "Drop a .nullext file in below, or import a Chrome popup folder. Neither one is required for NULL to work."),
        ]),
      );
    } else {
      var grid = d.h("div", { class: "ext-grid" });
      all.forEach(function (e) {
        grid.appendChild(card(e));
      });
      host.appendChild(grid);
    }
    paintPages();
  }

  /* ---------- views an extension added ---------- */
  function paintPages() {
    var list = N.ext.pages();
    pageHost.textContent = "";
    if (!list.length) return;
    pageHost.appendChild(d.h("h2", { class: "set-h" }, [d.icon("grid"), "Pages from your extensions"]));
    var box = d.h("div", { class: "ext-pages glass" });
    var stage = d.h("div", { class: "ext-stage" });
    var open = null;
    list.forEach(function (p) {
      box.appendChild(
        d.h(
          "button",
          {
            type: "button",
            class: "chip chip-btn",
            onclick: function () {
              if (open === p) {
                stage.textContent = "";
                open = null;
                return;
              }
              open = p;
              stage.textContent = "";
              stage.appendChild(d.h("div", { class: "ext-stage-head" }, [d.icon(p.icon), p.title]));
              var slot = d.h("div", { class: "ext-slot" });
              stage.appendChild(slot);
              try {
                p.render(slot);
              } catch (err) {
                slot.appendChild(d.h("p", { class: "ext-err" }, "That view threw: " + ((err && err.message) || err)));
              }
            },
          },
          [d.icon(p.icon), p.title],
        ),
      );
    });
    pageHost.appendChild(box);
    pageHost.appendChild(stage);
  }

  /* ---------- installing ---------- */
  function confirmInstall(entry, done) {
    var native = entry.kind === "native";
    N.modal.open({
      title: "Install " + entry.name + "?",
      icon: native ? "puzzle" : "chrome",
      body: native
        ? "<p><b>" + entry.name + "</b>" + (entry.version ? " v" + entry.version : "") + (entry.author ? " by " + entry.author : "") + "</p>" +
          (entry.desc ? "<p style='color:var(--text-2)'>" + entry.desc + "</p>" : "") +
          "<p><b>Full power.</b> A .nullext runs inside NULL with access to your coins, XP, quests, unlocked items, saved data, themes and every page. It is not sandboxed and nothing reviews it. Only install one you wrote or have read.</p>"
        : "<p><b>" + entry.name + "</b>" + (entry.version ? " v" + entry.version : "") + "</p>" +
          "<p>Imported as a <b>popup only</b> extension. Its popup runs sandboxed: it can draw its own window and keep its own storage, and it cannot see NULL or your data. No background script, no tabs, no content scripts.</p>" +
          (entry.popup ? "<p style='color:var(--text-2)'>Popup: " + entry.popup + "</p>" : "<p style='color:var(--bad)'>No popup found in its manifest.</p>"),
      actions: [
        { label: "Cancel", variant: "outline", onClick: function () { done(false); } },
        { label: "Install", variant: "primary", onClick: function () { done(true); } },
      ],
    });
  }

  function take(entry) {
    if (!entry) return;
    confirmInstall(entry, function (ok) {
      if (!ok) return;
      var saved = N.ext.install(entry);
      d.toast("Installed " + saved.name, { icon: "check" });
      paint();
      var el = d.qs('[data-ext="' + saved.id + '"]');
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function installer() {
    installHost.textContent = "";
    installHost.appendChild(d.h("h2", { class: "set-h" }, [d.icon("download"), "Add an extension"]));

    var nulInput = d.h("input", { type: "file", accept: ".nullext,.json,.js,.txt", class: "hider" });
    nulInput.addEventListener("change", function () {
      var f = nulInput.files && nulInput.files[0];
      nulInput.value = "";
      if (!f) return;
      var reader = new FileReader();
      reader.onerror = function () {
        d.toast("Could not read that file.", { type: "err" });
      };
      reader.onload = function () {
        try {
          take(N.ext.parse(String(reader.result), f.name));
        } catch (err) {
          d.toast("That file is not a .nullext: " + ((err && err.message) || err), { type: "err" });
        }
      };
      reader.readAsText(f);
    });

    var chromeInput = d.h("input", { type: "file", multiple: true, webkitdirectory: true, class: "hider" });
    chromeInput.addEventListener("change", function () {
      var files = chromeInput.files;
      chromeInput.value = "";
      if (!files || !files.length) return;
      N.ext.fromFiles(files, function (entry, err) {
        if (err) {
          d.toast(err, { type: "err", hold: 6000 });
          return;
        }
        take(entry);
      });
    });

    var grid = d.h("div", { class: "ext-add" });
    grid.appendChild(
      d.h("div", { class: "ea-card glass" }, [
        d.h("span", { class: "ea-ic" }, [d.icon("puzzle")]),
        d.h("b", null, "A .nullext file"),
        d.h("span", { class: "ea-note" }, "Full power. A JSON manifest with an optional css and js block, or a plain .js file that becomes the code."),
        btn("Choose a file", "upload", "btn-primary", function () {
          nulInput.click();
        }),
      ]),
    );
    grid.appendChild(
      d.h("div", { class: "ea-card glass" }, [
        d.h("span", { class: "ea-ic" }, [d.icon("chrome")]),
        d.h("b", null, "A Chrome extension"),
        d.h("span", { class: "ea-note" }, "Popup only. Pick the extension's folder (or its manifest plus popup files together). Its popup is hosted sandboxed; everything else is ignored."),
        btn("Choose a folder", "upload", "btn-outline", function () {
          chromeInput.click();
        }),
      ]),
    );
    installHost.appendChild(grid);
    installHost.appendChild(nulInput);
    installHost.appendChild(chromeInput);
  }

  /* ---------- the format, and a starter ---------- */
  function starter() {
    return JSON.stringify(
      {
        nullExt: 1,
        name: "My extension",
        version: "1.0.0",
        author: "you",
        desc: "What it does, in one line.",
        icon: "bolt",
        css: "/* injected on every page with the extension on */\n.ext-hello { color: var(--ac-1); }",
        js: [
          "/* Everything in NULL is reachable: N is the whole app, ctx is the",
          "   friendly surface. This runs on every page, after the page mounts. */",
          "ctx.toast(ctx.name + ' loaded');",
          "",
          "/* hooks fire as things happen */",
          "ctx.hook('coins:earn', function (info) {",
          "  ctx.log('coins now', info.total);",
          "});",
          "",
          "/* give yourself something: giveCoins is the public way in */",
          "if (N.econ) N.econ.giveCoins(250);",
          "",
          "/* and add a view, which shows up under Pages from your extensions */",
          "ctx.page({",
          "  title: 'Hello',",
          "  icon: 'star',",
          "  render: function (host) {",
          "    host.appendChild(N.dom.h('p', { class: 'ext-hello' }, 'Hello from an extension.'));",
          "  },",
          "});",
        ].join("\n"),
      },
      null,
      2,
    );
  }

  function download(text, name) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = d.h("a", { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 4000);
  }

  function docs() {
    docHost.textContent = "";
    docHost.appendChild(d.h("h2", { class: "set-h" }, [d.icon("book"), "Writing one"]));

    var read = d.h("details", { class: "ext-doc glass", open: true });
    read.appendChild(
      d.h("summary", null, [d.icon("file"), "The .nullext format"]),
    );
    var pre = d.h("pre", { class: "ext-pre" });
    pre.textContent = starter();
    read.appendChild(pre);
    read.appendChild(
      d.h("div", { class: "ext-doc-acts" }, [
        btn("Download this as a starter", "download", "btn-primary", function () {
          download(starter(), "my-extension.nullext");
        }),
      ]),
    );
    docHost.appendChild(read);

    var reach = d.h("details", { class: "ext-doc glass" });
    reach.appendChild(d.h("summary", null, [d.icon("zap"), "What an extension can reach"]));
    var ul = d.h("ul", { class: "ext-list" });
    [
      "the economy: coins, XP, streaks, every unlock and price",
      "quests, achievements and the daily crate",
      "storage keys, recents, favorites, the whole backup file",
      "theme packs, particles, glow, seasons and the layout",
      "the player, search, the dev console, marathon mode, the screensaver",
      "modals, FX, toasts, hidden pages, the nav and this manager",
      "and the DOM, because it is just a script on the page",
    ].forEach(function (t) {
      ul.appendChild(d.h("li", null, t));
    });
    reach.appendChild(ul);
    reach.appendChild(
      d.h("p", { class: "ext-note" }, "Two dozen systems and one caveat: there is no sandbox. An extension that breaks something is a thing you uninstall, not something NULL can protect you from. That is the trade, and it is the one you asked for."),
    );
    docHost.appendChild(reach);

    var hooks = d.h("details", { class: "ext-doc glass" });
    hooks.appendChild(d.h("summary", null, [d.icon("code"), "Hooks you can listen to"]));
    var hl = d.h("ul", { class: "ext-list cols" });
    (N.ext.EVENTS || []).forEach(function (t) {
      hl.appendChild(d.h("li", null, [d.h("code", null, t.split(" ")[0]), t.split(" ").slice(1).join(" ")]));
    });
    hooks.appendChild(hl);
    hooks.appendChild(
      d.h("p", { class: "ext-note" }, "ctx.hook(name, fn) returns the function, and ctx.unhook(name, fn) takes it off again. The same events are echoed onto N.bus as \"ext:<name>\"."),
    );
    docHost.appendChild(hooks);
  }

  /* ---------- boot ---------- */
  paint();
  installer();
  docs();
  N.bus.on("ext", paint);

  /* #<id> highlights one extension, which is where the nav menu sends you */
  function focusHash() {
    var id = decodeURIComponent((location.hash || "").replace("#", ""));
    if (!id) return;
    var el = d.qs('[data-ext="' + id + '"]');
    if (!el) return;
    el.classList.add("hit");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  focusHash();
  window.addEventListener("hashchange", focusHash);
})();
