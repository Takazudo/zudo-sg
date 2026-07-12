/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// One inspector field row (issue #249) — renders the control for a single
// definition-declared field (text/textarea, boolean, number, select, color).
// Purely presentational plus the two controlled-draft hooks; never talks to
// the document/commands directly — `onCommit` is the only way a value
// leaves this component. The panel keys each row by
// `${selectedId}:${field.prop}` so switching the SELECTED node remounts the
// row (see use-text-field.ts's header for why that matters).
//
// "text" fields render as a `<textarea>` when the field's `inlineEdit.multiline`
// hint is set. The authoring contract has no separate multiline flag for the
// INSPECTOR specifically — `inlineEdit` (wave-8's on-canvas editing signal) is
// the only multiline hint the schema carries, so it doubles as one here too.
//
// Styling: Tailwind utilities directly on markup (component-first, per
// zudo-doc-design-system), plus two small `sg-composer-inspector-*` classes
// (styles.css) for the touch-target-sizing control wrapper and the color
// swatch — the only bits utilities can't express here.

import type { JSX } from "preact";
import { useId } from "preact/hooks";
import type { ComposerFieldMeta, JsonValue } from "@zudo-sg/ui";
import { useNumericField } from "./use-numeric-field";
import { useTextField } from "./use-text-field";

export interface InspectorFieldProps {
  field: ComposerFieldMeta;
  value: JsonValue;
  disabled: boolean;
  onCommit: (value: JsonValue) => void;
}

function assertNever(field: never): never {
  throw new Error(`Unhandled Composer field kind: ${JSON.stringify(field)}`);
}

const FIELD_LABEL_CLASS = "block text-xs font-medium text-muted";
const FIELD_INPUT_CLASS =
  "sg-composer-inspector-control w-full rounded-md border border-border bg-surface px-hsp-xs text-small text-fg disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger";

export function InspectorField({ field, value, disabled, onCommit }: InspectorFieldProps): JSX.Element {
  const inputId = useId();
  const errorId = useId();

  switch (field.kind) {
    case "boolean": {
      const checked = value === true;
      return (
        <label
          class="sg-composer-inspector-control flex cursor-pointer items-center gap-hsp-xs text-small text-fg has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
          for={inputId}
        >
          <input
            id={inputId}
            type="checkbox"
            class="h-4 w-4 accent-accent"
            checked={checked}
            disabled={disabled}
            onChange={(e) => {
              if (e.target instanceof HTMLInputElement) onCommit(e.target.checked);
            }}
          />
          <span>{field.label}</span>
        </label>
      );
    }

    case "select": {
      const current = typeof value === "string" ? value : (field.options[0] ?? "");
      return (
        <div class="flex flex-col gap-vsp-3xs">
          <label class={FIELD_LABEL_CLASS} for={inputId}>
            {field.label}
          </label>
          <select
            id={inputId}
            class={FIELD_INPUT_CLASS}
            value={current}
            disabled={disabled}
            onChange={(e) => {
              if (e.target instanceof HTMLSelectElement) onCommit(e.target.value);
            }}
          >
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );
    }

    case "number":
      return (
        <NumberField
          field={field}
          value={typeof value === "number" ? value : 0}
          disabled={disabled}
          onCommit={onCommit}
          inputId={inputId}
          errorId={errorId}
        />
      );

    case "color":
      return (
        <TextField
          label={field.label}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onCommit={onCommit}
          inputId={inputId}
          multiline={false}
          swatch
        />
      );

    case "text":
      return (
        <TextField
          label={field.label}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onCommit={onCommit}
          inputId={inputId}
          multiline={field.inlineEdit?.multiline === true}
        />
      );

    default:
      return assertNever(field);
  }
}

interface TextFieldProps {
  label: string;
  value: string;
  disabled: boolean;
  onCommit: (value: JsonValue) => void;
  inputId: string;
  multiline: boolean;
  swatch?: boolean;
}

function TextField({ label, value, disabled, onCommit, inputId, multiline, swatch }: TextFieldProps): JSX.Element {
  const { draft, onInput, onFocus, onBlur } = useTextField({ value, onCommit });

  return (
    <div class="flex flex-col gap-vsp-3xs">
      <label class={FIELD_LABEL_CLASS} for={inputId}>
        {label}
      </label>
      <div class="flex items-center gap-hsp-xs">
        {swatch && (
          <span
            class="sg-composer-inspector-swatch"
            style={{ backgroundColor: draft || "transparent" }}
            aria-hidden="true"
          />
        )}
        {multiline ? (
          <textarea
            id={inputId}
            class="w-full rounded-md border border-border bg-surface px-hsp-xs py-vsp-3xs text-small text-fg disabled:cursor-not-allowed disabled:opacity-50"
            value={draft}
            disabled={disabled}
            rows={3}
            onInput={(e) => {
              if (e.target instanceof HTMLTextAreaElement) onInput(e.target.value);
            }}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        ) : (
          <input
            id={inputId}
            type="text"
            class={FIELD_INPUT_CLASS}
            value={draft}
            disabled={disabled}
            onInput={(e) => {
              if (e.target instanceof HTMLInputElement) onInput(e.target.value);
            }}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        )}
      </div>
    </div>
  );
}

interface NumberFieldProps {
  field: Extract<ComposerFieldMeta, { kind: "number" }>;
  value: number;
  disabled: boolean;
  onCommit: (value: JsonValue) => void;
  inputId: string;
  errorId: string;
}

function NumberField({ field, value, disabled, onCommit, inputId, errorId }: NumberFieldProps): JSX.Element {
  const { draft, error, onInput, onFocus, onBlur } = useNumericField({
    value,
    min: field.min,
    max: field.max,
    onCommit,
  });

  return (
    <div class="flex flex-col gap-vsp-3xs">
      <label class={FIELD_LABEL_CLASS} for={inputId}>
        {field.label}
      </label>
      <input
        id={inputId}
        type="number"
        class={FIELD_INPUT_CLASS}
        value={draft}
        min={field.min}
        max={field.max}
        step={field.step}
        disabled={disabled}
        aria-invalid={error !== null}
        aria-describedby={error !== null ? errorId : undefined}
        onInput={(e) => {
          if (e.target instanceof HTMLInputElement) onInput(e.target.value);
        }}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {error !== null && (
        <p id={errorId} class="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
