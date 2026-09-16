/* NULL · extensions.js
   The extensions manager.

   Five blocks: the two starters NULL ships (install them, or download the
   file), what you have installed, the pages your extensions added, the two
   ways in (.nullext and a Chrome folder), and the manual: a walk through
   everything an extension can draw.
   Every list is rebuilt from N.ext.list(), so the page, the nav menu and
   /root can never drift apart. */
(function () {
  var N = window.N;
  var d = N.dom;

  var host = d.qs("#extBody");
  var startHost = d.qs("#extStart");
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

  /* is the copy this page hands out newer than the one in storage? */
  function newer(a, b) {
    var x = String(a || "0").split(".");
    var y = String(b || "0").split(".");
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      var p = parseInt(x[i], 10) || 0;
      var q = parseInt(y[i], 10) || 0;
      if (p !== q) return p > q;
    }
    return false;
  }

  /* The two starters on this page, parsed once. An installed copy of one is
     offered an Update rather than left to rot: the starters get fixed, and a
     file somebody downloaded last week should not have to be found, deleted
     and picked again by hand. */
  var shippedCache = null;
  function shipped() {
    if (!shippedCache) {
      shippedCache = [
        { text: starter(), file: "focus-timer.nullext" },
        { text: starterPage(), file: "starter-page.nullext" },
      ].map(function (s) {
        s.entry = N.ext.parse(s.text, s.file);
        return s;
      });
    }
    return shippedCache;
  }

  /* a fresh, unclaimed copy of a starter: parsing again matters, because
     installing an entry writes an id onto it */
  function copyOf(s) {
    var e = N.ext.parse(s.text, s.file);
    e.starter = true;
    return e;
  }

  /* which shipped starter is this installed extension an older copy of? */
  function updateFor(e) {
    if (e.kind !== "native") return null;
    return (
      shipped().filter(function (s) {
        return s.entry.name === e.name && newer(s.entry.version, e.version);
      })[0] || null
    );
  }

  /* Is this installed extension still one of the copies NULL handed out,
     rather than something somebody wrote? A starter carries the flag once it
     has been installed from here; a copy that predates the flag is recognised
     by the shape it was written in. An edited starter keeps whatever version
     its author gave it, so it is never silently overwritten: the Update
     button in the Starters block is there for it. */
  var STARTER_NAMES = /^(focus timer|starter page|period clock)$/i;
  function ours(e) {
    if (e.starter) return true;
    if (e.kind !== "native" || !e.manifest || e.manifest.nullExt !== 1) return false;
    if (!STARTER_NAMES.test(e.name)) return false;
    /* a copy somebody put their own name on is theirs, not ours */
    return !e.author || e.author === "you";
  }

  /* Starters NULL handed out once and does not any more. The period clock is
     part of the site itself now, so an unedited copy of it would draw a
     second clock next to the real one: switch it off, say so once, and leave
     it installed so nothing of theirs disappears behind their back. */
  var RETIRED = /^period clock$/i;
  function retireOutdated() {
    var done = [];
    N.ext.list().forEach(function (e) {
      if (e.enabled === false || !RETIRED.test(e.name) || !ours(e)) return;
      N.ext.disable(e.id);
      done.push(e.name);
    });
    return done;
  }

  /* Bring stale starter copies up to date on the spot. This is how a fix to
     a starter reaches a copy somebody installed months ago without them
     finding the file again. Returns what changed, for one toast. */
  function autoUpgrade() {
    var done = [];
    shipped().forEach(function (s) {
      N.ext.list().forEach(function (e) {
        if (e.name !== s.entry.name || !ours(e)) return;
        if (!newer(s.entry.version, e.version)) return;
        var up = copyOf(s);
        up.id = e.id;
        up.enabled = e.enabled;
        N.ext.install(up);
        markGreeted(e.id);
        done.push(up.name + " v" + up.version);
      });
    });
    return done;
  }

  /* ---------- the two starters, front and centre ----------
     These are the copies NULL hands out, so they get the top of the page
     rather than a corner of the manual: one real widget that reads the school
     schedule, and one whole page built from HTML and CSS alone. Install them
     here, download the file to take apart, or watch a stale copy get its
     update. */
  function starterCard(s) {
    var sh = s.entry;
    var have =
      N.ext.list().filter(function (e) {
        return e.name === sh.name && e.kind === "native";
      })[0] || null;
    var fresh = have && newer(sh.version, have.version);

    var card = d.h("article", { class: "start-card glass" + (fresh ? " fresh" : "") });
    card.appendChild(
      d.h("div", { class: "sc-top" }, [
        d.h("span", { class: "sc-ic" }, [d.icon(sh.icon)]),
        d.h("div", { class: "sc-txt" }, [
          d.h("b", null, sh.name),
          d.h("span", { class: "sc-meta" }, [
            d.h("i", { class: "sc-badge " + (fresh ? "up" : have ? "on" : "new") }, fresh ? "update ready" : have ? "installed" : "not installed"),
            "v" + sh.version,
          ]),
        ]),
      ]),
    );
    card.appendChild(d.h("p", { class: "sc-desc" }, sh.desc));
    card.appendChild(
      d.h(
        "ul",
        { class: "sc-points" },
        (sh.pages || [])
          .map(function (p) {
            return p.title;
          })
          .concat(sh.html ? ["its own window"] : [])
          .map(function (t) {
            return d.h("li", null, t);
          }),
      ),
    );

    var acts = d.h("div", { class: "sc-acts" });
    acts.appendChild(
      btn(fresh ? "Update to v" + sh.version : have ? "Install again" : "Install it", "download", "btn-primary", function () {
        take(copyOf(s), have ? have.id : null);
      }),
    );
    acts.appendChild(
      btn("Download .nullext", "file", "btn-outline", function () {
        download(s.text, s.file);
        d.toast("Saved " + s.file, { icon: "download" });
      }),
    );
    card.appendChild(acts);
    return card;
  }

  function paintStarters() {
    if (!startHost) return;
    startHost.textContent = "";
    startHost.appendChild(d.secHead("download", "Starter extensions", "two complete ones, ready to install or download"));
    var grid = d.h("div", { class: "start-grid" });
    shipped().forEach(function (s) {
      grid.appendChild(starterCard(s));
    });
    startHost.appendChild(grid);
    startHost.appendChild(
      d.h("p", { class: "ext-note" }, "Both are ordinary .nullext files: install them from here, or download one, open it in any text editor and change it. Installing the same file again replaces the copy you have."),
    );
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
      /* a newer copy of one of the starters, right there on the card */
      var fresh = updateFor(e);
      if (fresh) {
        acts.appendChild(
          btn("Update to v" + fresh.entry.version, "download", "btn-primary", function () {
            take(copyOf(fresh), e.id);
          }),
        );
      }
      /* a native extension that shipped HTML gets its own window, exactly the
         way an imported Chrome popup does, just without the sandbox */
      if (e.html) {
        acts.appendChild(
          btn("Open window", "max", fresh ? "btn-outline" : "btn-primary", function () {
            N.ext.openHtml(e.id);
          }),
        );
      }
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
          e.html ? "html · " + size(e.html) : null,
          (e.pages || []).length ? (e.pages || []).length + " page" + ((e.pages || []).length === 1 ? "" : "s") : null,
          (e.nav || []).length ? (e.nav || []).length + " nav item" + ((e.nav || []).length === 1 ? "" : "s") : null,
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
      ? (e.css ? "/* css */\n" + e.css + "\n\n" : "") +
        (e.html ? "<!-- html (its own window) -->\n" + e.html + "\n\n" : "") +
        (e.js ? "/* js */\n" + e.js : "/* nothing to show */")
      : files.map(function (f) {
          return f;
        }).join("\n");
    del.appendChild(pre);
    el.appendChild(del);
    return el;
  }

  function paint() {
    var all = N.ext.list();
    paintStarters();
    host.textContent = "";
    host.appendChild(
      d.secHead("puzzle", all.length ? "Installed (" + all.length + ")" : "Installed", "everything you have added to NULL"),
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

  /* ---------- views an extension added ----------
     A page an extension declares is a real page, not a panel in a list:
     opening one takes the whole window under the nav, gets its own address
     (#page=<id>) and its own Back, and renders whatever the extension asked
     for. Close it, or the browser's own back, and you are back here. */
  var pageOpen = null;
  var pageView = null;

  function pageStage() {
    if (pageView && pageView.isConnected) return pageView;
    pageView = d.h("div", { class: "ext-page-view", hidden: true });
    (d.qs("#main") || document.body).appendChild(pageView);
    return pageView;
  }

  function setPageOpen(id) {
    pageOpen = id || null;
    var main = d.qs("#main");
    if (main) main.classList.toggle("ext-page-open", !!id);
    var view = pageStage();
    view.textContent = "";
    view.hidden = !id;
  }

  function closePage(keepHash) {
    setPageOpen(null);
    if (!keepHash && /^#page=/.test(location.hash || "")) {
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch (err) {
        /* an opaque origin (a file:// open, a sandboxed frame) refuses this:
           the page still closes, only the address bar keeps the hash */
        location.hash = "";
      }
    }
    paintPages();
  }

  function openPage(p) {
    setPageOpen(p.id);
    var view = pageStage();
    view.appendChild(
      d.h("div", { class: "epv-head" }, [
        d.h("button", { type: "button", class: "btn btn-outline btn-sm", onclick: function () { closePage(); } }, [
          d.icon("back"),
          "Back",
        ]),
        d.h("span", { class: "epv-ic" }, [d.icon(p.icon)]),
        d.h("span", { class: "epv-txt" }, [
          d.h("b", null, p.title),
          d.h("span", null, p.desc || "Added by " + p.ext),
        ]),
      ]),
    );
    var body = d.h("div", { class: "epv-body" });
    view.appendChild(body);
    try {
      p.render(body);
    } catch (err) {
      body.appendChild(d.h("p", { class: "ext-err" }, "That page threw: " + ((err && err.message) || err)));
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* #page=<id> is the address of one of these pages */
  function syncHash() {
    var m = /^#page=(.+)$/.exec(location.hash || "");
    if (!m) {
      if (pageOpen) closePage(true);
      return;
    }
    var id = decodeURIComponent(m[1]);
    var hit = N.ext.pages().filter(function (p) {
      return p.id === id;
    })[0];
    if (!hit || pageOpen === hit.id) return;
    openPage(hit);
  }

  function paintPages() {
    var list = N.ext.pages();
    if (pageOpen && !list.filter(function (p) { return p.id === pageOpen; }).length) setPageOpen(null);
    pageHost.textContent = "";
    if (!list.length) return;
    pageHost.appendChild(d.secHead("grid", "Pages from your extensions", "each one opens as a full page of its own"));
    var box = d.h("div", { class: "ext-pages glass" });
    list.forEach(function (p) {
      box.appendChild(
        d.h(
          "button",
          {
            type: "button",
            class: "chip chip-btn" + (pageOpen === p.id ? " on" : ""),
            onclick: function () {
              location.hash = "page=" + encodeURIComponent(p.id);
              if (pageOpen !== p.id) openPage(p);
            },
          },
          [d.icon(p.icon), p.title],
        ),
      );
    });
    pageHost.appendChild(box);
  }

  /* ---------- installing ---------- */
  function confirmInstall(entry, done) {
    var native = entry.kind === "native";
    var twin = entry.id ? N.ext.get(entry.id) : null;
    var verb = twin ? "Update" : "Install";
    N.modal.open({
      title: verb + " " + entry.name + "?",
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
        { label: verb, variant: "primary", onClick: function () { done(true); } },
      ],
    });
  }

  /* Installing a file whose name matches something already here replaces it
     instead of stacking a second copy, which is what the manual promises.
     `replaceId` is how the Update button says which entry it is replacing. */
  /* the starters greet once through their own storage, so an update stamps
     that as already said rather than saying hello again */
  function markGreeted(id) {
    var bag = N.ext.data(id) || {};
    if (bag.greeted) return;
    bag.greeted = 1;
    N.ext.dataWrite(id, bag);
  }

  function take(entry, replaceId) {
    if (!entry) return;
    var twin = replaceId
      ? N.ext.get(replaceId)
      : N.ext.list().filter(function (e) {
          return e.name === entry.name && e.kind === entry.kind;
        })[0];
    if (twin) {
      entry.id = twin.id;
      entry.enabled = twin.enabled;
    }
    confirmInstall(entry, function (ok) {
      if (!ok) return;
      var was = !!twin;
      var saved = N.ext.install(entry);
      if (!saved) return;
      /* the starters say hello once, in their own storage. Updating a copy
         somebody installed before this existed is not that hello. */
      if (was) markGreeted(saved.id);
      d.toast((was ? "Updated " : "Installed ") + saved.name, { icon: "check" });
      paint();
      var el = d.qs('[data-ext="' + saved.id + '"]');
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function installer() {
    installHost.textContent = "";
    installHost.appendChild(d.secHead("download", "Add an extension", "a .nullext file, or a Chrome popup folder"));

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
        d.h("span", { class: "ea-note" }, "Full power. A JSON manifest with an optional css and js block, or a plain .js file that becomes the code. Save the starters below and pick one here."),
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

  /* ---------- the two starters ----------
     Working extensions rather than hello worlds, so there is something real
     to read and take apart. The first is the popup shape: a widget in the nav
     plus a window of its own, driven by real HTML and real state. The second
     is one complete page with no JavaScript at all. Both are plain JSON with
     a css block.

     There was a third once, a period clock. It is part of NULL itself now
     (see shell.js), so an unedited copy of it is switched off on sight (see
     retireOutdated) rather than left to draw a second clock in the nav. */
  function starter() {
    return JSON.stringify(
      {
        nullExt: 1,
        name: "Focus timer",
        version: "1.0.0",
        author: "you",
        desc: "A countdown with a window of your own: start, pause, reset, and the time left rides in the nav while you browse.",
        icon: "clock2",
        css: [
          "/* injected on every page this extension runs on */",
          ".ft-chip {",
          "  display: flex;",
          "  align-items: center;",
          "  gap: 7px;",
          "  height: 34px;",
          "  max-width: 100%;",
          "  padding: 0 11px;",
          "  border-radius: 10px;",
          "  border: 1px solid var(--line);",
          "  background: var(--glass-bg-2);",
          "  font-size: 12px;",
          "  font-weight: 600;",
          "  white-space: nowrap;",
          "  overflow: hidden;",
          "}",
          ".ft-dot { width: 7px; height: 7px; border-radius: 99px; background: var(--ac-1); flex: none; }",
          ".ft-txt { overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }",
          "/* in the side rail the words carry data-rail-hide, so NULL drops them",
          "   while the rail is shut and slides them back on hover. Only the pill",
          "   size needs saying here. */",
          "@media (min-width: 560px) {",
          "  html[data-nav=\"side\"] .ft-chip { height: 38px; padding: 0 8px; }",
          "}",
          "/* the extension's own window, mounted by NULL when it opens */",
          ".ft { padding: 2px 2px 6px; }",
          ".ft-time { font-size: 40px; font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }",
          ".ft-row { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 10px; }",
          ".ft-btn {",
          "  padding: 7px 13px;",
          "  border-radius: 10px;",
          "  border: 1px solid var(--line-2);",
          "  background: var(--glass-bg-2);",
          "  color: var(--text);",
          "  font: inherit;",
          "  font-size: 13px;",
          "  font-weight: 600;",
          "  cursor: pointer;",
          "}",
          ".ft-btn:hover { background: var(--glass-bg-3); }",
          ".ft-note { margin: 12px 0 0; font-size: 12.5px; line-height: 1.6; color: var(--text-2); }",
        ].join("\n"),
        html: [
          "<div class=\"ft\">",
          "  <div class=\"ft-time\" data-face>25:00</div>",
          "  <div class=\"ft-row\">",
          "    <button type=\"button\" class=\"ft-btn\" data-act=\"start\">Start</button>",
          "    <button type=\"button\" class=\"ft-btn\" data-act=\"pause\">Pause</button>",
          "    <button type=\"button\" class=\"ft-btn\" data-act=\"reset\">Reset</button>",
          "  </div>",
          "  <div class=\"ft-row\">",
          "    <button type=\"button\" class=\"ft-btn\" data-min=\"5\">5 min</button>",
          "    <button type=\"button\" class=\"ft-btn\" data-min=\"10\">10 min</button>",
          "    <button type=\"button\" class=\"ft-btn\" data-min=\"25\">25 min</button>",
          "  </div>",
          "  <p class=\"ft-note\">Pick a length and hit start. The pill in the nav keeps counting while you browse, and the timer remembers where it was if you close this window.",
          "</div>",
        ].join("\n"),
        js: [
          "/* A .nullext is JavaScript with the run of the site: N is the whole",
          "   app, ctx is the friendly surface. ctx.mount('nav', html) puts your",
          "   own markup into the bar that every page has. */",
          "var box = ctx.mount('nav',",
          "  '<span class=\"ft-chip\"><i class=\"ft-dot\"></i><span class=\"ft-txt\" data-rail-hide>focus</span></span>');",
          "var pill = box ? box.querySelector('.ft-txt') : null;",
          "",
          "/* The timer keeps its state in the extension's own storage, so a",
          "   reload, another page or a closed window never loses the count. */",
          "var store = ctx.store.load();",
          "var len = (store && store.len) || 25 * 60 * 1000;",
          "var left = typeof store.left === 'number' ? store.left : len;",
          "var running = !!store.running;",
          "var at = store.at || 0;",
          "",
          "function save() {",
          "  ctx.store.save({ len: len, left: left, running: running, at: at, greeted: store.greeted });",
          "}",
          "",
          "function fmt(ms) {",
          "  var s = Math.ceil(ms / 1000);",
          "  return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);",
          "}",
          "",
          "/* running stores the moment it started, not a countdown, so the",
          "   number cannot drift when the page is busy or in the background */",
          "function rest() {",
          "  return running ? Math.max(0, left - (Date.now() - at)) : left;",
          "}",
          "",
          "function ring() {",
          "  running = false;",
          "  left = 0;",
          "  save();",
          "  ctx.toast(ctx.name + ': time is up', { icon: 'clock2', hold: 6000 });",
          "  if (N.fx && N.fx.confetti) N.fx.confetti();",
          "}",
          "",
          "function paint() {",
          "  var ms = rest();",
          "  if (running && ms <= 0) ring();",
          "  var t = fmt(ms);",
          "  /* the window is HTML from the manifest, so it is in the document",
          "     only while it is open (see the popup:open hook below) */",
          "  var face = document.querySelector('.ft [data-face]');",
          "  if (face) face.textContent = t;",
          "  /* the pill keeps the count while it matters and gets out of the way",
          "     when the timer is sitting idle at full length */",
          "  if (box) box.hidden = !(running || (left > 0 && left < len));",
          "  if (pill) pill.textContent = t;",
          "}",
          "",
          "function use(ms) {",
          "  len = ms;",
          "  left = ms;",
          "  running = false;",
          "  save();",
          "  paint();",
          "}",
          "",
          "/* buttons in the window. popup:open hands you the element, and the",
          "   window is rebuilt every time it opens, so wiring happens here. */",
          "ctx.hook('popup:open', function (info) {",
          "  var el = info && info.el;",
          "  if (!el) return;",
          "  el.addEventListener('click', function (e) {",
          "    var b = e.target.closest('[data-act], [data-min]');",
          "    if (!b) return;",
          "    if (b.dataset.min) return use(Number(b.dataset.min) * 60000);",
          "    if (b.dataset.act === 'start') { running = true; at = Date.now(); }",
          "    if (b.dataset.act === 'pause') { left = rest(); running = false; }",
          "    if (b.dataset.act === 'reset') { running = false; left = len; }",
          "    save();",
          "    paint();",
          "  });",
          "  paint();",
          "});",
          "",
          "/* once a second, always: the pill is the point of the extension */",
          "setInterval(paint, 1000);",
          "paint();",
          "",
          "/* hooks are how the core tells you things happened, and N is the whole",
          "   site: N.econ, N.theme, N.prefs, storage, the DOM, everything. */",
          "ctx.hook('coins:earn', function (info) {",
          "  ctx.log('coins now', info.total);",
          "});",
          "",
          "/* said once, in the console: a toast here would fire on every page */",
          "if (!store.greeted) {",
          "  store.greeted = 1;",
          "  save();",
          "  ctx.log(ctx.name + ' is ready: open its window from the puzzle menu');",
          "}",
        ].join("\n"),
      },
      null,
      2,
    );
  }

  function starterPage() {
    return JSON.stringify(
      {
        nullExt: 1,
        name: "Starter page",
        version: "1.1.0",
        author: "you",
        desc: "Adds one whole page to NULL: a hero, a stat row and a card grid, drawn by its own CSS.",
        icon: "file",
        css: [
          "/* one namespace, so nothing here can hit another page */",
          ".sp { display: flex; flex-direction: column; gap: 24px; }",
          ".sp-hero {",
          "  padding: clamp(22px, 4vw, 40px);",
          "  border-radius: var(--r-xl);",
          "  border: 1px solid var(--line);",
          "  background:",
          "    radial-gradient(120% 140% at 12% 0%, color-mix(in srgb, var(--ac-1) 16%, transparent), transparent 62%),",
          "    var(--glass-bg);",
          "}",
          ".sp-eyebrow {",
          "  display: inline-block;",
          "  margin-bottom: 10px;",
          "  font-size: 11px;",
          "  font-weight: 700;",
          "  letter-spacing: 0.18em;",
          "  text-transform: uppercase;",
          "  color: var(--text-2);",
          "}",
          ".sp h1 { margin: 0 0 12px; font-size: clamp(26px, 4.6vw, 42px); letter-spacing: -0.03em; }",
          ".sp-lead { max-width: 66ch; margin: 0 0 18px; font-size: 15.5px; line-height: 1.65; color: var(--text-2); }",
          ".sp-cta { display: flex; gap: 10px; flex-wrap: wrap; }",
          ".sp-stats { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }",
          ".sp-stat { padding: 16px 18px; border-radius: var(--r-lg); border: 1px solid var(--line); background: var(--glass-bg-2); }",
          ".sp-stat b { display: block; font-size: 28px; letter-spacing: -0.03em; }",
          ".sp-stat span { font-size: 12.5px; color: var(--text-2); }",
          ".sp-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }",
          ".sp-card { padding: 18px; border-radius: var(--r-lg); border: 1px solid var(--line); background: var(--glass-bg); transition: border-color 0.2s, transform 0.2s; }",
          ".sp-card:hover { border-color: var(--line-2); transform: translateY(-2px); }",
          ".sp-ic {",
          "  display: grid;",
          "  place-items: center;",
          "  width: 32px;",
          "  height: 32px;",
          "  margin-bottom: 12px;",
          "  border-radius: 9px;",
          "  border: 1px solid var(--line-2);",
          "  background: var(--glass-bg-3);",
          "  color: var(--ac-1);",
          "}",
          ".sp-card b { display: block; font-size: 14.5px; margin-bottom: 6px; }",
          ".sp-card p { margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--text-2); }",
          ".sp-note {",
          "  padding: 18px;",
          "  border-radius: var(--r-lg);",
          "  border: 1px solid color-mix(in srgb, var(--ac-1) 30%, var(--line));",
          "  background: color-mix(in srgb, var(--ac-1) 8%, var(--glass-bg));",
          "}",
          ".sp-note p { margin: 6px 0 0; font-size: 13.5px; line-height: 1.6; color: var(--text-2); }",
        ].join("\n"),
        /* pages declared in the manifest are views this extension adds. Each
           one opens as its own full page and deep-links through #page=<id>. */
        pages: [
          {
            id: "home",
            title: "My page",
            icon: "file",
            desc: "A full page built from nothing but HTML and CSS.",
            html: [
              "<div class=\"sp\">",
              "  <header class=\"sp-hero\">",
              "    <span class=\"sp-eyebrow\">a page from an extension</span>",
              "    <h1>Hello from my extension</h1>",
              "    <p class=\"sp-lead\">This whole page is one block of HTML in a .nullext file: no build step, no server, no framework. Write it, drop it in, and it is part of NULL.</p>",
              "    <div class=\"sp-cta\">",
              "      <a class=\"btn btn-primary\" href=\"games/\">Browse games</a>",
              "      <a class=\"btn btn-outline\" href=\"settings\">Open settings</a>",
              "    </div>",
              "  </header>",
              "",
              "  <div class=\"sp-stats\">",
              "    <div class=\"sp-stat\"><b>3</b><span>blocks on this page</span></div>",
              "    <div class=\"sp-stat\"><b>0</b><span>lines of JavaScript</span></div>",
              "    <div class=\"sp-stat\"><b>1</b><span>.nullext file</span></div>",
              "  </div>",
              "",
              "  <div class=\"sp-grid\">",
              "    <div class=\"sp-card\"><span class=\"sp-ic\">◆</span><b>Real HTML</b><p>Headings, lists, tables, buttons. Anything a browser draws, you can put here.</p></div>",
              "    <div class=\"sp-card\"><span class=\"sp-ic\">●</span><b>Your own CSS</b><p>The css block is injected on every page, so your classes work everywhere.</p></div>",
              "    <div class=\"sp-card\"><span class=\"sp-ic\">◇</span><b>The site's tokens</b><p>Use var(--ac-1), var(--glass-bg) and friends and this page follows the theme, the pack and light mode.</p></div>",
              "    <div class=\"sp-card\"><span class=\"sp-ic\">◈</span><b>Zero wiring</b><p>No JavaScript at all. The page is declared in the manifest and mounted when you open it.</p></div>",
              "  </div>",
              "",
              "  <div class=\"sp-note\">",
              "    <b>Where this lives</b>",
              "    <p>Open it from the Pages section on the Extensions page, or deep-link straight to it: the address ends in #page=starter-page:home. Nothing else in NULL had to change.</p>",
              "  </div>",
              "</div>",
            ].join("\n"),
          },
        ],
        js: "ctx.log(ctx.name + ' is ready: its page is in the Pages section above.');",
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

  /* ---------- the manual ---------- */
  function docBox(icon, title, open) {
    var el = d.h("details", { class: "ext-doc glass" });
    if (open) el.setAttribute("open", "");
    el.appendChild(d.h("summary", null, [d.icon(icon), title]));
    return el;
  }
  function codeBlock(text) {
    var p = d.h("pre", { class: "ext-pre" });
    p.textContent = text;
    return p;
  }
  function docList(items, cols) {
    var ul = d.h("ul", { class: "ext-list" + (cols ? " cols" : "") });
    items.forEach(function (t) {
      ul.appendChild(d.h("li", null, t));
    });
    return ul;
  }
  function steps(items) {
    var ol = d.h("ol", { class: "ext-steps" });
    items.forEach(function (t) {
      ol.appendChild(d.h("li", null, t));
    });
    return ol;
  }
  /* one content type: a live sample over the snippet that made it */
  function sample(title, html, code) {
    var box = d.h("div", { class: "ext-ex" });
    box.appendChild(d.h("div", { class: "ext-ex-head" }, title));
    box.appendChild(d.h("div", { class: "ext-ex-demo", html: html }));
    box.appendChild(codeBlock(code));
    return box;
  }
  /* the CSS tokens, each with the swatch that proves it is the real thing */
  function tokenTile(token, label) {
    var sw = d.h("i");
    sw.style.background = "var(" + token + ")";
    return d.h("span", { class: "ext-token" }, [sw, d.h("code", null, token), label]);
  }
  function api(items) {
    var box = d.h("div", { class: "ext-api" });
    items.forEach(function (t) {
      var parts = t.split("  ");
      box.appendChild(d.h("div", null, [d.h("code", null, parts[0]), parts.slice(1).join("  ")]));
    });
    return box;
  }

  function docs() {
    docHost.textContent = "";
    docHost.appendChild(d.secHead("book", "Writing one", "from an empty file to your own page, in full"));

    /* ---------- 1. the walkthrough ---------- */
    var start = docBox("tip", "Start here: your first extension", true);
    start.appendChild(
      d.h("p", { class: "ext-note" }, "You do not need an account, a build step or any tooling. A .nullext is one text file."),
    );
    start.appendChild(
      steps([
        "Open any plain text editor (Notepad, TextEdit, VS Code, anything).",
        "Copy one of the two starters below and paste it in.",
        "Save it with a .nullext ending: my-extension.nullext. If the editor adds .txt, rename it.",
        "Come back here, press Choose a file under A .nullext file, and pick it.",
        "It appears in the list above and in the puzzle menu. That is the whole install.",
      ]),
    );
    start.appendChild(
      d.h("p", { class: "ext-note" }, "To change it, edit the file and install it again with the same name: the new copy replaces the old one. Nothing needs a rebuild, and nothing is uploaded anywhere."),
    );
    start.appendChild(
      d.h("div", { class: "ext-doc-acts" }, [
        btn("Download the focus timer", "download", "btn-primary", function () {
          download(starter(), "focus-timer.nullext");
        }),
        btn("Download the starter page", "download", "btn-outline", function () {
          download(starterPage(), "starter-page.nullext");
        }),
      ]),
    );

    docHost.appendChild(start);

    /* ---------- 2. the format ---------- */
    var read = docBox("file", "The .nullext format");
    read.appendChild(codeBlock(starter()));
    read.appendChild(
      d.h("p", { class: "ext-note" }, "That is the focus timer above, whole. Every field is optional except a name: leave the ones you do not need out."),
    );
    read.appendChild(
      docList([
        "name, version, author, desc: what the manager and the puzzle menu call it.",
        "icon: one of NULL's icon names (clock, grid, file, code, zap, puzzle, star, heart...).",
        "css: text injected as a stylesheet on every page the extension runs on.",
        "js: the code. It runs on every page, and it gets N and ctx in scope.",
        "html: markup for a window of your own, opened from the puzzle menu or its card.",
        "pages: [{ id, title, icon, desc, html }] adds pages, each one a full page of its own.",
        "nav: [{ title, icon, url }] adds links to the puzzle menu.",
        "run: \"always\" (default, runs on every page) or \"manual\" (only when you press Run again).",
      ]),
    );
    read.appendChild(
      d.h("p", { class: "ext-note" }, "A plain .js file works too: pick one at the installer and the whole file becomes the code, with the name taken from the filename. That is the quickest possible extension."),
    );
    docHost.appendChild(read);

    /* the second starter, in full: one whole page and not a line of JS */
    var wholePage = docBox("file", "A whole page, from one file");
    wholePage.appendChild(
      d.h("p", { class: "ext-note" }, "The starter page is the other half of the idea: the pages field adds real pages to NULL, and each one opens full-width with its own address. This file is HTML and CSS only."),
    );
    wholePage.appendChild(codeBlock(starterPage()));
    wholePage.appendChild(
      d.h("div", { class: "ext-doc-acts" }, [
        btn("Download the starter page", "download", "btn-primary", function () {
          download(starterPage(), "starter-page.nullext");
        }),
      ]),
    );
    docHost.appendChild(wholePage);

    /* ---------- 3. the ctx surface ---------- */
    var apiBox = docBox("code", "What ctx gives you");
    apiBox.appendChild(
      d.h("p", { class: "ext-note" }, "N is the entire app and always in scope. ctx is the tidy surface on top of it, so you rarely need to reach further."),
    );
    apiBox.appendChild(
      api([
        "ctx.N  the whole app: every system, exactly as the site uses it",
        "ctx.mount(where, html)  drop your own markup into 'nav', 'footer' or 'extensions'",
        "ctx.slot(where)  the mount point itself, if you would rather build nodes yourself",
        "ctx.css(text)  inject or replace your stylesheet at runtime",
        "ctx.js(code)  run another block of code",
        "ctx.page({title, icon, desc, html, mount})  add a page; mount runs once it is on screen",
        "ctx.hook(name, fn) / ctx.unhook(name, fn)  listen for a core event",
        "ctx.emit(name, data)  fire a hook other extensions can hear",
        "ctx.store.get/set/del/load/save  your own storage, namespaced away from everyone else",
        "ctx.prefs.get(k) / set(k, v)  saved in NULL's preferences, so backups pick them up",
        "ctx.econ  coins, XP, streaks, unlocks. ctx.theme  packs, particles, glow, layout.",
        "ctx.search, ctx.player, ctx.daily, ctx.eggs, ctx.dev, ctx.editor, ctx.modal, ctx.fx",
        "ctx.toast(msg) / ctx.say(title, body)  tell the person something",
        "ctx.log(...)  console.log with your extension's id in front",
        "ctx.unmount()  take back everything you put in the chrome",
      ]),
    );
    docHost.appendChild(apiBox);

    /* ---------- 4. the content types ---------- */
    var looks = docBox("sparkle", "Style: the pieces you can use");
    looks.appendChild(
      d.h("p", { class: "ext-note" }, "NULL's classes are plain CSS, so an extension can use them like anyone else. Every sample below is live: that is the real element, not a picture of one. Press a snippet to read it."),
    );

    looks.appendChild(
      sample(
        "Text",
        "<h1>Big heading</h1><h2>Section heading</h2><p>Body text, at the site's own size and colour. The quieter grey is <code>var(--text-2)</code>.</p>",
        "<h1>Big heading</h1>\n<h2>Section heading</h2>\n<p>Body text.</p>",
      ),
    );
    looks.appendChild(
      sample(
        "Buttons",
        "<button class=\"btn btn-primary\">Primary</button><button class=\"btn btn-outline\">Outline</button><button class=\"btn btn-ghost\">Ghost</button><button class=\"btn btn-outline-danger\">Danger</button><button class=\"btn btn-outline btn-sm\">Small</button>",
        "<button class=\"btn btn-primary\">Primary</button>\n<button class=\"btn btn-outline\">Outline</button>\n<button class=\"btn btn-ghost\">Ghost</button>\n<button class=\"btn btn-outline-danger\">Danger</button>\n<button class=\"btn btn-outline btn-sm\">Small</button>",
      ),
    );
    looks.appendChild(
      sample(
        "Chips and status",
        "<span class=\"chip\">Label</span><span class=\"chip chip-btn\">Clickable</span><span class=\"chip ok\">Ready</span><span class=\"chip warn\">Soon</span><span class=\"chip bad\">Off</span><span class=\"chip accent\">New</span>",
        "<span class=\"chip\">Label</span>\n<span class=\"chip chip-btn\">Clickable</span>\n<span class=\"chip ok\">Ready</span>\n<span class=\"chip warn\">Soon</span>\n<span class=\"chip bad\">Off</span>\n<span class=\"chip accent\">New</span>",
      ),
    );
    looks.appendChild(
      sample(
        "Surfaces",
        "<div class=\"panel\">A panel: glass background, border, rounded corners, padding.</div><div class=\"glass\" style=\"padding:14px 16px;border-radius:var(--r-lg)\">A bare .glass surface, when you want your own padding.</div>",
        "<div class=\"panel\">A panel</div>\n<div class=\"glass\" style=\"padding:14px 16px;border-radius:var(--r-lg)\">A surface</div>",
      ),
    );
    looks.appendChild(
      sample(
        "A field",
        "<span class=\"field\" style=\"width:min(240px,100%)\"><input type=\"text\" placeholder=\"Type something\"></span><span class=\"field\" style=\"width:min(240px,100%)\"><textarea rows=\"2\" placeholder=\"Longer text\"></textarea></span>",
        "<span class=\"field\">\n  <input type=\"text\" placeholder=\"Type something\">\n</span>\n<span class=\"field\">\n  <textarea rows=\"2\" placeholder=\"Longer text\"></textarea>\n</span>",
      ),
    );
    looks.appendChild(
      sample(
        "Code",
        "<code>var x = 1;</code><pre style=\"margin:0;width:100%;padding:12px 14px;border-radius:var(--r-md);border:1px solid var(--line);background:var(--bg);font-size:12px\">function hello() {\n  return 'hi';\n}</pre>",
        "<code>var x = 1;</code>\n\n<pre>function hello() {\n  return 'hi';\n}</pre>",
      ),
    );
    looks.appendChild(
      sample(
        "Lists and a table",
        "<ul style=\"margin:0;line-height:1.8\"><li>First thing</li><li>Second thing</li></ul><table style=\"width:100%;border-collapse:collapse;font-size:13px\"><tr><th style=\"text-align:left;padding:6px 10px;border-bottom:1px solid var(--line)\">Period</th><th style=\"text-align:left;padding:6px 10px;border-bottom:1px solid var(--line)\">Room</th></tr><tr><td style=\"padding:6px 10px\">1</td><td style=\"padding:6px 10px\">B12</td></tr></table>",
        "<ul><li>First thing</li><li>Second thing</li></ul>\n\n<table>\n  <tr><th>Period</th><th>Room</th></tr>\n  <tr><td>1</td><td>B12</td></tr>\n</table>",
      ),
    );
    looks.appendChild(
      sample(
        "A note in a state colour",
        "<div style=\"width:100%;padding:14px 16px;border-radius:var(--r-lg);border:1px solid color-mix(in srgb,var(--ok) 34%,var(--line));background:var(--ok-bg);font-size:13px\">Something went right. Swap --ok for --warn or --bad.</div>",
        "<div class=\"my-note\">Something went right.</div>\n\n.my-note {\n  padding: 14px 16px;\n  border-radius: var(--r-lg);\n  border: 1px solid color-mix(in srgb, var(--ok) 34%, var(--line));\n  background: var(--ok-bg);\n}",
      ),
    );

    looks.appendChild(
      d.h("p", { class: "ext-note" }, "Every colour, border and corner on the site is a token. Use these instead of hard-coded values and your extension follows light mode, the seasonal theme and every shop pack for free."),
    );
    var tiles = d.h("div", { class: "ext-token-grid" });
    [
      ["--bg", "page background"],
      ["--glass-bg", "card surface"],
      ["--glass-bg-2", "second surface"],
      ["--glass-bg-3", "raised chip"],
      ["--line", "hairline border"],
      ["--line-2", "stronger border"],
      ["--text", "body text"],
      ["--text-2", "quieter text"],
      ["--ac-1", "the accent"],
      ["--ac-2", "accent, softer"],
      ["--ok", "good"],
      ["--warn", "careful"],
      ["--bad", "error"],
      ["--r-lg", "corner radius"],
      ["--shadow-1", "soft shadow"],
      ["--ease", "the site's easing"],
    ].forEach(function (t) {
      tiles.appendChild(tokenTile(t[0], t[1]));
    });
    looks.appendChild(tiles);
    docHost.appendChild(looks);

    /* ---------- 5. nav, windows, pages ---------- */
    var htm = docBox("grid", "Nav widgets, windows and pages");
    htm.appendChild(
      docList([
        "ctx.mount('nav', html) drops your own markup into the bar every page has. It is a row in the top bar and a column in the side rail.",
        "In the rail, mark the text with data-rail-hide: NULL drops it while the rail is shut and slides it back on hover, so your widget shrinks to an icon instead of getting sliced.",
        "mount('topbar', html) is the same strip by another name. mount('footer', html) puts it in the footer instead.",
        "html: \"...\" in the manifest is your own window, opened from the puzzle menu or your card here.",
        "ctx.hook('popup:open', fn) fires with the element the moment that window opens, so its code can wire itself up.",
        "pages: [{ id, title, icon, desc, html }] adds whole pages. Each opens as its own full page with a #page=... address you can share.",
        "ctx.page({ html, mount }) is the same thing from code, for a page whose markup needs behaviour behind it.",
        "ctx.slot(where) hands you the mount point itself, if you would rather build the nodes yourself.",
      ]),
    );
    docHost.appendChild(htm);

    /* ---------- 6. reach ---------- */
    var reach = docBox("zap", "What an extension can reach");
    reach.appendChild(
      docList([
        "the economy: coins, XP, streaks, every unlock and price",
        "quests, achievements and the daily crate",
        "storage keys, recents, favorites, the whole backup file",
        "theme packs, particles, glow, seasons and the layout",
        "the player, search, the dev console, the screensaver",
        "modals, FX, toasts, hidden pages, the nav and this manager",
        "the school schedule, so a widget can read the real bell times",
        "and the DOM, because it is just a script on the page",
      ]),
    );
    reach.appendChild(
      d.h("p", { class: "ext-note" }, "Two dozen systems and one caveat: there is no sandbox. An extension that breaks something is a thing you uninstall, not something NULL can protect you from. That is the trade, and it is the one you asked for."),
    );
    docHost.appendChild(reach);

    /* ---------- 7. hooks ---------- */
    var hooks = docBox("code", "Hooks you can listen to");
    var hl = d.h("ul", { class: "ext-list cols" });
    (N.ext.EVENTS || []).forEach(function (t) {
      hl.appendChild(d.h("li", null, [d.h("code", null, t.split(" ")[0]), t.split(" ").slice(1).join(" ")]));
    });
    hooks.appendChild(hl);
    hooks.appendChild(
      d.h("p", { class: "ext-note" }, "ctx.hook(name, fn) returns the function, and ctx.unhook(name, fn) takes it off again. The same events are echoed onto N.bus as \"ext:<name>\"."),
    );
    docHost.appendChild(hooks);

    /* ---------- 8. when it goes wrong ---------- */
    var help = docBox("help", "When something goes wrong");
    help.appendChild(
      docList([
        "Nothing installed: the file probably ends in .txt. Save it again as .nullext and pick it.",
        "A red toast naming your extension: it threw. Read the message, fix that line, install the file again.",
        "Want the full stack: open the dev console (type nldev, password mynameisblob123) and check the console.",
        "Nothing shows up: js runs on page loads, so reload once after installing.",
        "Stuck halfway: keep both starters open next to your file. They are the reference.",
      ]),
    );
    docHost.appendChild(help);
  }

  /* ---------- boot ----------
     A stale copy of a starter is brought up to date before the page is drawn,
     so the card below already says "installed" with no version to chase. The
     starters get fixed; a copy somebody edited is left where it is. */
  var upgraded = autoUpgrade();
  var retired = retireOutdated();
  if (upgraded.length) {
    setTimeout(function () {
      d.toast("Updated " + upgraded.join(", "), { icon: "download", hold: 5200 });
    }, 900);
  }
  if (retired.length) {
    setTimeout(function () {
      d.toast("The period clock is part of NULL now: switched off " + retired.join(", "), { icon: "clock", hold: 6400 });
    }, 1300);
  }
  paint();
  installer();
  docs();
  N.bus.on("ext", function () {
    paint();
    /* a page can be registered at boot, after this script has already run */
    syncHash();
  });

  /* #<id> highlights one extension, which is where the nav menu sends you */
  function focusHash() {
    var id = decodeURIComponent((location.hash || "").replace("#", ""));
    if (!id || /^page=/.test(id)) return;
    var el = d.qs('[data-ext="' + id + '"]');
    if (!el) return;
    el.classList.add("hit");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  focusHash();
  /* pages are registered on boot, so look for #page= just after this runs */
  setTimeout(syncHash, 80);
  window.addEventListener("hashchange", function () {
    focusHash();
    syncHash();
  });
})();
