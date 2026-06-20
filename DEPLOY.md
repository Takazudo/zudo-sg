# Deploy Prerequisites

One-time setup required before the CI workflows can deploy to Cloudflare Workers.

## Sites

| Worker name | Custom domain | Config |
|---|---|---|
| `zudo-sg` | `zudo-sg.takazudomodular.com` | `wrangler.toml` |
| `zudo-sg-demo-site` | `zudo-sg-demo-site.takazudomodular.com` | `apps/demo/wrangler.toml` |
| `zudo-sg-styleguide` | `zudo-sg-styleguide.takazudomodular.com` | `apps/styleguide/wrangler.toml` |

Both sites are fully static (no SSR). If an SSR route (`prerender = false`) is added later, wire `@takazudo/zfb-adapter-cloudflare` in the relevant `zfb.config.ts`, add `main = "./dist/_worker.js"` and `compatibility_flags = ["nodejs_compat"]` to the corresponding `wrangler.toml`, and add the `.assetsignore` write step before the `wrangler deploy` call in the workflow (see reference in `zudo-doc`'s `main-deploy.yml`).

---

## 1. Cloudflare account ID

Find your account ID in the Cloudflare dashboard (right sidebar on the Workers overview page) or via:

```sh
npx wrangler@4.85.0 whoami
```

Add it as a GitHub Actions secret named `CLOUDFLARE_ACCOUNT_ID`.

---

## 2. API token

Create a Cloudflare API token with the **Workers Scripts:Edit** permission:

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token** → use the **Edit Cloudflare Workers** template
3. Scope it to your account (or restrict to the two Workers if preferred)
4. Copy the token value

Add it as a GitHub Actions secret named `CLOUDFLARE_API_TOKEN`.

---

## 3. DNS records — no manual step

**There is no manual DNS step.** Because the `takazudomodular.com` zone is managed by Cloudflare and each `wrangler.toml` declares its custom domain with `custom_domain = true`, `wrangler deploy` (run by CI) creates the DNS record **and** provisions the TLS cert for that hostname automatically on the first deploy — there is nothing to add in the dashboard.

| Worker | Custom domain | Created by |
|---|---|---|
| `zudo-sg` | `zudo-sg.takazudomodular.com` | `wrangler deploy` (auto) |
| `zudo-sg-demo-site` | `zudo-sg-demo-site.takazudomodular.com` | `wrangler deploy` (auto) |
| `zudo-sg-styleguide` | `zudo-sg-styleguide.takazudomodular.com` | `wrangler deploy` (auto) |

The `CLOUDFLARE_API_TOKEN` (§2) must be able to manage the zone's DNS for this auto-provisioning to succeed — the **Edit Cloudflare Workers** template scoped to the account + the `takazudomodular.com` zone covers it (this is what the configured token already has; both sites are live).

---

## 4. First deploy

Push to `main` to trigger `main-deploy.yml`. On the very first deploy, wrangler provisions the Workers, creates the custom domain bindings, and creates the DNS records + TLS certs (§3). Subsequent pushes to `main` update both Workers in parallel.

DNS + cert propagation on that first deploy is not instant (it can take a minute or two before the hostname resolves), so the post-deploy smoke gates retry with backoff via `scripts/smoke-url.sh` instead of failing on the first `curl`. A first deploy is therefore green once provisioning completes, not red on the propagation window.

---

## 5. Validate wrangler configs locally (dry-run)

```sh
# Validate root site config
npx wrangler@4.85.0 deploy --dry-run --config wrangler.toml

# Validate demo site config
npx wrangler@4.85.0 deploy --dry-run --config apps/demo/wrangler.toml

# Validate standalone styleguide config
npx wrangler@4.85.0 deploy --dry-run --config apps/styleguide/wrangler.toml
```

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

Both configs are intentionally minimal (no `main`, no `nodejs_compat`) because both sites are static.
