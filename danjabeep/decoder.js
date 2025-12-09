/**
 * WebBeep Decoder - JavaScript port
 * Original: org.hyperdata.beeps.DefaultDecoder, CharacterDecoder
 *
 * Decodes audio back to strings using Goertzel pitch detection
 */

import { Constants } from './constants.js';
import { Maps } from './maps.js';
import { Goertzel } from './goertzel.js';
import { Encoder } from './encoder.js';

export class Decoder {
    constructor(sampleRate = Constants.SAMPLE_RATE) {
        this.sampleRate = sampleRate;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isListening = false;

        // Callbacks
        this.onFrequencyUpdate = null;
        this.onChunkDecoded = null;
        this.onStringDecoded = null;
        this.onError = null;

        // Decoding state
        this.sampleBuffer = [];
        this.decodedChunks = [];
    }

    /**
     * Decode audio samples to string
     * @param {Float32Array} samples - Audio samples
     * @param {number} sampleRate - Sample rate
     * @returns {object} - { text, bytes, checksumValid, chunks }
     */
    static decode(samples, sampleRate = Constants.SAMPLE_RATE) {
        // Normalize
        const normalized = this.normalize(samples);

        // Crop silence from start/end
        const cropped = this.cropSilence(normalized);

        // Split into character-sized chunks
        const chunks = this.splitIntoChunks(cropped, sampleRate);

        // Decode each chunk
        const bytes = [];
        const chunkInfo = [];

        for (const chunk of chunks) {
            const result = this.decodeChunk(chunk, sampleRate);
            if (result.byte !== null) {
                bytes.push(result.byte);
                chunkInfo.push(result);
            }
        }

        if (bytes.length === 0) {
            return {
                text: '',
                bytes: new Uint8Array(0),
                checksumValid: false,
                chunks: chunkInfo,
                error: 'No bytes decoded'
            };
        }

        // Extract data and checksum
        const byteArray = new Uint8Array(bytes);
        const checksumValid = Encoder.verifyChecksum(byteArray);

        // Convert bytes to string (excluding checksum)
        const dataBytes = byteArray.slice(0, byteArray.length - 1);
        const textDecoder = new TextDecoder();
        const text = textDecoder.decode(dataBytes);

        return {
            text,
            bytes: byteArray,
            checksumValid,
            chunks: chunkInfo
        };
    }

    /**
     * Normalize samples to [-1, 1]
     * @param {Float32Array} samples
     * @returns {Float32Array}
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

    /**
     * Crop silence from start and end
     * @param {Float32Array} samples
     * @returns {Float32Array}
     */
    static cropSilence(samples) {
        const threshold = Constants.SILENCE_THRESHOLD * 0.1;

        // Find start (first non-silent sample)
        let start = 0;
        for (let i = 0; i < samples.length; i++) {
            if (Math.abs(samples[i]) > threshold) {
                start = Math.max(0, i - 100); // Include a bit before
                break;
            }
        }

        // Find end (last non-silent sample)
        let end = samples.length;
        for (let i = samples.length - 1; i >= 0; i--) {
            if (Math.abs(samples[i]) > threshold) {
                end = Math.min(samples.length, i + 100); // Include a bit after
                break;
            }
        }

        return samples.slice(start, end);
    }

    /**
     * Split samples into character-sized chunks
     * @param {Float32Array} samples
     * @param {number} sampleRate
     * @returns {Float32Array[]}
     */
    static splitIntoChunks(samples, sampleRate) {
        // Chunk size based on tone duration (accounting for beats)
        const chunkDuration = Constants.TONE_DURATION * 1.5; // Average beat multiplier
        const chunkSize = Math.floor(chunkDuration * sampleRate);

        const chunks = [];
        for (let i = 0; i < samples.length; i += chunkSize) {
            const chunk = samples.slice(i, Math.min(i + chunkSize, samples.length));
            if (chunk.length > chunkSize * 0.5) { // Skip tiny trailing chunks
                chunks.push(chunk);
            }
        }

        return chunks;
    }

    /**
     * Decode a single audio chunk to a byte
     * @param {Float32Array} chunk - Audio samples
     * @param {number} sampleRate - Sample rate
     * @returns {object} - { byte, lowFreq, highFreq, lowIndex, highIndex }
     */
    static decodeChunk(chunk, sampleRate) {
        // Find strongest low frequency
        const lowResult = Goertzel.findPeak(chunk, Maps.LOW_FREQ, sampleRate);

        // Find strongest high frequency
        const highResult = Goertzel.findPeak(chunk, Maps.HIGH_FREQ, sampleRate);

        // If no strong signal, return null
        const minMagnitude = 0.001;
        if (lowResult.magnitude < minMagnitude || highResult.magnitude < minMagnitude) {
            return {
                byte: null,
                lowFreq: lowResult.frequency,
                highFreq: highResult.frequency,
                lowIndex: -1,
                highIndex: -1,
                error: 'Signal too weak'
            };
        }

        // Map frequencies back to nibbles
        const lowIndex = Maps.findNearestNote(lowResult.frequency, Maps.LOW_FREQ);
        const highIndex = Maps.findNearestNote(highResult.frequency, Maps.HIGH_FREQ);

        // Reconstruct byte: highNibble from lowFreq, lowNibble from highFreq
        const highNibble = lowIndex % 16;
        const lowNibble = highIndex % 16;
        const byte = (highNibble * 16) + lowNibble;

        return {
            byte,
            lowFreq: lowResult.frequency,
            highFreq: highResult.frequency,
            lowMagnitude: lowResult.magnitude,
            highMagnitude: highResult.magnitude,
            lowIndex,
            highIndex,
            highNibble,
            lowNibble
        };
    }

    /**
     * Start listening to microphone
     * @returns {Promise<boolean>}
     */
    async startListening() {
        if (this.isListening) return true;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: this.sampleRate
                }
            });

            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0;

            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);

            this.isListening = true;
            this.stream = stream;

            this.analyzeLoop();
            return true;
        } catch (error) {
            if (this.onError) this.onError(error);
            throw error;
        }
    }

    /**
     * Stop listening
     */
    stopListening() {
        this.isListening = false;

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    /**
     * Real-time analysis loop
     */
    analyzeLoop() {
        if (!this.isListening) return;

        // Get frequency data using FFT for visualization
        const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(frequencyData);

        // Get time-domain data for Goertzel
        const timeDomainData = new Float32Array(this.analyser.fftSize);
        this.analyser.getFloatTimeDomainData(timeDomainData);

        // Analyze with Goertzel
        const allFreqs = [...Maps.LOW_FREQ, ...Maps.HIGH_FREQ];
        const magnitudes = Goertzel.getAllMagnitudes(timeDomainData, allFreqs, this.sampleRate);

        if (this.onFrequencyUpdate) {
            this.onFrequencyUpdate({
                fftData: frequencyData,
                goertzelMagnitudes: magnitudes,
                sampleRate: this.sampleRate
            });
        }

        requestAnimationFrame(() => this.analyzeLoop());
    }

    /**
     * Get frequency data for visualization
     * @returns {object|null}
     */
    getFrequencyData() {
        if (!this.analyser) return null;

        const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(frequencyData);

        const binWidth = this.sampleRate / this.analyser.fftSize;

        return {
            data: frequencyData,
            binWidth,
            sampleRate: this.sampleRate
        };
    }
}

export default Decoder;
