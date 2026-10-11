/**
 * mockBackend.js
 * Real-time state bus using BroadcastChannel API + localStorage.
 *
 * Enables genuine multi-tab real-time communication for:
 *  - Admin <-> Participant synchronization
 *  - Room state management (teams, status, launch, results)
 *  - Works on static hosting (GitHub Pages) with zero backend
 *
 * Architecture:
 *  - BroadcastChannel: instant cross-tab messaging for events
 *  - localStorage: persistent state store + fallback via 'storage' event
 */

(function (root) {
  "use strict";

  // ─── Constants ──────────────────────────────────────────
  const CHANNEL_NAME = "cyber-arena-bus";
  const LS_PREFIX = "cyberarena_";
  const QUIZ_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  const AUDIT_HOLD_MS = 2 * 60 * 1000; // 2 minutes

  // ─── Message Types ──────────────────────────────────────
  const MSG = {
    TEAM_JOIN: "TEAM_JOIN",
    TEAM_LEAVE: "TEAM_LEAVE",
    TEAM_KICK: "TEAM_KICK",
    TEAM_DQ: "TEAM_DQ",
    ROOM_CREATED: "ROOM_CREATED",
    MATCH_LAUNCH: "MATCH_LAUNCH",
    QUIZ_SUBMIT: "QUIZ_SUBMIT",
    AUDIT_COMPLETE: "AUDIT_COMPLETE",
    LEADERBOARD_READY: "LEADERBOARD_READY",
    STATE_SYNC: "STATE_SYNC",
    REQUEST_SYNC: "REQUEST_SYNC",
  };

  // ─── Utility: generate 6-char room code ─────────────────
  function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    const rng =
      typeof crypto !== "undefined" && crypto.getRandomValues
        ? (n) => {
            const arr = new Uint32Array(1);
            crypto.getRandomValues(arr);
            return arr[0] % n;
          }
        : (n) => Math.floor(Math.random() * n);
    for (let i = 0; i < 6; i++) {
      code += chars[rng(chars.length)];
    }
    return code;
  }

  // ─── Utility: generate team ID ──────────────────────────
  function generateTeamId() {
    return "team_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  // ─── LocalStorage helpers ───────────────────────────────
  function lsGet(key) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error("[MockBackend] localStorage write failed:", e);
    }
  }

  function lsRemove(key) {
    try {
      localStorage.removeItem(LS_PREFIX + key);
    } catch {
      /* ignore */
    }
  }

  // ─── Room State Shape ───────────────────────────────────
  function createRoomState(roomCode) {
    return {
      roomCode: roomCode,
      status: "WAITING", // WAITING | LIVE | AUDIT_HOLD | FINISHED
      teams: {}, // teamId -> team object
      matchLaunchEpoch: null,
      quizEndEpoch: null,
      auditEndEpoch: null,
      leaderboard: null,
      createdAt: Date.now(),
    };
  }

  // ─── Team Object Shape ──────────────────────────────────
  function createTeamObject(teamName, teamLead, teammates, teamId) {
    return {
      teamId: teamId,
      teamName: teamName,
      teamLead: teamLead, // { name, email }
      teammates: teammates, // array of 4 names
      status: "WAITING", // WAITING | IN_PROGRESS | SUBMITTED | DISQUALIFIED | EXPIRED
      joinedAt: Date.now(),
      quiz_start_epoch: null,
      quiz_finish_epoch: null,
      answers: [],
      score: null,
      strikes: 0,
      dqReason: null,
    };
  }

  // ─── MockBackend Class ──────────────────────────────────
  class MockBackend {
    constructor() {
      this._channel = null;
      this._listeners = {};
      this._storageHandler = null;

      // Initialize BroadcastChannel if available
      if (typeof BroadcastChannel !== "undefined") {
        this._channel = new BroadcastChannel(CHANNEL_NAME);
        this._channel.onmessage = (event) => this._handleMessage(event.data);
      }

      // Fallback: listen for localStorage changes from other tabs
      if (typeof window !== "undefined") {
        this._storageHandler = (event) => {
          if (event.key && event.key.startsWith(LS_PREFIX) && event.newValue) {
            try {
              const data = JSON.parse(event.newValue);
              if (data && data._broadcast) {
                this._handleMessage(data._broadcast);
              }
            } catch {
              /* ignore parse errors */
            }
          }
        };
        window.addEventListener("storage", this._storageHandler);
      }
    }

    // ─── Event System ────────────────────────────────────
    on(eventType, callback) {
      if (!this._listeners[eventType]) {
        this._listeners[eventType] = [];
      }
      this._listeners[eventType].push(callback);
    }

    off(eventType, callback) {
      if (!this._listeners[eventType]) return;
      this._listeners[eventType] = this._listeners[eventType].filter(
        (cb) => cb !== callback
      );
    }

    _emit(eventType, data) {
      const handlers = this._listeners[eventType] || [];
      handlers.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[MockBackend] Handler error for ${eventType}:`, e);
        }
      });
    }

    _handleMessage(msg) {
      if (!msg || !msg.type) return;
      this._emit(msg.type, msg);
      this._emit("*", msg); // wildcard listeners
    }

    /**
     * Broadcast a message to all tabs.
     * @param {object} msg - Must have a `type` property.
     */
    broadcast(msg) {
      if (!msg || !msg.type) return;

      // Send via BroadcastChannel
      if (this._channel) {
        try {
          this._channel.postMessage(msg);
        } catch {
          /* channel may be closed */
        }
      }

      // Also write to localStorage for fallback
      const fallbackKey = "_bus_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      lsSet(fallbackKey, { _broadcast: msg, _ts: Date.now() });
      // Cleanup old bus messages after 5s
      setTimeout(() => lsRemove(fallbackKey), 5000);

      // Also dispatch locally (sender tab)
      this._handleMessage(msg);
    }

    // ─── Room Management ─────────────────────────────────

    /**
     * Create a new room and persist to localStorage.
     * @returns {object} Room state object.
     */
    createRoom() {
      const code = generateRoomCode();
      const room = createRoomState(code);
      lsSet("room_" + code, room);

      this.broadcast({
        type: MSG.ROOM_CREATED,
        roomCode: code,
        room: room,
      });

      return room;
    }

    /**
     * Get room state from localStorage.
     * @param {string} roomCode
     * @returns {object|null}
     */
    getRoom(roomCode) {
      return lsGet("room_" + roomCode);
    }

    /**
     * Persist updated room state.
     * @param {object} room
     */
    saveRoom(room) {
      if (!room || !room.roomCode) return;
      lsSet("room_" + room.roomCode, room);
    }

    /**
     * Register a team into a room.
     * @param {string} roomCode
     * @param {string} teamName
     * @param {{name: string, email: string}} teamLead
     * @param {string[]} teammates - Array of 4 names
     * @returns {{success: boolean, teamId?: string, error?: string}}
     */
    joinRoom(roomCode, teamName, teamLead, teammates) {
      const room = this.getRoom(roomCode);
      if (!room) {
        return { success: false, error: "Room not found. Check the room code." };
      }
      if (room.status !== "WAITING") {
        return {
          success: false,
          error: "Match already in progress. Cannot join.",
        };
      }

      // Check for duplicate team name
      const existingNames = Object.values(room.teams).map((t) =>
        t.teamName.toLowerCase()
      );
      if (existingNames.includes(teamName.toLowerCase())) {
        return {
          success: false,
          error: "Team name already taken in this room.",
        };
      }

      const teamId = generateTeamId();
      const team = createTeamObject(teamName, teamLead, teammates, teamId);
      room.teams[teamId] = team;
      this.saveRoom(room);

      this.broadcast({
        type: MSG.TEAM_JOIN,
        roomCode: roomCode,
        teamId: teamId,
        team: team,
      });

      return { success: true, teamId: teamId };
    }

    /**
     * Launch the match — broadcast synchronized start.
     * @param {string} roomCode
     * @returns {{success: boolean, error?: string}}
     */
    launchMatch(roomCode) {
      const room = this.getRoom(roomCode);
      if (!room) return { success: false, error: "Room not found." };
      if (room.status !== "WAITING") {
        return { success: false, error: "Match already launched." };
      }

      const teamCount = Object.keys(room.teams).length;
      if (teamCount === 0) {
        return { success: false, error: "No teams in the room." };
      }

      const now = Date.now();
      room.status = "LIVE";
      room.matchLaunchEpoch = now;
      room.quizEndEpoch = now + QUIZ_DURATION_MS;
      room.auditEndEpoch = now + QUIZ_DURATION_MS + AUDIT_HOLD_MS;

      // Update all team statuses
      Object.keys(room.teams).forEach((tid) => {
        room.teams[tid].status = "IN_PROGRESS";
        room.teams[tid].quiz_start_epoch = now;
      });

      this.saveRoom(room);

      this.broadcast({
        type: MSG.MATCH_LAUNCH,
        roomCode: roomCode,
        matchLaunchEpoch: now,
        quizEndEpoch: room.quizEndEpoch,
        auditEndEpoch: room.auditEndEpoch,
      });

      return { success: true };
    }

    /**
     * Submit quiz answers for a team.
     * @param {string} roomCode
     * @param {string} teamId
     * @param {number[]} answers
     * @param {object[]} questions
     * @returns {{success: boolean, error?: string}}
     */
    submitQuiz(roomCode, teamId, answers, questions) {
      const room = this.getRoom(roomCode);
      if (!room) return { success: false, error: "Room not found." };

      const team = room.teams[teamId];
      if (!team) return { success: false, error: "Team not found." };
      if (team.status === "DISQUALIFIED") {
        return { success: false, error: "Team is disqualified." };
      }
      if (team.status === "SUBMITTED") {
        return { success: false, error: "Already submitted." };
      }

      const now = Date.now();
      team.quiz_finish_epoch = now;
      team.answers = answers;
      team.status = "SUBMITTED";

      // Grade
      let score = 0;
      for (let i = 0; i < questions.length; i++) {
        if (answers[i] === questions[i].correctIndex) {
          score++;
        }
      }
      team.score = score;

      room.teams[teamId] = team;
      this.saveRoom(room);

      this.broadcast({
        type: MSG.QUIZ_SUBMIT,
        roomCode: roomCode,
        teamId: teamId,
        score: score,
        finishEpoch: now,
      });

      return { success: true, score: score };
    }

    /**
     * Disqualify a team.
     * @param {string} roomCode
     * @param {string} teamId
     * @param {string} reason
     */
    disqualifyTeam(roomCode, teamId, reason) {
      const room = this.getRoom(roomCode);
      if (!room) return;
      const team = room.teams[teamId];
      if (!team) return;

      team.status = "DISQUALIFIED";
      team.dqReason = reason || "ADMIN_ACTION";
      team.quiz_finish_epoch = team.quiz_finish_epoch || Date.now();
      room.teams[teamId] = team;
      this.saveRoom(room);

      this.broadcast({
        type: MSG.TEAM_DQ,
        roomCode: roomCode,
        teamId: teamId,
        reason: team.dqReason,
      });
    }

    /**
     * Kick a team from the room.
     * @param {string} roomCode
     * @param {string} teamId
     */
    kickTeam(roomCode, teamId) {
      const room = this.getRoom(roomCode);
      if (!room) return;
      delete room.teams[teamId];
      this.saveRoom(room);

      this.broadcast({
        type: MSG.TEAM_KICK,
        roomCode: roomCode,
        teamId: teamId,
      });
    }

    /**
     * Mark expired teams and transition room to AUDIT_HOLD.
     * @param {string} roomCode
     * @param {object[]} questions
     */
    expireMatch(roomCode, questions) {
      const room = this.getRoom(roomCode);
      if (!room) return;

      Object.keys(room.teams).forEach((tid) => {
        const t = room.teams[tid];
        if (t.status === "IN_PROGRESS") {
          t.status = "EXPIRED";
          t.quiz_finish_epoch = room.quizEndEpoch;
          // Grade whatever answers exist
          let score = 0;
          if (Array.isArray(t.answers)) {
            for (let i = 0; i < questions.length; i++) {
              if (t.answers[i] === questions[i].correctIndex) {
                score++;
              }
            }
          }
          t.score = score;
        }
      });

      room.status = "AUDIT_HOLD";
      this.saveRoom(room);
    }

    /**
     * Finalize room and build leaderboard.
     * @param {string} roomCode
     * @param {function} buildLeaderboardFn
     */
    finalizeRoom(roomCode, buildLeaderboardFn) {
      const room = this.getRoom(roomCode);
      if (!room) return;

      const teamArray = Object.values(room.teams);
      room.leaderboard = buildLeaderboardFn(teamArray);
      room.status = "FINISHED";
      this.saveRoom(room);

      // Persist permanently to historical archives
      this.saveToArchive(room);

      this.broadcast({
        type: MSG.LEADERBOARD_READY,
        roomCode: roomCode,
        leaderboard: room.leaderboard,
      });
    }

    /**
     * Archive a finalized match to persistent historical storage.
     * @param {object} room
     */
    saveToArchive(room) {
      if (!room || !room.roomCode || !room.leaderboard) return;
      const archives = this.getArchives();
      const existingIdx = archives.findIndex((a) => a.roomCode === room.roomCode);

      const entry = {
        roomCode: room.roomCode,
        createdAt: room.createdAt || Date.now(),
        finalizedAt: Date.now(),
        totalTeams: Object.keys(room.teams || {}).length,
        winningTeam: room.leaderboard[0] ? room.leaderboard[0].teamName : "N/A",
        topScore: room.leaderboard[0] ? room.leaderboard[0].score : 0,
        leaderboard: room.leaderboard,
        teams: room.teams,
      };

      if (existingIdx >= 0) {
        archives[existingIdx] = entry;
      } else {
        archives.unshift(entry); // Newest first
      }

      lsSet("archives", archives);
    }

    /**
     * Retrieve all historical match archives from persistent storage.
     * @returns {object[]}
     */
    getArchives() {
      const list = lsGet("archives");
      return Array.isArray(list) ? list : [];
    }

    /**
     * Retrieve a specific archived match by room code.
     * @param {string} roomCode
     * @returns {object|null}
     */
    getArchivedMatch(roomCode) {
      const archives = this.getArchives();
      return archives.find((a) => a.roomCode === roomCode) || null;
    }

    /**
     * Remove an archived match from historical storage.
     * @param {string} roomCode
     */
    deleteArchive(roomCode) {
      const archives = this.getArchives().filter((a) => a.roomCode !== roomCode);
      lsSet("archives", archives);
    }

    /**
     * Clear all historical match archives.
     */
    clearAllArchives() {
      lsRemove("archives");
    }

    /**
     * Request a state sync from the admin tab.
     * @param {string} roomCode
     */
    requestSync(roomCode) {
      this.broadcast({
        type: MSG.REQUEST_SYNC,
        roomCode: roomCode,
      });
    }

    /**
     * Broadcast current room state (admin responds to sync requests).
     * @param {string} roomCode
     */
    broadcastSync(roomCode) {
      const room = this.getRoom(roomCode);
      if (!room) return;
      this.broadcast({
        type: MSG.STATE_SYNC,
        roomCode: roomCode,
        room: room,
      });
    }

    /**
     * Cleanup everything.
     */
    destroy() {
      if (this._channel) {
        this._channel.close();
        this._channel = null;
      }
      if (typeof window !== "undefined" && this._storageHandler) {
        window.removeEventListener("storage", this._storageHandler);
      }
      this._listeners = {};
    }
  }

  // ─── Exports ────────────────────────────────────────────
  const exports = {
    MockBackend,
    MSG,
    QUIZ_DURATION_MS,
    AUDIT_HOLD_MS,
    generateRoomCode,
    generateTeamId,
    createRoomState,
    createTeamObject,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exports;
  } else {
    root.MockBackend = MockBackend;
    root.MSG = MSG;
    root.QUIZ_DURATION_MS = QUIZ_DURATION_MS;
    root.AUDIT_HOLD_MS = AUDIT_HOLD_MS;
  }
})(typeof window !== "undefined" ? window : globalThis);
