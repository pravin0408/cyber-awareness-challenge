# CyberArena: Real-Time Cybersecurity Awareness & Defense Challenge

[![Deploy CyberArena Platform](https://github.com/pravin0408/cyber-awareness-challenge/actions/workflows/deploy.yml/badge.svg)](https://github.com/pravin0408/cyber-awareness-challenge/actions/workflows/deploy.yml)
[![Validate and Push Code](https://github.com/pravin0408/cyber-awareness-challenge/actions/workflows/push-code.yml/badge.svg)](https://github.com/pravin0408/cyber-awareness-challenge/actions/workflows/push-code.yml)

An enterprise-grade, real-time web application to host timed, proctored cybersecurity awareness challenges. Features modern SOC / War Room dark mode UX, client-side window focus anti-cheat proctoring, a 15-minute 10-question challenge engine, a deterministic tie-breaking scoring pipeline, and automated GitHub Actions workflows.

---

## 📑 Documentation

- **[Product Requirements Document (PRD)](./PRD.md)**: Full business vision, user personas, functional specifications, and KPI metrics.
- **[Technical Requirements Document (TRD)](./TRD.md)**: Architecture diagrams, real-time message bus specs, proctoring state machine, threat modeling, and CI/CD pipelines.

---

## 🚀 Key Features

- **Modern 3D Cyber WebGL Experience:** Interactive Three.js 3D Cyber Defense Core with rotating geodesic polyhedron, orbital rings, ambient particle field, undulating perspective cyber grid floor, smooth mouse parallax, and real-time reactive threat mode lighting (Normal Cyan &rarr; Launch Emerald &rarr; Warning Amber &rarr; Critical Crimson &rarr; Victory Gold).
- **Interactive 3D Card Tilt Physics:** Specular perspective tilt and depth layering on UI cards and HUD elements responding dynamically to cursor position.
- **Anti-Cheat Focus Proctoring Engine:** Client-side window-focus tracking (`visibilitychange` & `window.blur`). Tab switches or lost focus trigger strikes. **3 strikes = instant disqualification (`TAB_SWITCH_EXCEEDED`)**.
- **10-Question 15-Minute Timed Engine:** Realistic cybersecurity incident questions covering spear phishing header analysis, MFA push bombing, vishing, supply chain typosquatting, credential hygiene, QR quishing, and CI/CD pipeline exploits.
- **Deterministic Auto-Scoring:** Strict tie-breaking algorithms that prioritize **Accuracy** (correct answers out of 10) first, and **Elapsed Time** (`quiz_finish_epoch - quiz_start_epoch`) second. Disqualified/Expired teams are demoted to the bottom.
- **Zero-Cost Real-Time Architecture:** Uses the native browser `BroadcastChannel` API and `localStorage` to synchronize Participant tabs and Admin tabs in genuine real time without requiring a paid WebSocket server.
- **Secured Admin Command Center:** Security clearance gate with username & password authentication (`admin` / `CyberAdmin@2026`), room code generation, participant kick/DQ actions, and post-match audit holds.

---

## 🛠️ Quickstart & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Test Suite
Executes unit tests verifying tie-breaker sorting, elapsed calculation, and answer grading:
```bash
npm test
```

### 3. Start Local Server
```bash
npm start
```
Open **[http://localhost:3000/public/index.html](http://localhost:3000/public/index.html)** in your browser.

---

## 👥 Multi-Tab Demo Guide

1. **Admin Window:**
   - Open [http://localhost:3000/public/index.html](http://localhost:3000/public/index.html).
   - Click **Admin** &rarr; Log in (`admin` / `CyberAdmin@2026` or use "Auto-Fill").
   - Click **Generate New Room Code** (e.g. `ABC123`).
2. **Participant Window:**
   - Open a second browser tab at [http://localhost:3000/public/index.html](http://localhost:3000/public/index.html).
   - Click **Participant** &rarr; Enter your team name, room code, team lead, and 4 teammate names.
   - Click **Join War Room**.
3. **Launch & Compete:**
   - In the **Admin Window**, click **Broadcast Launch Signal**. Both windows will immediately transition into the synchronized 15-minute challenge.
   - Test anti-cheat: Switch away from the participant tab to trigger strikes.

---

## 📦 Directory Structure

```
├── .github/
│   └── workflows/
│       ├── deploy.yml            # CI/CD: Test, package, and deploy to GitHub Pages
│       └── push-code.yml         # CI/CD: Automated linting, test validation, and PR sync
├── docs/
├── public/
│   ├── index.html                # Multi-view SPA container with Google Fonts
│   └── styles.css                # Next-gen Cyber SOC / War Room design system
├── src/
│   ├── app.js                    # SPA state machine, view router, and Admin auth
│   ├── mockBackend.js            # Real-time BroadcastChannel + localStorage bus
│   ├── proctor.js                # Focus tracking, 3-strike state machine, DQ dispatcher
│   ├── questions.js              # 10 realistic cybersecurity threat questions
│   └── scoring.js                # Deterministic scoring & tie-breaker comparator
├── tests/
│   └── scoring.test.js           # Unit tests validating deterministic sorting
├── .gitignore
├── package.json
├── PRD.md                        # Product Requirements Document
├── TRD.md                        # Technical Requirements Document
└── README.md                     # Deployment and runbook documentation
```

---

## 🛡️ License
MIT License.
