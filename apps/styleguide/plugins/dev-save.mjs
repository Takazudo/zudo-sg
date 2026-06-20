/**
 * dev-save — zfb consumer plugin that registers a dev-only POST `/api/save-source`
 * endpoint. When the CodeMirror code-panel editor edits a story source file and the
 * user clicks Save, it POSTs `{ relativePath, content }` here; the plugin writes
 * the file to disk and zfb's dev server picks up the change.
 *
 * The `relativePath` field contains a registry key of the form `./ui/src/<name>/<name>.stories.tsx`
 * (as stored in `StoryEntry.path`). The plugin maps it to the actual on-disk path
 * inside `packages/ui/src/` and guards that the resolved path stays within that
 * directory.
 *
 * ## Why a zfb `devMiddleware` plugin, NOT a Vite plugin
 * zfb's dev server is a Rust-side axum host, not Vite. Plugins register HTTP
 * handlers via the `devMiddleware` hook's `register()` callback — the zfb-native
 * equivalent of Vite's `configureServer`. This is structurally dev-only: the
 * `devMiddleware` hook is never dispatched from `zfb build`, so this endpoint is
 * absent from the deployed static build entirely.
 *
 * ## Security
 * The resolved absolute path must reside inside `packages/ui/src/` (a sibling
 * package in the monorepo). Paths that escape this directory are rejected with 403.
 *
 * ## Prefix-match note
 * zfb's `register(path, handler)` matches `path` as an exact prefix. The handler
 * asserts an exact URL match (after stripping the query string) and returns
 * `undefined` (passthrough) otherwise, so the dev server's 404 fires.
 */

import { writeFile } from 'node:fs/promises';
import { resolve, normalize, sep } from 'node:path';

const SAVE_PATH = '/api/save-source';
const MAX_BODY = 2 * 1024 * 1024; // 2 MB

// Registry keys use a `./ui/src/...` prefix that maps to packages/ui/src/ in the
// monorepo. Strip this prefix to obtain the package-relative path.
const REGISTRY_PREFIX = './ui/';

function jsonResponse(data, status = 200) {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  };
}

/** Path portion of `req.url` (drops `?query` / `#fragment`). */
function pathOf(reqUrl) {
  const qIdx = reqUrl.indexOf('?');
  const hashIdx = reqUrl.indexOf('#');
  let end = reqUrl.length;
  if (qIdx >= 0) end = Math.min(end, qIdx);
  if (hashIdx >= 0) end = Math.min(end, hashIdx);
  return reqUrl.slice(0, end);
}

export default {
  name: 'sg-dev-save',
  devMiddleware({ projectRoot, register, logger }) {
    // packages/ui/src/ is two levels up from apps/styleguide (projectRoot),
    // then into packages/ui/src/.
    const UI_SRC_DIR = normalize(resolve(projectRoot, '../../packages/ui/src'));

    register(SAVE_PATH, async (req) => {
      // Exact-prefix match: only handle the exact URL, passthrough sub-paths.
      if (pathOf(req.url) !== SAVE_PATH) return undefined;
      if (req.method !== 'POST') {
        return { status: 405, headers: { allow: 'POST' }, body: 'Method Not Allowed' };
      }

      const raw = req.body ?? '';
      if (raw.length > MAX_BODY) {
        return jsonResponse({ error: 'Payload too large' }, 413);
      }

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return jsonResponse({ error: 'Invalid JSON' }, 400);
      }

      const { relativePath, content } = parsed ?? {};
      if (typeof relativePath !== 'string' || typeof content !== 'string') {
        return jsonResponse({ error: 'Missing relativePath or content' }, 400);
      }

      // Registry keys start with `./ui/` — strip that prefix to get the path
      // relative to packages/ui/.
      if (!relativePath.startsWith(REGISTRY_PREFIX)) {
        return jsonResponse({ error: 'Unrecognised path prefix' }, 400);
      }
      const packageRelPath = relativePath.slice(REGISTRY_PREFIX.length);
      const absPath = normalize(resolve(UI_SRC_DIR, '..', packageRelPath));

      // Security: the resolved path must be inside packages/ui/src/.
      if (!absPath.startsWith(UI_SRC_DIR + sep)) {
        return jsonResponse({ error: 'Path outside ui/src directory' }, 403);
      }

      try {
        await writeFile(absPath, content, 'utf-8');
        logger.info(`sg-dev-save: wrote ${absPath}`);
        return jsonResponse({ ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`sg-dev-save: write failed: ${message}`);
        return jsonResponse({ error: 'Write failed' }, 500);
      }
    });

    logger.info(`sg-dev-save: registered POST ${SAVE_PATH}`);
  },
};
