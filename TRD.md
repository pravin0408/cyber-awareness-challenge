# Technical Requirements Document (TRD)

## Project: CyberArena — Real-Time Cybersecurity Awareness & Threat Defense Challenge
**Document Version:** 1.0.0  
**Status:** Approved / Architecture Complete  
**Author:** Principal Full-Stack Engineer & Security Automation Architect  
**Repository:** `pravin0408/cyber-awareness-challenge`  

---

### 1. Architectural Overview & System Design

CyberArena employs a **distributed, client-side, event-driven Single Page Application (SPA)** architecture. It provides full real-time multiplayer capabilities on static hosting (such as GitHub Pages or AWS S3) without requiring a paid, long-running WebSocket server or relational database.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CYBERARENA CLIENT SPA                         │
│                                                                        │
│  ┌────────────────┐     ┌────────────────┐     ┌──────────────────┐    │
│  │ Participant UI │     │ Admin Command  │     │ Leaderboard View │    │
│  │ (Register/Quiz)│     │ Center (Auth)  │     │ (Deterministic)  │    │
│  └───────┬────────┘     └───────┬────────┘     └────────┬─────────┘    │
│          │                      │                       │              │
│          ▼                      ▼                       ▼              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                 SPA State Machine (src/app.js)                   │  │
│  └──────────────┬───────────────────────────────┬───────────────────┘  │
│                 │                               │                      │
│                 ▼                               ▼                      │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ Proctoring Focus Monitor    │  │ Deterministic Scoring Engine    │  │
│  │ (src/proctor.js - 3 strikes)│  │ (src/scoring.js - O(N log N))   │  │
│  └──────────────┬──────────────┘  └────────────────┬────────────────┘  │
│                 │                                  │                   │
│                 └─────────────────┬────────────────┘                   │
│                                   ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │            Real-Time State Bus (src/mockBackend.js)               │  │
│  │     - BroadcastChannel API (sub-5ms cross-tab latency)           │  │
│  │     - localStorage Pub/Sub fallback + persistent state store     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2. Technology Stack & Environment

| Layer | Technology | Rationale |
|---|---|---|
| **Runtime / UI** | Pure Vanilla ES6+ & Modern DOM APIs | Zero external runtime dependencies; instant load time (<100ms); zero supply chain attack surface. |
| **Styling** | Modern CSS3 (Variables, Glassmorphism, Grid/Flexbox) | Ultra-lightweight, customizable cyber SOC aesthetics; hardware-accelerated animations. |
| **Real-Time Bus** | `BroadcastChannel` API + `window.localStorage` | Cross-context messaging without server infrastructure; transparent multi-tab concurrency. |
| **Testing** | Jest 29+ (`babel-jest`) | Automated unit tests verifying tie-breaker comparator rules, elapsed calculation, and grading. |
| **Linting** | ESLint 8+ | Code quality and formatting enforcement. |
| **CI / CD** | GitHub Actions (`deploy-pages@v4`, `actions/checkout@v4`) | Fully automated test validation, artifact packaging, and zero-touch deployment to GitHub Pages. |

---

### 3. Real-Time Communication Engine (`src/mockBackend.js`)

#### 3.1 Dual-Transport Synchronization Model
1. **Primary Transport (`BroadcastChannel`):**
   - Channel Name: `"cyber-arena-bus"`.
   - Sends direct structured JavaScript objects across same-origin browser contexts (tabs/windows).
   - Near-instant latency (~2–5ms).
2. **Fallback & Storage Persistence (`localStorage`):**
   - Keys are prefixed with `cyberarena_`.
   - Room state is persisted to `cyberarena_room_{ROOM_CODE}`.
   - Cross-window event fallback listens to the `window.addEventListener("storage")` event for browser tabs lacking BroadcastChannel.

#### 3.2 Protocol Message Types
```typescript
type MessageType =
  | "TEAM_JOIN"          // Fired when a team registers into a room
  | "TEAM_LEAVE"         // Team gracefully exits
  | "TEAM_KICK"          // Admin removes a squad from the room
  | "TEAM_DQ"            // Admin or Proctor disqualifies a squad
  | "ROOM_CREATED"       // Admin creates a room
  | "MATCH_LAUNCH"       // Synchronized 15-minute challenge start
  | "QUIZ_SUBMIT"        // Squad submits completed answers
  | "AUDIT_COMPLETE"     // Post-match 2-minute freeze hold expires
  | "LEADERBOARD_READY"  // Official ranked results broadcast
  | "STATE_SYNC"         // Full room state synchronization payload
  | "REQUEST_SYNC";      // Newly joined tab requests room snapshot
```

---

### 4. Data Models & Schemas

#### 4.1 Room State (`RoomState`)
```json
{
  "roomCode": "XK94T2",
  "status": "WAITING | LIVE | AUDIT_HOLD | FINISHED",
  "createdAt": 1773328000000,
  "matchLaunchEpoch": 1773328500000,
  "quizEndEpoch": 1773329400000,
  "auditEndEpoch": 1773329520000,
  "teams": {
    "team_lx29_a7b": { /* TeamObject */ }
  },
  "leaderboard": [ /* RankedLeaderboardEntry[] */ ]
}
```

#### 4.2 Team Object (`TeamObject`)
```json
{
  "teamId": "team_1773328100_xk8d3",
  "teamName": "Byte Bandits",
  "teamLead": {
    "name": "Sarah Connor",
    "email": "sarah.connor@cyber.org"
  },
  "teammates": [
    "Kyle Reese",
    "John Connor",
    "Miles Dyson",
    "Marcus Wright"
  ],
  "status": "WAITING | IN_PROGRESS | SUBMITTED | DISQUALIFIED | EXPIRED",
  "joinedAt": 1773328120000,
  "quiz_start_epoch": 1773328500000,
  "quiz_finish_epoch": 1773328980000,
  "answers": [2, 1, 1, 1, 1, 0, 1, 1, 1, 1],
  "score": 10,
  "strikes": 0,
  "dqReason": null
}
```

