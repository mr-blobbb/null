/* NULL · procgen.js
   The procedural theme generator.

   It rolls a complete, readable theme set out of colour math: a palette, a
   tint pair, a backdrop borrowed from the packs that already exist, drifting
   parts, and a matching particle set. The result is written to null:craft,
   which means a generated theme *is* a crafted theme: it previews, applies,
   edits, exports and deletes through the exact code the editor uses. Nothing
   downstream knows the difference, and there is no second theme system to
   keep in step.

   Three things keep the output from being random junk:

     · schemes   a base hue plus one of six relationships (analogous,
                 complementary, split, triadic, monochrome, tetrad), which is
                 what makes a palette look chosen rather than sampled
     · contrast  accent colours are forced light-on-dark or dark-on-light for
                 whichever theme is on, so text keeps its contrast against the
                 page no matter what hue comes out
     · the art   a borrowed backdrop is picked by hue family, so a green roll
                 lands on the code rain and a magenta one on the grid, instead
                 of a starfield behind everything

   Seeded: the same seed always rolls the same theme, which is what makes
   "share this seed" a thing you can actually do. */
(function () {
  var N = (window.N = window.N || {});

  /* ---------- seeded randomness (mulberry32) ---------- */
  function hash(str) {
    var h = 2166136261;
    String(str || "")
      .split("")
      .forEach(function (c) {
        h ^= c.charCodeAt(0);
        h = Math.imul(h, 16777619);
      });
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- colour ---------- */
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360;
    return "hsl(" + Math.round(h) + " " + Math.round(s) + "% " + Math.round(l) + "%)";
  }
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s /= 100;
    l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return (
      "#" +
      rgb
        .map(function (v) {
          var n = Math.round((v + m) * 255).toString(16);
          return n.length === 1 ? "0" + n : n;
        })
        .join("")
    );
  }

  /* the six relationships a palette can be built on */
  var SCHEMES = ["analogous", "complementary", "split", "triadic", "tetrad", "mono"];

  function palette(rand, scheme, base, light) {
    var off = {
      analogous: [0, 22, -20, 44],
      complementary: [0, 180, 24, 204],
      split: [0, 150, 210, 30],
      triadic: [0, 120, 240, 60],
      tetrad: [0, 90, 180, 270],
      mono: [0, 6, -8, 12],
    }[scheme] || [0, 22, -20, 44];
    /* mono keeps one hue, so its variety has to come from lightness */
    var lightSpots = scheme === "mono" ? [58, 44, 70, 34] : [64, 52, 74, 42];
    return off.map(function (d, i) {
      var h = base + d;
      var s = scheme === "mono" ? 8 + (i % 2) * 6 : 52 + ((i * 13) % 34);
      /* dark pages want light ink on them, light pages the reverse: this is
         the line that keeps the accent readable in either theme */
      var l = light ? 100 - lightSpots[i] : lightSpots[i];
      return hslToHex(h, s, l);
    });
  }

  /* ---------- naming ---------- */
  var FAMILY = [
    { at: 20, words: ["Ember", "Rust", "Clay", "Amber"] },
    { at: 55, words: ["Honey", "Dune", "Dawn", "Brass"] },
    { at: 95, words: ["Moss", "Fern", "Lime", "Meadow"] },
    { at: 165, words: ["Static", "Signal", "Cyan", "Tide"] },
    { at: 215, words: ["Midnight", "Cobalt", "Harbor", "Deep"] },
    { at: 265, words: ["Violet", "Ink", "Twilight", "Iron"] },
    { at: 305, words: ["Orchid", "Neon", "Fuchsia", "Dusk"] },
    { at: 345, words: ["Rose", "Blush", "Signal", "Copper"] },
  ];
  var OPENERS = ["Quiet", "Slow", "Hard", "Pale", "Glass", "Low", "Paper", "Cold", "Loud", "Soft"];

  function nameFor(rand, hue) {
    var fam = FAMILY.reduce(function (best, f) {
      var d = Math.abs(((hue - f.at + 540) % 360) - 180);
      return d < best.d ? { d: d, f: f } : best;
    }, { d: 999, f: FAMILY[0] }).f;
    var noun = fam.words[Math.floor(rand() * fam.words.length)];
    if (rand() < 0.45) return noun + " " + OPENERS[Math.floor(rand() * OPENERS.length)];
    return OPENERS[Math.floor(rand() * OPENERS.length)] + " " + noun;
  }

  /* ---------- art by hue family ---------- */
  var ART_HUE = {
    synthwave: [300, 350],
    matrix: [95, 165],
    gold: [30, 60],
    aurora: [165, 300],
    cosmos: [215, 275],
    vapor: [295, 345],
    neon: [175, 300],
    dawn: [0, 45],
    mist: [180, 250],
  };
  function artFor(rand, hue) {
    var arts = (N.theme.ART || []).map(function (a) {
      return a.id;
    });
    if (!arts.length) return "aurora";
    var fits = arts.filter(function (id) {
      var r = ART_HUE[id];
      if (!r) return false;
      return hue >= r[0] && hue <= r[1];
    });
    var pool = fits.length ? fits : arts;
    return pool[Math.floor(rand() * pool.length)];
  }

  /* ---------- the roll ---------- */
  function roll(opts) {
    opts = opts || {};
    var light = document.documentElement.dataset.theme === "light";
    var seed = opts.seed == null || opts.seed === "" ? Math.floor(Math.random() * 1e9) : String(opts.seed);
    var rand = rng(typeof seed === "string" ? hash(seed) : seed);
    var scheme = opts.scheme && SCHEMES.indexOf(opts.scheme) >= 0 ? opts.scheme : SCHEMES[Math.floor(rand() * SCHEMES.length)];
    var hue = opts.hue == null ? Math.floor(rand() * 360) : Number(opts.hue);
    var quiet = N.prefs.get("perf") || N.prefs.get("miniPerf");
    var name = opts.name || nameFor(rand, hue);

    var colors = palette(rand, scheme, hue, light);
    var art = artFor(rand, hue);

    /* the tint is the backdrop behind everything: a dark pair on a dark page,
       a light pair on a light one, both pulled toward the palette's hue */
    var tint = light
      ? [hslToHex(hue, 20, 93), hslToHex(hue + 18, 16, 97)]
      : [hslToHex(hue, 22, 9), hslToHex(hue + 18, 26, 4)];

    /* drifting parts: one shape is a statement, three is a mess */
    var pf = N.theme.PF_KINDS || ["star"];
    var howMany = quiet ? 1 : 2 + (rand() < 0.35 ? 1 : 0);
    var used = {};
    var parts = [];
    for (var i = 0; i < howMany; i++) {
      var k = pf[Math.floor(rand() * pf.length)];
      if (used[k]) continue;
      used[k] = 1;
      parts.push({ k: k, n: quiet ? 6 + Math.round(rand() * 6) : 10 + Math.round(rand() * 16), sp: i === 0 ? "spread" : rand() < 0.5 ? "top" : "bottom" });
    }
    if (!parts.length) parts.push({ k: pf[0], n: 10, sp: "spread" });

    /* the ambient particle set follows the theme colours: one fewer thing to
       get wrong, and the editor can still give it its own palette later */
    var pt = N.theme.PT_KINDS || ["mote"];
    var pcount = quiet ? 1 : 2 + (rand() < 0.4 ? 1 : 0);
    var pused = {};
    var bits = [];
    for (var j = 0; j < pcount; j++) {
      var pk = pt[Math.floor(rand() * pt.length)];
      if (pused[pk]) continue;
      pused[pk] = 1;
      bits.push({ k: pk, n: quiet ? 8 + Math.round(rand() * 8) : 14 + Math.round(rand() * 20), sp: j === 0 ? "bottom" : "spread" });
    }
    if (!bits.length) bits.push({ k: pt[0], n: 18, sp: "bottom" });

    return {
      seed: seed,
      scheme: scheme,
      hue: hue,
      name: name,
      pack: {
        name: name,
        art: art,
        colors: colors,
        tint: tint,
        parts: parts,
      },
      part: {
        name: name + " bits",
        mono: true,
        colors: colors.slice(),
        parts: bits,
      },
      tags: [scheme, art, "hue " + Math.round(hue)],
    };
  }

  /* ---------- using one ---------- */
  /* writes the roll into null:craft. Nothing is worn yet: the caller decides,
     which is what lets the Labs preview show a theme before it is applied. */
  function save(rolled) {
    if (!rolled) return null;
    if (!N.theme.craftOn || !N.theme.craftOn()) return null;
    N.theme.craftWrite({ pack: rolled.pack, part: rolled.part });
    return rolled;
  }
  function wear(rolled) {
    if (!save(rolled)) return null;
    N.theme.setAccent("mypack");
    N.theme.setParticles("mypart");
    N.theme.craftApply();
    return rolled;
  }
  function unwear() {
    N.theme.setAccent("off");
    N.theme.setParticles("none");
  }

  N.gen = {
    SCHEMES: SCHEMES,
    roll: roll,
    save: save,
    wear: wear,
    unwear: unwear,
    /* the seed a share link would carry */
    share: function (rolled) {
      return String(rolled && rolled.seed ? rolled.seed : "");
    },
  };
})();
