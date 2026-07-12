const STORAGE_KEY = "zudo-sg-composer-prototype-v2";
const THEME_KEY = "zudo-sg-composer-prototype-theme";
const PANEL_LIMITS = {
  left: { min: 220, max: 420 },
  right: { min: 280, max: 440 },
  center: 360,
};

const icon = {
  chevron: '<svg aria-hidden="true" viewBox="0 0 16 16"><path d="m6 3 5 5-5 5"/></svg>',
  plus: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  up: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>',
  down: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  trash: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></svg>',
  info: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  root: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 9h16M8 9v10"/></svg>',
};

const composerManifest = {
  PageRoot: {
    label: "PageRoot",
    category: "Root",
    glyph: "Pg",
    description: "Virtual, non-removable root for one Composition.",
    slots: [{ name: "children", label: "Page content" }],
    defaults: {},
    controls: [],
    hidden: true,
  },
  Hero: {
    label: "Hero",
    category: "Content",
    glyph: "H",
    description: "Page-opening statement with an eyebrow, heading, and supporting lead.",
    slots: [],
    defaults: {
      eyebrow: "Built with Zudo Sg",
      heading: "A faster way to compose a new page",
      lead: "Arrange production-ready components, tune their props, and export a readable composition.",
      variant: "primary",
    },
    controls: [
      { prop: "eyebrow", label: "Eyebrow", type: "text" },
      { prop: "heading", label: "Heading", type: "textarea" },
      { prop: "lead", label: "Lead", type: "textarea" },
      { prop: "variant", label: "Variant", type: "select", options: ["primary", "secondary"] },
    ],
  },
  Container: {
    label: "Container",
    category: "Layout",
    glyph: "Ct",
    description: "Centers content inside the page-wide horizontal bounds.",
    slots: [{ name: "children", label: "Children" }],
    defaults: {},
    controls: [],
  },
  SplitLayout: {
    label: "SplitLayout",
    category: "Layout",
    glyph: "2C",
    description: "Prototype-only two-column container used to validate named slot authoring.",
    slots: [
      { name: "left", label: "Left column" },
      { name: "right", label: "Right column" },
    ],
    defaults: { ratio: "1:1", gap: "lg", minHeight: 220 },
    controls: [
      { prop: "ratio", label: "Column ratio", type: "select", options: ["1:1", "2:1", "1:2"] },
      { prop: "gap", label: "Column gap", type: "select", options: ["sm", "md", "lg"] },
      { prop: "minHeight", label: "Minimum height", type: "number", min: 120, max: 600, step: 10, suffix: "px" },
    ],
    experimental: true,
  },
  Stack: {
    label: "Stack",
    category: "Layout",
    glyph: "St",
    description: "Prototype-only vertical flow primitive for arbitrary nested children.",
    slots: [{ name: "children", label: "Children" }],
    defaults: { gap: "md" },
    controls: [{ prop: "gap", label: "Vertical gap", type: "select", options: ["sm", "md", "lg"] }],
    experimental: true,
  },
  AutoGrid: {
    label: "AutoGrid",
    category: "Layout",
    glyph: "Gr",
    description: "Responsive auto-fit grid container with a configurable minimum track width.",
    slots: [{ name: "children", label: "Grid items" }],
    defaults: { min: "15rem", gap: "md", fill: false },
    controls: [
      { prop: "min", label: "Minimum track", type: "select", options: ["11rem", "13rem", "15rem", "18rem"] },
      { prop: "gap", label: "Grid gap", type: "select", options: ["sm", "md", "split"] },
      { prop: "fill", label: "Keep empty tracks", type: "boolean", hint: "Use auto-fill instead of auto-fit" },
    ],
  },
  Card: {
    label: "Card",
    category: "Data Display",
    glyph: "Cd",
    description: "Flat content surface with a title, visual variant, padding, and child slot.",
    slots: [{ name: "children", label: "Card content" }],
    defaults: { title: "Card title", variant: "default", padding: "md" },
    controls: [
      { prop: "title", label: "Title", type: "text" },
      { prop: "variant", label: "Variant", type: "select", options: ["default", "accent", "muted"] },
      { prop: "padding", label: "Padding", type: "select", options: ["sm", "md", "lg"] },
    ],
  },
  SectionHeading: {
    label: "SectionHeading",
    category: "Content",
    glyph: "H2",
    description: "Section header block with an optional eyebrow and supporting introduction.",
    slots: [],
    defaults: {
      eyebrow: "Composer workflow",
      heading: "Build with familiar components",
      intro: "The canvas and source are two projections of the same serializable tree.",
      as: "h2",
    },
    controls: [
      { prop: "eyebrow", label: "Eyebrow", type: "text" },
      { prop: "heading", label: "Heading", type: "textarea" },
      { prop: "intro", label: "Introduction", type: "textarea" },
      { prop: "as", label: "Heading element", type: "select", options: ["h1", "h2"] },
    ],
  },
  ProseP: {
    label: "ProseP",
    category: "Typography",
    glyph: "P",
    description: "A paragraph of body copy rendered with the content typography rhythm.",
    slots: [],
    defaults: {
      children: "Describe the idea in plain language, then refine the words while viewing the real layout.",
      size: "base",
    },
    controls: [
      { prop: "children", label: "Text", type: "textarea" },
      { prop: "size", label: "Text size", type: "select", options: ["small", "base", "large"] },
    ],
  },
  CtaButton: {
    label: "CtaButton",
    category: "Actions",
    glyph: "Bt",
    description: "Accent-filled or outlined call-to-action link.",
    slots: [],
    defaults: { children: "Explore components", href: "#components", variant: "primary", arrow: true },
    controls: [
      { prop: "children", label: "Label", type: "text" },
      { prop: "href", label: "Destination", type: "url" },
      { prop: "variant", label: "Variant", type: "select", options: ["primary", "secondary"] },
      { prop: "arrow", label: "Show trailing arrow", type: "boolean", hint: "Decorative arrow after the label" },
    ],
  },
  Callout: {
    label: "Callout",
    category: "Feedback",
    glyph: "!",
    description: "A compact note or muted aside embedded in content flow.",
    slots: [],
    defaults: {
      title: "Why this matters",
      children: "Named slots let a Composition express where nested components belong without storing JSX as state.",
      tone: "note",
    },
    controls: [
      { prop: "title", label: "Title", type: "text" },
      { prop: "children", label: "Body", type: "textarea" },
      { prop: "tone", label: "Tone", type: "select", options: ["note", "muted"] },
    ],
  },
  PlaceholderBox: {
    label: "PlaceholderBox",
    category: "Media",
    glyph: "Im",
    description: "Image stand-in with a visible label and configurable aspect ratio.",
    slots: [],
    defaults: { label: "Product image", aspect: "4/3" },
    controls: [
      { prop: "label", label: "Label", type: "text" },
      { prop: "aspect", label: "Aspect ratio", type: "select", options: ["16/9", "4/3", "1/1"] },
    ],
  },
};

