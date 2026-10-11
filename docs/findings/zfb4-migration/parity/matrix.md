# P1 visual parity decisions

84/84 pairs classified. **0 unclassified rows; 0 open visual defects.** All three viewports and both themes use the unchanged S1 manifest. RGB differences use tolerance 16; complete per-property values are in `differences.json`.

## Reviewed causes

- **A — explicit transition duration.** zudo-doc 6 adds `duration-0` to header navigation. S1 `transition-colors` used its 150 ms default. The computed change is 0.15s → 0s; idle paint, targets, and geometry agree. Accepted for each listed row.
- **B — upstream navigation affordance (non-wind).** zudo-doc 6 SidebarTree adds “Broaden tree” and the focused-parent marker on desktop document pages. Body content, widths, and responsive policy agree; this is accepted navigation behavior, not an unexplained CSS change.
- **C — supported finite spacing.** The earlier wind audit replaced undeclared `gap-hsp-3xs` with declared `gap-hsp-2xs`. S1/live computed tablist gap is `normal` (zero for flex); migrated gap is 2px. Code-tab radii (4px), borders (1px), fonts, heights, and first-tab position agree exactly. `detail-*-geometry.json` records this; PreviewTokensButton/catalog controls use the same deliberate replacement.
- **D — authored tracking token.** Wind resolves `tracking-wide` to `var(--tracking-wide)` = 0.05em from `packages/demo-ui/styles/tokens.css`; S1 used Tailwind’s 0.025em default. The slightly wider eyebrow is accepted for the specific rows below; all captured computed layout/color properties agree.
- **E — declared specimen whitespace (non-wind).** The opaque dashboard adapter preserves the unchanged specimen’s two newlines under `white-space: pre-wrap`; S1 HTML minification collapsed them to one space. All 117 cards/102 unique tokens remain. At 1280px, exactly 22 typography card height changes sum to 975.890625px, exactly the shared-dashboard height delta. Card widths, margins, padding, border widths, font sizes and line heights agree. `tokens-text-evidence.json` and `tokens-*-geometry.json` prove this. Responsive wrapping explains the 390/800px totals. Keeping declared paragraph separation is accepted.
- **F — fixed peer specificity defect.** Wind’s zero-specificity `:where(.peer:checked)` lost to the later mobile offset. The scoped authored checked drawer rule restores the open drawer. Recaptured 390px light/dark images and styles equal S1.
- **G — fixed lazy enhancer defect.** Body-end render-null visible islands left `/search?q=product` unfiltered until scrolled. Load activation restores the S1 query result set; every recaptured search image and style equals S1.

No global `!important` or breakpoint changes were introduced. The declared md=768px policy and owned-v1 reset did not produce any remaining captured layout/color defect. The non-wind causes are named explicitly rather than attributed falsely to wind.

## Per-pair decisions

