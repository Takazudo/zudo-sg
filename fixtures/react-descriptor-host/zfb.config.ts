import { defineConfig, type WindConfig } from "@takazudo/zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { withZudoSg } from "@takazudo/zudo-sg/config";
import zudoSgConfig from "./zudo-sg.config.mjs";

export default defineConfig(
  {
    ...withZudoSg(
      {
        ...zudoDoc({
          siteName: "React Descriptor Host",
          base: "/styleguide/",
          port: 4397,
          // The starter ships no public/ icons; replace "auto" with a path or FaviconConfig once real icons exist.
          favicon: "auto",
          // No mermaid diagrams anywhere in this starter's one seed doc; turned
          // off rather than leaving the default on to keep the dependency set
          // minimal (see package.json).
          mermaid: false,
          strictContentBridge: true,
          dynamicPageTransition: true,
          // Bundling follows `bundleZdtp ?? designTokenPanel`; this starter never
          // sets `designTokenPanel`, so without this the zdtp loader resolves to
          // zudo-doc's throwing stub and the engine's PREVIEW token panel (opened
          // from the header trigger `withZudoSg` injects) rejects at runtime
          // (zudolab/zudo-doc#4261).
          bundleZdtp: true,
          // Mounts the preview token panel bootstrap on every package-owned
          // route (/components/*, /tokens), not just this starter's host-owned
          // `/`. See pages/lib/_chrome-bindings.tsx.
          chromeBindingsModule: "./pages/lib/_chrome-bindings.tsx",
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
