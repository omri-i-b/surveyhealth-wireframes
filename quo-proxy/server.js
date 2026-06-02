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

// ---------------------------------------------------------------------------
// Lily voice-agent integration
// ---------------------------------------------------------------------------
//   POST /lily/start            → kick off an outbound Lily call (server-side
//                                 bearer auth; browser never sees the token)
//   POST /lily/callback         → Lily POSTs transcript here when the call ends
//   GET  /lily/calls/:roomId    → demo UI polls this to render status + Q&A
//
// State is held in-memory per server instance — fine for a single Railway
// dyno, dies on restart. If the Lily call lands while the room id is still
// unknown to us (race) we still keep it; the GET will find it by room id.
const LILY_BASE  = process.env.LILY_BASE_URL || 'https://lily.surveyhealth-ai.com';
const LILY_TOKEN = process.env.LILY_API_TOKEN || '';
const LILY_ALLOWED_FLOWS = new Set(['ckd_session_1', 'esrd_session_5', 'copd_session_1', 'copd_session_9', 'post_surgical']);

// roomId → { status, transcript, extracted, callMeta, createdAt, updatedAt }
const lilyCalls = new Map();
const LILY_TTL_MS = 24 * 60 * 60 * 1000;

function lilyPrune() {
  const cutoff = Date.now() - LILY_TTL_MS;
  for (const [k, v] of lilyCalls.entries()) {
    if ((v.updatedAt || v.createdAt || 0) < cutoff) lilyCalls.delete(k);
  }
}