const appShell = document.querySelector("#app-shell");
const workspace = document.querySelector("#workspace");
const treeRoot = document.querySelector("#composition-tree");
const canvas = document.querySelector("#composition-canvas");
const inspector = document.querySelector("#inspector");
const nodeCount = document.querySelector("#node-count");
const selectedPath = document.querySelector("#selected-path");
const canvasModeLabel = document.querySelector("#canvas-mode-label");
const inspectorModeBadge = document.querySelector("#inspector-mode-badge");
const componentDialog = document.querySelector("#component-dialog");
const exportDialog = document.querySelector("#export-dialog");
const componentSearch = document.querySelector("#component-search");
const componentList = document.querySelector("#component-list");
const categoryFilters = document.querySelector("#category-filters");
const slotPicker = document.querySelector("#slot-picker");
const slotPickerWrap = document.querySelector("#slot-picker-wrap");
const addTargetLabel = document.querySelector("#add-target-label");
const exportCode = document.querySelector("#export-code");
const exportSummary = document.querySelector("#export-summary");
const copyCodeButton = document.querySelector("#copy-code-button");
const toast = document.querySelector("#toast");
const saveStatus = document.querySelector("#save-status");
const canvasViewport = document.querySelector("#canvas-viewport");

let sequence = 0;
let addTarget = null;
let activeCategory = "All";
let toastTimer;
let saveTimer;
let storageUnavailable = false;

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    storageUnavailable = true;
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    storageUnavailable = false;
    return true;
  } catch {
    storageUnavailable = true;
    return false;
  }
}

function showStorageUnavailable() {
  saveStatus.removeAttribute("data-saving");
  saveStatus.setAttribute("data-error", "");
  saveStatus.lastChild.textContent = "Not saved";
}

function makeId(type) {
  sequence += 1;
  return `${type.toLowerCase()}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

function makeNode(type, props = {}, slots = {}, id = makeId(type)) {
  const definition = composerManifest[type];
  const nodeSlots = Object.fromEntries(definition.slots.map((slot) => [slot.name, []]));
  for (const [name, children] of Object.entries(slots)) {
    if (name in nodeSlots && Array.isArray(children)) nodeSlots[name] = children;
  }
  return {
    id,
    type,
    props: { ...definition.defaults, ...props },
    slots: nodeSlots,
  };
}

function createSampleRoot() {
  const hero = makeNode("Hero", {}, {}, "hero-main");
  const heading = makeNode("SectionHeading", {}, {}, "heading-workflow");
  const image = makeNode("PlaceholderBox", { label: "Composed page preview", aspect: "4/3" }, {}, "image-preview");
  const body = makeNode(
    "ProseP",
    { children: "Select any component in the tree or directly on the canvas. Its editable props appear in the inspector and update this preview immediately." },
    {},
    "copy-intro",
  );
  const callout = makeNode("Callout", {}, {}, "callout-slots");
  const button = makeNode("CtaButton", {}, {}, "cta-explore");
  const stack = makeNode("Stack", { gap: "md" }, { children: [body, callout, button] }, "stack-right");
  const split = makeNode("SplitLayout", { ratio: "1:2", gap: "lg" }, { left: [image], right: [stack] }, "split-main");
  const cardOne = makeNode(
    "Card",
    { title: "Serializable by design", variant: "accent" },
    {
      children: [
        makeNode("ProseP", { children: "Stable node IDs, typed props, and named slots make each Composition portable." }, {}, "copy-card-one"),
      ],
    },
    "card-model",
  );
  const cardTwo = makeNode(
    "Card",
    { title: "One source of truth", variant: "muted" },
    {
      children: [
        makeNode("ProseP", { children: "The tree, canvas, inspector, and exported JSX all derive from the same state." }, {}, "copy-card-two"),
      ],
    },
    "card-source",
  );
  const grid = makeNode("AutoGrid", { min: "15rem", gap: "md", fill: false }, { children: [cardOne, cardTwo] }, "grid-benefits");
  const container = makeNode("Container", {}, { children: [heading, split, grid] }, "container-main");
  return makeNode("PageRoot", {}, { children: [hero, container] }, "root");
}

function defaultState() {
  return {
    root: createSampleRoot(),
    selectedId: "split-main",
    mode: "edit",
    viewport: "desktop",
    expandedIds: new Set([
      "root",
      "container-main",
      "split-main",
      "stack-right",
      "grid-benefits",
      "card-model",
      "card-source",
    ]),
    panelWidths: { left: 288, right: 336 },
  };
}

function isValidNode(node) {
  if (!node || typeof node !== "object" || typeof node.id !== "string" || !composerManifest[node.type]) return false;
  const definition = composerManifest[node.type];
  if (!node.props || typeof node.props !== "object" || !node.slots || typeof node.slots !== "object") return false;
  return definition.slots.every((slot) => Array.isArray(node.slots[slot.name]) && node.slots[slot.name].every(isValidNode));
}

function loadState() {
  try {
    const raw = readStorage(STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    if (!stored || !isValidNode(stored.root)) return defaultState();
    return {
      root: stored.root,
      selectedId: typeof stored.selectedId === "string" ? stored.selectedId : stored.root.id,
      mode: stored.mode === "preview" ? "preview" : "edit",
      viewport: ["desktop", "tablet", "mobile"].includes(stored.viewport) ? stored.viewport : "desktop",
      expandedIds: new Set(Array.isArray(stored.expandedIds) ? stored.expandedIds : [stored.root.id]),
      panelWidths: {
        left: clamp(Number(stored.panelWidths?.left) || 288, PANEL_LIMITS.left.min, PANEL_LIMITS.left.max),
        right: clamp(Number(stored.panelWidths?.right) || 336, PANEL_LIMITS.right.min, PANEL_LIMITS.right.max),
      },
    };
  } catch {
    return defaultState();
  }
}

let state = loadState();

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function saveState() {
  clearTimeout(saveTimer);
  saveStatus.setAttribute("data-saving", "");
  saveStatus.lastChild.textContent = "Saving…";
  const serializable = {
    root: state.root,
    selectedId: state.selectedId,
    mode: state.mode,
    viewport: state.viewport,
    expandedIds: [...state.expandedIds],
    panelWidths: state.panelWidths,
  };
  if (!writeStorage(STORAGE_KEY, JSON.stringify(serializable))) {
    showToast("Local saving is unavailable in this browser.");
    showStorageUnavailable();
    return;
  }
  saveStatus.removeAttribute("data-error");
  saveTimer = window.setTimeout(() => {
    saveStatus.removeAttribute("data-saving");
    saveStatus.lastChild.textContent = "Saved locally";
  }, 350);
}

function walkNode(node, visitor, parent = null, slot = null, index = 0, ancestors = []) {
  if (visitor(node, { parent, slot, index, ancestors })) return true;
  const nextAncestors = [...ancestors, node];
  for (const slotDefinition of composerManifest[node.type].slots) {
    const children = node.slots[slotDefinition.name] ?? [];
    for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
      if (walkNode(children[childIndex], visitor, node, slotDefinition.name, childIndex, nextAncestors)) return true;
    }
  }
  return false;
}

function findNode(id) {
  let result = null;
  walkNode(state.root, (node, context) => {
    if (node.id !== id) return false;
    result = { node, ...context };
    return true;
  });
  return result;
}

function countNodes(node = state.root) {
  let count = 1;
  for (const definition of composerManifest[node.type].slots) {
    for (const child of node.slots[definition.name]) count += countNodes(child);
  }
  return count;
}

function nodeSummary(node) {
  const value = node.props.heading ?? node.props.title ?? node.props.label ?? node.props.children ?? "";
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (!normalized) return composerManifest[node.type].category;
  return normalized.length > 34 ? `${normalized.slice(0, 34)}…` : normalized;
}

function nodePath(record) {
  if (!record) return "Page";
  const parts = record.ancestors.map((ancestor) => composerManifest[ancestor.type].label);
  if (record.slot && record.parent && composerManifest[record.parent.type].slots.length > 1) {
    const slotDefinition = composerManifest[record.parent.type].slots.find((slot) => slot.name === record.slot);
    if (slotDefinition) parts.push(slotDefinition.label);
  }
  if (record.node !== state.root) parts.push(composerManifest[record.node.type].label);
  return parts.join(" / ") || "Page";
}

function expandAncestors(id) {
  const record = findNode(id);
  if (!record) return;
  for (const ancestor of record.ancestors) state.expandedIds.add(ancestor.id);
}

function focusTreeNode(id) {
  const button = treeRoot.querySelector(`[data-select-node="${CSS.escape(id)}"]`);
  if (!button) return;
  button.focus({ preventScroll: true });
  button.scrollIntoView({ block: "nearest" });
}

function selectNode(id, { reveal = false } = {}) {
  if (!findNode(id)) return;
  state.selectedId = id;
  expandAncestors(id);
  renderTree();
  renderCanvas();
  renderInspector();
  updateContextLabels();
  saveState();
  if (reveal) {
    requestAnimationFrame(() => {
      treeRoot.querySelector(`[data-tree-node-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
    });
  }
}

