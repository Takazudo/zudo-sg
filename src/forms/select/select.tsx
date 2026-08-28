import type { JSX } from "preact";
import { cx } from "../../lib/cx";
import { CONTROL_BASE } from "../lib/control-style";

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectProps = Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  options: SelectOption[];
  class?: string;
};

/**
 * Dropdown select. `appearance-none` hides the native arrow so a token-styled
 * `▾` (below) can stand in for it — `pe-hsp-xl` reserves room so long option
 * text never runs under it.
 */
export function Select({ options, class: cls, ...rest }: SelectProps) {
  return (
    <span class="relative block">
      <select class={cx(CONTROL_BASE, "appearance-none pe-hsp-xl", cls)} {...rest}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span
        class="pointer-events-none absolute end-hsp-md top-1/2 -translate-y-1/2 text-micro text-muted"
        aria-hidden="true"
      >
        ▾
      </span>
    </span>
  );
}
