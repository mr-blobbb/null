/* NULL — modal.js
   One shared modal system. Every dialog (welcome, warning, SGGAMES, danger,
   redirect confirm…) uses the exact same shell: same size, spacing, borders.
   Long content scrolls inside the modal; it never resizes the window. */
(function () {
  var N = (window.N = window.N || {});
  var d = N.dom;

  var stack = [];

  var BTN_CLS = {
    primary: "btn btn-primary",
    outline: "btn btn-outline",
    ghost: "btn btn-ghost",
    danger: "btn btn-danger",
    "outline-danger": "btn btn-outline-danger",
  };

  function open(opts) {
    opts = opts || {};
    var onClose = opts.onClose || null;

    var btnCls = d.h("div", { class: "modal-ic" + (opts.iconTone ? " " + opts.iconTone : "") }, [
      d.icon(opts.icon || "info"),
    ]);

    var head = d.h("div", { class: "modal-head" }, [
      opts.noIcon ? null : btnCls,
      d.h("h3", null, opts.title || ""),
    ]);

    var body = d.h("div", { class: "modal-body" });
    var content = opts.body;
    if (content == null) content = "";
    if (typeof content === "string") {
      body.innerHTML = content;
    } else {
      body.appendChild(content);
    }

    var foot = d.h("div", { class: "modal-foot" });
    (opts.actions || []).forEach(function (a) {
      var btn = d.h(
        "button",
        {
          type: "button",
          class: BTN_CLS[a.variant || "primary"],
          onclick: function () {
            if (a.onClick) a.onClick();
            close(ov);
          },
        },
        a.label,
      );
      foot.appendChild(btn);
    });

    var modal = d.h("div", { class: "modal glass-2 elev" }, [head, body, foot]);
    var ov = d.h("div", { class: "modal-ov" }, [modal]);
    ov.addEventListener("mousedown", function (e) {
      if (e.target === ov && opts.dismissible !== false) close(ov);
    });
    document.body.appendChild(ov);
    requestAnimationFrame(function () {
      ov.classList.add("open");
    });

    stack.push(ov);
    if (stack.length) document.body.style.overflow = "hidden";

    function close() {
      if (!ov.parentNode) return;
      ov.classList.remove("open");
      setTimeout(function () {
        ov.remove();
        var i = stack.indexOf(ov);
        if (i >= 0) stack.splice(i, 1);
        if (!stack.length) document.body.style.overflow = "";
        if (onClose) onClose();
      }, 200);
    }

    ov._close = close;
    ov._data = { dismissible: opts.dismissible };
    return { close: close, body: body, overlay: ov };
  }

  /* one document-level Escape handler for the topmost modal */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var top = stack[stack.length - 1];
    if (top && top._close) {
      var o = top._data || {};
      if (o.dismissible === false) return;
      top._close();
    }
  });

  /* convenience confirm */
  function confirm(opts) {
    return open({
      title: opts.title || "Are you sure?",
      body: opts.body || "",
      icon: opts.icon || "info",
      iconTone: opts.iconTone || "",
      dismissible: opts.dismissible,
      actions: [
        {
          label: opts.cancelLabel || "Cancel",
          variant: "outline",
          onClick: function () {
            if (opts.onCancel) opts.onCancel();
          },
        },
        {
          label: opts.okLabel || "Okay",
          variant: opts.okVariant || "primary",
          onClick: function () {
            if (opts.onOk) opts.onOk();
          },
        },
      ],
    });
  }

  /* SGGAMES — typed anywhere on the site (case-insensitive) */
  var sg = null;
  function armSgGames() {
    if (sg) return;
    sg = "";
    document.addEventListener("keydown", function (e) {
      if (e.repeat) return;
      var k = e.key;
      if (k && k.length === 1 && /[a-zA-Z0-9]/.test(k)) {
        sg = (sg + k.toLowerCase()).slice(-14);
        if (sg.indexOf("sggames") >= 0) {
          sg = "";
          showSgGames();
        }
      }
    });
  }
  function showSgGames() {
    open({
      title: "You switched? Wow!",
      icon: "zap",
      body: "<p>Honestly, we're glad you switched. Everyone should always get their very best experience from the site they play on.</p>",
      actions: [{ label: "I agree!", variant: "primary" }],
    });
  }

  N.modal = {
    open: open,
    confirm: confirm,
    armSgGames: armSgGames,
    closeTop: function () {
      var top = stack[stack.length - 1];
      if (top && top._close) top._close();
    },
  };
})();
