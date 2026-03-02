(function () {
  var script = document.currentScript;
  if (!script) return;

  var publicKey = script.getAttribute("data-public-key") || script.getAttribute("data-client") || "";
  publicKey = String(publicKey || "").trim();

  if (!publicKey) {
    console.error("[TamTam Widget] Missing data-public-key");
    return;
  }

  var host = script.getAttribute("data-host") || "https://tamtamcorp-saas-pcwl.vercel.app";
  var position = script.getAttribute("data-position") || "right"; // "right" | "left"
  var zIndex = script.getAttribute("data-z") || "2147483000";

  // Optional brand controls from embed snippet
  var accent = String(script.getAttribute("data-accent") || "#F5C400").trim();
  var iconVariant = String(script.getAttribute("data-icon") || "agent").trim(); // "agent" | "spark"

  // ---- helpers
  function safeCssColor(s) {
    s = String(s || "").trim();
    if (!s) return "";
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
    if (/^(rgb|rgba|hsl|hsla)\(/i.test(s)) return s;
    return "";
  }
  accent = safeCssColor(accent) || "#F5C400";

  function el(tag, props) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === "style") {
          Object.assign(node.style, props.style);
        } else if (k === "className") {
          node.className = props.className;
        } else if (k === "html") {
          node.innerHTML = props.html;
        } else {
          node.setAttribute(k, props[k]);
        }
      });
    }
    return node;
  }

  // ---- CSS injection (scoped via ids)
  var css = `
#tamtam-launcher-btn{
  position: fixed;
  bottom: 20px;
  ${position}: 20px;
  z-index: ${zIndex};
  width: 56px;
  height: 56px;
  border-radius: 999px;
  border: 1px solid rgba(17,17,17,0.10);
  background: rgba(255,255,255,0.96);
  box-shadow: 0 18px 50px rgba(17,17,17,0.18);
  cursor: pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
  transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
}
#tamtam-launcher-btn:hover{
  transform: translateY(-1px);
  box-shadow: 0 22px 60px rgba(17,17,17,0.22);
}
#tamtam-launcher-btn:active{
  transform: translateY(0px) scale(0.98);
}
#tamtam-launcher-btn::after{
  content:"";
  position:absolute;
  inset:-3px;
  border-radius:999px;
  border:2px solid color-mix(in srgb, ${accent} 22%, transparent 78%);
  pointer-events:none;
}
#tamtam-launcher-btn svg{
  width: 24px;
  height: 24px;
  color: #111;
}

#tamtam-widget-wrap{
  position: fixed;
  bottom: 86px;
  ${position}: 20px;
  width: 392px;
  height: 560px;
  border: 1px solid rgba(17,17,17,0.10);
  border-radius: 18px;
  box-shadow: 0 18px 60px rgba(17,17,17,0.20);
  overflow: hidden;
  background: #fff;
  z-index: ${zIndex};
  display: none;
  transform-origin: ${position} bottom;
}

#tamtam-widget-topbar{
  height: 42px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: 0 10px 0 12px;
  background: color-mix(in srgb, ${accent} 8%, white 92%);
  border-bottom: 1px solid rgba(17,17,17,0.08);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
}
#tamtam-widget-title{
  font-size: 13px;
  font-weight: 800;
  color: #111;
  display:flex;
  align-items:center;
  gap: 8px;
  min-width:0;
}
#tamtam-widget-title .dot{
  width:8px;height:8px;border-radius:999px;
  background:${accent};
  box-shadow: 0 0 0 3px color-mix(in srgb, ${accent} 18%, transparent 82%);
  flex:0 0 auto;
}
#tamtam-widget-close{
  width: 30px;
  height: 30px;
  border-radius: 10px;
  border: 1px solid rgba(17,17,17,0.10);
  background: rgba(255,255,255,0.85);
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
}
#tamtam-widget-close:hover{
  background: #fff;
}
#tamtam-widget-iframe{
  width: 100%;
  height: calc(100% - 42px);
  border: 0;
  display:block;
}
#tamtam-widget-backdrop{
  position: fixed;
  inset: 0;
  z-index: ${zIndex - 1};
  display: none;
  background: rgba(0,0,0,0.0);
}
@media (max-width: 480px){
  #tamtam-widget-wrap{
    ${position}: 10px;
    bottom: 76px;
    width: calc(100vw - 20px);
    height: min(74vh, 640px);
  }
  #tamtam-launcher-btn{
    ${position}: 14px;
    bottom: 14px;
  }
}
`;
  var styleTag = el("style", { html: css });
  document.head.appendChild(styleTag);

  // ---- icon svgs
  function iconSvg(variant) {
    if (variant === "spark") {
      // Sparkle + chat
      return `
<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M7 11.5c0-3.314 2.686-6 6-6h4a3 3 0 0 1 3 3v3c0 3.314-2.686 6-6 6h-2.8l-3.2 2.2v-2.2H13c-3.314 0-6-2.686-6-6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <path d="M5 4l.6 1.7L7.3 6.3 5.6 6.9 5 8.6 4.4 6.9 2.7 6.3 4.4 5.7 5 4Z" fill="currentColor"/>
  <path d="M18 2l.8 2.2L21 5l-2.2.8L18 8l-.8-2.2L15 5l2.2-.8L18 2Z" fill="currentColor"/>
</svg>`;
    }

    // Default: support agent headset
    return `
<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M4 12a8 8 0 1 1 16 0v3.5a2.5 2.5 0 0 1-2.5 2.5H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M8 12v-1a4 4 0 0 1 8 0v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M6 12h2v4H6a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="2"/>
  <path d="M18 12h-2v4h2a2 2 0 0 0 2-2v0a2 2 0 0 0-2-2Z" stroke="currentColor" stroke-width="2"/>
</svg>`;
  }

  // ---- elements
  var btn = el("button", { id: "tamtam-launcher-btn", "aria-label": "Open chat", type: "button" });
  btn.innerHTML = iconSvg(iconVariant);

  var backdrop = el("div", { id: "tamtam-widget-backdrop" });

  var frameWrap = el("div", { id: "tamtam-widget-wrap" });

  var topbar = el("div", { id: "tamtam-widget-topbar" });
  var title = el("div", { id: "tamtam-widget-title" });
  title.innerHTML = `<span class="dot"></span><span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">AI Assistant</span>`;

  var closeBtn = el("button", { id: "tamtam-widget-close", "aria-label": "Close chat", type: "button" });
  closeBtn.innerHTML = `
<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style="width:18px;height:18px;color:#111;">
  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`;

  topbar.appendChild(title);
  topbar.appendChild(closeBtn);

  var iframe = el("iframe", { id: "tamtam-widget-iframe", title: "Chat Widget" });

  var site = window.location.origin;
  var v = Date.now();

  iframe.src =
    host.replace(/\/$/, "") +
    "/widget?public_key=" +
    encodeURIComponent(publicKey) +
    "&client=" +
    encodeURIComponent(publicKey) +
    "&site=" +
    encodeURIComponent(site) +
    "&v=" +
    encodeURIComponent(String(v));

  frameWrap.appendChild(topbar);
  frameWrap.appendChild(iframe);

  function isOpen() {
    return frameWrap.style.display !== "none";
  }

  function open() {
    frameWrap.style.display = "block";
    backdrop.style.display = "block";
    btn.setAttribute("aria-expanded", "true");
  }

  function close() {
    frameWrap.style.display = "none";
    backdrop.style.display = "none";
    btn.setAttribute("aria-expanded", "false");
  }

  function toggle() {
    if (isOpen()) close();
    else open();
  }

  btn.addEventListener("click", toggle);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen()) close();
  });

  // mount
  document.body.appendChild(backdrop);
  document.body.appendChild(btn);
  document.body.appendChild(frameWrap);
})();