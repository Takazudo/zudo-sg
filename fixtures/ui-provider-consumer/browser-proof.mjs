import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const origin = "http://127.0.0.1:4178";
const server = spawn("corepack", ["pnpm", "exec", "vite", "preview", "--host", "127.0.0.1", "--port", "4178", "--strictPort"], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk; });
server.stderr.on("data", (chunk) => { serverOutput += chunk; });

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite preview exited early:\n${serverOutput}`);
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for Vite preview:\n${serverOutput}`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => ["passed", "failed"].includes(document.body.dataset.providerProof ?? ""),
    undefined,
    { timeout: 30_000 },
  );
  const result = await page.evaluate(() => ({
    status: document.body.dataset.providerProof,
    proof: JSON.parse(document.querySelector("#proof-result")?.textContent ?? "null"),
  }));
  await page.screenshot({ path: "provider-proof.png", fullPage: true });
  await writeFile("browser-proof.json", `${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "passed") throw new Error(`Provider browser proof failed: ${JSON.stringify(result.proof)}`);
  if (pageErrors.length) throw new Error(`Provider browser emitted errors: ${pageErrors.join(" | ")}`);
  console.log(`Browser proof passed: ${JSON.stringify(result.proof)}`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