function lilySnapshot(room) {
  const e = lilyCalls.get(room);
  if (!e) return null;
  return {
    room,
    status: e.status,
    flow: e.flow || null,
    patientName: e.patientName || null,
    callMeta: e.callMeta || null,
    transcript: e.transcript || null,
    extracted: e.extracted || null,
    error: e.error || null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

// Forward to Lily. The bearer token is optional — if LILY_API_TOKEN is set
// we add it server-side; otherwise the request goes through unauthenticated
// (Lily's current deployment doesn't require it).
function lilyTriggerCall(body) {
  return new Promise((resolve, reject) => {
    const upstream = new URL(LILY_BASE + '/call');
    const payload = Buffer.from(JSON.stringify(body));
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': payload.length,
    };
    if (LILY_TOKEN) headers['Authorization'] = 'Bearer ' + LILY_TOKEN;
    const req = https.request({
      hostname: upstream.hostname,
      port: upstream.port || 443,
      path: upstream.pathname,
      method: 'POST',
      headers,
    }, up => {
      let chunks = '';
      up.setEncoding('utf8');
      up.on('data', c => chunks += c);
      up.on('end', () => {
        try {
          const json = chunks ? JSON.parse(chunks) : {};
          if ((up.statusCode || 0) >= 400) {
            return reject(new Error(`Lily ${up.statusCode}: ${chunks.slice(0, 300)}`));
          }
          resolve(json);
        } catch (e) { reject(new Error('Lily returned non-JSON: ' + chunks.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Build the patient-facing transcript view + ask Claude to extract structured
// Q&As. We keep the script generic across CKD/ESRD/etc. by asking Claude to
// identify the AI agent's screening questions and the patient's answers.
const QA_EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    extractedResponses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
          answerClass: { type: 'string', enum: ['good', 'bad', 'unclear'] },
          quote: { type: 'string' },
        },
        required: ['question', 'answer', 'answerClass', 'quote'],
        additionalProperties: false,
      },
    },
  },
  required: ['extractedResponses'],
  additionalProperties: false,
};

const QA_EXTRACT_SYSTEM = `You are extracting structured screening-question responses from a clinical phone-call transcript between an AI care-management agent ("Lily") and a patient.

Output JSON matching the schema. For each distinct screening question Lily asked, return:
  - question: Lily's exact question (verbatim, trimmed)
  - answer: a 1–3 word categorical answer derived from the patient's response (Yes / No / Sometimes / Not sure / Worse / Same / Better / etc.)
  - answerClass: "bad" if the answer suggests worsening symptoms or non-adherence, "good" if stable or compliant, "unclear" if ambiguous or the patient didn't really answer.
  - quote: the most representative direct quote from the patient (verbatim, trimmed; can be slightly cleaned of filler).

RULES:
- Only include actual screening questions. Skip greetings ("Am I speaking with Jane?"), housekeeping ("Do you have a minute?"), confirmations, and sign-offs.
- Order matches the order asked in the call.
- If the patient never answered a question, set answer to "No response" and answerClass to "unclear".
- If the transcript is empty or contains no patient speech, return extractedResponses: [].`;

function formatLilyTranscriptForLLM(turns) {
  return (turns || []).map(t => {
    const who = t.role === 'assistant' ? 'AGENT' : 'PATIENT';
    return `[${who}] ${(t.text || '').trim()}`;
  }).filter(s => s.length > 8).join('\n');
}

async function extractLilyQA(room) {
  const entry = lilyCalls.get(room);
  if (!entry || !entry.transcript || !anthropic) return;
  try {
    const formatted = formatLilyTranscriptForLLM(entry.transcript);
    if (!formatted) {
      entry.extracted = { extractedResponses: [] };
      entry.status = 'extracted';
      entry.updatedAt = Date.now();
      return;
    }
    const resp = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2000,
      system: [{ type: 'text', text: QA_EXTRACT_SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: [{
        name: 'emit_extracted_qa',
        description: 'Emit the structured screening Q&A list for this call.',
        input_schema: QA_EXTRACT_SCHEMA,
      }],
      tool_choice: { type: 'tool', name: 'emit_extracted_qa' },
      messages: [{
        role: 'user',
        content: `Flow: ${entry.flow || 'unknown'}\nPatient: ${entry.patientName || 'unknown'}\n\nTRANSCRIPT:\n${formatted}`,
      }],
    });
    const tu = (resp.content || []).find(b => b.type === 'tool_use');
    if (tu && tu.input) {
      entry.extracted = tu.input;
      entry.status = 'extracted';
    } else {
      entry.error = 'Extractor returned no tool_use';
      entry.status = 'extract-failed';
    }
  } catch (err) {
    console.error('lily extract failed:', err.message);
    entry.error = err.message;
    entry.status = 'extract-failed';
  } finally {
    entry.updatedAt = Date.now();
  }
}

http.createServer(async (req, res) => {
  // Health
  if (req.url === '/healthz' || req.url === '/') {
    lilyPrune();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      allowedOrigins: ALLOWED_ORIGINS.length,
      upstream: UPSTREAM,
      summarizer: anthropic ? 'ready' : 'disabled',
      lily: LILY_BASE ? 'ready' : 'disabled',
      lilyAuth: LILY_TOKEN ? 'bearer' : 'none',
      lilyCallsInFlight: lilyCalls.size,
    }));
    return;
  }

  const origin = req.headers.origin;
  const allowed = resolveCors(origin);

  // CORS preflight — /v1/* and /lily/calls/* are GET; /summarize/*, /lily/start, /lily/callback are POST
  if (req.method === 'OPTIONS') {
    if (allowed) {
      const isPost = req.url.startsWith('/summarize/')
                  || req.url === '/lily/start'
                  || req.url === '/lily/callback';
      res.setHeader('Access-Control-Allow-Origin', allowed);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', isPost ? 'POST, OPTIONS' : 'GET, OPTIONS');
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

  // POST /lily/start — browser asks us to kick off a Lily call
  if (req.url === '/lily/start') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Only POST is allowed on /lily/start' }));
      return;
    }
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      if (allowed) { res.setHeader('Access-Control-Allow-Origin', allowed); res.setHeader('Vary', 'Origin'); }
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
    const flow = (body.flow || 'ckd_session_1').trim();
    const phone = (body.phone || '').trim();
    const patientName = (body.patient_name || '').trim();
    if (!LILY_ALLOWED_FLOWS.has(flow)) {
      if (allowed) { res.setHeader('Access-Control-Allow-Origin', allowed); res.setHeader('Vary', 'Origin'); }
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: `Unsupported flow '${flow}'.` }));
      return;
    }
    if (!/^\+\d{10,15}$/.test(phone)) {
      if (allowed) { res.setHeader('Access-Control-Allow-Origin', allowed); res.setHeader('Vary', 'Origin'); }
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'phone must be E.164 (e.g. +12107444981).' }));
      return;
    }
    if (!patientName) {
      if (allowed) { res.setHeader('Access-Control-Allow-Origin', allowed); res.setHeader('Vary', 'Origin'); }
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'patient_name is required.' }));
      return;
    }
    // Lily POSTs the transcript to this callback URL. We auto-derive from
    // the inbound request host so both railway prod and local dev work.
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const host  = req.headers['x-forwarded-host'] || req.headers.host;
    const callback_url = `${proto}://${host}/lily/callback`;
    const lilyBody = {
      flow,
      phone,
      patient_name: patientName,
      callback_url,
      ...(body.med_organization ? { med_organization: body.med_organization } : {}),
      ...(body.contact_information ? { contact_information: body.contact_information } : {}),
    };
    try {
      const result = await lilyTriggerCall(lilyBody);
      const room = result.room || result.room_id || result.roomName;
      if (!room) throw new Error('Lily response missing room id: ' + JSON.stringify(result));
      const now = Date.now();
      lilyCalls.set(room, {
        status: 'in-progress',
        flow,
        patientName,
        phone,
        callMeta: null,
        transcript: null,
        extracted: null,
        sip_call_id: result.sip_call_id || null,
        participant_id: result.participant_id || null,
        createdAt: now,
        updatedAt: now,
      });
      if (allowed) { res.setHeader('Access-Control-Allow-Origin', allowed); res.setHeader('Vary', 'Origin'); }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ room, flow, status: 'in-progress' }));
    } catch (err) {
      console.error('lily start failed:', err.message);
      if (allowed) { res.setHeader('Access-Control-Allow-Origin', allowed); res.setHeader('Vary', 'Origin'); }
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'lily upstream failed', detail: err.message }));
    }
    return;
  }

  // POST /lily/callback — Lily sends the transcript here when the call ends
  if (req.url === '/lily/callback') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Only POST is allowed on /lily/callback' }));
      return;
    }
    let body;
    try {
      body = await readJsonBody(req, 5_000_000);
    } catch (err) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
    const room = body.room;
    if (!room) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'callback missing room id' }));
      return;
    }
    const now = Date.now();
    const prior = lilyCalls.get(room) || { createdAt: now };
    const merged = {
      ...prior,
      status: 'transcribed',
      flow: prior.flow || body.flow,
      patientName: prior.patientName || body.patient_name,
      phone: prior.phone || body.phone_number,
      callMeta: {
        room,
        flow: body.flow,
        med_organization: body.med_organization,
        contact_information: body.contact_information,
        call_start: body.call_start,
        call_end: body.call_end,
        duration_seconds: (body.call_end && body.call_start) ? Math.round(body.call_end - body.call_start) : null,
      },
      transcript: Array.isArray(body.transcript) ? body.transcript : [],
      updatedAt: now,
    };
    lilyCalls.set(room, merged);
    // Fire-and-forget — the UI polls; we don't need to block Lily.
    extractLilyQA(room).catch(e => console.error('lily extract task error:', e.message));
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // GET /lily/calls/:roomId — the demo UI polls this every few seconds
  if (req.url.startsWith('/lily/calls/')) {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Only GET is allowed on /lily/calls/:room' }));
      return;
    }
    const room = decodeURIComponent(req.url.slice('/lily/calls/'.length).split('?')[0]);
    const snap = lilySnapshot(room);
    if (allowed) { res.setHeader('Access-Control-Allow-Origin', allowed); res.setHeader('Vary', 'Origin'); }
    if (!snap) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'unknown room id', room }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(snap));
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
  res.end(JSON.stringify({ error: 'Unknown path. Try /v1/phone-numbers, /summarize/:callId, or /lily/{start,callback,calls/:room}' }));
}).listen(PORT, '0.0.0.0', () => {
  console.log(`CCM demo proxy v2.1.1 listening on 0.0.0.0:${PORT}`);
  console.log(`  [build marker] lily endpoints present — ${new Date().toISOString()}`);
  console.log(`  Quo passthrough: GET /v1/*`);
  console.log(`  Summarizer:      POST /summarize/:callId (${anthropic ? 'ready' : 'disabled'})`);
  console.log(`  Lily trigger:    POST /lily/start          (auth: ${LILY_TOKEN ? 'bearer' : 'none'} · base: ${LILY_BASE})`);
  console.log(`  Lily callback:   POST /lily/callback       (used by Lily, no auth)`);
  console.log(`  Lily status:     GET  /lily/calls/:roomId  (UI polls this)`);
  console.log(`  Allowed origins: ${ALLOWED_ORIGINS.join(', ') || '(none)'}`);
});
