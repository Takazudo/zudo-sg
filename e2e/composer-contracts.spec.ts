import { test, expect, type Page, type Frame } from "@playwright/test";

// ---------------------------------------------------------------------------
// Composer Polish epic (#262) — S7 (#270) central computed-style CONTRACT gate.
//
// This spec is the epic's quality gate: it re-derives the plan-time
// computed-style audit as durable Playwright assertions and — crucially —
// LOGS every measured number to stdout (grep `CENSUS:` / `CONTRACT:`). The
// at-rest accent-census numbers it prints are the ground truth S8 (#271)
// cites. Everything is measured against the actually-built DOM served from
// `dist/` (port 4700), in BOTH dark and light, at 1600x900, plus a narrow
// ~900px overflow pass.
//
// Colour maths: every colour is normalised through a 1x1 <canvas> (which
// resolves ANY CSS colour string — named/hex/rgb/oklch/color-mix's computed
// output — to concrete sRGB bytes + alpha) and then converted to OKLCh via
// Björn Ottosson's matrices. The "orange/accent" predicate is the plan's:
// oklch chroma >= 0.05 AND hue in [25,100]. For translucent paints the
// EFFECTIVE chroma (C * alpha) must also clear 0.05 — a 12%-alpha accent tint
// reads as neutral to a viewer and is not an accent "spend".
// ---------------------------------------------------------------------------

const COMPOSER_PATH = "/composer";
const IFRAME_SEL = ".sg-composer-canvas-frame iframe";
const THEME_KEY = "zudo-doc-theme";
const TREE_WIDTH_KEY = "sg-composer-tree-width";

type Mode = "dark" | "light";
const MODES: Mode[] = ["dark", "light"];

// In-page helper source: defines window.__css (colour → OKLCh), window.__census
// (accent element enumeration) and window.__resolveVar (token → concrete rgb).
// Injected into whichever realm we measure — the main page OR the preview
// iframe (a separate JS realm) — via `evaluate(HELPER_SOURCE)`.
const HELPER_SOURCE = String.raw`
(function(){
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  // getImageData rasterises ANY fillStyle the browser accepts (rgb/hex/hsl/
  // oklch/oklab/color()/color-mix) to concrete sRGB bytes + straight alpha —
  // robust where reading the fillStyle string back is not (this Chromium
  // serialises custom-property-derived colours as oklch(...), which a string
  // parser would choke on).
  function norm(str){
    if(!str) return null;
    let ok = true;
    try {
      cx.clearRect(0,0,1,1);
      cx.fillStyle = 'rgba(0,0,0,0)';
      cx.fillStyle = String(str);   // invalid → retains the transparent sentinel
      cx.fillRect(0,0,1,1);
    } catch(e){ ok = false; }
    if(!ok) return null;
    const d = cx.getImageData(0,0,1,1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  }
  // Fast, loss-free path for the common case: the value already IS oklch().
  // (Chromium serialises computed oklch() with raw numbers today, but CSS
  // Color 4 also permits percentages — scale each channel accordingly so the
  // fast path stays correct if that ever changes: L 100% = 1.0, C 100% = 0.4.)
  function parseOklch(str){
    const m = String(str).trim().match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)(%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/i);
    if(!m) return null;
    return {
      L: m[2] === '%' ? parseFloat(m[1]) / 100 : parseFloat(m[1]),
      C: m[4] === '%' ? parseFloat(m[3]) * 0.004 : parseFloat(m[3]),
      h: parseFloat(m[5]),
      a: m[6] == null ? 1 : (m[7] === '%' ? parseFloat(m[6]) / 100 : parseFloat(m[6])),
    };
  }
  function lin(c){ c/=255; return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
  function oklch(str){
    const direct = parseOklch(str);
    if(direct) return direct;
    const c = norm(str); if(!c) return null;
    const lr = lin(c.r), lg = lin(c.g), lb = lin(c.b);
    const l = 0.4122214708*lr + 0.5363325363*lg + 0.0514459929*lb;
    const m = 0.2119034982*lr + 0.6806995451*lg + 0.1073969566*lb;
    const s = 0.0883024619*lr + 0.2817188376*lg + 0.6299787005*lb;
    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    const L = 0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_;
    const a = 1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_;
    const bb = 0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_;
    const C = Math.sqrt(a*a + bb*bb);
    let h = Math.atan2(bb, a) * 180 / Math.PI; if(h < 0) h += 360;
    return { L: L, C: C, h: h, a: c.a };
  }
  function isAccent(o, opt){
    if(!o) return false;
    const hueMin = opt.hueMin, hueMax = opt.hueMax, chromaMin = opt.chromaMin;
    const eff = o.C * (o.a == null ? 1 : o.a);
    return o.C >= chromaMin && eff >= chromaMin && o.h >= hueMin && o.h <= hueMax;
  }
  window.__css = { norm: norm, oklch: oklch, isAccent: isAccent };

  window.__resolveVar = function(name){
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;opacity:0;pointer-events:none';
    probe.style.color = 'var(' + name + ')';
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  };

  window.__census = function(opts){
    opts = opts || {};
    const opt = {
      hueMin:   opts.hueMin   != null ? opts.hueMin   : 25,
      hueMax:   opts.hueMax   != null ? opts.hueMax   : 100,
      chromaMin:opts.chromaMin!= null ? opts.chromaMin: 0.05,
    };
    const skip = { SCRIPT:1, STYLE:1, LINK:1, META:1, HEAD:1, TITLE:1, NOSCRIPT:1, IFRAME:1, SVG:1, PATH:1 };
    const hits = [];
    const all = document.querySelectorAll('*');
    for(let i=0;i<all.length;i++){
      const el = all[i];
      if(skip[el.tagName]) continue;
      const cs = getComputedStyle(el);
      if(cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if(rect.width < 2 || rect.height < 2) continue;
      const detail = [];
      // Only count a paint that is ACTUALLY drawn: a border/outline colour that
      // sits behind 0 width or style:none paints nothing (and border colour
      // defaults to the element's currentColor, so a text-accent element would
      // otherwise false-positive on all four sides).
      const props = { color: cs.color, background: cs.backgroundColor };
      const sides = ['Top', 'Right', 'Bottom', 'Left'];
      for(let s=0;s<sides.length;s++){
        const side = sides[s];
        if(parseFloat(cs['border' + side + 'Width']) > 0 && cs['border' + side + 'Style'] !== 'none'){
          props['border' + side] = cs['border' + side + 'Color'];
        }
      }
      if(parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none'){
        props.outline = cs.outlineColor;
      }
      for(const k in props){
        if(k === 'color'){
          // 'color' only counts when the element paints its OWN text — else
          // every wrapper that merely inherits accent colour would match.
          let ownText = false;
          for(let n=0;n<el.childNodes.length;n++){
            const cn = el.childNodes[n];
            if(cn.nodeType === 3 && cn.textContent.trim().length > 0){ ownText = true; break; }
          }
          if(!ownText) continue;
        }
        const o = window.__css.oklch(props[k]);
        if(window.__css.isAccent(o, opt)){
          detail.push(k + '(C=' + o.C.toFixed(3) + ',h=' + o.h.toFixed(0) + ',a=' + (o.a == null ? 1 : o.a).toFixed(2) + ')');
        }
      }
      if(detail.length){
        hits.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute('class') || '').slice(0, 70),
          id: el.id || '',
          text: (el.textContent || '').trim().replace(/\s+/g,' ').slice(0, 28),
          props: detail.join(' '),
        });
      }
    }
    return hits;
  };
})();
`;

