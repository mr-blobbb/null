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

  function colorInput(value, onInput) {
    var input = d.h("input", { type: "color", value: value, "aria-label": "Color" });
    input.addEventListener("input", function () {
      onInput(input.value);
    });
    return input;
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
  function open(onSave) {
    if (!N.modal || !N.theme || !N.theme.craftOn || !N.theme.craftOn()) {
      if (d.toast) d.toast("The editor unlocks in the Shop first.", { type: "err" });
      return;
    }

    var stored = N.store.read(CRAFT_KEY, {}) || {};
    var pack = seed(stored.pack, DEFAULT_PACK, "pf");
    var part = seed(stored.part, DEFAULT_PART, "pt");
    var tab = "theme";

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
       form under the cursor */
    function paintPreview() {
      preview.textContent = "";
      var def = tab === "theme" ? packDef() : partDef();
      preview.appendChild(tab === "theme" ? N.theme.packThumb(def) : N.theme.partThumb(def));
      note.textContent =
        tab === "theme"
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

    function paintTabs() {
      tabs.textContent = "";
      [
        { id: "theme", name: "Theme pack" },
        { id: "part", name: "Particles" },
      ].forEach(function (t) {
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
      if (tab === "theme") {
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
          d.h("div", { class: "ed-row" }, [
            d.h("b", null, "Wear it"),
            d.h(
              "button",
              {
                type: "button",
                class: "btn btn-outline btn-sm",
                onclick: function () {
                  save();
                  wearPack();
                },
              },
              [d.icon("check"), "Save and wear"],
            ),
          ]),
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
          d.h("div", { class: "ed-row" }, [
            d.h("b", null, "Wear it"),
            d.h(
              "button",
              {
                type: "button",
                class: "btn btn-outline btn-sm",
                onclick: function () {
                  save();
                  wearPart();
                },
              },
              [d.icon("sparkle"), "Save and wear"],
            ),
          ]),
        );
      }
    }

    function write() {
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

    N.modal.open({
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
