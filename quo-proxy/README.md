# Quo Proxy (Railway)

Small Node server that sits between the CCM demo page and the Quo / OpenPhone API.

## What it does

- The browser page at `omri-i-b.github.io/surveyhealth-wireframes/demo-ccm/call/claire/` polls Quo for the latest call.
- Quo doesn't send CORS headers, so the browser can't call it directly.
- This proxy:
  - Injects the `Authorization: <KEY>` header server-side (the key never leaves Railway)
  - Adds CORS headers scoped to an allow-list of origins
  - Only forwards `GET /v1/*` — everything else returns 404/405

## Deploy

### One-time setup

1. Create a new Railway project.
2. Deploy this `quo-proxy/` folder (either via `railway up` from this dir, or by connecting the repo and setting the root to `quo-proxy`).
3. In Railway → **Variables**, add:
   - `QUO_API_KEY` — your raw Quo key (no `Bearer` prefix)
   - `ALLOWED_ORIGINS` — comma-separated, e.g.
     `https://omri-i-b.github.io,http://localhost:8000`
4. Railway will give you a public URL like `https://ccm-demo-quo-proxy-production.up.railway.app`.
5. Check health: `curl https://<your-railway-url>/healthz`
   Should return `{"ok":true,"allowedOrigins":2,"upstream":"https://api.openphone.com"}`
6. In Claire's demo page → gear icon → **Quo API base URL** = `https://<your-railway-url>/v1` and Save.

### CLI deploy from this folder

```bash
cd quo-proxy
railway login
railway link        # pick or create a project
railway up          # deploys
railway variables set QUO_API_KEY=<key>
railway variables set ALLOWED_ORIGINS=https://omri-i-b.github.io,http://localhost:8000
railway domain      # prints the public URL
```

## Security

- The Quo key is only in Railway env vars. It's never in the repo, never sent to the browser.
- `ALLOWED_ORIGINS` is an exact-match allow-list — unknown origins get a 403 before we ever touch Quo.
- Only `GET` passes through. Only `/v1/*` paths pass through.
- Rotate the Quo key if it's ever exposed; `railway variables set QUO_API_KEY=<newkey>` redeploys.
