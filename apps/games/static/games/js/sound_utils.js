// ============================================================
// NESTGROW — Sound Utilities (Web Audio API synthesis)
// No external files needed — all sounds generated via oscillators.
// All functions are globally available and safe to call anywhere.
// ============================================================

(function () {
  'use strict';

  // Shared AudioContext reused across calls to avoid the 6-context browser limit.
  let _ac = null;
  function getAC() {
    if (!_ac || _ac.state === 'closed') {
      _ac = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (autoplay policy)
    if (_ac.state === 'suspended') _ac.resume();
    return _ac;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function tone(freq, type, gainVal, duration, startOffset) {
    const ac  = getAC();
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g);
    g.connect(ac.destination);
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const t = ac.currentTime + (startOffset || 0);
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function ramp(freqStart, freqEnd, type, gainVal, duration, startOffset) {
    const ac  = getAC();
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g);
    g.connect(ac.destination);
    osc.type = type || 'sine';
    const t = ac.currentTime + (startOffset || 0);
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  // ── Sound definitions ─────────────────────────────────────────────────────────

  /**
   * Correct answer / match: two ascending notes (ding-ding).
   * Used for: drag_and_drop pair correct, comparacion correct, puzzle piece correct,
   *           ahorcado letter correct, word found in word_search.
   */
  window.playCorrect = function () {
    try {
      ramp(523, 784, 'sine', 0.16, 0.14);      // C5 → G5
      ramp(784, 1047, 'sine', 0.13, 0.14, 0.13); // G5 → C6
    } catch (e) {}
  };

  /**
   * Wrong answer: descending buzzer.
   * Used for: any incorrect selection across all games.
   */
  window.playWrong = function () {
    try {
      ramp(320, 90, 'sawtooth', 0.16, 0.26);
    } catch (e) {}
  };

  /**
   * Soft "click" when a connection/cable is drawn (drag_and_drop).
   */
  window.playConnect = function () {
    try {
      ramp(880, 660, 'sine', 0.11, 0.07);
    } catch (e) {}
  };

  /**
   * Combo celebration: four ascending notes.
   * Used for: drag_and_drop combo streak.
   */
  window.playCombo = function () {
    try {
      const notes = [523, 659, 784, 1047]; // C5-E5-G5-C6
      notes.forEach(function (f, i) { tone(f, 'triangle', 0.15, 0.2, i * 0.08); });
    } catch (e) {}
  };

  /**
   * Card flip: very short soft thud.
   * Used for: memoria card flip.
   */
  window.playFlip = function () {
    try {
      ramp(380, 200, 'triangle', 0.09, 0.07);
    } catch (e) {}
  };

  /**
   * Memory match: rising triad arpeggio — magical shimmer.
   * Used for: memoria pair found.
   */
  window.playMatch = function () {
    try {
      const notes = [523, 659, 784]; // C5-E5-G5
      notes.forEach(function (f, i) { tone(f, 'sine', 0.14, 0.28, i * 0.09); });
    } catch (e) {}
  };

  /**
   * Blackout: short spooky descend — used when the lights go out in memoria hard mode.
   */
  window.playBlackout = function () {
    try {
      ramp(220, 55, 'sawtooth', 0.11, 0.55);
    } catch (e) {}
  };

  /**
   * Shuffle swoosh: quick pitch drop — used when cards/pieces are shuffled.
   */
  window.playShuffle = function () {
    try {
      ramp(900, 180, 'sawtooth', 0.06, 0.38);
    } catch (e) {}
  };

  /**
   * Puzzle piece placed correctly: crisp snap.
   * Used for: puzzle piece snap to correct position.
   */
  window.playPieceSnap = function () {
    try {
      ramp(880, 1047, 'triangle', 0.13, 0.09);
    } catch (e) {}
  };

  /**
   * Puzzle piece placed incorrectly: dull thud.
   */
  window.playPieceMiss = function () {
    try {
      ramp(220, 170, 'triangle', 0.08, 0.06);
    } catch (e) {}
  };

  /**
   * Puzzle image completed: short fanfare.
   * Used for: each image completion in puzzle.
   */
  window.playPuzzleComplete = function () {
    try {
      var notes = [523, 659, 784, 1047];
      notes.forEach(function (f, i) { tone(f, 'triangle', 0.16, 0.22, i * 0.09); });
    } catch (e) {}
  };

  /**
   * Word found (word_search): bright chime.
   */
  window.playWordFound = function () {
    try {
      ramp(880, 1320, 'sine', 0.18, 0.2);
    } catch (e) {}
  };

  /**
   * Ahorcado letter reveal: soft key click.
   */
  window.playLetterReveal = function () {
    try {
      ramp(660, 880, 'sine', 0.11, 0.1);
    } catch (e) {}
  };

  /**
   * Ahorcado word completed: bright ascending run.
   */
  window.playWordComplete = function () {
    try {
      var notes = [659, 784, 988, 1175]; // E5-G5-B5-D6
      notes.forEach(function (f, i) { tone(f, 'sine', 0.15, 0.18, i * 0.07); });
    } catch (e) {}
  };

  /**
   * Game over (hanged/time out): somber descending phrase.
   */
  window.playGameOver = function () {
    try {
      var notes = [440, 349, 293, 220]; // A4-F4-D4-A3
      notes.forEach(function (f, i) { tone(f, 'sine', 0.15, 0.32, i * 0.19); });
    } catch (e) {}
  };

})();
