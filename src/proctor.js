/**
 * proctor.js
 * Client-side anti-cheat focus tracking module.
 *
 * Monitors `visibilitychange` and `window.blur` events.
 * Implements a 3-strike state machine:
 *   Strike 1 & 2: Show a blocking modal warning requiring acknowledgement.
 *   Strike 3:     Lock UI permanently, dispatch DISQUALIFIED payload.
 *
 * Usage (browser):
 *   const proctor = new Proctor({ onStrike, onDisqualify });
 *   proctor.start();
 *   proctor.stop();
 */

(function (root) {
  "use strict";

  const MAX_STRIKES = 3;

  /**
   * @typedef {Object} ProctorConfig
   * @property {function(number): void} onStrike - Called on strikes 1 and 2 with strike count.
   * @property {function(object): void} onDisqualify - Called on strike 3 with DQ payload.
   * @property {function(): void} [onFocusRestored] - Optional callback when focus is regained.
   */

  class Proctor {
    /**
     * @param {ProctorConfig} config
     */
    constructor(config) {
      if (!config || typeof config.onStrike !== "function") {
        throw new Error("Proctor requires an onStrike callback.");
      }
      if (typeof config.onDisqualify !== "function") {
        throw new Error("Proctor requires an onDisqualify callback.");
      }

      this._strikes = 0;
      this._active = false;
      this._locked = false;
      this._onStrike = config.onStrike;
      this._onDisqualify = config.onDisqualify;
      this._onFocusRestored = config.onFocusRestored || null;
      this._cooldown = false;

      // Bind handlers for proper add/remove
      this._handleVisibilityChange = this._onVisibilityChange.bind(this);
      this._handleBlur = this._onBlur.bind(this);
      this._handleFocus = this._onFocus.bind(this);
    }

    /** Returns current strike count. */
    get strikes() {
      return this._strikes;
    }

    /** Returns whether the proctor has locked the session. */
    get isLocked() {
      return this._locked;
    }

    /** Returns whether the proctor is actively monitoring. */
    get isActive() {
      return this._active;
    }

    /**
     * Start monitoring focus events.
     */
    start() {
      if (this._active) return;
      this._active = true;
      this._strikes = 0;
      this._locked = false;

      if (typeof document !== "undefined") {
        document.addEventListener(
          "visibilitychange",
          this._handleVisibilityChange
        );
      }
      if (typeof window !== "undefined") {
        window.addEventListener("blur", this._handleBlur);
        window.addEventListener("focus", this._handleFocus);
      }
    }

    /**
     * Stop monitoring focus events (cleanup).
     */
    stop() {
      this._active = false;

      if (typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          this._handleVisibilityChange
        );
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("blur", this._handleBlur);
        window.removeEventListener("focus", this._handleFocus);
      }
    }

    /**
     * Force-set the strike count (for restoring session state).
     * @param {number} count
     */
    setStrikes(count) {
      this._strikes = Math.min(Math.max(0, count), MAX_STRIKES);
      if (this._strikes >= MAX_STRIKES) {
        this._triggerDisqualification();
      }
    }

    /**
     * Called when document visibility changes (tab switch).
     * @private
     */
    _onVisibilityChange() {
      if (!this._active || this._locked) return;
      if (typeof document !== "undefined" && document.hidden) {
        this._recordStrike("TAB_HIDDEN");
      }
    }

    /**
     * Called when window loses focus.
     * @private
     */
    _onBlur() {
      if (!this._active || this._locked) return;
      // Debounce: visibilitychange and blur can fire together
      if (this._cooldown) return;
      this._cooldown = true;
      setTimeout(() => {
        this._cooldown = false;
      }, 500);
      this._recordStrike("WINDOW_BLUR");
    }

    /**
     * Called when window regains focus.
     * @private
     */
    _onFocus() {
      if (!this._active || this._locked) return;
      if (this._onFocusRestored) {
        this._onFocusRestored();
      }
    }

    /**
     * Increment strike counter and dispatch appropriate callback.
     * @param {string} reason
     * @private
     */
    _recordStrike(reason) {
      this._strikes++;
      const timestamp = Date.now();

      if (this._strikes >= MAX_STRIKES) {
        this._triggerDisqualification();
      } else {
        this._onStrike(this._strikes);
      }
    }

    /**
     * Permanently lock the session and fire DQ callback.
     * @private
     */
    _triggerDisqualification() {
      this._locked = true;
      this._active = false;
      this.stop();

      const payload = {
        type: "DISQUALIFIED",
        reason: "TAB_SWITCH_EXCEEDED",
        message: `DISQUALIFIED - TAB_SWITCH_EXCEEDED (${MAX_STRIKES}/${MAX_STRIKES} strikes)`,
        strikes: MAX_STRIKES,
        timestamp: Date.now(),
      };

      this._onDisqualify(payload);
    }
  }

  // Universal export
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { Proctor, MAX_STRIKES };
  } else {
    root.Proctor = Proctor;
    root.MAX_STRIKES = MAX_STRIKES;
  }
})(typeof window !== "undefined" ? window : globalThis);
