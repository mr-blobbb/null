/* NULL · legal.js
   Each info page (about / privacy / terms / cookies / district / license)
   ships raw markdown inside a <script type="text/markdown"> block. This
   renders it into the .md-out container. Owners never write <h1>/<p> by hand.

   On top of the rendering it dresses the page up a bit, because nobody
   enjoys reading rules:
     · a plain-English "short version" card, from the page's own #tldr block
     · a sticky contents rail built from the h2s, with a scroll-spy
     · numbered sections, and a copy-link button that appears on hover
     · a reading progress line under the nav
     · a sign-off card linking to the rest of the paperwork

   Everything is optional: a page with no #tldr, or with two headings, just
   gets the parts that apply. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var OTHER = [
    { t: "Terms", u: "/terms" },
    { t: "Privacy", u: "/privacy" },
    { t: "Cookies", u: "/cookies" },
    { t: "License", u: "/license" },
    { t: "District", u: "/district" },
  ];

  function slug(text, used) {
    var s = String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "section";
    var n = used[s] || 0;
    used[s] = n + 1;
    return n ? s + "-" + (n + 1) : s;
  }

  /* ---------- the markdown body ---------- */
  function renderBody() {
    var src = d.qs('script[type="text/markdown"]');
    var out = d.qs(".md-out");
    if (!src || !out) return null;
    var text = (src.textContent || "")
      .replace(/^\s*<!--[\s\S]*?-->\s*/g, "") // strip the WRITE MARKDOWN HERE marker
      .replace(/^\n+/, "");
    out.innerHTML = N.md.render(text);
    return out;
  }

  /* ---------- numbered sections + copy links ---------- */
  function dress(out) {
    var used = {};
    var heads = d.qsa("h2", out);
    heads.forEach(function (h, i) {
      /* the markdown already prints its own "1." in most of these docs:
         drop the duplicate so the badge is the only number */
      var label = (h.textContent || "").trim();
      var clean = label.replace(/^\d+[.)]\s*/, "");
      h.textContent = "";
      h.id = h.id || slug(clean, used);
      /* kept for the contents rail: the heading's own text is about to gain
         a badge and a button, and neither belongs in a link label */
      h.dataset.title = clean;
      h.appendChild(d.h("span", { class: "sec-n" }, String(i + 1).padStart(2, "0")));
      h.appendChild(d.h("span", null, clean));

      var btn = d.h("button", {
        type: "button",
        class: "anch",
        title: "Copy a link to this section",
        "aria-label": "Copy a link to this section",
      }, [d.icon("copy")]);
      btn.addEventListener("click", function () {
        var url = location.origin + location.pathname + "#" + h.id;
        var done = function () {
          btn.classList.add("done");
          btn.textContent = "";
          btn.appendChild(d.icon("check"));
          d.toast("Link to \u201c" + clean + "\u201d copied", { icon: "check" });
          setTimeout(function () {
            btn.classList.remove("done");
            btn.textContent = "";
            btn.appendChild(d.icon("copy"));
          }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, done);
        } else {
          done();
        }
      });
      h.appendChild(btn);
    });
    return heads;
  }

  /* ---------- the "short version" card ---------- */
  function shortVersion() {
    var src = d.qs("#tldr");
    var host = d.qs(".legal-body");
    if (!src || !host) return;
    var text = (src.textContent || "").trim();
    if (!text) return;
    var card = d.h("div", { class: "tl-card" }, [
      d.h("div", { class: "tl-head" }, [
        d.h("span", { class: "tl-ic" }, [d.icon("zap")]),
        d.h("b", null, "The short version"),
        d.h("span", { class: "tl-sub" }, "no lawyer required"),
      ]),
      d.h("div", { class: "md-out tl-md", html: N.md.render(text) }),
      d.h("div", { class: "tl-note" }, [
        d.icon("info"),
        "That is genuinely the whole thing in plain words. Everything below is the same deal, spelled out properly.",
      ]),
    ]);
    host.insertBefore(card, host.firstChild);
  }

  /* ---------- contents rail ---------- */
  function contents(heads) {
    var rail = d.qs("#legalRail");
    var toc = d.qs("#legalToc");
    if (!rail || !toc || heads.length < 3) return;
    rail.classList.add("on");
    heads.forEach(function (h, i) {
      toc.appendChild(
        d.h("a", { href: "#" + h.id }, [
          d.h("i", null, String(i + 1).padStart(2, "0")),
          d.h("span", null, h.dataset.title || ""),
        ]),
      );
    });

    var links = d.qsa("a", toc);
    var raf = null;
    function spy() {
      raf = null;
      var line = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nh")) || 60) + 90;
      var best = 0;
      heads.forEach(function (h, i) {
        if (h.getBoundingClientRect().top <= line) best = i;
      });
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 6) best = heads.length - 1;
      links.forEach(function (a, i) {
        a.classList.toggle("on", i === best);
      });
    }
    window.addEventListener("scroll", function () {
      if (raf) return;
      raf = requestAnimationFrame(spy);
    }, { passive: true });
    spy();
  }

  /* ---------- reading progress ---------- */
  function progress() {
    var bar = d.qs(".read-bar");
    if (!bar) return;
    var fill = bar.querySelector("i");
    function paint() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var pct = max > 60 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 100;
      fill.style.width = pct + "%";
      bar.classList.toggle("on", pct > 1 && pct < 99.5);
    }
    window.addEventListener("scroll", paint, { passive: true });
    window.addEventListener("resize", paint);
    paint();
  }

  /* ---------- sign-off: the rest of the paperwork ---------- */
  function signOff() {
    var host = d.qs(".legal-body");
    if (!host) return;
    var here = location.pathname.replace(/\/+$/, "").split("/").pop() || "";
    var links = d.h("div", { class: "lf-links" });
    OTHER.filter(function (o) {
      return o.u.replace("/", "") !== here;
    }).forEach(function (o) {
      links.appendChild(
        d.h("a", { class: "btn btn-outline btn-sm", href: N.url(o.u) }, [o.t, d.icon("chevR")]),
      );
    });
    links.appendChild(
      d.h("a", { class: "btn btn-primary btn-sm", href: N.url("/") }, [d.icon("play"), "Enough reading"]),
    );
    host.appendChild(
      d.h("div", { class: "legal-foot" }, [
        d.h("div", { class: "lf-txt" }, [
          d.h("b", null, "Still awake?"),
          d.h("span", null, "That is the paperwork done. The rest of NULL is considerably more fun, and the other pages here are one click away if you want to compare notes."),
        ]),
        links,
      ]),
    );
  }

  function init() {
    var out = renderBody();
    if (!out) return;
    /* the paperwork pages get the whole treatment; any other markdown page
       (about) just gets its text rendered */
    var paper = !!d.qs(".legal-body");
    if (paper) {
      contents(dress(out));
      shortVersion();
      signOff();
    }
    progress();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
