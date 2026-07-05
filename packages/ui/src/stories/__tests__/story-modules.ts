import type { StoryModule } from "../types";

// Shared story-module registry for every test in this directory
// (contract.test.ts, source-drift.test.ts, …).
//
// Explicit imports — NOT import.meta.glob. The S6 catalog discovers these via
// explicit static imports from a REPO-ROOT registry — see STORIES.md §2. We
// cannot reproduce that glob here: zfb forbids `../` parent-directory glob
// patterns, and a glob test living inside packages/ui could only reach sibling
// story files via `../`. (Confirmed: a `../**` glob in this directory breaks
// `zfb build`.) So we import every story module explicitly and share this one
// registry. The block below is codegen'd by `scripts/gen-sg-registry.mjs` from
// the `*.stories.tsx` files on disk — never hand-edit it; run
// `pnpm gen:sg-registry` and commit the result.
// GENERATED:SG_REGISTRY_BEGIN — do not hand-edit; run `pnpm gen:sg-registry`.
import * as badge from "../../badge/badge.stories";
import * as button from "../../button/button.stories";
import * as card from "../../card/card.stories";
import * as footer from "../../footer/footer.stories";
import * as form from "../../form/form.stories";
import * as heading from "../../heading/heading.stories";
import * as hero from "../../hero/hero.stories";
import * as link from "../../link/link.stories";
import * as siteHeader from "../../site-header/site-header.stories";
import * as stat from "../../stat/stat.stories";

export const STORY_MODULES: Record<string, StoryModule> = {
  "badge/badge.stories.tsx": badge as unknown as StoryModule,
  "button/button.stories.tsx": button as unknown as StoryModule,
  "card/card.stories.tsx": card as unknown as StoryModule,
  "footer/footer.stories.tsx": footer as unknown as StoryModule,
  "form/form.stories.tsx": form as unknown as StoryModule,
  "heading/heading.stories.tsx": heading as unknown as StoryModule,
  "hero/hero.stories.tsx": hero as unknown as StoryModule,
  "link/link.stories.tsx": link as unknown as StoryModule,
  "site-header/site-header.stories.tsx": siteHeader as unknown as StoryModule,
  "stat/stat.stories.tsx": stat as unknown as StoryModule,
};
// GENERATED:SG_REGISTRY_END
