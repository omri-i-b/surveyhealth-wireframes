# Patient Escalation Wireframe - Developer Notes

**Wireframe:** [patient-escalation-wireframe.html](https://omri-i-b.github.io/surveyhealth-wireframes/patient-escalation-wireframe.html)

**Related:** [patient-consent-wireframe.html](https://omri-i-b.github.io/surveyhealth-wireframes/patient-consent-wireframe.html)

---

## Overview

This wireframe represents a "Requires Attention" ticket view for care coordinators. These tickets are generated when a patient's vitals, voice analysis, wound assessment, or survey responses trigger system flags requiring human review.

**Terminology:** We use "Requires Attention" instead of "Escalation" throughout the UI.

---

## Consent Status Banner

### Behavior

The consent banner at the top of the ticket is **conditional based on patient consent status**.

| Consent Status | Banner Display |
|----------------|----------------|
| **Not Consented** | Red banner with embedded Step 6 consent flow |
| **Consented** | No banner shown (or small green "Consented" indicator) |

### When Not Consented

- Display a prominent red banner at the very top of the ticket
- Embed the **full Step 6 consent flow** directly in the banner (copied from consent wireframe)
- This includes:
  - Intro script
  - Recording disclosure + Yes/No buttons
  - Name & DOB verification against patient record
  - Consent disclosure script (HIPAA, co-pay, opt-out info)
  - Consent buttons: "Yes to Both", "APCM Only", "RPM Only", "No"
  - Response scripts for yes/no outcomes

### Why Inline Consent?

Care coordinators handling escalation tickets need to be able to consent patients during the same call. Embedding the flow prevents context-switching to a separate consent workflow.

---

## Resolution Types (7 Dispensations)

When resolving a ticket, coordinators select one of **7 resolution types**. These are displayed as button cards in the "Attention Details" section.

### Escalate to Clinic (Requires Coordinator Call)

These 4 types require the coordinator to call the patient AND contact the clinic:

| Type | Color | Timeframe | Description |
|------|-------|-----------|-------------|
| **Emergent** | Red | Immediate | Recommend ED visit. Patient should go to emergency department. |
| **Urgent** | Orange | Within 48 hours | Patient needs to be seen within 2 days. |
| **Immediate** | Yellow | 3-7 days | Patient needs appointment within a week. |
| **Routine** | Green | 8-30 days | Non-urgent, but needs follow-up within a month. |

### Non-Escalation (No Coordinator Call Required)

These 3 types do NOT require a coordinator call:

| Type | Color | Description |
|------|-------|-------------|
| **Resolved on Phone** | Blue | Issue was addressed during the coordinator's call with the patient. |
| **No Intervention Needed** | Slate/Gray | After review, the flag was a false positive or not clinically significant. |
| **Not Reachable** | Gray | Unable to contact patient after attempts. |

---

## Resolution Modal

When a coordinator clicks a resolution button, a modal opens with fields to complete:

### Fields (All Resolution Types)

- **Have you contacted the clinic?** (Yes/No) - Required
- **Handed off to** (text input) - e.g., "Patty Smith, RN"
- **Appointment scheduled** (date + time) - Optional
- **Notes** (textarea) - Optional

### Coordinator Call Section (Conditional)

**Only shown for:** Emergent, Urgent, Immediate

This section appears at the top of the modal when the resolution type requires a coordinator call:

- **Did you complete the call?** (Yes/No) - Required
- **Call Date** (date picker)
- **Call Summary** (textarea)

**Not shown for:** Routine, Resolved on Phone, No Intervention Needed, Not Reachable

---

## Vitals & Voice Analysis Display

Vitals and voice analysis metrics use a **3-line format per metric** for scannability:

```
Blood Pressure
├── Reading:       155/90 mmHg        (actual value)
├── vs Baseline:   +15 SBP / +7 DBP   (comparison to patient's history)
└── vs Population: Normal range       (comparison to population norms)
```

### Line Highlighting

Each line is independently colored based on its status:
- **Red background** (`bg-red-50`) — Flagged/critical
- **Yellow background** (`bg-yellow-50`) — Warning
- **No background** — Normal/OK

This allows coordinators to quickly scan down the right side and see which specific comparisons are concerning.

### Metrics Displayed

**Vitals:**
- Blood Pressure
- Pulse
- Respiratory Rate

**Voice Analysis (Canary Speech):**
- Depression
- Anxiety
- Cognitive Load

---

## Wound Assessment

Wound analysis section includes:

### Images
- Wound photo
- Bandage photo

### Classification
- Wound type (e.g., "Venous Ulcer")
- Location (e.g., "lower leg/ankle area")
- Risk level badge (Low/Moderate/High)
- Confidence score

### Change from Last Assessment

Comparison metrics showing progression:

| Metric | Possible Values |
|--------|-----------------|
| Size | Growing ↑ / Stable / Shrinking ↓ |
| Redness | Spreading ↑ / Stable / Reducing ↓ |
| Signs of Infection | Present / Absent |
| Wound Integrity | Intact / Compromised |

Each row is highlighted red/yellow if concerning.

### Quick Stats
- Size (cm)
- Depth
- Exudate level
- Healing stage

---

## Section Structure

The ticket is organized into logical sections with dividers:

1. **Consent Banner** (if not consented)
2. **Assigned Banner** (shows current assignee)
3. **Ticket Info** (type, status, category, assignee, created date)
4. **Program Information** (response rate, flag history, enrolled programs)
5. **Attention Details** (trigger source, program, reason) + **Resolution Buttons**
6. **— Patient Assessment —** (section divider)
7. **Response** (survey Q&A with flagged answers highlighted)
8. **Vitals** (3-line format per metric)
9. **Voice Analysis** (3-line format per metric)
10. **— Wound Assessment —** (section divider)
11. **Wound Analysis** (images, classification, comparison metrics)
12. **— Resolution —** (section divider)
13. **Care Manager Notes** (optional textarea)

---

## Right Sidebar

The right sidebar contains patient context:

- **Patient Header** (name, avatar, phone numbers, call/log buttons)
- **Consent Status** (indicator)
- **Demographics** (DOB, gender, state, insurance, diagnoses)
- **Provider** (name, practice, location, phone)
- **Activity Log** (timeline of events: flags, assignments, assessments)

All values are **right-aligned** for glanceability when scanning down the sidebar.

---

## Styling Notes

### Resolution Buttons
- Use pastel backgrounds with colored borders (not solid dark fills)
- Example: `bg-red-100 border-2 border-red-300 text-red-800`
- Colored dot indicator for escalation types
- Icon for non-escalation types

### Flagged Items
- Full row/line gets colored background when flagged
- Red for critical, yellow for warning
- Left border accent (`border-l-4`) for response Q&A items

### Right-Aligned Values
- All data values in sidebar and vitals/voice sections align right
- Labels on left, values on right
- Improves scannability

---

## State Management (Implementation Notes)

### Consent State
```javascript
// Check patient consent status
if (!patient.isConsented) {
  showConsentBanner();  // Red banner with embedded Step 6
  // programInfoSection remains visible (not greyed out)
}
```

### Resolution Modal
```javascript
function openResolutionModal(type) {
  const requiresCoordinatorCall = ['emergent', 'urgent', 'immediate'].includes(type);

  if (requiresCoordinatorCall) {
    showCoordinatorCallSection();
  } else {
    hideCoordinatorCallSection();
  }

  // Set modal colors based on type
  applyModalTheme(type);
}
```

---

## Open Questions

1. Should "Not Reachable" trigger a retry workflow or just close the ticket?
2. How many call attempts before "Not Reachable" is valid?
3. Should resolved tickets show the resolution type badge in lists?
4. Do we need escalation-to-provider notifications (email/SMS to clinic)?
