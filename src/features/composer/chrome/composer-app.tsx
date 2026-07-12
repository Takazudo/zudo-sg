"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The `/composer` client island entry — the component `pages/composer/index.tsx`
// mounts via zfb's `<Island>`. Wave-5 integration (#251) wired the real surfaces
// in: this now delegates to `ComposerIntegration` (the production app), which
// fills #247's `ComposerWorkspace` slots with the structure tree (#250), the
// secure preview iframe host (#248), the inspector + export (#249), and a
// composed toolbar — all driven by #247's one controller. The integration body
// lives under `src/features/composer/app/` (this issue's exclusive ownership);
// this entry file stays a thin, stable mount point so the page route is
// unchanged.

import type { JSX } from "preact";
import { ComposerIntegration } from "@/features/composer/app";

export default function ComposerApp(): JSX.Element {
  return <ComposerIntegration />;
}

ComposerApp.displayName = "ComposerApp";
