# Product Requirements Document (PRD)

## Project: CyberArena — Real-Time Cybersecurity Awareness & Threat Defense Challenge
**Document Version:** 1.0.0  
**Status:** Approved / Production-Ready  
**Author:** Principal Full-Stack Engineer & Security Automation Architect  
**Target Platform:** Modern Web Browsers (Chrome, Edge, Firefox, Safari) / GitHub Pages  

---

### 1. Executive Summary & Vision

**CyberArena** is an interactive, real-time cyber defense awareness simulation platform designed to educate corporate teams on modern social engineering, supply chain vulnerabilities, credential hygiene, and emerging cyber attack vectors.

Unlike conventional compliance training videos or passive questionnaires, CyberArena turns security awareness into a high-stakes, timed team competition. It pairs a **Participant War Room** with an **Admin Command Center**, enforced by a **client-side anti-cheat proctoring engine** and a **deterministic ranking algorithm**.

The platform is architected to operate with **zero recurring backend hosting costs**, executing all real-time multi-client synchronization natively via browser Web APIs (`BroadcastChannel` and `localStorage`).

---

### 2. Business Objectives & Success Metrics

| Objective | KPI Target | Measurement Method |
|---|---|---|
| **Participant Engagement** | &gt; 90% completion rate | Submissions vs. total registered squads |
| **Integrity Assurance** | &lt; 2% false positives on cheat alerts | Audit review of strike events |
| **Operational Zero Cost** | $0 infrastructure spend | Client-side pub/sub + GitHub Pages hosting |
| **Evaluation Precision** | 100% deterministic, zero tie-break ambiguity | Exact millisecond timestamp & accuracy sorting |
| **Onboarding Speed** | &lt; 60 seconds from room code to war room | Session analytics from landing to lobby |

---

### 3. User Personas

1. **Participant Operator (Employee / Defender)**
   - *Profile:* Corporate employee participating in company-wide cyber awareness month.
   - *Needs:* Seamless team registration, clear timer urgency, engaging realistic attack scenarios, real-time focus feedback.
   - *Pain Points:* Boring compliance slides, ambiguity in team ranking, unfair tab-switching cheaters.

2. **Squad Lead (Team Captain)**
   - *Profile:* Senior team member coordinating the 4-person squad (1 Lead + 3 Teammates).
   - *Needs:* Easy room joining via 6-character room codes or direct URLs, clear confirmation of squad readiness.

3. **Security Awareness Administrator / SOC Lead**
   - *Profile:* Corporate AppSec / InfoSec / Compliance lead running the event.
   - *Needs:* Secured access gate (Username + Password), instant 6-character room code generation, shareable participant join links, real-time participant monitoring, ability to launch matches simultaneously, manual DQ/kick controls, automated 2-minute audit buffer, and public leaderboard rendering.

---

### 4. User Journey & Feature Specifications

#### 4.1 Role Gate & Clearance Access
- **Landing Hub:** Clean high-tech portal with dual entry points: Participant Portal and Admin Command Center.
- **Admin Clearance Gate:**
  - Protected by authorized administrator clearance for `pravin0408` via salted cryptographic SHA-256 verification.
  - Plaintext credentials and auto-fill hints are strictly absent from client-side UI and DOM.
  - Brute-force rate limiting (5 attempts threshold triggers 30-second security cooldown).
  - Show/hide password visibility toggle with non-overlapping dedicated icon padding.
  - Session persistence via `sessionStorage` with a dedicated Logout trigger.

#### 4.2 Participant Registration & Roster Validation
- **Form Fields (Kept Strict & Clean):**
  1. Team Name (Text, 2–50 chars)
  2. Target Room Code (6-char alphanumeric, case-insensitive)
  3. Team Lead Details:
     - Full Name (Text, 2–60 chars)
     - Corporate Email (Regex validated RFC 5322)
  4. Exactly 4 Teammates (Teammate 1, 2, 3, 4 full names)
- **Validation Rules:**
  - Strict team size: Exactly 4 members (1 Lead + 3 Teammates).
  - Uniqueness: No duplicate names across any of the 4 members.
  - Room verification: Target room must exist and be in `WAITING` status.
  - Team name uniqueness within the target room.

#### 4.3 War Room Lobby
- **Live Room Telemetry:** Displays room code, team identity, and active connection status.
- **Active Squad Grid:** Visual avatar cards for all 5 operators with "Ready" status indicators.
- **Radar Sweep Animation:** High-tech HUD scanning graphic signaling standby state for synchronized launch.
- **Proctoring Disclaimer Banner:** Prominent warning outlining the 3-strike focus policy.

