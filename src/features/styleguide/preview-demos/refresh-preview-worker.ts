// MSW 3.0.4 starts with an existing worker before its background update finishes.
// It also cannot finish stop() if initial registration fails during enable().
// Register and activate first, while MSW's network is still disabled.
export async function refreshPreviewWorker(url: string, scope: string): Promise<void> {
  if (!navigator.serviceWorker) return;
  const expectedScope = new URL(scope, location.origin).href;
  const expectedScript = new URL(url, location.origin).href;
  const registration = await navigator.serviceWorker.register(expectedScript, {
    scope: expectedScope,
    updateViaCache: "none",
  });
  if (registration.scope !== expectedScope) throw new Error("Unexpected preview service worker scope.");
  if (registration.active) await registration.update();
  const pending = registration.installing ?? registration.waiting ?? registration.active;
  if (!pending || pending.scriptURL !== expectedScript) throw new Error("Missing preview service worker.");
  await new Promise<void>((resolve, reject) => {
    const changed = () => {
      if (pending.state !== "activated" && pending.state !== "redundant") return;
      pending.removeEventListener("statechange", changed);
      if (pending.state === "activated") resolve();
      else reject(new Error("Updated preview service worker became redundant before activation."));
    };
    pending.addEventListener("statechange", changed);
    changed();
  });
  // MSW reloads an associated document without a controller. Wait for the
  // generated worker's clients.claim() instead of losing the current mount.
  await new Promise<void>((resolve) => {
    const controlled = () => {
      if (navigator.serviceWorker.controller !== registration.active) return;
      navigator.serviceWorker.removeEventListener("controllerchange", controlled);
      resolve();
    };
    navigator.serviceWorker.addEventListener("controllerchange", controlled);
    controlled();
  });
}
