"use client";

// MSW-backed demo island for the ContactForm `previewRoute` (#235, retargeted
// from the retired /preview/dialog demo — #215/#212).
//
// Mounted by pages/preview/contact.tsx — a real, live-fetching page reachable
// at /preview/contact, per the previewRoute escape hatch documented in
// packages/ui/STORIES.md §6. That contract requires request mocking to live
// ENTIRELY inside the demo page/island, never in *.stories.tsx or component
// source under packages/ui/src — this file is where it belongs.
//
// On mount, starts an MSW browser worker registered at a base-aware
// `/preview/` service-worker scope (see withBase), exactly as the retired
// dialog demo did — so the mocked fetch interception can NEVER shadow other
// root-host routes.
//
// ContactForm's own DOM-enhancer (createFormEnhancer) queries
// `document.querySelectorAll('[data-contact-form]')` document-wide rather
// than scoping to a particular mounted instance, so mounting two ContactForm
// + ContactFormEnhancer pairs simultaneously would double-wire listeners on
// both. Instead of two parallel instances (as the old Dialog demo could do,
// since Dialog is a plain controlled component with no document-wide query),
// this demo keeps a SINGLE ContactForm mounted and lets the visitor pick
// which mocked submit adapter drives it — a success path and a 5xx-recovery
// path, matching the two variants the dialog demo exercised. `key={variant}`
// forces a clean remount (back to the input panel) on each switch so a
// half-completed attempt under one variant never leaks into the other.
//
// `msw`/`msw/browser` are loaded via a runtime `import()` INSIDE startWorker,
// never as a static top-level import. `msw/browser` defines
// `class CancelableMessageEvent extends MessageEvent {}` at module top
// level, which evaluates its `extends` clause immediately on load — and
// zfb's static build runs a "paths() evaluation" pass in an embedded V8 host
// that has no browser globals (no `MessageEvent`). A static
// `import ... from "msw/browser"` here is reachable from pages/preview/
// contact.tsx and would get pulled into that pass's bundle even though this
// component never touches MSW during SSR, crashing the build with
// `ReferenceError: MessageEvent is not defined`. A dynamic import deferred
// to a browser-only effect (mirrors the zdtp STOPGAP lazy-load in
// src/components/design-token-panel-bootstrap.tsx) keeps msw's module body
// out of that pass entirely — ContactFormDemo itself stays a static top-level
// export so zfb's island scanner still finds and binds the real component
// (see pages/lib/_body-end-islands.tsx's orphan-component note).
import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { ContactForm } from "@zudo-sg/ui/src/forms/contact-form/contact-form.tsx";
import ContactFormEnhancer from "@zudo-sg/ui/src/forms/contact-form/contact-form-enhancer.tsx";
import type { FormSubmitAdapter } from "@zudo-sg/ui/src/forms/lib/create-form-enhancer.ts";
import { withBase } from "@/utils/base";

const SUCCESS_PATH = "/preview/api/contact-demo/send";
const FAILURE_PATH = "/preview/api/contact-demo/send-fail";

// Base-aware Service Worker scope: registering under `${base}/preview/`
// (rather than the MSW default of the page's own directory, or the site
// root) is a deliberate isolation boundary — this mocked worker must never
// intercept fetches made by other root-host routes/pages.
const PREVIEW_SCOPE = withBase("/preview/");

// Module-scoped so the worker starts at most once even if the island
// re-mounts (e.g. client-router page swaps, see settings.dynamicPageTransition).
let workerReady: Promise<void> | null = null;

