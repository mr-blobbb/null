/* NULL — catalog.js
   Runtime view of the auto-generated catalog (window.NULL_CATALOG).
   Also owns the launch flows: game/app warning modals, proxy redirect
   confirmations and recently-played tracking. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  function raw() {
    return window.NULL_CATALOG || { games: [], apps: [], proxies: [] };
  }

  N.catalog = {
    games: function () {
      return raw().games || [];
    },
    apps: function () {
      return raw().apps || [];
    },
    proxies: function () {
      return raw().proxies || [];
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
    return "/player.html?k=" + encodeURIComponent(kind) + "&id=" + encodeURIComponent(id);
  }

  function go(kind, entry) {
    var id = entry.id;
    if (!entry.file && kind !== "proxy") {
      d.toast("The files for \u201c" + entry.name + "\u201d are missing.", { type: "err" });
      return;
    }
    N.recent.add(kind, id);
    if (kind !== "proxy" && N.plays) N.plays.tap(kind, id); /* powers card badges */

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
        ? '<p style="color:var(--bad)">Its status is marked <b>Blocked</b> \u2014 it may be unavailable right now.</p>'
        : "") +
      "<p>This can trigger a popup / redirect prompt \u2014 that\u2019s NULL asking the browser for permission, and it\u2019s not malicious.</p>";
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
            if (!w) d.toast("The browser blocked the popup \u2014 allow popups for NULL.", { type: "err" });
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
      var g = N.catalog.games();
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