function renderTree() {
  const activeElement = treeRoot.contains(document.activeElement) ? document.activeElement : null;
  const focusTarget = activeElement?.dataset.selectNode
    ? { attribute: "data-select-node", value: activeElement.dataset.selectNode }
    : activeElement?.dataset.toggleNode
      ? { attribute: "data-toggle-node", value: activeElement.dataset.toggleNode }
      : null;
  const rows = renderTreeNode(state.root, 0);
  treeRoot.innerHTML = `<div class="composition-tree">${rows}</div>`;
  nodeCount.textContent = String(countNodes() - 1);
  if (focusTarget) {
    treeRoot
      .querySelector(`[${focusTarget.attribute}="${CSS.escape(focusTarget.value)}"]`)
      ?.focus({ preventScroll: true });
  }
}

function renderTreeNode(node, depth) {
  const definition = composerManifest[node.type];
  const hasSlots = definition.slots.length > 0;
  const isExpanded = node === state.root || state.expandedIds.has(node.id);
  const selected = node.id === state.selectedId;
  const readonly = state.mode === "preview";
  const disclosure = hasSlots
    ? `<button class="tree-row__disclosure" type="button" data-toggle-node="${escapeAttribute(node.id)}" aria-label="${isExpanded ? "Collapse" : "Expand"} ${escapeAttribute(definition.label)}" aria-expanded="${isExpanded}">${icon.chevron}</button>`
    : '<span class="tree-row__spacer" aria-hidden="true"></span>';
  const addAction = hasSlots && !readonly
    ? `<button class="tree-row__action" type="button" data-add-parent="${escapeAttribute(node.id)}" aria-label="Add component inside ${escapeAttribute(definition.label)}" title="Add component">${icon.plus}</button>`
    : "";
  let html = `
    <div class="tree-node" data-tree-node-id="${escapeAttribute(node.id)}">
      <div class="tree-row" style="--depth:${depth}" data-selected="${selected}">
        ${disclosure}
        <button class="tree-row__main" type="button" data-select-node="${escapeAttribute(node.id)}" aria-pressed="${selected}">
          <span class="component-glyph" data-container="${hasSlots}" aria-hidden="true">${escapeHtml(definition.glyph)}</span>
          <span class="tree-row__copy">
            <span class="tree-row__label">${escapeHtml(definition.label)}</span>
            <span class="tree-row__summary">${escapeHtml(nodeSummary(node))}</span>
          </span>
        </button>
        <span class="tree-row__actions">${addAction}</span>
      </div>`;

  if (hasSlots && isExpanded) {
    for (const slotDefinition of definition.slots) {
      const children = node.slots[slotDefinition.name] ?? [];
      html += `
        <div class="tree-slot" style="--depth:${depth}">
          <div class="tree-slot__header">
            <span>${escapeHtml(slotDefinition.label)}</span>
            ${readonly ? "" : `<button type="button" data-add-parent="${escapeAttribute(node.id)}" data-add-slot="${escapeAttribute(slotDefinition.name)}">+ Add</button>`}
          </div>`;
      if (children.length === 0) {
        html += `<div class="tree-empty" style="--depth:${depth}">Empty slot</div>`;
      } else {
        html += children.map((child) => renderTreeNode(child, depth + 1)).join("");
      }
      html += "</div>";
    }
  }

  html += "</div>";
  return html;
}

function renderCanvas() {
  canvas.innerHTML = renderCanvasNode(state.root);
  canvasViewport.dataset.viewport = state.viewport;
}

