/**
 * WebBeep Encoder - JavaScript port
 * Original: org.hyperdata.beeps.DefaultEncoder, ASCIICodec
 *
 * Encodes strings into audio using dual-tone pentatonic encoding
 */

import { Constants } from './constants.js';
import { Maps } from './maps.js';
import { WaveMaker } from './wavemaker.js';

export class Encoder {
    /**
     * Encode a string to audio samples
     * @param {string} text - String to encode
     * @param {number} sampleRate - Sample rate (default 22050)
     * @returns {Float32Array} - Audio samples
     */
    static encode(text, sampleRate = Constants.SAMPLE_RATE) {
        // Convert to ASCII bytes
        const bytes = this.stringToBytes(text);

        // Add checksum
        const checksum = this.calculateChecksum(bytes);
        const withChecksum = new Uint8Array(bytes.length + 1);
        withChecksum.set(bytes);
        withChecksum[bytes.length] = checksum;

        // Convert each byte to audio chunks
        const chunks = [];

        // Start padding (silence)
        chunks.push(WaveMaker.makeSilence(Constants.START_PADDING, sampleRate));

        // Encode each byte as dual-tone
        for (const byte of withChecksum) {
            const dualTone = this.byteToDualTone(byte, sampleRate);
            chunks.push(dualTone);
        }

        // End padding (silence)
        chunks.push(WaveMaker.makeSilence(Constants.END_PADDING, sampleRate));

        // Merge and normalize
        const merged = WaveMaker.mergeChunks(chunks);
        return WaveMaker.normalize(merged);
    }

    /**
     * Convert a byte to a dual-tone audio chunk
     * Each byte split into two hex nibbles (0-15 each)
     * @param {number} byte - Byte value (0-255)
     * @param {number} sampleRate - Sample rate
     * @returns {Float32Array} - Audio samples
     */
    static byteToDualTone(byte, sampleRate = Constants.SAMPLE_RATE) {
        // Split byte into two 4-bit nibbles
        const lowNibble = byte % 16;        // Low 4 bits (0-15) -> high freq index
        const highNibble = Math.floor(byte / 16);  // High 4 bits (0-15) -> maps to low freq

        // Map nibbles to frequency indices
        // High nibble (0-15) maps to LOW_FREQ (8 values, so modulo 8)
        // Low nibble (0-15) maps to HIGH_FREQ (16 values)
        const lowFreqIndex = highNibble % 8;
        const highFreqIndex = lowNibble;

        return WaveMaker.makeDualTone(lowFreqIndex, highFreqIndex, sampleRate);
    }

    /**
     * Convert string to bytes (ASCII with basic Punycode-like handling)
     * @param {string} text - Input string
     * @returns {Uint8Array} - ASCII bytes
     */
    static stringToBytes(text) {
        const encoder = new TextEncoder();
        const utf8 = encoder.encode(text);

        // For non-ASCII, we'll keep UTF-8 bytes directly
        // (Original uses Punycode, but UTF-8 is more practical for JS)
        return utf8;
    }

    /**
     * Calculate simple checksum
     * @param {Uint8Array} bytes - Input bytes
     * @returns {number} - Checksum byte
     */
    static calculateChecksum(bytes) {
        let sum = 0;
        for (const b of bytes) {
            sum = (sum + b) & 0xFF;
        }
        return sum ^ 0xFF; // Complement
    }

    /**
     * Verify checksum
     * @param {Uint8Array} bytes - Bytes including checksum
     * @returns {boolean} - True if valid
     */
    static verifyChecksum(bytes) {
        if (bytes.length < 2) return false;

        const data = bytes.slice(0, bytes.length - 1);
        const received = bytes[bytes.length - 1];
        const expected = this.calculateChecksum(data);

        return received === expected;
    }

    /**
     * Generate audio for Web Audio API
     * @param {string} text - String to encode
     * @param {AudioContext} audioContext - Web Audio context
     * @returns {AudioBuffer} - Audio buffer ready to play
     */
    static generateAudioBuffer(text, audioContext) {
        const sampleRate = audioContext.sampleRate;
        const samples = this.encode(text, sampleRate);
        const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
        buffer.getChannelData(0).set(samples);
        return buffer;
    }

    /**
     * Play encoded string
     * @param {string} text - String to encode and play
     * @param {AudioContext} audioContext - Web Audio context
     * @returns {AudioBufferSourceNode} - Playing source
     */
    static play(text, audioContext) {
        const buffer = this.generateAudioBuffer(text, audioContext);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
        return source;
    }

    /**
     * Generate WAV file blob
     * @param {string} text - String to encode
     * @returns {Blob} - WAV file blob
     */
    static generateWav(text) {
        const samples = this.encode(text, Constants.SAMPLE_RATE);
        return this.samplesToWav(samples, Constants.SAMPLE_RATE);
    }

    /**
     * Convert samples to WAV blob
     * @param {Float32Array} samples - Audio samples
     * @param {number} sampleRate - Sample rate
     * @returns {Blob} - WAV blob
     */
    static samplesToWav(samples, sampleRate) {
        const numChannels = 1;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = samples.length * bytesPerSample;
        const headerSize = 44;
        const totalSize = headerSize + dataSize;

        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        let offset = 0;

        // RIFF header
        this.writeString(view, offset, 'RIFF'); offset += 4;
        view.setUint32(offset, totalSize - 8, true); offset += 4;
        this.writeString(view, offset, 'WAVE'); offset += 4;

        // fmt chunk
        this.writeString(view, offset, 'fmt '); offset += 4;
        view.setUint32(offset, 16, true); offset += 4;
        view.setUint16(offset, 1, true); offset += 2; // PCM
        view.setUint16(offset, numChannels, true); offset += 2;
        view.setUint32(offset, sampleRate, true); offset += 4;
        view.setUint32(offset, byteRate, true); offset += 4;
        view.setUint16(offset, blockAlign, true); offset += 2;
        view.setUint16(offset, bitsPerSample, true); offset += 2;

        // data chunk
        this.writeString(view, offset, 'data'); offset += 4;
        view.setUint32(offset, dataSize, true); offset += 4;

        // Sample data
        const maxVal = 32767;
        for (let i = 0; i < samples.length; i++) {
            const sample = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, Math.floor(sample * maxVal), true);
            offset += 2;
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    /**
     * Write string to DataView
     */
    static writeString(view, offset, str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    /**
     * Download WAV file
     * @param {string} text - String to encode
     * @param {string} filename - Output filename
     */
    static downloadWav(text, filename = 'webbeep.wav') {
        const blob = this.generateWav(text);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Get encoding statistics
     * @param {string} text - String to analyze
     * @returns {object} - Statistics
     */
    static getStats(text) {
        const bytes = this.stringToBytes(text);
        const totalBytes = bytes.length + 1; // +1 for checksum

        const toneDuration = Constants.TONE_DURATION;
        const totalDuration = Constants.START_PADDING +
            (totalBytes * toneDuration * 2) + // Approximate with beats
            Constants.END_PADDING;

        return {
            inputLength: text.length,
            byteLength: bytes.length,
            totalBytes: totalBytes,
            checksum: this.calculateChecksum(bytes).toString(16).padStart(2, '0'),
            toneDurationMs: toneDuration * 1000,
            estimatedDurationMs: Math.round(totalDuration * 1000),
            sampleRate: Constants.SAMPLE_RATE,
            frequencies: {
                low: Maps.LOW_FREQ,
                high: Maps.HIGH_FREQ
            }
        };
    }
}

export default Encoder;
