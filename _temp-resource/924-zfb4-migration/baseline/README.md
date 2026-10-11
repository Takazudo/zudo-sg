# Zfb4 migration v2 baseline

This baseline records the untouched v2 site outputs from commit
`30ff6442b9e2dc96df4e72a6fd73096ed4e5f800`.

- Base SHA: `30ff6442b9e2dc96df4e72a6fd73096ed4e5f800`
- `pnpm-lock.yaml` SHA-256: `f7983ec0857ae1c6e5b327edb289b97ae65a49b24168995bcd5fa1ef58281c4d`
- Dist tarballs (machine-local, excluded from this commit):
  - `/home/takazudo/.cache/zudo-sg-zfb4-baseline/30ff6442b9e2dc96df4e72a6fd73096ed4e5f800/root.tar.gz`
  - `/home/takazudo/.cache/zudo-sg-zfb4-baseline/30ff6442b9e2dc96df4e72a6fd73096ed4e5f800/demo.tar.gz`
  - `/home/takazudo/.cache/zudo-sg-zfb4-baseline/30ff6442b9e2dc96df4e72a6fd73096ed4e5f800/doc.tar.gz`
- Live v2 references:
  - Root: <https://zudo-sg.takazudomodular.com>
  - Demo: <https://zudo-sg-demo-site.takazudomodular.com>
  - Docs: <https://zudo-sg-doc.takazudomodular.com>

`inventories/` holds route, island marker, islands bundle size, class, and
transition-persist inventories for each built site. The root route inventory
contains 88 HTML routes; zfb's 89th generated page is `/robots.txt`.
The inventory generator accepts quoted and unquoted HTML attributes because
zfb omits quotes for some values during output minification, then writes
island markers in a consistent quoted form.

`states.json` is the state manifest consumed by the capture helper. It defines
14 states and the 390×844, 800×900, and 1280×900 viewports in light and dark
themes. Each state has a PNG and computed-style JSON under `states/<site>/`.
Full-page images are used for shorter pages; viewport images are used where a
full page would create a very tall capture. The mobile-nav action applies at
390px; wider captures record that the desktop navigation was used. The demo
site uses its own theme button; root and docs use the shared appearance helper.
The theme is selected at 1280px after navigation, then the requested viewport is
restored before interaction and capture so the theme menu remains reachable in
narrow screenshots. The standalone component preview has no site header, so the
capture helper sets its root `data-theme` attribute directly. The preview state
uses the first registered cta-button variant, `Playground`; `variant=0` is not a
valid story export name in this baseline.

## Regeneration

Run from the untouched base checkout. Keep the three builds serial, and keep
the tarballs outside the repository:

```sh
BASE_SHA="$(git rev-parse HEAD)"
test "$BASE_SHA" = "30ff6442b9e2dc96df4e72a6fd73096ed4e5f800"
sha256sum pnpm-lock.yaml
bash "$HOME/.codex/scripts/heavy-guard.sh" -- pnpm build
bash "$HOME/.codex/scripts/heavy-guard.sh" -- pnpm --filter @zudo-sg/demo build
bash "$HOME/.codex/scripts/heavy-guard.sh" -- pnpm build:doc
mkdir -p "$HOME/.cache/zudo-sg-zfb4-baseline/$BASE_SHA"
tar -czf "$HOME/.cache/zudo-sg-zfb4-baseline/$BASE_SHA/root.tar.gz" -C . dist
tar -czf "$HOME/.cache/zudo-sg-zfb4-baseline/$BASE_SHA/demo.tar.gz" -C apps/demo dist
tar -czf "$HOME/.cache/zudo-sg-zfb4-baseline/$BASE_SHA/doc.tar.gz" -C doc dist
node _temp-resource/924-zfb4-migration/baseline/generate-inventories.mjs
pnpm exec tsx _temp-resource/924-zfb4-migration/baseline/capture.ts
```

The capture helper starts one static preview at a time through
`createStaticPreviewServer`, launches Chromium, and closes each preview after
its site's captures complete. It writes 84 screenshot/style pairs. Run the
three build commands through the machine's heavy guard when regenerating.