function canvasFrame(node, content, extraClass = "") {
  const definition = composerManifest[node.type];
  const selected = node.id === state.selectedId;
  return `
    <div class="canvas-node ${extraClass}" data-node-id="${escapeAttribute(node.id)}" data-selected="${selected}">
      <span class="canvas-node__label">${escapeHtml(definition.label)}${definition.slots.length ? `<span>${definition.slots.length} slot${definition.slots.length > 1 ? "s" : ""}</span>` : ""}</span>
      ${content}
    </div>`;
}

function renderCanvasSlot(node, slotName, { className = "", style = "" } = {}) {
  const definition = composerManifest[node.type];
  const slotDefinition = definition.slots.find((slot) => slot.name === slotName);
  const children = node.slots[slotName] ?? [];
  const isNamed = definition.slots.length > 1;
  const addLabel = children.length ? "Add another component" : `Add to ${slotDefinition.label}`;
  return `
    <div class="canvas-slot ${className}" style="${escapeAttribute(style)}" data-slot-owner="${escapeAttribute(node.id)}" data-slot-name="${escapeAttribute(slotName)}" data-named="${isNamed}">
      <span class="canvas-slot__name">${escapeHtml(slotDefinition.label)}</span>
      ${children.map(renderCanvasNode).join("")}
      <button class="canvas-add" type="button" data-canvas-add="${escapeAttribute(node.id)}" data-canvas-slot="${escapeAttribute(slotName)}" data-empty="${children.length === 0}">
        ${icon.plus}<span>${escapeHtml(addLabel)}</span>
      </button>
    </div>`;
}

function renderCanvasNode(node) {
  const props = node.props;
  switch (node.type) {
    case "PageRoot":
      return canvasFrame(node, renderCanvasSlot(node, "children", { className: "root-slot" }), "composition-page");
    case "Hero": {
      const content = `
        <section class="demo-hero" data-variant="${escapeAttribute(props.variant)}">
          <div>
            <p class="demo-hero__eyebrow">${escapeHtml(props.eyebrow)}</p>
            <h1>${escapeHtml(props.heading)}</h1>
            <p class="demo-hero__lead">${escapeHtml(props.lead)}</p>
            <span class="demo-hero__accent" aria-hidden="true"></span>
          </div>
        </section>`;
      return canvasFrame(node, content);
    }
    case "Container":
      return canvasFrame(node, `<div class="demo-container">${renderCanvasSlot(node, "children")}</div>`);
    case "SplitLayout": {
      const ratios = { "1:1": "minmax(0,1fr) minmax(0,1fr)", "2:1": "minmax(0,2fr) minmax(0,1fr)", "1:2": "minmax(0,1fr) minmax(0,2fr)" };
      const gaps = { sm: "12px", md: "20px", lg: "32px" };
      const minHeight = clamp(Number(props.minHeight) || 220, 120, 600);
      const style = `--split-columns:${ratios[props.ratio] ?? ratios["1:1"]};--split-gap:${gaps[props.gap] ?? gaps.lg};min-height:${minHeight}px`;
      return canvasFrame(node, `<div class="demo-split" style="${style}">${renderCanvasSlot(node, "left")}${renderCanvasSlot(node, "right")}</div>`);
    }
    case "Stack":
      return canvasFrame(node, renderCanvasSlot(node, "children", { className: "demo-stack" }).replace("class=\"canvas-slot demo-stack\"", `class="canvas-slot demo-stack" data-gap="${escapeAttribute(props.gap)}"`));
    case "AutoGrid": {
      const min = { "11rem": "176px", "13rem": "208px", "15rem": "240px", "18rem": "288px" };
      const gap = { sm: "12px", md: "20px", split: "18px 24px" };
      const style = `--grid-min:${min[props.min] ?? min["15rem"]};--grid-gap:${gap[props.gap] ?? gap.md};--grid-mode:${props.fill ? "auto-fill" : "auto-fit"}`;
      return canvasFrame(node, renderCanvasSlot(node, "children", { className: "demo-grid", style }));
    }
    case "Card": {
      const content = `
        <article class="demo-card" data-variant="${escapeAttribute(props.variant)}" data-padding="${escapeAttribute(props.padding)}">
          ${props.title ? `<h3 class="demo-card__title">${escapeHtml(props.title)}</h3>` : ""}
          ${renderCanvasSlot(node, "children")}
        </article>`;
      return canvasFrame(node, content);
    }
    case "SectionHeading": {
      const tag = props.as === "h1" ? "h1" : "h2";
      const content = `
        <header class="demo-section-heading">
          ${props.eyebrow ? `<p class="demo-section-heading__eyebrow">${escapeHtml(props.eyebrow)}</p>` : ""}
          <${tag}>${escapeHtml(props.heading)}</${tag}>
          ${props.intro ? `<p class="demo-section-heading__intro">${escapeHtml(props.intro)}</p>` : ""}
        </header>`;
      return canvasFrame(node, content);
    }
    case "ProseP":
      return canvasFrame(node, `<p class="demo-text" data-size="${escapeAttribute(props.size)}">${escapeHtml(props.children)}</p>`);
    case "CtaButton":
      return canvasFrame(node, `<a class="demo-button" data-variant="${escapeAttribute(props.variant)}" href="${escapeAttribute(props.href)}"><span>${escapeHtml(props.children)}</span>${props.arrow ? '<span class="demo-button__arrow" aria-hidden="true">→</span>' : ""}</a>`);
    case "Callout":
      return canvasFrame(node, `<aside class="demo-callout" data-tone="${escapeAttribute(props.tone)}" role="note"><strong>${escapeHtml(props.title)}</strong><p>${escapeHtml(props.children)}</p></aside>`);
    case "PlaceholderBox":
      return canvasFrame(node, `<div class="demo-placeholder" data-aspect="${escapeAttribute(props.aspect)}" role="img" aria-label="${escapeAttribute(props.label)}"><span>[${escapeHtml(props.label)}]</span></div>`);
    default:
      return "";
  }
}

