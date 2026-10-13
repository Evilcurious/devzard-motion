/*!
 * Devzard Motion — chat widget
 * Drop-in: <script src="https://YOUR_APP/widget.js" defer></script>
 * Options via data-attributes on the script tag: data-color, data-position ("left"|"right")
 */
(function () {
  if (window.__devzardWidgetLoaded) return;
  window.__devzardWidgetLoaded = true;

  var current = document.currentScript;
  var ORIGIN = (function () {
    try {
      return new URL(current.src).origin;
    } catch (e) {
      return window.location.origin;
    }
  })();

  var opts = {
    color: current && current.getAttribute ? current.getAttribute("data-color") : null,
    position: current && current.getAttribute ? current.getAttribute("data-position") : null,
  };

  var state = {
    name: "Assistant",
    welcome: "Hi! How can we help?",
    color: opts.color || "#38bdf8",
    position: opts.position === "left" ? "left" : "right",
    open: false,
    busy: false,
    sessionId: null,
    messages: [],
  };

  try {
    state.sessionId = localStorage.getItem("devzard_session");
  } catch (e) {}

  var css = [
    ".dz-root{position:fixed;bottom:20px;z-index:2147483000;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}",
    ".dz-right{right:20px}.dz-left{left:20px}",
    ".dz-btn{width:56px;height:56px;border-radius:999px;border:0;cursor:pointer;display:grid;place-items:center;color:#04121c;box-shadow:0 10px 30px -8px rgba(0,0,0,.6);transition:transform .15s ease}",
    ".dz-btn:hover{transform:translateY(-2px)}",
    ".dz-panel{position:absolute;bottom:72px;width:min(370px,calc(100vw - 40px));height:min(520px,calc(100vh - 120px));background:#0b0d14;border:1px solid rgba(255,255,255,.1);border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px -16px rgba(0,0,0,.75)}",
    ".dz-right .dz-panel{right:0}.dz-left .dz-panel{left:0}",
    ".dz-head{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px}",
    ".dz-title{font-size:14px;font-weight:600;color:#e2e8f0}",
    ".dz-sub{font-size:11px;color:#64748b}",
    ".dz-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}",
    ".dz-msg{max-width:82%;padding:9px 12px;font-size:13.5px;line-height:1.45;border-radius:14px;white-space:pre-wrap;word-break:break-word}",
    ".dz-them{background:rgba(255,255,255,.06);color:#e2e8f0;align-self:flex-start;border-bottom-left-radius:4px}",
    ".dz-me{background:rgba(56,189,248,.18);color:#e2e8f0;align-self:flex-end;border-bottom-right-radius:4px;border:1px solid rgba(56,189,248,.28)}",
    ".dz-form{border-top:1px solid rgba(255,255,255,.08);padding:10px;display:flex;gap:8px;align-items:flex-end}",
    ".dz-input{flex:1;background:#10131d;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:9px 11px;color:#e2e8f0;font-size:13.5px;outline:none;resize:none;max-height:110px;min-height:38px;font-family:inherit}",
    ".dz-input:focus{border-color:rgba(56,189,248,.6)}",
    ".dz-send{border:0;border-radius:10px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;color:#04121c}",
    ".dz-typing{font-size:12px;color:#64748b;padding:2px 4px}",
    ".dz-foot{text-align:center;font-size:10px;color:#475569;padding:6px 0 8px}",
    ".dz-close{margin-left:auto;background:transparent;border:0;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1}",
  ].join("");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function icon(color) {
    var s = document.createElement("span");
    s.style.display = "grid";
    s.style.placeItems = "center";
    s.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
    return s;
  }

  function boot() {
    var style = document.createElement("style");
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    var root = el("div", "dz-root dz-" + state.position);
    var panel = el("div", "dz-panel");
    panel.style.display = "none";

    var head = el("div", "dz-head");
    var titleWrap = el("div");
    var title = el("div", "dz-title", state.name);
    var sub = el("div", "dz-sub", "Online · replies instantly");
    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);
    var close = el("button", "dz-close", "×");
    close.setAttribute("aria-label", "Close chat");
    close.onclick = toggle;
    head.appendChild(titleWrap);
    head.appendChild(close);

    var body = el("div", "dz-body");
    var form = el("form", "dz-form");
    var input = document.createElement("textarea");
    input.className = "dz-input";
    input.placeholder = "Type your message…";
    input.rows = 1;
    var send = el("button", "dz-send", "Send");
    send.type = "submit";
    send.style.background = state.color;
    form.appendChild(input);
    form.appendChild(send);

    var foot = el("div", "dz-foot", "Powered by Devzard Motion");

    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(form);
    panel.appendChild(foot);

    var btn = el("button", "dz-btn");
    btn.style.background = state.color;
    btn.setAttribute("aria-label", "Open chat");
    btn.appendChild(icon());
    btn.onclick = toggle;

    root.appendChild(panel);
    root.appendChild(btn);
    document.body.appendChild(root);

    function toggle() {
      state.open = !state.open;
      panel.style.display = state.open ? "flex" : "none";
      if (state.open) {
        if (!body.children.length) push("them", state.welcome);
        setTimeout(function () {
          input.focus();
          body.scrollTop = body.scrollHeight;
        }, 40);
      }
    }

    function push(who, text) {
      var m = el("div", "dz-msg " + (who === "me" ? "dz-me" : "dz-them"), text);
      body.appendChild(m);
      body.scrollTop = body.scrollHeight;
      return m;
    }

    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(110, input.scrollHeight) + "px";
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text || state.busy) return;
      input.value = "";
      input.style.height = "auto";
      push("me", text);
      send1(text);
    });

    function send1(text) {
      state.busy = true;
      send.disabled = true;
      var typing = el("div", "dz-typing", state.name + " is typing…");
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;

      fetch(ORIGIN + "/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: state.sessionId }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (data.sessionId) {
            state.sessionId = data.sessionId;
            try {
              localStorage.setItem("devzard_session", data.sessionId);
            } catch (e) {}
          }
          push("them", data.reply || "Sorry — something went wrong.");
        })
        .catch(function () {
          push("them", "Sorry, I could not reach the server. Please try again.");
        })
        .finally(function () {
          typing.remove();
          state.busy = false;
          send.disabled = false;
        });
    }
  }

  function hydrate() {
    fetch(ORIGIN + "/api/chat", { method: "GET" })
      .then(function (r) {
        return r.json();
      })
      .then(function (cfg) {
        if (cfg && cfg.name) state.name = cfg.name;
        if (cfg && cfg.welcome) state.welcome = cfg.welcome;
        if (!opts.color && cfg && cfg.color) state.color = cfg.color;
        if (!opts.position && cfg && cfg.position) state.position = cfg.position === "left" ? "left" : "right";
      })
      .catch(function () {})
      .finally(boot);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrate);
  } else {
    hydrate();
  }
})();
