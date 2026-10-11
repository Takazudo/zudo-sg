"use client";

// MSW-backed demo island for the ContactForm `previewRoute` (#235, retargeted
// from the retired /preview/dialog demo — #215/#212).
//
// Mounted by pages/preview/contact.tsx — a real, live-fetching page reachable
// at /preview/contact, per the previewRoute escape hatch documented in
// packages/demo-ui/STORIES.md §6. That contract requires request mocking to live
// ENTIRELY inside the demo page/island, never in *.stories.tsx or component
// source under packages/demo-ui/src — this file is where it belongs.
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
// path, matching the two variants the dialog demo exercised. A keyed `For`
// forces a clean remount (back to the input panel) on each switch so a
// half-completed attempt under one variant never leaks into the other.
//
// `msw`/`msw/browser` are loaded via a runtime `import()` inside the activation callback,
// never as a static top-level import. `msw/browser` defines
// `class CancelableMessageEvent extends MessageEvent {}` at module top
// level, which evaluates its `extends` clause immediately on load — and
// zfb's static build runs a "paths() evaluation" pass in an embedded V8 host
// that has no browser globals (no `MessageEvent`). A static
// `import ... from "msw/browser"` here is reachable from pages/preview/
// contact.tsx and would get pulled into that pass's bundle even though this
// component never touches MSW during SSR, crashing the build with
// `ReferenceError: MessageEvent is not defined`. A dynamic import deferred
// to an activation callback (mirrors the zdtp lazy-load in
// packages/styleguide/src/token-tweak/preview-token-panel-bootstrap.tsx)
// keeps msw's module body out of that pass entirely — ContactFormDemo itself stays a static top-level
// export so zfb's island scanner still finds and binds the real component
// (see the static boundary in pages/lib/_body-end-islands.tsx).
import { signal, computed, getScope, For } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { ContactForm } from "@zudo-sg/demo-ui/src/forms/contact-form/contact-form.tsx";
import ContactFormEnhancer from "@zudo-sg/demo-ui/src/forms/contact-form/contact-form-enhancer.tsx";
import type { FormSubmitAdapter } from "@zudo-sg/demo-ui/src/forms/lib/create-form-enhancer.ts";
import { withBase } from "@/utils/base";

const SUCCESS_PATH = "/preview/api/contact-demo/send";
const FAILURE_PATH = "/preview/api/contact-demo/send-fail";

// Base-aware Service Worker scope: registering under `${base}/preview/`
// (rather than the MSW default of the page's own directory, or the site
// root) is a deliberate isolation boundary — this mocked worker must never
// intercept fetches made by other root-host routes/pages.
const PREVIEW_SCOPE = withBase("/preview/");

// A worker belongs to one activated island. Cleanup stops it, including when
// its asynchronous imports/registration finish after the island was disposed.
type MockWorker = ReturnType<typeof import("msw/browser")["setupWorker"]>;

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
  const scope = getScope();
  const workerState = signal<"starting" | "ready" | "error">("starting");
  const workerError = signal<string | null>(null);

  scope.onActivate(() => {
    let aborted = false;
    let worker: MockWorker | undefined;
    void Promise.all([import("msw"), import("msw/browser")])
      .then(async ([{ http, HttpResponse }, { setupWorker }]) => {
        if (aborted) return;
        worker = setupWorker(
          http.post(withBase(SUCCESS_PATH), () => HttpResponse.json({ ok: true })),
          http.post(withBase(FAILURE_PATH), () => HttpResponse.json(
            { message: "Server rejected the request (mocked failure)." },
            { status: 500 },
          )),
        );
        const registration = await worker.start({
          serviceWorker: {
            url: withBase("/mockServiceWorker.js"),
            options: { scope: PREVIEW_SCOPE },
          },
          onUnhandledRequest: "bypass",
        });
        if (aborted) { worker.stop(); return; }
        if (registration && !registration.scope.endsWith(PREVIEW_SCOPE)) {
          throw new Error(`[contact-form-demo] MSW registered at unexpected scope "${registration.scope}"; expected it to end with "${PREVIEW_SCOPE}".`);
        }
        workerState.value = "ready";
      })
      .catch((err: unknown) => {
        worker?.stop();
        if (aborted) return;
        workerError.value = err instanceof Error ? err.message : String(err);
        workerState.value = "error";
      });
    return () => { aborted = true; worker?.stop(); };
  });

  return <For each={computed(() => [workerState.value])} by={(state) => state}>
    {(state) => {
      if (state.value === "error") {
        return (
          <p role="alert" class="text-sm text-danger">
            Failed to start the mock service worker: {workerError.value}
          </p>
        );
      }

      if (state.value === "starting") {
        return <p class="text-sm text-muted">Starting mock service worker…</p>;
      }

      return <ContactFormVariants />;
    }}
  </For>;
}

function ContactFormVariants(): JSX.Element {
  const variant = signal<Variant>("success");
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
          aria-pressed={computed(() => String(variant.value === "success"))}
          on:click={() => { variant.value = "success"; }}
        >Success demo</button>
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-hsp-md py-hsp-xs text-sm hover:border-border-strong"
          aria-pressed={computed(() => String(variant.value === "failure"))}
          on:click={() => { variant.value = "failure"; }}
        >5xx-recovery demo</button>
      </div>
      <p class="text-sm text-muted">
        <For each={computed(() => [variant.value])} by={(value) => value}>
          {(value) => <ContactFormDescription variant={value.value} />}
        </For>
      </p>
      <For each={computed(() => [variant.value])} by={(value) => value}>
        {(value) => <ContactFormVariant variant={value.value} />}
      </For>
    </div>
  );
}

function ContactFormDescription({ variant }: { variant: Variant }): JSX.Element {
  const activePath = variant === "success" ? SUCCESS_PATH : FAILURE_PATH;
  return variant === "success" ? (
    <>
      Submitting calls <code>POST {withBase(activePath)}</code>, mocked to resolve 200. The
      form advances to the complete panel.
    </>
  ) : (
    <>
      Submitting calls <code>POST {withBase(activePath)}</code>, mocked to reject with 500.
      The confirm panel stays open and shows the error so you can retry.
    </>
  );
}

function ContactFormVariant({ variant }: { variant: Variant }): JSX.Element {
  return (
    <div style={{ "max-width": "760px" }}>
      <ContactForm />
      <ContactFormEnhancer onSubmit={variant === "success" ? submitSuccess : submitFailure} />
    </div>
  );
}

export default ContactFormDemo;
