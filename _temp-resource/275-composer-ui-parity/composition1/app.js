/* Composer prototype — explores the UX spec of zudo-sg issue #242 */

const { h, render } = preact;
const { useState, useEffect, useMemo } = preactHooks;
const html = htm.bind(h);

const ROOT = '__root';
const SLOT = '__slot';
const STORAGE_KEY = 'composer-composition1';

let idCounter = 1;
const nextId = () => 'n' + idCounter++;

/* ---------------------------------------------------------------- *
 * Component registry — stands in for @zudo-sg/ui components plus the
 * per-component metadata the issue says should live in story files:
 * container-ness, slots, a prop schema with defaults, and which prop
 * (if any) is inline-editable directly on the preview canvas.
 * ---------------------------------------------------------------- */

const GAPS = { sm: '8px', md: '16px', lg: '28px' };

const REGISTRY = {
  [ROOT]: {
    category: '',
    container: true,
    description: 'Page root.',
    props: {},
    render: (p, children) => html`<div class="c-root">${children}</div>`,
  },

  Section: {
    category: 'Layout',
    container: true,
    description: 'Full-width page band. Sets background tone and vertical padding; content is constrained to a max width.',
    props: {
      tone: { kind: 'enum', label: 'Tone', options: ['default', 'subtle', 'accent'], default: 'default' },
      padded: { kind: 'boolean', label: 'Vertical padding', default: true },
      maxWidth: { kind: 'enum', label: 'Max width', options: ['narrow', 'normal', 'wide'], default: 'normal' },
    },
    render: (p, children) => html`
      <section class="c-section tone-${p.tone} ${p.padded ? 'padded' : ''}">
        <div class="c-section-inner mw-${p.maxWidth}">${children}</div>
      </section>`,
  },

  Columns: {
    category: 'Layout',
    container: true,
    slots: ['Left', 'Right'],
    description: 'Two-column layout with named Left / Right slots. Other components can be placed into each column.',
    props: {
      ratio: { kind: 'enum', label: 'Ratio (L:R)', options: ['1:1', '2:1', '1:2'], default: '1:1' },
      gap: { kind: 'enum', label: 'Gap', options: ['sm', 'md', 'lg'], default: 'md' },
    },
    render: (p, slotBoxes) => html`
      <div class="c-columns" style=${{ gap: GAPS[p.gap] }}>${slotBoxes}</div>`,
  },

  Stack: {
    category: 'Layout',
    container: true,
    description: 'Vertical flow container with a consistent gap between children.',
    props: {
      gap: { kind: 'enum', label: 'Gap', options: ['sm', 'md', 'lg'], default: 'md' },
      align: { kind: 'enum', label: 'Align', options: ['stretch', 'start', 'center'], default: 'stretch' },
    },
    render: (p, children) => html`
      <div class="c-stack" style=${{
        gap: GAPS[p.gap],
        alignItems: { stretch: 'stretch', start: 'flex-start', center: 'center' }[p.align],
      }}>${children}</div>`,
  },

  Row: {
    category: 'Layout',
    container: true,
    flow: 'row',
    description: 'Horizontal flow container. Useful for button groups and inline clusters.',
    props: {
      gap: { kind: 'enum', label: 'Gap', options: ['sm', 'md', 'lg'], default: 'sm' },
      justify: { kind: 'enum', label: 'Justify', options: ['start', 'center', 'end', 'space-between'], default: 'start' },
    },
    render: (p, children) => html`
      <div class="c-row" style=${{
        gap: GAPS[p.gap],
        justifyContent: { start: 'flex-start', center: 'center', end: 'flex-end', 'space-between': 'space-between' }[p.justify],
      }}>${children}</div>`,
  },

  Card: {
    category: 'Content',
    container: true,
    description: 'Bordered surface with an optional title bar. Accepts any components as body content.',
    props: {
      title: { kind: 'string', label: 'Title', default: 'Card title' },
      tone: { kind: 'enum', label: 'Tone', options: ['default', 'highlight'], default: 'default' },
    },
    render: (p, children) => html`
      <div class="c-card tone-${p.tone}">
        ${p.title ? html`<div class="c-card-title">${p.title}</div>` : ''}
        <div class="c-card-body">${children}</div>
      </div>`,
  },

  Heading: {
    category: 'Content',
    description: 'Section heading (h2–h4).',
    inlineEdit: { prop: 'text' },
    props: {
      text: { kind: 'string', label: 'Text', default: 'Heading' },
      level: { kind: 'enum', label: 'Level', options: ['h2', 'h3', 'h4'], default: 'h2' },
      align: { kind: 'enum', label: 'Align', options: ['left', 'center'], default: 'left' },
    },
    /* keyed per mode: while editing, Preact doesn't own the typed DOM text
     * (no vdom text child) — remount on mode change avoids duplicated text */
    render: (p, _c, edit) => edit
      ? html`<${p.level} key="edit" class="c-heading align-${p.align}" ...${edit}><//>`
      : html`<${p.level} key="read" class="c-heading align-${p.align}">${p.text}<//>`,
  },

  Text: {
    category: 'Content',
    description: 'Paragraph of body text.',
    inlineEdit: { prop: 'text', multiline: true },
    props: {
      text: { kind: 'text', label: 'Text', default: 'Body text. Edit this in the inspector on the right.' },
      size: { kind: 'enum', label: 'Size', options: ['sm', 'md', 'lg'], default: 'md' },
      muted: { kind: 'boolean', label: 'Muted color', default: false },
    },
    render: (p, _c, edit) => edit
      ? html`<p key="edit" class="c-text size-${p.size} ${p.muted ? 'muted' : ''}" ...${edit}></p>`
      : html`<p key="read" class="c-text size-${p.size} ${p.muted ? 'muted' : ''}">${p.text}</p>`,
  },

  Badge: {
    category: 'Content',
    fit: true,
    description: 'Small status pill.',
    props: {
      label: { kind: 'string', label: 'Label', default: 'New' },
      tone: { kind: 'enum', label: 'Tone', options: ['info', 'success', 'warning'], default: 'info' },
    },
    render: (p) => html`<span class="c-badge t-${p.tone}">${p.label}</span>`,
  },

  Divider: {
    category: 'Content',
    description: 'Horizontal rule separating content blocks.',
    props: {
      spacing: { kind: 'enum', label: 'Spacing', options: ['sm', 'md', 'lg'], default: 'md' },
    },
    render: (p) => html`<hr class="c-divider s-${p.spacing}" />`,
  },

  Hero: {
    category: 'Media',
    description: 'Large page-top banner with title and subtitle.',
    props: {
      title: { kind: 'string', label: 'Title', default: 'Hero title' },
      subtitle: { kind: 'text', label: 'Subtitle', default: 'Supporting copy for the hero area.' },
      align: { kind: 'enum', label: 'Align', options: ['left', 'center'], default: 'center' },
      tone: { kind: 'enum', label: 'Tone', options: ['dark', 'accent', 'light'], default: 'dark' },
    },
    render: (p) => html`
      <div class="c-hero tone-${p.tone} align-${p.align}">
        <div class="c-hero-inner">
          <h1>${p.title}</h1>
          ${p.subtitle ? html`<p>${p.subtitle}</p>` : ''}
        </div>
      </div>`,
  },

  ImagePlaceholder: {
    category: 'Media',
    description: 'Aspect-ratio image placeholder.',
    props: {
      label: { kind: 'string', label: 'Label', default: 'Image' },
      aspect: { kind: 'enum', label: 'Aspect', options: ['16:9', '4:3', '1:1'], default: '16:9' },
      rounded: { kind: 'boolean', label: 'Rounded corners', default: true },
    },
    render: (p) => html`
      <div class="c-imgph ${p.rounded ? 'rounded' : ''}" style=${{ aspectRatio: p.aspect.replace(':', ' / ') }}>
        <span>▦</span><span>${p.label}</span>
      </div>`,
  },

  Button: {
    category: 'Actions',
    fit: true,
    description: 'Action button.',
    props: {
      label: { kind: 'string', label: 'Label', default: 'Button' },
      variant: { kind: 'enum', label: 'Variant', options: ['primary', 'secondary', 'ghost'], default: 'primary' },
      size: { kind: 'enum', label: 'Size', options: ['sm', 'md'], default: 'md' },
    },
    render: (p) => html`<button type="button" class="c-btn v-${p.variant} s-${p.size}">${p.label}</button>`,
  },
};

