import DefaultLayout from "../layouts/default";
import { Container } from "@zudo-sg/ui/src/shared/container/container.tsx";

export const frontmatter = {
  title: "Home",
  description: "A demo content site composed from the shared @zudo-sg/ui component library.",
};

/**
 * Placeholder home page — renders the shell (header/nav/footer/breadcrumbs)
 * with no real content yet. #233 replaces this with the full landing page
 * composed from the ported landing components.
 */
export default function HomePage() {
  return (
    <DefaultLayout title="Home">
      <Container as="section" class="py-vsp-2xl">
        <h1 class="text-display font-bold text-fg">Demo Site</h1>
        <p class="mt-vsp-sm max-w-[40rem] text-title text-muted">
          This is a shell build of the demo site — chrome, routing, and the
          SPA router are wired up. Page content is on its way.
        </p>
      </Container>
    </DefaultLayout>
  );
}
