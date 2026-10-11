/**
 * scoring.js
 * Deterministic scoring engine and tie-breaking comparator.
 *
 * Ranking Algorithm (strict priority order):
 *  1. Status gate: DISQUALIFIED / EXPIRED teams always rank below active teams.
 *  2. Primary:     Score (correct answers out of 10) — descending.
 *  3. Tie-breaker: Elapsed time (quiz_finish_epoch - quiz_start_epoch) — ascending (faster wins).
 *  4. Secondary:   Earliest finish timestamp (quiz_finish_epoch) — ascending.
 */

/**
 * Calculates elapsed quiz time in milliseconds.
 * @param {number} startEpoch - quiz_start_epoch in ms since Unix epoch.
 * @param {number} finishEpoch - quiz_finish_epoch in ms since Unix epoch.
 * @returns {number} Elapsed time in milliseconds (always >= 0).
 */
function calculateElapsedMs(startEpoch, finishEpoch) {
  if (
    typeof startEpoch !== "number" ||
    typeof finishEpoch !== "number" ||
    isNaN(startEpoch) ||
    isNaN(finishEpoch)
  ) {
    return Infinity;
  }
  const elapsed = finishEpoch - startEpoch;
  return elapsed >= 0 ? elapsed : Infinity;
}

/**
 * Grades a team's answers against the answer key.
 * @param {number[]} answers - Array of selected option indices (0-based).
 * @param {Array<{correctIndex: number}>} questions - Question dataset.
 * @returns {number} Number of correct answers.
 */
function gradeAnswers(answers, questions) {
  if (!Array.isArray(answers) || !Array.isArray(questions)) {
    return 0;
  }
  let score = 0;
  for (let i = 0; i < questions.length; i++) {
    if (answers[i] === questions[i].correctIndex) {
      score++;
    }
  }
  return score;
}

/**
 * Determines whether a team status is considered "demoted" (ranks last).
 * @param {string} status
 * @returns {boolean}
 */
function isDemotedStatus(status) {
  const demoted = ["DISQUALIFIED", "EXPIRED"];
  return demoted.includes((status || "").toUpperCase());
}

/**
 * Comparator function for deterministic ranking.
 * Sorts an array of team result objects in-place.
 *
 * Each team object must have:
 *   - status:            string ("ACTIVE", "SUBMITTED", "DISQUALIFIED", "EXPIRED")
 *   - score:             number (correct answers, 0-10)
 *   - quiz_start_epoch:  number (ms)
 *   - quiz_finish_epoch: number (ms)
 *
 * @param {object} a - Team A result
 * @param {object} b - Team B result
 * @returns {number} Negative if A ranks higher, positive if B ranks higher.
 */
function rankComparator(a, b) {
  const aDemoted = isDemotedStatus(a.status);
  const bDemoted = isDemotedStatus(b.status);

  // Step 1: Demoted teams sink to the bottom
  if (aDemoted && !bDemoted) return 1;
  if (!aDemoted && bDemoted) return -1;

  // If both demoted, still sort among themselves by score then time
  // Step 2: Primary — Score descending (higher is better)
  const aScore = typeof a.score === "number" ? a.score : 0;
  const bScore = typeof b.score === "number" ? b.score : 0;
  if (bScore !== aScore) return bScore - aScore;

  // Step 3: Tie-breaker — Elapsed time ascending (faster wins)
  const aElapsed = calculateElapsedMs(a.quiz_start_epoch, a.quiz_finish_epoch);
  const bElapsed = calculateElapsedMs(b.quiz_start_epoch, b.quiz_finish_epoch);
  if (aElapsed !== bElapsed) return aElapsed - bElapsed;

  // Step 4: Secondary tie-breaker — Earliest finish ascending
  const aFinish =
    typeof a.quiz_finish_epoch === "number" ? a.quiz_finish_epoch : Infinity;
  const bFinish =
    typeof b.quiz_finish_epoch === "number" ? b.quiz_finish_epoch : Infinity;
  return aFinish - bFinish;
}

/**
 * Sorts and returns a ranked leaderboard from an array of team results.
 * Each returned entry includes a `rank` property (1-indexed).
 *
 * @param {object[]} teams - Array of team result objects.
 * @returns {object[]} Sorted copy with `rank` and `elapsed_ms` attached.
 */
function buildLeaderboard(teams) {
  if (!Array.isArray(teams)) return [];

  const ranked = teams
    .map((t) => ({
      ...t,
      elapsed_ms: calculateElapsedMs(t.quiz_start_epoch, t.quiz_finish_epoch),
    }))
    .sort(rankComparator);

  return ranked.map((t, idx) => ({
    ...t,
    rank: idx + 1,
  }));
}

/**
 * Formats elapsed milliseconds as "Xm Ys" for display.
 * @param {number} ms
 * @returns {string}
 */
function formatElapsed(ms) {
  if (!isFinite(ms) || ms < 0) return "N/A";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

/**
 * Formats a countdown from remaining milliseconds as "MM:SS".
 * @param {number} remainingMs
 * @returns {string}
 */
function formatCountdown(remainingMs) {
  if (remainingMs <= 0) return "00:00";
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

// Universal export
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    calculateElapsedMs,
    gradeAnswers,
    isDemotedStatus,
    rankComparator,
    buildLeaderboard,
    formatElapsed,
    formatCountdown,
  };
} else if (typeof window !== "undefined") {
  window.Scoring = {
    calculateElapsedMs,
    gradeAnswers,
    isDemotedStatus,
    rankComparator,
    buildLeaderboard,
    formatElapsed,
    formatCountdown,
  };
}
