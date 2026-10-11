import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { cx } from "../../lib/cx";
import { CONTROL_BASE } from "../lib/control-style";

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectProps = Omit<JSX.IntrinsicElements["select"], "children"> & {
  options: SelectOption[];
  class?: string;
};

/**
 * Dropdown select. `appearance-none` hides the native arrow so a token-styled
 * `▾` (below) can stand in for it — `zc-select-control` reserves room so long option
 * text never runs under it.
 */
export function Select({ options, value, class: cls, ...rest }: SelectProps) {
  return (
    <span class="relative block">
      <select class={cx(CONTROL_BASE, "appearance-none zc-select-control", cls)} {...rest}>
        {/* Static select value is SSR display data; serialize its option selection. */}
        {options.map((opt) => (
          <option
            value={opt.value}
            selected={value != null && String(value) === opt.value ? true : undefined}
          >
            {opt.label}
          </option>
        ))}
      </select>
      <span
        class="pointer-events-none absolute zc-select-arrow top-1/2 -translate-y-1/2 text-micro text-muted"
        aria-hidden="true"
      >
        ▾
      </span>
    </span>
  );
}