function renderInspector() {
  const record = findNode(state.selectedId);
  if (!record) {
    inspector.innerHTML = `
      <div class="inspector-empty"><div><span class="inspector-empty__icon">${icon.root}</span><h3>Select a component</h3><p>Choose a row in the tree or click a component on the canvas.</p></div></div>`;
    return;
  }

  const { node } = record;
  const definition = composerManifest[node.type];
  const isRoot = node === state.root;
  const isReadonly = state.mode === "preview";
  const componentHeader = `
    <section class="inspector-component">
      <div class="inspector-title">
        <span class="component-glyph" data-container="${definition.slots.length > 0}" aria-hidden="true">${escapeHtml(definition.glyph)}</span>
        <div class="inspector-title__copy">
          <h3>${escapeHtml(isRoot ? "Composition root" : definition.label)}</h3>
          <p>${escapeHtml(node.id)}</p>
        </div>
      </div>
      <div class="inspector-meta">
        <span class="component-badge">${escapeHtml(definition.category)}</span>
        ${definition.slots.length ? `<span class="component-badge component-badge--accent">${definition.slots.length} slot${definition.slots.length > 1 ? "s" : ""}</span>` : ""}
        ${definition.experimental ? '<span class="component-badge">Prototype primitive</span>' : ""}
      </div>
      <p class="inspector-description">${escapeHtml(definition.description)}</p>
      ${isReadonly ? `<div class="preview-readonly">${icon.info}<span>Preview mode is read-only. Return to Edit to change props or structure.</span></div>` : ""}
    </section>`;

  const controls = definition.controls.length
    ? `<section class="inspector-section"><h4 class="inspector-section__heading">Props</h4><div class="field-list">${definition.controls.map((control) => renderControl(node, control, isReadonly)).join("")}</div></section>`
    : `<section class="inspector-section"><h4 class="inspector-section__heading">Props</h4><p class="inspector-description">This component has no editable props in the prototype manifest.</p></section>`;

  const slotSection = definition.slots.length
    ? `<section class="inspector-section"><h4 class="inspector-section__heading">Slots</h4><div class="slot-summary">${definition.slots.map((slot) => {
        const length = node.slots[slot.name].length;
        return `<div class="slot-summary__row"><span class="slot-chip">${escapeHtml(slot.name)}</span><strong>${escapeHtml(slot.label)}</strong><span>${length} item${length === 1 ? "" : "s"}</span></div>`;
      }).join("")}</div></section>`
    : "";

  const actions = isRoot
    ? `<section class="inspector-section"><button class="button button--quiet" type="button" data-inspector-add="${escapeAttribute(node.id)}" ${isReadonly ? "disabled" : ""}>${icon.plus} Add page component</button></section>`
    : renderHierarchyActions(record, isReadonly);

  inspector.innerHTML = componentHeader + controls + slotSection + actions;
}

function renderControl(node, control, disabled) {
  const value = node.props[control.prop];
  const inputId = `prop-${node.id}-${control.prop}`;
  if (control.type === "boolean") {
    return `
      <label class="toggle-field" for="${escapeAttribute(inputId)}">
        <span class="toggle-field__copy"><strong>${escapeHtml(control.label)}</strong><span>${escapeHtml(control.hint ?? control.prop)}</span></span>
        <span class="toggle"><input id="${escapeAttribute(inputId)}" type="checkbox" data-prop="${escapeAttribute(control.prop)}" data-control-type="boolean" ${value ? "checked" : ""} ${disabled ? "disabled" : ""}/><span class="toggle__track" aria-hidden="true"></span></span>
      </label>`;
  }

  const label = `<div class="field__label-row"><label for="${escapeAttribute(inputId)}">${escapeHtml(control.label)}</label><span class="field__prop">${escapeHtml(control.prop)}${control.suffix ? ` · ${escapeHtml(control.suffix)}` : ""}</span></div>`;
  if (control.type === "select") {
    return `<div class="field">${label}<select id="${escapeAttribute(inputId)}" data-prop="${escapeAttribute(control.prop)}" data-control-type="select" ${disabled ? "disabled" : ""}>${control.options.map((option) => `<option value="${escapeAttribute(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></div>`;
  }
  if (control.type === "textarea") {
    return `<div class="field">${label}<textarea id="${escapeAttribute(inputId)}" data-prop="${escapeAttribute(control.prop)}" data-control-type="textarea" ${disabled ? "disabled" : ""}>${escapeHtml(value)}</textarea></div>`;
  }
  if (control.type === "number") {
    return `<div class="field">${label}<input id="${escapeAttribute(inputId)}" type="number" value="${escapeAttribute(value)}" min="${control.min}" max="${control.max}" step="${control.step ?? 1}" data-prop="${escapeAttribute(control.prop)}" data-control-type="number" data-min="${control.min}" data-max="${control.max}" ${disabled ? "disabled" : ""}/><span class="field-error" data-error-for="${escapeAttribute(control.prop)}" aria-live="polite"></span></div>`;
  }
  const type = control.type === "url" ? "url" : "text";
  return `<div class="field">${label}<input id="${escapeAttribute(inputId)}" type="${type}" value="${escapeAttribute(value)}" data-prop="${escapeAttribute(control.prop)}" data-control-type="${type}" ${disabled ? "disabled" : ""}/></div>`;
}

function renderHierarchyActions(record, disabled) {
  const siblings = record.parent.slots[record.slot];
  return `
    <section class="inspector-section">
      <h4 class="inspector-section__heading">Placement</h4>
      <div class="inspector-actions">
        <button class="button button--quiet" type="button" data-move-node="up" ${disabled || record.index === 0 ? "disabled" : ""}>${icon.up} Move up</button>
        <button class="button button--quiet" type="button" data-move-node="down" ${disabled || record.index === siblings.length - 1 ? "disabled" : ""}>${icon.down} Move down</button>
        <button class="button button--danger" type="button" data-remove-node="${escapeAttribute(record.node.id)}" ${disabled ? "disabled" : ""}>${icon.trash} Remove component</button>
      </div>
    </section>`;
}

function updateContextLabels() {
  const record = findNode(state.selectedId);
  selectedPath.textContent = nodePath(record);
  canvasModeLabel.textContent = state.mode === "edit" ? "Editing canvas" : "Clean preview";
  inspectorModeBadge.textContent = state.mode === "edit" ? "Editing" : "Read only";
  appShell.dataset.mode = state.mode;
  for (const button of document.querySelectorAll("[data-mode]")) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
  }
  for (const button of document.querySelectorAll("[data-viewport]")) {
    button.setAttribute("aria-pressed", String(button.dataset.viewport === state.viewport));
  }
}

function renderAll() {
  if (!findNode(state.selectedId)) state.selectedId = state.root.id;
  if (window.innerWidth >= 1024) {
    state.panelWidths.left = Math.round(clamp(state.panelWidths.left, PANEL_LIMITS.left.min, maxPanelWidth("left")));
    state.panelWidths.right = Math.round(clamp(state.panelWidths.right, PANEL_LIMITS.right.min, maxPanelWidth("right")));
  }
  applyPanelWidths();
  renderTree();
  renderCanvas();
  renderInspector();
  updateContextLabels();
}

