# CCM Demo — `/demo-ccm/`

Demo flow for the Wednesday Apr 22 prospect walkthrough with Lisa.

## What this is

A separate, self-contained demo path under `/demo-ccm/` that:

1. Shows a tickets view populated from **real data scraped off the Providence demo environment** (neurologx-ai.com).
2. Has a **Claire Henderson** ticket whose detail page **polls Quo directly** for the latest call to a configurable phone number and drops the AI summary into an editable ambient-style note.
3. Leaves every existing wireframe (`/tickets/`, `/escalations/`, `/consent/*`, `/reports/*`) completely untouched.

## Files

```
demo-ccm/
├── index.html                         # Landing — two cards
├── tickets/index.html                 # Tickets list, renders from ../data/tickets.json
├── call/claire/index.html             # Call detail + Quo polling + ambient note
├── data/
│   ├── tickets.json                   # SEED data — REPLACE via scrape before demo
│   └── claire-mock-summary.json       # Fallback ambient-AI note (used when ?mock=1)
└── DEMO-README.md                     # This file
```

## Running locally

Static HTML/Tailwind-CDN — no build step. **You must `cd` to the repo root first** (otherwise `http.server` can't see `demo-ccm/`):

```bash
cd /Users/omri/code_projects/surveyhealth-wireframes
python3 -m http.server 8000
```

Then open:

- Landing: http://localhost:8000/demo-ccm/
- Tickets: http://localhost:8000/demo-ccm/tickets/
- Claire:  http://localhost:8000/demo-ccm/call/claire/
- Mock Claire (no Quo needed): http://localhost:8000/demo-ccm/call/claire/?mock=1

If you get a 404, double-check `pwd` matches `surveyhealth-wireframes` and that `ls demo-ccm/` prints the folder.

## Before the demo — checklist

### 1. Refresh `tickets.json` with real data

The current `data/tickets.json` is **seed data**. Re-scrape the Providence demo env so the tickets view reflects Elia's ~20 altered-name patients.

**Option A — Chrome MCP scrape (preferred):**

With Claude-in-Chrome connected and you signed in to neurologx-ai.com, ask me to run the scrape. I'll navigate to the tickets page, `read_page` the rendered DOM, and rewrite `data/tickets.json` with the real rows. Claire is always injected as the first row and points to `call/claire/`.

**Option B — manual paste:**

Open the tickets table in the platform, open DevTools, grab the `<tbody>` HTML, and paste it to me — I'll transcribe it into `tickets.json`'s schema (see the existing file for the shape).

**Schema note:** each ticket object uses:
`id, patient, initials, avatarColor, icon?, type, status, priority?, calls?, callback?, assignee?, assigneeInitials?, assigneeColor?, assessment?, rpm?, severity, href?, isDemo?`

Claire's row must keep `id: "claire"`, `href: "../call/claire/"`, and `isDemo: true`.

### 2. Start the CORS proxy (Quo has no CORS)

The Quo API (an OpenPhone rebrand) does not emit CORS headers, so the browser cannot call it directly. A tiny Node proxy is included:

```bash
# Terminal 2 (keep the python http.server running in terminal 1)
export QUO_API_KEY=<your_quo_key_here>
node demo-ccm/proxy.js
```

You should see: `CCM demo proxy listening on http://localhost:8787`

Kill the proxy after the demo (Ctrl-C). The key only lives in the shell env — never written to disk.

### 3. Configure polling on Claire's page

1. Open http://localhost:8000/demo-ccm/call/claire/
2. Click **Quo settings** (top-right).
3. Fill in:
   - **Quo API key** — paste the raw key (stored only in your browser's localStorage).
   - **Quo API base URL** — `http://localhost:8787/v1` (the local proxy). Already defaulted.
   - **Quo phoneNumberId** — `PN...` — the ID of the Quo line Claire will call. Find in Quo dashboard → Settings → Phone Numbers.
   - **Claire's phone number** — her caller number in E.164 format (`+15555550100`).
   - **Poll interval** — default 5 seconds.
4. **Save & apply**. Status banner should flip from "Idle" to "Listening for call summary…".

### 4. Trigger / re-trigger a call

- Have Claire (or a test phone) call the configured number via Quo.
- The UI will show "Call in progress" while Quo reports `status=in_progress`, then "Summary received" when complete.
- Press **Re-poll** (green status bar) or **Regenerate from latest call** (note header) to pull a newer call mid-demo. Each new call overwrites the previous note, so you can iterate.

### 5. If Quo is down, use the mock

Append `?mock=1` to Claire's URL. Loads `data/claire-mock-summary.json` — a hand-authored ambient-AI note for a plausible CHF-decompensation check-in call. Fully functional (including edit + save toast), bypasses Quo entirely.

Also available as a persistent setting: open **Quo settings** → check **Use mock summary**.

## Known implementation details

### Quo API shape (real, as wired)

"Quo" is the rebranded **OpenPhone** API.

- Base URL: `https://api.openphone.com/v1` (direct) or `http://localhost:8787/v1` (via the included proxy).
- Auth header: `Authorization: <API_KEY>` — **no** `Bearer` prefix.
- Every response is wrapped in `{ data: … }`.

The polling code chains three endpoints per tick:

1. `GET /v1/calls?phoneNumberId=PN...&participants=+1...&maxResults=1` — list recent calls between the Quo line and Claire. Returns `{ data: [{ id, direction, status, duration, createdAt, answeredAt, completedAt, phoneNumberId, participants, … }] }`. Note: **both** `phoneNumberId` and `participants` are required query params.
2. `GET /v1/call-summaries/{callId}` — Returns `{ data: { callId, status, summary: [bullets], nextSteps: [bullets], jobs: [{ name, result: { data: [{ name, value }] } }] } }`. May 404 if the summary isn't generated yet (first few seconds after call completes).
3. `GET /v1/call-transcripts/{callId}` — Returns `{ data: { callId, dialogue: [{ content, start, end, identifier, userId }] } }`. `userId` non-null = Quo/agent side; `identifier` only = patient side. May also 404 if not yet generated.

The summary shape is limited (just arrays of bullets), so `mapQuoSummaryToAmbientNote()` maps them into the 7-section note we display:
- `summary[]` → HPI / Assessment / Chief Complaint (first bullet)
- `nextSteps[]` → Plan / Follow-up (last bullet)
- Other sections default to "(not captured — click to add)" — editable.

When SurveyHealth's real structured ambient-note feature ships (3–4 weeks), replace only `mapQuoSummaryToAmbientNote()` and/or the summary fetch call to return the full note shape directly.

### CORS proxy (included)

The Quo/OpenPhone API does **not** send CORS headers, so browsers block direct `fetch`. Use the included proxy:

```bash
export QUO_API_KEY=<your_key>
node demo-ccm/proxy.js          # listens on http://localhost:8787
```

The proxy:
- Only listens on `127.0.0.1` (localhost).
- Only forwards `GET` requests (other methods rejected 405).
- Injects `Authorization: <KEY>` using the env-var key — overrides whatever the browser sent, so you can leave the UI key field blank if you prefer.
- Emits permissive CORS so Claire's page can poll it.
- Kill it after the demo (Ctrl-C).

Security notes:
- The API key lives only in (a) your shell env var, and (b) optionally your browser's `localStorage`. It is never written to a file in this repo.
- `demo-ccm/proxy.js` does not log request bodies or keys.
- The QUO key you pasted into chat should be rotated after the demo.

### Security

- Quo API key is stored **only in this browser's localStorage**. Do not commit it.
- The simulated summary note save currently writes to localStorage as `demoCcm.saved.<callId>`. Post-demo, wire `submitNote()` in `call/claire/index.html` to the real patient-record endpoint.
- The ambient note UI edits are `contenteditable` — we round-trip `textContent`, not innerHTML.

## Open deliverables from the Apr 16 debrief (tracked here)

- [x] Simulated summary note template → `data/claire-mock-summary.json` (ambient-AI style)
- [ ] Masking-issue troubleshooting script for Lisa → **still TODO, tracked separately**

## When the real summary feature ships (3–4 weeks)

Replace the mock path and wire Quo (or the production summary endpoint) to return the `ambient_note` object directly in the shape shown above. The UI is already structured to consume it with zero changes beyond `transformQuoResponse()`.
