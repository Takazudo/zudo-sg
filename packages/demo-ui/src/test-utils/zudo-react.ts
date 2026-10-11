/**
 * Test helpers for zudo-react islands.
 *
 * Port rules:
 * - Replace hook mocks with a mounted island and interact with its DOM.
 * - Replace rerender-with-new-props with dispose + mount; island props are
 *   immutable for one setup scope.
 * - Replace `.className` string assertions with `classList.contains()`.
 * - Re-pin SSR snapshots once: zudo-react escapes `>` in text and omits a
 *   trailing semicolon from style strings.
 *
 * These intentionally small queries support button, link, textbox, checkbox,
 * radio, combobox, and explicit roles. Names come from aria-label,
 * aria-labelledby, associated labels, and content for buttons, links, and
 * explicit roles whose names come from content. Hidden-tree filtering and the
 * full accessible-name algorithm are out of scope; use
 * `container.querySelector()` for those cases or other selectors that need
 * more detail.
 */

import { flush as flushScheduler } from "@takazudo/zfb/zudo-react";
import type {
  Child,
  Component,
  Diagnostic,
  IslandIdentity,
} from "@takazudo/zfb/zudo-react";
import { renderToString } from "@takazudo/zfb/zudo-react/server";
import {
  createIslandTest,
  withIslandTestContext,
} from "@takazudo/zfb/zudo-react/testing";
import type {
  IslandTest,
  IslandTestContextOptions,
} from "@takazudo/zfb/zudo-react/testing";

export type { Diagnostic, IslandIdentity, IslandTestContextOptions };

export interface RenderIslandOptions {
  mode?: "hydrate" | "mount";
  identity?: IslandIdentity;
  allowDiagnostics?: boolean;
  beforeActivate?: (test: IslandTest) => void;
}

export interface RenderIslandResult {
  container: Element;
  html: string;
  diagnostics: Diagnostic[];
  flush(): Promise<void>;
  dispose(): void;
}

interface RegisteredIslandTest {
  test: IslandTest;
  allowDiagnostics: boolean;
  disposed: boolean;
}

const openTests = new Set<RegisteredIslandTest>();
const htmlNamespace = "http://www.w3.org/1999/xhtml";

/** Render zudo-react output, optionally with the scanner metadata for full-page Islands. */
export function renderSsr(
  node: Child,
  context?: IslandTestContextOptions,
): string {
  return context
    ? withIslandTestContext(context, () => renderToString(node))
    : renderToString(node);
}

/**
 * Render and activate one SDK-backed island. Hydration is the default; mount
 * mode is available for tests that intentionally start without SSR markup.
 */
export function renderIsland<P extends Record<string, unknown>>(
  Component: Component<P>,
  props: P,
  options: RenderIslandOptions = {},
): RenderIslandResult {
  const test = createIslandTest(Component, props, {
    document,
    ...(options.identity ? { identity: options.identity } : {}),
  });
  const registered: RegisteredIslandTest = {
    test,
    allowDiagnostics: options.allowDiagnostics ?? false,
    disposed: false,
  };
  openTests.add(registered);

  try {
    options.beforeActivate?.(test);
    if ((options.mode ?? "hydrate") === "mount") test.mount();
    else test.hydrate();
    throwIfDiagnostics(registered);
  } catch (error) {
    const failures = disposeRegistered(registered);
    const diagnostic = diagnosticError(registered);
    const activationError = diagnostic ?? error;
    if (failures.length > 0) {
      throw new AggregateError(
        [activationError, ...failures],
        "Island activation failed and cleanup reported an error",
      );
    }
    throw activationError;
  }

  return {
    container: test.host,
    html: test.html,
    diagnostics: test.diagnostics,
    async flush() {
      try {
        await test.flush();
      } catch (error) {
        throw diagnosticError(registered) ?? error;
      }
      throwIfDiagnostics(registered);
    },
    dispose() {
      const failures = disposeRegistered(registered);
      const diagnostic = diagnosticError(registered);
      if (diagnostic) failures.push(diagnostic);
      throwFailures(failures, "Island disposal failed");
    },
  };
}

