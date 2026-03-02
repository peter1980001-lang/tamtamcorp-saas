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

  // Minimal ultra-modern chat outline icon
  var icon = `
<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M6 6.5h12a2.5 2.5 0 0 1 2.5 2.5v4a5 5 0 0 1-5 5H11l-5 3v-3H6A2.5 2.5 0 0 1 3.5 15.5V9A2.5 2.5 0 0 1 6 6.5Z"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"/>
</svg>`;

  var css = `
#tamtam-launcher-btn{
  position: fixed;
  bottom: 20px;
  ${position}: 20px;
  z-index: ${zIndex};

  width: 58px;
  height: 58px;
  border-radius: 999px;

  background: rgba(255,255,255,0.55);
  border: 1px solid rgba(255,255,255,0.45);

  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);

  box-shadow:
    0 20px 60px rgba(0,0,0,0.25),
    inset 0 1px 0 rgba(255,255,255,0.70);

  display:flex;
  align-items:center;
  justify-content:center;
  padding: 0;
  cursor: pointer;

  -webkit-tap-highlight-color: transparent;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

#tamtam-launcher-btn:hover{
  transform: translateY(-2px);
  box-shadow:
    0 28px 80px rgba(0,0,0,0.28),
    inset 0 1px 0 rgba(255,255,255,0.75);
}

#tamtam-launcher-btn:active{
  transform: translateY(0px) scale(0.98);
}

#tamtam-launcher-btn svg{
  width: 22px;
  height: 22px;
  color: #111;
}

#tamtam-widget-backdrop{
  position: fixed;
  inset: 0;
  z-index: ${Number(zIndex) - 1};
  display: none;

  background: rgba(0,0,0,0.18);

  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

#tamtam-widget-wrap{
  position: fixed;
  bottom: 90px;
  ${position}: 20px;
  z-index: ${zIndex};

  width: 420px;
  height: 640px;

  border-radius: 28px;

  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(255,255,255,0.45);

  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);

  box-shadow:
    0 40px 100px rgba(0,0,0,0.25),
    inset 0 1px 0 rgba(255,255,255,0.60);

  overflow: hidden;
  display: none;
}

#tamtam-widget-iframe{
  width: 100%;
  height: 100%;
  border: 0;
  display:block;
  background: transparent;
}

@media (max-width: 480px){
  #tamtam-widget-wrap{
    ${position}: 10px;
    bottom: 78px;
    width: calc(100vw - 20px);
    height: min(78vh, 720px);
  }
  #tamtam-launcher-btn{
    ${position}: 14px;
    bottom: 14px;
  }
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