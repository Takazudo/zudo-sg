"""Render the reviewed per-state decisions; unknown states fail closed."""
import hashlib
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
REVIEWED_SHA256 = '0b90f349101981b53b68f4fae0e1653aa859b43a54db2a138364e82832d31db8'
data = (HERE / 'differences.json').read_bytes()
if hashlib.sha256(data).hexdigest() != REVIEWED_SHA256:
    raise ValueError('Differences changed; review new evidence before updating classifications')
rows = json.loads(data)
lines = ['# P1 visual parity decisions', '',
'84/84 pairs classified. **0 unclassified rows; 0 open visual defects.** All three viewports and both themes use the unchanged S1 manifest. RGB differences use tolerance 16; complete per-property values are in `differences.json`.', '',
'## Reviewed causes', '',
'- **A — explicit transition duration.** zudo-doc 6 adds `duration-0` to header navigation. S1 `transition-colors` used its 150 ms default. The computed change is 0.15s → 0s; idle paint, targets, and geometry agree. Accepted for each listed row.',
'- **B — upstream navigation affordance (non-wind).** zudo-doc 6 SidebarTree adds “Broaden tree” and the focused-parent marker on desktop document pages. Body content, widths, and responsive policy agree; this is accepted navigation behavior, not an unexplained CSS change.',
'- **C — supported finite spacing.** The earlier wind audit replaced undeclared `gap-hsp-3xs` with declared `gap-hsp-2xs`. S1/live computed tablist gap is `normal` (zero for flex); migrated gap is 2px. Code-tab radii (4px), borders (1px), fonts, heights, and first-tab position agree exactly. `detail-*-geometry.json` records this; PreviewTokensButton/catalog controls use the same deliberate replacement.',
'- **D — authored tracking token.** Wind resolves `tracking-wide` to `var(--tracking-wide)` = 0.05em from `packages/demo-ui/styles/tokens.css`; S1 used Tailwind’s 0.025em default. The slightly wider eyebrow is accepted for the specific rows below; all captured computed layout/color properties agree.',
'- **E — declared specimen whitespace (non-wind).** The opaque dashboard adapter preserves the unchanged specimen’s two newlines under `white-space: pre-wrap`; S1 HTML minification collapsed them to one space. All 117 cards/102 unique tokens remain. At 1280px, exactly 22 typography card height changes sum to 975.890625px, exactly the shared-dashboard height delta. Card widths, margins, padding, border widths, font sizes and line heights agree. `tokens-text-evidence.json` and `tokens-*-geometry.json` prove this. Responsive wrapping explains the 390/800px totals. Keeping declared paragraph separation is accepted.',
'- **F — fixed peer specificity defect.** Wind’s zero-specificity `:where(.peer:checked)` lost to the later mobile offset. The scoped authored checked drawer rule restores the open drawer. Recaptured 390px light/dark images and styles equal S1.',
'- **G — fixed lazy enhancer defect.** Body-end render-null visible islands left `/search?q=product` unfiltered until scrolled. Load activation restores the S1 query result set; every recaptured search image and style equals S1.', '',
'No global `!important` or breakpoint changes were introduced. The declared md=768px policy and owned-v1 reset did not produce any remaining captured layout/color defect. The non-wind causes are named explicitly rather than attributed falsely to wind.', '',
'## Per-pair decisions', '',
'| Pair | Changed pixels % | Style deltas | Classification | Accepted cause / evidence |',
'| --- | ---: | ---: | --- | --- |']
for r in rows:
    site, key = r['key'].split('/')
    parts = key.rsplit('-', 2); state, width, theme = parts[0], int(parts[1]), parts[2]
    causes=[]; classification='equal'
    if site == 'root':
        if state != 'preview-cta-button-playground': causes.append('A')
        if state in ['docs-overview','docs-architecture'] and width==1280: causes.append('B')
        if state in ['components-cta-button','tokens'] or (state=='components' and width==1280): causes.append('C')
        if state=='tokens': causes.append('E')
    elif site == 'demo':
        if state in ['home','business-line-vacuum'] or (state=='mobile-nav-open' and width>640): causes.append('D')
        if state=='mobile-nav-open' and width==390: causes.append('F');classification='defect fixed (closed)'
        if state=='search-product': causes.append('G');classification='defect fixed (closed)'
    elif site == 'doc':
        if state=='docs-getting-started' and width==1280: causes.append('B')
    else: raise ValueError(r['key'])
    if classification=='equal' and causes: classification='intended'
    if not causes and (r['changedPercent'] or r['styleDeltas']): raise ValueError('unreviewed difference '+r['key'])
    detail=[]
    for d in r['styleDeltas']:
        detail.append(f"{d['selector']} {d['property']}: {d['before']} → {d['after']}")
    evidence=', '.join(causes) if causes else 'Pixel/style equality'
    if detail: evidence += '; ' + '; '.join(detail)
    lines.append(f"| {r['key']} | {r['changedPercent']:.3f} | {len(r['styleDeltas'])} | {classification} | {evidence} |")
(HERE/'matrix.md').write_text('\n'.join(lines)+'\n')
