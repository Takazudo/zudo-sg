# Deploy Prerequisites

One-time setup required before the CI workflows can deploy to Cloudflare Workers.

## Sites

| Worker name | Custom domain | Config |
|---|---|---|
| `zudo-sg` | `zudo-sg.takazudomodular.com` | `wrangler.toml` |
| `zudo-sg-demo-site` | `zudo-sg-demo-site.takazudomodular.com` | `apps/demo/wrangler.toml` |
| `zudo-sg-doc` | `zudo-sg-doc.takazudomodular.com` | `doc/wrangler.toml` |

All three sites are fully static (no SSR). If an SSR route (`prerender = false`) is added later, wire `@takazudo/zfb-adapter-cloudflare` in the relevant `zfb.config.ts`, add `main = "./dist/_worker.js"` and `compatibility_flags = ["nodejs_compat"]` to the corresponding `wrangler.toml`, and add the `.assetsignore` write step before the `wrangler deploy` call in the workflow (see reference in `zudo-doc`'s `main-deploy.yml`).

---

## 1. Cloudflare account ID

Find your account ID in the Cloudflare dashboard (right sidebar on the Workers overview page) or via:

```sh
npx wrangler@4.85.0 whoami
```

> The version above (and in §5) is a local-shell copy for convenience. The
> source of truth is the `WRANGLER_VERSION` env var in `main-deploy.yml` and
> `preview-deploy.yml` — bump the workflow env vars and every local command
> example in this file together.

Add it as a GitHub Actions secret named `CLOUDFLARE_ACCOUNT_ID`.

---

## Deploy identity — keeping these files in sync

Each site's Worker name + custom domain (`zudo-sg` / `zudo-sg-demo-site` / `zudo-sg-doc`,
all under `takazudomodular.com`) is declared once per `wrangler.toml` but repeated in prose
and CI in several other places. There's no build-time derivation (e.g. generating the smoke
URLs or the doc table below from `wrangler.toml`) — that's a longer-term option, not something
this checklist implements. If a Worker name or domain ever changes, update every file below by hand:

- `wrangler.toml`, `apps/demo/wrangler.toml`, `doc/wrangler.toml` — source of truth: `name =`
  and `[[routes]] pattern = "<name>.takazudomodular.com"`
- `DEPLOY.md` (this file) — the Sites table (§Sites) and the DNS records table (§3)
- `.github/workflows/main-deploy.yml` — the header comment (lines 6–8) and every
  `scripts/smoke-url.sh` URL argument
- `.github/workflows/preview-deploy.yml` — the header comment's `preview-zudo-sg.<acct>.workers.dev`
  example (only illustrates the root Worker's preview alias naming, not the demo/doc names)
- `README.md` — the four-artifact bullet list under "What this is"
- `CLAUDE.md` (root) — the one-line mention of the doc site's deployed URL
- `doc/src/content/docs/development/deploy.mdx` — the "Public sites" table, which mirrors
  this file's Sites table

Intentionally **not** tracked here (found via the same search, out of scope for this checklist):

- `apps/demo/layouts/site-layout.tsx`, `src/config/settings.ts`, `doc/src/config/settings.ts` —
  these consume a domain for a nav link or `siteUrl` config value; a stale one surfaces as a
  broken link or wrong canonical URL, not a deploy failure, so they're app code, not deploy config
- `doc/src/content/docs/architecture/monorepo-layout.mdx`, `doc/src/content/docs/getting-started/installation.mdx`,
  `doc/src/content/docs/getting-started/introduction.mdx` — narrative prose that mentions a
  domain in passing, not a mapping table that needs active upkeep
- `doc/src/content/docs/architecture/design-tokens.mdx` — matches on `takazudomodular.com` but
  for `zudo-css-wisdom.takazudomodular.com`, an unrelated external site

---

## 2. API token

Create a Cloudflare API token with the **Workers Scripts:Edit** permission:

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token** → use the **Edit Cloudflare Workers** template
3. Scope it to your account (or restrict to the three Workers if preferred)
4. Copy the token value

Add it as a GitHub Actions secret named `CLOUDFLARE_API_TOKEN`.

---

## 3. DNS records — no manual step

**There is no manual DNS step.** Because the `takazudomodular.com` zone is managed by Cloudflare and each `wrangler.toml` declares its custom domain with `custom_domain = true`, `wrangler deploy` (run by CI) creates the DNS record **and** provisions the TLS cert for that hostname automatically on the first deploy — there is nothing to add in the dashboard.

| Worker | Custom domain | Created by |
|---|---|---|
| `zudo-sg` | `zudo-sg.takazudomodular.com` | `wrangler deploy` (auto) |
| `zudo-sg-demo-site` | `zudo-sg-demo-site.takazudomodular.com` | `wrangler deploy` (auto) |
| `zudo-sg-doc` | `zudo-sg-doc.takazudomodular.com` | `wrangler deploy` (auto) |

The `CLOUDFLARE_API_TOKEN` (§2) must be able to manage the zone's DNS for this auto-provisioning to succeed — the **Edit Cloudflare Workers** template scoped to the account + the `takazudomodular.com` zone covers it (this is what the configured token already has for the existing deployments; the doc Worker uses the same permission shape).

---

## 4. First deploy

Push to `main` to trigger `main-deploy.yml`. On the very first deploy, wrangler provisions the Workers, creates the custom domain bindings, and creates the DNS records + TLS certs (§3). Subsequent pushes to `main` update all three Workers in parallel.

DNS + cert propagation on that first deploy is not instant (it can take a minute or two before the hostname resolves), so the post-deploy smoke gates retry with backoff via `scripts/smoke-url.sh` instead of failing on the first `curl`. A first deploy is therefore green once provisioning completes, not red on the propagation window.

---

## 5. Validate wrangler configs locally (dry-run)

```sh
# Validate root site config
npx wrangler@4.85.0 deploy --dry-run --config wrangler.toml

# Validate demo site config
npx wrangler@4.85.0 deploy --dry-run --config apps/demo/wrangler.toml

# Validate doc site config
npx wrangler@4.85.0 deploy --dry-run --config doc/wrangler.toml
```

> See the note on the pinned version in §1 — keep this in step with
> `WRANGLER_VERSION` in the workflows.

`--dry-run` validates the config and reports what would be deployed without sending anything to Cloudflare. It does not require credentials. If wrangler prompts for auth even with `--dry-run`, validate the TOML syntax instead:

```sh
# Parse TOML and print (requires toml parser — or just open the file and check manually)
node -e "
const fs = require('fs');
// TOML is valid if this does not throw
console.log('wrangler.toml — checking syntax via node');
const content = fs.readFileSync('wrangler.toml', 'utf8');
console.log(content);
"
```

All configs are intentionally minimal (no `main`, no `nodejs_compat`) because all three sites are static.
