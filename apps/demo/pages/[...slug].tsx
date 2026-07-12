/**
 * Markdown/MDX catch-all route.
 *
 * Uses the REQUIRED catch-all form `[...slug]`, not the optional
 * `[[...slug]]` — the optional form double-matches `/`, which is forbidden
 * (and `/` is `pages/index.tsx`'s job anyway).
 *
 * Enumerates every entry in the `content` collection and generates one page
 * per slug. With zero content (#233 hasn't landed yet), `paths()` returns an
 * empty array and the build simply emits no routes from this file — that's
 * expected, not an error.
 */
import type { FunctionComponent } from "preact";
import DefaultLayout from "../layouts/default";
import { Container } from "@zudo-sg/ui/src/shared/container/container.tsx";
import { mdxComponents } from "./_mdx-components";
import { normalizeSlug, deriveLineKey } from "../lib/site-tree";
import type { ContentData } from "../lib/content-schema";

type ContentEntry = {
  slug: string;
  data: ContentData;
  Content: FunctionComponent<{ components?: Record<string, unknown> }>;
};

export async function paths() {
  const { getCollection } = await import("@takazudo/zfb/content");
  const entries = getCollection("content") as ContentEntry[];
  return entries.map((entry) => {
    // Serve `foo/index` at `/foo` (directory-index convention) — the raw
    // slug would otherwise 404 at the link target `/foo`.
    const slug = normalizeSlug(entry.slug);
    return {
      params: { slug: slug.split("/") },
      props: { entry, slug },
    };
  });
}

type Props = {
  entry: ContentEntry;
  /** Normalized slug (index stripped) — used for breadcrumbs/active-nav. */
  slug: string;
};

export default function ContentPage({ entry, slug }: Props) {
  const { title, description } = entry.data;
  // Derived purely from the slug prefix (`lines/<key>/...`) — see
  // lib/site-tree.ts's module doc for why there's no registry lookup yet.
  const line = deriveLineKey(slug);
  // A business-line landing page's own MDX body supplies the visual <h1> +
  // lead (once #233/#234 add that content); showing the frontmatter
  // title/description here too would double up the heading and lead.
  const isLineIndex = line !== undefined && normalizeSlug(slug) === `lines/${line}`;

  return (
    <DefaultLayout title={title ?? slug} description={description} slug={slug} line={line}>
      <Container as="article" class="py-vsp-xl">
        {title && !isLineIndex && <h1 class="text-heading font-bold text-fg">{title}</h1>}
        {description && !isLineIndex && (
          <p class="mt-vsp-sm text-title text-fg">{description}</p>
        )}
        <div class="zd-content mt-vsp-lg">
          <entry.Content components={mdxComponents} />
        </div>
      </Container>
    </DefaultLayout>
  );
}