function commitProp(prop, value) {
  const record = findNode(state.selectedId);
  if (!record || !(prop in record.node.props)) return;
  record.node.props[prop] = value;
  renderTree();
  renderCanvas();
  updateContextLabels();
  saveState();
}

function moveSelected(direction) {
  const record = findNode(state.selectedId);
  if (!record?.parent) return;
  const siblings = record.parent.slots[record.slot];
  const nextIndex = direction === "up" ? record.index - 1 : record.index + 1;
  if (nextIndex < 0 || nextIndex >= siblings.length) return;
  [siblings[record.index], siblings[nextIndex]] = [siblings[nextIndex], siblings[record.index]];
  renderAll();
  saveState();
  focusTreeNode(record.node.id);
  showToast(`${composerManifest[record.node.type].label} moved ${direction}.`);
}

function removeNode(id) {
  const record = findNode(id);
  if (!record?.parent) return;
  const descendants = countNodes(record.node) - 1;
  if (descendants > 0 && !window.confirm(`Remove ${composerManifest[record.node.type].label} and its ${descendants} nested component${descendants === 1 ? "" : "s"}?`)) return;
  record.parent.slots[record.slot].splice(record.index, 1);
  state.selectedId = record.parent.id;
  renderAll();
  saveState();
  focusTreeNode(record.parent.id);
  showToast(`${composerManifest[record.node.type].label} removed.`);
}

function openComponentChooser(parentId, requestedSlot) {
  if (state.mode !== "edit") return;
  const record = findNode(parentId);
  if (!record) return;
  const definition = composerManifest[record.node.type];
  if (!definition.slots.length) return;
  const firstSlot = definition.slots.find((slot) => slot.name === requestedSlot) ?? definition.slots[0];
  addTarget = { parentId, slot: firstSlot.name };
  slotPicker.innerHTML = definition.slots.map((slot) => `<option value="${escapeAttribute(slot.name)}" ${slot.name === firstSlot.name ? "selected" : ""}>${escapeHtml(slot.label)}</option>`).join("");
  slotPickerWrap.hidden = definition.slots.length === 1;
  updateAddTargetLabel();
  activeCategory = "All";
  componentSearch.value = "";
  renderCategoryFilters();
  renderComponentList();
  componentDialog.showModal();
  requestAnimationFrame(() => componentSearch.focus());
}

function updateAddTargetLabel() {
  if (!addTarget) return;
  const record = findNode(addTarget.parentId);
  if (!record) return;
  const definition = composerManifest[record.node.type];
  const slotDefinition = definition.slots.find((slot) => slot.name === addTarget.slot);
  addTargetLabel.textContent = `${definition.label} › ${slotDefinition?.label ?? addTarget.slot}`;
}

function renderCategoryFilters() {
  const focusedCategory = categoryFilters.contains(document.activeElement)
    ? document.activeElement.dataset.category
    : null;
  const categories = ["All", ...new Set(Object.values(composerManifest).filter((definition) => !definition.hidden).map((definition) => definition.category))];
  categoryFilters.innerHTML = categories.map((category) => `<button class="category-filter" type="button" data-category="${escapeAttribute(category)}" aria-pressed="${category === activeCategory}">${escapeHtml(category)}</button>`).join("");
  if (focusedCategory) {
    categoryFilters
      .querySelector(`[data-category="${CSS.escape(focusedCategory)}"]`)
      ?.focus({ preventScroll: true });
  }
}

function renderComponentList() {
  const query = componentSearch.value.trim().toLowerCase();
  const definitions = Object.entries(composerManifest).filter(([, definition]) => {
    if (definition.hidden) return false;
    if (activeCategory !== "All" && definition.category !== activeCategory) return false;
    const haystack = `${definition.label} ${definition.category} ${definition.description}`.toLowerCase();
    return !query || haystack.includes(query);
  });
  if (!definitions.length) {
    componentList.innerHTML = `<div class="component-list-empty"><div><strong>No matching components</strong><span>Try another name or clear the category filter.</span></div></div>`;
    return;
  }
  componentList.innerHTML = definitions.map(([type, definition]) => `
    <button class="component-card" type="button" data-add-type="${escapeAttribute(type)}">
      <span class="component-glyph" data-container="${definition.slots.length > 0}" aria-hidden="true">${escapeHtml(definition.glyph)}</span>
      <span class="component-card__body">
        <span class="component-card__heading"><strong>${escapeHtml(definition.label)}</strong>${definition.experimental ? "<span>Prototype</span>" : ""}</span>
        <p>${escapeHtml(definition.description)}</p>
        <span class="component-card__meta"><span>${escapeHtml(definition.category)}</span><span>${definition.slots.length ? `${definition.slots.length} slot${definition.slots.length > 1 ? "s" : ""}` : "Leaf"}</span></span>
      </span>
    </button>`).join("");
}

function addComponent(type) {
  if (!addTarget || !composerManifest[type]) return;
  const target = findNode(addTarget.parentId);
  if (!target || !Array.isArray(target.node.slots[addTarget.slot])) return;
  const node = makeNode(type);
  target.node.slots[addTarget.slot].push(node);
  state.expandedIds.add(target.node.id);
  state.selectedId = node.id;
  expandAncestors(node.id);
  componentDialog.close();
  addTarget = null;
  renderAll();
  saveState();
  focusTreeNode(node.id);
  showToast(`${composerManifest[type].label} added.`);
}

function jsxString(value) {
  return JSON.stringify(String(value));
}

function indentBlock(value, spaces) {
  const indentation = " ".repeat(spaces);
  return value.split("\n").map((line) => `${indentation}${line}`).join("\n");
}

function serializeChildren(children, indent) {
  return children.map((child) => serializeNode(child, indent)).join("\n");
}

function serializeContainer(node, props, indent, slotName = "children") {
  const spacing = " ".repeat(indent);
  const propText = props.length ? ` ${props.join(" ")}` : "";
  const children = node.slots[slotName] ?? [];
  if (!children.length) return `${spacing}<${node.type}${propText} />`;
  return `${spacing}<${node.type}${propText}>\n${serializeChildren(children, indent + 2)}\n${spacing}</${node.type}>`;
}