const CATEGORIES = ['Layout', 'Content', 'Media', 'Actions'];

/* ---------------------------------------------------------------- *
 * Tree model
 * ---------------------------------------------------------------- */

function defaultsOf(type) {
  const props = {};
  for (const [k, s] of Object.entries(REGISTRY[type].props)) props[k] = s.default;
  return props;
}

function createNode(type) {
  const def = REGISTRY[type];
  const node = { id: nextId(), type, props: defaultsOf(type) };
  if (def.slots) {
    node.children = def.slots.map((name) => ({ id: nextId(), type: SLOT, name, children: [] }));
  } else if (def.container) {
    node.children = [];
  }
  return node;
}

function findNode(node, id) {
  if (node.id === id) return node;
  for (const c of node.children || []) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

function findParent(node, id) {
  for (const c of node.children || []) {
    if (c.id === id) return node;
    const hit = findParent(c, id);
    if (hit) return hit;
  }
  return null;
}

function updateNode(node, id, fn) {
  if (node.id === id) return fn(node);
  if (!node.children) return node;
  const kids = node.children.map((c) => updateNode(c, id, fn));
  return kids.some((k, i) => k !== node.children[i]) ? { ...node, children: kids } : node;
}

function removeNodeFromTree(node, id) {
  if (!node.children) return node;
  const filtered = node.children.filter((c) => c.id !== id);
  const kids = filtered.map((c) => removeNodeFromTree(c, id));
  if (filtered.length !== node.children.length || kids.some((k, i) => k !== filtered[i])) {
    return { ...node, children: kids };
  }
  return node;
}

function insertNodeAt(tree, parentId, index, node) {
  return updateNode(tree, parentId, (n) => {
    const kids = [...(n.children || [])];
    kids.splice(Math.min(index, kids.length), 0, node);
    return { ...n, children: kids };
  });
}

/* Move keeps index semantics: `index` is the insert position in the
 * DESTINATION as currently rendered (before the node is detached). */
function moveNodeTo(tree, id, parentId, index) {
  const node = findNode(tree, id);
  const oldParent = findParent(tree, id);
  if (!node || !oldParent || !findNode(tree, parentId)) return tree;
  const oldIdx = oldParent.children.findIndex((c) => c.id === id);
  let insertIdx = index;
  if (oldParent.id === parentId && oldIdx < index) insertIdx = index - 1;
  const without = removeNodeFromTree(tree, id);
  return insertNodeAt(without, parentId, insertIdx, node);
}

function cloneWithNewIds(node) {
  const copy = { ...node, id: nextId(), props: node.props ? { ...node.props } : undefined };
  if (node.children) copy.children = node.children.map(cloneWithNewIds);
  return copy;
}

function countComponents(node) {
  let n = node.type !== ROOT && node.type !== SLOT ? 1 : 0;
  for (const c of node.children || []) n += countComponents(c);
  return n;
}

const isDeletable = (node) => node && node.type !== ROOT && node.type !== SLOT;

/* ---------------------------------------------------------------- *
 * Export: composition tree → JSX source / JSON data
 * ---------------------------------------------------------------- */

function attrsFor(node) {
  const def = REGISTRY[node.type];
  let out = '';
  for (const [k, s] of Object.entries(def.props)) {
    const v = node.props[k];
    if (v === s.default) continue;
    if (s.kind === 'boolean') {
      out += v ? ` ${k}` : ` ${k}={false}`;
    } else {
      const str = String(v);
      // JSX string attributes don't process backslash escapes — anything with
      // newlines/quotes must go through a JS expression to survive a paste
      out += /[\n"\\]/.test(str) ? ` ${k}={${JSON.stringify(str)}}` : ` ${k}="${str}"`;
    }
  }
  return out;
}

function nodeToJSX(node, depth = 0) {
  const pad = '  '.repeat(depth);
  if (node.type === ROOT) {
    const kids = node.children;
    if (kids.length === 0) return pad + '<></>';
    if (kids.length === 1) return nodeToJSX(kids[0], depth);
    return [pad + '<>', ...kids.map((c) => nodeToJSX(c, depth + 1)), pad + '</>'].join('\n');
  }
  const def = REGISTRY[node.type];
  const attrs = attrsFor(node);
  if (def.slots) {
    const lines = [pad + `<${node.type}${attrs}>`];
    for (const slot of node.children) {
      if (slot.children.length === 0) {
        lines.push(pad + `  <${node.type}.${slot.name} />`);
        continue;
      }
      lines.push(pad + `  <${node.type}.${slot.name}>`);
      for (const c of slot.children) lines.push(nodeToJSX(c, depth + 2));
      lines.push(pad + `  </${node.type}.${slot.name}>`);
    }
    lines.push(pad + `</${node.type}>`);
    return lines.join('\n');
  }
  if (def.container && node.children.length) {
    return [
      pad + `<${node.type}${attrs}>`,
      ...node.children.map((c) => nodeToJSX(c, depth + 1)),
      pad + `</${node.type}>`,
    ].join('\n');
  }
  return pad + `<${node.type}${attrs} />`;
}

function nodeToData(node) {
  if (node.type === ROOT) return { type: 'Root', children: node.children.map(nodeToData) };
  if (node.type === SLOT) return { slot: node.name, children: node.children.map(nodeToData) };
  const def = REGISTRY[node.type];
  const o = { type: node.type, props: { ...node.props } };
  if (def.container || def.slots) o.children = node.children.map(nodeToData);
  return o;
}

/* ---------------------------------------------------------------- *
 * Seed composition — the issue's use case: components B, C placed
 * into container A's right column.
 * ---------------------------------------------------------------- */

function seedTree() {
  idCounter = 1;
  const set = (node, props) => (Object.assign(node.props, props), node);

  const root = createNode(ROOT);

  const hero = set(createNode('Hero'), {
    title: 'Compose pages from the component catalog',
    subtitle: 'Composer is a zudo-sg sub-app: pick components, nest them into containers, tweak props live, then export the JSX.',
  });

  const section = set(createNode('Section'), { tone: 'subtle' });
  const cols = set(createNode('Columns'), { ratio: '2:1', gap: 'lg' });

  const heading = set(createNode('Heading'), { text: 'Why a Composer?' });
  const text = set(createNode('Text'), {
    text: 'The styleguide already catalogs every component in isolation. Composer answers the next question: what do they look like together, nested into a real page layout?',
  });
  const row = createNode('Row');
  row.children.push(
    set(createNode('Button'), { label: 'Get started' }),
    set(createNode('Button'), { label: 'Read the docs', variant: 'ghost' }),
  );
  cols.children[0].children.push(heading, text, row);

  const card = set(createNode('Card'), { title: 'Highlights', tone: 'highlight' });
  card.children.push(
    set(createNode('Badge'), { label: 'Prototype', tone: 'success' }),
    set(createNode('Text'), {
      text: 'Select any component to tweak its props. Containers show an add button in edit mode.',
      size: 'sm',
      muted: true,
    }),
  );
  cols.children[1].children.push(card);

  section.children.push(cols);
  root.children.push(hero, section);
  return root;
}

/* ---------------------------------------------------------------- *
 * Persistence
 * ---------------------------------------------------------------- */

function validTree(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.type !== ROOT && node.type !== SLOT && !REGISTRY[node.type]) return false;
  return (node.children || []).every(validTree);
}

function maxIdIn(node) {
  const own = /^n(\d+)$/.test(node.id) ? parseInt(node.id.slice(1), 10) : 0;
  return Math.max(own, ...(node.children || []).map(maxIdIn), 0);
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.tree && saved.tree.type === ROOT && validTree(saved.tree)) {
        idCounter = maxIdIn(saved.tree) + 1;
        return saved.tree;
      }
    }
  } catch (e) { /* corrupted storage → fall through to seed */ }
  return seedTree();
}

