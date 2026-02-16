(function () {
  // Prefer currentScript, fallback to last script tag (some builders break currentScript)
  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName("script");
    script = scripts && scripts.length ? scripts[scripts.length - 1] : null;
  }
  if (!script) return;

  // ✅ Accept BOTH attribute names
  var client =
    script.getAttribute("data-client") ||
    script.getAttribute("data-public-key") ||
    script.getAttribute("data-publicKey");

  if (!client) {
    console.error("[TamTam Widget] Missing data-client (or data-public-key). Example:");
    console.error(
      '<script src="https://YOUR-SAAS-DOMAIN/widget-loader.js" data-client="pk_..." ></script>'
    );
    return;
  }

  // Host where the widget UI lives (defaults to the SaaS origin hosting this loader)
  var host =
    script.getAttribute("data-host") ||
    (function () {
      try {
        // script.src origin (safer than window.location.origin on client site)
        return new URL(script.src).origin;
      } catch (e) {
        return window.location.origin;
      }
    })();

  var position = (script.getAttribute("data-position") || "right").toLowerCase();
  if (position !== "left" && position !== "right") position = "right";

  var zIndex = String(script.getAttribute("data-z") || "2147483000");

  // Button
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

  // iFrame container
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
  iframe.src =
    host.replace(/\/$/, "") +
    "/widget?client=" +
    encodeURIComponent(client);
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.setAttribute("title", "Chat Widget");

  frameWrap.appendChild(iframe);

  function toggle() {
    frameWrap.style.display = frameWrap.style.display === "none" ? "block" : "none";
  }

  btn.addEventListener("click", toggle);

  // Ensure body exists
  function mount() {
    if (!document.body) return setTimeout(mount, 25);
    document.body.appendChild(btn);
    document.body.appendChild(frameWrap);
    console.log("[TamTam Widget] mounted", { host: host, client: client, position: position });
  }
  mount();
})();