/** Flush zudo-react work and fail if any open island recorded a diagnostic. */
export async function flushAll(): Promise<void> {
  const failures: unknown[] = [];
  try {
    await flushScheduler();
  } catch (error) {
    failures.push(error);
  }
  for (const entry of openTests) {
    const diagnostic = diagnosticError(entry);
    if (diagnostic) failures.push(diagnostic);
  }
  throwFailures(failures, "zudo-react diagnostics after flushAll");
}

/** Dispose every open island before reporting any cleanup or diagnostic errors. */
export function disposeAll(): void {
  const registered = [...openTests];
  const failures: unknown[] = [];

  for (const entry of registered) failures.push(...disposeRegistered(entry));
  for (const entry of registered) {
    const diagnostic = diagnosticError(entry);
    if (diagnostic) failures.push(diagnostic);
  }

  throwFailures(failures, "zudo-react test teardown failed");
}

/** Dispatch the matching DOM event type; events bubble unless overridden. */
export function fire(
  target: Element,
  type: string,
  init: EventInit & Record<string, unknown> = {},
): boolean {
  const eventInit = { bubbles: true, ...init };
  const normalizedType = type.toLowerCase();
  let event: Event;

  if (
    normalizedType === "click" ||
    normalizedType === "dblclick" ||
    normalizedType === "contextmenu" ||
    normalizedType.startsWith("mouse")
  ) {
    event = new MouseEvent(type, eventInit as MouseEventInit);
  } else if (normalizedType.startsWith("key")) {
    event = new KeyboardEvent(type, eventInit as KeyboardEventInit);
  } else if (normalizedType === "input") {
    event = new InputEvent(type, eventInit as InputEventInit);
  } else {
    event = new Event(type, eventInit);
  }

  return target.dispatchEvent(event);
}

/** Find one exact text match. Nested text should use its semantic role query. */
export function getByText(root: ParentNode, text: string | RegExp): HTMLElement {
  return requireOne(queryAllByText(root, text), `getByText(${describeMatcher(text)})`);
}

/** Return null for no match; multiple matches are an error. */
export function queryByText(
  root: ParentNode,
  text: string | RegExp,
): HTMLElement | null {
  const matches = queryAllByText(root, text);
  if (matches.length > 1) {
    throw new Error(
      `queryByText(${describeMatcher(text)}) found ${matches.length} matches; ` +
        "use querySelectorAll for intentional multiples",
    );
  }
  return matches[0] ?? null;
}

/** Find one element by its explicit or supported native role and optional name. */
export function getByRole(
  root: ParentNode,
  role: string,
  options?: { name?: string | RegExp },
): HTMLElement {
  return requireOne(
    queryAllByRole(root, role, options),
    `getByRole(${JSON.stringify(role)}${options?.name === undefined ? "" : `, ${describeMatcher(options.name)}`})`,
  );
}

/** Return every element matching a supported role and optional accessible name. */
export function queryAllByRole(
  root: ParentNode,
  role: string,
  options?: { name?: string | RegExp },
): HTMLElement[] {
  const expectedRole = role.trim().toLowerCase();
  if (!expectedRole) return [];

  return htmlElements(root).filter((element) => {
    if (elementRole(element) !== expectedRole) return false;
    return options?.name === undefined || matches(accessibleName(element, root), options.name);
  });
}

function queryAllByText(root: ParentNode, matcher: string | RegExp): HTMLElement[] {
  return htmlElements(root).filter((element) => matches(nodeText(element), matcher));
}

function htmlElements(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll("*"))
    .filter((element) => element.namespaceURI === htmlNamespace)
    .map((element) => element as HTMLElement);
}

function nodeText(element: HTMLElement): string {
  if (element.tagName === "INPUT") {
    const input = element as HTMLInputElement;
    if (["button", "submit", "reset"].includes(input.type)) return normalize(input.value);
  }

  return normalize(
    Array.from(element.childNodes)
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent ?? "")
      .join(""),
  );
}

function elementRole(element: HTMLElement): string | undefined {
  const explicit = element.getAttribute("role")?.trim().split(/\s+/)[0];
  if (explicit) return explicit.toLowerCase();

  const tag = element.tagName.toLowerCase();
  if (tag === "button") return "button";
  if ((tag === "a" || tag === "area") && element.hasAttribute("href")) return "link";
  if (tag === "textarea") return "textbox";
  if (tag === "select") return (element as HTMLSelectElement).multiple ? "listbox" : "combobox";
  if (tag !== "input") return undefined;

  const type = ((element as HTMLInputElement).type || "text").toLowerCase();
  if (["button", "image", "reset", "submit"].includes(type)) return "button";
  if (type === "checkbox") return "checkbox";
  if (type === "radio") return "radio";
  if (["email", "tel", "text", "url"].includes(type)) return "textbox";
  return undefined;
}

