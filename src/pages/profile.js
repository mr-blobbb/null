/* NULL · profile.js
   The one page with an account on it, and the account is local: a username
   and a password kept in this browser, nothing sent anywhere, nothing to
   recover. That is the honest shape of it on a static host, and the page says
   so instead of pretending.

   Three screens live in here: sign in, sign up, and the profile itself. The
   profile is one card (banner, picture, name, bio, stats) with a library
   strip under it, then a plain account list. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var USERS = "null:users";
  var SESSION = "null:session";

  /* ---------- accounts ----------
     Passwords are hashed with a salt so the raw string is not sitting in
     localStorage in plain sight, but this is a speed bump and not security:
     anything a browser stores can be read by the browser's owner. */
  function hash(text, salt) {
    var s = salt + "|" + text + "|null";
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function users() {
    return N.store.read(USERS, {});
  }
  function saveUsers(u) {
    N.store.write(USERS, u);
  }
  function current() {
    var name = N.store.read(SESSION, "");
    if (!name) return null;
    var u = users()[name];
    return u ? Object.assign({ username: name }, u) : null;
  }
  function patchUser(patch) {
    var me = current();
    if (!me) return;
    var all = users();
    all[me.username] = Object.assign({}, all[me.username], patch);
    saveUsers(all);
  }

  /* a username is lowercase-or-uppercase letters, digits, dot, dash and
     underscore. No spaces, nothing else. */
  var NAME_OK = /^[A-Za-z0-9._-]{3,20}$/;

  /* ---------- small pieces ---------- */
  function field(icon, input) {
    return d.h("span", { class: "fld" }, [N.icons.svg(icon, 17), input]);
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  /* a full timestamp, for the things that carry a time and not just a day */
  function fmtWhen(ts) {
    return new Date(ts).toLocaleString(undefined, {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  /* ---------- the banner ----------
     A pair of colours by default, a picture if you upload one, and a zoom if
     you want part of it. Both end up as one background, so the card, the
     share image and the preview all read the same value. */
  var DEFAULT_BANNER = ["#7c3aed", "#6b7280"];

  function bannerCss(u) {
    if (u.bannerImg) {
      return (
        "url(\"" + String(u.bannerImg).replace(/"/g, "%22") + "\") " +
        (u.bannerAt || "50% 50%") +
        " / " + (u.bannerZoom || 100) + "% no-repeat"
      );
    }
    var pair = u.banner || DEFAULT_BANNER;
    return "linear-gradient(135deg, " + pair[0] + " 0%, " + pair[1] + " 100%)";
  }

  /* the eight pairs NULL offers, plus the free-form field */
  var SWATCHES = [
    ["#7c3aed", "#6b7280"],
    ["#0ea5e9", "#0f172a"],
    ["#f97316", "#7c2d12"],
    ["#22c55e", "#052e16"],
    ["#ec4899", "#1e1b4b"],
    ["#eab308", "#1c1917"],
    ["#06b6d4", "#083344"],
    ["#f43f5e", "#111827"],
  ];

  /* the eight faces the name style can wear. Only the profile imports them:
     the rest of the site stays on the system stack. */
  var FONTS = [
    { id: "", t: "Default (Inter)" },
    { id: "Bungee", t: "Bungee" },
    { id: "Caveat", t: "Caveat" },
    { id: "Silkscreen", t: "Silkscreen" },
    { id: "Pacifico", t: "Pacifico" },
    { id: "Gochi Hand", t: "Gochi Hand" },
    { id: "Playfair Display", t: "Playfair Display" },
    { id: "Press Start 2P", t: "Press Start 2P" },
    { id: "Space Mono", t: "Space Mono" },
  ];

  /* how a display name is painted: solid, gradient, and/or a glow */
  function nameCss(style) {
    style = style || {};
    var css = { fontFamily: style.font ? '"' + style.font + '", var(--font-ui)' : "" };
    var c1 = style.c1 || "";
    var c2 = style.c2 || c1;
    if (style.mode === "gradient" && c1 && c2) {
      css.background = "linear-gradient(90deg, " + c1 + ", " + c2 + ")";
      css.webkitBackgroundClip = "text";
      css.backgroundClip = "text";
      css.color = "transparent";
    } else if (c1) {
      css.color = c1;
    }
    if (style.glow) css.textShadow = "0 0 18px " + (style.glowColor || c1 || "currentColor");
    return css;
  }

  /* ============================================================
     the auth screens
     ============================================================ */
  function authScreen(mode) {
    var host = d.qs("#profBody");
    host.textContent = "";

    var signup = mode === "signup";
    var user = d.h("input", { type: "text", placeholder: "Username", autocomplete: "username", spellcheck: "false" });
    var pass = d.h("input", { type: "password", placeholder: "Password", autocomplete: signup ? "new-password" : "current-password" });
    var pass2 = d.h("input", { type: "password", placeholder: "Confirm Password", autocomplete: "new-password" });
    var note = d.h("p", { class: "pf-note", hidden: true });

    var go = d.h(
      "button",
      { type: "submit", class: "bt bt--fill pf-go" },
      [signup ? "Sign up" : "Sign in", N.icons.svg("arrowR", 16)],
    );

    var form = d.h("form", { class: "pf-auth" }, [
      d.h("h1", { class: "pf-auth-t" }, signup ? "Create your account" : "Welcome back"),
      d.h("p", { class: "pf-auth-s" }, signup ? "Join null." : "Sign in to continue."),
      d.h("label", { class: "pf-lbl" }, [field("person", user)]),
      d.h("label", { class: "pf-lbl" }, [field("lock", pass)]),
      signup ? d.h("label", { class: "pf-lbl" }, [field("lock", pass2)]) : null,
      signup
        ? d.h("p", { class: "pf-hint" }, "Letters, numbers, . - _ — 3 to 20 characters, no spaces.")
        : null,
      note,
      go,
      d.h(
        "p",
        { class: "pf-alt" },
        signup
          ? ["Already have one? ", d.h("button", { type: "button", class: "link-btn", onclick: function () { authScreen("signin"); } }, "Sign in")]
          : ["Don't have an account? ", d.h("button", { type: "button", class: "link-btn", onclick: function () { authScreen("signup"); } }, "Sign up")],
      ),
    ]);

    function fail(msg, where) {
      note.textContent = msg;
      note.hidden = false;
      if (where) where.focus();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      note.hidden = true;
      var name = user.value.trim();
      var pw = pass.value;

      if (!NAME_OK.test(name)) {
        return fail("Usernames are 3 to 20 characters of letters, numbers, . - or _, with no spaces.", user);
      }
      if (pw.length < 4) return fail("Passwords need at least 4 characters.", pass);

      var all = users();

      if (signup) {
        if (all[name]) return fail("That username is taken on this device.", user);
        if (pass.value !== pass2.value) return fail("The two passwords do not match.", pass2);
        go.disabled = true;
        go.firstChild.nodeValue = "Processing…";
        var salt = Math.random().toString(36).slice(2, 10);
        all[name] = {
          salt: salt,
          p: hash(pw, salt),
          created: Date.now(),
          name: name.replace(/^@/, ""),
          bio: "",
          avatar: "",
          banner: "",
          joined: Date.now(),
        };
        saveUsers(all);
        /* the pause is deliberate: it is what "Processing..." is for */
        setTimeout(function () {
          N.store.write(SESSION, name);
          N.prefs.set("loggedIn", true);
          profileScreen();
        }, 420);
        return;
      }

      var rec = all[name];
      if (!rec || rec.p !== hash(pw, rec.salt)) return fail("That username and password do not match.", pass);
      N.store.write(SESSION, name);
      N.prefs.set("loggedIn", true);
      profileScreen();
    });

    var box = d.h("div", { class: "pf-auth-box bx" }, [form]);
    d.qs("#profBody").appendChild(box);
    user.focus();
  }

  /* ============================================================
     the profile
     ============================================================ */
  function profileScreen() {
    var me = current();
    if (!me) return authScreen("signin");

    var host = d.qs("#profBody");
    host.textContent = "";

    var editing = false;
    var bannerOpen = false;

    function draw() {
      host.textContent = "";
      host.appendChild(head(me));
      host.appendChild(library());
      host.appendChild(account(me));
      if (N.icons) N.icons.paint();
    }

    function save(patch) {
      patchUser(patch);
      me = current();
      draw();
    }

    /* ---------- the big card ---------- */
    function head(u) {
      var banner = d.h("div", { class: "pf-banner", style: { background: bannerCss(u) } });
      /* the way into the banner's own options, sitting on the banner itself */
      banner.appendChild(
        d.h(
          "button",
          {
            type: "button",
            class: "pf-banner-bt",
            onclick: function () {
              bannerOpen = !bannerOpen;
              if (bannerOpen) editing = true;
              draw();
            },
          },
          [N.icons.svg("palette", 14), "Edit banner"],
        ),
      );

      var av = d.h("span", { class: "pf-av" });
      if (u.avatar) av.style.backgroundImage = 'url("' + String(u.avatar).replace(/"/g, "%22") + '")';
      else av.appendChild(N.icons.svg("person", 40, 1.4));

      var cam = d.h("button", { type: "button", class: "pf-cam", title: "Change picture", "aria-label": "Change profile picture" }, [
        N.icons.svg("camera", 14),
      ]);
      var file = d.h("input", { type: "file", accept: "image/*", hidden: true });
      cam.addEventListener("click", function () {
        file.click();
      });
      file.addEventListener("change", function () {
        var f = file.files && file.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () {
          patchUser({ avatar: r.result });
          me = current();
          draw();
        };
        r.readAsDataURL(f);
      });

      /* name / handle. In edit mode the name becomes an input; the handle
         never does, because it is the account and lives in the list below. */
      var nameEl = editing
        ? d.h("input", { class: "fld pf-name-in", value: u.name || u.username, maxlength: "28" })
        : d.h("h1", { class: "pf-name", style: nameCss(u.nameStyle) }, u.name || u.username);

      var coin = N.econ ? N.econ.state().coins : 0;
      var ach = N.econ ? N.econ.achievements().filter(function (a) { return a.done; }).length : 0;

      var bio;
      if (editing) {
        bio = d.h("textarea", { class: "pf-bio-in", rows: "2", placeholder: "Say something about yourself…" });
        bio.value = u.bio || "";
      } else {
        bio = d.h(
          "button",
          {
            type: "button",
            class: "pf-bio" + (u.bio ? " has" : ""),
            onclick: function () {
              editing = true;
              draw();
            },
          },
          u.bio || "Add a bio…",
        );
      }

      var actions = editing
        ? [
            d.h("button", { type: "button", class: "bt bt--icon", "aria-label": "Cancel", onclick: function () { editing = false; draw(); } }, [N.icons.svg("x", 16)]),
            d.h("button", { type: "button", class: "bt bt--fill bt--icon", "aria-label": "Save", onclick: save }, [N.icons.svg("check", 16)]),
          ]
        : [
            d.h("button", { type: "button", class: "bt bt--sm", onclick: function () { editing = true; draw(); } }, [
              N.icons.svg("pencil", 14),
              "Edit Profile",
            ]),
          ];

      function save() {
        var patch = { bio: bio.value.slice(0, 200) };
        if (nameEl.value !== undefined) patch.name = String(nameEl.value).slice(0, 28) || u.username;
        patchUser(patch);
        me = current();
        editing = false;
        draw();
        d.toast("Profile saved", { icon: "check" });
      }

      var card = d.h("section", { class: "pf-card bx" }, [
        banner,
        d.h("div", { class: "pf-id" }, [
          d.h("div", { class: "pf-av-w" }, [av, cam, file]),
          d.h("div", { class: "pf-txt" }, [
            d.h("div", { class: "pf-namerow" }, [
              d.h("div", { class: "pf-names" }, [
                nameEl,
                d.h("span", { class: "pf-handle" }, "@" + u.username),
              ]),
              d.h("div", { class: "pf-actions" }, actions),
            ]),
            d.h("div", { class: "pf-meta" }, [
              d.h("span", null, [N.icons.svg("clock", 13), "joined " + fmtDate(u.joined || u.created || Date.now())]),
              d.h("span", { class: "pf-pill" }, [N.icons.svg("coin", 13), String(coin)]),
              d.h("span", { class: "pf-pill" }, [N.icons.svg("trophy", 13), ach + " achievements"]),
            ]),
          ]),
        ]),
        d.h("div", { class: "pf-bio-w" }, [bio]),
      ]);

      if (bannerOpen) card.appendChild(bannerPanel(u));

      return card;
    }

    /* ---------- the banner's options ----------
       Eight pairs, a field for anything CSS can paint, and an upload that opens
       the adjust step before it saves: a banner is the widest thing on the
       page, and a picture that lands mid-face is worse than no picture. */
    function bannerPanel(u) {
      var row = d.h("div", { class: "pf-sw-row" });
      SWATCHES.forEach(function (pair) {
        row.appendChild(
          d.h(
            "button",
            {
              type: "button",
              class: "pf-sw",
              title: pair[0] + " → " + pair[1],
              style: { background: "linear-gradient(135deg, " + pair[0] + " 0%, " + pair[1] + " 100%)" },
              onclick: function () {
                save({ banner: pair, bannerImg: "" });
              },
            },
          ),
        );
      });

      var url = d.h("input", { type: "text", placeholder: "#6272a4 or a CSS gradient", spellcheck: "false" });
      var note = d.h("p", { class: "sh-note" }, "Enter a color, gradient, or image URL.");
      var apply = d.h("button", { type: "button", class: "bt bt--sm" }, "Apply");
      apply.addEventListener("click", function () {
        var v = url.value.trim();
        if (!v) return;
        if (/^https?:\/\//i.test(v) || /^data:image\//i.test(v)) {
          save({ bannerImg: v, bannerZoom: 100 });
        } else if (/gradient|#|rgb|hsl/i.test(v)) {
          /* one value paints both stops unless the field holds a gradient */
          save({ banner: /gradient/i.test(v) ? [] : [v, v], bannerImg: "", bannerRaw: v });
          if (/gradient/i.test(v)) {
            var el = d.qs(".pf-banner");
            if (el) el.style.background = v;
            patchUser({ bannerRaw: v });
          }
        } else {
          note.textContent = "That is not a colour, a gradient or an image URL.";
        }
      });

      var file = d.h("input", { type: "file", accept: "image/*", hidden: true });
      file.addEventListener("change", function () {
        var f = file.files && file.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () {
          adjustBanner(String(r.result));
        };
        r.readAsDataURL(f);
      });
      var upload = d.h(
        "button",
        { type: "button", class: "bt bt--sm", onclick: function () { file.click(); } },
        [N.icons.svg("image", 14), "Upload image"],
      );

      return d.h("div", { class: "pf-sw-w" }, [
        d.h("div", { style: { flex: "1 1 320px", minWidth: "0" } }, [
          d.h("span", { class: "pf-lbl-t" }, "Banner"),
          row,
          d.h("div", { style: { display: "flex", gap: "8px", marginTop: "12px" } }, [d.h("span", { class: "fld", style: { flex: "1" } }, [url]), apply, upload]),
          note,
        ]),
        file,
      ]);
    }

    /* ---------- adjust a picture before it becomes the banner ---------- */
    function adjustBanner(src) {
      var zoom = d.h("input", { type: "range", min: "100", max: "260", value: "100", "aria-label": "Resize" });
      var img = d.h("div", { class: "pf-adjust-img" });
      var atX = 50;
      var atY = 50;
      function paintZoom() {
        img.style.backgroundImage = 'url("' + src.replace(/"/g, "%22") + '")';
        img.style.backgroundSize = zoom.value + "%";
        img.style.backgroundPosition = atX + "% " + atY + "%";
      }
      zoom.addEventListener("input", paintZoom);
      paintZoom();

      /* drag to reposition, and the wheel resizes: the two things the caption
         promises, done on a plain background-position rather than a canvas,
         because that is what the banner itself uses */
      var dragging = false;
      var from = null;
      img.addEventListener("pointerdown", function (e) {
        dragging = true;
        from = { x: e.clientX, y: e.clientY, atX: atX, atY: atY };
        img.setPointerCapture(e.pointerId);
      });
      img.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        var box = img.getBoundingClientRect();
        atX = Math.max(0, Math.min(100, from.atX - ((e.clientX - from.x) / box.width) * 100));
        atY = Math.max(0, Math.min(100, from.atY - ((e.clientY - from.y) / box.height) * 100));
        paintZoom();
      });
      img.addEventListener("pointerup", function () {
        dragging = false;
      });
      img.addEventListener("wheel", function (e) {
        e.preventDefault();
        zoom.value = String(Math.max(100, Math.min(260, Number(zoom.value) - Math.sign(e.deltaY) * 10)));
        paintZoom();
      }, { passive: false });

      var go = d.h("button", { type: "button", class: "bt bt--fill" }, "Apply");
      var s = sheet({
        title: "Adjust banner",
        icon: "image",
        body: d.h("div", null, [
          d.h("p", { class: "sh-note" }, "Drag to reposition. Scroll or use the slider to resize."),
          img,
          d.h("div", { class: "pf-adjust" }, [zoom]),
        ]),
        foot: d.h("div", { class: "sh-foot" }, [
          d.h("button", { type: "button", class: "bt", onclick: function () { zoom.value = "100"; paintZoom(); } }, "Reset"),
          d.h("button", { type: "button", class: "bt", onclick: function () { s.close(); } }, "Cancel"),
          go,
        ]),
      });
      go.addEventListener("click", function () {
        go.disabled = true;
        go.textContent = "Uploading…";
        /* there is no server to upload to: the wait is the decode, so the
           banner never appears half painted */
        var probe = new Image();
        probe.onload = probe.onerror = function () {
          save({
            bannerImg: src,
            bannerZoom: Number(zoom.value),
            bannerAt: atX + "% " + atY + "%",
          });
          s.close();
          d.toast("Banner updated", { icon: "check" });
        };
        probe.src = src;
      });
    }

    /* ---------- the library strip ---------- */
    function library() {
      var links = [
        { t: "Games", url: "/games/", icon: "games" },
        { t: "Titles", url: "/shop", icon: "bag" },
        { t: "Recent", url: "/games/", icon: "clock" },
        { t: "Favorites", url: "/games/", icon: "star" },
      ];
      var row = d.h(
        "div",
        { class: "pf-lib" },
        links.map(function (l) {
          return d.h("a", { class: "pf-lib-c crd", href: N.url(l.url) }, [
            N.icons.svg(l.icon, 18),
            d.h("span", null, l.t),
          ]);
        }),
      );

      var sec = d.h("section", { class: "pf-sec" }, [
        d.h("h2", { class: "pf-h" }, "Library"),
        row,
      ]);

      var recent = N.recent
        .list()
        .map(function (r) {
          return N.catalog.find(r.k, r.id);
        })
        .filter(Boolean)
        .slice(0, 8);

      if (recent.length) {
        sec.appendChild(d.h("h2", { class: "pf-h", style: { marginTop: "34px" } }, "Recently played"));
        var strip = d.h("div", { class: "pf-recent" });
        recent.forEach(function (e) {
          var sq = d.h("span", { class: "tl-sq" + (e.thumb ? "" : " tl-sq--none") });
          if (e.thumb) sq.style.backgroundImage = 'url("' + String(e.thumb).replace(/"/g, "%22") + '")';
          else sq.appendChild(d.h("span", { class: "tl-fb" }, [N.icons.svg("games", 32, 1.3)]));
          var b = d.h("button", { type: "button", class: "tl", "aria-label": "Open " + e.name }, [
            sq,
            d.h("span", { class: "tl-n" }, e.name || e.id),
          ]);
          b.addEventListener("click", function () {
            N.launch.game(e);
          });
          strip.appendChild(d.h("div", { class: "tl-w" }, [b]));
        });
        sec.appendChild(strip);
      }

      return sec;
    }

    /* ---------- game saves ----------
       Everything NULL keeps for you is localStorage, so a "save" is the whole
       of it as one JSON file. No server means no sync: the file in your
       downloads is the backup. */
    function savesRow(u) {
      var last = N.prefs.get("lastBackup") || 0;
      var label = last
        ? "Last backed up " + fmtWhen(last)
        : "Never backed up · account made " + fmtDate(u.created || Date.now());

      var backup = d.h("button", { type: "button", class: "bt bt--sm" }, [N.icons.svg("cloudUp", 14), "Back up"]);
      backup.addEventListener("click", function () {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf("null:") === 0) keys.push(k);
        }
        var bag = {};
        keys.forEach(function (k) {
          bag[k] = localStorage.getItem(k);
        });
        var blob = new Blob([JSON.stringify({ null: 1, at: Date.now(), data: bag }, null, 2)], { type: "application/json" });
        var a = d.h("a", { href: URL.createObjectURL(blob), download: "null-save.json" });
        document.body.appendChild(a);
        a.click();
        a.remove();
        N.prefs.set("lastBackup", Date.now());
        draw();
        d.toast("Saved to your downloads", { icon: "cloudUp" });
      });

      var file = d.h("input", { type: "file", accept: ".json,application/json", hidden: true });
      file.addEventListener("change", function () {
        var f = file.files && file.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () {
          try {
            var bag = JSON.parse(String(r.result));
            var data = bag && bag.data ? bag.data : bag;
            if (!data || typeof data !== "object") throw new Error("no data");
            Object.keys(data).forEach(function (k) {
              if (k.indexOf("null:") === 0) localStorage.setItem(k, String(data[k]));
            });
            d.toast("Restored — reloading", { icon: "cloudDown" });
            setTimeout(function () { location.reload(); }, 700);
          } catch (err) {
            d.toast("That is not a NULL save", { type: "err" });
          }
        };
        r.readAsText(f);
      });
      var restore = d.h(
        "button",
        { type: "button", class: "bt bt--sm", onclick: function () { file.click(); } },
        [N.icons.svg("cloudDown", 14), "Restore"],
      );

      return d.h("div", { class: "pf-line" }, [
        d.h("div", { class: "pf-line-t" }, [d.h("b", null, "Game saves"), d.h("span", null, label)]),
        d.h("div", { class: "pf-line-a" }, [backup, restore, file]),
      ]);
    }

    /* ---------- the card's gradient ----------
       Two colours, top to bottom, behind the profile card. It is the same
       value the banner button edits, so the two can never disagree. */
    function gradientRow(u) {
      var pair = u.banner || DEFAULT_BANNER;
      var top = d.h("input", { type: "color", value: pair[0], "aria-label": "Top colour" });
      var bot = d.h("input", { type: "color", value: pair[1], "aria-label": "Bottom colour" });
      var preview = d.h("span", { class: "pf-best" });
      function paint() {
        preview.style.background = "linear-gradient(180deg, " + top.value + ", " + bot.value + ")";
      }
      top.addEventListener("input", paint);
      bot.addEventListener("input", paint);
      paint();

      return d.h("div", { class: "pf-line" }, [
        d.h("div", { class: "pf-line-t" }, [
          d.h("b", null, "Profile card gradient"),
          d.h("span", null, "Two colors, top to bottom. Shown behind your profile card."),
        ]),
        d.h("div", { class: "pf-line-a" }, [
          preview,
          top,
          bot,
          d.h("button", { type: "button", class: "bt bt--fill bt--sm", onclick: function () { save({ banner: [top.value, bot.value], bannerImg: "", bannerRaw: "" }); } }, "Save"),
          d.h("button", { type: "button", class: "bt bt--sm", onclick: function () { save({ banner: DEFAULT_BANNER, bannerImg: "", bannerRaw: "" }); } }, "Clear"),
        ]),
      ]);
    }

    /* ---------- the name's style ----------
       Solid or gradient ink, an optional glow, and one of eight faces. This
       is the display name only: the handle stays put, and the rest of the site
       stays on the system font. */
    function nameStyleBlock(u) {
      var cur = u.nameStyle || {};
      var draft = {
        mode: cur.mode === "gradient" ? "gradient" : "solid",
        c1: cur.c1 || "#f4f4f5",
        c2: cur.c2 || "#8b5cf6",
        glow: !!cur.glow,
        glowColor: cur.glowColor || "#8b5cf6",
        font: cur.font || "",
      };
      var shown = u.name || u.username;

      var preview = d.h("div", { class: "pf-namestyle" }, shown);
      function paint() {
        var css = nameCss(draft);
        for (var k in css) preview.style[k] = css[k];
        /* a gradient that is switched back to solid has to give the colour
           back, or the text would stay invisible */
        if (draft.mode !== "gradient") {
          preview.style.background = "none";
          preview.style.webkitBackgroundClip = "initial";
          preview.style.backgroundClip = "initial";
          preview.style.color = draft.c1;
        }
      }
      paint();

      var c1 = d.h("input", { type: "color", value: draft.c1, "aria-label": "Name colour" });
      c1.addEventListener("input", function () { draft.c1 = c1.value; paint(); });

      var c2 = d.h("input", { type: "color", value: draft.c2, "aria-label": "Second colour" });
      c2.addEventListener("input", function () { draft.c2 = c2.value; draft.mode = "gradient"; paint(); });

      var glowCol = d.h("input", { type: "color", value: draft.glowColor, "aria-label": "Glow colour" });
      glowCol.addEventListener("input", function () { draft.glowColor = glowCol.value; paint(); });

      var glow = d.h("input", { type: "checkbox", checked: draft.glow, "aria-label": "Add glow" });
      glow.addEventListener("change", function () { draft.glow = glow.checked; paint(); });

      var font = d.h("select", { class: "pf-font", "aria-label": "Font" });
      FONTS.forEach(function (f) {
        font.appendChild(d.h("option", { value: f.id, selected: draft.font === f.id }, f.t));
      });
      font.addEventListener("change", function () { draft.font = font.value; paint(); });

      return d.h("div", { class: "pf-line", style: { display: "block" } }, [
        d.h("div", { class: "pf-line-t" }, [
          d.h("b", null, "Username style"),
          d.h("span", null, "Applied to your display name on site and on profile cards."),
        ]),
        preview,
        d.h("div", { class: "pf-swatches" }, [
          d.h("span", { class: "pf-lbl-t" }, "Ink"),
          c1,
          d.h("span", { class: "pf-lbl-t" }, "Gradient"),
          c2,
          d.h("label", { class: "pf-lbl-t" }, [glow, " Add glow"]),
          glowCol,
        ]),
        d.h("span", { class: "pf-lbl-t" }, "Font"),
        font,
        d.h("div", { class: "pf-line-a", style: { marginTop: "14px", justifyContent: "flex-start" } }, [
          d.h("button", { type: "button", class: "bt bt--sm", onclick: function () { save({ nameStyle: {} }); } }, "Reset"),
          d.h("button", { type: "button", class: "bt bt--fill bt--sm", onclick: function () {
            save({ nameStyle: draft });
            d.toast("Name style saved", { icon: "check" });
          } }, "Save"),
        ]),
      ]);
    }

    /* ---------- account ---------- */
    function account(u) {
      function line(title, desc, action) {
        return d.h("div", { class: "pf-line" }, [
          d.h("div", { class: "pf-line-t" }, [d.h("b", null, title), desc ? d.h("span", null, desc) : null]),
          d.h("div", { class: "pf-line-a" }, action ? [action] : []),
        ]);
      }

      /* username: changeable once every 14 days */
      var lastChange = u.nameChanged || 0;
      var waitDays = Math.ceil((14 * 864e5 - (Date.now() - lastChange)) / 864e5);
      var renameBtn = d.h(
        "button",
        { type: "button", class: "bt bt--sm", disabled: waitDays > 0 },
        [N.icons.svg("pencil", 14), "Change"],
      );
      renameBtn.addEventListener("click", function () {
        var input = d.h("input", { type: "text", value: u.username, "aria-label": "New username" });
        var msg = d.h("p", { class: "sh-note" }, "Letters, numbers, . - _ — no spaces.");
        var s = sheet({
          title: "Change username",
          icon: "person",
          body: d.h("label", { class: "sh-field" }, [d.h("span", null, "Username"), d.h("span", { class: "fld" }, [input]), msg]),
          foot: d.h("div", { class: "sh-foot" }, [
            d.h(
              "button",
              {
                type: "button",
                class: "bt bt--fill",
                onclick: function () {
                  var next = input.value.trim();
                  if (!NAME_OK.test(next)) {
                    msg.textContent = "That username will not work: 3 to 20 characters, no spaces.";
                    return;
                  }
                  var all = users();
                  if (all[next]) {
                    msg.textContent = "That one is taken on this device.";
                    return;
                  }
                  all[next] = all[u.username];
                  all[next].nameChanged = Date.now();
                  delete all[u.username];
                  saveUsers(all);
                  N.store.write(SESSION, next);
                  me = current();
                  s.close();
                  draw();
                  d.toast("Username changed", { icon: "check" });
                },
              },
              "Save",
            ),
          ]),
        });
      });

      var pwBtn = d.h("button", { type: "button", class: "bt bt--sm" }, [N.icons.svg("lock", 14), "Change"]);
      pwBtn.addEventListener("click", function () {
        var cur = d.h("input", { type: "password", placeholder: "Current password" });
        var next = d.h("input", { type: "password", placeholder: "New password" });
        var msg = d.h("p", { class: "sh-note" });
        var s = sheet({
          title: "Change password",
          icon: "lock",
          body: d.h("div", null, [
            d.h("label", { class: "sh-field" }, [d.h("span", null, "Current"), d.h("span", { class: "fld" }, [cur])]),
            d.h("label", { class: "sh-field" }, [d.h("span", null, "New"), d.h("span", { class: "fld" }, [next])]),
            msg,
          ]),
          foot: d.h("div", { class: "sh-foot" }, [
            d.h(
              "button",
              {
                type: "button",
                class: "bt bt--fill",
                onclick: function () {
                  if (hash(cur.value, u.salt) !== u.p) {
                    msg.textContent = "That is not your current password.";
                    return;
                  }
                  if (next.value.length < 4) {
                    msg.textContent = "The new password needs at least 4 characters.";
                    return;
                  }
                  var salt = Math.random().toString(36).slice(2, 10);
                  patchUser({ salt: salt, p: hash(next.value, salt) });
                  me = current();
                  s.close();
                  d.toast("Password changed", { icon: "check" });
                },
              },
              "Save",
            ),
          ]),
        });
      });

      var logout = d.h("button", { type: "button", class: "bt bt--sm" }, "Log out");
      logout.addEventListener("click", function () {
        N.store.del(SESSION);
        N.prefs.set("loggedIn", false);
        authScreen("signin");
      });

      var wipe = d.h("button", { type: "button", class: "bt bt--sm bt--danger" }, "Delete");
      wipe.addEventListener("click", function () {
        var pw = d.h("input", { type: "password", placeholder: "Password" });
        var msg = d.h("p", { class: "sh-note" }, "This deletes the account and its profile from this browser. It cannot be undone.");
        var s = sheet({
          title: "Delete account",
          icon: "warn",
          body: d.h("label", { class: "sh-field" }, [d.h("span", null, "Confirm your password"), d.h("span", { class: "fld" }, [pw]), msg]),
          foot: d.h("div", { class: "sh-foot" }, [
            d.h(
              "button",
              {
                type: "button",
                class: "bt bt--danger",
                onclick: function () {
                  if (hash(pw.value, u.salt) !== u.p) {
                    msg.textContent = "That password is not right.";
                    return;
                  }
                  var all = users();
                  delete all[u.username];
                  saveUsers(all);
                  N.store.del(SESSION);
                  N.prefs.set("loggedIn", false);
                  s.close();
                  authScreen("signin");
                  d.toast("Account deleted", { icon: "trash" });
                },
              },
              "Delete forever",
            ),
          ]),
        });
      });

      return d.h("section", { class: "pf-sec" }, [
        d.h("h2", { class: "pf-h" }, "Account"),
        d.h("div", { class: "pf-acc bx" }, [
          line("Username", "@" + u.username + (waitDays > 0 ? " · can change in " + waitDays + " day" + (waitDays === 1 ? "" : "s") : "Can change once every 14 days."), renameBtn),
          line("Password", "••••••••", pwBtn),
          savesRow(u),
          gradientRow(u),
          nameStyleBlock(u),
          line("Log out", "Sign out of null on this device.", logout),
          line("Delete account", "Permanently delete your account and data.", wipe),
        ]),
      ]);
    }

    draw();
  }

  /* a small sheet, same shape as the one on the Shop page */
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

  function init() {
    if (N.icons) N.icons.paint();
    profileScreen();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