async function injectHelper(page: Page): Promise<void> {
  await page.evaluate(HELPER_SOURCE);
}

async function gotoComposer(
  page: Page,
  mode: Mode,
  opts: { clearTreeWidth?: boolean } = {},
): Promise<void> {
  await page.addInitScript(
    (args: { key: string; mode: string; twKey: string; clearTw: boolean }) => {
      try {
        localStorage.setItem(args.key, args.mode);
        if (args.clearTw) localStorage.removeItem(args.twKey);
      } catch {
        /* private mode */
      }
    },
    { key: THEME_KEY, mode, twKey: TREE_WIDTH_KEY, clearTw: !!opts.clearTreeWidth },
  );
  await page.goto(COMPOSER_PATH);
  // Belt-and-suspenders: pin the scheme regardless of the provider's timing so
  // light-dark() resolves deterministically for the measurement.
  await page.evaluate((m) => {
    document.documentElement.setAttribute("data-theme", m);
    (document.documentElement.style as CSSStyleDeclaration).colorScheme = m;
  }, mode);
  await page.waitForSelector(IFRAME_SEL, { state: "attached" });
  await page
    .frameLocator(IFRAME_SEL)
    .locator("[data-composer-canvas]")
    .waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(250);
  await injectHelper(page);
}

async function getPreviewFrame(page: Page): Promise<Frame> {
  const handle = await page.locator(IFRAME_SEL).elementHandle();
  if (!handle) throw new Error("preview iframe not found");
  const frame = await handle.contentFrame();
  if (!frame) throw new Error("preview iframe has no content frame");
  return frame;
}

async function quiesce(page: Page): Promise<void> {
  // At-rest = nothing hovered, nothing focused.
  await page.mouse.move(1, 1);
  await page.evaluate(() => {
    const a = document.activeElement;
    if (a instanceof HTMLElement) a.blur();
  });
  await page.waitForTimeout(60);
}

async function deselect(page: Page): Promise<void> {
  // The composer auto-selects a node on load (repairSelection). Clicking the
  // "Document root" row selects null → truly "nothing selected".
  await page.locator(".sg-composer-tree-select-root").click();
  await page
    .frameLocator(IFRAME_SEL)
    .locator("[data-zc-selected]")
    .waitFor({ state: "detached", timeout: 3000 })
    .catch(() => {});
  await quiesce(page);
}

async function openChooser(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Add component to document root" }).click();
  await page.locator("dialog.sg-composer-chooser").waitFor({ state: "visible" });
  await page.waitForTimeout(120);
}

interface Oklch {
  L: number;
  C: number;
  h: number;
  a: number;
}

async function oklchOf(page: Page, colorStr: string): Promise<Oklch> {
  return page.evaluate((s) => (window as any).__css.oklch(s), colorStr);
}

