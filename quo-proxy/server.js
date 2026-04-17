#!/usr/bin/env node
/**
 * Railway-hosted CORS proxy for Quo (OpenPhone) API.
 *
 * Env vars (set in Railway → Variables):
 *   QUO_API_KEY         (required)  Your Quo/OpenPhone API key. Raw, no "Bearer".
 *   ALLOWED_ORIGINS     (required)  Comma-separated list of allowed Origin headers.
 *                                   Example: "https://omri-i-b.github.io,http://localhost:8000"
 *   PORT                (auto)      Injected by Railway.
 *
 * Endpoint:
 *   GET /v1/*   → proxies to https://api.openphone.com/v1/*
 *                 with the Authorization header injected server-side.
 *   GET /healthz → 200 OK (Railway health check).
 *
 * Safety:
 *   - Only GET is proxied. Everything else returns 405.
 *   - Origin must match ALLOWED_ORIGINS exactly (no wildcard in prod).
 *   - The Quo API key never leaves the server.
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '8787', 10);
const KEY = process.env.QUO_API_KEY;
const RAW_ALLOWED = (process.env.ALLOWED_ORIGINS || '').trim();
const ALLOWED_ORIGINS = RAW_ALLOWED ? RAW_ALLOWED.split(',').map(s => s.trim()).filter(Boolean) : [];
const UPSTREAM = 'https://api.openphone.com';

if (!KEY) {
  console.error('FATAL: Missing QUO_API_KEY env var.');
  process.exit(1);
}
if (!ALLOWED_ORIGINS.length) {
  console.warn('WARN: ALLOWED_ORIGINS not set — the proxy will reject every browser request.');
  console.warn('      Set it in Railway to e.g. "https://omri-i-b.github.io,http://localhost:8000"');
}

function resolveCors(origin) {
  // Exact-match against ALLOWED_ORIGINS. Returns the origin to echo, or null.
  if (!origin) return null;
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

http.createServer((req, res) => {
  // Health check — no CORS needed.
  if (req.url === '/healthz' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      allowedOrigins: ALLOWED_ORIGINS.length,
      upstream: UPSTREAM,
    }));
    return;
  }

  const origin = req.headers.origin;
  const allowed = resolveCors(origin);

  // CORS preflight — must echo the exact origin.
  if (req.method === 'OPTIONS') {
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', allowed);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'content-type,accept');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    res.writeHead(204);
    res.end();
    return;
  }

  // Only GET is proxied.
  if (req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Only GET is proxied.' }));
    return;
  }

  // If the browser sent a disallowed Origin, refuse early (never forward).
  if (origin && !allowed) {
    res.writeHead(403, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Origin not allowed.', origin }));
    return;
  }

  // Only forward paths under /v1/
  if (!req.url.startsWith('/v1/')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unknown path. Try /v1/phone-numbers' }));
    return;
  }

  const upstreamUrl = new URL(UPSTREAM + req.url);
  const options = {
    hostname: upstreamUrl.hostname,
    port: 443,
    path: upstreamUrl.pathname + upstreamUrl.search,
    method: 'GET',
    headers: {
      'Authorization': KEY,       // OpenPhone wants the raw key, no "Bearer"
      'Accept': 'application/json',
      'User-Agent': 'ccm-demo-proxy/1.0 (+railway)',
    },
  };

  const upstream = https.request(options, up => {
    const headers = { ...up.headers };
    delete headers['transfer-encoding'];
    // Strip upstream CSP/COEP that browsers would honor and break the page,
    // then add our CORS headers last so they win.
    delete headers['content-security-policy'];
    delete headers['cross-origin-opener-policy'];
    delete headers['cross-origin-resource-policy'];
    delete headers['cross-origin-embedder-policy'];
    if (allowed) {
      headers['access-control-allow-origin'] = allowed;
      headers['vary'] = 'Origin';
    }
    res.writeHead(up.statusCode || 502, headers);
    up.pipe(res);
  });
  upstream.on('error', err => {
    console.error('upstream error:', err.message);
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', allowed);
      res.setHeader('Vary', 'Origin');
    }
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'upstream failed', detail: err.message }));
  });
  upstream.end();
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Quo proxy listening on 0.0.0.0:${PORT}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ') || '(none — will reject all browser requests)'}`);
  console.log(`Upstream: ${UPSTREAM}`);
});
