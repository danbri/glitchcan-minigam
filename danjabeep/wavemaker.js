/**
 * WebBeep WaveMaker - JavaScript port
 * Original: org.hyperdata.beeps.WaveMaker
 *
 * Generates audio waveforms for encoding
 */

import { Constants } from './constants.js';
import { Maps } from './maps.js';

export class WaveMaker {
    /**
     * Make a dual-tone waveform for encoding a nibble pair
     * @param {number} lowIndex - Index into LOW_FREQ array (0-7)
     * @param {number} highIndex - Index into HIGH_FREQ array (0-15)
     * @param {number} sampleRate - Sample rate (default 22050)
     * @returns {Float32Array} - Audio samples
     */
    static makeDualTone(lowIndex, highIndex, sampleRate = Constants.SAMPLE_RATE) {
        const lowFreq = Maps.LOW_FREQ[lowIndex % Maps.LOW_FREQ.length];
        const highFreq = Maps.HIGH_FREQ[highIndex % Maps.HIGH_FREQ.length];
        const lowBeat = Maps.LOW_BEATS[lowIndex % Maps.LOW_BEATS.length];
        const highBeat = Maps.HIGH_BEATS[highIndex % Maps.HIGH_BEATS.length];

        // Duration based on beats
        const duration = Constants.TONE_DURATION * Math.max(lowBeat, highBeat);
        const numSamples = Math.floor(duration * sampleRate);
        const samples = new Float32Array(numSamples);

        // Generate combined waveform
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const lowSample = Math.sin(2 * Math.PI * lowFreq * t);
            const highSample = Math.sin(2 * Math.PI * highFreq * t);

            // Mix the two tones
            samples[i] = (lowSample + highSample) * 0.5 * Constants.AMPLITUDE;
        }

        // Apply envelope shaping
        return this.applyEnvelope(samples, sampleRate);
    }

    /**
     * Make a single-frequency tone
     * @param {number} frequency - Frequency in Hz
     * @param {number} duration - Duration in seconds
     * @param {number} sampleRate - Sample rate
     * @returns {Float32Array} - Audio samples
     */
    static makeTone(frequency, duration, sampleRate = Constants.SAMPLE_RATE) {
        const numSamples = Math.floor(duration * sampleRate);
        const samples = new Float32Array(numSamples);

        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            samples[i] = Math.sin(2 * Math.PI * frequency * t) * Constants.AMPLITUDE;
        }

        return this.applyEnvelope(samples, sampleRate);
    }

    /**
     * Apply attack/decay envelope to samples
     * @param {Float32Array} samples - Input samples
     * @param {number} sampleRate - Sample rate
     * @returns {Float32Array} - Shaped samples
     */
    static applyEnvelope(samples, sampleRate = Constants.SAMPLE_RATE) {
        const attackSamples = Math.floor(samples.length * Constants.ATTACK_PROPORTION);
        const decaySamples = Math.floor(samples.length * Constants.DECAY_PROPORTION);
        const shaped = new Float32Array(samples.length);

        for (let i = 0; i < samples.length; i++) {
            let envelope = 1.0;

            // Attack phase (fade in)
            if (i < attackSamples) {
                envelope = i / attackSamples;
            }
            // Decay phase (fade out)
            else if (i >= samples.length - decaySamples) {
                envelope = (samples.length - i) / decaySamples;
            }

            shaped[i] = samples[i] * envelope;
        }

        return shaped;
    }

    /**
     * Make silence
     * @param {number} duration - Duration in seconds
     * @param {number} sampleRate - Sample rate
     * @returns {Float32Array} - Zero samples
     */
    static makeSilence(duration, sampleRate = Constants.SAMPLE_RATE) {
        const numSamples = Math.floor(duration * sampleRate);
        return new Float32Array(numSamples);
    }

    /**
     * Merge multiple audio chunks
     * @param {Float32Array[]} chunks - Array of sample arrays
     * @returns {Float32Array} - Merged samples
     */
    static mergeChunks(chunks) {
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const merged = new Float32Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }

        return merged;
    }

    /**
     * Normalize samples to [-1, 1] range
     * @param {Float32Array} samples - Input samples
     * @returns {Float32Array} - Normalized samples
     */
    static normalize(samples) {
        let max = 0;
        for (const s of samples) {
            const abs = Math.abs(s);
            if (abs > max) max = abs;
        }

        if (max === 0) return samples;

        const normalized = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            normalized[i] = samples[i] / max;
        }

        return normalized;
    }
}

export default WaveMaker;
