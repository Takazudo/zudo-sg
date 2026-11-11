import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { withBase } from "../src/utils/base";

async function workerVersion(page: Page) {
  return page.evaluate(async (scope) => {
    const registration = await navigator.serviceWorker.getRegistration(new URL(scope, location.origin).href);
    const worker = registration?.active;
    if (!worker) throw new Error("No active preview worker");
    return new Promise<{ packageVersion: string; checksum: string }>((resolve, reject) => {
      const timeout = setTimeout(() => { navigator.serviceWorker.removeEventListener("message", receive); reject(new Error("No worker integrity response")); }, 3000);
      function receive(event: MessageEvent) {
        if (event.source !== worker || event.data?.type !== "INTEGRITY_CHECK_RESPONSE") return;
        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener("message", receive);
        resolve(event.data.payload);
      }
      navigator.serviceWorker.addEventListener("message", receive);
      worker.postMessage("INTEGRITY_CHECK_REQUEST");
    });
  }, withBase("/preview/"));
}

async function ready(page: Page) {
  await expect(page.getByRole("button", { name: "Success demo", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain(withBase("/mockServiceWorker.js"));
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration(location.href))?.scope))
    .toBe(new URL(withBase("/preview/"), page.url()).href);
}

async function reviewEntry(page: Page) {
  await page.locator('[name="purpose"]').selectOption("product");
  await page.locator('[name="name"]').fill("Preview tester");
  await page.locator('[name="email"]').fill("preview@example.test");
  await page.locator('[name="message"]').fill("A real fetch intercepted by the installed worker.");
  await page.getByRole("button", { name: "Review my entry" }).click();
  await expect(page.locator('[data-contact-panel="confirm"]')).toBeVisible();
}

function diagnostics(page: Page) {
  const unexpected: string[] = [];
  const expected500: string[] = [];
  page.on("pageerror", (error) => unexpected.push(error.message));
  page.on("requestfailed", (request) => unexpected.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    // Chromium reports the intentional HTTP 500 as a console error at this URL.
    if (message.type() === "error" && message.location().url.endsWith(withBase("/preview/api/contact-demo/send-fail")) && /500/.test(message.text())) return;
    unexpected.push(`${message.type()}: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    if (response.status() === 500 && response.url().endsWith(withBase("/preview/api/contact-demo/send-fail"))) expected500.push(response.url());
    else unexpected.push(`${response.status()} ${response.url()}`);
  });
  return { unexpected, expected500 };
}

test("contact preview MSW: real worker success, failure retry, reset, bypass and navigation isolation", async ({ page }) => {
  const evidence = diagnostics(page);
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/preview/api/contact-demo/")) posts.push(request.url());
  });
  await page.goto(withBase("/preview/contact"));
  await ready(page);
  expect(await workerVersion(page)).toEqual({ packageVersion: "3.0.4", checksum: "0bd5af64c8dc112df5e0c5e9c8a2b15a" });
  await reviewEntry(page);
  const sent = page.waitForResponse((response) => response.url().endsWith(withBase("/preview/api/contact-demo/send")) && response.request().method() === "POST");
  await page.getByRole("button", { name: "Send this", exact: true }).click();
  expect((await sent).status()).toBe(200);
  expect(await (await sent).json()).toEqual({ ok: true });
  await expect(page.locator('[data-contact-panel="complete"]')).toBeVisible();

  await page.getByRole("button", { name: "5xx-recovery demo" }).click();
  await expect(page.locator('[data-contact-panel="input"]')).toBeVisible();
  await expect(page.locator('[name="name"]')).toHaveValue("");
  await reviewEntry(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    const failed = page.waitForResponse((response) => response.status() === 500 && response.url().endsWith(withBase("/preview/api/contact-demo/send-fail")));
    await page.getByRole("button", { name: "Send this", exact: true }).click();
    await failed;
    await expect(page.locator('[data-contact-error]')).toHaveText("Server rejected the request (mocked failure).");
    await expect(page.locator('[data-contact-panel="confirm"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Send this", exact: true })).toBeEnabled();
  }
  expect(posts).toHaveLength(3);
  expect(evidence.expected500).toHaveLength(2);

  const bypass = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return { status: response.status, text: await response.text() };
  }, withBase("/robots.txt"));
  expect(bypass.status).toBe(200);
  expect(bypass.text).toContain("User-agent:");

  await page.getByRole("button", { name: "Success demo", exact: true }).click();
  await expect(page.locator('[name="name"]')).toHaveValue("");
  await page.goto(withBase("/"));
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
  await page.goto(withBase("/preview/contact"));
  await ready(page);
  await reviewEntry(page);
  await page.getByRole("button", { name: "Send this", exact: true }).click();
  await expect(page.locator('[data-contact-panel="complete"]')).toBeVisible();
  expect(posts).toHaveLength(4);
  expect(evidence.unexpected).toEqual([]);
});


test("contact preview MSW: upgrades an existing MSW 2 registration before handling requests", async ({ page, context }) => {
  const legacyWorker = readFileSync(new URL("./fixtures/msw-2.15.0-worker.js", import.meta.url), "utf8");
  // Only the worker asset is seeded; all contact responses come from real MSW.
  await context.route("**/mockServiceWorker.js", (route) => route.fulfill({
    status: 200, contentType: "application/javascript", body: legacyWorker,
  }));
  await page.goto(withBase("/"));
  await page.evaluate(async ({ url, scope }) => {
    const registration = await navigator.serviceWorker.register(url, { scope, updateViaCache: "none" });
    const worker = registration.installing ?? registration.waiting ?? registration.active;
    if (!worker) throw new Error("No legacy worker");
    if (worker.state !== "activated") await new Promise<void>((resolve) => worker.addEventListener("statechange", () => {
      if (worker.state === "activated") resolve();
    }));
  }, { url: withBase("/mockServiceWorker.js"), scope: withBase("/preview/") });
  expect((await workerVersion(page)).packageVersion).toBe("2.15.0");
  await context.unroute("**/mockServiceWorker.js");
  const evidence = diagnostics(page);
  await page.goto(withBase("/preview/contact"));
  await ready(page);
  expect(await workerVersion(page)).toEqual({ packageVersion: "3.0.4", checksum: "0bd5af64c8dc112df5e0c5e9c8a2b15a" });
  await reviewEntry(page);
  await page.getByRole("button", { name: "Send this", exact: true }).click();
  await expect(page.locator('[data-contact-panel="complete"]')).toBeVisible();
  expect(evidence.unexpected).toEqual([]);
});


test("contact preview MSW: recovers after registration fails before network enable", async ({ page }) => {
  await page.addInitScript(() => {
    const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = (...args) => {
      if (!sessionStorage.getItem("contact-registration-failed")) {
        sessionStorage.setItem("contact-registration-failed", "yes");
        return Promise.reject(new Error("Simulated registration denial"));
      }
      return register(...args);
    };
  });
  const evidence = diagnostics(page);
  await page.goto(withBase("/preview/contact"));
  await expect(page.getByRole("alert")).toContainText("Simulated registration denial");
  await expect(page.locator('[data-contact-form]')).toHaveCount(0);
  await page.reload();
  await ready(page);
  await reviewEntry(page);
  await page.getByRole("button", { name: "Send this", exact: true }).click();
  await expect(page.locator('[data-contact-panel="complete"]')).toBeVisible();
  expect(evidence.unexpected).toEqual([]);
});
