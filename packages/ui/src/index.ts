// @zudo-sg/ui — shared Preact component library.
//
// Public barrel. Components are consumed FROM SOURCE (this package's "main" /
// "exports" point at src/*.ts directly) — there is no build step; the consuming
// app's Vite/zfb pipeline transpiles these .tsx files. See STORIES.md.
//
// Stories are NOT re-exported here: the catalog discovers `*.stories.tsx` via
// generated explicit imports (see STORIES.md), so keeping them out of the
// barrel avoids pulling story render trees into app bundles.

// ── Actions ──────────────────────────────────────────────────────────────
export { Button } from "./button/button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./button/button";

export { Dialog } from "./dialog/dialog";
export type { DialogProps } from "./dialog/dialog";

export { Link } from "./link/link";
export type { LinkProps, LinkVariant } from "./link/link";

// ── Typography ───────────────────────────────────────────────────────────
export { PageHeading, SectionHeading } from "./heading/heading";

// ── Data display ─────────────────────────────────────────────────────────
export { Badge } from "./badge/badge";
export type { BadgeProps, BadgeTone, BadgeVariant } from "./badge/badge";

export { Stat, StatGroup } from "./stat/stat";

// ── Layout ───────────────────────────────────────────────────────────────
export { Card, CardTitle, CardBody, CardFooter } from "./card/card";
export type { CardVariant } from "./card/card";

export { Hero } from "./hero/hero";

// ── Navigation ───────────────────────────────────────────────────────────
export { SiteHeader } from "./site-header/site-header";
export type { NavItem } from "./site-header/site-header";

export { SiteFooter } from "./footer/footer";
export type { FooterLink, FooterGroup } from "./footer/footer";

// ── Forms ────────────────────────────────────────────────────────────────
export { Field, Input, Textarea } from "./form/form";
export type { InputProps, TextareaProps } from "./form/form";

// ── Story-authoring contract (consumed by the S6 catalog) ────────────────
export type {
  StoryMeta,
  StoryCategory,
  Story,
  StoryControl,
  StoryModule,
} from "./stories/types";
export { defineStory } from "./stories/types";

// ── Utilities ────────────────────────────────────────────────────────────
export { cx } from "./lib/cx";
export type { ClassValue } from "./lib/cx";
