import { render } from "preact";
import { useEffect } from "preact/hooks";
import { ProseMd } from "@zudo-sg/ui";
import { componentPackManifest, componentRuntimeRegistry } from "@zudo-sg/ui/composer-pack";
import * as publicUi from "@zudo-sg/ui";
import { GeneratedComposition } from "./generated-composition";
import "./styles.css";

const MARKDOWN = [
  "## Provider markdown",
  "",
  "```ts",
  "const provider = 'ready';",
  "```",
].join("\n");

function runtimeIdentity(): boolean {
  return componentPackManifest.components.every((entry) =>
    componentRuntimeRegistry.components[entry.id]?.component ===
      publicUi[entry.source.exportName as keyof typeof publicUi],
  );
}

function ProofPanel({ theme }: { theme: "light" | "dark" }) {
  return (
    <section class="proof-panel" data-proof-theme={theme} data-testid={`${theme}-panel`}>
      <GeneratedComposition theme={theme} />
      <ProseMd markdown={MARKDOWN} />
    </section>
  );
}

function App() {
  useEffect(() => {
    let live = true;
    const inspect = () => {
      if (!live) return;
      const light = document.querySelector<HTMLElement>('[data-proof-theme="light"]');
      const dark = document.querySelector<HTMLElement>('[data-proof-theme="dark"]');
      const lightKeyword = light?.querySelector<HTMLElement>(".hi-kw");
      const darkKeyword = dark?.querySelector<HTMLElement>(".hi-kw");
      const lightPre = light?.querySelector<HTMLElement>("pre.hi-root");
      const darkPre = dark?.querySelector<HTMLElement>("pre.hi-root");
      const grid = document.querySelector<HTMLElement>('[aria-label="Generated provider grid"]');
      if (!lightKeyword || !darkKeyword || !lightPre || !darkPre || !grid) {
        window.setTimeout(inspect, 25);
        return;
      }
      const proof = {
        runtimeIdentity: runtimeIdentity(),
        componentCount: componentPackManifest.components.length,
        wasmHighlight: lightKeyword.textContent === "const" && darkKeyword.textContent === "const",
        utilityGrid: getComputedStyle(grid).gridTemplateColumns.includes("minmax(13rem, 1fr)"),
        lightKeyword: getComputedStyle(lightKeyword).color,
        darkKeyword: getComputedStyle(darkKeyword).color,
        lightBackground: getComputedStyle(lightPre).backgroundColor,
        darkBackground: getComputedStyle(darkPre).backgroundColor,
      };
      const success =
        proof.runtimeIdentity &&
        proof.componentCount === 12 &&
        proof.wasmHighlight &&
        proof.utilityGrid &&
        proof.lightKeyword !== proof.darkKeyword &&
        proof.lightBackground !== proof.darkBackground;
      document.body.dataset.providerProof = success ? "passed" : "failed";
      const target = document.querySelector("#proof-result");
      if (target) target.textContent = JSON.stringify(proof, null, 2);
    };
    inspect();
    return () => { live = false; };
  }, []);

  return (
    <main>
      <h1>UI provider conformance</h1>
      <pre id="proof-result">waiting</pre>
      <div class="proof-grid">
        <ProofPanel theme="light" />
        <ProofPanel theme="dark" />
      </div>
    </main>
  );
}

render(<App />, document.querySelector("#app")!);
