/* NULL · settings-sheet.js
   Settings, as a sheet over whatever page you are on.

   It used to be a page of its own, which meant leaving wherever you were to
   change a colour and then finding your way back. Now the sliders door in the
   rail opens this instead: heavy blur behind, a panel with three sections
   down the side, and the page you were reading still underneath.

   Three sections, and no more:
     appearance    theme, navigation, effects
     data          what NULL keeps in this browser, and how to take it with you
     privacy & tos the plain-language paperwork, with the two documents the
                   section is named after switching behind one button pair

   `/settings` still exists as an address: the page there opens this sheet on
   load and sends you home when you close it, so a bookmark keeps working. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  /* ---------- the paperwork ----------
     Short, honest, written by a person. Two documents live behind the
     privacy & tos button: the visitor's side, and NULL's. */
  var DOCS = {
    privacy: {
      t: "Privacy",
      lead: "NULL has no server to send anything to. That is the whole policy.",
      body: [
        "Everything you do here — coins, your profile, favourites, extensions, that half-finished save — is written to this browser's own storage. It stays on this device. Nobody at NULL can see it, because there is nowhere for it to arrive.",
        "There is no analytics script, no tracker, no cookie set by us, and no account server. If you clear your browser data, it is gone, and there is no copy to restore from.",
        "Games and apps in the library are made by other people, and some of them load files from outside NULL. Those load exactly as they would if you opened them anywhere else.",
        "The proxy window is the one place NULL talks to something outside the page: it reaches the site you asked for through a relay, which means that relay can see which addresses you request. It sees the address, not your storage.",
      ],
    },
    terms: {
      t: "Terms",
      lead: "Use it, don't abuse it, and don't expect a warranty.",
      body: [
        "NULL is a hub. Most of what you play here was written by somebody else, and it stays theirs. Nothing in NULL gives you a licence to that work, and nothing here is sold to you.",
        "Don't use NULL to break a rule you agreed to elsewhere — a school network's policy, a site's terms, the law. That is on you, not on the site.",
        "The library is a set of links and folders. If something here is yours and you want it gone, it can be taken out.",
        "Nothing is guaranteed. NULL may be down, a save may not last, a game may never load. It is offered as it is, with no warranty of any kind.",
      ],
    },
    cookies: {
      t: "Cookies",
      lead: "NULL sets no cookies. Not one.",
      body: [
        "The little bit of memory NULL has lives in localStorage, not in cookies: your theme, your coins, your preferences, the tabs you have open. It only travels to pages on this site, and it never leaves your browser.",
        "The service worker caches the site's own files so NULL opens offline. That cache holds files, not information about you.",
        "Clear your browser data and all of it goes. Nothing breaks permanently — you start over with an empty profile.",
      ],
    },
  };

  /* ---------- appearance ---------- */

  function themeGrid() {
    var current = N.prefs.get("palette") || "null";
    var row = d.h("div", { class: "pal-row" });
    N.theme.palettes.forEach(function (p) {
      var on = p.id === current;
      var sw = d.h("span", { class: "pal-sw", style: { background: p.bg } }, [
        d.h("span", { class: "pal-bar", style: { background: p.fg } }),
      ]);
      var b = d.h("button", { type: "button", class: "pal" + (on ? " on" : ""), "aria-pressed": on ? "true" : "false" }, [
        sw,
        d.h("span", { class: "pal-n" }, p.t),
      ]);
      b.addEventListener("click", function () {
        /* setPalette paints it; the pref is what makes it stick */
        N.prefs.set("palette", p.id);
        N.theme.setPalette(p.id);
        redraw();
      });
      row.appendChild(b);
    });
    return row;
  }

  /* a plain on/off row: label, one line about it, and a switch on the right */
  function toggle(title, desc, on, onChange) {
    var sw = d.h("input", { type: "checkbox", checked: !!on, "aria-label": title });
    sw.addEventListener("change", function () {
      onChange(sw.checked);
    });
    return d.h("div", { class: "st-row" }, [
      d.h("div", { class: "st-row-t" }, [d.h("b", null, title), d.h("span", null, desc)]),
      d.h("label", { class: "switch" }, [sw, d.h("span", { class: "track" })]),
    ]);
  }

  function secAppearance() {
    var wrap = d.h("div", { class: "st-sec" });
    wrap.appendChild(d.h("h2", { class: "st-h" }, "Theme"));
    wrap.appendChild(
      d.h("p", { class: "st-lead" }, "Sixteen whole colour schemes. Every page, the rail, the sheets and the tabs all read from the one you pick."),
    );
    wrap.appendChild(themeGrid());

    wrap.appendChild(d.h("h2", { class: "st-h", style: { marginTop: "34px" } }, "Effects"));
    var fx = d.h("div", { class: "st-pane" });
    fx.appendChild(
      toggle("Performance mode", "Turns off hover effects, glow and heavy shadows.", N.prefs.get("perf") === "1" || N.prefs.get("perf") === "ultra", function (on) {
        N.prefs.set("perf", on ? "1" : "");
        N.theme.setPerf(on ? "1" : "");
      }),
    );
    fx.appendChild(
      toggle("Ultra mode", "Drops every animation and particle. The plainest, fastest NULL.", N.prefs.get("perf") === "ultra", function (on) {
        N.prefs.set("perf", on ? "ultra" : "");
        N.theme.setPerf(on ? "ultra" : "");
      }),
    );
    wrap.appendChild(fx);
    return wrap;
  }

  /* ---------- data ---------- */
  function nullKeys() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("null:") === 0) out.push(k);
    }
    return out.sort();
  }

  function sizeOf(keys) {
    var n = 0;
    keys.forEach(function (k) {
      n += (localStorage.getItem(k) || "").length;
    });
    return n < 1024 ? n + " B" : (n / 1024).toFixed(1) + " KB";
  }

  function secData() {
    var keys = nullKeys();
    var wrap = d.h("div", { class: "st-sec" });
    wrap.appendChild(d.h("h2", { class: "st-h" }, "On this device"));
    wrap.appendChild(
      d.h("p", { class: "st-lead" }, "Everything NULL knows about you lives here: " + keys.length + " entries, " + sizeOf(keys) + " in total. None of it has ever been sent anywhere."),
    );

    var list = d.h("div", { class: "st-list" });
    keys.forEach(function (k) {
      var raw = localStorage.getItem(k) || "";
      list.appendChild(
        d.h("div", { class: "st-key" }, [
          d.h("code", null, k.replace(/^null:/, "")),
          d.h("span", null, raw.length < 1024 ? raw.length + " B" : (raw.length / 1024).toFixed(1) + " KB"),
        ]),
      );
    });
    wrap.appendChild(list);

    var acts = d.h("div", { class: "st-acts" });
    acts.appendChild(
      d.h("button", { type: "button", class: "bt", onclick: exportAll }, [N.icons.svg("download", 15), "Back up to a file"]),
    );
    acts.appendChild(
      d.h("button", { type: "button", class: "bt", onclick: importAll }, [N.icons.svg("upload", 15), "Restore from a file"]),
    );
    acts.appendChild(
      d.h("button", { type: "button", class: "bt bt--danger", onclick: wipe }, [N.icons.svg("trash", 15), "Clear everything"]),
    );
    wrap.appendChild(acts);
    wrap.appendChild(
      d.h("p", { class: "st-note" }, "Clearing removes your coins, profile, favourites, extensions and preferences from this browser. There is no copy anywhere else, so back up first if you care about it."),
    );
    return wrap;
  }

  function exportAll() {
    var bag = {};
    nullKeys().forEach(function (k) {
      bag[k] = localStorage.getItem(k);
    });
    var blob = new Blob([JSON.stringify({ null: 1, at: Date.now(), data: bag }, null, 2)], {
      type: "application/json",
    });
    var a = d.h("a", { href: URL.createObjectURL(blob), download: "null-backup.json" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    d.toast("Backed up " + nullKeys().length + " entries", { icon: "download" });
  }

  function importAll() {
    var input = d.h("input", { type: "file", accept: ".json,application/json", hidden: true });
    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var bag = JSON.parse(String(r.result));
          var data = bag && bag.data ? bag.data : bag;
          if (!data || typeof data !== "object") throw new Error("no data");
          Object.keys(data).forEach(function (k) {
            if (k.indexOf("null:") !== 0) return;
            localStorage.setItem(k, String(data[k]));
          });
          d.toast("Restored — reloading", { icon: "upload" });
          setTimeout(function () {
            location.reload();
          }, 700);
        } catch (err) {
          d.toast("That is not a NULL backup", { type: "err" });
        }
      };
      r.readAsText(f);
    });
    document.body.appendChild(input);
    input.click();
  }

  function wipe() {
    N.modal.confirm({
      title: "Clear everything?",
      icon: "trash",
      iconTone: "danger",
      body: "<p>Every NULL entry in this browser goes: coins, profile, favourites, extensions and their storage, preferences, tabs.</p><p>This cannot be undone.</p>",
      okLabel: "Clear it all",
      onOk: function () {
        nullKeys().forEach(function (k) {
          localStorage.removeItem(k);
        });
        sessionStorage.clear();
        location.href = N.url("/");
      },
    });
  }

  /* ---------- privacy & tos ---------- */
  function secLegal(which) {
    var doc = DOCS[which] || DOCS.privacy;
    var wrap = d.h("div", { class: "st-sec" });
    wrap.appendChild(d.h("div", { class: "st-pick" }, [
      d.h("button", { type: "button", class: "st-pick-b" + (which === "privacy" ? " on" : ""), onclick: function () { redraw("legal:privacy"); } }, "Privacy"),
      d.h("button", { type: "button", class: "st-pick-b" + (which === "terms" ? " on" : ""), onclick: function () { redraw("legal:terms"); } }, "Terms"),
      d.h("button", { type: "button", class: "st-pick-b" + (which === "cookies" ? " on" : ""), onclick: function () { redraw("legal:cookies"); } }, "Cookies"),
    ]));
    wrap.appendChild(d.h("h2", { class: "st-h" }, doc.t));
    wrap.appendChild(d.h("p", { class: "st-lead" }, doc.lead));
    doc.body.forEach(function (p) {
      wrap.appendChild(d.h("p", { class: "st-p" }, p));
    });
    return wrap;
  }

  /* ---------- the sheet ---------- */
  var SECTIONS = [
    { id: "appearance", t: "Appearance", icon: "palette" },
    { id: "data", t: "Data", icon: "save" },
    { id: "legal", t: "Privacy & ToS", icon: "shield" },
  ];

  var open = null;
  var at = "appearance";
  var legalAt = "privacy";

  function redraw(next) {
    if (next && next.indexOf("legal:") === 0) legalAt = next.slice(6);
    if (!open) return;
    open.body.textContent = "";
    if (at === "appearance") open.body.appendChild(secAppearance());
    else if (at === "data") open.body.appendChild(secData());
    else open.body.appendChild(secLegal(legalAt));
    open.body.scrollTop = 0;
    Array.prototype.forEach.call(open.rail.children, function (b) {
      b.classList.toggle("on", b.dataset.sec === at);
    });
  }

  function show(section) {
    at = section || at;
    if (open) {
      redraw();
      return open;
    }

    var side = d.h("div", { class: "st-side" });
    SECTIONS.forEach(function (s) {
      var b = d.h("button", { type: "button", class: "st-side-b", "data-sec": s.id, onclick: function () { at = s.id; redraw(); } }, [
        d.h("span", { class: "st-side-ic" }, [N.icons.svg(s.icon, 17)]),
        d.h("span", null, s.t),
      ]);
      side.appendChild(b);
    });
    side.appendChild(d.h("div", { class: "st-side-foot" }, "null · v1.0.0"));

    var body = d.h("div", { class: "st-body" });

    var box = d.h("div", { class: "st", role: "dialog", "aria-modal": "true", "aria-label": "Settings" }, [
      side,
      d.h("div", { class: "st-main" }, [
        d.h("div", { class: "st-top" }, [
          d.h("b", null, "Settings"),
          d.h("button", { type: "button", class: "tb2-x tb2-x--bare", "aria-label": "Close settings", onclick: hide }, [
            N.icons.svg("x", 18),
          ]),
        ]),
        body,
      ]),
    ]);

    var ov = d.h("div", { class: "st-ov", id: "stOv" }, [box]);
    ov.addEventListener("mousedown", function (e) {
      if (e.target === ov) hide();
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(ov);
    document.body.classList.add("st-open");

    open = { ov: ov, body: body, rail: side };
    redraw();
    var first = box.querySelector(".st-side-b");
    if (first) first.focus();
    return open;
  }

  function onKey(e) {
    if (e.key === "Escape" && open) hide();
  }

  function hide() {
    if (!open) return;
    document.removeEventListener("keydown", onKey);
    open.ov.remove();
    document.body.classList.remove("st-open");
    open = null;
    if (document.body.dataset.stRedirect) location.href = document.body.dataset.stRedirect;
  }

  /* Every way in: the rail's sliders door, anything that asks for it with
     data-open-settings, and the /settings page itself on load. */
  document.addEventListener("click", function (e) {
    var hit = e.target.closest && e.target.closest("[data-open-settings], .ril[data-id='settings'], a[href$='/settings'], a[href$='/settings.html']");
    if (!hit) return;
    if (hit.target === "_blank") return;
    e.preventDefault();
    show();
  });

  N.settingsSheet = { open: show, close: hide, isOpen: function () { return !!open; } };

  if (document.body && document.body.classList.contains("settings-page")) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { show(); });
    else show();
  }
})();
