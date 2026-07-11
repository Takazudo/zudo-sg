"use client";

// MSW-backed demo island for the Dialog `previewRoute` (#215).
//
// Mounted by pages/preview/dialog.tsx — a real, live-fetching page reachable
// at /preview/dialog, per the previewRoute escape hatch documented in
// packages/ui/STORIES.md §6. That contract requires request mocking to live
// ENTIRELY inside the demo page/island, never in *.stories.tsx or component
// source under packages/ui/src — this file is where it belongs.
//
// On mount, starts an MSW browser worker registered at a base-aware
// `/preview/` service-worker scope (see withBase) so the mocked fetch
// interception can NEVER shadow other root-host routes — only requests made
// while a document under /preview/ is in control fall inside the Service
// Worker's scope. Renders two independently controlled Dialog instances (from
// @zudo-sg/ui), each wired to a REAL `fetch` against a MOCKED endpoint: one
// resolves (success path), one returns a 5xx (failure path, exercising
// Dialog's built-in error-recovery — the dialog stays open and the error
// message renders, per dialog.tsx's onSubmit contract).
//
// `msw`/`msw/browser` are loaded via a runtime `import()` INSIDE startWorker,
// never as a static top-level import. `msw/browser` defines
// `class CancelableMessageEvent extends MessageEvent {}` at module top
// level, which evaluates its `extends` clause immediately on load — and
// zfb's static build runs a "paths() evaluation" pass in an embedded V8 host
// that has no browser globals (no `MessageEvent`). A static
// `import ... from "msw/browser"` here is reachable from pages/preview/
// dialog.tsx and got pulled into that pass's bundle even though this
// component never touches MSW during SSR, crashing the build with
// `ReferenceError: MessageEvent is not defined`. A dynamic import deferred
// to a browser-only effect (mirrors the zdtp STOPGAP lazy-load in
// src/components/design-token-panel-bootstrap.tsx) keeps msw's module body
// out of that pass entirely — DialogDemo itself stays a static top-level
// export so zfb's island scanner still finds and binds the real component
// (see pages/lib/_body-end-islands.tsx's orphan-component note).
import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { Dialog } from "@zudo-sg/ui";
import { withBase } from "@/utils/base";

const SUCCESS_PATH = "/preview/api/dialog-demo/save";
const FAILURE_PATH = "/preview/api/dialog-demo/save-fail";

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
    workerReady = Promise.all([import("msw"), import("msw/browser")]).then(
      async ([{ http, HttpResponse }, { setupWorker }]) => {
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
            `[dialog-demo] MSW registered at unexpected scope "${registration.scope}"; expected it to end with "${PREVIEW_SCOPE}".`,
          );
        }
      },
    );
  }
  return workerReady;
}

async function submitSuccess(): Promise<void> {
  const res = await fetch(withBase(SUCCESS_PATH), { method: "POST" });
  if (!res.ok) throw new Error(`Unexpected response: ${res.status}`);
}

async function submitFailure(): Promise<void> {
  const res = await fetch(withBase(FAILURE_PATH), { method: "POST" });
  if (res.ok) return;
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  // Dialog catches this and renders it in the error slot, keeping the dialog
  // open so the user can retry — see the Dialog onSubmit contract.
  throw new Error(body?.message ?? `Request failed with status ${res.status}`);
}

function DialogDemo(): JSX.Element {
  const [workerState, setWorkerState] = useState<"starting" | "ready" | "error">("starting");
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [failureOpen, setFailureOpen] = useState(false);

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
    return <p class="text-sm text-ink-mute">Starting mock service worker…</p>;
  }

  return (
    <div class="flex flex-col gap-vsp-md">
      <p class="text-sm text-ink-mute">
        Both buttons issue a real <code>fetch</code> against endpoints intercepted by
        MSW, scoped to <code>{PREVIEW_SCOPE}</code>.
      </p>
      <div class="flex gap-hsp-md">
        <button
          type="button"
          class="rounded-md border border-line bg-surface px-hsp-md py-hsp-xs text-sm hover:border-accent"
          onClick={() => setSuccessOpen(true)}
        >
          Open success demo
        </button>
        <button
          type="button"
          class="rounded-md border border-line bg-surface px-hsp-md py-hsp-xs text-sm hover:border-accent"
          onClick={() => setFailureOpen(true)}
        >
          Open failure demo
        </button>
      </div>

      <Dialog
        open={successOpen}
        title="Save changes (mocked success)"
        onClose={() => setSuccessOpen(false)}
        onSubmit={async () => {
          await submitSuccess();
          setSuccessOpen(false);
        }}
        submitLabel="Save"
      >
        Submitting calls <code>POST {withBase(SUCCESS_PATH)}</code>, mocked to resolve
        200. The dialog closes on success.
      </Dialog>

      <Dialog
        open={failureOpen}
        title="Save changes (mocked failure)"
        onClose={() => setFailureOpen(false)}
        onSubmit={submitFailure}
        submitLabel="Save"
      >
        Submitting calls <code>POST {withBase(FAILURE_PATH)}</code>, mocked to reject
        with 500. The dialog stays open and shows the error so you can retry.
      </Dialog>
    </div>
  );
}
DialogDemo.displayName = "DialogDemo";

export default DialogDemo;
