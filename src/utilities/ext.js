/* NULL · ext.js
   The extension runtime.

   Two very different kinds of extension live in one registry, on purpose:
   the registry is the honest place to see what you have installed, and the
   difference in power between the two is spelled out on the Extensions page
   rather than hidden.

     .nullext   a NULL-native extension. Full power, no sandbox, by design:
                it runs in this page's own realm with the whole N object in
                scope, so it can rewrite the economy, XP, coins, quests,
                achievements, storage keys, recents, favorites, theme packs,
                particles, seasonal modes, the player, search, hidden pages,
                the dev console, marathon mode, the screensaver, modals, FX.
                That is the point of it. Nothing is filtered, and nothing
                stops it from breaking its own install: uninstall it again
                from the Extensions page.
     chrome     an imported popup extension. Only its popup UI runs, inside a
                sandboxed frame with an opaque origin, so it cannot reach the
                page or its storage; a small chrome.* shim bridges storage and
                messages back through postMessage. No background script, no
                tabs, no content scripts, no host permissions.

   Storage:
     null:ext             the registry: every installed extension, enabled or not
     null:extdata:<id>    one extension's own storage bag
     null:prefs           pref keys are namespaced per extension (x-<id>:key),
                          so the usual backup/export picks them up for free

   Loading: every page includes this file before shell.js, so N.ext exists
   when the nav builds, and boot() runs after the page's own script has
   mounted: an extension gets to react to a page rather than race it. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var KEY = "null:ext";
  var DATA = "null:extdata:";
  var HOOK = "x-hook:";
  var LIMIT = 40; /* a ceiling, so a broken loop can't fill storage forever */

  /* text the importer keeps as text; anything else is held as a data: URI */
  var TEXT = /\.(html?|css|js|mjs|cjs|json|txt|md|svg)$/i;

  /* ---------- registry ---------- */
  function list() {
    var all = N.store.read(KEY, []);
    return Array.isArray(all) ? all : [];
  }
  function get(id) {
    var hit = null;
    list().forEach(function (e) {
      if (e && e.id === id) hit = e;
    });
    return hit;
  }
  function write(all) {
    N.store.write(KEY, all);
    if (N.bus && N.bus.emit) N.bus.emit("ext");
  }
  function put(entry) {
    var all = list();
    var seen = false;
    all = all.map(function (e) {
      if (e && e.id === entry.id) {
        seen = true;
        return entry;
      }
      return e;
    });
    if (!seen) all.push(entry);
    write(all);
    return entry;
  }
  function idFor(name) {
    var base = String(name || "extension")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!base) base = "extension";
    var id = base;
    var n = 2;
    while (get(id)) id = base + "-" + n++;
    return id;
  }
  function slug(id) {
    return String(id).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  }

  /* ---------- per-extension storage ---------- */
  function bag(id) {
    var raw = N.store.read(DATA + id, null);
    return raw && typeof raw === "object" ? raw : {};
  }
  function bagWrite(id, obj) {
    N.store.write(DATA + id, obj);
  }

  /* ---------- talking about failures ---------- */
  /* one extension blowing up must never take the page with it, and it should
     say what happened where a person will actually see it */
  function fail(what, err) {
    var msg = what + ": " + ((err && err.message) || err);
    try {
      console.error("[ext] " + msg);
    } catch (e) {}
    if (d.toast) d.toast(msg, { type: "err", hold: 6000 });
  }

  /* ---------- the hook bus ----------
     Core code emits a handful of named events as things happen. An extension
     hooks any of them; the same events are also forwarded onto N.bus as
     "ext:<name>", so the rest of the site can listen to extensions too. */
  var hooks = {};
  function on(name, fn) {
    if (typeof fn !== "function") return null;
    (hooks[name] = hooks[name] || []).push(fn);
    return fn;
  }
  function off(name, fn) {
    hooks[name] = (hooks[name] || []).filter(function (f) {
      return f !== fn;
    });
  }
  function emit(name, data) {
    (hooks[name] || []).slice().forEach(function (fn) {
      try {
        fn(data);
      } catch (err) {
        fail("hook " + name, err);
      }
    });
    if (N.bus && N.bus.emit) {
      try {
        N.bus.emit("ext:" + name, data);
      } catch (err) {}
    }
  }
  function hookNames() {
    var out = [];
    Object.keys(hooks).forEach(function (k) {
      if (hooks[k].length) out.push(k + " (" + hooks[k].length + ")");
    });
    return out;
  }

  /* ---------- css ---------- */
  function styleFor(id) {
    var el = document.querySelector('style[data-ext="' + slug(id) + '"]');
    if (!el) {
      el = document.createElement("style");
      el.setAttribute("data-ext", slug(id));
      document.head.appendChild(el);
    }
    return el;
  }
  function dropStyle(id) {
    var el = document.querySelector('style[data-ext="' + slug(id) + '"]');
    if (el) el.remove();
  }

  /* ---------- slots: where an extension draws its own chrome ----------
     The shell owns the markup, so it hands out the mount points: a strip in
     the nav bar (the one bar every page has), the Extensions page's canvas,
     and the footer. An extension asks for one and owns everything it puts
     inside. Real HTML, because a .nullext is not sandboxed and has nothing
     to hide from.

     The nav strip is a row in the top bar and a column in the side rail, and
     the rail clips what does not fit. Text marked data-rail-hide is dropped
     while the rail is shut and comes back when it slides open, so a widget
     shrinks to its icon instead of being sliced in half. */
  var widgets = {};
  function slot(where) {
    if (where === "nav" || where === "topbar") return document.querySelector("[data-slot='nav']");
    if (where === "extensions" || where === "ext") return document.querySelector("[data-slot='ext']");
    if (where === "footer") return document.querySelector("[data-slot='foot']");
    if (!where) return null;
    if (where.charAt(0) === "[") return document.querySelector(where);
    return document.querySelector("[data-slot='" + where + "']");
  }
  /* unmount everything one extension put into the chrome, so disabling or
     removing it leaves the page exactly as it found it */
  function dropWidgets(id) {
    (widgets[id] || []).forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    delete widgets[id];
  }

  /* ---------- pages an extension can add ----------
     A page is either a render function or a block of HTML; either way the
     Extensions page (and /root) can mount it. Nothing here goes near the
     router: a page is a view, and the manager is exactly where views from
     your own extensions belong.

     A page id is unique per extension, so re-activating one replaces it
     rather than stacking a second copy. */
  var pages = [];
  function addPage(extId, spec) {
    if (!spec) return null;
    var html = typeof spec.html === "string" ? spec.html : "";
    if (typeof spec.render !== "function" && !html) return null;
    var page = {
      ext: extId,
      id: extId + ":" + (spec.id || "page"),
      title: spec.title || "Untitled page",
      icon: spec.icon || "code",
      desc: spec.desc || "",
      html: html,
      render:
        typeof spec.render === "function"
          ? spec.render
          : function (el) {
              el.innerHTML = html;
              /* the one thing HTML cannot do on its own is run code after it
                 is in the document, so a page may bring a mount function */
              if (typeof spec.mount === "function") spec.mount(el);
            },
    };
    pages = pages.filter(function (p) {
      return p.id !== page.id;
    });
    pages.push(page);
    if (N.bus && N.bus.emit) N.bus.emit("ext");
    return page;
  }
  function pageList() {
    return pages.slice();
  }

  /* ---------- the API handed to a native extension ---------- */
  function api(entry) {
    var id = entry.id;
    return {
      /* the whole app, because that is what a .nullext is for */
      N: N,
      id: id,
      name: entry.name,
      version: entry.version || "",
      manifest: entry.manifest || {},
      /* ranked, so the obvious things are one hop away */
      econ: N.econ,
      theme: N.theme,
      search: N.search,
      player: N.player,
      daily: N.daily,
      eggs: N.eggs,
      dev: N.dev,
      editor: N.editor,
      modal: N.modal,
      fx: null, /* filled in on boot: FX is built with the shell */
      prefs: {
        get: function (k) {
          return N.prefs.get(id + ":" + k);
        },
        set: function (k, v) {
          N.prefs.set(id + ":" + k, v);
        },
      },
      store: {
        load: function () {
          return bag(id);
        },
        save: function (obj) {
          bagWrite(id, obj || {});
        },
        get: function (k) {
          return bag(id)[k];
        },
        set: function (k, v) {
          var b = bag(id);
          b[k] = v;
          bagWrite(id, b);
        },
        del: function (k) {
          var b = bag(id);
          delete b[k];
          bagWrite(id, b);
        },
      },
      css: function (text) {
        styleFor(id).textContent = String(text || "");
      },
      js: function (code) {
        runCode(entry, code);
      },
      hook: on,
      unhook: off,
      emit: emit,
      pages: pageList,
      page: function (spec) {
        return addPage(id, spec);
      },
      /* draw your own chrome: "nav" is the bar every page has, "extensions"
         is the canvas on the manager page. html is real markup and the
         returned element is yours. */
      mount: function (where, html) {
        var host = slot(where);
        if (!host) return null;
        var box = document.createElement("div");
        box.className = "ext-widget";
        box.setAttribute("data-ext", slug(id));
        if (html != null) box.innerHTML = String(html);
        host.appendChild(box);
        (widgets[id] = widgets[id] || []).push(box);
        if (N.bus && N.bus.emit) N.bus.emit("ext");
        return box;
      },
      slot: slot,
      unmount: function () {
        dropWidgets(id);
      },
      toast: function (msg, opts) {
        if (d.toast) d.toast(msg, opts);
      },
      say: function (title, body, opts) {
        if (N.modal) N.modal.open(Object.assign({ title: title, body: body }, opts || {}));
      },
      log: function () {
        var args = Array.prototype.slice.call(arguments);
        try {
          console.log.apply(console, ["[" + id + "]"].concat(args));
        } catch (e) {}
        return args[0];
      },
    };
  }

  /* ---------- running code ----------
     new Function is the honest way to do this: a .nullext is JavaScript that
     gets the same reach as any other script on the page. Storage keys, the
     economy, the DOM: all of it. */
  function runCode(entry, code) {
    try {
      var fn = new Function("N", "ctx", String(code) + "\n//# sourceURL=null-ext-" + entry.id + ".js");
      fn(N, api(entry));
      return true;
    } catch (err) {
      fail(entry.name + " threw", err);
      return false;
    }
  }

  function activate(entry) {
    if (entry.css) styleFor(entry.id).textContent = entry.css;
    /* pages the manifest declares, so an extension can be pure JSON: no js
       block needed to add a view */
    (entry.pages || []).forEach(function (p) {
      if (!p) return;
      addPage(entry.id, {
        id: p.id,
        title: p.title,
        icon: p.icon,
        desc: p.desc,
        html: p.html,
        mount: null,
      });
    });
    var ok = entry.js ? runCode(entry, entry.js) : true;
    var ctx = api(entry);
    if (N.fx) ctx.fx = N.fx;
    return ok;
  }

  function enabled() {
    return list().filter(function (e) {
      return e && e.enabled !== false;
    });
  }

  /* ---------- .nullext parsing ----------
     A .nullext is a JSON manifest with an optional css and js block. A file
     that is not JSON is taken as plain JavaScript, and the name comes from
     the file: the quickest possible way to write one is a single .js file
     dropped on the installer. */
  function parse(text, filename) {
    var name = String(filename || "extension").replace(/\.[^.]+$/, "");
    var obj = null;
    try {
      obj = JSON.parse(text);
    } catch (err) {
      obj = null;
    }
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      if (obj.manifest_version || obj.action || obj.browser_action) return chromeManifest(obj, { "manifest.json": text }, filename);
      return {
        kind: "native",
        name: obj.name || name,
        version: String(obj.version || "1.0.0"),
        author: obj.author || "",
        desc: obj.desc || obj.description || "",
        icon: obj.icon || "code",
        run: obj.run === "manual" ? "manual" : "always",
        css: String(obj.css || ""),
        js: String(obj.js || obj.code || ""),
        /* HTML is first class here: a window this extension opens from the
           puzzle menu, and any number of views, declared in the manifest */
        html: String(obj.html || ""),
        pages: Array.isArray(obj.pages) ? obj.pages : [],
        nav: Array.isArray(obj.nav) ? obj.nav : [],
        manifest: obj,
      };
    }
    return {
      kind: "native",
      name: name,
      version: "1.0.0",
      author: "",
      desc: "A plain JavaScript extension: the whole file ran as its code.",
      icon: "code",
      run: "always",
      css: "",
      js: String(text),
      html: "",
      pages: [],
      nav: [],
      manifest: { nullExt: 1, js: true },
    };
  }

  /* ---------- chrome (popup only) ----------
     manifest.json plus whatever files came with it. All NULL keeps is the
     popup and its assets: this is a popup host, not a browser. */
  function chromeManifest(man, files, filename) {
    var popup = "";
    if (man.action && man.action.default_popup) popup = man.action.default_popup;
    if (man.browser_action && man.browser_action.default_popup) popup = man.browser_action.default_popup;
    if (!popup) {
      Object.keys(files).some(function (p) {
        if (/popup\.html?$/i.test(p)) {
          popup = p;
          return true;
        }
        return false;
      });
    }
    if (!popup) {
      /* a cheap trick real extensions use: an options page is close enough to
         a popup to be worth hosting, and it is better than a dead import */
      popup = man.options_ui && man.options_ui.page ? man.options_ui.page : "";
    }
    var name = (man.name || String(filename || "").replace(/\.[^.]+$/, "") || "Extension").replace(/^__MSG_|__$/g, "");
    return {
      kind: "chrome",
      name: name,
      version: String(man.version || "1.0.0"),
      author: man.author || "",
      desc: man.description || "Imported Chrome extension: popup only.",
      icon: "puzzle",
      run: "manual",
      popup: popup,
      files: files,
      manifest: man,
    };
  }

  /* every file the importer was handed, split into text and data: URIs */
  function fromFiles(fileList, done) {
    var files = {};
    var assets = {};
    var names = [];
    var pending = 0;
    var finished = false;

    function settle() {
      if (pending > 0 || finished) return;
      finished = true;
      var man = null;
      Object.keys(files).some(function (p) {
        if (/(^|\/)manifest\.json$/i.test(p)) {
          try {
            man = JSON.parse(files[p]);
          } catch (err) {}
          return !!man;
        }
        return false;
      });
      if (!man) {
        done(null, names.length ? "No manifest.json in what you picked. Pick the extension's folder (or its manifest plus popup files)." : "Nothing was read.");
        return;
      }
      var entry = chromeManifest(man, files, names[0]);
      entry.assets = assets;
      done(entry, null);
    }

    Array.prototype.forEach.call(fileList, function (f) {
      if (!f || !f.name) return;
      var rel = f.webkitRelativePath || f.name;
      names.push(rel);
      var isText = TEXT.test(f.name) || /\.json$/i.test(f.name);
      var reader = new FileReader();
      pending++;
      reader.onerror = function () {
        pending--;
        settle();
      };
      reader.onload = function () {
        pending--;
        if (isText) files[rel] = String(reader.result);
        else assets[rel] = String(reader.result);
        settle();
      };
      if (isText) reader.readAsText(f);
      else reader.readAsDataURL(f);
    });
    if (!pending) settle();
  }

  /* ---------- install / enable / remove ---------- */
  function install(entry) {
    if (list().length >= LIMIT && !get(entry.id)) {
      fail("install", "Extension limit reached (" + LIMIT + ")");
      return null;
    }
    entry.id = entry.id || idFor(entry.name);
    entry.enabled = entry.enabled !== false;
    entry.at = entry.at || Date.now();
    var keep = get(entry.id);
    if (keep && keep.kind === "chrome" && entry.kind === "chrome") {
      entry.files = Object.assign({}, keep.files, entry.files);
      entry.assets = Object.assign({}, keep.assets, entry.assets);
    }
    put(entry);
    if (entry.enabled) activate(entry);
    return entry;
  }
  function enable(id) {
    var e = get(id);
    if (!e) return null;
    e.enabled = true;
    put(e);
    activate(e);
    return e;
  }
  function disable(id) {
    var e = get(id);
    if (!e) return null;
    e.enabled = false;
    dropStyle(id);
    dropWidgets(id);
    pages = pages.filter(function (p) {
      return p.ext !== id;
    });
    put(e);
    return e;
  }
  function remove(id) {
    disable(id);
    write(
      list().filter(function (e) {
        return e.id !== id;
      }),
    );
    N.store.del(DATA + id);
    pages = pages.filter(function (p) {
      return p.ext !== id;
    });
    off("*", null);
    if (openId === id) closePopup();
    return true;
  }
  function clear() {
    list().forEach(function (e) {
      dropStyle(e.id);
      dropWidgets(e.id);
    });
    pages = [];
    N.store.del(KEY);
    write([]);
  }

  /* ---------- chrome popup host ----------
     The popup gets its own frame with an opaque origin (sandbox, no
     allow-same-origin), which is what keeps a Chrome extension from reaching
     NULL. Its local css/js are inlined so a data: origin can load them, and
     a chrome.* shim is injected ahead of its own scripts. */
  var panel = null;
  var openId = null;

  var SHIM = [
    "(function(){",
    "  var id = %ID%, man = %MAN%, seq = 0, waits = {}, listening = [];",
    "  function call(cmd, payload){",
    "    return new Promise(function(res){",
    "      var rid = ++seq;",
    "      waits[rid] = res;",
    "      parent.postMessage({ nullChrome: 1, id: id, cmd: cmd, payload: payload || null, rid: rid }, '*');",
    "    });",
    "  }",
    "  window.addEventListener('message', function(ev){",
    "    var m = ev.data;",
    "    if (!m || !m.nullChromeReply) return;",
    "    if (m.cmd === 'runtime.message' && m.rid === 0){ listening.forEach(function(fn){ try { fn(m.payload, { id: m.from || null }, function(){}); } catch (e) {} }); return; }",
    "    var w = waits[m.rid];",
    "    delete waits[m.rid];",
    "    if (w) w(m.value);",
    "  });",
    "  function keysOf(o){ var out = []; Object.keys(o || {}).forEach(function(k){ out.push(k); }); return out; }",
    "  var area = {",
    "    get: function(k, cb){ return call('storage.get', k).then(function(v){ if (cb) cb(v); return v; }); },",
    "    set: function(o, cb){ return call('storage.set', o).then(function(){ if (cb) cb(); }); },",
    "    remove: function(k, cb){ return call('storage.remove', k).then(function(){ if (cb) cb(); }); },",
    "    clear: function(cb){ return call('storage.clear').then(function(){ if (cb) cb(); }); },",
    "  };",
    "  var chrome = window.chrome = window.chrome || {};",
    "  chrome.runtime = chrome.runtime || {};",
    "  chrome.runtime.id = id;",
    "  chrome.runtime.getManifest = function(){ return man; };",
    "  chrome.runtime.getURL = function(p){ return String(p || ''); };",
    "  chrome.runtime.lastError = null;",
    "  chrome.runtime.onMessage = { addListener: function(fn){ listening.push(fn); } };",
    "  chrome.runtime.sendMessage = function(msg, cb){ var p = call('runtime.sendMessage', msg); if (cb) p.then(cb); return p; };",
    "  chrome.storage = { local: area, sync: area, managed: area, onChanged: { addListener: function(){}, removeListener: function(){} } };",
    "  /* no tabs, no windows, no background: say so once, quietly, instead of",
    "     throwing where a popup cannot see why */",
    "  chrome.tabs = { query: function(q, cb){ if (cb) cb([]); return Promise.resolve([]); } };",
    "  chrome.notifications = { create: function(){} };",
    "  window.browser = window.browser || chrome;",
    "})();",
  ].join("\n");

  function popupDoc(entry) {
    var files = entry.files || {};
    var assets = entry.assets || {};
    var path = entry.popup || "";
    var html = files[path];
    if (html == null) {
      Object.keys(files).some(function (p) {
        if (/popup\.html?$/i.test(p)) {
          html = files[p];
          path = p;
          return true;
        }
        return false;
      });
    }
    if (html == null) {
      html =
        "<body style=\"font:14px/1.6 system-ui;padding:18px;color:#ddd;background:#101012\">" +
        "<p><b>" + esc(entry.name) + "</b> has no popup page NULL can find.</p>" +
        "<p style=\"opacity:.7\">Pick the folder again and make sure its manifest points at a popup, or add a popup.html next to it.</p></body>";
    }

    var dir = path.indexOf("/") > 0 ? path.slice(0, path.lastIndexOf("/") + 1) : "";
    function look(ref) {
      if (!ref || /^[a-z]+:|^\/\//i.test(ref)) return null;
      var clean = ref.replace(/^\.\//, "");
      var hit = files[dir + clean] || assets[dir + clean] || files[clean] || assets[clean];
      if (hit != null) return { text: files[dir + clean] != null || files[clean] != null, value: hit };
      return null;
    }

    html = html
      .replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi, function (whole, href) {
        var f = look(href);
        if (!f || !f.text) return whole;
        return "<style>" + f.value + "</style>";
      })
      .replace(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi, function (whole, src) {
        var f = look(src);
        if (!f || !f.text) return whole;
        /* the closing tag is split so this file can itself be inlined into a
           <script> block (the check scripts do exactly that, and a literal
           end tag here would end the block early) */
        return "<script>" + f.value + "<\/script>";
      })
      .replace(/(src|href)=["']([^"']+)["']/gi, function (whole, attr, ref) {
        var f = look(ref);
        if (!f) return whole;
        return attr + '="' + (f.text ? "data:text/plain;charset=utf-8," + encodeURIComponent(f.value) : f.value) + '"';
      });

    var shim = SHIM.replace("%ID%", JSON.stringify(entry.id)).replace("%MAN%", JSON.stringify(entry.manifest || {}));
    html = html.replace(/<head([^>]*)>/i, "<head$1><script>" + shim + "<\/script>");
    if (!/<head/i.test(html)) html = "<head><script>" + shim + "<\/script></head>" + html;
    return html;
  }

  function esc(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function closePopup() {
    if (panel) panel.remove();
    panel = null;
    openId = null;
  }

  /* under the puzzle button when there is one, which is where a browser puts
     a popup; otherwise pinned to the top right. */
  function placePanel() {
    var anchor = document.querySelector('[data-ic="extensions"]');
    var r = anchor ? anchor.getBoundingClientRect() : null;
    var w = Math.min(380, window.innerWidth - 20);
    panel.style.width = w + "px";
    var left = r ? Math.min(Math.max(10, r.right - w), window.innerWidth - w - 10) : window.innerWidth - w - 16;
    var top = r ? r.bottom + 8 : 16;
    panel.style.left = left + "px";
    panel.style.top = Math.min(top, Math.max(16, window.innerHeight - 120)) + "px";
  }

  /* a native extension's own window: the same panel a Chrome popup gets, but
     no iframe, because a .nullext already runs in the page. Whatever it put
     in "html" is mounted here, then popup:open fires with the element so its
     own code can wire it up. */
  function openHtml(id) {
    var e = get(id);
    if (!e || !e.html) return null;
    closePopup();
    openId = id;
    var box = d.h("div", { class: "ext-html" });
    box.innerHTML = e.html;
    panel = d.h("div", { class: "ext-pop glass", role: "dialog", "aria-label": e.name + " window" }, [
      d.h("div", { class: "ep-head" }, [
        d.h("span", { class: "ep-ic" }, [d.icon(e.icon || "puzzle")]),
        d.h("div", { class: "ep-txt" }, [d.h("b", null, e.name), d.h("span", null, "native · v" + e.version)]),
        d.h("button", { type: "button", class: "ep-x", title: "Close", "aria-label": "Close window", onclick: closePopup }, [d.icon("x")]),
      ]),
      box,
      d.h("div", { class: "ep-foot" }, "Runs inside NULL with full power, exactly like the extension itself."),
    ]);
    document.body.appendChild(panel);
    placePanel();
    emit("popup:open", { id: id, el: box });
    return panel;
  }

  function openPopup(id) {
    var e = get(id);
    if (!e) return null;
    closePopup();
    openId = id;

    var frame = d.h("iframe", {
      class: "ext-frame",
      sandbox: "allow-scripts allow-forms allow-modals allow-popups",
      title: e.name + " popup",
    });
    frame.setAttribute("srcdoc", popupDoc(e));

    panel = d.h("div", { class: "ext-pop glass", role: "dialog", "aria-label": e.name + " popup" }, [
      d.h("div", { class: "ep-head" }, [
        d.h("span", { class: "ep-ic" }, [d.icon("puzzle")]),
        d.h("div", { class: "ep-txt" }, [d.h("b", null, e.name), d.h("span", null, "popup only · v" + e.version)]),
        d.h("button", { type: "button", class: "ep-x", title: "Close", "aria-label": "Close popup", onclick: closePopup }, [d.icon("x")]),
      ]),
      frame,
      d.h("div", { class: "ep-foot" }, "Runs sandboxed: it can show UI and keep its own storage, nothing else."),
    ]);
    document.body.appendChild(panel);
    placePanel();
    return panel;
  }

  /* the bridge the sandboxed popups talk to */
  window.addEventListener("message", function (ev) {
    var m = ev.data;
    if (!m || m.nullChrome !== 1) return;
    var id = m.id;
    var reply = function (value) {
      try {
        ev.source.postMessage({ nullChromeReply: true, rid: m.rid, value: value, cmd: m.cmd }, "*");
      } catch (err) {}
    };
    var b = bag(id);
    var p = m.payload;
    if (m.cmd === "storage.get") {
      if (p == null) return reply(Object.assign({}, b));
      if (typeof p === "string") return reply(b[p] === undefined ? {} : { [p]: b[p] });
      if (Array.isArray(p)) {
        var pick = {};
        p.forEach(function (k) {
          if (b[k] !== undefined) pick[k] = b[k];
        });
        return reply(pick);
      }
      var defaults = Object.assign({}, p);
      Object.keys(defaults).forEach(function (k) {
        if (b[k] !== undefined) defaults[k] = b[k];
      });
      return reply(defaults);
    }
    if (m.cmd === "storage.set") {
      Object.assign(b, p || {});
      bagWrite(id, b);
      return reply(true);
    }
    if (m.cmd === "storage.remove") {
      (Array.isArray(p) ? p : [p]).forEach(function (k) {
        delete b[k];
      });
      bagWrite(id, b);
      return reply(true);
    }
    if (m.cmd === "storage.clear") {
      bagWrite(id, {});
      return reply(true);
    }
    if (m.cmd === "runtime.sendMessage") {
      /* delivered to whatever other popup is open in this tab. There is no
         background page to catch it, which is the honest limit of a popup
         extension here. */
      if (panel) {
        var frame = panel.querySelector("iframe");
        if (frame && frame.contentWindow) {
          try {
            frame.contentWindow.postMessage({ nullChromeReply: true, cmd: "runtime.message", rid: 0, from: id, payload: p }, "*");
          } catch (err) {}
        }
      }
      return reply(undefined);
    }
    reply(undefined);
  });

  /* ---------- boot ---------- */
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    enabled().forEach(function (e) {
      if (e.kind !== "native") return;
      activate(e);
    });
    emit("boot", { page: (document.body && document.body.dataset.page) || "" });
    /* the shell builds the nav before this runs, so it gets told to repaint */
    if (N.bus && N.bus.emit) N.bus.emit("ext");
  }

  /* ---------- the nav menu ----------
     shell.js builds the puzzle button and asks for its contents here, so the
     menu and the manager can never disagree about what is installed. */
  function menu(host, close) {
    host.textContent = "";
    var all = list();
    if (!all.length) {
      host.appendChild(
        d.h("p", { class: "em-none" }, "No extensions installed yet. A .nullext gets full power; an imported Chrome popup only gets its own little window."),
      );
    }
    all.forEach(function (e) {
      var row = d.h("button", {
        type: "button",
        class: "em-row" + (e.enabled === false ? " off" : ""),
        onclick: function () {
          if (close) close();
          /* a popup is a popup: a Chrome import gets its sandboxed frame, a
             .nullext that shipped HTML gets the same panel without one */
          if (e.kind === "chrome") {
            openPopup(e.id);
            return;
          }
          if (e.html) {
            openHtml(e.id);
            return;
          }
          location.href = N.url("/extensions") + "#" + encodeURIComponent(e.id);
        },
      }, [
        d.h("span", { class: "em-ic" }, [d.icon(e.icon || (e.kind === "chrome" ? "puzzle" : "code"))]),
        d.h("span", { class: "em-txt" }, [
          d.h("b", null, e.name),
          d.h(
            "span",
            null,
            (e.kind === "chrome" ? "popup" : e.html ? "window" : "native") + " · " + (e.enabled === false ? "off" : "on"),
          ),
        ]),
      ]);
      host.appendChild(row);
    });
    host.appendChild(
      d.h("a", { class: "em-all", href: N.url("/extensions") }, [d.icon("puzzle"), "Manage extensions"]),
    );
    /* extension-added nav items ride in the same menu */
    var extra = list().filter(function (e) {
      return e.enabled !== false && e.nav;
    });
    extra.forEach(function (e) {
      (e.nav || []).forEach(function (item) {
        host.appendChild(
          d.h("a", { class: "em-all", href: N.url(item.url || "/extensions") }, [d.icon(item.icon || "code"), item.title || e.name]),
        );
      });
    });
    return host;
  }

  /* Every event core code emits, with what it carries. The manager prints
     this list, so adding a hook in the site means adding a line here. */
  var EVENTS = [
    "boot        once per page load, after the page's own script",
    "coins:earn  { n, total } whenever coins land in the balance",
    "coins:spend { n, total } whenever something is bought",
    "xp:gain     { n, level, xp }",
    "unlock      { type, id } when an item becomes owned",
    "quest:done  { id, coins }",
    "crate:open  { coins, streak }",
    "player:open { entry } a game or app launching in the player",
    "player:close { entry }",
    "search:open open the search overlay",
    "search:query { q, n } every keystroke it uses",
    "popup:open  { id, el } a .nullext's own window opening",
    "egg:pop     { text } when a hidden page talks back",
    "theme:apply { kind, id } a pack or particle set going on",
    "tour:done   { skipped } the first-run tour ending",
  ];

  /* ---------- what /root and the manager describe ---------- */
  function summary() {
    var all = list();
    return {
      total: all.length,
      native: all.filter(function (e) {
        return e.kind === "native";
      }).length,
      chrome: all.filter(function (e) {
        return e.kind === "chrome";
      }).length,
      enabled: all.filter(function (e) {
        return e.enabled !== false;
      }).length,
      pages: pages.length,
      hooks: hookNames(),
      ids: all.map(function (e) {
        return e.id;
      }),
    };
  }

  N.ext = {
    KEY: KEY,
    EVENTS: EVENTS,
    list: list,
    get: get,
    install: install,
    enable: enable,
    disable: disable,
    remove: remove,
    clear: clear,
    parse: parse,
    fromFiles: fromFiles,
    installable: LIMIT,
    boot: boot,
    emit: emit,
    on: on,
    off: off,
    hooks: () => hooks,
    hookNames: hookNames,
    api: api,
    pages: pageList,
    menu: menu,
    slot: slot,
    openPopup: openPopup,
    openHtml: openHtml,
    closePopup: closePopup,
    popupOpen: function () {
      return openId;
    },
    data: bag,
    dataWrite: bagWrite,
    summary: summary,
    styleFor: styleFor,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(boot, 0);
    });
  } else {
    setTimeout(boot, 0);
  }
})();
