import DefaultLayout from "../layouts/default";
import { Container } from "@zudo-sg/ui/src/shared/container/container.tsx";

export const frontmatter = { title: "404" };

export default function NotFoundPage() {
  return (
    <DefaultLayout title="404 — Page not found" noindex={true}>
      <Container as="section" class="py-vsp-2xl flex flex-col items-center text-center">
        <h1 class="text-display font-bold text-fg">404</h1>
        <p class="mt-vsp-sm text-title text-muted">Page not found</p>
        <a
          href="/"
          class="mt-vsp-xl inline-block bg-accent px-hsp-lg py-vsp-xs text-bg font-medium hover:bg-accent-hover"
        >
          Back to home
        </a>
      </Container>
    </DefaultLayout>
  );
}