/* ---------------------------------------------------------------- *
 * Preview rendering
 * ---------------------------------------------------------------- */

/* Insertion point: rendered before every child and at the end of each
 * container. Doubles as the drop target for drag & drop and hosts the
 * "⋯ → Paste here" menu. */
function InsertPoint({ parentId, index, ctx, variant, orientation, empty }) {
  const [over, setOver] = useState(null);
  const droppable = ctx.dragId ? ctx.canDropAt(parentId) : false;

  const onDragOver = droppable ? (e) => {
    e.preventDefault();
    const eff = e.altKey ? 'copy' : 'move';
    e.dataTransfer.dropEffect = eff;
    if (over !== eff) setOver(eff);
  } : undefined;
  // dragleave also fires when moving onto own children (ip-line/ip-plus);
  // only clear the highlight when the pointer truly leaves this target
  const onDragLeave = droppable ? (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOver(null);
  } : undefined;
  const onDrop = droppable ? (e) => {
    e.preventDefault();
    setOver(null);
    ctx.dropAt(parentId, index, e.altKey);
  } : undefined;

  const dots = html`<button type="button" class="ip-dots" title="Insert options"
    onClick=${(e) => { e.stopPropagation(); ctx.openInsertMenu(parentId, index, e.currentTarget.getBoundingClientRect()); }}>⋯</button>`;

  if (variant === 'button') {
    return html`<div class="insert-end ${orientation === 'row' ? 'compact' : ''} ${droppable ? 'droppable' : ''} ${droppable && over ? 'dropover' : ''}"
      onDragOver=${onDragOver} onDragLeave=${onDragLeave} onDrop=${onDrop}>
      <button type="button" class="add-btn ${empty ? 'add-empty' : ''}"
        onClick=${(e) => { e.stopPropagation(); ctx.openChooser(parentId, index); }}>
        <span>+</span> Add component
      </button>
      ${dots}
    </div>`;
  }

  return html`<div class="insert-bar ${orientation === 'row' ? 'vert' : ''} ${droppable ? 'droppable' : ''} ${droppable && over ? 'dropover' : ''}"
    title="Insert here"
    onClick=${(e) => { e.stopPropagation(); ctx.openChooser(parentId, index); }}
    onDragOver=${onDragOver} onDragLeave=${onDragLeave} onDrop=${onDrop}>
    <span class="ip-line"></span>
    <span class="ip-plus">+</span>
    <span class="ip-line"></span>
    ${dots}
  </div>`;
}