function serializeNode(node, indent = 0) {
  const spacing = " ".repeat(indent);
  const props = node.props;
  switch (node.type) {
    case "PageRoot":
      return serializeChildren(node.slots.children, indent);
    case "Hero":
      return `${spacing}<Hero\n${spacing}  eyebrow=${jsxString(props.eyebrow)}\n${spacing}  heading=${jsxString(props.heading)}\n${spacing}  lead=${jsxString(props.lead)}\n${spacing}  variant=${jsxString(props.variant)}\n${spacing}/>`;
    case "Container":
      return serializeContainer(node, [], indent);
    case "Stack":
      return serializeContainer(node, [`gap=${jsxString(props.gap)}`], indent);
    case "AutoGrid":
      return serializeContainer(node, [`min=${jsxString(props.min)}`, `gap=${jsxString(props.gap)}`, props.fill ? "fill" : "fill={false}"], indent);
    case "Card":
      return serializeContainer(node, [`title=${jsxString(props.title)}`, `variant=${jsxString(props.variant)}`, `padding=${jsxString(props.padding)}`], indent);
    case "SplitLayout": {
      const slotProp = (name) => {
        const children = node.slots[name];
        if (!children.length) return `${name}={null}`;
        if (children.length === 1) return `${name}={\n${serializeNode(children[0], indent + 4)}\n${spacing}  }`;
        return `${name}={\n${spacing}    <>\n${serializeChildren(children, indent + 6)}\n${spacing}    </>\n${spacing}  }`;
      };
      return `${spacing}<SplitLayout\n${spacing}  ratio=${jsxString(props.ratio)}\n${spacing}  gap=${jsxString(props.gap)}\n${spacing}  minHeight={${Number(props.minHeight)}}\n${spacing}  ${slotProp("left")}\n${spacing}  ${slotProp("right")}\n${spacing}/>`;
    }
    case "SectionHeading":
      return `${spacing}<SectionHeading eyebrow=${jsxString(props.eyebrow)} heading=${jsxString(props.heading)} intro=${jsxString(props.intro)} as=${jsxString(props.as)} />`;
    case "ProseP":
      return `${spacing}<ProseP class=${jsxString(`text-${props.size}`)}>{${jsxString(props.children)}}</ProseP>`;
    case "CtaButton":
      return `${spacing}<CtaButton href=${jsxString(props.href)} variant=${jsxString(props.variant)} arrow={${Boolean(props.arrow)}}>{${jsxString(props.children)}}</CtaButton>`;
    case "Callout":
      return `${spacing}<Callout title=${jsxString(props.title)} tone=${jsxString(props.tone)}>{${jsxString(props.children)}}</Callout>`;
    case "PlaceholderBox":
      return `${spacing}<PlaceholderBox label=${jsxString(props.label)} aspect=${jsxString(props.aspect)} />`;
    default:
      return "";
  }
}

function collectTypes(node, types = new Set()) {
  if (node.type !== "PageRoot") types.add(node.type);
  for (const slot of composerManifest[node.type].slots) {
    for (const child of node.slots[slot.name]) collectTypes(child, types);
  }
  return types;
}

function generateSource() {
  const types = [...collectTypes(state.root)].sort();
  const production = types.filter((type) => !composerManifest[type].experimental);
  const prototype = types.filter((type) => composerManifest[type].experimental);
  const imports = [];
  if (production.length) imports.push(`import { ${production.join(", ")} } from "@zudo-sg/ui";`);
  if (prototype.length) imports.push(`import { ${prototype.join(", ")} } from "@/features/composer/layout-primitives";`);
  const body = serializeNode(state.root, 6);
  return `${imports.join("\n")}\n\nexport function ProductOverview() {\n  return (\n    <>\n${body}\n    </>\n  );\n}\n`;
}

function openExportDialog() {
  const source = generateSource();
  exportCode.textContent = source;
  const total = countNodes() - 1;
  exportSummary.textContent = `${total} component${total === 1 ? "" : "s"} · ${source.split("\n").length} lines`;
  copyCodeButton.removeAttribute("data-copied");
  copyCodeButton.querySelector("span").textContent = "Copy JSX";
  exportDialog.showModal();
}

async function copySource() {
  const source = exportCode.textContent;
  let copied = false;
  try {
    await navigator.clipboard.writeText(source);
    copied = true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = source;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    copied = document.execCommand("copy");
    textarea.remove();
  }
  if (copied) {
    copyCodeButton.setAttribute("data-copied", "");
    copyCodeButton.querySelector("span").textContent = "Copied";
    showToast("JSX copied to the clipboard.");
  } else {
    showToast("Could not copy automatically. Select the code and copy it manually.");
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.setAttribute("data-visible", "");
  toastTimer = window.setTimeout(() => toast.removeAttribute("data-visible"), 2400);
}

function setMode(mode) {
  if (!["edit", "preview"].includes(mode) || state.mode === mode) return;
  state.mode = mode;
  renderTree();
  renderCanvas();
  renderInspector();
  updateContextLabels();
  saveState();
  showToast(mode === "edit" ? "Edit controls restored." : "Preview is now clean and read-only.");
}

function setViewport(viewport) {
  if (!["desktop", "tablet", "mobile"].includes(viewport)) return;
  state.viewport = viewport;
  canvasViewport.dataset.viewport = viewport;
  updateContextLabels();
  saveState();
}

function maxPanelWidth(side) {
  const otherSide = side === "left" ? "right" : "left";
  const workspaceWidth = workspace.getBoundingClientRect().width;
  const jointMax = workspaceWidth - state.panelWidths[otherSide] - PANEL_LIMITS.center - 18;
  return Math.max(PANEL_LIMITS[side].min, Math.min(PANEL_LIMITS[side].max, jointMax));
}

function setPanelWidth(side, value, persist = false) {
  state.panelWidths[side] = Math.round(clamp(value, PANEL_LIMITS[side].min, maxPanelWidth(side)));
  applyPanelWidths();
  if (persist) saveState();
}

function applyPanelWidths() {
  document.documentElement.style.setProperty("--tree-width", `${state.panelWidths.left}px`);
  document.documentElement.style.setProperty("--inspector-width", `${state.panelWidths.right}px`);
  const leftResizer = document.querySelector("#left-resizer");
  const rightResizer = document.querySelector("#right-resizer");
  leftResizer.setAttribute("aria-valuenow", String(state.panelWidths.left));
  rightResizer.setAttribute("aria-valuenow", String(state.panelWidths.right));
  if (window.innerWidth >= 1024) {
    leftResizer.setAttribute("aria-valuemax", String(Math.round(maxPanelWidth("left"))));
    rightResizer.setAttribute("aria-valuemax", String(Math.round(maxPanelWidth("right"))));
  } else {
    leftResizer.setAttribute("aria-valuemax", String(PANEL_LIMITS.left.max));
    rightResizer.setAttribute("aria-valuemax", String(PANEL_LIMITS.right.max));
  }
}

function wireResizer(element, side) {
  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = state.panelWidths[side];
    element.setPointerCapture(event.pointerId);
    element.setAttribute("data-dragging", "");
    workspace.setAttribute("data-resizing", "");

    const move = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      setPanelWidth(side, side === "left" ? startWidth + delta : startWidth - delta);
    };
    const end = () => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", end);
      element.removeEventListener("pointercancel", end);
      element.removeAttribute("data-dragging");
      workspace.removeAttribute("data-resizing");
      saveState();
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
  });

  element.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 40 : 10;
    let value = state.panelWidths[side];
    if (event.key === "Home") value = PANEL_LIMITS[side].min;
    else if (event.key === "End") value = maxPanelWidth(side);
    else if (event.key === "ArrowLeft") value += side === "left" ? -step : step;
    else if (event.key === "ArrowRight") value += side === "left" ? step : -step;
    else return;
    event.preventDefault();
    setPanelWidth(side, value, true);
  });
}

