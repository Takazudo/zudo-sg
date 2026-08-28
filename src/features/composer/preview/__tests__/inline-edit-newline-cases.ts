/** One representative captured DOM shape for each of the 14 logical probes. */
export interface InlineEditBoundaryCase {
  readonly probe: string;
  readonly seed: string;
  readonly html: string;
  readonly expected: string;
}

export const INLINE_EDIT_BOUNDARY_CASES: readonly InlineEditBoundaryCase[] = [
  { probe: "interior one", seed: "", html: "a<div>b</div>", expected: "a\nb" },
  { probe: "interior blank", seed: "", html: "a<div><br></div><div>b</div>", expected: "a\n\nb" },
  { probe: "trailing one", seed: "", html: "a<div><br></div>", expected: "a\n" },
  { probe: "trailing two", seed: "", html: "a<div><br></div><div><br></div>", expected: "a\n\n" },
  { probe: "exact paste", seed: "", html: "p1\n\np2\n\np3", expected: "p1\n\np2\n\np3" },
  { probe: "clear", seed: "clear me", html: "<br>", expected: "" },
  { probe: "no-edit empty", seed: "", html: "", expected: "" },
  { probe: "type/delete empty", seed: "", html: "<br>", expected: "" },
  { probe: "no-edit a", seed: "a", html: "a", expected: "a" },
  { probe: "type/delete a", seed: "a", html: "a", expected: "a" },
  { probe: "no-edit a\\n", seed: "a\n", html: "a\n", expected: "a\n" },
  { probe: "type/delete a\\n", seed: "a\n", html: "a", expected: "a\n" },
  { probe: "no-edit a\\n\\n", seed: "a\n\n", html: "a\n\n", expected: "a\n\n" },
  { probe: "type/delete a\\n\\n", seed: "a\n\n", html: "a\n<br>", expected: "a\n\n" },
];
