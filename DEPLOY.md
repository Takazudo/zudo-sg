# Deploy Prerequisites

One-time setup required before the CI workflows can deploy to Cloudflare Workers.

## Sites

| Worker name | Custom domain | Config |
|---|---|---|
| `zudo-sg` | `zudo-sg.takazudomodular.com` | `wrangler.toml` |
| `zudo-sg-demo-site` | `zudo-sg-demo-site.takazudomodular.com` | `apps/demo/wrangler.toml` |

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

## 3. DNS CNAME records

For each custom domain, add a CNAME record in your DNS zone (`takazudomodular.com`):

| Name | Type | Target |
|---|---|---|
| `zudo-sg` | CNAME | `zudo-sg.<your-account-subdomain>.workers.dev` |
| `zudo-sg-demo-site` | CNAME | `zudo-sg-demo-site.<your-account-subdomain>.workers.dev` |

With `custom_domain = true` in `wrangler.toml`, wrangler handles the Workers route binding automatically on first deploy. The CNAME just needs to exist so DNS resolves to Cloudflare.

Alternatively, Cloudflare can manage DNS for the zone — in that case wrangler creates the CNAME record automatically on first deploy.

---

## 4. First deploy

Push to `main` to trigger `main-deploy.yml`. On the very first deploy, wrangler provisions the Workers and creates the custom domain bindings. Subsequent pushes to `main` update both Workers in parallel.

---

## 5. Validate wrangler configs locally (dry-run)

```sh
# Validate root site config
npx wrangler@4.85.0 deploy --dry-run --config wrangler.toml

# Validate demo site config
npx wrangler@4.85.0 deploy --dry-run --config apps/demo/wrangler.toml
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
