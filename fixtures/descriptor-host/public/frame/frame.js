// Framework-free external preview frame (epic #879, S7 / issue #880 protocol
// v1). Served verbatim from public/frame/ — zfb copies `public/` straight
// into `dist/`, unbundled — so this file speaks the protocol with plain
// browser APIs and no build step of its own.
//
// The protocol's message-type strings and PROTOCOL_VERSION are copied here
// rather than imported from `@takazudo/zudo-sg/preview/messages`: a static
// asset under `public/` is served as-is (no bundler resolves bare specifiers
// for it), so a real ES module import of an installed npm package would need
// either an import map or its own bundling step. The source module
// (`packages/styleguide/src/preview/messages.ts`) documents itself as a
// framework-free leaf published for exactly this kind of consumer; copying
// its small, version-pinned string constants keeps this frame a plain static
// file while still speaking the same wire protocol. If the protocol ever
// grows past a handful of literals, switch this file to a real import
// instead of letting the copy drift.
(function () {
  "use strict";

  var PROTOCOL_VERSION = 1;
  var MSG_REQUEST_READY = "sg:requestReady";
  var MSG_READY = "sg:ready";
  var MSG_HEIGHT = "sg:height";

  var params = new URLSearchParams(window.location.search);
  var slug = params.get("slug") || "";
  var variant = params.get("variant") || "";

  var root = document.getElementById("root");
  root.textContent = "slug=" + slug + " variant=" + variant;
  root.setAttribute("data-frame-slug", slug);
  root.setAttribute("data-frame-variant", variant);

  function post(message) {
    // Same-origin only, like the parent's own rule (issue #880).
    window.parent.postMessage(message, window.location.origin);
  }

  function reportReady() {
    post({ type: MSG_READY, v: PROTOCOL_VERSION, slug: slug, variant: variant });
  }

  function reportHeight() {
    post({
      type: MSG_HEIGHT,
      v: PROTOCOL_VERSION,
      height: document.documentElement.scrollHeight,
      slug: slug,
      variant: variant,
    });
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== window.location.origin) return;
    var data = event.data;
    if (data && data.type === MSG_REQUEST_READY) reportReady();
  });

  reportReady();
  reportHeight();
  window.addEventListener("resize", reportHeight);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(reportHeight).observe(document.body);
  }
})();
