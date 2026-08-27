"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Stable client-island entry for `/sitemapper` (issue #400).
//
// The production editor replaces this thin placeholder in the assembly wave.
// Keeping the page-facing constructor and island marker stable means that
// route chrome, SSR fallback behavior, and the zfb import graph do not need to
// change when the real controller/workspace is wired in.

import type { JSX } from "preact";
import PlaceholderPane from "./placeholder-pane";

export default function SitemapperApp(): JSX.Element {
  return <PlaceholderPane />;
}

SitemapperApp.displayName = "SitemapperApp";