function withInsertPoints(node, ctx, orientation) {
  const out = [];
  node.children.forEach((c, i) => {
    out.push(html`<${InsertPoint} key=${'ip-' + i} parentId=${node.id} index=${i} ctx=${ctx} variant="bar" orientation=${orientation} />`);
    out.push(html`<${RenderNode} key=${c.id} node=${c} ctx=${ctx} />`);
  });
  out.push(html`<${InsertPoint} key="ip-end" parentId=${node.id} index=${node.children.length} ctx=${ctx}
    variant="button" orientation=${orientation} empty=${node.children.length === 0} />`);
  return out;
}

/* Inline editing: the edited element is rendered WITHOUT a vdom text
 * child (content set imperatively via ref) so Preact re-renders can't
 * reset the user's typing / caret mid-edit. Commit on blur. */
function buildEditAttrs(node, def, ctx) {
  const prop = def.inlineEdit.prop;
  const multiline = !!def.inlineEdit.multiline;
  const sessionKey = node.id + ':' + ctx.editing.seq;
  return {
    contenteditable: 'plaintext-only',
    spellcheck: false,
    ref: (el) => {
      if (!el || el.__editKey === sessionKey) return;
      el.__editKey = sessionKey;
      el.__cancelEdit = false;
      el.innerText = node.props[prop];
      el.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    },
    onMouseDown: (e) => e.stopPropagation(),
    onClick: (e) => e.stopPropagation(),
    // a dblclick (word-select) bubbling to the shell would restart the edit
    // session and revert uncommitted typing
    onDblClick: (e) => e.stopPropagation(),
    onKeyDown: (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.currentTarget.__cancelEdit = true;
        e.currentTarget.blur();
      } else if (e.key === 'Enter' && !multiline) {
        e.preventDefault();
        e.currentTarget.blur();
      }
    },
    onBlur: (e) => {
      const el = e.currentTarget;
      if (!el.__cancelEdit) ctx.updateProp(node.id, prop, el.innerText.replace(/\n$/, ''));
      ctx.setEditingFor(null);
    },
  };
}

function SlotBox({ slot, flex, ctx }) {
  const edit = ctx.mode === 'edit';
  const selected = ctx.selectedId === slot.id;
  const kids = edit
    ? withInsertPoints(slot, ctx)
    : slot.children.map((c) => html`<${RenderNode} key=${c.id} node=${c} ctx=${ctx} />`);
  return html`<div class="slotbox ${edit ? 'slot-edit' : ''} ${edit && selected ? 'nsh-selected' : ''}"
    style=${{ flex: `${flex} 1 0%` }}
    onClick=${edit ? (e) => { e.stopPropagation(); ctx.select(slot.id); } : undefined}>
    ${edit ? html`<span class="slot-tag">${slot.name}</span>` : ''}
    ${kids}
  </div>`;
}

function NodeControls({ node, ctx }) {
  const onDragStart = (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'copyMove';
    const shell = e.currentTarget.closest('.nsh');
    if (shell) e.dataTransfer.setDragImage(shell, 20, 20);
    // deferred: mutating state synchronously inside dragstart cancels the drag in Chromium
    setTimeout(() => ctx.setDrag(node.id), 0);
  };
  return html`<span class="nsh-controls">
    <button type="button" class="ctl-btn ctl-grip" title="Drag to move · hold Alt to copy" draggable="true"
      onDragStart=${onDragStart}
      onDragEnd=${() => ctx.setDrag(null)}
      onClick=${(e) => e.stopPropagation()}>⠿</button>
    <button type="button" class="ctl-btn" title="More actions"
      onClick=${(e) => { e.stopPropagation(); ctx.openNodeMenu(node.id, e.currentTarget.getBoundingClientRect()); }}>⋯</button>
  </span>`;
}