treeRoot.addEventListener("click", (event) => {
  const select = event.target.closest("[data-select-node]");
  if (select) {
    selectNode(select.dataset.selectNode);
    return;
  }
  const toggle = event.target.closest("[data-toggle-node]");
  if (toggle) {
    const id = toggle.dataset.toggleNode;
    if (state.expandedIds.has(id)) state.expandedIds.delete(id);
    else state.expandedIds.add(id);
    renderTree();
    saveState();
    return;
  }
  const add = event.target.closest("[data-add-parent]");
  if (add) openComponentChooser(add.dataset.addParent, add.dataset.addSlot);
});

canvas.addEventListener("click", (event) => {
  const add = event.target.closest("[data-canvas-add]");
  if (add && state.mode === "edit") {
    event.preventDefault();
    event.stopPropagation();
    openComponentChooser(add.dataset.canvasAdd, add.dataset.canvasSlot);
    return;
  }
  if (state.mode !== "edit") return;
  const nodeElement = event.target.closest("[data-node-id]");
  if (!nodeElement) return;
  event.preventDefault();
  event.stopPropagation();
  selectNode(nodeElement.dataset.nodeId, { reveal: true });
});

inspector.addEventListener("input", (event) => {
  const input = event.target.closest("[data-prop]");
  if (!input || input.disabled) return;
  const prop = input.dataset.prop;
  if (input.dataset.controlType === "number") {
    const value = Number(input.value);
    const min = Number(input.dataset.min);
    const max = Number(input.dataset.max);
    const error = inspector.querySelector(`[data-error-for="${CSS.escape(prop)}"]`);
    const invalid = input.value.trim() === "" || !Number.isFinite(value) || value < min || value > max;
    input.setAttribute("aria-invalid", String(invalid));
    if (error) error.textContent = invalid ? `Enter a value from ${min} to ${max}.` : "";
    if (!invalid) commitProp(prop, value);
    return;
  }
  if (["text", "url", "textarea"].includes(input.dataset.controlType)) commitProp(prop, input.value);
});

inspector.addEventListener("change", (event) => {
  const input = event.target.closest("[data-prop]");
  if (!input || input.disabled || !["boolean", "select"].includes(input.dataset.controlType)) return;
  if (input.dataset.controlType === "boolean") commitProp(input.dataset.prop, input.checked);
  else commitProp(input.dataset.prop, input.value);
});

inspector.addEventListener("click", (event) => {
  const move = event.target.closest("[data-move-node]");
  if (move && !move.disabled) {
    moveSelected(move.dataset.moveNode);
    return;
  }
  const remove = event.target.closest("[data-remove-node]");
  if (remove && !remove.disabled) {
    removeNode(remove.dataset.removeNode);
    return;
  }
  const add = event.target.closest("[data-inspector-add]");
  if (add && !add.disabled) openComponentChooser(add.dataset.inspectorAdd);
});

document.querySelector("#add-root-button").addEventListener("click", () => openComponentChooser(state.root.id, "children"));
document.querySelector("#export-button").addEventListener("click", openExportDialog);
copyCodeButton.addEventListener("click", copySource);

document.querySelector("#reset-button").addEventListener("click", () => {
  if (!window.confirm("Reset the Composition to the sample page? Your local prototype changes will be replaced.")) return;
  state = defaultState();
  renderAll();
  saveState();
  showToast("Sample Composition restored.");
});

for (const button of document.querySelectorAll("[data-mode]")) {
  button.addEventListener("click", () => setMode(button.dataset.mode));
}

for (const button of document.querySelectorAll("[data-viewport]")) {
  button.addEventListener("click", () => setViewport(button.dataset.viewport));
}

document.querySelector("#theme-toggle").addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  const persisted = writeStorage(THEME_KEY, nextTheme);
  const button = document.querySelector("#theme-toggle");
  button.setAttribute("aria-label", `Use ${nextTheme === "dark" ? "light" : "dark"} theme`);
  showToast(persisted
    ? `${nextTheme[0].toUpperCase()}${nextTheme.slice(1)} theme enabled.`
    : `${nextTheme[0].toUpperCase()}${nextTheme.slice(1)} theme enabled for this session; storage is unavailable.`);
});

slotPicker.addEventListener("change", () => {
  if (!addTarget) return;
  addTarget.slot = slotPicker.value;
  updateAddTargetLabel();
});

componentSearch.addEventListener("input", renderComponentList);
componentDialog.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  componentDialog.close();
});

categoryFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderCategoryFilters();
  renderComponentList();
});

componentList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add-type]");
  if (button) addComponent(button.dataset.addType);
});

for (const button of document.querySelectorAll("[data-close-dialog]")) {
  button.addEventListener("click", () => document.querySelector(`#${CSS.escape(button.dataset.closeDialog)}`).close());
}

for (const dialog of [componentDialog, exportDialog]) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && componentDialog.open && document.activeElement !== componentSearch) {
    event.preventDefault();
    componentSearch.focus();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth < 1024) {
    applyPanelWidths();
    return;
  }
  setPanelWidth("left", state.panelWidths.left);
  setPanelWidth("right", state.panelWidths.right);
});

wireResizer(document.querySelector("#left-resizer"), "left");
wireResizer(document.querySelector("#right-resizer"), "right");

const storedTheme = readStorage(THEME_KEY);
if (storedTheme === "light" || storedTheme === "dark") document.documentElement.dataset.theme = storedTheme;
document.querySelector("#theme-toggle").setAttribute("aria-label", `Use ${document.documentElement.dataset.theme === "dark" ? "light" : "dark"} theme`);

renderAll();
if (storageUnavailable) showStorageUnavailable();