function startWorker(): Promise<void> {
  if (!workerReady) {
    workerReady = Promise.all([import("msw"), import("msw/browser")])
      .then(async ([{ http, HttpResponse }, { setupWorker }]) => {
        // Handler patterns are base-prefixed to match the base-prefixed URLs
        // `fetch` actually requests (see submitSuccess/submitFailure below) —
        // both derived from the same withBase() call so they can't drift apart.
        const worker = setupWorker(
          http.post(withBase(SUCCESS_PATH), async () => HttpResponse.json({ ok: true })),
          http.post(withBase(FAILURE_PATH), async () =>
            HttpResponse.json(
              { message: "Server rejected the request (mocked failure)." },
              { status: 500 },
            ),
          ),
        );
        const registration = await worker.start({
          serviceWorker: {
            url: withBase("/mockServiceWorker.js"),
            options: { scope: PREVIEW_SCOPE },
          },
          // Any request this page makes outside the two mocked endpoints
          // above (none currently) passes through untouched instead of erroring.
          onUnhandledRequest: "bypass",
        });
        // Assert the registered scope actually landed under /preview/ — a
        // silent scope drift (e.g. from a future base-path change) would let
        // this mock worker intercept unrelated routes, which the previewRoute
        // contract forbids.
        if (registration && !registration.scope.endsWith(PREVIEW_SCOPE)) {
          throw new Error(
            `[contact-form-demo] MSW registered at unexpected scope "${registration.scope}"; expected it to end with "${PREVIEW_SCOPE}".`,
          );
        }
      })
      .catch((err: unknown) => {
        // Re-arm on failure: a rejected init (dynamic import, SW registration,
        // or the scope assertion above) must NOT pin the module cache at a
        // permanently rejected promise, which would leave the island stuck at
        // "error" with no retry for the whole session. Reset the cache so a
        // later mount/trigger starts fresh. The successful-once guard above is
        // untouched, so once the worker is up no redundant second start runs.
        workerReady = null;
        throw err;
      });
  }
  return workerReady;
}

const submitSuccess: FormSubmitAdapter = async (data) => {
  const res = await fetch(withBase(SUCCESS_PATH), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Unexpected response: ${res.status}`);
};

const submitFailure: FormSubmitAdapter = async (data) => {
  const res = await fetch(withBase(FAILURE_PATH), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (res.ok) return;
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  // ContactFormEnhancer catches this and renders it in the confirm panel's
  // error slot, keeping the confirm panel open so the visitor can retry —
  // see create-form-enhancer.ts's submit-adapter contract.
  throw new Error(body?.message ?? `Request failed with status ${res.status}`);
};

type Variant = "success" | "failure";

function ContactFormDemo(): JSX.Element {
  const [workerState, setWorkerState] = useState<"starting" | "ready" | "error">("starting");
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [variant, setVariant] = useState<Variant>("success");

  useEffect(() => {
    startWorker()
      .then(() => setWorkerState("ready"))
      .catch((err: unknown) => {
        setWorkerError(err instanceof Error ? err.message : String(err));
        setWorkerState("error");
      });
  }, []);

  if (workerState === "error") {
    return (
      <p role="alert" class="text-sm text-danger">
        Failed to start the mock service worker: {workerError}
      </p>
    );
  }

  if (workerState === "starting") {
    return <p class="text-sm text-muted">Starting mock service worker…</p>;
  }

  const activePath = variant === "success" ? SUCCESS_PATH : FAILURE_PATH;

  return (
    <div class="flex flex-col gap-vsp-md">
      <p class="text-sm text-muted">
        "Send this" issues a real <code>fetch</code> against an endpoint intercepted by MSW,
        scoped to <code>{PREVIEW_SCOPE}</code>.
      </p>
      <div class="flex gap-hsp-md">
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-hsp-md py-hsp-xs text-sm hover:border-border-strong"
          aria-pressed={variant === "success"}
          onClick={() => setVariant("success")}
        >
          Success demo
        </button>
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-hsp-md py-hsp-xs text-sm hover:border-border-strong"
          aria-pressed={variant === "failure"}
          onClick={() => setVariant("failure")}
        >
          5xx-recovery demo
        </button>
      </div>
      <p class="text-sm text-muted">
        {variant === "success" ? (
          <>
            Submitting calls <code>POST {withBase(activePath)}</code>, mocked to resolve 200. The
            form advances to the complete panel.
          </>
        ) : (
          <>
            Submitting calls <code>POST {withBase(activePath)}</code>, mocked to reject with 500.
            The confirm panel stays open and shows the error so you can retry.
          </>
        )}
      </p>

      <div key={variant} style={{ maxWidth: "760px" }}>
        <ContactForm />
        <ContactFormEnhancer onSubmit={variant === "success" ? submitSuccess : submitFailure} />
      </div>
    </div>
  );
}
ContactFormDemo.displayName = "ContactFormDemo";

export default ContactFormDemo;