function RenderNode({ node, ctx }) {
  const edit = ctx.mode === 'edit';
  const def = REGISTRY[node.type];
  let inner;
  if (def.slots) {
    const ratio = node.props.ratio.split(':').map(Number);
    const slotEls = node.children.map((slot, i) =>
      html`<${SlotBox} key=${slot.id} slot=${slot} flex=${ratio[i]} ctx=${ctx} />`);
    inner = def.render(node.props, slotEls);
  } else if (def.container) {
    const kids = edit
      ? withInsertPoints(node, ctx, def.flow)
      : node.children.map((c) => html`<${RenderNode} key=${c.id} node=${c} ctx=${ctx} />`);
    inner = def.render(node.props, kids);
  } else {
    const editingThis = edit && def.inlineEdit && ctx.editing && ctx.editing.id === node.id;
    inner = def.render(node.props, null, editingThis ? buildEditAttrs(node, def, ctx) : null);
  }

  if (node.type === ROOT) return inner;

  const selected = ctx.selectedId === node.id;
  const hovered = ctx.hoverId === node.id;
  return html`<div
    class="nsh ${def.fit ? 'nsh-fit' : ''} ${edit ? 'nsh-edit' : ''} ${edit && selected ? 'nsh-selected' : ''} ${edit && hovered && !selected ? 'nsh-hover' : ''}"
    onClick=${edit ? (e) => {
      e.stopPropagation();
      if (selected && def.inlineEdit && !(ctx.editing && ctx.editing.id === node.id)) ctx.setEditingFor(node.id);
      else ctx.select(node.id);
    } : undefined}
    onDblClick=${edit && def.inlineEdit ? (e) => {
      e.stopPropagation();
      if (ctx.editing && ctx.editing.id === node.id) return;
      ctx.select(node.id);
      ctx.setEditingFor(node.id);
    } : undefined}
    onMouseOver=${edit ? (e) => { e.stopPropagation(); ctx.setHover(node.id); } : undefined}
    onMouseOut=${edit ? (e) => { e.stopPropagation(); ctx.setHover(null); } : undefined}>
    ${edit && (selected || hovered) ? html`<span key="nsh-tag" class="nsh-tag ${selected ? 'sel' : ''}">${node.type}</span>` : ''}
    ${edit && selected ? html`<${NodeControls} key="nsh-ctl" node=${node} ctx=${ctx} />` : ''}
    ${inner}
  </div>`;
}

/* ---------------------------------------------------------------- *
 * Structure tree panel
 * ---------------------------------------------------------------- */

function snippetOf(node) {
  const p = node.props || {};
  return p.text || p.label || p.title || '';
}

function TreeRow({ node, depth, ctx, collapsed, toggle }) {
  const kids = node.children || [];
  const def = REGISTRY[node.type];
  const isBranch = node.type === ROOT || node.type === SLOT || (def && (def.container || def.slots));
  const isCollapsed = collapsed.has(node.id);
  const label = node.type === ROOT ? 'Page' : node.type === SLOT ? `${node.name} column` : node.type;
  const glyph = node.type === ROOT ? '⌂' : node.type === SLOT ? '↳' : isBranch ? '▤' : '▪';
  const glyphClass = node.type === SLOT ? 'g-slot' : isBranch ? 'g-container' : 'g-leaf';
  const snippet = isBranch ? '' : snippetOf(node);

  return html`
    <div class="trow ${ctx.selectedId === node.id ? 'sel' : ''}"
      style=${{ paddingLeft: depth * 14 + 8 + 'px' }}
      onClick=${() => ctx.select(node.id)}
      onMouseOver=${() => ctx.setHover(node.id)}
      onMouseOut=${() => ctx.setHover(null)}>
      ${isBranch && kids.length
        ? html`<button type="button" class="ttoggle" onClick=${(e) => { e.stopPropagation(); toggle(node.id); }}>${isCollapsed ? '▸' : '▾'}</button>`
        : html`<span class="ttoggle-sp"></span>`}
      <span class="tglyph ${glyphClass}">${glyph}</span>
      <span class="tlabel">${label}</span>
      ${snippet ? html`<span class="tsnip">${snippet}</span>` : ''}
    </div>
    ${!isCollapsed ? kids.map((c) => html`<${TreeRow} key=${c.id} node=${c} depth=${depth + 1} ctx=${ctx} collapsed=${collapsed} toggle=${toggle} />`) : ''}
  `;
}

/* ---------------------------------------------------------------- *
 * Inspector panel
 * ---------------------------------------------------------------- */

function PropField({ name, schema, value, onChange, disabled }) {
  if (schema.kind === 'boolean') {
    return html`<div class="pf">
      <label class="pf-check">
        <input type="checkbox" checked=${!!value} disabled=${disabled} onChange=${(e) => onChange(e.target.checked)} />
        ${schema.label}
      </label>
    </div>`;
  }
  return html`<div class="pf">
    <label class="pf-label" for="pf-${name}">${schema.label}</label>
    ${schema.kind === 'enum'
      ? html`<select id="pf-${name}" value=${value} disabled=${disabled} onChange=${(e) => onChange(e.target.value)}>
          ${schema.options.map((o) => html`<option key=${o} value=${o}>${o}</option>`)}
        </select>`
      : schema.kind === 'text'
        ? html`<textarea id="pf-${name}" rows="3" value=${value} disabled=${disabled} onInput=${(e) => onChange(e.target.value)}></textarea>`
        : html`<input id="pf-${name}" type="text" value=${value} disabled=${disabled} onInput=${(e) => onChange(e.target.value)} />`}
  </div>`;
}

