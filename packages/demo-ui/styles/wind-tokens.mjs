// Shared utility roles reference live CSS variables, never copied defaults.
// Wind reserves spacing 0/px and radius full for static utilities (0, 1px,
// 9999px). Keep their CSS variables in tokens.css for direct consumers.
// Its lowercase radius `default` maps rounded to the existing --radius-DEFAULT.
export const demoUiWindTokens = {
  "colors": {
    "bg": "var(--color-bg)",
    "surface": "var(--color-surface)",
    "surface-2": "var(--color-surface-2)",
    "border": "var(--color-border)",
    "fg": "var(--color-fg)",
    "muted": "var(--color-muted)",
    "accent": "var(--color-accent)",
    "accent-hover": "var(--color-accent-hover)",
    "on-accent": "var(--color-on-accent)",
    "focus": "var(--color-focus)",
    "rail-bg": "var(--color-rail-bg)",
    "rail-bg-strong": "var(--color-rail-bg-strong)",
    "rail-fg": "var(--color-rail-fg)",
    "rail-muted": "var(--color-rail-muted)",
    "rail-border": "var(--color-rail-border)",
    "rail-hover-bg": "var(--color-rail-hover-bg)",
    "loading-scrim": "var(--color-loading-scrim)",
    "overlay": "var(--color-overlay)",
    "success": "var(--color-success)",
    "danger": "var(--color-danger)",
    "warning": "var(--color-warning)",
    "info": "var(--color-info)"
  },
  "spacing": {
    "hsp-2xs": "var(--spacing-hsp-2xs)",
    "hsp-xs": "var(--spacing-hsp-xs)",
    "hsp-sm": "var(--spacing-hsp-sm)",
    "hsp-md": "var(--spacing-hsp-md)",
    "hsp-lg": "var(--spacing-hsp-lg)",
    "hsp-xl": "var(--spacing-hsp-xl)",
    "hsp-2xl": "var(--spacing-hsp-2xl)",
    "vsp-3xs": "var(--spacing-vsp-3xs)",
    "vsp-2xs": "var(--spacing-vsp-2xs)",
    "vsp-10": "var(--spacing-vsp-10)",
    "vsp-xs": "var(--spacing-vsp-xs)",
    "vsp-sm": "var(--spacing-vsp-sm)",
    "vsp-md": "var(--spacing-vsp-md)",
    "vsp-lg": "var(--spacing-vsp-lg)",
    "vsp-xl": "var(--spacing-vsp-xl)",
    "vsp-2xl": "var(--spacing-vsp-2xl)"
  },
  "fontSizes": {
    "xs": {
      "size": "var(--text-xs)",
      "lineHeight": "var(--text-xs--line-height)"
    },
    "sm": {
      "size": "var(--text-sm)",
      "lineHeight": "var(--text-sm--line-height)"
    },
    "base": {
      "size": "var(--text-base)",
      "lineHeight": "var(--text-base--line-height)"
    },
    "lg": {
      "size": "var(--text-lg)",
      "lineHeight": "var(--text-lg--line-height)"
    },
    "xl": {
      "size": "var(--text-xl)",
      "lineHeight": "var(--text-xl--line-height)"
    },
    "2xl": {
      "size": "var(--text-2xl)",
      "lineHeight": "var(--text-2xl--line-height)"
    },
    "micro": {
      "size": "var(--text-micro)"
    },
    "caption": {
      "size": "var(--text-caption)"
    },
    "small": {
      "size": "var(--text-small)"
    },
    "body": {
      "size": "var(--text-body)"
    },
    "title": {
      "size": "var(--text-title)"
    },
    "heading": {
      "size": "var(--text-heading)"
    },
    "display": {
      "size": "var(--text-display)"
    }
  },
  "fontFamilies": {
    "sans": "var(--font-sans)",
    "mono": "var(--font-mono)"
  },
  "fontWeights": {
    "normal": "var(--font-weight-normal)",
    "medium": "var(--font-weight-medium)",
    "semibold": "var(--font-weight-semibold)",
    "bold": "var(--font-weight-bold)"
  },
  "lineHeights": {
    "tight": "var(--leading-tight)",
    "snug": "var(--leading-snug)",
    "normal": "var(--leading-normal)",
    "relaxed": "var(--leading-relaxed)"
  },
  "letterSpacings": {
    "wide": "var(--tracking-wide)"
  },
  "radii": {
    "default": "var(--radius-DEFAULT)",
    "sm": "var(--radius-sm)",
    "md": "var(--radius-md)",
    "lg": "var(--radius-lg)"
  },
  "shadows": {
    "card": "var(--shadow-card)",
    "raised": "var(--shadow-raised)",
    "overlay": "var(--shadow-overlay)"
  },
  "zIndices": {
    "ui-base": "var(--z-index-ui-base)",
    "ui-sticky": "var(--z-index-ui-sticky)",
    "ui-dropdown": "var(--z-index-ui-dropdown)",
    "ui-overlay": "var(--z-index-ui-overlay)",
    "ui-modal": "var(--z-index-ui-modal)",
    "ui-toast": "var(--z-index-ui-toast)"
  }
};

export const demoUiWindBreakpoints = {
  "sm": {
    "minWidthPx": 640
  },
  "md": {
    "minWidthPx": 768
  },
  "lg": {
    "minWidthPx": 1024
  },
  "xl": {
    "minWidthPx": 1280
  }
};
