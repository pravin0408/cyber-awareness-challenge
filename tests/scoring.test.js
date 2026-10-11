const {
  calculateElapsedMs,
  gradeAnswers,
  isDemotedStatus,
  rankComparator,
  buildLeaderboard,
  formatElapsed,
  formatCountdown,
} = require("../src/scoring.js");

describe("Scoring Engine", () => {
  describe("calculateElapsedMs", () => {
    it("should correctly calculate difference in ms", () => {
      expect(calculateElapsedMs(1000, 5000)).toBe(4000);
      expect(calculateElapsedMs(1672531200000, 1672531201000)).toBe(1000);
    });

    it("should return Infinity for invalid inputs", () => {
      expect(calculateElapsedMs(5000, 1000)).toBe(Infinity); // Negative time
      expect(calculateElapsedMs("a", 1000)).toBe(Infinity);
      expect(calculateElapsedMs(1000, null)).toBe(Infinity);
    });
  });

  describe("gradeAnswers", () => {
    const mockQuestions = [
      { correctIndex: 1 },
      { correctIndex: 2 },
      { correctIndex: 0 },
    ];

    it("should return 0 for all wrong", () => {
      expect(gradeAnswers([0, 0, 1], mockQuestions)).toBe(0);
    });

    it("should return correct score", () => {
      expect(gradeAnswers([1, 2, 0], mockQuestions)).toBe(3);
      expect(gradeAnswers([1, 0, 0], mockQuestions)).toBe(2);
    });

    it("should handle null/missing answers", () => {
      expect(gradeAnswers([1, null, undefined], mockQuestions)).toBe(1);
    });
  });

  describe("isDemotedStatus", () => {
    it("returns true for DISQUALIFIED and EXPIRED", () => {
      expect(isDemotedStatus("DISQUALIFIED")).toBe(true);
      expect(isDemotedStatus("EXPIRED")).toBe(true);
      expect(isDemotedStatus("disqualified")).toBe(true); // case insensitive
    });

    it("returns false for other statuses", () => {
      expect(isDemotedStatus("ACTIVE")).toBe(false);
      expect(isDemotedStatus("SUBMITTED")).toBe(false);
      expect(isDemotedStatus("")).toBe(false);
      expect(isDemotedStatus(null)).toBe(false);
    });
  });

  describe("rankComparator & buildLeaderboard", () => {
    it("ranks by Score (Descending) first", () => {
      const teams = [
        { teamName: "A", status: "SUBMITTED", score: 5, quiz_start_epoch: 1000, quiz_finish_epoch: 2000 },
        { teamName: "B", status: "SUBMITTED", score: 9, quiz_start_epoch: 1000, quiz_finish_epoch: 2000 },
        { teamName: "C", status: "SUBMITTED", score: 7, quiz_start_epoch: 1000, quiz_finish_epoch: 2000 },
      ];
      const ranked = buildLeaderboard(teams);
      expect(ranked.map((t) => t.teamName)).toEqual(["B", "C", "A"]);
      expect(ranked[0].rank).toBe(1);
      expect(ranked[2].rank).toBe(3);
    });

    it("breaks ties with Elapsed Time (Ascending: 10/10 in 10m beats 10/10 in 15m)", () => {
      const teams = [
        { teamName: "Slow", status: "SUBMITTED", score: 10, quiz_start_epoch: 0, quiz_finish_epoch: 900000 }, // 15m
        { teamName: "Fast", status: "SUBMITTED", score: 10, quiz_start_epoch: 0, quiz_finish_epoch: 600000 }, // 10m
      ];
      const ranked = buildLeaderboard(teams);
      expect(ranked[0].teamName).toBe("Fast");
      expect(ranked[1].teamName).toBe("Slow");
    });

    it("Score priority beats Elapsed Time priority (9/10 in 15m beats 8/10 in 2m)", () => {
      const teams = [
        { teamName: "AccurateButSlow", status: "SUBMITTED", score: 9, quiz_start_epoch: 0, quiz_finish_epoch: 900000 },
        { teamName: "FastButWrong", status: "SUBMITTED", score: 8, quiz_start_epoch: 0, quiz_finish_epoch: 120000 },
      ];
      const ranked = buildLeaderboard(teams);
      expect(ranked[0].teamName).toBe("AccurateButSlow");
      expect(ranked[1].teamName).toBe("FastButWrong");
    });

    it("always ranks Disqualified/Expired teams at the bottom, comparing them internally", () => {
      const teams = [
        { teamName: "DQ", status: "DISQUALIFIED", score: 10, quiz_start_epoch: 0, quiz_finish_epoch: 1000 },
        { teamName: "Valid", status: "SUBMITTED", score: 1, quiz_start_epoch: 0, quiz_finish_epoch: 900000 },
        { teamName: "ExpiredHigh", status: "EXPIRED", score: 5, quiz_start_epoch: 0, quiz_finish_epoch: 900000 },
        { teamName: "ExpiredLow", status: "EXPIRED", score: 2, quiz_start_epoch: 0, quiz_finish_epoch: 900000 },
      ];
      const ranked = buildLeaderboard(teams);
      expect(ranked.map((t) => t.teamName)).toEqual([
        "Valid",            // Only non-demoted team
        "DQ",               // Demoted, but highest score among demoted (10)
        "ExpiredHigh",      // Demoted, score (5)
        "ExpiredLow",       // Demoted, score (2)
      ]);
    });
  });

  describe("Formatting", () => {
    it("formats elapsed time", () => {
      expect(formatElapsed(125000)).toBe("2m 05s");
      expect(formatElapsed(0)).toBe("0m 00s");
      expect(formatElapsed(-10)).toBe("N/A");
    });

    it("formats countdown", () => {
      expect(formatCountdown(125000)).toBe("02:05");
      // Ceil logic: 1001ms = 2s
      expect(formatCountdown(1001)).toBe("00:02");
      expect(formatCountdown(0)).toBe("00:00");
      expect(formatCountdown(-5000)).toBe("00:00");
    });
  });
});
