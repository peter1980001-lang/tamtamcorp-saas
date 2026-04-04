(function () {
  var script = document.currentScript;
  if (!script) return;

  var publicKey = script.getAttribute("data-public-key") || script.getAttribute("data-client") || "";
  publicKey = String(publicKey || "").trim();
  if (!publicKey) {
    console.error("[TamTam Widget] Missing data-public-key");
    return;
  }

  var host = String(script.getAttribute("data-host") || "").trim();
  if (!host) {
    host = "https://tamtamcorp-saas-pcwl.vercel.app";
  }
  var position = script.getAttribute("data-position") || "right";
  var zIndex = script.getAttribute("data-z") || "2147483000";

  // Proactive trigger: auto-open after delay (0 = disabled)
  var proactiveDelay = parseInt(script.getAttribute("data-delay") || "5", 10);
  // Returning visitor: name stored in localStorage after lead capture
  var visitorName = "";
  try { visitorName = localStorage.getItem("tt_visitor_name") || ""; } catch(e) {}

  var accent = String(script.getAttribute("data-accent") || "#111111").trim();
  function safeCssColor(s) {
    s = String(s || "").trim();
    if (!s) return "";
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
    if (/^(rgb|rgba|hsl|hsla)\(/i.test(s)) return s;
    return "";
  }
  accent = safeCssColor(accent) || "#111111";

  // Optional social links via data attributes
  var whatsapp  = String(script.getAttribute("data-whatsapp")  || "").trim();
  var instagram = String(script.getAttribute("data-instagram") || "").trim();
  var linkedin  = String(script.getAttribute("data-linkedin")  || "").trim();

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

  var icons = {
    chat: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M7 7h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M10 7v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M14 7v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.92"/>
</svg>`,
    whatsapp: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.418A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
  <path d="M8.5 9.5c.5 1 1.5 2.5 3 3.5s2.5 1.5 3 1.5c.3 0 .5-.1.7-.3l.6-.6c.2-.2.2-.5 0-.7l-1.2-1.2c-.2-.2-.5-.2-.7 0l-.4.4c-.7-.4-1.4-1-1.9-1.7l.4-.4c.2-.2.2-.5 0-.7L10.8 8.3c-.2-.2-.5-.2-.7 0l-.6.6c-.2.2-.3.4-.3.7 0 .5.1.9.3.9z" fill="currentColor"/>
</svg>`,
    instagram: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <rect x="2" y="2" width="20" height="20" rx="6" stroke="currentColor" stroke-width="1.7"/>
  <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.7"/>
  <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
</svg>`,
    linkedin: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" stroke-width="1.7"/>
  <path d="M7 10v7M7 7v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M11 17v-4c0-1.5 1-2 2-2s2 .5 2 2v4M11 10v7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  };

  var css = `
#tamtam-stack{
  position: fixed;
  bottom: 20px;
  ${position}: 20px;
  z-index: ${zIndex};
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 10px;
}

.tamtam-fab{
  width: 56px;
  height: 56px;
  border-radius: 999px;
  background: ${accent};
  border: none;
  box-shadow:
    0 8px 24px rgba(0,0,0,0.18),
    0 2px 6px rgba(0,0,0,0.10);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
}
.tamtam-fab:hover{
  transform: translateY(-2px);
  box-shadow:
    0 14px 36px rgba(0,0,0,0.22),
    0 4px 10px rgba(0,0,0,0.12);
}
.tamtam-fab:active{ transform: translateY(0) scale(0.96); }
.tamtam-fab svg{ width: 22px; height: 22px; color: #fff; }

#tamtam-widget-backdrop{
  position: fixed;
  inset: 0;
  z-index: ${zIndex - 1};
  display: none;
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
  background: transparent;
}

@media (max-width: 480px){
  #tamtam-stack{ ${position}: 14px; bottom: 14px; }
  #tamtam-widget-wrap{
    ${position}: 10px;
    bottom: 76px;
    width: calc(100vw - 20px);
    height: min(78vh, 720px);
    border-radius: 24px;
  }
  #tamtam-widget-wrap::before{ border-radius: 24px; }
}
`;
  document.head.appendChild(el("style", { html: css }));

  // Build the stack container
  var stack = el("div", { id: "tamtam-stack" });

  // Chat launcher (always first / bottom)
  var btn = el("button", { class: "tamtam-fab", id: "tamtam-launcher-btn", "aria-label": "Open chat", type: "button" });
  btn.innerHTML = icons.chat;
  stack.appendChild(btn);

  // WhatsApp
  if (whatsapp) {
    var waHref = whatsapp.startsWith("http") ? whatsapp : "https://wa.me/" + whatsapp.replace(/\D/g, "");
    var waBtn = el("a", { class: "tamtam-fab", href: waHref, target: "_blank", rel: "noopener noreferrer", "aria-label": "WhatsApp" });
    waBtn.innerHTML = icons.whatsapp;
    waBtn.style.opacity = "0.85";
    stack.appendChild(waBtn);
  }

  // Instagram
  if (instagram) {
    var igBtn = el("a", { class: "tamtam-fab", href: instagram, target: "_blank", rel: "noopener noreferrer", "aria-label": "Instagram" });
    igBtn.innerHTML = icons.instagram;
    igBtn.style.opacity = "0.85";
    stack.appendChild(igBtn);
  }

  // LinkedIn
  if (linkedin) {
    var liBtn = el("a", { class: "tamtam-fab", href: linkedin, target: "_blank", rel: "noopener noreferrer", "aria-label": "LinkedIn" });
    liBtn.innerHTML = icons.linkedin;
    liBtn.style.opacity = "0.85";
    stack.appendChild(liBtn);
  }

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
    encodeURIComponent(String(v)) +
    (visitorName ? "&visitor_name=" + encodeURIComponent(visitorName) : "");

  frameWrap.appendChild(iframe);

  function isOpen() { return frameWrap.style.display !== "none"; }
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
  function toggle() { if (isOpen()) close(); else open(); }

  btn.addEventListener("click", function () {
    // User manually interacted — disable proactive trigger
    proactiveTriggered = true;
    toggle();
  });
  backdrop.addEventListener("click", close);
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen()) close();
  });

  document.body.appendChild(backdrop);
  document.body.appendChild(stack);
  document.body.appendChild(frameWrap);

  // Proactive trigger — fires once per session, respects user closing
  var proactiveTriggered = false;
  if (proactiveDelay > 0) {
    setTimeout(function () {
      if (!proactiveTriggered && !isOpen()) {
        proactiveTriggered = true;
        open();
      }
    }, proactiveDelay * 1000);
  }
})();
