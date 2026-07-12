// Convenience hook wiring #245's `generateJsx` to open/close state for the
// export dialog (issue #249). Deliberately tiny and fully owned by this
// feature: it's the one place `generateJsx` is called from the
// presentational layer, so wave-5 integration (#251) can either use this
// hook directly or call `generateJsx` itself and pass the result straight
// into `ComposerExportDialog` — both paths render the exact same generator
// output, never a second render/source mapping. `result` is never copied
// into further local state anywhere downstream — it's held once, here.

import { useCallback, useState } from "preact/hooks";
import type { ComponentManifest, CompositionDocument, JsxGenerationResult } from "@/composer";
import { generateJsx } from "@/composer";

export interface UseComposerExportResult {
  open: boolean;
  result: JsxGenerationResult | null;
  openExport: () => void;
  closeExport: () => void;
}

export function useComposerExport(
  document: CompositionDocument,
  manifest: ComponentManifest,
): UseComposerExportResult {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<JsxGenerationResult | null>(null);

  const openExport = useCallback(() => {
    setResult(generateJsx(document, manifest));
    setOpen(true);
  }, [document, manifest]);

  const closeExport = useCallback(() => {
    setOpen(false);
  }, []);

  return { open, result, openExport, closeExport };
}
