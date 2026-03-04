# Patient Escalation Wireframe - Dev Notes

**Wireframe:** https://omri-i-b.github.io/surveyhealth-wireframes/patient-escalation-wireframe.html

---

## Consent Banner

- If patient is **not consented**, show a red banner at the top with the full consent flow embedded
- The consent flow is copied from Step 6 of the consent wireframe — includes scripts, recording disclosure, identity verification, and consent buttons
- This lets coordinators consent patients during the same escalation call without switching screens
- If patient **is consented**, hide the banner entirely

---

## 7 Resolution Types

Coordinators resolve tickets by selecting one of 7 "dispositions":

**Escalate to Clinic (requires coordinator call + clinic handoff):**
- **Emergent** — Patient needs ED visit immediately
- **Urgent** — Patient needs to be seen within 48 hours
- **Immediate** — Patient needs appointment in 3-7 days
- **Routine** — Non-urgent, follow-up within 8-30 days

**Non-Escalation (no coordinator call required):**
- **Resolved on Phone** — Issue addressed during the call
- **No Intervention Needed** — False positive or not clinically significant
- **Not Reachable** — Unable to contact patient

---

## Resolution Modal

- Clicking any resolution button opens a modal to capture details
- All resolutions ask: contacted clinic (Y/N), handed off to (name), appointment date/time, notes
- **Only Emergent, Urgent, and Immediate** show a "Coordinator Call" section at the top asking: did you complete the call (Y/N), call date, call summary
- Routine and the non-escalation types skip the coordinator call section

---

## Vitals & Voice Analysis Format

- Each metric (blood pressure, pulse, anxiety, etc.) shows **3 separate lines**:
  1. **Reading** — The actual measured value
  2. **vs Baseline** — How it compares to this patient's historical baseline
  3. **vs Population** — How it compares to normal population ranges
- Each line is independently highlighted red/yellow if flagged
- Makes it easy to scan and see exactly what's concerning

---

## Wound Assessment

- Shows wound photo and bandage photo side by side
- Displays wound classification (type, location, risk level, confidence)
- **Change from Last Assessment** section compares to previous scan:
  - Size (growing/stable/shrinking)
  - Redness (spreading/stable/reducing)
  - Signs of infection (present/absent)
  - Wound integrity (intact/compromised)
- Flagged changes get red/yellow row highlighting

---

## Layout & Styling

- **Terminology:** Use "Requires Attention" not "Escalation"
- **Program Information** sits below Ticket Info, uses same grey card styling
- **Resolution buttons** are pastel colored with borders (not solid dark fills)
- **Flagged rows** get full-line background coloring (red or yellow)
- **Right sidebar values** are all right-aligned for easy scanning
- **Section dividers** separate Patient Assessment, Wound Assessment, and Resolution areas