#### 4.4 Timed Quiz Engine (10 Questions, 15 Minutes)
- **Synchronized Countdown:** 15-minute (`900,000 ms`) countdown timer synchronized to the admin launch epoch.
- **Visual Urgency States:**
  - Normal (> 2 min): Emerald glow (`#10b981`).
  - Urgent (< 2 min): Flashing crimson warning (`#ff3366`) with pulsating blink.
  - Expired (0:00): Auto-submits responses immediately and freezes inputs.
- **Content Coverage (10 Industry Threat Scenarios):**
  1. Spear Phishing / Email Header & SPF Softfail Analysis
  2. MFA Fatigue / Push Bombing Notification Defense
  3. Social Engineering / Voice Phishing (Vishing) & Remote Tool Impersonation
  4. Supply Chain / Typosquatting in NPM & PyPI Package Registries
  5. Credential Hygiene / Password Reuse Post-Breach Remediation
  6. QR Code Quishing in Physical Corporate Environments
  7. Ransomware Containment / Host Isolation Protocol
  8. Insider Threat Detection / Large Off-Hours Exfiltration (DLP)
  9. Zero Trust Device Posture & Network Perimeter Authorization
  10. Secure CI/CD Pipelines / GitHub Actions `pull_request_target` Exploit
- **Question Navigation:**
  - Interactive top pill bar (1 to 10) showing answered / active states.
  - Single-choice radio cards with keyboard keys `[A]`, `[B]`, `[C]`, `[D]`.
  - Previous / Next navigation with warning on uncompleted items.

#### 4.5 Anti-Cheat Focus Proctoring Engine
- **Focus Detection:** Continuously listens for `visibilitychange` (tab switching, window minimize) and `window.blur` (alt-tabbing, inspecting other monitors).
- **3-Strike State Machine:**
  - **Strike 1:** High-priority blocking modal alert requiring explicit user acknowledgment. Strike pip 1 lights up crimson.
  - **Strike 2:** High-priority blocking modal with heightened warning that 1 more strike causes termination. Strike pip 2 lights up crimson.
  - **Strike 3:** Instant session lock. Dispatches `DISQUALIFIED` payload (`TAB_SWITCH_EXCEEDED`) across the state bus and transitions UI to permanent Disqualification Lock Screen.

#### 4.6 Admin Command Center
- **Room Lifecycle Management:**
  - Generate cryptographically sound 6-character room codes.
  - One-click copy for room codes and direct join URLs (`?room=XXXXXX`).
  - Real-time roster table reflecting connected squads, size, live status, scores, and focus violations.
  - Synchronized "Launch Match" action that broadcasts to all connected tabs.
  - Manual moderation actions: Kick squad, manual Disqualify.
- **2-Minute Post-Match Audit Hold:**
  - When the 15-minute challenge timer elapses, the match enters an automated 2-minute freeze hold (`AUDIT_HOLD`).
  - Allows in-flight network submissions to finalize and proctoring violation logs to reconcile.
  - Once audit elapses (or when accelerated by the admin), the official Leaderboard is rendered.

#### 4.7 Deterministic Ranking Engine & Results Retention
- Strict sorting priority:
  1. **Integrity Filter:** Teams with status `DISQUALIFIED` or `EXPIRED` sink to the bottom.
  2. **Primary Metric:** Accuracy / Score (descending: 10/10 wins over 9/10).
  3. **Primary Tie-Breaker:** Elapsed Mission Duration (`quiz_finish_epoch - quiz_start_epoch` ascending: faster duration wins).
  4. **Secondary Tie-Breaker:** Earliest Finish Timestamp (`quiz_finish_epoch` ascending).
- **Persistent Results Ledger:**
  - Finalized matches are automatically saved to `cyberarena_archives` in persistent local storage.
  - Admins can inspect past match leaderboards at any time.
- **1-Click Export & Compliance:**
  - Export to CSV (`.csv`) with full rank, squad name, accuracy, duration, and status metrics.
  - Export to JSON (`.json`) audit logs for SOC/SIEM record-keeping.
  - Interactive Threat Scenario breakdown showing correct defensive actions and educational rationales.

---

### 5. Non-Functional Requirements (NFRs)

- **Compatibility:** Evergreen browsers supporting ES6+, `BroadcastChannel`, and CSS Grid/Flexbox.
- **Latency:** Cross-tab message propagation under 50ms using Web BroadcastChannel.
- **Accessibility:** High-contrast text compliance, distinct color tokens, keyboard navigable option lists.
- **Security:** Strict HTML output escaping to prevent Cross-Site Scripting (XSS); isolation of room bus channels.
- **Zero Dependencies at Runtime:** Static HTML/CSS/JS with zero external runtime vendor dependencies.