function Inspector({ tree, selectedId, actions, mode }) {
  const node = selectedId ? findNode(tree, selectedId) : null;
  const readOnly = mode !== 'edit';

  if (!node) {
    return html`<div class="insp-empty">
      <span class="big">⌖</span>
      Nothing selected.<br />
      Click a component in the preview or in the structure tree.
    </div>`;
  }

  if (node.type === ROOT) {
    return html`<div class="insp">
      <div class="insp-type">Page</div>
      <p class="insp-desc">Root container of this composition. Add sections with the + button in the preview area.</p>
      <div class="insp-meta">${node.children.length} direct ${node.children.length === 1 ? 'child' : 'children'}</div>
    </div>`;
  }

  if (node.type === SLOT) {
    return html`<div class="insp">
      <div class="insp-type">${node.name} column</div>
      <p class="insp-desc">Slot of a <b>Columns</b> container. Components added here render in this column.</p>
      <div class="insp-meta">${node.children.length} ${node.children.length === 1 ? 'component' : 'components'}</div>
    </div>`;
  }

  const def = REGISTRY[node.type];
  const parent = findParent(tree, node.id);
  const idx = parent ? parent.children.findIndex((c) => c.id === node.id) : -1;
  const propEntries = Object.entries(def.props);

  return html`<div class="insp">
    <div class="insp-type">${node.type} <span class="insp-cat">${def.container || def.slots ? 'Container' : def.category}</span></div>
    <p class="insp-desc">${def.description}</p>
    ${readOnly ? html`<p class="insp-desc insp-ro-note">Preview mode — switch to Edit to modify.</p>` : ''}
    ${!readOnly && def.inlineEdit ? html`<p class="insp-desc">Tip: click the selected component again to edit its text directly on the canvas.</p>` : ''}
    ${def.container && !def.slots ? html`<div class="insp-meta">${node.children.length} ${node.children.length === 1 ? 'child' : 'children'}</div>` : ''}

    ${propEntries.length ? html`
      <div class="insp-sec-title">Props</div>
      ${propEntries.map(([k, s]) => html`<${PropField} key=${k} name=${k} schema=${s} disabled=${readOnly}
        value=${node.props[k]} onChange=${(v) => actions.updateProp(node.id, k, v)} />`)}
    ` : ''}

    ${!readOnly ? html`
      <div class="insp-sec-title">Actions</div>
      <div class="insp-actions">
        <button type="button" class="ibtn" disabled=${idx <= 0} onClick=${() => actions.move(node.id, -1)}>↑ Move up</button>
        <button type="button" class="ibtn" disabled=${!parent || idx >= parent.children.length - 1} onClick=${() => actions.move(node.id, 1)}>↓ Move down</button>
        <button type="button" class="ibtn" onClick=${() => actions.duplicate(node.id)}>⧉ Duplicate</button>
        <button type="button" class="ibtn danger" onClick=${() => actions.remove(node.id)}>✕ Delete</button>
      </div>
    ` : ''}
  </div>`;
}

/* ---------------------------------------------------------------- *
 * Dialogs & menus
 * ---------------------------------------------------------------- */

/* Live preview of a catalog entry: components are plain (P)react
 * components, so render them directly with default props. Containers
 * get a dashed sample child so their layout reads. */
function samplePreview(type) {
  const def = REGISTRY[type];
  const p = defaultsOf(type);
  const sample = html`<div class="chp-sample-child">Content</div>`;
  if (def.slots) {
    return def.render(p, def.slots.map((name) =>
      html`<div key=${name} class="slotbox" style=${{ flex: '1 1 0%' }}>${sample}</div>`));
  }
  if (def.container) return def.render(p, [sample]);
  return def.render(p, null);
}

