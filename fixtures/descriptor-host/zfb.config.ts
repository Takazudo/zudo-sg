// zfb.config.ts — descriptor-host fixture (epic #879, S7).
//
// A foreign-framework consumer of `@takazudo/zudo-sg`: it registers stories
// as plain-data `StoryDescriptor`s (never a `.stories.tsx`, never `react`)
// and serves its own external preview document instead of the in-engine
// preview route. `withZudoSg` still appends the engine's plugins after
// `zudoDoc()`'s own — the routes plugin requires `packageOwnedRoutes: true`,
// which `zudoDoc()` defaults on.
import { defineConfig, type WindConfig } from "@takazudo/zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { withZudoSg } from "@takazudo/zudo-sg/config";
import zudoSgConfig from "./zudo-sg.config.mjs";

export default defineConfig(
  {
    ...withZudoSg(
      {
        ...zudoDoc({
          siteName: "Descriptor Host Fixture",
          base: "/styleguide/",
          port: 4399,
          favicon: "auto",
          mermaid: false,
          strictContentBridge: true,
          dynamicPageTransition: true,
        }),
        wind: {
          reset: "owned-v1",
          tokens: {
            colors: {
              bg: "var(--color-bg)",
              fg: "var(--color-fg)",
              surface: "var(--color-surface)",
              "surface-2": "var(--color-surface-2)",
              border: "var(--color-border)",
              muted: "var(--color-muted)",
              accent: "var(--color-accent)",
              "accent-hover": "var(--color-accent-hover)",
              "on-accent": "var(--color-on-accent)",
              focus: "var(--color-focus)",
              success: "var(--color-success)",
              danger: "var(--color-danger)",
              warning: "var(--color-warning)",
              info: "var(--color-info)",
              "rail-bg": "var(--color-rail-bg)",
              "rail-bg-strong": "var(--color-rail-bg-strong)",
              "rail-fg": "var(--color-rail-fg)",
              "rail-muted": "var(--color-rail-muted)",
              "rail-border": "var(--color-rail-border)",
              "rail-hover-bg": "var(--color-rail-hover-bg)",
            },
            spacing: {
              "hsp-2xs": "var(--spacing-hsp-2xs)",
              "hsp-xs": "var(--spacing-hsp-xs)",
              "hsp-sm": "var(--spacing-hsp-sm)",
              "hsp-md": "var(--spacing-hsp-md)",
              "hsp-lg": "var(--spacing-hsp-lg)",
              "hsp-xl": "var(--spacing-hsp-xl)",
              "hsp-2xl": "var(--spacing-hsp-2xl)",
              "vsp-3xs": "var(--spacing-vsp-3xs)",
              "vsp-2xs": "var(--spacing-vsp-2xs)",
              "vsp-xs": "var(--spacing-vsp-xs)",
              "vsp-sm": "var(--spacing-vsp-sm)",
              "vsp-md": "var(--spacing-vsp-md)",
              "vsp-lg": "var(--spacing-vsp-lg)",
              "vsp-xl": "var(--spacing-vsp-xl)",
              "vsp-2xl": "var(--spacing-vsp-2xl)",
            },
            fontSizes: {
              xs: { size: "var(--text-xs)", lineHeight: "var(--text-xs--line-height)" },
              sm: { size: "var(--text-sm)", lineHeight: "var(--text-sm--line-height)" },
              base: { size: "var(--text-base)", lineHeight: "var(--text-base--line-height)" },
              lg: { size: "var(--text-lg)", lineHeight: "var(--text-lg--line-height)" },
              xl: { size: "var(--text-xl)", lineHeight: "var(--text-xl--line-height)" },
              "2xl": { size: "var(--text-2xl)", lineHeight: "var(--text-2xl--line-height)" },
            },
            fontFamilies: { sans: "var(--font-sans)", mono: "var(--font-mono)" },
            fontWeights: {
              normal: "var(--font-weight-normal)",
              medium: "var(--font-weight-medium)",
              semibold: "var(--font-weight-semibold)",
              bold: "var(--font-weight-bold)",
            },
            lineHeights: {
              tight: "var(--leading-tight)",
              snug: "var(--leading-snug)",
              normal: "var(--leading-normal)",
              relaxed: "var(--leading-relaxed)",
            },
            radii: {
              default: "var(--radius-DEFAULT)",
              sm: "var(--radius-sm)",
              md: "var(--radius-md)",
              lg: "var(--radius-lg)",
            },
            shadows: {
              card: "var(--shadow-card)",
              raised: "var(--shadow-raised)",
              overlay: "var(--shadow-overlay)",
            },
          },
          breakpoints: {
            sm: { minWidthPx: 640 },
            md: { minWidthPx: 768 },
            lg: { minWidthPx: 1024 },
            xl: { minWidthPx: 1280 },
          },
          strict: true,
          dark: false,
          utilities: { placement: "before-authored" },
          sources: { roots: ["pages", "src"] },
        } satisfies WindConfig,
      },
      zudoSgConfig,
    ),
  },
);
