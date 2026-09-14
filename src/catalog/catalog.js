/* NULL: catalog.js
   Runtime view of the auto-generated catalog (window.NULL_CATALOG).
   Also owns the launch flows: game/app warning modals, proxy redirect
   confirmations and recently-played tracking. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  function raw() {
    return window.NULL_CATALOG || { games: [], apps: [], proxies: [] };
  }

  /* shop-unlocked beta games merge into the live library at runtime. They
     stay out of the auto-discovered catalog until a player buys them, then
     they behave like any other entry: library, search, featured, recents. */
  function betaGames() {
    if (!N.econ || !N.econ.unlockedBetas) return [];
    return N.econ.unlockedBetas().map(function (b) {
      return {
        id: b.id,
        name: b.name,
        desc: b.desc,
        file: b.file,
        thumb: b.thumb || null,
        labels: b.labels || ["beta"],
      };
    });
  }

  /* An entry stores its own site paths inside the catalog: the game folder
     plus its thumbnail. Prefix those with the folder NULL is served from, here
     in the one place the rest of the site reads entries from, so cards, search,
     the player and the thumbnails all get an address they can use as-is. */
  function live(list) {
    return (list || []).map(function (e) {
      var out = Object.assign({}, e);
      /* keep=true: a game file and a thumbnail are real files, not pages */
      if (out.file) out.file = N.url(out.file, true);
      if (out.thumb) out.thumb = N.url(out.thumb, true);
      return out;
    });
  }

  N.catalog = {
    games: function () {
      return live(raw().games.concat(betaGames()));
    },
    apps: function () {
      return live(raw().apps);
    },
    proxies: function () {
      return live(raw().proxies);
    },
    find: function (kind, id) {
      var list = kind === "app" ? this.apps() : kind === "proxy" ? this.proxies() : this.games();
      return list.find(function (e) {
        return e.id === id;
      });
    },
    thumb: function (kind, entry) {
      if (entry && entry.thumb) return entry.thumb;
      return d.fbFor(kind);
    },
    counts: function () {
      return {
        games: this.games().length,
        apps: this.apps().length,
        proxies: this.proxies().length,
      };
    },
  };

  var KIND_LABEL = { game: "Game", app: "App", proxy: "Proxy" };

  function playerUrl(kind, id) {
    return N.url("/player") + "?k=" + encodeURIComponent(kind) + "&id=" + encodeURIComponent(id);
  }

  function go(kind, entry) {
    var id = entry.id;
    if (!entry.file && kind !== "proxy") {
      d.toast("The files for “" + entry.name + "” are missing.", { type: "err" });
      return;
    }
    N.recent.add(kind, id);
    if (kind !== "proxy" && N.plays) N.plays.tap(kind, id); /* powers card badges */
    if (kind !== "proxy" && N.week) N.week.log(kind, id); /* weekly wrap-up log */
    if (N.econ && N.econ.trackPlay) N.econ.trackPlay(kind, id); /* quests + achievements */

    if (entry.warning) {
      N.modal.open({
        title: entry.warning.title || "Heads up",
        icon: "warn",
        iconTone: "warn",
        body:
          "<p>" +
          d.escHtml(entry.warning.description || "").replace(/\n/g, "<br>") +
          "</p>",
        dismissible: false,
        actions: [
          { label: "Go back", variant: "outline" },
          {
            label: "Okay",
            variant: "primary",
            onClick: function () {
              location.href = playerUrl(kind, id);
            },
          },
        ],
      });
      return;
    }
    location.href = playerUrl(kind, id);
  }

  function openExternal(url, name, status) {
    var host = "";
    try {
      host = new URL(url).host;
    } catch (err) {}
    var blocked = status === "Blocked";
    var body =
      "<p><b>" +
      d.escHtml(name) +
      "</b> lives outside NULL. Continue opens it in a new tab on <b>" +
      d.escHtml(host || "an external site") +
      "</b>.</p>" +
      (blocked
        ? '<p style="color:var(--bad)">Its status is marked <b>Blocked</b>: it may be unavailable right now.</p>'
        : "") +
      "<p>This can trigger a popup / redirect prompt: that’s NULL asking the browser for permission, and it’s not malicious.</p>";
    N.modal.open({
      title: "Leave NULL?",
      icon: "ext",
      body: body,
      actions: [
        { label: "Cancel", variant: "outline" },
        {
          label: "Continue",
          variant: "primary",
          onClick: function () {
            var w = null;
            try {
              w = window.open(url, "_blank", "noopener");
            } catch (err) {}
            if (!w) d.toast("The browser blocked the popup. Allow popups for NULL.", { type: "err" });
          },
        },
      ],
    });
  }

  N.launch = {
    game: function (entry) {
      go("game", entry);
    },
    app: function (entry) {
      go("app", entry);
    },
    proxy: function (entry) {
      N.recent.add("proxy", entry.id);
      openExternal(entry.url, entry.name, entry.status);
    },
    openExternal: openExternal,
    randomGame: function () {
      /* games only: a beta build labelled "app" must never turn up here */
      var g = N.catalog.games().filter(function (e) {
        return !e.labels || e.labels[0] !== "app";
      });
      if (!g.length) {
        d.toast("No games in the library yet.", { type: "err" });
        return;
      }
      go("game", g[Math.floor(Math.random() * g.length)]);
    },
    playerUrl: playerUrl,
  };

  /* small html escaping helper exposed for templates */
  d.escHtml = function (s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  };

  N.KIND_LABEL = KIND_LABEL;
})();