#### 4.3 Question Schema (`Question`)
```typescript
interface Question {
  id: number;
  category: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  rationale: string;
}
```

---

### 5. Client-Side Proctoring State Machine (`src/proctor.js`)

#### 5.1 Event Interception & Debouncing
- Listens to `document.addEventListener("visibilitychange")` when `document.hidden === true`.
- Listens to `window.addEventListener("blur")`.
- Debounce window: A 500ms cooldown window prevents duplicate strike firing when both `visibilitychange` and `blur` trigger in rapid succession upon tab switching.

#### 5.2 Transition Logic
```
       [State: ACTIVE]
              │
       Tab Blur / Switch
              │
              ▼
       Strike Counter++
              ├── Strike == 1 ──> Trigger onStrike(1) [Show Modal Warning 1]
              ├── Strike == 2 ──> Trigger onStrike(2) [Show Modal Warning 2]
              └── Strike >= 3 ──> [State: TERMINATED]
                                      │
                                      ▼
                                Trigger onDisqualify()
                                Dispatch DISQUALIFIED (TAB_SWITCH_EXCEEDED)
                                Lock UI permanently
```

---

### 6. Deterministic Ranking Pipeline (`src/scoring.js`)

#### 6.1 Sorting Comparator Specification
The ranking comparator satisfies strict total ordering:
```javascript
function rankComparator(a, b) {
  const aDemoted = isDemotedStatus(a.status);
  const bDemoted = isDemotedStatus(b.status);

  // Step 1: Demoted teams sink to bottom
  if (aDemoted && !bDemoted) return 1;
  if (!aDemoted && bDemoted) return -1;

  // Step 2: Primary — Score descending
  const aScore = a.score || 0;
  const bScore = b.score || 0;
  if (bScore !== aScore) return bScore - aScore;

  // Step 3: Tie-breaker — Elapsed time ascending (faster wins)
  const aElapsed = calculateElapsedMs(a.quiz_start_epoch, a.quiz_finish_epoch);
  const bElapsed = calculateElapsedMs(b.quiz_start_epoch, b.quiz_finish_epoch);
  if (aElapsed !== bElapsed) return aElapsed - bElapsed;

  // Step 4: Secondary tie-breaker — Earliest finish timestamp
  const aFinish = a.quiz_finish_epoch || Infinity;
  const bFinish = b.quiz_finish_epoch || Infinity;
  return aFinish - bFinish;
}
```

#### 6.2 Complexity
- Sorting complexity: $\mathcal{O}(N \log N)$ where $N$ is the number of teams.
- Grading complexity: $\mathcal{O}(K)$ where $K = 10$ questions per submission.

---

### 7. Security Architecture & Threat Mitigation

| Attack Vector | Vulnerability | Mitigation Strategy |
|---|---|---|
| **DOM Injection / XSS** | Untrusted team/member names rendered into innerHTML | All dynamic strings pass through `escapeHtml()` text-node serialization before DOM insertion. |
| **Admin Privilege Escalation** | Unauthorized participants accessing match orchestration | Admin route protected by salted SHA-256 Web Crypto digest validation for authorized user `pravin0408`, brute-force rate-limiting (30s cooldown after 5 failed attempts), and `sessionStorage` clearance validation. Plaintext password is never present in code or DOM. |
| **Cheating via Focus Switching** | Reading answers in another browser tab / monitor | `visibilitychange` and `window.blur` anti-cheat focus monitor with 3-strike permanent disqualification. |
| **Score Tampering** | Client submitting arbitrarily inflated scores | Scores are computed deterministically by grading answer arrays against server-side/engine keys. |
| **Timing Tampering** | Client spoofing `quiz_start_epoch` | Start epoch is broadcast by Admin upon match launch and stored centrally in the room state. |

---

### 8. CI/CD & GitHub Automation Workflows

#### 8.1 `.github/workflows/deploy.yml`
- **Triggers:** Push to `main` or manual `workflow_dispatch`.
- **Pipeline:**
  1. Check out code (`actions/checkout@v4`).
  2. Setup Node.js 20 (`actions/setup-node@v4`).
  3. Install dependencies (`npm ci`).
  4. Run automated test suite (`npm test`).
  5. Assemble static deployment artifacts into `dist/`.
  6. Deploy directly to GitHub Pages (`actions/deploy-pages@v4`).

#### 8.2 `.github/workflows/push-code.yml`
- **Triggers:** Pull Request to `main` or manual `workflow_dispatch`.
- **Pipeline:**
  1. Checks out repository with `GITHUB_TOKEN`.
  2. Runs lint check (`npm run lint`).
  3. Executes test suite (`npm run test:ci`).
  4. Automatically formats and commits safe fixes on PR branches.

---

### 9. Test Verification Plan

All core logic is verified using Jest unit test cases in `tests/scoring.test.js`:
- `10/10 in 10m` strictly beats `9/10 in 5m` (Accuracy priority over speed).
- `9/10 in 8m` strictly beats `9/10 in 9m` (Tie-breaker elapsed time).
- `DISQUALIFIED` and `EXPIRED` teams are placed at the bottom regardless of score.
- Edge cases: Negative elapsed times, null/undefined inputs, and countdown formatting boundaries.
