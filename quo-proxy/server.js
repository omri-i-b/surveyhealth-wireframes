#!/usr/bin/env node
/**
 * Railway-hosted proxy for the CCM demo.
 *
 * Two jobs:
 *   1. CORS-friendly passthrough to the Quo (OpenPhone) API at /v1/*
 *   2. LLM-based ambient-scribe summarizer at POST /summarize/:callId
 *      Uses Claude Opus 4.7 with prompt caching on the frozen template.
 *
 * Env vars (set in Railway → Variables):
 *   QUO_API_KEY           (required)  Your Quo/OpenPhone API key.
 *   ANTHROPIC_API_KEY     (required)  Your Anthropic API key.
 *   ALLOWED_ORIGINS       (required)  Comma-separated allowed browser origins.
 *   PORT                  (auto)      Injected by Railway.
 *
 * Endpoints:
 *   GET  /healthz              → 200 OK
 *   GET  /v1/*                 → proxied to api.openphone.com/v1/*
 *   POST /summarize/:callId    → LLM-generated structured CCM note
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = parseInt(process.env.PORT || '8787', 10);
const QUO_KEY = process.env.QUO_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const RAW_ALLOWED = (process.env.ALLOWED_ORIGINS || '').trim();
const ALLOWED_ORIGINS = RAW_ALLOWED ? RAW_ALLOWED.split(',').map(s => s.trim()).filter(Boolean) : [];
const UPSTREAM = 'https://api.openphone.com';

if (!QUO_KEY) {
  console.error('FATAL: Missing QUO_API_KEY env var.');
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.warn('WARN: ANTHROPIC_API_KEY not set — /summarize will return 503.');
}
if (!ALLOWED_ORIGINS.length) {
  console.warn('WARN: ALLOWED_ORIGINS not set — browser requests will be rejected.');
}

const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;

function resolveCors(origin) {
  if (!origin) return null;
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

// ---------------------------------------------------------------------------
// CCM care-interaction note — frozen template & schema (cacheable system prompt)
// ---------------------------------------------------------------------------

const NOTE_FIELDS = [
  'patientName', 'patientDob', 'pcp', 'dateOfEngagement', 'careManager',
  'interactionType', 'interventionCategory', 'conditionsMonitored', 'goals',
  'evaluationReason', 'summaryOfInteraction', 'plan', 'timeSpent',
];

const NOTE_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(NOTE_FIELDS.map(f => [f, { type: 'string' }])),
  required: NOTE_FIELDS,
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a clinical documentation assistant that turns CCM (Chronic Care Management) phone-call transcripts into a structured care-interaction note.

Output the note as JSON matching the provided schema. Every field must be populated.

--- TEMPLATE FORMAT (produce one string per field, wording patterned on this exact example) ---

Patient Name: <full name from patient context>
Patient Date of Birth: <long-form date, e.g. "March 14, 1957">
PCP: <provider name + practice from patient context>
Date of Engagement: <long-form date of the call, from call metadata>
Care Manager: <from patient context, verbatim>
Interaction Type: <from patient context, verbatim>
Intervention Category: <from patient context, verbatim>
Conditions Monitored: <from patient context, verbatim>
Goals: <from patient context, verbatim>
Evaluation Reason: <why the patient was called or why this interaction happened — derive from transcript and any contextual flags>
Summary of Interaction: <what the patient reported during the call — symptoms, compliance, concerns. Stay close to what the patient actually said. If the patient didn't speak, state that.>
Plan: <next-step actions for the care team, derived from the call. If no plan discussed, state that.>
Time Spent: <call duration formatted as "X minutes Y seconds", from call metadata>

--- RULES ---

1. For static fields (Patient Name, DOB, PCP, Care Manager, Interaction Type, Intervention Category, Conditions Monitored, Goals): copy values directly from the patient context JSON you are given. Do not rewrite.

2. For call-metadata fields (Date of Engagement, Time Spent): derive from the call metadata JSON. Date format: "Month Day, Year" (e.g. "April 17, 2026").

3. For derived fields (Evaluation Reason, Summary of Interaction, Plan): extract from the transcript ONLY. Never invent clinical facts. If the transcript doesn't discuss a topic, say "Not discussed during this call" for that field.

4. Output field VALUES should NOT include the label (e.g. patientName should be "Claire Henderson", not "Patient Name: Claire Henderson"). The labels are added by the consuming UI.

5. Keep each field concise. Summary of Interaction and Plan should be 1–4 sentences each.

6. If the transcript is empty or shows no patient speech, still produce all fields — note "No patient speech captured" in Summary of Interaction, and "Follow-up needed: transcript missing" in Plan.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonBody(req, max = 1_000_000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > max) { req.destroy(); reject(new Error('body too large')); }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch (err) { reject(new Error('invalid json body')); }
    });
    req.on('error', reject);
  });
}

function quoGet(path) {
  return new Promise((resolve, reject) => {
    const u = new URL(UPSTREAM + path);
    const req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'Authorization': QUO_KEY,
        'Accept': 'application/json',
        'User-Agent': 'ccm-demo-proxy/2.0',
      },
    }, up => {
      let buf = '';
      up.on('data', c => buf += c);
      up.on('end', () => {
        if (up.statusCode === 404) return resolve(null);
        if (up.statusCode < 200 || up.statusCode >= 300) {
          return reject(new Error(`Quo ${up.statusCode}: ${buf.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function secondsToPhrase(s) {
  if (s == null || isNaN(s)) return '';
  s = Math.floor(s);
  const m = Math.floor(s / 60), r = s % 60;
  if (m === 0) return `${r} seconds`;
  return `${m} minute${m === 1 ? '' : 's'} ${r} second${r === 1 ? '' : 's'}`;
}

function formatTranscriptForLLM(dialogue) {
  if (!Array.isArray(dialogue) || dialogue.length === 0) {
    return '(No transcript dialogue available.)';
  }
  return dialogue.map(d => {
    const speaker = d.userId ? 'Agent' : 'Patient';
    const start = typeof d.start === 'number' ? `[${Math.floor(d.start)}s]` : '';
    return `${speaker} ${start}: ${d.content || ''}`.trim();
  }).join('\n');
}

// ---------------------------------------------------------------------------
// /summarize/:callId
// ---------------------------------------------------------------------------

async function handleSummarize(callId, body, res, allowedOrigin) {
  if (!anthropic) {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Summarizer not configured (ANTHROPIC_API_KEY missing)' }));
    return;
  }

  const patient = body.patient;
  if (!patient || typeof patient !== 'object') {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Request body must include a "patient" object' }));
    return;
  }

  // 1. Fetch call + transcript from Quo in parallel
  let call, transcriptResp;
  try {
    [call, transcriptResp] = await Promise.all([
      quoGet(`/v1/calls/${encodeURIComponent(callId)}`),
      quoGet(`/v1/call-transcripts/${encodeURIComponent(callId)}`),
    ]);
  } catch (err) {
    console.error('quo fetch failed:', err.message);
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'upstream Quo request failed', detail: err.message }));
    return;
  }

  if (!call || !call.data) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: `Call ${callId} not found on Quo` }));
    return;
  }

  const dialogue = transcriptResp?.data?.dialogue || [];
  if (!dialogue.length) {
    res.writeHead(424, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Transcript not available yet or not generated for this call',
      hint: 'Ensure call recording and AI transcription are enabled on the Quo line, then retry.',
    }));
    return;
  }

  // 2. Build call metadata for the LLM
  const c = call.data;
  const callMeta = {
    callId: c.id,
    direction: c.direction,
    durationSeconds: c.duration,
    durationFormatted: secondsToPhrase(c.duration),
    createdAt: c.createdAt,
    answeredAt: c.answeredAt,
    completedAt: c.completedAt,
  };

  const transcriptText = formatTranscriptForLLM(dialogue);

  // 3. Call Anthropic with caching on the frozen system prompt
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{
        role: 'user',
        content:
          `Patient context:\n${JSON.stringify(patient, null, 2)}\n\n` +
          `Call metadata:\n${JSON.stringify(callMeta, null, 2)}\n\n` +
          `Transcript:\n${transcriptText}\n\n` +
          `Produce the note now. Output JSON only, matching the schema.`,
      }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: NOTE_SCHEMA,
        },
      },
    });

    // Pull the JSON text out of the response
    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock) throw new Error('No text block in Anthropic response');
    const note = JSON.parse(textBlock.text);

    // 4. Return
    const headers = { 'content-type': 'application/json' };
    if (allowedOrigin) {
      headers['access-control-allow-origin'] = allowedOrigin;
      headers['vary'] = 'Origin';
    }
    res.writeHead(200, headers);
    res.end(JSON.stringify({
      note,
      callMeta,
      usage: response.usage,
      stopReason: response.stop_reason,
    }));
  } catch (err) {
    console.error('anthropic failed:', err.message);
    const status = err.status || 502;
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'LLM summarization failed', detail: err.message }));
  }
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

http.createServer(async (req, res) => {
  // Health
  if (req.url === '/healthz' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      allowedOrigins: ALLOWED_ORIGINS.length,
      upstream: UPSTREAM,
      summarizer: anthropic ? 'ready' : 'disabled',
    }));
    return;
  }

  const origin = req.headers.origin;
  const allowed = resolveCors(origin);

  // CORS preflight — /v1/* is GET-only, /summarize/* is POST-only
  if (req.method === 'OPTIONS') {
    if (allowed) {
      const isSummarize = req.url.startsWith('/summarize/');
      res.setHeader('Access-Control-Allow-Origin', allowed);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', isSummarize ? 'POST, OPTIONS' : 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'content-type,accept');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    res.writeHead(204);
    res.end();
    return;
  }

  // Refuse disallowed origins before touching upstream
  if (origin && !allowed) {
    res.writeHead(403, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Origin not allowed.', origin }));
    return;
  }

  // /summarize/:callId — LLM summary
  if (req.url.startsWith('/summarize/')) {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Only POST is allowed on /summarize/:callId' }));
      return;
    }
    const callId = decodeURIComponent(req.url.slice('/summarize/'.length).split('?')[0]);
    if (!callId || !callId.startsWith('AC')) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid callId. Expected AC... format.' }));
      return;
    }
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
    await handleSummarize(callId, body, res, allowed);
    return;
  }

  // /v1/* — Quo passthrough
  if (req.url.startsWith('/v1/')) {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Only GET is proxied for /v1/*' }));
      return;
    }
    const upstreamUrl = new URL(UPSTREAM + req.url);
    const options = {
      hostname: upstreamUrl.hostname,
      port: 443,
      path: upstreamUrl.pathname + upstreamUrl.search,
      method: 'GET',
      headers: {
        'Authorization': QUO_KEY,
        'Accept': 'application/json',
        'User-Agent': 'ccm-demo-proxy/2.0 (+railway)',
      },
    };
    const upstream = https.request(options, up => {
      const headers = { ...up.headers };
      delete headers['transfer-encoding'];
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
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'Unknown path. Try /v1/phone-numbers or /summarize/:callId' }));
}).listen(PORT, '0.0.0.0', () => {
  console.log(`CCM demo proxy v2.0 listening on 0.0.0.0:${PORT}`);
  console.log(`  Quo passthrough: GET /v1/*`);
  console.log(`  Summarizer:      POST /summarize/:callId (${anthropic ? 'ready' : 'disabled'})`);
  console.log(`  Allowed origins: ${ALLOWED_ORIGINS.join(', ') || '(none)'}`);
});
