/* NULL · editor.js
   The theme & particle editor, which the Shop unlocks as one fx item.
   It builds two things and hands them to theme.js to store in null:craft:

     pack  a theme pack: name, four palette colors, a two-color tint, which
           backdrop art to borrow, and up to three kinds of drifting parts
     part  a particle set: name, three part kinds with counts and start
           points, and either its own palette or the site's own colors

   theme.js merges both into allPacks()/allParticles(), so a crafted theme
   previews, applies, and is styled by the exact same code a Shop pack uses.
   The preview here is the live builder too: what the editor shows is what
   the site becomes, never a mock-up. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var CRAFT_KEY = "null:craft";

  /* what a fresh pair looks like before anyone has built one */
  var DEFAULT_PACK = {
    name: "My theme",
    art: "synthwave",
    colors: ["#ff4fa8", "#a45bff", "#4fd8ff", "#ffd166"],
    tint: ["#161028", "#08080b"],
    parts: [
      { k: "star", n: 22, sp: "spread" },
      { k: "dust", n: 12, sp: "spread" },
      { k: "none", n: 0, sp: "spread" },
    ],
  };
  var DEFAULT_PART = {
    name: "My particles",
    mono: true,
    colors: ["#e6e7ea", "#a2a6ae", "#8f9dff", "#ffd166"],
    parts: [
      { k: "mote", n: 30, sp: "bottom" },
      { k: "bloom", n: 8, sp: "bottom" },
      { k: "none", n: 0, sp: "spread" },
    ],
  };

  var STARTS = [
    { id: "spread", name: "All over" },
    { id: "top", name: "From the top" },
    { id: "bottom", name: "From the bottom" },
    { id: "center", name: "From the middle" },
  ];

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  /* fill in whatever the stored definition is missing, so a pair written by
     an older version of the editor still opens */
  function seed(raw, fallback, kinds) {
    var out = clone(fallback);
    if (!raw) return out;
    if (raw.name) out.name = raw.name;
    if (kinds === "pf" && raw.art && ART_IDS().indexOf(raw.art) >= 0) out.art = raw.art;
    if (Array.isArray(raw.colors) && raw.colors.length === 4) out.colors = raw.colors.slice();
    if (Array.isArray(raw.tint) && raw.tint.length === 2) out.tint = raw.tint.slice();
    if (kinds === "pt" && raw.mono !== undefined) out.mono = !!raw.mono;
    if (Array.isArray(raw.parts) && raw.parts.length) {
      out.parts = out.parts.map(function (slot, i) {
        var p = raw.parts[i];
        return p && p.k !== undefined
          ? { k: p.k, n: p.n || 0, sp: p.sp || "spread" }
          : slot;
      });
    }
    return out;
  }

  function ART_IDS() {
    return (N.theme.ART || []).map(function (a) {
      return a.id;
    });
  }

  /* drop empty slots and rename the placeholder kind, so a saved definition
     only ever holds real parts */
  function liveParts(list) {
    return (list || [])
      .filter(function (p) {
        return p && p.k && p.k !== "none" && p.n > 0;
      })
      .map(function (p) {
        return { k: p.k, n: Math.max(1, Math.round(p.n)), sp: p.sp || "spread" };
      });
  }

  function textInput(value, onInput, opts) {
    opts = opts || {};
    var input = d.h("input", {
      type: opts.type || "text",
      value: value,
      placeholder: opts.placeholder,
      min: opts.min,
      max: opts.max,
      step: opts.step,
      spellcheck: "false",
      autocomplete: "off",
    });
    input.addEventListener("input", function () {
      onInput(input.value);
    });
    return d.h("span", { class: "field" }, input);
  }

  /* the same colour circle Settings uses: a swatch that opens the browser's
     own picker. dom.js owns it, so the two pages can't drift apart. */
  function colorInput(value, onInput, title) {
    return d.colorDot(value, onInput, { title: title || "Colour" });
  }

  function selectInput(options, value, onChange) {
    var sel = d.h(
      "select",
      null,
      options.map(function (o) {
        return d.h("option", { value: o.id }, o.name);
      }),
    );
    sel.value = value;
    sel.addEventListener("change", function () {
      onChange(sel.value);
    });
    return d.h("span", { class: "select-field" }, sel);
  }

  function row(label, control) {
    return d.h("div", { class: "ed-row" }, [d.h("b", null, label), control]);
  }

  /* ---------- the modal ---------- */
  /* `startTab` lets Settings jump straight to the half you clicked on */
  function open(onSave, startTab) {
    if (!N.modal || !N.theme || !N.theme.craftOn || !N.theme.craftOn()) {
      if (d.toast) d.toast("The editor unlocks in the Shop first.", { type: "err" });
      return;
    }

    var stored = N.store.read(CRAFT_KEY, {}) || {};
    var pack = seed(stored.pack, DEFAULT_PACK, "pf");
    var part = seed(stored.part, DEFAULT_PART, "pt");
    /* the generator is a tab in here rather than a page of its own: a roll
       fills these very fields, so the two halves are the same editor. Without
       procgen.js on the page the tab simply is not offered. */
    var canGen = !!(N.gen && N.gen.roll);
    var tab = !canGen || startTab === "theme" || startTab == null ? "theme" : startTab === "part" ? "part" : "gen";
    var handle = null;
    /* whether there is anything saved to throw away. A fresh install has
       nothing, so Delete only shows up once you've built something. */
    var built = {
      pack: !!(stored.pack && Array.isArray(stored.pack.colors) && stored.pack.colors.length),
      part: !!(stored.part && Array.isArray(stored.part.parts) && stored.part.parts.length),
    };
    var delBtn = {};

    var tabs = d.h("div", { class: "ed-tabs" });
    var panel = d.h("div", { class: "ed-panel" });
    var preview = d.h("div", { class: "ed-preview" });
    var note = d.h("p", { class: "ed-note" }, "");
    /* the reset lives in the body, not the footer: a modal action always
       closes, and resetting should leave you in the editor */
    var resetRow = d.h("div", { class: "ed-row" }, [
      d.h("b", null, "Start over"),
      d.h(
        "button",
        { type: "button", class: "btn btn-ghost btn-sm", onclick: function () { resetAll(); } },
        [d.icon("refresh"), "Reset to defaults"],
      ),
    ]);
    var body = d.h("div", { class: "ed" }, [tabs, preview, panel, note, resetRow]);

    /* the definitions the preview and the pages are built from: the stored
       shape, minus anything empty */
    function packDef() {
      return {
        id: "mypack",
        name: pack.name,
        art: pack.art,
        bg: pack.art,
        c1: pack.colors[0],
        c2: pack.colors[1],
        colors: pack.colors.slice(),
        tint: pack.tint.slice(),
        parts: liveParts(pack.parts),
      };
    }
    function partDef() {
      return {
        id: "mypart",
        name: part.name,
        mono: !!part.mono,
        colors: part.mono ? null : part.colors.slice(),
        parts: liveParts(part.parts),
      };
    }

    /* repaint just the preview: dragging a color picker never rebuilds the
       form under the cursor. A roll shows the pack, because that is the half
       you are actually looking at. */
    function paintPreview() {
      preview.textContent = "";
      var onPack = tab !== "part";
      var def = onPack ? packDef() : partDef();
      preview.appendChild(onPack ? N.theme.packThumb(def) : N.theme.partThumb(def));
      note.textContent =
        tab === "gen"
          ? "A generated set is a crafted set: the roll drops into the two tabs beside this one, so everything it hands you is editable."
          : tab === "theme"
            ? "Palette, tint and backdrop: the four colors drive the accents and the drifting parts, the tint is the sheet behind the page."
            : part.mono
              ? "This set follows the site's own colors, so it reads correctly in dark and light."
              : "This set carries its own four colors, the same way a Shop particle set does.";
    }

    function partRows(list, kinds) {
      var opts = [{ id: "none", name: "None" }].concat(
        kinds.map(function (k) {
          return { id: k, name: k };
        }),
      );
      return list.map(function (slot, i) {
        var controls = d.h("div", { class: "ed-part" }, [
          selectInput(opts, slot.k, function (v) {
            list[i].k = v;
            paintPreview();
          }),
          textInput(
            slot.n,
            function (v) {
              list[i].n = Math.max(0, Math.min(200, parseInt(v, 10) || 0));
              paintPreview();
            },
            { type: "number", min: "0", max: "200", step: "1" },
          ),
          selectInput(
            STARTS.filter(function (s) {
              return s.id !== "center" || kinds !== N.theme.PF_KINDS;
            }),
            slot.sp,
            function (v) {
              list[i].sp = v;
              paintPreview();
            },
          ),
        ]);
        return d.h("div", { class: "ed-part-row" }, [
          d.h(
            "div",
            { class: "ed-part-head" },
            i === 0 ? "Drifting parts" : "",
          ),
          controls,
        ]);
      });
    }

    /* each tab ends the same way: save what you built and wear it, or throw
       that half away outright */
    function wearRow(kind, glyph, onWear) {
      var del = d.h(
        "button",
        { type: "button", class: "btn btn-outline-danger btn-sm", hidden: !built[kind], onclick: function () { drop(kind); } },
        [d.icon("trash"), "Delete"],
      );
      delBtn[kind] = del;
      return d.h("div", { class: "ed-row" }, [
        d.h("b", null, "Wear it"),
        d.h("div", { class: "craft-acts" }, [
          del,
          d.h(
            "button",
            { type: "button", class: "btn btn-outline btn-sm", onclick: onWear },
            [d.icon(glyph), "Save and wear"],
          ),
        ]),
      ]);
    }

    /* deleting lives in the body, like Reset: a modal action always closes,
       and this one should close the editor only after it has happened */
    function drop(kind) {
      var isPack = kind === "pack";
      var what = isPack ? "theme pack" : "particle set";
      N.modal.open({
        title: "Delete your " + what + "?",
        icon: "trash",
        iconTone: "danger",
        body:
          "<p>This removes the " +
          what +
          " you built from this browser for good. Anything wearing it goes back to none.</p>" +
          "<p style='color:var(--text-2)'>The editor itself stays unlocked, so you can build another one.</p>",
        actions: [
          { label: "Cancel", variant: "outline" },
          {
            label: "Delete",
            variant: "danger",
            onClick: function () {
              N.theme.removeCraft(isPack ? "pack" : "part");
              if (handle) handle.close();
              if (onSave) onSave();
              d.toast("Deleted your " + what, { icon: "trash" });
            },
          },
        ],
      });
    }

    /* ---------- the generator ----------
       A roll hands back a whole set: palette, tint, backdrop, drifting parts
       and a matching particle layer. It writes into the editor's own two
       tabs and saves to null:craft, so what comes out is not a preview you
       have to accept but the thing the other two tabs now edit. The seed
       field is a pin, not the next roll's source: leave it blank and every
       Roll is fresh, type a seed in and Roll replays exactly that theme. */
    var rolled = null;
    var genSeed = "";
    var genScheme = "";

    function genPanel() {
      var seedIn = textInput(rolled ? String(rolled.seed) : "", function (v) {
        genSeed = v.trim();
      }, { placeholder: "random" });
      var scheme = selectInput(
        [{ id: "", name: "Surprise me" }].concat(
          (N.gen.SCHEMES || []).map(function (s) {
            return { id: s, name: s };
          }),
        ),
        genScheme,
        function (v) {
          genScheme = v;
        },
      );

      var info = d.h("div", { class: "gen-info" });
      function describe() {
        info.textContent = "";
        if (!rolled) {
          info.appendChild(
            d.h(
              "span",
              null,
              "Nothing rolled yet. Roll takes a fresh seed every time, so each press lands somewhere new. Paste a seed back in and Roll replays exactly that theme.",
            ),
          );
          return;
        }
        info.appendChild(d.h("b", null, rolled.name));
        info.appendChild(
          d.h(
            "span",
            { class: "chips-row" },
            rolled.tags.map(function (t) {
              return d.h("span", { class: "chip" }, t);
            }),
          ),
        );
      }

      function doRoll() {
        rolled = N.gen.roll({ seed: genSeed, scheme: genScheme });
        genSeed = String(rolled.seed);
        pack = seed(rolled.pack, DEFAULT_PACK, "pf");
        part = seed(rolled.part, DEFAULT_PART, "pt");
        write();
        seedIn.querySelector("input").value = genSeed;
        describe();
        paintPreview();
        if (onSave) onSave();
        d.toast("Rolled " + rolled.name, { icon: "sparkle" });
      }

      function doWear() {
        if (!rolled) return doRoll();
        N.gen.wear(rolled);
        if (onSave) onSave();
        d.toast("Wearing " + rolled.name, { icon: "check" });
      }

      describe();
      panel.appendChild(
        row(
          "Seed",
          d.h("div", { class: "lab-form" }, [
            seedIn,
            d.h("button", { type: "button", class: "btn btn-outline btn-sm", onclick: doRoll }, [d.icon("refresh"), "Roll"]),
          ]),
        ),
      );
      panel.appendChild(row("Colours", scheme));
      panel.appendChild(info);
      panel.appendChild(
        d.h("div", { class: "ec-acts" }, [
          d.h("button", { type: "button", class: "btn btn-primary btn-sm", onclick: doWear }, [d.icon("check"), "Save and wear"]),
          d.h(
            "span",
            { class: "ed-note" },
            "Wearing overwrites the theme you built by hand: the editor keeps one.",
          ),
        ]),
      );
    }

    function paintTabs() {
      tabs.textContent = "";
      [
        { id: "theme", name: "Theme pack" },
        { id: "part", name: "Particles" },
        { id: "gen", name: "Generate" },
      ]
        .filter(function (t) {
          return t.id !== "gen" || canGen;
        })
        .forEach(function (t) {
        var b = d.h("button", { type: "button" }, t.name);
        if (tab === t.id) b.classList.add("on");
        b.addEventListener("click", function () {
          tab = t.id;
          paintTabs();
          paintPanel();
          paintPreview();
        });
        tabs.appendChild(b);
      });
    }

    /* keep the unpicked set in the file: saving one tab never wipes the other */
    function paintPanel() {
      panel.textContent = "";
      if (tab === "gen") {
        genPanel();
      } else if (tab === "theme") {
        panel.appendChild(row("Name", textInput(pack.name, function (v) { pack.name = v.slice(0, 40); })));
        panel.appendChild(
          row(
            "Palette",
            d.h(
              "div",
              { class: "ed-colors" },
              pack.colors.map(function (c, i) {
                return colorInput(c, function (v) {
                  pack.colors[i] = v;
                  paintPreview();
                });
              }),
            ),
          ),
        );
        panel.appendChild(
          row(
            "Tint",
            d.h("div", { class: "ed-colors" }, [
              colorInput(pack.tint[0], function (v) {
                pack.tint[0] = v;
                paintPreview();
              }),
              colorInput(pack.tint[1], function (v) {
                pack.tint[1] = v;
                paintPreview();
              }),
            ]),
          ),
        );
        panel.appendChild(
          row(
            "Backdrop",
            selectInput(
              (N.theme.ART || []).map(function (a) {
                return { id: a.id, name: a.name };
              }),
              pack.art,
              function (v) {
                pack.art = v;
                paintPreview();
              },
            ),
          ),
        );
        partRows(pack.parts, N.theme.PF_KINDS).forEach(function (n) {
          panel.appendChild(n);
        });
        panel.appendChild(
          wearRow("pack", "check", function () {
            save();
            wearPack();
          }),
        );
      } else {
        panel.appendChild(row("Name", textInput(part.name, function (v) { part.name = v.slice(0, 40); })));
        var monoSwitch = d.h("input", { type: "checkbox", checked: !!part.mono, "aria-label": "Follow the site colors" });
        monoSwitch.addEventListener("change", function () {
          part.mono = monoSwitch.checked;
          paintPanel();
          paintPreview();
        });
        panel.appendChild(
          row(
            "Colors",
            d.h("label", { class: "switch" }, [monoSwitch, d.h("span", { class: "track" })]),
          ),
        );
        if (!part.mono) {
          panel.appendChild(
            row(
              "Palette",
              d.h(
                "div",
                { class: "ed-colors" },
                part.colors.map(function (c, i) {
                  return colorInput(c, function (v) {
                    part.colors[i] = v;
                    paintPreview();
                  });
                }),
              ),
            ),
          );
        }
        partRows(part.parts, N.theme.PT_KINDS).forEach(function (n) {
          panel.appendChild(n);
        });
        panel.appendChild(
          wearRow("part", "sparkle", function () {
            save();
            wearPart();
          }),
        );
      }
    }

    function write() {
      built.pack = true;
      built.part = true;
      Object.keys(delBtn).forEach(function (k) {
        delBtn[k].hidden = false;
      });
      N.theme.craftWrite({
        pack: {
          name: pack.name,
          art: pack.art,
          colors: pack.colors.slice(),
          tint: pack.tint.slice(),
          parts: liveParts(pack.parts),
        },
        part: {
          name: part.name,
          mono: !!part.mono,
          colors: part.colors.slice(),
          parts: liveParts(part.parts),
        },
      });
    }

    function save() {
      write();
      if (onSave) onSave();
      d.toast("Saved your theme and particles", { icon: "check" });
    }

    function wearPack() {
      N.prefs.set("accent", "mypack");
      N.theme.setAccent("mypack");
      if (N.seasons) N.seasons.refresh();
      if (onSave) onSave();
      d.toast("Wearing " + pack.name, { icon: "pen" });
    }

    function wearPart() {
      N.prefs.set("particles", "mypart");
      N.theme.setParticles("mypart");
      if (onSave) onSave();
      d.toast("Particles: " + part.name, { icon: "sparkle" });
    }

    /* back to the starting pair, form included, so the fields match what was
       just saved */
    function resetAll() {
      pack = clone(DEFAULT_PACK);
      part = clone(DEFAULT_PART);
      write();
      paintTabs();
      paintPanel();
      paintPreview();
      if (onSave) onSave();
      d.toast("Editor reset to defaults");
    }

    paintTabs();
    paintPanel();
    paintPreview();

    handle = N.modal.open({
      title: "Theme & particle editor",
      icon: "wrench",
      body: body,
      actions: [
        { label: "Cancel", variant: "ghost" },
        { label: "Save", variant: "primary", onClick: save },
      ],
    });
  }

  N.editor = { open: open };
})();
