/** Plain-data host vocabulary for `tokens.spec` in zudo-sg.config.mjs. */
export type TokenCategory = "palette" | "color" | "spacing" | "font" | "size";
export type TokenPreview = "size" | "line-height" | "family" | "weight" | "bar" | "radius" | "duration";
export type TokenControl = "slider" | "text" | "select";

export interface HostTokenSpec {
  /** Declared CSS custom property; its CSS declaration supplies `default`. */
  cssVar: string;
  id?: string;
  label?: string;
  control?: TokenControl;
  /** Unitless number rows for the portable tier model; defaults to length rows. */
  valueKind?: "number";
  step?: number;
  unit?: string;
  units?: string[];
  options?: string[];
  readonly?: boolean;
  pill?: { value: string; customDefault: string };
  note?: string;
}

export interface HostTokenGroupSpec {
  id: string;
  label: string;
  tokens: HostTokenSpec[];
  /** Omitted means plain rows, with no inferred demo preview. */
  preview?: TokenPreview;
  previewBase?: string;
}

/** Each supplied category is an ordered array of groups. Missing categories are empty. */
export type HostTokensSpec = Partial<Record<TokenCategory, HostTokenGroupSpec[]>>;

/** Portable generated metadata for consumers of a host manifest. */
export interface GeneratedTokenGroup {
  id: string;
  label: string;
  preview?: TokenPreview;
  previewBase?: string;
}
export type GeneratedTokenGroups = Record<TokenCategory, GeneratedTokenGroup[]>;
