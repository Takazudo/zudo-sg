import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { createStaticPreviewServer } from '../../../scripts/lib/playwright-e2e-server.mjs';
const projectRoot = resolve(import.meta.dirname, '../../..');
const root = createStaticPreviewServer({entry: 'root', projectRoot});
const demo = createStaticPreviewServer({entry: 'demo', projectRoot, distPath: 'apps/demo/dist', command: 'pnpm --filter @zudo-sg/demo exec zfb preview --port {port}'});
export default defineConfig({testDir: '.', testMatch: 'behavior.spec.ts', workers: 1, reporter: 'list', webServer: [root.webServer, demo.webServer], projects: [
  {name: 'root', testMatch: 'behavior.spec.ts', use: {baseURL: root.origin}},
  {name: 'demo', testMatch: 'behavior.spec.ts', use: {baseURL: demo.origin}},
]});
