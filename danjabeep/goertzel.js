/**
 * Goertzel Algorithm - JavaScript port
 * Original: org.hyperdata.beeps.pitchdetect.GoertzelPitchFinder
 *
 * Efficient single-frequency detection algorithm
 * More efficient than FFT when only testing specific frequencies
 */

export class Goertzel {
    /**
     * Calculate Goertzel magnitude for a specific frequency
     * @param {Float32Array} samples - Audio samples
     * @param {number} targetFreq - Frequency to detect (Hz)
     * @param {number} sampleRate - Sample rate
     * @returns {number} - Magnitude at that frequency
     */
    static getMagnitude(samples, targetFreq, sampleRate) {
        const N = samples.length;
        const normalizedFreq = targetFreq / sampleRate;
        const coeff = 2 * Math.cos(2 * Math.PI * normalizedFreq);

        let s0 = 0;
        let s1 = 0;
        let s2 = 0;

        for (let i = 0; i < N; i++) {
            s0 = samples[i] + coeff * s1 - s2;
            s2 = s1;
            s1 = s0;
        }

        // Calculate power
        const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
        return Math.sqrt(Math.abs(power)) / N;
    }

    /**
     * Find the strongest frequency from a list of candidates
     * @param {Float32Array} samples - Audio samples
     * @param {number[]} frequencies - Candidate frequencies to test
     * @param {number} sampleRate - Sample rate
     * @returns {object} - { frequency, magnitude, index }
     */
    static findPeak(samples, frequencies, sampleRate) {
        let maxMagnitude = 0;
        let peakFreq = 0;
        let peakIndex = -1;

        for (let i = 0; i < frequencies.length; i++) {
            const mag = this.getMagnitude(samples, frequencies[i], sampleRate);
            if (mag > maxMagnitude) {
                maxMagnitude = mag;
                peakFreq = frequencies[i];
                peakIndex = i;
            }
        }

        return {
            frequency: peakFreq,
            magnitude: maxMagnitude,
            index: peakIndex
        };
    }

    /**
     * Get magnitudes for all candidate frequencies
     * @param {Float32Array} samples - Audio samples
     * @param {number[]} frequencies - Frequencies to test
     * @param {number} sampleRate - Sample rate
     * @returns {object[]} - Array of { frequency, magnitude }
     */
    static getAllMagnitudes(samples, frequencies, sampleRate) {
        return frequencies.map(freq => ({
            frequency: freq,
            magnitude: this.getMagnitude(samples, freq, sampleRate)
        }));
    }

    /**
     * Detect if a frequency is present (above threshold)
     * @param {Float32Array} samples - Audio samples
     * @param {number} targetFreq - Frequency to detect
     * @param {number} sampleRate - Sample rate
     * @param {number} threshold - Detection threshold
     * @returns {boolean} - True if frequency detected
     */
    static detect(samples, targetFreq, sampleRate, threshold = 0.01) {
        const mag = this.getMagnitude(samples, targetFreq, sampleRate);
        return mag > threshold;
    }
}

export default Goertzel;
