import "../styles/global.css";

export const frontmatter = {
  title: "Styleguide",
  description: "Component styleguide for @zudo-sg/ui — placeholder page.",
};

/**
 * Placeholder index page for apps/styleguide.
 * Real styleguide content (DocLayoutWithDefaults, component pages) is ported
 * in later sub-issues. This exists solely so the package builds green.
 */
export default function StyleguidePage() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>@zudo-sg/styleguide</h1>
      <p>Component styleguide — coming soon.</p>
    </main>
  );
}
