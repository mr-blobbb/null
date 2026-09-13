/* NULL · markdown.js
   Minimal markdown renderer used by the info pages (about / privacy / terms /
   cookies / district / license). Owners edit plain markdown; it renders here. */
(function () {
  var N = (window.N = window.N || {});

  function esc(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function inline(s) {
    var out = "";
    /* links accept http(s) URLs and site-relative paths like [Settings](/settings.html) */
    var re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(((?:https?:)?\/[^)\s]+)\))/g;
    var last = 0;
    var m;
    while ((m = re.exec(s))) {
      out += esc(s.slice(last, m.index));
      if (m[1][0] === "`") {
        out += "<code>" + esc(m[1].slice(1, -1)) + "</code>";
      } else if (m[1].indexOf("**") === 0) {
        out += "<strong>" + esc(m[1].slice(2, -2)) + "</strong>";
      } else if (m[1][0] === "*") {
        out += "<em>" + esc(m[1].slice(1, -1)) + "</em>";
      } else {
        out += '<a href="' + esc(m[3]) + '" rel="noopener">' + esc(m[2]) + "</a>";
      }
      last = m.index + m[0].length;
    }
    out += esc(s.slice(last));
    return out;
  }

  function render(src) {
    var lines = String(src || "").replace(/\r\n/g, "\n").split("\n");
    var html = [];
    var para = [];
    var list = null;
    var inCode = false;
    var codeBuf = [];

    function flushPara() {
      if (para.length) {
        html.push("<p>" + para.map(inline).join(" ") + "</p>");
        para = [];
      }
    }
    function flushList() {
      if (list) {
        html.push(list.tag + list.items.join("") + list.tag.replace("ul", "/ul").replace("ol", "/ol"));
        list = null;
      }
    }

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var line = raw.trim();

      if (inCode) {
        if (/^```/.test(line)) {
          html.push("<pre><code>" + codeBuf.join("\n") + "</code></pre>");
          codeBuf = [];
          inCode = false;
        } else {
          codeBuf.push(esc(raw));
        }
        continue;
      }
      if (/^```/.test(line)) {
        flushPara();
        flushList();
        inCode = true;
        continue;
      }
      if (line === "") {
        flushPara();
        flushList();
        continue;
      }
      if (/^#{1,6}\s/.test(line)) {
        flushPara();
        flushList();
        var lvl = line.match(/^(#+)/)[1].length;
        html.push("<h" + lvl + ">" + inline(line.replace(/^#+\s*/, "")) + "</h" + lvl + ">");
        continue;
      }
      if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
        flushPara();
        flushList();
        html.push("<hr>");
        continue;
      }
      if (/^&gt;\s?/.test(line)) {
        flushPara();
        flushList();
        html.push("<blockquote>" + inline(line.replace(/^&gt;\s?/, "")) + "</blockquote>");
        continue;
      }
      if (/^\s*[-*]\s+/.test(raw)) {
        flushPara();
        if (!list || list.tag !== "<ul>") {
          flushList();
          list = { tag: "<ul>", items: [] };
        }
        list.items.push("<li>" + inline(line.replace(/^\s*[-*]\s+/, "")) + "</li>");
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(raw)) {
        flushPara();
        if (!list || list.tag !== "<ol>") {
          flushList();
          list = { tag: "<ol>", items: [] };
        }
        list.items.push("<li>" + inline(line.replace(/^\s*\d+[.)]\s+/, "")) + "</li>");
        continue;
      }
      if (list) {
        flushList();
      }
      para.push(line);
    }
    flushPara();
    flushList();
    if (inCode) html.push("<pre><code>" + codeBuf.join("\n") + "</code></pre>");
    return html.join("\n");
  }

  N.md = { render: render };
})();
