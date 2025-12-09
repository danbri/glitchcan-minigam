/**
 * WebBeep Frequency Maps - JavaScript port
 * Original: org.hyperdata.beeps.config.Maps
 *
 * Pentatonic scale frequency mappings for encoding/decoding
 */

import { Constants } from './constants.js';

export const Maps = {
    // Low frequency array (8 values) - pentatonic scale around middle C
    // C4, D4, E4, G4, A4, C4, D4, G4
    LOW_FREQ: [261.63, 293.66, 329.63, 392.0, 440.0, 261.63, 293.66, 392.0],

    // High frequency array (16 values) - pentatonic scale one octave up
    // C5, D5, E5, G5, A5, C6, D6, E6, G6, A6, C5, D5, G5, A5, A6, G6
    HIGH_FREQ: [
        523.25, 587.33, 659.26, 783.99, 880.0,
        1046.5, 1174.66, 1318.51, 1567.98, 1760.0,
        523.25, 587.33, 783.99, 880.0, 1760.0, 1567.98
    ],

    // Beat patterns (duration multipliers)
    // 1 = short, 2 = long
    LOW_BEATS: [1, 1, 1, 1, 2, 2, 2, 2],
    HIGH_BEATS: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2],

    // ABC notation for debugging
    LOW_NOTES: ['C', 'D', 'E', 'G', 'A', 'C', 'D', 'G'],
    HIGH_NOTES: [
        "c'", "d'", "e'", "g'", "a'",
        "c''", "d''", "e''", "g''", "a''",
        "c'", "d'", "g'", "a'", "a''", "g''"
    ],

    /**
     * Find the nearest frequency in a frequency array
     * @param {number} freq - Frequency to match
     * @param {number[]} freqArray - Array of valid frequencies
     * @returns {number} - Index of nearest frequency
     */
    findNearestNote(freq, freqArray) {
        let minDiff = Infinity;
        let nearestIndex = 0;

        for (let i = 0; i < freqArray.length; i++) {
            const diff = Math.abs(freqArray[i] - freq);
            if (diff < minDiff) {
                minDiff = diff;
                nearestIndex = i;
            }
        }

        return nearestIndex;
    },

    /**
     * Find index by matching frequency and beat
     * @param {number} note - Detected frequency
     * @param {number} beat - Detected beat duration
     * @param {number[]} freqs - Frequency array
     * @param {number[]} beats - Beats array
     * @returns {number} - Index or -1 if not found
     */
    unmapValue(note, beat, freqs, beats) {
        const tolerance = 20; // Hz tolerance for frequency matching

        for (let i = 0; i < freqs.length; i++) {
            if (Math.abs(freqs[i] - note) < tolerance && beats[i] === beat) {
                return i;
            }
        }

        // Fallback: just match frequency
        return this.findNearestNote(note, freqs);
    },

    /**
     * Get frequency range for filtering
     */
    getFrequencyRange() {
        const allFreqs = [...this.LOW_FREQ, ...this.HIGH_FREQ];
        const min = Math.min(...allFreqs);
        const max = Math.max(...allFreqs);
        return {
            min: min / Constants.CUTOFF_PADDING_RATIO,
            max: max * Constants.CUTOFF_PADDING_RATIO
        };
    }
};

export default Maps;
