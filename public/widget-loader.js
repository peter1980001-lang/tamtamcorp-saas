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

  var btn = document.createElement("button");
  btn.innerText = "Chat";
  btn.setAttribute("aria-label", "Open chat");
  btn.style.position = "fixed";
  btn.style.bottom = "20px";
  btn.style[position] = "20px";
  btn.style.zIndex = zIndex;
  btn.style.padding = "12px 14px";
  btn.style.borderRadius = "999px";
  btn.style.border = "1px solid #111";
  btn.style.background = "#111";
  btn.style.color = "#fff";
  btn.style.cursor = "pointer";
  btn.style.fontFamily = "system-ui";

  var frameWrap = document.createElement("div");
  frameWrap.style.position = "fixed";
  frameWrap.style.bottom = "70px";
  frameWrap.style[position] = "20px";
  frameWrap.style.width = "380px";
  frameWrap.style.height = "520px";
  frameWrap.style.border = "1px solid rgba(0,0,0,0.15)";
  frameWrap.style.borderRadius = "16px";
  frameWrap.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
  frameWrap.style.overflow = "hidden";
  frameWrap.style.background = "#fff";
  frameWrap.style.zIndex = zIndex;
  frameWrap.style.display = "none";

  var iframe = document.createElement("iframe");
  var site = window.location.origin;
  var v = Date.now();

  // ✅ pass both public_key and legacy client for compatibility + pass site for allowlist
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

  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.setAttribute("title", "Chat Widget");

  frameWrap.appendChild(iframe);

  function toggle() {
    frameWrap.style.display = frameWrap.style.display === "none" ? "block" : "none";
  }

  btn.addEventListener("click", toggle);

  document.body.appendChild(btn);
  document.body.appendChild(frameWrap);
})();