test.describe("Composer Polish S7 contracts", () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  // ── S1: panel bg is tonally distinct from (and lighter than) the canvas
  //        backdrop, in BOTH modes. ─────────────────────────────────────────
  for (const mode of MODES) {
    test(`S1 panel separation — ${mode}`, async ({ page }) => {
      await gotoComposer(page, mode);
      const { panel, backdrop } = await page.evaluate(() => {
        const probe = (name: string) => {
          const el = document.createElement("div");
          el.style.cssText = "position:absolute;left:-9999px;top:0";
          el.style.background = `var(${name})`;
          document.body.appendChild(el);
          const c = getComputedStyle(el).backgroundColor;
          el.remove();
          return c;
        };
        return {
          panel: probe("--sg-composer-panel-bg"),
          backdrop: probe("--sg-composer-canvas-backdrop"),
        };
      });
      const panelO = await oklchOf(page, panel);
      const backO = await oklchOf(page, backdrop);
      console.log(
        `CONTRACT: S1 ${mode} panel-bg=${panel} L=${panelO.L.toFixed(3)} | canvas-backdrop=${backdrop} L=${backO.L.toFixed(3)} | ΔL=${(panelO.L - backO.L).toFixed(3)}`,
      );
      expect(panel, `${mode}: panel-bg must differ from canvas-backdrop`).not.toBe(backdrop);
      expect(panelO.L, `${mode}: panel L must exceed backdrop L`).toBeGreaterThan(backO.L);
    });
  }

  // ── S2: chooser dialog behaves as a centred modal with a real border, a
  //        distinct surface, an engaging scroll region, and paints NOTHING
  //        once closed. ────────────────────────────────────────────────────
  for (const mode of MODES) {
    test(`S2 chooser dialog — ${mode}`, async ({ page }) => {
      await gotoComposer(page, mode);
      await openChooser(page);

      const m = await page.evaluate(() => {
        const dlg = document.querySelector("dialog.sg-composer-chooser") as HTMLElement;
        const cs = getComputedStyle(dlg);
        const r = dlg.getBoundingClientRect();
        const list = document.querySelector(".sg-composer-chooser-list") as HTMLElement;
        return {
          dx: r.left + r.width / 2 - window.innerWidth / 2,
          dy: r.top + r.height / 2 - window.innerHeight / 2,
          borderTopWidth: cs.borderTopWidth,
          borderTopColor: cs.borderTopColor,
          dialogBg: cs.backgroundColor,
          bodyBg: getComputedStyle(document.body).backgroundColor,
          hasList: !!list,
          listScrollH: list ? list.scrollHeight : 0,
          listClientH: list ? list.clientHeight : 0,
        };
      });
      console.log(
        `CONTRACT: S2 ${mode} dialog centre offset dx=${m.dx.toFixed(1)} dy=${m.dy.toFixed(1)} | border=${m.borderTopWidth} ${m.borderTopColor} | dialogBg=${m.dialogBg} bodyBg=${m.bodyBg} | list scrollH=${m.listScrollH} clientH=${m.listClientH}`,
      );

      expect(Math.abs(m.dx), `${mode}: dialog x-centre offset < 40px`).toBeLessThan(40);
      expect(Math.abs(m.dy), `${mode}: dialog y-centre offset < 40px`).toBeLessThan(40);
      // ~1px border, visible (non-transparent) colour.
      expect(parseFloat(m.borderTopWidth)).toBeGreaterThanOrEqual(0.5);
      expect(parseFloat(m.borderTopWidth)).toBeLessThanOrEqual(2);
      const borderO = await oklchOf(page, m.borderTopColor);
      expect(borderO.a, `${mode}: dialog border colour must be visible`).toBeGreaterThan(0.2);
      expect(m.dialogBg, `${mode}: dialog bg must differ from page/body bg`).not.toBe(m.bodyBg);
      // List scroll engages.
      expect(m.hasList).toBe(true);
      expect(m.listScrollH, `${mode}: chooser list must overflow (scroll engages)`).toBeGreaterThan(
        m.listClientH,
      );

      // Scroll to bottom → last card's bottom sits within the list box.
      const tail = await page.evaluate(() => {
        const list = document.querySelector(".sg-composer-chooser-list") as HTMLElement;
        list.scrollTop = list.scrollHeight;
        const cards = list.querySelectorAll(".sg-composer-chooser-card");
        const last = cards[cards.length - 1] as HTMLElement;
        const lr = last.getBoundingClientRect();
        const listR = list.getBoundingClientRect();
        return { lastBottom: lr.bottom, listBottom: listR.bottom, cardCount: cards.length };
      });
      console.log(
        `CONTRACT: S2 ${mode} after scroll-to-bottom lastCardBottom=${tail.lastBottom.toFixed(1)} listBottom=${tail.listBottom.toFixed(1)} cards=${tail.cardCount}`,
      );

      // Dialog-open accent census (informational — no stated budget): the S2
      // wave flagged the per-card category badge as accent-at-rest inside the
      // open dialog. Report it so S8 can attribute the numbers.
      await page.mouse.move(1, 1);
      const dlgHits = await page.evaluate(() =>
        (window as any).__census({ hueMin: 25, hueMax: 100, chromaMin: 0.05 }),
      );
      console.log(`CENSUS: S2 dialog-open ${mode} accent count=${dlgHits.length} (informational, no budget)`);
      for (const h of dlgHits) {
        console.log(`CENSUS:   S2 dialog-open ${mode} <${h.tag}${h.id ? "#" + h.id : ""} class="${h.cls}"> "${h.text}" ${h.props}`);
      }

      expect(tail.lastBottom, `${mode}: last card bottom within list box after scroll`).toBeLessThanOrEqual(
        tail.listBottom + 2,
      );

      // Close (Escape) → the closed dialog computes display:none and a 0x0 box.
      await page.keyboard.press("Escape");
      await page.locator("dialog.sg-composer-chooser").waitFor({ state: "hidden" });
      const closed = await page.evaluate(() => {
        const dlg = document.querySelector("dialog.sg-composer-chooser") as HTMLElement;
        const cs = getComputedStyle(dlg);
        const r = dlg.getBoundingClientRect();
        return { display: cs.display, w: r.width, h: r.height };
      });
      console.log(
        `CONTRACT: S2 ${mode} closed dialog display=${closed.display} rect=${closed.w}x${closed.h}`,
      );
      expect(closed.display, `${mode}: closed dialog computes display:none`).toBe("none");
      expect(closed.w).toBe(0);
      expect(closed.h).toBe(0);
    });
  }

  // ── S3: tree rail — compact aligned rows, untruncated SectionHeading at the
  //        default rail, continuous hierarchy guides, neutral hover. ────────
  test("S3 tree — geometry, continuous guides, hover (default rail)", async ({ page }) => {
    await gotoComposer(page, "light", { clearTreeWidth: true });

    // Reveal the nested SectionHeading (split-1 → left slot → heading-1).
    await page
      .locator('[data-sg-tree-node-id="split-1"] .sg-composer-tree-disclosure')
      .first()
      .click();
    await page.locator('[data-sg-tree-node-id="heading-1"]').waitFor({ state: "visible" });

    const geo = await page.evaluate(() => {
      const railW = (document.querySelector("#sg-composer-tree") as HTMLElement)?.getBoundingClientRect()
        .width;
      const sel = document.querySelector(
        '[data-sg-tree-node-id="split-1"] .sg-composer-tree-select',
      ) as HTMLElement;
      const selMinH = getComputedStyle(sel).minHeight;

      const title = document.querySelector(
        '[data-sg-tree-node-id="heading-1"] .sg-composer-tree-select-title',
      ) as HTMLElement;
      const titleFont = getComputedStyle(title).fontSize;
      const titleText = title.textContent;
      const titleScrollW = title.scrollWidth;
      const titleClientW = title.clientWidth;

      const rect = (selector: string) =>
        (document.querySelector(selector) as HTMLElement).getBoundingClientRect();
      const px = (value: string) => Number.parseFloat(value) || 0;
      const splitRowSelector = '[data-sg-tree-node-id="split-1"] > .sg-composer-tree-row';
      const leftSlotSelector =
        '[data-sg-tree-node-id="split-1"] > .sg-composer-tree-slots > [data-sg-tree-slot-id="left"]';
      const leftHeaderSelector = `${leftSlotSelector} > .sg-composer-tree-slot-header`;
      const rightSlotSelector =
        '[data-sg-tree-node-id="split-1"] > .sg-composer-tree-slots > [data-sg-tree-slot-id="right"]';
      const rightHeaderSelector = `${rightSlotSelector} > .sg-composer-tree-slot-header`;
      const headingRowSelector = '[data-sg-tree-node-id="heading-1"] > .sg-composer-tree-row';
      const splitRect = rect(splitRowSelector);
      const leftSlotRect = rect(leftSlotSelector);
      const leftHeaderRect = rect(leftHeaderSelector);
      const rightSlotRect = rect(rightSlotSelector);
      const rightHeaderRect = rect(rightHeaderSelector);
      const headingRect = rect(headingRowSelector);
      const splitOut = getComputedStyle(document.querySelector(splitRowSelector)!, "::after");
      const leftIn = getComputedStyle(document.querySelector(leftHeaderSelector)!, "::before");
      const leftOut = getComputedStyle(document.querySelector(leftHeaderSelector)!, "::after");
      const leftRail = getComputedStyle(document.querySelector(leftSlotSelector)!, "::before");
      const rightIn = getComputedStyle(document.querySelector(rightHeaderSelector)!, "::before");
      const rightRail = getComputedStyle(document.querySelector(rightSlotSelector)!, "::before");
      const headingIn = getComputedStyle(document.querySelector(headingRowSelector)!, "::before");
      const rootRow = getComputedStyle(document.querySelector(".sg-composer-tree-row-root")!);
      const iconCenterError = (rowSelector: string) => {
        const row = rect(rowSelector);
        const icon = rect(`${rowSelector} .sg-composer-tree-node-icon`);
        return Math.abs(row.top + row.height / 2 - (icon.top + icon.height / 2));
      };

      // Same-depth siblings share a left edge (prose-1 / prose-2, both in the
      // Stack children slot). They require the split-1 right slot + stack-1 to
      // be expanded; expand them here for the measurement.
      return {
        railW,
        selMinH,
        titleFont,
        titleText,
        titleScrollW,
        titleClientW,
        railPadding: getComputedStyle(document.querySelector("#sg-composer-tree")!).padding,
        treePadding: getComputedStyle(document.querySelector("#sg-composer-tree > .sg-composer-tree")!).padding,
        componentToSlotIndent: leftHeaderRect.left - splitRect.left,
        slotToComponentIndent: headingRect.left - leftHeaderRect.left,
        sameDepthSlotDelta: leftHeaderRect.left - rightHeaderRect.left,
        splitIconCenterError: iconCenterError(splitRowSelector),
        slotIconCenterError: iconCenterError(leftHeaderSelector),
        headingIconCenterError: iconCenterError(headingRowSelector),
        parentOutX: splitRect.left + px(splitOut.left),
        firstSlotInX: leftHeaderRect.left + px(leftIn.left),
        parentOutBottom: splitRect.bottom - px(splitOut.bottom),
        firstSlotInTop: leftHeaderRect.top + px(leftIn.top),
        firstSlotRailBottom: leftSlotRect.bottom - px(leftRail.bottom),
        secondSlotInTop: rightHeaderRect.top + px(rightIn.top),
        firstSlotBottom: leftSlotRect.bottom,
        secondSlotTop: rightSlotRect.top,
        firstSlotElbowWidth: leftIn.borderBlockEndWidth,
        slotOutX: leftHeaderRect.left + px(leftOut.left),
        childInX: headingRect.left + px(headingIn.left),
        slotOutBottom: leftHeaderRect.bottom - px(leftOut.bottom),
        childInTop: headingRect.top + px(headingIn.top),
        childElbowWidth: headingIn.borderBlockEndWidth,
        lastSlotRailContent: rightRail.content,
        lastSlotIncomingHeight: px(rightIn.height),
        lastSlotHalfHeight: rightHeaderRect.height / 2,
        connectorWidth: leftIn.borderInlineStartWidth,
        connectorColor: leftIn.borderInlineStartColor,
        rootDividerWidth: rootRow.borderBlockEndWidth,
        rootDividerColor: rootRow.borderBlockEndColor,
        slotKinds: [
          ...document.querySelectorAll(
            '[data-sg-tree-node-id="split-1"] > .sg-composer-tree-slots > .sg-composer-tree-slot > .sg-composer-tree-slot-header .sg-composer-tree-slot-kind',
          ),
        ].map((element) => element.textContent),
        colorBorder: (window as any).__resolveVar("--color-border"),
      };
    });

    // Expand the right slot + stack to reach the sibling proses for alignment.
    await page
      .locator('[data-sg-tree-node-id="split-1"] [data-sg-tree-slot-id]')
      .last()
      .waitFor({ state: "visible" });
    await page
      .locator('[data-sg-tree-node-id="stack-1"] .sg-composer-tree-disclosure')
      .first()
      .click();
    await page.locator('[data-sg-tree-node-id="prose-2"]').waitFor({ state: "visible" });
    const align = await page.evaluate(() => {
      const left = (id: string) =>
        (
          document.querySelector(
            `[data-sg-tree-node-id="${id}"] .sg-composer-tree-select`,
          ) as HTMLElement
        ).getBoundingClientRect().left;
      return { p1: left("prose-1"), p2: left("prose-2") };
    });

    console.log(
      `CONTRACT: S3 railW=${geo.railW?.toFixed(1)} rowMinH=${geo.selMinH} | SectionHeading title="${geo.titleText}" font=${geo.titleFont} scrollW=${geo.titleScrollW} clientW=${geo.titleClientW} (truncated=${geo.titleScrollW > geo.titleClientW + 1})`,
    );
    console.log(
      `CONTRACT: S3 indent component→slot=${geo.componentToSlotIndent.toFixed(1)} slot→component=${geo.slotToComponentIndent.toFixed(1)} | icon center errors=${geo.splitIconCenterError.toFixed(2)}/${geo.slotIconCenterError.toFixed(2)}/${geo.headingIconCenterError.toFixed(2)} | sibling left edges prose-1=${align.p1.toFixed(1)} prose-2=${align.p2.toFixed(1)}`,
    );

    // Composer UI Parity (#281): tree rows tightened 32px → 28px per the A1
    // locked density spec (#277); still ≥ the 14px functional-text floor (asserted next).
    expect(geo.selMinH, "tree row min-height 28px desktop").toBe("28px");
    expect(geo.titleFont, "tree row label 14px").toBe("14px");
    expect(
      geo.titleScrollW,
      `SectionHeading title must NOT truncate at default rail (${geo.railW?.toFixed(0)}px)`,
    ).toBeLessThanOrEqual(geo.titleClientW + 1);
    expect(geo.railPadding, "workspace rail does not duplicate the tree content padding").toBe("0px");
    expect(geo.treePadding, "inner tree owns the one intentional content inset").not.toBe("0px");
    expect(geo.componentToSlotIndent, "component → slot uses one 16px hierarchy step").toBe(16);
    expect(geo.slotToComponentIndent, "slot → component uses the same 16px hierarchy step").toBe(16);
    expect(Math.abs(geo.sameDepthSlotDelta), "same-depth slots share a left edge").toBeLessThanOrEqual(1);
    expect(geo.splitIconCenterError, "container icon is centered on its row").toBeLessThanOrEqual(1);
    expect(geo.slotIconCenterError, "slot icon is centered on its row").toBeLessThanOrEqual(1);
    expect(geo.headingIconCenterError, "leaf icon is centered on its row").toBeLessThanOrEqual(1);
    expect(Math.abs(geo.parentOutX - geo.firstSlotInX), "parent and first-slot guides share an x axis").toBeLessThanOrEqual(1);
    expect(Math.abs(geo.parentOutBottom - geo.firstSlotInTop), "parent guide touches the first slot").toBeLessThanOrEqual(1);
    expect(Math.abs(geo.firstSlotRailBottom - geo.secondSlotInTop), "guide stays continuous between slots").toBeLessThanOrEqual(1);
    expect(Math.abs(geo.firstSlotBottom - geo.secondSlotTop), "slot spacing introduces no connector gap").toBeLessThanOrEqual(1);
    expect(parseFloat(geo.firstSlotElbowWidth), "slot incoming guide includes its horizontal elbow").toBe(1);
    expect(Math.abs(geo.slotOutX - geo.childInX), "slot and child guides share an x axis").toBeLessThanOrEqual(1);
    expect(Math.abs(geo.slotOutBottom - geo.childInTop), "slot guide touches its first component").toBeLessThanOrEqual(1);
    expect(parseFloat(geo.childElbowWidth), "component incoming guide includes its horizontal elbow").toBe(1);
    expect(geo.lastSlotRailContent, "last slot has no continuing sibling rail").toBe("none");
    expect(
      Math.abs(geo.lastSlotIncomingHeight - geo.lastSlotHalfHeight),
      "last-slot guide terminates at the row midpoint",
    ).toBeLessThanOrEqual(1);
    expect(parseFloat(geo.connectorWidth), "hierarchy guide is a 1px hairline").toBe(1);
    expect(geo.connectorColor, "hierarchy guide uses --color-border").toBe(geo.colorBorder);
    expect(parseFloat(geo.rootDividerWidth), "document root is separated as a header").toBe(1);
    expect(geo.rootDividerColor, "document-root divider uses --color-border").toBe(geo.colorBorder);
    expect(geo.slotKinds, "slot rows are named explicitly").toEqual(["Slot", "Slot"]);
    expect(Math.abs(align.p1 - align.p2), "same-depth siblings share a left edge").toBeLessThanOrEqual(1);

    // Neutral hover tint (NOT accent) on a non-selected row.
    const hoverMedia = await page.evaluate(() => window.matchMedia("(hover: hover)").matches);
    await page.locator('[data-sg-tree-node-id="cta-1"] .sg-composer-tree-row').hover();
    await page.waitForTimeout(80);
    const hover = await page.evaluate(() => {
      const row = document.querySelector(
        '[data-sg-tree-node-id="cta-1"] .sg-composer-tree-row',
      ) as HTMLElement;
      return {
        bg: getComputedStyle(row).backgroundColor,
        accent: (window as any).__resolveVar("--color-accent"),
      };
    });
    const hoverO = await oklchOf(page, hover.bg);
    const accentO = await oklchOf(page, hover.accent);
    const hoverEff = hoverO.C * (hoverO.a == null ? 1 : hoverO.a);
    console.log(
      `CONTRACT: S3 hover(hover:hover=${hoverMedia}) row bg=${hover.bg} C=${hoverO.C.toFixed(3)} h=${hoverO.h.toFixed(0)} a=${hoverO.a.toFixed(2)} effC=${hoverEff.toFixed(3)} | accent hue=${accentO.h.toFixed(0)}`,
    );
    if (hoverMedia) {
      expect(hoverEff, "hover tint is neutral (effective chroma < 0.05)").toBeLessThan(0.05);
    }
  });

  // ── S4: canvas — orange census INSIDE the iframe at rest (budget <= 4),
  //        insert marker muted→accent, viewport-invariant canvas width. ─────
  for (const mode of MODES) {
    test(`S4 iframe orange census + insert marker + viewport width — ${mode}`, async ({ page }) => {
      await gotoComposer(page, mode);
      await quiesce(page);

      const runIframeCensus = async () => {
        const frame = await getPreviewFrame(page);
        await frame.evaluate(HELPER_SOURCE);
        return frame.evaluate(() =>
          (window as any).__census({ hueMin: 25, hueMax: 100, chromaMin: 0.05 }),
        );
      };
      const logHits = (label: string, hits: any[]) => {
        console.log(`CENSUS: ${label} count=${hits.length}`);
        for (const h of hits) {
          console.log(`CENSUS:   ${label} <${h.tag}${h.id ? "#" + h.id : ""} class="${h.cls}"> "${h.text}" ${h.props}`);
        }
      };

      // Default load auto-selects the root — realistic "as first seen" view.
      const dfltHits = await runIframeCensus();
      logHits(`S4 iframe-default(auto-selected) ${mode}`, dfltHits);

      // Contract precondition: NOTHING selected.
      await deselect(page);
      const hits = await runIframeCensus();
      logHits(`S4 iframe-at-rest(nothing-selected) ${mode} [GROUND TRUTH, budget <= 4]`, hits);
      expect(hits.length, `${mode}: iframe orange census at rest (nothing selected) <= 4`).toBeLessThanOrEqual(4);

      const frame = await getPreviewFrame(page);
      await frame.evaluate(HELPER_SOURCE);

      // Insert marker: pick a non-empty between-child bar (empty-slot markers
      // are intentionally neutral-but-fully-visible, not muted).
      const marker = await frame.evaluate(() => {
        const bars = Array.from(
          document.querySelectorAll(".zc-insert:not(.zc-insert--empty)"),
        ) as HTMLElement[];
        const el = bars[0];
        if (!el) return null;
        const cs = getComputedStyle(el);
        const ok = (window as any).__css.oklch;
        const maxC = [cs.borderTopColor, cs.color, cs.backgroundColor]
          .map((c) => ok(c))
          .filter(Boolean)
          .reduce((mx: number, o: any) => Math.max(mx, o.C * (o.a == null ? 1 : o.a)), 0);
        return { border: cs.borderTopColor, color: cs.color, restEffC: maxC, total: bars.length };
      });
      console.log(
        `CONTRACT: S4 ${mode} .zc-insert markers=${marker?.total} rest border=${marker?.border} effChroma=${marker?.restEffC.toFixed(3)} (muted target < 0.05)`,
      );
      expect(marker, `${mode}: a non-empty .zc-insert marker exists`).not.toBeNull();
      expect(marker!.restEffC, `${mode}: insert marker muted at rest`).toBeLessThan(0.05);

      // Hover the first non-empty insert bar → it turns accent.
      await page.locator(IFRAME_SEL).scrollIntoViewIfNeeded();
      const hovEffC = await (async () => {
        const bar = frame.locator(".zc-insert:not(.zc-insert--empty)").first();
        await bar.hover();
        await page.waitForTimeout(120);
        return frame.evaluate(() => {
          const el = document.querySelector(".zc-insert:not(.zc-insert--empty)") as HTMLElement;
          const cs = getComputedStyle(el);
          const ok = (window as any).__css.oklch;
          return [cs.borderTopColor, cs.color, cs.backgroundColor]
            .map((c) => ok(c))
            .filter(Boolean)
            .reduce((mx: number, o: any) => Math.max(mx, o.C * (o.a == null ? 1 : o.a)), 0);
        });
      })();
      console.log(`CONTRACT: S4 ${mode} .zc-insert hover effChroma=${hovEffC.toFixed(3)} (accent target >= 0.05)`);
      expect(hovEffC, `${mode}: insert marker turns accent on hover`).toBeGreaterThanOrEqual(0.05);
      await quiesce(page);

      // Viewport select leaves the canvas content-box width EQUAL across all
      // four options — only the iframe FRAME inside caps/centres.
      const widths: Record<string, number> = {};
      for (const v of ["fluid", "desktop", "tablet", "mobile"]) {
        await page.locator(".sg-composer-toolbar select").selectOption(v);
        await page.waitForTimeout(120);
        widths[v] = await page.evaluate(() => {
          const host = document.querySelector(".sg-composer-canvas-host") as HTMLElement;
          return parseFloat(getComputedStyle(host).width);
        });
      }
      console.log(
        `CONTRACT: S4 ${mode} canvas-host content width fluid=${widths.fluid} desktop=${widths.desktop} tablet=${widths.tablet} mobile=${widths.mobile}`,
      );
      const vals = Object.values(widths);
      expect(Math.max(...vals) - Math.min(...vals), `${mode}: canvas width invariant across viewports`).toBeLessThanOrEqual(1);
    });
  }

  // ── S5a: chrome — accent census OUTSIDE the iframe at rest (budget <= 3),
  //        neutral resizer hover, the border ladder, 14px inspector label. ──
  for (const mode of MODES) {
    test(`S5a chrome accent census + border ladder — ${mode}`, async ({ page }) => {
      await gotoComposer(page, mode);
      await quiesce(page);

      const runChromeCensus = () =>
        page.evaluate(() => (window as any).__census({ hueMin: 25, hueMax: 100, chromaMin: 0.05 }));
      const logHits = (label: string, hits: any[]) => {
        console.log(`CENSUS: ${label} count=${hits.length}`);
        for (const h of hits) {
          console.log(`CENSUS:   ${label} <${h.tag}${h.id ? "#" + h.id : ""} class="${h.cls}"> "${h.text}" ${h.props}`);
        }
      };

      // Default load auto-selects the root (inspector populated) — realistic view.
      const dfltHits = await runChromeCensus();
      logHits(`S5a chrome-default(auto-selected) ${mode}`, dfltHits);

      // Deselect for the purest chrome reading (no transient selection accent).
      await deselect(page);
      const hits = await runChromeCensus();
      logHits(`S5a chrome-at-rest(nothing-selected) ${mode} [GROUND TRUTH, budget <= 3]`, hits);
      expect(hits.length, `${mode}: chrome accent census at rest <= 3`).toBeLessThanOrEqual(3);

      // Resizer hover → neutral bg.
      const hoverMedia = await page.evaluate(() => window.matchMedia("(hover: hover)").matches);
      await page.locator("[data-sg-composer-tree-resizer]").hover();
      await page.waitForTimeout(80);
      const rz = await page.evaluate(() => {
        const el = document.querySelector("[data-sg-composer-tree-resizer]") as HTMLElement;
        return getComputedStyle(el).backgroundColor;
      });
      const rzO = await oklchOf(page, rz);
      const rzEff = rzO.C * (rzO.a == null ? 1 : rzO.a);
      console.log(
        `CONTRACT: S5a ${mode} resizer hover(hover:hover=${hoverMedia}) bg=${rz} effChroma=${rzEff.toFixed(3)} (neutral target < 0.05)`,
      );
      if (hoverMedia) {
        expect(rzEff, `${mode}: resizer hover is neutral`).toBeLessThan(0.05);
      }
      await quiesce(page);

      // Border ladder: select a node so the inspector populates, then confirm
      // toolbar + toolbar buttons + inspector sections + inspector inputs all
      // resolve to --color-border; and the inspector field label computes 14px.
      await page.locator('[data-sg-tree-node-id="split-1"] .sg-composer-tree-disclosure').first().click();
      await page.locator('[data-sg-tree-node-id="heading-1"]').waitFor({ state: "visible" });
      await page.locator('[data-sg-tree-node-id="heading-1"] .sg-composer-tree-select').first().click();
      await page.locator("#sg-composer-inspector .sg-composer-inspector-section").first().waitFor({ state: "visible" });

      const ladder = await page.evaluate(() => {
        const border = (window as any).__resolveVar("--color-border");
        const cssColor = (sel: string, prop: string) => {
          const el = document.querySelector(sel) as HTMLElement;
          if (!el) return null;
          return (getComputedStyle(el) as any)[prop] as string;
        };
        const label = document.querySelector(
          "#sg-composer-inspector .sg-composer-inspector-section label",
        ) as HTMLElement;
        return {
          border,
          toolbarBottom: cssColor(".sg-composer-toolbar", "borderBottomColor"),
          toolbarButton: cssColor(".sg-composer-toolbar-button", "borderTopColor"),
          inspectorSection: cssColor("#sg-composer-inspector .sg-composer-inspector-section", "borderBottomColor"),
          inspectorInput: cssColor(
            "#sg-composer-inspector .sg-composer-inspector-section input, #sg-composer-inspector .sg-composer-inspector-section select",
            "borderTopColor",
          ),
          labelFont: label ? getComputedStyle(label).fontSize : null,
          labelText: label ? label.textContent : null,
        };
      });
      console.log(
        `CONTRACT: S5a ${mode} border ladder --color-border=${ladder.border} | toolbarBottom=${ladder.toolbarBottom} toolbarButton=${ladder.toolbarButton} inspectorSection=${ladder.inspectorSection} inspectorInput=${ladder.inspectorInput} | inspector label="${ladder.labelText}" font=${ladder.labelFont}`,
      );
      expect(ladder.toolbarBottom, `${mode}: toolbar bottom border == --color-border`).toBe(ladder.border);
      expect(ladder.toolbarButton, `${mode}: toolbar button border == --color-border`).toBe(ladder.border);
      expect(ladder.inspectorSection, `${mode}: inspector section border == --color-border`).toBe(ladder.border);
      if (ladder.inspectorInput) {
        expect(ladder.inspectorInput, `${mode}: inspector input border == --color-border`).toBe(ladder.border);
      }
      expect(ladder.labelFont, `${mode}: inspector field label 14px`).toBe("14px");
    });
  }

  // ── Typography floor: no functional chrome text below 12px anywhere. ──────
  for (const mode of MODES) {
    test(`Typography floor — ${mode}`, async ({ page }) => {
      await gotoComposer(page, mode);
      // Populate the inspector too so its labels are in scope for the scan.
      await page.locator('[data-sg-tree-node-id="split-1"] .sg-composer-tree-disclosure').first().click();
      await page.locator('[data-sg-tree-node-id="heading-1"]').waitFor({ state: "visible" });
      await page.locator('[data-sg-tree-node-id="heading-1"] .sg-composer-tree-select').first().click();
      await page.waitForTimeout(150);

      const scan = await page.evaluate(() => {
        const iframe = document.querySelector(".sg-composer-canvas-frame iframe");
        const skip = { SCRIPT: 1, STYLE: 1, HEAD: 1, TITLE: 1, META: 1, LINK: 1, NOSCRIPT: 1 };
        const offenders: { tag: string; cls: string; text: string; font: number }[] = [];
        let min = Infinity;
        const all = document.querySelectorAll("*");
        for (let i = 0; i < all.length; i++) {
          const el = all[i] as HTMLElement;
          if ((skip as any)[el.tagName]) continue;
          if (iframe && iframe.contains(el)) continue; // iframe content is out of scope
          // sr-only visually-hidden text is not functional chrome.
          const cls = el.getAttribute("class") || "";
          if (cls.split(/\s+/).includes("sr-only")) continue;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
          // Only elements with their OWN visible text.
          let ownText = "";
          for (let n = 0; n < el.childNodes.length; n++) {
            const cn = el.childNodes[n];
            if (cn.nodeType === 3) ownText += cn.textContent;
          }
          if (ownText.trim().length === 0) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          const fs = parseFloat(cs.fontSize);
          if (fs < min) min = fs;
          if (fs < 12) {
            offenders.push({ tag: el.tagName.toLowerCase(), cls: cls.slice(0, 60), text: ownText.trim().slice(0, 24), font: fs });
          }
        }
        return { min, offenders };
      });
      console.log(
        `CONTRACT: Typography floor ${mode} min chrome font=${scan.min}px | offenders(<12px)=${scan.offenders.length}`,
      );
      for (const o of scan.offenders) {
        console.log(`CONTRACT:   floor ${mode} OFFENDER <${o.tag} class="${o.cls}"> "${o.text}" ${o.font}px`);
      }
      expect(scan.offenders.length, `${mode}: no functional chrome text < 12px`).toBe(0);
    });
  }

  // ── Narrow (~900px) — no horizontal overflow, both modes. ─────────────────
  for (const mode of MODES) {
    test(`Narrow ~900px no horizontal overflow — ${mode}`, async ({ page }) => {
      await page.setViewportSize({ width: 900, height: 900 });
      await gotoComposer(page, mode);
      const ov = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
      }));
      console.log(`CONTRACT: Narrow ${mode} 900px scrollW=${ov.scrollW} innerW=${ov.innerW}`);
      expect(ov.scrollW, `${mode}: no horizontal overflow at 900px`).toBeLessThanOrEqual(ov.innerW + 1);
    });
  }
});