function ChooserDialog({ tree, target, onPick, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const [previewType, setPreviewType] = useState(null);
  const parent = findNode(tree, target.parentId);
  const parentLabel = !parent ? '?' : parent.type === ROOT ? 'Page' : parent.type === SLOT ? `${parent.name} column` : parent.type;
  const previewDef = previewType ? REGISTRY[previewType] : null;

  return html`<div class="overlay" onClick=${onClose}>
    <div class="dialog ${expanded ? 'max' : ''}" onClick=${(e) => e.stopPropagation()}>
      <div class="dlg-head">
        <span class="dlg-title">Add component</span>
        <span class="dlg-sub">into ${parentLabel} · position ${target.index + 1}</span>
        <button type="button" class="dlg-x dlg-expand ${expanded ? 'on' : ''}" title=${expanded ? 'Shrink dialog' : 'Expand dialog'}
          aria-label=${expanded ? 'Shrink dialog' : 'Expand dialog'}
          onClick=${() => setExpanded(!expanded)}>⛶</button>
        <button type="button" class="dlg-x" aria-label="Close" onClick=${onClose}>×</button>
      </div>
      <div class="dlg-body ch-body">
        <div class="ch-list">
          ${CATEGORIES.map((cat) => {
            const entries = Object.entries(REGISTRY).filter(([t, d]) => d.category === cat);
            if (!entries.length) return '';
            return html`<div class="ch-group" key=${cat}>
              <div class="ch-group-title">${cat}</div>
              <div class="ch-grid">
                ${entries.map(([type, d]) => html`
                  <button type="button" class="ch-card ${previewType === type ? 'previewing' : ''}" key=${type}
                    onClick=${() => onPick(type)}
                    onMouseEnter=${() => setPreviewType(type)}
                    onFocus=${() => setPreviewType(type)}>
                    <span class="ch-name">${type}${d.container || d.slots ? html`<span class="ch-badge">Container</span>` : ''}</span>
                    <span class="ch-desc">${d.description}</span>
                  </button>`)}
              </div>
            </div>`;
          })}
        </div>
        <div class="ch-preview">
          ${previewType ? html`
            <div class="chp-head">${previewType}${previewDef.container || previewDef.slots ? html`<span class="ch-badge">Container</span>` : ''}</div>
            <div class="chp-desc">${previewDef.description}</div>
            <div class="chp-stage">${samplePreview(previewType)}</div>
            <div class="chp-hint">Click the card to add it · rendered live with default props</div>
          ` : html`<div class="chp-empty">Hover a component to preview it here.<br />These are plain components, so the preview is a live render.</div>`}
        </div>
      </div>
    </div>
  </div>`;
}

function ExportDialog({ tree, onClose }) {
  const [tab, setTab] = useState('jsx');
  const [copied, setCopied] = useState(false);
  const jsx = useMemo(() => nodeToJSX(tree), [tree]);
  const json = useMemo(() => JSON.stringify(nodeToData(tree), null, 2), [tree]);
  const text = tab === 'jsx' ? jsx : json;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return html`<div class="overlay" onClick=${onClose}>
    <div class="dialog" onClick=${(e) => e.stopPropagation()}>
      <div class="dlg-head">
        <span class="dlg-title">Export composition</span>
        <div class="tabs">
          <button type="button" class="tab ${tab === 'jsx' ? 'on' : ''}" onClick=${() => setTab('jsx')}>JSX</button>
          <button type="button" class="tab ${tab === 'json' ? 'on' : ''}" onClick=${() => setTab('json')}>JSON</button>
        </div>
        <button type="button" class="btn btn-ghost" style=${{ marginLeft: 'auto' }} onClick=${copy}>${copied ? 'Copied!' : 'Copy'}</button>
        <button type="button" class="dlg-x" aria-label="Close" onClick=${onClose}>×</button>
      </div>
      <div class="dlg-body">
        <pre class="code-view">${text}</pre>
      </div>
    </div>
  </div>`;
}

function ContextMenu({ menu, items, onClose }) {
  const x = Math.max(8, Math.min(menu.x, window.innerWidth - 200));
  const y = Math.max(8, Math.min(menu.y, window.innerHeight - (items.length * 34 + 18)));
  return html`<div class="ctx-backdrop" onClick=${onClose} onContextMenu=${(e) => { e.preventDefault(); onClose(); }}>
    <div class="ctx-menu" style=${{ left: x + 'px', top: y + 'px' }} onClick=${(e) => e.stopPropagation()}>
      ${items.map((it) => html`<button type="button" key=${it.label} class="ctx-item ${it.danger ? 'danger' : ''}"
        disabled=${it.disabled}
        onClick=${() => { onClose(); it.run(); }}>${it.label}</button>`)}
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- *
 * Chrome
 * ---------------------------------------------------------------- */

function SiteHeader() {
  return html`<header class="site-header">
    <span class="sh-brand">Zudo Sg</span>
    <nav class="sh-nav">
      <span>Guide</span>
      <span>Components</span>
      <span class="on">Composer</span>
    </nav>
    <span class="sh-note">shared site header (mock)</span>
  </header>`;
}

function UtilHeader({ mode, setMode, count, clipboard, onExport, onReset }) {
  return html`<div class="util-header">
    <span class="uh-title">◱ Composer</span>
    <span class="uh-sub">composition1 prototype · issue #242</span>
    <span class="uh-spacer"></span>
    ${clipboard ? html`<span key="clip" class="uh-count uh-clip" title="Clipboard — paste via the ⋯ menu on any add point">⧉ ${clipboard.type}</span>` : ''}
    <span key="count" class="uh-count">${count} ${count === 1 ? 'component' : 'components'}</span>
    <div class="seg" role="group" aria-label="Mode">
      <button type="button" class=${mode === 'edit' ? 'on' : ''} onClick=${() => setMode('edit')}>Edit</button>
      <button type="button" class=${mode === 'preview' ? 'on' : ''} onClick=${() => setMode('preview')}>Preview</button>
    </div>
    <button type="button" class="btn btn-ghost" onClick=${onReset}>Reset</button>
    <button type="button" class="btn btn-primary" onClick=${onExport}>Export</button>
  </div>`;
}

function Resizer({ getWidth, setWidth, dir }) {
  const [active, setActive] = useState(false);
  const onPointerDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = getWidth();
    setActive(true);
    document.body.classList.add('col-dragging');
    const move = (ev) => setWidth(Math.min(480, Math.max(180, startW + dir * (ev.clientX - startX))));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('col-dragging');
      setActive(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return html`<div class="resizer ${active ? 'active' : ''}" onPointerDown=${onPointerDown}></div>`;
}

/* ---------------------------------------------------------------- *
 * App
 * ---------------------------------------------------------------- */

function App() {
  const [tree, setTree] = useState(loadInitial);
  const [selectedId, setSelectedId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [mode, setMode] = useState('edit');
  const [chooser, setChooser] = useState(null);          // { parentId, index }
  const [exportOpen, setExportOpen] = useState(false);
  const [editing, setEditing] = useState(null);          // { id, seq }
  const [dragId, setDragId] = useState(null);
  const [clipboard, setClipboard] = useState(null);      // deep-cloned subtree (raw ids; re-idd at paste)
  const [menu, setMenu] = useState(null);                // { kind:'node'|'insert', ..., x, y }
  const [leftW, setLeftW] = useState(260);
  const [rightW, setRightW] = useState(300);
  const [collapsed, setCollapsed] = useState(() => new Set());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ tree })); } catch (e) { /* quota/blocked: skip */ }
  }, [tree]);

  useEffect(() => {
    if (mode !== 'edit') {
      setEditing(null);
      setMenu(null);
      setDragId(null);
    }
  }, [mode]);

  const actions = {
    updateProp: (id, k, v) => setTree((t) => updateNode(t, id, (n) => ({ ...n, props: { ...n.props, [k]: v } }))),
    move: (id, delta) => setTree((t) => {
      const parent = findParent(t, id);
      if (!parent) return t;
      const idx = parent.children.findIndex((c) => c.id === id);
      const j = idx + delta;
      if (j < 0 || j >= parent.children.length) return t;
      return updateNode(t, parent.id, (n) => {
        const kids = [...n.children];
        const [x] = kids.splice(idx, 1);
        kids.splice(j, 0, x);
        return { ...n, children: kids };
      });
    }),
    remove: (id) => {
      const node = findNode(tree, id);
      if (!isDeletable(node)) return;
      const parent = findParent(tree, id);
      setTree((t) => removeNodeFromTree(t, id));
      setSelectedId(parent ? parent.id : null);
    },
    duplicate: (id) => {
      const parent = findParent(tree, id);
      if (!parent) return;
      const idx = parent.children.findIndex((c) => c.id === id);
      const copy = cloneWithNewIds(parent.children[idx]);
      setTree((t) => insertNodeAt(t, parent.id, idx + 1, copy));
      setSelectedId(copy.id);
      revealInTree(parent.id);
    },
  };

  // keep a freshly inserted node visible in the structure tree
  const revealInTree = (parentId) => setCollapsed((s) => {
    if (!s.has(parentId)) return s;
    const ns = new Set(s);
    ns.delete(parentId);
    return ns;
  });

  const copyNode = (id) => {
    const node = findNode(tree, id);
    if (!node || node.type === ROOT || node.type === SLOT) return;
    setClipboard(JSON.parse(JSON.stringify(node)));
  };

  const cutNode = (id) => {
    const node = findNode(tree, id);
    if (!isDeletable(node)) return;
    setClipboard(JSON.parse(JSON.stringify(node)));
    setTree((t) => removeNodeFromTree(t, id));
    setSelectedId(null);
  };

  const pasteAt = (parentId, index) => {
    if (!clipboard) return;
    const copy = cloneWithNewIds(clipboard);
    setTree((t) => insertNodeAt(t, parentId, index, copy));
    setSelectedId(copy.id);
    revealInTree(parentId);
  };

  const addComponent = (parentId, type, index) => {
    const node = createNode(type);
    setTree((t) => insertNodeAt(t, parentId, index, node));
    setSelectedId(node.id);
    setChooser(null);
    revealInTree(parentId);
  };

  /* drag & drop: a drop target is valid unless it sits inside the
   * dragged subtree (dropping there would orphan the destination). */
  const canDropAt = (parentId) => {
    if (!dragId || parentId === dragId) return false;
    const dragged = findNode(tree, dragId);
    return !(dragged && findNode(dragged, parentId));
  };

  const dropAt = (parentId, index, copyMode) => {
    const id = dragId;
    setDragId(null);
    if (!id || !canDropAt(parentId)) return;
    if (copyMode) {
      const src = findNode(tree, id);
      if (!src) return;
      const copy = cloneWithNewIds(src);
      setTree((t) => insertNodeAt(t, parentId, index, copy));
      setSelectedId(copy.id);
    } else {
      setTree((t) => moveNodeTo(t, id, parentId, index));
      setSelectedId(id);
    }
    revealInTree(parentId);
  };

  const toggleCollapse = (id) => setCollapsed((s) => {
    const ns = new Set(s);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    return ns;
  });

  const reset = () => {
    if (!window.confirm('Reset the composition to the sample?')) return;
    setTree(seedTree());
    setSelectedId(null);
    setCollapsed(new Set());
    setClipboard(null);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenu(null);
        setChooser(null);
        setExportOpen(false);
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const t = e.target;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      if (mode !== 'edit' || !selectedId || chooser || exportOpen || menu) return;
      e.preventDefault();
      actions.remove(selectedId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, selectedId, tree, chooser, exportOpen, menu]);

  const ctx = {
    mode,
    selectedId,
    hoverId,
    editing,
    dragId,
    select: setSelectedId,
    setHover: setHoverId,
    updateProp: actions.updateProp,
    setEditingFor: (id) => setEditing(id ? { id, seq: (editing ? editing.seq : 0) + 1 } : null),
    openChooser: (parentId, index) => setChooser({ parentId, index }),
    openNodeMenu: (id, rect) => setMenu({ kind: 'node', id, x: rect.left, y: rect.bottom + 4 }),
    openInsertMenu: (parentId, index, rect) => setMenu({ kind: 'insert', parentId, index, x: rect.left, y: rect.bottom + 4 }),
    canDropAt,
    dropAt,
    setDrag: setDragId,
  };

  let menuItems = null;
  if (menu && menu.kind === 'node') {
    menuItems = [
      { label: '⧉ Copy', run: () => copyNode(menu.id) },
      { label: '✂ Cut', run: () => cutNode(menu.id) },
      { label: '⊕ Duplicate', run: () => actions.duplicate(menu.id) },
      { label: '✕ Delete', danger: true, run: () => actions.remove(menu.id) },
    ];
  } else if (menu && menu.kind === 'insert') {
    menuItems = [
      { label: '+ Add component…', run: () => setChooser({ parentId: menu.parentId, index: menu.index }) },
      {
        label: clipboard ? `⧉ Paste "${clipboard.type}" here` : '⧉ Paste here',
        disabled: !clipboard,
        run: () => pasteAt(menu.parentId, menu.index),
      },
    ];
  }

  return html`<div class="app ${dragId ? 'is-dragging' : ''}">
    <${SiteHeader} />
    <${UtilHeader} mode=${mode} setMode=${setMode} count=${countComponents(tree)} clipboard=${clipboard}
      onExport=${() => setExportOpen(true)} onReset=${reset} />
    <div class="workspace">
      <aside class="panel panel-left" style=${{ width: leftW + 'px' }}>
        <div class="panel-head">Structure</div>
        <div class="panel-scroll">
          <${TreeRow} node=${tree} depth=${0} ctx=${ctx} collapsed=${collapsed} toggle=${toggleCollapse} />
        </div>
      </aside>
      <${Resizer} getWidth=${() => leftW} setWidth=${setLeftW} dir=${1} />
      <main class="center" onClick=${() => mode === 'edit' && setSelectedId(null)}>
        <div class="page">
          <${RenderNode} node=${tree} ctx=${ctx} />
        </div>
      </main>
      <${Resizer} getWidth=${() => rightW} setWidth=${setRightW} dir=${-1} />
      <aside class="panel panel-right" style=${{ width: rightW + 'px' }}>
        <div class="panel-head">Inspector</div>
        <div class="panel-scroll">
          <${Inspector} tree=${tree} selectedId=${selectedId} actions=${actions} mode=${mode} />
        </div>
      </aside>
    </div>
    ${chooser ? html`<${ChooserDialog} tree=${tree} target=${chooser}
      onPick=${(type) => addComponent(chooser.parentId, type, chooser.index)} onClose=${() => setChooser(null)} />` : ''}
    ${exportOpen ? html`<${ExportDialog} tree=${tree} onClose=${() => setExportOpen(false)} />` : ''}
    ${menu && menuItems ? html`<${ContextMenu} menu=${menu} items=${menuItems} onClose=${() => setMenu(null)} />` : ''}
  </div>`;
}

render(h(App), document.getElementById('app'));
