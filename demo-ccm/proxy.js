#!/usr/bin/env node
/**
 * Tiny CORS proxy for OpenPhone (branded "Quo") API.
 *
 * OpenPhone does not expose CORS headers, so browser `fetch` to api.openphone.com
 * from localhost will fail. This proxy injects the Authorization header and
 * permissive CORS headers so the Claire demo page can poll it.
 *
 * Usage:
 *   export QUO_API_KEY=your_key_here
 *   node demo-ccm/proxy.js
 *
 * Then in Claire's page → Quo settings → set
 *   Quo API base URL = http://localhost:8787/v1
 *
 * Security:
 *   - The API key NEVER appears in files or browser.
 *   - Proxy only listens on localhost (127.0.0.1) and only forwards GET.
 *   - Kill the proxy after the demo.
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8787;
const KEY = process.env.QUO_API_KEY;
const UPSTREAM = 'https://api.openphone.com';

if (!KEY) {
  console.error('Missing QUO_API_KEY env var.');
  console.error('Run: export QUO_API_KEY=your_key_here && node demo-ccm/proxy.js');
  process.exit(1);
}

http.createServer((req, res) => {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Only allow GET through the proxy
  if (req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Only GET is proxied.' }));
    return;
  }

  const upstreamUrl = new URL(UPSTREAM + req.url);
  const options = {
    hostname: upstreamUrl.hostname,
    port: 443,
    path: upstreamUrl.pathname + upstreamUrl.search,
    method: 'GET',
    headers: {
      'Authorization': KEY,            // OpenPhone: raw key, no "Bearer"
      'Accept': 'application/json',
      'User-Agent': 'ccm-demo-proxy/1.0',
    },
  };

  const upstream = https.request(options, up => {
    const headers = { ...up.headers };
    // Strip any transfer-encoding to avoid duplicated framing
    delete headers['transfer-encoding'];
    headers['access-control-allow-origin'] = '*';
    res.writeHead(up.statusCode || 502, headers);
    up.pipe(res);
  });
  upstream.on('error', err => {
    console.error('upstream error:', err.message);
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'upstream failed', detail: err.message }));
  });
  upstream.end();
}).listen(PORT, '127.0.0.1', () => {
  console.log(`CCM demo proxy listening on http://localhost:${PORT}`);
  console.log(`Forwarding GETs to ${UPSTREAM} with Authorization header.`);
  console.log(`In Claire's settings drawer, set base URL to: http://localhost:${PORT}/v1`);
});