function accessibleName(element: HTMLElement, root: ParentNode): string {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy !== null) {
    return normalize(
      labelledBy
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => findById(root, element.ownerDocument, id)?.textContent ?? "")
        .join(" "),
    );
  }

  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel !== null) return normalize(ariaLabel);

  const labels = associatedLabels(element, root);
  if (labels.length > 0) return normalize(labels.map((label) => label.textContent ?? "").join(" "));

  if (element.tagName === "INPUT") {
    const input = element as HTMLInputElement;
    if (input.type === "image") return normalize(input.alt);
    if (["button", "reset", "submit"].includes(input.type)) return normalize(input.value);
  }
  if (element.tagName === "IMG") return normalize((element as HTMLImageElement).alt);

  const explicitRole = element.getAttribute("role")?.trim().split(/\s+/)[0]?.toLowerCase();
  const tag = element.tagName.toLowerCase();
  const contentNamedRoles = [
    "button",
    "link",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "tab",
    "treeitem",
    "heading",
  ];
  if (
    contentNamedRoles.includes(explicitRole ?? "") ||
    tag === "button" ||
    tag === "a" ||
    tag === "area"
  ) {
    return normalize(element.textContent ?? "");
  }

  return "";
}

function associatedLabels(element: HTMLElement, root: ParentNode): HTMLLabelElement[] {
  const labels = new Set<HTMLLabelElement>();
  const id = element.id;

  if (id) {
    for (const candidate of htmlElements(root)) {
      if (candidate.tagName === "LABEL" && (candidate as HTMLLabelElement).htmlFor === id) {
        labels.add(candidate as HTMLLabelElement);
      }
    }
    for (const candidate of Array.from(element.ownerDocument.querySelectorAll("label[for]"))) {
      if ((candidate as HTMLLabelElement).htmlFor === id) labels.add(candidate as HTMLLabelElement);
    }
  }

  const wrappingLabel = element.closest("label");
  if (wrappingLabel) labels.add(wrappingLabel as HTMLLabelElement);
  return [...labels];
}

function findById(root: ParentNode, ownerDocument: Document, id: string): Element | null {
  const documentMatch = ownerDocument.getElementById(id);
  if (documentMatch) return documentMatch;
  return htmlElements(root).find((element) => element.id === id) ?? null;
}

function matches(value: string, matcher: string | RegExp): boolean {
  const normalized = normalize(value);
  if (typeof matcher === "string") return normalized === normalize(matcher);

  const pattern = new RegExp(matcher.source, matcher.flags.replace(/[gy]/g, ""));
  return pattern.test(normalized);
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function requireOne(matches: HTMLElement[], description: string): HTMLElement {
  if (matches.length === 0) throw new Error(`${description} found no matching element`);
  if (matches.length > 1) {
    throw new Error(`${description} found ${matches.length} matching elements`);
  }
  return matches[0]!;
}

function describeMatcher(matcher: string | RegExp): string {
  return typeof matcher === "string" ? JSON.stringify(matcher) : matcher.toString();
}

function diagnosticError(entry: RegisteredIslandTest): Error | undefined {
  if (entry.allowDiagnostics || entry.test.diagnostics.length === 0) return undefined;
  const summary = entry.test.diagnostics
    .map((diagnostic) => `${diagnostic.code} (${diagnostic.phase}) at ${diagnostic.path}`)
    .join("; ");
  return new Error(`zudo-react island diagnostic: ${summary}`);
}

function throwIfDiagnostics(entry: RegisteredIslandTest): void {
  const error = diagnosticError(entry);
  if (error) throw error;
}

function disposeRegistered(entry: RegisteredIslandTest): unknown[] {
  if (entry.disposed) return [];
  entry.disposed = true;
  openTests.delete(entry);
  try {
    entry.test.dispose();
    return [];
  } catch (error) {
    return [error];
  }
}

function throwFailures(failures: unknown[], message: string): void {
  if (failures.length === 0) return;
  if (failures.length === 1) throw failures[0];
  throw new AggregateError(failures, message);
}