| Pair | Changed pixels % | Style deltas | Classification | Accepted cause / evidence |
| --- | ---: | ---: | --- | --- |
| root/home-390-light | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/home-390-dark | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/home-800-light | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/home-800-dark | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/home-1280-light | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/home-1280-dark | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/docs-overview-390-light | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/docs-overview-390-dark | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/docs-overview-800-light | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/docs-overview-800-dark | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/docs-overview-1280-light | 2.262 | 1 | intended | A, B; [data-nav-item] transition-duration: 0.15s → 0s |
| root/docs-overview-1280-dark | 2.264 | 1 | intended | A, B; [data-nav-item] transition-duration: 0.15s → 0s |
| root/docs-architecture-390-light | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/docs-architecture-390-dark | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/docs-architecture-800-light | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/docs-architecture-800-dark | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/docs-architecture-1280-light | 3.239 | 1 | intended | A, B; [data-nav-item] transition-duration: 0.15s → 0s |
| root/docs-architecture-1280-dark | 3.246 | 1 | intended | A, B; [data-nav-item] transition-duration: 0.15s → 0s |
| root/components-390-light | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/components-390-dark | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/components-800-light | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/components-800-dark | 0.000 | 1 | intended | A; [data-nav-item] transition-duration: 0.15s → 0s |
| root/components-1280-light | 0.001 | 1 | intended | A, C; [data-nav-item] transition-duration: 0.15s → 0s |
| root/components-1280-dark | 0.001 | 1 | intended | A, C; [data-nav-item] transition-duration: 0.15s → 0s |
| root/components-cta-button-390-light | 0.165 | 1 | intended | A, C; [data-nav-item] transition-duration: 0.15s → 0s |
| root/components-cta-button-390-dark | 0.166 | 1 | intended | A, C; [data-nav-item] transition-duration: 0.15s → 0s |
| root/components-cta-button-800-light | 0.097 | 1 | intended | A, C; [data-nav-item] transition-duration: 0.15s → 0s |
| root/components-cta-button-800-dark | 0.098 | 1 | intended | A, C; [data-nav-item] transition-duration: 0.15s → 0s |
| root/components-cta-button-1280-light | 0.077 | 1 | intended | A, C; [data-nav-item] transition-duration: 0.15s → 0s |
| root/components-cta-button-1280-dark | 0.074 | 1 | intended | A, C; [data-nav-item] transition-duration: 0.15s → 0s |
| root/preview-cta-button-playground-390-light | 0.000 | 0 | equal | Pixel/style equality |
| root/preview-cta-button-playground-390-dark | 0.000 | 0 | equal | Pixel/style equality |
| root/preview-cta-button-playground-800-light | 0.000 | 0 | equal | Pixel/style equality |
| root/preview-cta-button-playground-800-dark | 0.000 | 0 | equal | Pixel/style equality |
| root/preview-cta-button-playground-1280-light | 0.000 | 0 | equal | Pixel/style equality |
| root/preview-cta-button-playground-1280-dark | 0.000 | 0 | equal | Pixel/style equality |
| root/tokens-390-light | 0.010 | 2 | intended | A, C, E; .zd-doc-content-band height: 33362.6px → 34328.9px; [data-nav-item] transition-duration: 0.15s → 0s |
| root/tokens-390-dark | 0.010 | 2 | intended | A, C, E; .zd-doc-content-band height: 33362.6px → 34328.9px; [data-nav-item] transition-duration: 0.15s → 0s |
| root/tokens-800-light | 0.012 | 2 | intended | A, C, E; .zd-doc-content-band height: 18350.6px → 19027.3px; [data-nav-item] transition-duration: 0.15s → 0s |
| root/tokens-800-dark | 0.012 | 2 | intended | A, C, E; .zd-doc-content-band height: 18350.6px → 19027.3px; [data-nav-item] transition-duration: 0.15s → 0s |
| root/tokens-1280-light | 0.008 | 2 | intended | A, C, E; .zd-doc-content-band height: 13222px → 14197.9px; [data-nav-item] transition-duration: 0.15s → 0s |
| root/tokens-1280-dark | 0.008 | 2 | intended | A, C, E; .zd-doc-content-band height: 13222px → 14197.9px; [data-nav-item] transition-duration: 0.15s → 0s |
| demo/home-390-light | 0.327 | 0 | intended | D |
| demo/home-390-dark | 0.318 | 0 | intended | D |
| demo/home-800-light | 0.154 | 0 | intended | D |
| demo/home-800-dark | 0.153 | 0 | intended | D |
| demo/home-1280-light | 0.096 | 0 | intended | D |
| demo/home-1280-dark | 0.095 | 0 | intended | D |
| demo/business-line-vacuum-390-light | 0.251 | 0 | intended | D |
| demo/business-line-vacuum-390-dark | 0.243 | 0 | intended | D |
| demo/business-line-vacuum-800-light | 0.117 | 0 | intended | D |
| demo/business-line-vacuum-800-dark | 0.113 | 0 | intended | D |
| demo/business-line-vacuum-1280-light | 0.073 | 0 | intended | D |
| demo/business-line-vacuum-1280-dark | 0.070 | 0 | intended | D |
| demo/search-product-390-light | 0.000 | 0 | defect fixed (closed) | G |
| demo/search-product-390-dark | 0.000 | 0 | defect fixed (closed) | G |
| demo/search-product-800-light | 0.000 | 0 | defect fixed (closed) | G |
| demo/search-product-800-dark | 0.000 | 0 | defect fixed (closed) | G |
| demo/search-product-1280-light | 0.000 | 0 | defect fixed (closed) | G |
| demo/search-product-1280-dark | 0.000 | 0 | defect fixed (closed) | G |
| demo/contact-form-390-light | 0.000 | 0 | equal | Pixel/style equality |
| demo/contact-form-390-dark | 0.000 | 0 | equal | Pixel/style equality |
| demo/contact-form-800-light | 0.000 | 0 | equal | Pixel/style equality |
| demo/contact-form-800-dark | 0.000 | 0 | equal | Pixel/style equality |
| demo/contact-form-1280-light | 0.000 | 0 | equal | Pixel/style equality |
| demo/contact-form-1280-dark | 0.000 | 0 | equal | Pixel/style equality |
| demo/mobile-nav-open-390-light | 0.000 | 0 | defect fixed (closed) | F |
| demo/mobile-nav-open-390-dark | 0.000 | 0 | defect fixed (closed) | F |
| demo/mobile-nav-open-800-light | 0.154 | 0 | intended | D |
| demo/mobile-nav-open-800-dark | 0.153 | 0 | intended | D |
| demo/mobile-nav-open-1280-light | 0.096 | 0 | intended | D |
| demo/mobile-nav-open-1280-dark | 0.095 | 0 | intended | D |
| doc/home-390-light | 0.000 | 0 | equal | Pixel/style equality |
| doc/home-390-dark | 0.000 | 0 | equal | Pixel/style equality |
| doc/home-800-light | 0.000 | 0 | equal | Pixel/style equality |
| doc/home-800-dark | 0.000 | 0 | equal | Pixel/style equality |
| doc/home-1280-light | 0.000 | 0 | equal | Pixel/style equality |
| doc/home-1280-dark | 0.000 | 0 | equal | Pixel/style equality |
| doc/docs-getting-started-390-light | 0.000 | 0 | equal | Pixel/style equality |
| doc/docs-getting-started-390-dark | 0.000 | 0 | equal | Pixel/style equality |
| doc/docs-getting-started-800-light | 0.000 | 0 | equal | Pixel/style equality |
| doc/docs-getting-started-800-dark | 0.000 | 0 | equal | Pixel/style equality |
| doc/docs-getting-started-1280-light | 2.496 | 0 | intended | B |
| doc/docs-getting-started-1280-dark | 2.499 | 0 | intended | B |
