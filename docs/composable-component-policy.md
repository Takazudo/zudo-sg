# Composable component inventory policy

Composer onboarding is **advisory opt-out**. Every callable PascalCase component export from
`@zudo-sg/ui` must appear in the report as one of: `has-sidecar`,
`expressible-but-unonboarded`, `explicitly-excluded` (with a reason), or `not-expressible`
(with a reason). A JSON-expressible component without a sidecar is visible work, not a check
failure yet. This makes omissions reviewable without forcing every public component into the
authoring palette.

The default is opt-in to the inventory and opt-out from sidecar creation only by an explicit,
reviewed reason. Components are disqualified from direct onboarding when their public contract
requires callbacks, VNodes/`ComponentChildren`, or another non-JSON value; when a collection is
derived by the caller from content, search, router, or application data; or when the component is
a client behavior adapter coupled to runtime DOM/data/application state. Internal compositional
primitives (for example compound children and MDX renderer elements) remain public API but are
explicitly excluded from the standalone palette because authors use them through a larger
component or slot. A sidecar can deliberately model non-JSON props as contract slots, so a
discovered valid sidecar takes precedence over these general disqualifiers.

Run `pnpm gen:composable-component-report` to print the deterministic inventory; it does not
write a generated artifact. Run `pnpm check:composable-component-report` to enforce inventory
integrity. The check fails on unclassified exports, stale/invalid overrides, duplicate identities,
or a sidecar that cannot be reconciled to exactly one public component. It does **not** fail merely
because `expressible-but-unonboarded` rows exist. Rows are based on the TypeScript public barrel,
call signatures and prop types; sidecars are independently discovered from Git-known files.
