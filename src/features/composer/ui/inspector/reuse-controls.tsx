/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { useEffect, useId, useState } from "preact/hooks";
import type { JSX } from "preact";
import type { ComponentManifest, CompositionDocument } from "@/composer";
import { diagnoseDocument } from "@/composer";
import type { ComposerMode } from "@/features/composer/chrome/controller-model";
import { InlineConfirm } from "@/features/composer/ui/shared/inline-confirm";
import type { ReuseAuthoringActionResult } from "@/features/composer/ui/shared/reuse-authoring-contract";

export interface ReuseControlsProps {
  document: CompositionDocument;
  manifest: ComponentManifest;
  mode: ComposerMode;
  /** Latest synchronous controller rejection, kept visible beside the role controls. */
  lastError?: string | null;
  onPublishPattern: () => void;
  /** Must wait for the provider-owned dependent query before invoking the command. */
  onClearPublication: () => Promise<ReuseAuthoringActionResult>;
}

type IntendedRole = "none" | "pattern" | "global-template";

function roleFromDocument(document: CompositionDocument): IntendedRole {
  return document.publication?.kind ?? "none";
}

export function ReuseControls({
  document,
  manifest,
  mode,
  lastError = null,
  onPublishPattern,
  onClearPublication,
}: ReuseControlsProps): JSX.Element {
  const readOnly = mode === "preview";
  const diagnostics = diagnoseDocument(document, manifest);
  const publication = document.publication;
  const bound = document.binding !== undefined;
  const [intendedRole, setIntendedRole] = useState<IntendedRole>(() => roleFromDocument(document));
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const radioName = useId();

  useEffect(() => {
    setIntendedRole(roleFromDocument(document));
    setConfirmingClear(false);
  }, [document.publication?.kind]);

  const patternReason = bound
    ? "This Composition is bound to a Global template. Remove its binding before publishing it."
    : document.root.length === 0
      ? "A Pattern needs at least one root component before publication."
      : publication?.kind === "global-template"
        ? "Clear Global template publication before publishing this Composition as a Pattern."
        : null;
  const globalReason = bound
    ? "This Composition is bound to a Global template. Remove its binding before publishing it."
    : publication?.kind === "pattern"
      ? "Clear Pattern publication before publishing this Composition as a Global template."
      : null;

  async function clearPublication(): Promise<void> {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await onClearPublication();
      if (result.status !== "applied") setFeedback(result.message);
      else if (result.message) setFeedback(result.message);
    } finally {
      setBusy(false);
      setConfirmingClear(false);
    }
  }

  return (
    <section class="sg-composer-inspector-section flex flex-col gap-vsp-xs" aria-labelledby="sg-composer-reuse-title">
      <div class="flex flex-col gap-vsp-3xs">
        <h2 id="sg-composer-reuse-title" class="text-small font-semibold text-fg">Reuse</h2>
        <p class="text-caption text-muted">
          Publish this Composition explicitly as a reusable Global template or Pattern. It remains the same Composition record.
        </p>
      </div>

      <fieldset class="flex flex-col gap-vsp-3xs" disabled={readOnly || busy}>
        <legend class="sr-only">Composition reuse role</legend>
        <label class="flex items-start gap-hsp-2xs text-caption text-fg">
          <input
            type="radio"
            class="h-4 w-4 flex-none appearance-none rounded-full border border-border bg-surface checked:bg-accent focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
            name={radioName}
            checked={intendedRole === "none"}
            disabled={publication === undefined}
            onChange={() => setConfirmingClear(true)}
          />
          <span>
            <span class="font-semibold">Private</span>
            <span class="block text-caption text-muted">Not available as a reusable source.</span>
          </span>
        </label>
        <label class="flex items-start gap-hsp-2xs text-caption text-fg">
          <input
            type="radio"
            class="h-4 w-4 flex-none appearance-none rounded-full border border-border bg-surface checked:bg-accent focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
            name={radioName}
            checked={intendedRole === "pattern"}
            disabled={patternReason !== null || publication?.kind === "pattern"}
            onChange={() => {
              setFeedback(null);
              setIntendedRole("pattern");
              onPublishPattern();
            }}
          />
          <span>
            <span class="font-semibold">Pattern</span>
            <span class="block text-caption text-muted">Saved composition</span>
          </span>
        </label>
        <label class="flex items-start gap-hsp-2xs text-caption text-fg">
          <input
            type="radio"
            class="h-4 w-4 flex-none appearance-none rounded-full border border-border bg-surface checked:bg-accent focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
            name={radioName}
            checked={intendedRole === "global-template"}
            disabled={globalReason !== null}
            onChange={() => {
              setFeedback(null);
              setIntendedRole("global-template");
            }}
          />
          <span>
            <span class="font-semibold">Global template</span>
            <span class="block text-caption text-muted">
              {publication?.kind === "global-template"
                ? `Template outlet: ${publication.outlet.label || "Untitled outlet"}`
                : "Choose a real empty component slot in Structure to publish it."}
            </span>
          </span>
        </label>
      </fieldset>

      {patternReason && intendedRole !== "pattern" && (
        <p class="text-caption text-muted" data-sg-reuse-pattern-reason>{patternReason}</p>
      )}
      {globalReason && globalReason !== patternReason && intendedRole !== "global-template" && (
        <p class="text-caption text-muted" data-sg-reuse-global-reason>{globalReason}</p>
      )}

      {publication?.kind === "global-template" && (
        <p class="text-caption text-muted" data-sg-reuse-outlet-status>
          Outlet ID: {publication.outlet.id}. Renaming or reassigning its target keeps this consumer-facing identity.
        </p>
      )}

      {diagnostics.reuseReasons.length > 0 && (
        <div class="sg-composer-inspector-diagnostics" role="alert" data-sg-reuse-diagnostics>
          <p class="sg-composer-inspector-diagnostics-title">Reuse needs attention.</p>
          <ul class="list-disc pl-hsp-md">
            {diagnostics.reuseReasons.map((reason) => <li key={reason.code}>{reason.message}</li>)}
          </ul>
          {diagnostics.reuseReasons.some((reason) => reason.code === "stale-outlet-target") && (
            <p class="mt-vsp-3xs">Choose another valid empty slot in Structure, or unpublish this Composition.</p>
          )}
        </div>
      )}

      {(feedback || lastError) && (
        <p class="sg-composer-inspector-diagnostics" role="status" data-sg-reuse-feedback>
          {feedback ?? lastError}
        </p>
      )}

      {publication && !readOnly && (
        confirmingClear ? (
          <InlineConfirm
            ariaLabel="Confirm clearing publication"
            message={`Unpublish this ${publication.kind === "pattern" ? "Pattern" : "Global template"}?`}
            confirmLabel="Unpublish"
            onCancel={() => setConfirmingClear(false)}
            onConfirm={() => void clearPublication()}
          />
        ) : (
          <button
            type="button"
            class="sg-composer-toolbar-button sg-composer-inspector-remove self-start"
            disabled={busy}
            onClick={() => setConfirmingClear(true)}
          >
            Unpublish
          </button>
        )
      )}
    </section>
  );
}
