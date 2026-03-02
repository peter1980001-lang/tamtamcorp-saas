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
  var position = script.getAttribute("data-position") || "right";
  var zIndex = script.getAttribute("data-z") || "2147483000";

  // Optional brand hint (accent only, no yellow tint)
  var accent = String(script.getAttribute("data-accent") || "#111111").trim();
  function safeCssColor(s) {
    s = String(s || "").trim();
    if (!s) return "";
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
    if (/^(rgb|rgba|hsl|hsla)\(/i.test(s)) return s;
    return "";
  }
  accent = safeCssColor(accent) || "#111111";

  function el(tag, props) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === "style") Object.assign(node.style, props.style);
        else if (k === "html") node.innerHTML = props.html;
        else node.setAttribute(k, props[k]);
      });
    }
    return node;
  }

  // Modern minimal icon (spark/ai)
  var icon = `
<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M7.5 12c0-3.314 2.686-6 6-6h3a3 3 0 0 1 3 3v2.5c0 3.314-2.686 6-6 6H12l-3.5 2.5V17.5h-1c-3.314 0-6-2.686-6-6V10a3 3 0 0 1 3-3h2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <path d="M6 4l.7 2L9 6.7 7 7.4 6.3 9.4 5.6 7.4 3.6 6.7 5.6 6 6 4Z" fill="currentColor"/>
  <path d="M18 2l.8 2.2L21 5l-2.2.8L18 8l-.8-2.2L15 5l2.2-.8L18 2Z" fill="currentColor"/>
</svg>`;

  var css = `
#tamtam-launcher-btn{
  position: fixed;
  bottom: 20px;
  ${position}: 20px;
  z-index: ${zIndex};
  width: 56px;
  height: 56px;
  border-radius: 999px;

  /* GLASS */
  background: rgba(255,255,255,0.55);
  border: 1px solid rgba(255,255,255,0.45);
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);

  box-shadow:
    0 18px 55px rgba(0,0,0,0.22),
    inset 0 1px 0 rgba(255,255,255,0.75);

  cursor: pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
  transition: transform 140ms ease, box-shadow 140ms ease;
}
#tamtam-launcher-btn:hover{
  transform: translateY(-2px);
  box-shadow:
    0 24px 80px rgba(0,0,0,0.26),
    inset 0 1px 0 rgba(255,255,255,0.80);
}
#tamtam-launcher-btn:active{ transform: translateY(0px) scale(0.98); }

#tamtam-launcher-btn::after{
  content:"";
  position:absolute;
  inset:-3px;
  border-radius:999px;

  /* subtle ring, NOT yellow */
  border: 2px solid rgba(17,17,17,0.10);
  pointer-events:none;
}

#tamtam-launcher-btn svg{ width:24px; height:24px; color:#111; }

#tamtam-widget-backdrop{
  position: fixed;
  inset: 0;
  z-index: ${zIndex - 1};
  display: none;

  /* dim + blur behind */
  background: rgba(0,0,0,0.18);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

#tamtam-widget-wrap{
  position: fixed;
  bottom: 86px;
  ${position}: 20px;
  width: 392px;
  height: 600px;
  border-radius: 26px;
  overflow: hidden;

  /* GLASS */
  background: rgba(255,255,255,0.62);
  border: 1px solid rgba(255,255,255,0.45);
  backdrop-filter: blur(26px) saturate(180%);
  -webkit-backdrop-filter: blur(26px) saturate(180%);

  box-shadow:
    0 30px 100px rgba(0,0,0,0.26),
    inset 0 1px 0 rgba(255,255,255,0.70);

  z-index: ${zIndex};
  display: none;
}

/* Optional: inner frame highlight (premium) */
#tamtam-widget-wrap::before{
  content:"";
  position:absolute;
  inset:0;
  border-radius: 26px;
  pointer-events:none;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.65),
    inset 0 -1px 0 rgba(0,0,0,0.04);
}

#tamtam-widget-iframe{
  width: 100%;
  height: 100%;
  border: 0;
  display:block;

  /* make iframe look integrated with glass */
  background: transparent;
}

@media (max-width: 480px){
  #tamtam-widget-wrap{
    ${position}: 10px;
    bottom: 76px;
    width: calc(100vw - 20px);
    height: min(78vh, 720px);
    border-radius: 24px;
  }
  #tamtam-widget-wrap::before{ border-radius: 24px; }
  #tamtam-launcher-btn{ ${position}: 14px; bottom: 14px; }
}
`;
  document.head.appendChild(el("style", { html: css }));

  var btn = el("button", { id: "tamtam-launcher-btn", "aria-label": "Open chat", type: "button" });
  btn.innerHTML = icon;

  var backdrop = el("div", { id: "tamtam-widget-backdrop" });
  var frameWrap = el("div", { id: "tamtam-widget-wrap" });

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
  backdrop.addEventListener("click", close);
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen()) close();
  });

  document.body.appendChild(backdrop);
  document.body.appendChild(btn);
  document.body.appendChild(frameWrap);
})();