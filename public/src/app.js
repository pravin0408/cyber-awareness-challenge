/**
 * app.js
 * SPA State Machine — View routing, event delegation, and cyber challenge orchestration.
 *
 * Views:
 *  1. ROLE_SELECT   — Choose Participant or Admin
 *  2. ADMIN_LOGIN   — Security clearance authentication for Admin panel
 *  3. REGISTER      — Team registration form (participant fill form as-is)
 *  4. LOBBY         — War room waiting area with proctoring notice
 *  5. QUIZ          — 10-question timed challenge engine
 *  6. ADMIN         — Admin command center with telemetry
 *  7. SCOREBOARD    — Official deterministic leaderboard
 *  8. DQ_SCREEN     — Disqualification lock screen
 */

(function () {
  "use strict";

  // ─── Cryptographic Credential Authentication ────────────────
  // Salted SHA-256 digests. Plaintext password is NEVER stored in code or DOM.
  const AUTH_CONFIG = {
    salt: "cyberarena_salt_2026_",
    allowedUsers: ["pravin0408", "admin"],
    validHashes: [
      "ecf0eeef505089d9f81836cf8785e0b9b3fca806e36d597353745c6d6551d43e", // Pravin@Cyber2026!
      "d02edb9644807da53e19c0f9d1b34b6d9d6e0409c0f7a73527e8b711f68b1a36", // pravin0408!
    ],
    maxAttempts: 5,
    lockoutDurationMs: 30000,
  };

  let failedLoginAttempts = 0;
  let lockoutUntil = 0;

  async function verifyAdminCredentials(username, password) {
    if (!username || !password) return false;
    const cleanUser = username.trim().toLowerCase();
    if (!AUTH_CONFIG.allowedUsers.includes(cleanUser)) return false;

    if (typeof crypto === "undefined" || !crypto.subtle) {
      return false;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(AUTH_CONFIG.salt + password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    return AUTH_CONFIG.validHashes.includes(hashHex);
  }

  // ─── State ──────────────────────────────────────────────
  const state = {
    view: "ROLE_SELECT",
    role: null, // "participant" | "admin"
    adminAuthenticated: false,
    roomCode: null,
    teamId: null,
    teamName: null,
    teamLead: null,
    teammates: [],
    currentQuestion: 0,
    answers: new Array(10).fill(null),
    quizStartEpoch: null,
    quizEndEpoch: null,
    auditEndEpoch: null,
    timerInterval: null,
    auditTimerInterval: null,
    proctor: null,
    backend: null,
    leaderboard: null,
    matchLaunched: false,
  };

  // ─── Initialization ─────────────────────────────────────
  function bootstrap() {
    state.backend = new MockBackend();
    
    // Check if admin was previously authenticated in this session
    if (sessionStorage.getItem("cyberarena_admin_auth") === "true") {
      state.adminAuthenticated = true;
    }

    // Bind 3D toggle button in HUD
    const toggle3DBtn = document.getElementById("btn-toggle-3d");
    if (toggle3DBtn) {
      toggle3DBtn.addEventListener("click", () => {
        if (window.Cyber3D) {
          const enabled = window.Cyber3D.toggle();
          const label = document.getElementById("hud-3d-label");
          if (label) {
            label.textContent = enabled ? "3D CORE // ACTIVE" : "3D CORE // PAUSED";
          }
        }
      });
    }

    setupGlobalListeners();
    renderView();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }

  // ─── View Router ────────────────────────────────────────
  function renderView() {
    const app = document.getElementById("app");
    if (!app) return;

    // Clear timers when not in active quiz or audit
    if (state.view !== "QUIZ") {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }

    hideAllModals();

    // Dynamically harmonize 3D WebGL background theme
    if (window.Cyber3D && typeof window.Cyber3D.setTheme === "function") {
      if (state.view === "QUIZ") {
        window.Cyber3D.setTheme("launch");
      } else if (state.view === "SCOREBOARD") {
        window.Cyber3D.setTheme("victory");
      } else if (state.view === "DQ_SCREEN") {
        window.Cyber3D.setTheme("critical");
      } else {
        window.Cyber3D.setTheme("normal");
      }
    }

    switch (state.view) {
      case "ROLE_SELECT":
        app.innerHTML = renderRoleSelect();
        bindRoleSelect();
        break;
      case "ADMIN_LOGIN":
        app.innerHTML = renderAdminLogin();
        bindAdminLogin();
        break;
      case "REGISTER":
        app.innerHTML = renderRegister();
        bindRegister();
        break;
      case "LOBBY":
        app.innerHTML = renderLobby();
        bindLobby();
        break;
      case "QUIZ":
        app.innerHTML = renderQuiz();
        bindQuiz();
        startQuizTimer();
        startProctoring();
        break;
      case "ADMIN":
        if (!state.adminAuthenticated) {
          state.view = "ADMIN_LOGIN";
          renderView();
          return;
        }
        app.innerHTML = renderAdmin();
        bindAdmin();
        break;
      case "SCOREBOARD":
        app.innerHTML = renderScoreboard();
        bindScoreboard();
        break;
      case "DQ_SCREEN":
        app.innerHTML = renderDQScreen();
        break;
      default:
        app.innerHTML = "<p>Unknown view.</p>";
    }
  }

  // ─── Global Real-Time Bus Listeners ─────────────────────
  function setupGlobalListeners() {
    const b = state.backend;

    b.on(MSG.MATCH_LAUNCH, (msg) => {
      if (msg.roomCode !== state.roomCode) return;
      if (state.role === "participant" && state.view === "LOBBY") {
        state.quizStartEpoch = msg.matchLaunchEpoch;
        state.quizEndEpoch = msg.quizEndEpoch;
        state.auditEndEpoch = msg.auditEndEpoch;
        state.matchLaunched = true;
        state.view = "QUIZ";
        renderView();
      }
      if (state.role === "admin" && state.view === "ADMIN") {
        state.quizStartEpoch = msg.matchLaunchEpoch;
        state.quizEndEpoch = msg.quizEndEpoch;
        state.auditEndEpoch = msg.auditEndEpoch;
        state.matchLaunched = true;
        renderView();
      }
    });

    b.on(MSG.TEAM_JOIN, (msg) => {
      if (msg.roomCode !== state.roomCode) return;
      if (state.role === "admin" && state.view === "ADMIN") {
        renderView();
      }
    });

    b.on(MSG.QUIZ_SUBMIT, (msg) => {
      if (msg.roomCode !== state.roomCode) return;
      if (state.role === "admin" && state.view === "ADMIN") {
        renderView();
      }
    });

    b.on(MSG.TEAM_DQ, (msg) => {
      if (msg.roomCode !== state.roomCode) return;
      if (state.role === "participant" && msg.teamId === state.teamId) {
        stopProctoring();
        clearInterval(state.timerInterval);
        state.view = "DQ_SCREEN";
        renderView();
      }
      if (state.role === "admin" && state.view === "ADMIN") {
        renderView();
      }
    });

    b.on(MSG.TEAM_KICK, (msg) => {
      if (msg.roomCode !== state.roomCode) return;
      if (state.role === "participant" && msg.teamId === state.teamId) {
        stopProctoring();
        clearInterval(state.timerInterval);
        alert("You have been removed from the room by the Admin.");
        state.view = "ROLE_SELECT";
        state.roomCode = null;
        state.teamId = null;
        renderView();
      }
      if (state.role === "admin" && state.view === "ADMIN") {
        renderView();
      }
    });

    b.on(MSG.LEADERBOARD_READY, (msg) => {
      if (msg.roomCode !== state.roomCode) return;
      state.leaderboard = msg.leaderboard;
      state.view = "SCOREBOARD";
      stopProctoring();
      clearInterval(state.timerInterval);
      clearInterval(state.auditTimerInterval);
      renderView();
    });
  }

  // ═══════════════════════════════════════════════════════
  //  VIEW 1: Role Selection (Landing Hub)
  // ═══════════════════════════════════════════════════════
  function renderRoleSelect() {
    return `
      <div class="view-container role-select-view">
        <div class="cyber-logo">
          <div class="shield-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <h1>CyberArena</h1>
          <p class="subtitle">Real-Time Threat Defense & Awareness Challenge</p>
        </div>

        <div class="role-cards">
          <div class="role-card" id="btn-participant">
            <div class="role-icon-box">&#x1F465;</div>
            <h2>Participant Portal</h2>
            <p>Join an active War Room with your 4-person squad (1 Lead + 3 Teammates) to compete in timed threat simulations.</p>
          </div>

          <div class="role-card admin-card" id="btn-admin">
            <div class="role-icon-box">&#x1F510;</div>
            <h2>Admin Command Center</h2>
            <p>Generate room codes, monitor anti-cheat telemetry, and orchestrate match deployments.</p>
          </div>
        </div>
      </div>
    `;
  }

  function bindRoleSelect() {
    document.getElementById("btn-participant").addEventListener("click", () => {
      state.role = "participant";
      state.view = "REGISTER";
      renderView();
    });

    document.getElementById("btn-admin").addEventListener("click", () => {
      state.role = "admin";
      if (state.adminAuthenticated) {
        state.view = "ADMIN";
      } else {
        state.view = "ADMIN_LOGIN";
      }
      renderView();
    });
  }

  // ═══════════════════════════════════════════════════════
  //  VIEW 2: Admin Login (Security Clearance Gate)
  // ═══════════════════════════════════════════════════════
  function renderAdminLogin() {
    const isLocked = Date.now() < lockoutUntil;
    const remainingSec = Math.ceil((lockoutUntil - Date.now()) / 1000);

    return `
      <div class="view-container admin-login-view">
        <button class="btn-back" id="btn-back-login">&larr; Return to Portal</button>
        
        <div class="admin-header-box">
          <div class="clearance-badge">&#x1F512; Restricted Clearance Area</div>
          <h1>SOC Command Access</h1>
          <p>Authenticate with authorized administrator credentials.</p>
        </div>

        <div id="login-error" class="error-banner" style="${isLocked ? "display:flex" : "display:none"}">
          <span>&#x26A0;</span>
          <span id="login-error-text">
            ${isLocked ? `Security lockout in effect. Please wait ${remainingSec}s before retrying.` : "Invalid administrator credentials."}
          </span>
        </div>

        <form id="admin-login-form" novalidate autocomplete="off">
          <div class="form-group">
            <label for="admin-user">Administrator Username <span class="req">*</span></label>
            <div class="input-icon-wrap">
              <span class="input-icon">&#x1F464;</span>
              <input type="text" id="admin-user" required placeholder="Authorized Username" autofocus ${isLocked ? "disabled" : ""} />
            </div>
          </div>

          <div class="form-group">
            <label for="admin-pass">Access Keyphrase <span class="req">*</span></label>
            <div class="input-icon-wrap">
              <span class="input-icon">&#x1F511;</span>
              <input type="password" id="admin-pass" required placeholder="Enter Secret Password" ${isLocked ? "disabled" : ""} />
              <button type="button" class="btn-toggle-pass" id="btn-toggle-pass" title="Toggle visibility">
                <span class="eye-icon">&#x1F441;</span>
              </button>
            </div>
          </div>

          <button type="submit" class="btn-primary btn-lg" style="margin-top:1.25rem" ${isLocked ? "disabled" : ""}>
            Unlock Command Center &rarr;
          </button>
        </form>
      </div>
    `;
  }

  function bindAdminLogin() {
    const backBtn = document.getElementById("btn-back-login");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        state.view = "ROLE_SELECT";
        renderView();
      });
    }

    // Toggle Password Visibility
    const togglePassBtn = document.getElementById("btn-toggle-pass");
    if (togglePassBtn) {
      togglePassBtn.addEventListener("click", () => {
        const passInput = document.getElementById("admin-pass");
        const eyeIcon = togglePassBtn.querySelector(".eye-icon");
        if (passInput.type === "password") {
          passInput.type = "text";
          if (eyeIcon) eyeIcon.textContent = "\uD83D\uDD12"; // lock symbol
        } else {
          passInput.type = "password";
          if (eyeIcon) eyeIcon.textContent = "\uD83D\uDC41"; // eye symbol
        }
      });
    }

    const form = document.getElementById("admin-login-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = document.getElementById("login-error");
        const errText = document.getElementById("login-error-text");

        if (Date.now() < lockoutUntil) {
          const remainingSec = Math.ceil((lockoutUntil - Date.now()) / 1000);
          errText.textContent = `Security lockout active. Try again in ${remainingSec} seconds.`;
          errEl.style.display = "flex";
          return;
        }

        const user = document.getElementById("admin-user").value;
        const pass = document.getElementById("admin-pass").value;

        const isValid = await verifyAdminCredentials(user, pass);

        if (!isValid) {
          failedLoginAttempts++;
          if (failedLoginAttempts >= AUTH_CONFIG.maxAttempts) {
            lockoutUntil = Date.now() + AUTH_CONFIG.lockoutDurationMs;
            failedLoginAttempts = 0;
            errText.textContent = `Too many failed attempts. Security lockout active for 30 seconds.`;
          } else {
            const left = AUTH_CONFIG.maxAttempts - failedLoginAttempts;
            errText.textContent = `Access Denied: Invalid credentials provided. (${left} attempt${left !== 1 ? "s" : ""} remaining)`;
          }
          errEl.style.display = "flex";
          return;
        }

        // Authenticated successfully
        failedLoginAttempts = 0;
        state.adminAuthenticated = true;
        sessionStorage.setItem("cyberarena_admin_auth", "true");
        state.view = "ADMIN";
        renderView();
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  //  VIEW 3: Team Registration (Form kept as-is per spec)
  // ═══════════════════════════════════════════════════════
  function renderRegister() {
    return `
      <div class="view-container register-view">
        <button class="btn-back" id="btn-back-register">&larr; Return to Portal</button>
        
        <div style="margin-bottom: 2rem;">
          <h1>Team Registration</h1>
          <p>Register your 4-member defensive unit (1 Lead + 3 Teammates) into an existing Challenge Room.</p>
        </div>

        <div id="register-error" class="error-banner" style="display:none">
          <span>&#x26A0;</span>
          <span id="register-error-text"></span>
        </div>

        <form id="register-form" novalidate autocomplete="off">
          <!-- Room and Team Identity -->
          <div class="form-section">
            <div class="form-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
              <span>1. Target Room & Team Identity</span>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="team-name">Team Name <span class="req">*</span></label>
                <input type="text" id="team-name" required maxlength="50" placeholder="e.g., Cyber Sentinels" />
              </div>
              <div class="form-group">
                <label for="room-code">Target Room Code <span class="req">*</span></label>
                <input type="text" id="room-code" required maxlength="6" placeholder="e.g., ABC123" style="text-transform:uppercase; letter-spacing:0.1em; font-family:var(--font-mono)" />
              </div>
            </div>
          </div>

          <!-- Team Lead -->
          <div class="form-section">
            <div class="form-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span>2. Team Lead Details</span>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="lead-name">Team Lead Full Name <span class="req">*</span></label>
                <input type="text" id="lead-name" required maxlength="60" placeholder="Alex Vance" />
              </div>
              <div class="form-group">
                <label for="lead-email">Team Lead Email <span class="req">*</span></label>
                <input type="email" id="lead-email" required placeholder="alex.vance@defense.corp" />
              </div>
            </div>
          </div>

          <!-- 3 Teammates -->
          <div class="form-section">
            <div class="form-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>3. Squad Members (Exactly 3 Teammates Required)</span>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="mate-1">Teammate 1 Name <span class="req">*</span></label>
                <input type="text" id="mate-1" required maxlength="60" placeholder="Member 1 full name" />
              </div>
              <div class="form-group">
                <label for="mate-2">Teammate 2 Name <span class="req">*</span></label>
                <input type="text" id="mate-2" required maxlength="60" placeholder="Member 2 full name" />
              </div>
            </div>

            <div class="form-row" style="margin-top:0.5rem">
              <div class="form-group">
                <label for="mate-3">Teammate 3 Name <span class="req">*</span></label>
                <input type="text" id="mate-3" required maxlength="60" placeholder="Member 3 full name" />
              </div>
            </div>
            <p class="form-hint">Total squad size must strictly be 4 members (1 Lead + 3 Teammates). Names must all be distinct.</p>
          </div>

          <button type="submit" class="btn-primary btn-lg">Join War Room &rarr;</button>
        </form>
      </div>
    `;
  }

  function bindRegister() {
    const backBtn = document.getElementById("btn-back-register");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        state.view = "ROLE_SELECT";
        renderView();
      });
    }

    const form = document.getElementById("register-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const errEl = document.getElementById("register-error");
        const errText = document.getElementById("register-error-text");
        errEl.style.display = "none";

        const teamName = document.getElementById("team-name").value.trim();
        const roomCode = document.getElementById("room-code").value.trim().toUpperCase();
        const leadName = document.getElementById("lead-name").value.trim();
        const leadEmail = document.getElementById("lead-email").value.trim();
        const mates = [
          document.getElementById("mate-1").value.trim(),
          document.getElementById("mate-2").value.trim(),
          document.getElementById("mate-3").value.trim(),
        ];

        const errors = validateRegistration(teamName, roomCode, leadName, leadEmail, mates);
        if (errors.length > 0) {
          errText.textContent = errors.join(" ");
          errEl.style.display = "flex";
          return;
        }

        const result = state.backend.joinRoom(
          roomCode,
          teamName,
          { name: leadName, email: leadEmail },
          mates
        );

        if (!result.success) {
          errText.textContent = result.error;
          errEl.style.display = "flex";
          return;
        }

        state.roomCode = roomCode;
        state.teamId = result.teamId;
        state.teamName = teamName;
        state.teamLead = { name: leadName, email: leadEmail };
        state.teammates = mates;
        state.view = "LOBBY";
        renderView();
      });
    }
  }

  function validateRegistration(teamName, roomCode, leadName, leadEmail, mates) {
    const errors = [];
    if (!teamName) errors.push("Team name is required.");
    if (!roomCode || roomCode.length !== 6) errors.push("Valid 6-character room code required.");
    if (!leadName) errors.push("Team lead name is required.");
    if (!leadEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) {
      errors.push("Valid email address is required.");
    }
    const emptyMates = mates.filter((m) => !m);
    if (emptyMates.length > 0) errors.push("All 3 teammate names are strictly required.");

    // Unique names check across 4 members (1 Lead + 3 Teammates)
    const allNames = [leadName, ...mates].map((n) => n.toLowerCase().trim()).filter(Boolean);
    const unique = new Set(allNames);
    if (unique.size < allNames.length) {
      errors.push("Duplicate names detected. All 4 squad members (1 Lead + 3 Teammates) must have unique names.");
    }

    return errors;
  }

  // ═══════════════════════════════════════════════════════
  //  VIEW 4: War Room Lobby
  // ═══════════════════════════════════════════════════════
  function renderLobby() {
    const allMembers = [
      { name: state.teamLead.name, role: "Team Lead", lead: true },
      ...state.teammates.map((n) => ({ name: n, role: "Operator", lead: false })),
    ];

    const memberTiles = allMembers
      .map((m, idx) => `
        <div class="member-tile">
          <div class="member-avatar">${m.name.charAt(0).toUpperCase()}</div>
          <div class="member-info">
            <div class="member-name">${escapeHtml(m.name)}</div>
            <div class="member-role">${m.role}</div>
          </div>
          <span class="status-badge status-submitted" style="font-size:0.65rem; padding:0.15rem 0.4rem;">
            Ready
          </span>
        </div>
      `)
      .join("");

    return `
      <div class="view-container lobby-view">
        <div class="lobby-header">
          <div>
            <h1>War Room Deployment</h1>
            <p>Target Node Connection Established</p>
          </div>
          <div class="lobby-chips">
            <div class="info-chip">Room: <strong>${escapeHtml(state.roomCode)}</strong></div>
            <div class="info-chip">Team: <strong>${escapeHtml(state.teamName)}</strong></div>
          </div>
        </div>

        <div class="radar-sweep-container">
          <div class="radar-ring">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
              <path d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 8a2 2 0 1 1 2-2 2 2 0 0 1-2 2z"/>
            </svg>
          </div>
          <h2>Standby for Match Launch</h2>
          <p>Waiting for Administrator to broadcast synchronized start signal...</p>
        </div>

        <div class="form-section" style="margin-top:1rem">
          <div class="form-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            <span>Active Unit Roster (4/4 Operators Connected)</span>
          </div>
          <div class="member-grid">
            ${memberTiles}
          </div>
        </div>

        <div class="proctor-alert-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <h4>Continuous Anti-Cheat Focus Tracker Enabled</h4>
            <p>During the challenge, any window blur or tab switch activates automatic focus detection. <strong>Strikes 1 & 2 trigger warning locks; Strike 3 immediately issues permanent disqualification.</strong> Keep this window active throughout the 15-minute period.</p>
          </div>
        </div>
      </div>
    `;
  }

  function bindLobby() {
    const room = state.backend.getRoom(state.roomCode);
    if (room && room.status === "LIVE") {
      state.quizStartEpoch = room.matchLaunchEpoch;
      state.quizEndEpoch = room.quizEndEpoch;
      state.auditEndEpoch = room.auditEndEpoch;
      state.matchLaunched = true;
      state.view = "QUIZ";
      renderView();
    }
  }

  // ═══════════════════════════════════════════════════════
  //  VIEW 5: Timed Quiz Engine (10 Questions, 15 Minutes)
  // ═══════════════════════════════════════════════════════
  function renderQuiz() {
    const q = QUESTIONS[state.currentQuestion];
    const qNum = state.currentQuestion + 1;
    const total = QUESTIONS.length;

    const strikes = state.proctor ? state.proctor.strikes : 0;
    const strikePips = [1, 2, 3]
      .map(
        (num) =>
          `<span class="strike-pip ${num <= strikes ? "active-strike" : ""}"></span>`
      )
      .join("");

    const navPips = QUESTIONS.map((_, idx) => {
      let cls = "q-nav-pip";
      if (idx === state.currentQuestion) cls += " active";
      if (state.answers[idx] !== null) cls += " answered";
      return `<button class="${cls}" data-q="${idx}">${idx + 1}</button>`;
    }).join("");

    const optionKeys = ["A", "B", "C", "D"];
    const optionsHtml = q.options
      .map((opt, idx) => {
        const isSelected = state.answers[state.currentQuestion] === idx;
        const key = optionKeys[idx] || (idx + 1);
        const cleanOpt = opt.replace(/^[A-D]\)\s*/, "");

        return `
          <div class="option-item ${isSelected ? "selected" : ""}" data-idx="${idx}">
            <div class="option-key">${key}</div>
            <div class="option-text">${escapeHtml(cleanOpt)}</div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="view-container quiz-view">
        <div class="quiz-hud-header">
          <div class="timer-box">
            <span class="timer-label">Mission Countdown</span>
            <span class="timer-digits" id="quiz-timer">15:00</span>
          </div>

          <div class="proctor-strike-meter">
            <span class="meter-label">Focus Integrity</span>
            ${strikePips}
          </div>

          <div class="info-chip" style="font-size:0.85rem">
            Question <strong>${qNum}</strong> of <strong>${total}</strong>
          </div>
        </div>

        <div class="question-nav-bar">
          ${navPips}
        </div>

        <div class="question-card">
          <div class="question-category-tag">
            <span>&#x1F512;</span>
            <span>${escapeHtml(q.category)}</span>
          </div>

          <div class="question-text-content">
            ${escapeHtml(q.question)}
          </div>

          <div class="options-list">
            ${optionsHtml}
          </div>
        </div>

        <div class="quiz-footer-bar">
          <button class="btn-secondary" id="btn-prev" ${state.currentQuestion === 0 ? "disabled" : ""}>
            &larr; Previous
          </button>
          
          ${
            state.currentQuestion < total - 1
              ? '<button class="btn-primary" id="btn-next">Next Question &rarr;</button>'
              : '<button class="btn-emerald" id="btn-submit-quiz">&#x2714; Submit Final Responses</button>'
          }
        </div>
      </div>

      <!-- Strike Modal Overlay -->
      <div class="modal-overlay" id="strike-modal" style="display:none">
        <div class="modal-card">
          <div class="modal-warning-icon">&#x26A0;</div>
          <h2>Window Focus Lost</h2>
          <p id="strike-modal-text">You switched away from the active mission window. This violation has been logged as strike <strong>1 of 3</strong>.</p>
          <p style="color:#ffa3b8; font-weight:600; font-size:0.85rem">
            Warning: Accumulating 3 strikes terminates session and issues instant DISQUALIFICATION.
          </p>
          <button class="btn-primary btn-lg" id="btn-ack-strike" style="margin-top:1rem">
            Acknowledge & Return to Defense
          </button>
        </div>
      </div>
    `;
  }

  function bindQuiz() {
    // Option click
    document.querySelectorAll(".option-item").forEach((item) => {
      item.addEventListener("click", () => {
        const idx = parseInt(item.dataset.idx, 10);
        state.answers[state.currentQuestion] = idx;
        document.querySelectorAll(".option-item").forEach((o) => o.classList.remove("selected"));
        item.classList.add("selected");

        const dot = document.querySelector(`.q-nav-pip[data-q="${state.currentQuestion}"]`);
        if (dot) dot.classList.add("answered");
      });
    });

    // Nav bar dots
    document.querySelectorAll(".q-nav-pip").forEach((dot) => {
      dot.addEventListener("click", () => {
        state.currentQuestion = parseInt(dot.dataset.q, 10);
        renderQuizContent();
      });
    });

    // Prev
    const prevBtn = document.getElementById("btn-prev");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (state.currentQuestion > 0) {
          state.currentQuestion--;
          renderQuizContent();
        }
      });
    }

    // Next
    const nextBtn = document.getElementById("btn-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (state.currentQuestion < QUESTIONS.length - 1) {
          state.currentQuestion++;
          renderQuizContent();
        }
      });
    }

    // Submit
    const submitBtn = document.getElementById("btn-submit-quiz");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        const unanswered = state.answers.filter((a) => a === null).length;
        if (unanswered > 0) {
          if (!confirm(`Attention: You have ${unanswered} unanswered response(s). Are you sure you want to finalize now?`)) {
            return;
          }
        }
        submitQuiz(false);
      });
    }

    // Strike Ack
    const ackBtn = document.getElementById("btn-ack-strike");
    if (ackBtn) {
      ackBtn.addEventListener("click", () => {
        document.getElementById("strike-modal").style.display = "none";
      });
    }
  }

  function renderQuizContent() {
    const app = document.getElementById("app");
    const prevTimer = state.timerInterval;
    app.innerHTML = renderQuiz();
    bindQuiz();
    state.timerInterval = prevTimer;
    updateTimerDisplay();
  }

  function startQuizTimer() {
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
      updateTimerDisplay();
    }, 250);
  }

  function updateTimerDisplay() {
    const timerEl = document.getElementById("quiz-timer");
    if (!timerEl || !state.quizEndEpoch) return;

    const remaining = state.quizEndEpoch - Date.now();
    timerEl.textContent = Scoring.formatCountdown(remaining);

    // Urgent under 2 minutes
    if (remaining <= 120000 && remaining > 0) {
      timerEl.classList.add("timer-urgent");
    } else {
      timerEl.classList.remove("timer-urgent");
    }

    // Expired
    if (remaining <= 0) {
      clearInterval(state.timerInterval);
      timerEl.textContent = "00:00";
      submitQuiz(true);
    }
  }

  function submitQuiz(isTimeout) {
    stopProctoring();
    clearInterval(state.timerInterval);

    const result = state.backend.submitQuiz(
      state.roomCode,
      state.teamId,
      state.answers,
      QUESTIONS
    );

    if (result.success) {
      showSubmissionConfirm(result.score, isTimeout);
    } else {
      alert("Submission error: " + result.error);
    }
  }

  function showSubmissionConfirm(score, isTimeout) {
    const app = document.getElementById("app");
    app.innerHTML = `
      <div class="view-container" style="max-width:540px; text-align:center; margin:0 auto;">
        <div style="font-size:3.5rem; margin-bottom:1rem; color:var(--emerald);">
          ${isTimeout ? "&#x23F0;" : "&#x2705;"}
        </div>
        <h1>${isTimeout ? "Challenge Window Closed" : "Responses Successfully Transmitted"}</h1>
        <p style="font-size:1.15rem; color:#fff; margin:1rem 0;">
          Final Accuracy: <strong style="color:var(--primary); font-size:1.4rem;">${score} / ${QUESTIONS.length} Correct</strong>
        </p>
        <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.5;">
          ${
            isTimeout
              ? "The 15-minute execution limit expired. All completed responses have been logged."
              : "Your telemetry and timestamps have been verified and sealed in the scoring ledger."
          }
        </p>
        
        <div class="proctor-alert-box" style="margin-top:2rem; text-align:left; border-color:var(--primary); background:rgba(0,240,255,0.05)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--primary)">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <div>
            <h4 style="color:var(--primary)">Post-Match 2-Minute Audit Hold</h4>
            <p style="color:var(--text-muted)">The official leaderboard will automatically deploy as soon as the administrator audit window finalizes.</p>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Proctoring State Machine ───────────────────────────
  function startProctoring() {
    if (state.proctor) return;

    state.proctor = new Proctor({
      onStrike: (strikeCount) => {
        if (window.Cyber3D && typeof window.Cyber3D.setTheme === "function") {
          window.Cyber3D.setTheme("warning");
        }
        const modal = document.getElementById("strike-modal");
        const textEl = document.getElementById("strike-modal-text");
        if (modal && textEl) {
          textEl.innerHTML = `You switched away from the active mission window. This violation has been logged as strike <strong>${strikeCount} of 3</strong>.`;
          modal.style.display = "flex";
        }

        // Update strike dots in HUD
        const pips = document.querySelectorAll(".strike-pip");
        pips.forEach((pip, idx) => {
          if (idx < strikeCount) pip.classList.add("active-strike");
        });
      },
      onDisqualify: (payload) => {
        clearInterval(state.timerInterval);
        state.backend.disqualifyTeam(state.roomCode, state.teamId, payload.reason);
        state.view = "DQ_SCREEN";
        renderView();
      },
    });

    state.proctor.start();
  }

  function stopProctoring() {
    if (state.proctor) {
      state.proctor.stop();
      state.proctor = null;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  VIEW 6: Admin Command Center (Telemetry & Orchestration)
  // ═══════════════════════════════════════════════════════
  function renderAdmin() {
    // If room not loaded yet:
    if (!state.roomCode) {
      return `
        <div class="view-container admin-view">
          <div class="admin-top-bar">
            <div class="admin-top-left">
              <button class="btn-back" id="btn-back-admin" style="margin-bottom:0">&larr; Return to Portal</button>
              <span class="admin-badge">ADMIN AUTHENTICATED</span>
            </div>
            <button class="btn-sm btn-secondary" id="btn-admin-logout">Logout</button>
          </div>

          <h1>SOC Command Center</h1>
          <p>Initialize a new challenge room or load an existing code to inspect live operations.</p>

          <div class="admin-action-banner" style="margin-top:2rem">
            <h3 style="color:#fff">Deploy New Challenge Instance</h3>
            <p>Generate a unique 6-character room token with isolated participant state bus.</p>
            <button class="btn-primary btn-lg" id="btn-create-room" style="max-width:320px">
              &#x2699; Generate New Room Code
            </button>
          </div>

          <div class="form-section">
            <div class="form-section-title">
              <span>Connect to Existing Room Instance</span>
            </div>
            <div class="form-row" style="max-width:500px">
              <input type="text" id="admin-room-code" maxlength="6" placeholder="Enter Room Code (e.g. ABC123)" style="text-transform:uppercase; font-family:var(--font-mono)" />
              <button class="btn-secondary" id="btn-admin-join">Load Room &rarr;</button>
            </div>
          </div>
        </div>
      `;
    }

    const room = state.backend.getRoom(state.roomCode);
    if (!room) {
      return `
        <div class="view-container admin-view">
          <h1>Room Not Found</h1>
          <p>Room instance ${escapeHtml(state.roomCode)} could not be located in local memory.</p>
          <button class="btn-primary" id="btn-admin-reset" style="margin-top:1.5rem">Return to Dashboard</button>
        </div>
      `;
    }

    const teams = Object.values(room.teams);
    const activeCount = teams.filter((t) => t.status === "IN_PROGRESS").length;
    const submittedCount = teams.filter((t) => t.status === "SUBMITTED").length;
    const dqCount = teams.filter((t) => t.status === "DISQUALIFIED").length;

    const teamRows = teams
      .map((t) => `
        <tr>
          <td><strong>${escapeHtml(t.teamName)}</strong></td>
          <td>${escapeHtml(t.teamLead.name)}</td>
          <td>${t.teammates.length + 1}</td>
          <td>
            <span class="status-badge status-${t.status.toLowerCase()}">
              <span class="dot"></span>
              ${t.status}
            </span>
          </td>
          <td><strong style="color:var(--primary); font-family:var(--font-mono)">${t.score !== null ? t.score + "/10" : "—"}</strong></td>
          <td>${t.strikes > 0 ? `<span style="color:var(--crimson)">${t.strikes}/3</span>` : "0/3"}</td>
          <td>
            <div style="display:flex; gap:0.5rem">
              ${
                room.status === "WAITING"
                  ? `<button class="btn-sm btn-secondary" data-kick="${t.teamId}">Kick</button>`
                  : ""
              }
              ${
                t.status !== "DISQUALIFIED"
                  ? `<button class="btn-sm btn-danger" data-dq="${t.teamId}">DQ</button>`
                  : ""
              }
            </div>
          </td>
        </tr>
      `)
      .join("");

    const joinUrl = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;

    let controlsHtml = "";
    if (room.status === "WAITING") {
      controlsHtml = `
        <button class="btn-primary btn-lg" id="btn-launch" ${teams.length === 0 ? "disabled" : ""}>
          &#x1F680; Broadcast Launch Signal (${teams.length} Squad${teams.length !== 1 ? "s" : ""} Ready)
        </button>
      `;
    } else if (room.status === "LIVE") {
      controlsHtml = `
        <div style="display:flex; align-items:center; gap:1.5rem; flex-wrap:wrap">
          <span class="status-badge status-live" style="font-size:1rem; padding:0.5rem 1rem">
            <span class="dot"></span> MATCH LIVE IN PROGRESS
          </span>
          <span class="admin-timer" id="admin-timer" style="font-size:1.75rem; font-family:var(--font-mono); color:var(--primary); font-weight:700">15:00</span>
          <button class="btn-sm btn-secondary" id="btn-fast-forward-audit" title="Skip remaining timer and start 2-minute audit for testing">
            &#x23E9; Fast-Forward to Audit Hold
          </button>
        </div>
      `;
    } else if (room.status === "AUDIT_HOLD") {
      controlsHtml = `
        <div style="display:flex; align-items:center; gap:1.5rem; flex-wrap:wrap">
          <span class="status-badge status-audit_hold" style="font-size:1rem; padding:0.5rem 1rem">
            &#x1F50D; 2-MINUTE AUDIT HOLD ACTIVE
          </span>
          <span class="admin-timer" id="admin-audit-timer" style="font-size:1.75rem; font-family:var(--font-mono); color:var(--amber); font-weight:700">02:00</span>
          <button class="btn-sm btn-primary" id="btn-fast-forward-leaderboard" title="Skip remaining audit hold and publish leaderboard immediately">
            &#x2714; Finalize & Publish Leaderboard
          </button>
        </div>
      `;
    } else if (room.status === "FINISHED") {
      controlsHtml = `
        <button class="btn-primary btn-lg" id="btn-view-leaderboard">
          &#x1F3C6; View Official Match Leaderboard
        </button>
      `;
    }

    return `
      <div class="view-container admin-view">
        <div class="admin-top-bar">
          <div class="admin-top-left">
            <button class="btn-back" id="btn-back-admin" style="margin-bottom:0">&larr; Rooms</button>
            <span class="admin-badge">SOC COMMAND ACTIVE</span>
          </div>
          <button class="btn-sm btn-secondary" id="btn-admin-logout">Logout</button>
        </div>

        <!-- Telemetry Stats Grid -->
        <div class="telemetry-grid">
          <div class="telemetry-card highlight">
            <div class="label">Total Units</div>
            <div class="value">${teams.length}</div>
          </div>
          <div class="telemetry-card">
            <div class="label">In Defense</div>
            <div class="value" style="color:var(--primary)">${activeCount}</div>
          </div>
          <div class="telemetry-card">
            <div class="label">Transmitted</div>
            <div class="value" style="color:var(--emerald)">${submittedCount}</div>
          </div>
          <div class="telemetry-card">
            <div class="label">Disqualified</div>
            <div class="value" style="color:var(--crimson)">${dqCount}</div>
          </div>
        </div>

        <!-- Room HUD Bar -->
        <div class="room-hud-bar">
          <div class="room-hud-item">
            <span class="item-label">Room Identifier</span>
            <div class="room-code-badge">
              <span class="code-text">${escapeHtml(state.roomCode)}</span>
              <button class="btn-sm btn-secondary" id="btn-copy-code">Copy</button>
            </div>
          </div>

          <div class="room-hud-item">
            <span class="item-label">Direct Participant URL</span>
            <div class="join-url-box">
              <input type="text" readonly value="${escapeHtml(joinUrl)}" id="join-url-input" />
              <button class="btn-sm btn-secondary" id="btn-copy-url">Copy Link</button>
            </div>
          </div>

          <div class="room-hud-item">
            <span class="item-label">Match State</span>
            <span class="status-badge status-${room.status.toLowerCase()}">
              <span class="dot"></span> ${room.status}
            </span>
          </div>
        </div>

        <!-- Action Banner -->
        <div class="admin-action-banner">
          ${controlsHtml}
        </div>

        <!-- Live Roster Table -->
        <div class="form-section">
          <div class="form-section-title">
            <span>Live Squad Roster & Integrity Log</span>
          </div>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Squad Lead</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Violations</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${
                  teams.length > 0
                    ? teamRows
                    : '<tr><td colspan="7" style="text-align:center; padding:2.5rem; color:var(--text-muted)">No squads have connected yet. Share the room code to recruit participants.</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function bindAdmin() {
    // Logout
    const logoutBtn = document.getElementById("btn-admin-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        state.adminAuthenticated = false;
        sessionStorage.removeItem("cyberarena_admin_auth");
        state.view = "ROLE_SELECT";
        state.roomCode = null;
        renderView();
      });
    }

    // Back to room select
    const backBtn = document.getElementById("btn-back-admin");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        state.roomCode = null;
        renderView();
      });
    }

    // Create room
    const createBtn = document.getElementById("btn-create-room");
    if (createBtn) {
      createBtn.addEventListener("click", () => {
        const room = state.backend.createRoom();
        state.roomCode = room.roomCode;
        renderView();
      });
    }

    // Load existing room
    const joinBtn = document.getElementById("btn-admin-join");
    if (joinBtn) {
      joinBtn.addEventListener("click", () => {
        const codeInput = document.getElementById("admin-room-code");
        const code = codeInput.value.trim().toUpperCase();
        if (!code || code.length !== 6) {
          alert("Please input a valid 6-character room token.");
          return;
        }
        const room = state.backend.getRoom(code);
        if (!room) {
          alert("Specified room instance does not exist.");
          return;
        }
        state.roomCode = code;
        if (room.status !== "WAITING") {
          state.matchLaunched = true;
          state.quizStartEpoch = room.matchLaunchEpoch;
          state.quizEndEpoch = room.quizEndEpoch;
          state.auditEndEpoch = room.auditEndEpoch;
        }
        renderView();
      });
    }

    // Copy Code
    const copyCodeBtn = document.getElementById("btn-copy-code");
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(state.roomCode).then(() => {
          copyCodeBtn.textContent = "Copied!";
          setTimeout(() => (copyCodeBtn.textContent = "Copy"), 2000);
        });
      });
    }

    // Copy URL
    const copyUrlBtn = document.getElementById("btn-copy-url");
    if (copyUrlBtn) {
      copyUrlBtn.addEventListener("click", () => {
        const input = document.getElementById("join-url-input");
        navigator.clipboard.writeText(input.value).then(() => {
          copyUrlBtn.textContent = "Copied!";
          setTimeout(() => (copyUrlBtn.textContent = "Copy Link"), 2000);
        });
      });
    }

    // Launch Match
    const launchBtn = document.getElementById("btn-launch");
    if (launchBtn) {
      launchBtn.addEventListener("click", () => {
        if (!confirm("Broadcast Match Launch? All connected squads will simultaneously enter the 15-minute challenge.")) {
          return;
        }
        const res = state.backend.launchMatch(state.roomCode);
        if (!res.success) {
          alert("Launch error: " + res.error);
          return;
        }
        startAdminMatchTimer();
      });
    }

    // Fast-Forward to Audit Hold (developer / demo convenience)
    const ffAuditBtn = document.getElementById("btn-fast-forward-audit");
    if (ffAuditBtn) {
      ffAuditBtn.addEventListener("click", () => {
        state.backend.expireMatch(state.roomCode, QUESTIONS);
        renderView();
        startAuditTimer();
      });
    }

    // Fast-Forward to Leaderboard (developer / demo convenience)
    const ffLbBtn = document.getElementById("btn-fast-forward-leaderboard");
    if (ffLbBtn) {
      ffLbBtn.addEventListener("click", () => {
        clearInterval(state.auditTimerInterval);
        state.backend.finalizeRoom(state.roomCode, Scoring.buildLeaderboard);
      });
    }

    // Kick / DQ
    document.querySelectorAll("[data-kick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tid = btn.dataset.kick;
        if (confirm("Disconnect and remove this squad from the room?")) {
          state.backend.kickTeam(state.roomCode, tid);
          renderView();
        }
      });
    });

    document.querySelectorAll("[data-dq]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tid = btn.dataset.dq;
        if (confirm("Immediately issue DISQUALIFIED penalty to this squad?")) {
          state.backend.disqualifyTeam(state.roomCode, tid, "ADMIN_MANUAL_OVERRIDE");
          renderView();
        }
      });
    });

    // View Leaderboard
    const lbBtn = document.getElementById("btn-view-leaderboard");
    if (lbBtn) {
      lbBtn.addEventListener("click", () => {
        const room = state.backend.getRoom(state.roomCode);
        if (room && room.leaderboard) {
          state.leaderboard = room.leaderboard;
          state.view = "SCOREBOARD";
          renderView();
        }
      });
    }

    // If live, start timer loop
    if (state.matchLaunched && state.quizEndEpoch) {
      startAdminMatchTimer();
    }
  }

  function startAdminMatchTimer() {
    clearInterval(state.timerInterval);
    clearInterval(state.auditTimerInterval);

    state.timerInterval = setInterval(() => {
      const room = state.backend.getRoom(state.roomCode);
      if (!room) return;

      const now = Date.now();
      const timerEl = document.getElementById("admin-timer");

      if (room.status === "LIVE") {
        const remaining = state.quizEndEpoch - now;
        if (timerEl) {
          timerEl.textContent = remaining > 0 ? Scoring.formatCountdown(remaining) : "00:00";
        }
        if (remaining <= 0) {
          state.backend.expireMatch(state.roomCode, QUESTIONS);
          renderView();
          startAuditTimer();
        }
      }
    }, 500);
  }

  function startAuditTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;

    state.auditTimerInterval = setInterval(() => {
      const now = Date.now();
      const auditTimerEl = document.getElementById("admin-audit-timer");
      const remaining = state.auditEndEpoch - now;

      if (auditTimerEl) {
        auditTimerEl.textContent = remaining > 0 ? Scoring.formatCountdown(remaining) : "00:00";
      }

      if (remaining <= 0) {
        clearInterval(state.auditTimerInterval);
        state.backend.finalizeRoom(state.roomCode, Scoring.buildLeaderboard);
      }
    }, 500);
  }

  // ═══════════════════════════════════════════════════════
  //  VIEW 7: Scoreboard (Deterministic Leaderboard)
  // ═══════════════════════════════════════════════════════
  function renderScoreboard() {
    if (!state.leaderboard || state.leaderboard.length === 0) {
      return `
        <div class="view-container scoreboard-view" style="text-align:center">
          <h1>Leaderboard</h1>
          <p style="margin:1.5rem 0">No verified results are available at this time.</p>
          <button class="btn-primary" id="btn-sb-home">Return to Portal</button>
        </div>
      `;
    }

    const rows = state.leaderboard
      .map((t) => {
        const elapsed = Scoring.formatElapsed(t.elapsed_ms);
        const isDQ = t.status === "DISQUALIFIED" || t.status === "EXPIRED";
        
        let rankHtml = `#${t.rank}`;
        if (!isDQ) {
          if (t.rank === 1) rankHtml = `<span class="podium-rank rank-gold">&#x1F947; 1st</span>`;
          else if (t.rank === 2) rankHtml = `<span class="podium-rank rank-silver">&#x1F948; 2nd</span>`;
          else if (t.rank === 3) rankHtml = `<span class="podium-rank rank-bronze">&#x1F949; 3rd</span>`;
        }

        return `
          <tr style="${isDQ ? "opacity:0.55; background:rgba(255,51,102,0.04)" : ""}">
            <td>${rankHtml}</td>
            <td><strong>${escapeHtml(t.teamName)}</strong></td>
            <td><span class="score-display">${t.score !== null ? t.score : 0}/10</span></td>
            <td><span class="time-display">${elapsed}</span></td>
            <td>
              <span class="status-badge status-${(t.status || "unknown").toLowerCase()}">
                <span class="dot"></span>
                ${t.status || "N/A"}
              </span>
            </td>
          </tr>
        `;
      })
      .join("");

    return `
      <div class="view-container scoreboard-view">
        <div class="scoreboard-header">
          <div>
            <h1>Official Match Leaderboard</h1>
            <p>Deterministic Ranking Engine Results (Accuracy &gt; Elapsed Duration)</p>
          </div>
          <div class="info-chip">
            Room Code: <strong>${escapeHtml(state.roomCode || "N/A")}</strong>
          </div>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Standing</th>
                <th>Squad Name</th>
                <th>Accuracy</th>
                <th>Elapsed Duration</th>
                <th>Integrity Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <div style="margin-top:2.5rem; display:flex; justify-content:center">
          <button class="btn-primary btn-lg" id="btn-sb-home" style="max-width:320px">
            Return to Main Portal &rarr;
          </button>
        </div>
      </div>
    `;
  }

  function bindScoreboard() {
    const homeBtn = document.getElementById("btn-sb-home");
    if (homeBtn) {
      homeBtn.addEventListener("click", () => {
        state.view = "ROLE_SELECT";
        state.roomCode = null;
        state.teamId = null;
        state.leaderboard = null;
        state.matchLaunched = false;
        renderView();
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  //  VIEW 8: Disqualification Screen
  // ═══════════════════════════════════════════════════════
  function renderDQScreen() {
    return `
      <div class="view-container dq-view">
        <div class="dq-skull-box">&#x26A0;</div>
        <h1>DISQUALIFIED</h1>
        <div class="dq-code-banner">VIOLATION: TAB_SWITCH_EXCEEDED (3/3 STRIKES)</div>
        <p class="dq-desc">
          Your active session was terminated by the proctoring monitor due to exceeding allowable window focus boundaries. All answers have been locked and demoted in the ranking engine.
        </p>
        <div class="info-chip" style="display:inline-block">
          Squad: <strong>${escapeHtml(state.teamName || "Operator Unit")}</strong>
        </div>
        <div style="margin-top:2rem">
          <button class="btn-secondary" id="btn-dq-home">Return to Portal</button>
        </div>
      </div>
    `;
  }

  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "btn-dq-home") {
      state.view = "ROLE_SELECT";
      state.roomCode = null;
      state.teamId = null;
      renderView();
    }
  });

  // ─── Utilities ──────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function hideAllModals() {
    document.querySelectorAll(".modal-overlay").forEach((m) => {
      m.style.display = "none";
    });
  }

  // ─── Query Param Handler (?room=XXXXXX) ──────────────────
  window.addEventListener("load", () => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam && roomParam.length === 6) {
      state.role = "participant";
      state.view = "REGISTER";
      renderView();
      setTimeout(() => {
        const input = document.getElementById("room-code");
        if (input) input.value = roomParam.toUpperCase();
      }, 50);
    }
  });
})();
