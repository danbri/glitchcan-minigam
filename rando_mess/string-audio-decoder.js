/**
 * String Audio Decoder
 *
 * Decodes FSK-encoded audio signals back to strings.
 * Uses FFT-based frequency detection to identify quaternary symbols.
 *
 * Designed for real-time microphone input or offline WAV analysis.
 */

import { StringAudioEncoder } from './string-audio-encoder.js';

export class StringAudioDecoder {
    // Frequency thresholds for symbol detection (based on encoder frequencies)
    static FREQ_BANDS = {
        '0': { center: 16386, min: 16100, max: 16650 },
        '1': { center: 16943, min: 16650, max: 17220 },
        'X': { center: 17500, min: 17220, max: 17780 },
        '3': { center: 18057, min: 17780, max: 18335 },
        '2': { center: 18614, min: 18335, max: 18900 },
    };

    // Lead-in/out detection range
    static LEADIN_RANGE = { min: 19000, max: 22500 };

    // Detection parameters
    static FFT_SIZE = 2048;
    static MIN_SIGNAL_THRESHOLD = 30;  // dB above noise floor
    static SYMBOL_MIN_DURATION = 8;    // ms
    static SYMBOL_MAX_DURATION = 40;   // ms
    static SYNC_MIN_COUNT = 3;         // Minimum X symbols for sync detection

    constructor(sampleRate = 44100) {
        this.sampleRate = sampleRate;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isListening = false;

        // Detection state
        this.symbolBuffer = [];
        this.lastSymbol = null;
        this.symbolStartTime = 0;
        this.noiseFloor = 0;
        this.syncDetected = false;
        this.decodedPackets = [];

        // Callbacks
        this.onSymbolDetected = null;
        this.onPacketDecoded = null;
        this.onStringDecoded = null;
        this.onFrequencyUpdate = null;
        this.onError = null;
    }

    /**
     * Start listening to microphone input
     * @returns {Promise<boolean>} - Success status
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
            this.analyser.fftSize = StringAudioDecoder.FFT_SIZE;
            this.analyser.smoothingTimeConstant = 0;

            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);

            this.isListening = true;
            this.stream = stream;
            this.reset();

            this.analyzeLoop();
            return true;
        } catch (error) {
            if (this.onError) {
                this.onError(error);
            }
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

        this.analyser = null;
    }

    /**
     * Reset decoder state
     */
    reset() {
        this.symbolBuffer = [];
        this.lastSymbol = null;
        this.symbolStartTime = 0;
        this.syncDetected = false;
        this.decodedPackets = [];
    }

    /**
     * Main analysis loop for real-time decoding
     */
    analyzeLoop() {
        if (!this.isListening) return;

        const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(frequencyData);

        const analysis = this.analyzeSpectrum(frequencyData);

        if (this.onFrequencyUpdate) {
            this.onFrequencyUpdate(analysis);
        }

        // Handle lead-in detection
        if (analysis.leadInDetected) {
            this.syncDetected = false;
            this.symbolBuffer = [];
        }

        // Detect symbols
        if (analysis.detectedSymbol && analysis.signalStrength > this.noiseFloor + StringAudioDecoder.MIN_SIGNAL_THRESHOLD) {
            this.processSymbol(analysis.detectedSymbol, analysis.signalStrength);
        } else if (!analysis.leadInDetected) {
            this.processGap();
        }

        // Try to decode packets
        this.tryDecodePacket();

        // Clean old symbols
        this.cleanBuffer();

        requestAnimationFrame(() => this.analyzeLoop());
    }

    /**
     * Analyze frequency spectrum
     * @param {Uint8Array} frequencyData - FFT data
     * @returns {object} - Analysis results
     */
    analyzeSpectrum(frequencyData) {
        const binWidth = this.sampleRate / StringAudioDecoder.FFT_SIZE;
        const results = {
            frequencies: {},
            detectedSymbol: null,
            signalStrength: 0,
            noiseLevel: 0,
            leadInDetected: false,
        };

        // Calculate noise floor (average of lower frequencies)
        let noiseSum = 0;
        const noiseBins = Math.floor(10000 / binWidth);
        for (let i = 0; i < noiseBins; i++) {
            noiseSum += frequencyData[i];
        }
        results.noiseLevel = noiseSum / noiseBins;
        this.noiseFloor = this.noiseFloor * 0.9 + results.noiseLevel * 0.1;

        // Check each symbol frequency band
        let maxStrength = 0;
        let maxSymbol = null;

        for (const [symbol, band] of Object.entries(StringAudioDecoder.FREQ_BANDS)) {
            const minBin = Math.round(band.min / binWidth);
            const maxBin = Math.round(band.max / binWidth);

            let peakValue = 0;
            let peakBin = Math.round(band.center / binWidth);

            for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
                if (frequencyData[i] > peakValue) {
                    peakValue = frequencyData[i];
                    peakBin = i;
                }
            }

            results.frequencies[symbol] = {
                strength: peakValue,
                frequency: peakBin * binWidth
            };

            if (peakValue > maxStrength) {
                maxStrength = peakValue;
                maxSymbol = symbol;
            }
        }

        results.signalStrength = maxStrength;

        // Check for lead-in frequency
        const leadInMinBin = Math.round(StringAudioDecoder.LEADIN_RANGE.min / binWidth);
        const leadInMaxBin = Math.round(StringAudioDecoder.LEADIN_RANGE.max / binWidth);
        let leadInPeak = 0;

        for (let i = leadInMinBin; i <= leadInMaxBin && i < frequencyData.length; i++) {
            if (frequencyData[i] > leadInPeak) {
                leadInPeak = frequencyData[i];
            }
        }

        if (leadInPeak > maxStrength && leadInPeak > this.noiseFloor + StringAudioDecoder.MIN_SIGNAL_THRESHOLD) {
            results.leadInDetected = true;
        } else if (maxStrength > this.noiseFloor + StringAudioDecoder.MIN_SIGNAL_THRESHOLD) {
            results.detectedSymbol = maxSymbol;
        }

        return results;
    }

    /**
     * Process detected symbol
     * @param {string} symbol - Detected symbol
     * @param {number} strength - Signal strength
     */
    processSymbol(symbol, strength) {
        const now = performance.now();

        if (symbol !== this.lastSymbol) {
            // Record previous symbol
            if (this.lastSymbol !== null) {
                const duration = now - this.symbolStartTime;

                if (duration >= StringAudioDecoder.SYMBOL_MIN_DURATION &&
                    duration <= StringAudioDecoder.SYMBOL_MAX_DURATION) {

                    this.symbolBuffer.push({
                        symbol: this.lastSymbol,
                        time: this.symbolStartTime,
                        duration: duration,
                        strength: strength
                    });

                    if (this.onSymbolDetected) {
                        this.onSymbolDetected({
                            symbol: this.lastSymbol,
                            duration: duration,
                            strength: strength
                        });
                    }

                    // Detect sync pattern (multiple X symbols)
                    this.checkSyncPattern();
                }
            }

            this.lastSymbol = symbol;
            this.symbolStartTime = now;
        }
    }

    /**
     * Process gap in signal
     */
    processGap() {
        const now = performance.now();

        if (this.lastSymbol !== null) {
            const duration = now - this.symbolStartTime;

            if (duration >= StringAudioDecoder.SYMBOL_MIN_DURATION &&
                duration <= StringAudioDecoder.SYMBOL_MAX_DURATION) {

                this.symbolBuffer.push({
                    symbol: this.lastSymbol,
                    time: this.symbolStartTime,
                    duration: duration,
                    strength: 0
                });

                if (this.onSymbolDetected) {
                    this.onSymbolDetected({
                        symbol: this.lastSymbol,
                        duration: duration,
                        strength: 0
                    });
                }
            }

            this.lastSymbol = null;
        }
    }

    /**
     * Check for sync pattern (multiple X symbols)
     */
    checkSyncPattern() {
        if (this.syncDetected) return;

        const recentSymbols = this.symbolBuffer.slice(-10);
        let xCount = 0;

        for (const s of recentSymbols) {
            if (s.symbol === 'X') xCount++;
        }

        if (xCount >= StringAudioDecoder.SYNC_MIN_COUNT) {
            this.syncDetected = true;
        }
    }

    /**
     * Try to decode a packet from the symbol buffer
     */
    tryDecodePacket() {
        if (!this.syncDetected) return;

        // Extract data symbols (non-X)
        const dataSymbols = this.symbolBuffer
            .filter(s => s.symbol !== 'X')
            .map(s => s.symbol)
            .join('');

        // Need at least 16 symbols for minimal packet (4 bytes = 16 quaternary)
        if (dataSymbols.length < 16) return;

        // Try to decode
        const result = this.decodeQuaternary(dataSymbols);

        if (result.success) {
            this.decodedPackets.push(result);

            if (this.onPacketDecoded) {
                this.onPacketDecoded(result);
            }

            if (this.onStringDecoded) {
                this.onStringDecoded(result.text);
            }

            // Clear processed symbols
            this.reset();
        }
    }

    /**
     * Decode quaternary symbols to string
     * @param {string} symbols - Quaternary symbol string
     * @returns {object} - Decode result
     */
    decodeQuaternary(symbols) {
        const result = {
            success: false,
            text: '',
            error: null,
            rawSymbols: symbols,
            packetBytes: null,
            crcValid: false
        };

        try {
            // Convert to bytes
            const bytes = StringAudioEncoder.quaternaryToBytes(symbols);

            // Validate minimum length
            if (bytes.length < 4) {
                result.error = 'Packet too short';
                return result;
            }

            // Check magic header
            if (bytes[0] !== StringAudioEncoder.MAGIC_HEADER) {
                result.error = `Invalid magic header: 0x${bytes[0].toString(16)}`;
                return result;
            }

            // Get length
            const dataLength = bytes[1];

            // Check we have enough bytes
            if (bytes.length < 2 + dataLength + 2) {
                result.error = 'Incomplete packet';
                return result;
            }

            // Extract data
            const data = bytes.subarray(2, 2 + dataLength);

            // Verify CRC
            const expectedCrc = (bytes[2 + dataLength] << 8) | bytes[2 + dataLength + 1];
            const calculatedCrc = StringAudioEncoder.crc16(bytes.subarray(0, 2 + dataLength));

            result.crcValid = expectedCrc === calculatedCrc;
            result.packetBytes = bytes;

            if (!result.crcValid) {
                result.error = `CRC mismatch: expected 0x${expectedCrc.toString(16)}, got 0x${calculatedCrc.toString(16)}`;
                return result;
            }

            // Decode UTF-8
            const decoder = new TextDecoder();
            result.text = decoder.decode(data);
            result.success = true;

        } catch (e) {
            result.error = e.message;
        }

        return result;
    }

    /**
     * Clean old symbols from buffer
     */
    cleanBuffer() {
        const now = performance.now();
        const maxAge = 5000; // 5 seconds

        this.symbolBuffer = this.symbolBuffer.filter(s => now - s.time < maxAge);

        // Limit buffer size
        if (this.symbolBuffer.length > 500) {
            this.symbolBuffer = this.symbolBuffer.slice(-300);
        }
    }

    /**
     * Decode audio samples directly (offline mode)
     * @param {Float32Array} samples - Audio samples
     * @param {number} sampleRate - Sample rate
     * @returns {object} - Decode result
     */
    static decodeSamples(samples, sampleRate = 44100) {
        // Simple peak-based symbol detection for offline analysis
        const fftSize = 2048;
        const hopSize = fftSize / 4;
        const symbols = [];

        // This is a simplified offline decoder
        // Full implementation would use proper FFT analysis
        for (let offset = 0; offset < samples.length - fftSize; offset += hopSize) {
            const chunk = samples.slice(offset, offset + fftSize);
            const freq = StringAudioDecoder.estimateFrequency(chunk, sampleRate);

            if (freq > 0) {
                const symbol = StringAudioDecoder.frequencyToSymbol(freq);
                if (symbol && (symbols.length === 0 || symbols[symbols.length - 1] !== symbol)) {
                    symbols.push(symbol);
                }
            }
        }

        // Extract data symbols
        const dataSymbols = symbols.filter(s => s !== 'X').join('');

        // Create decoder instance for decoding
        const decoder = new StringAudioDecoder(sampleRate);
        return decoder.decodeQuaternary(dataSymbols);
    }

    /**
     * Estimate dominant frequency in audio chunk
     * @param {Float32Array} samples - Audio chunk
     * @param {number} sampleRate - Sample rate
     * @returns {number} - Estimated frequency or 0
     */
    static estimateFrequency(samples, sampleRate) {
        // Zero-crossing based frequency estimation
        let crossings = 0;
        for (let i = 1; i < samples.length; i++) {
            if ((samples[i - 1] < 0 && samples[i] >= 0) ||
                (samples[i - 1] >= 0 && samples[i] < 0)) {
                crossings++;
            }
        }

        // Each period has 2 crossings
        const duration = samples.length / sampleRate;
        const frequency = crossings / (2 * duration);

        // Filter to our frequency range
        if (frequency >= 15000 && frequency <= 20000) {
            return frequency;
        }

        return 0;
    }

    /**
     * Map frequency to symbol
     * @param {number} frequency - Frequency in Hz
     * @returns {string|null} - Symbol or null
     */
    static frequencyToSymbol(frequency) {
        for (const [symbol, band] of Object.entries(StringAudioDecoder.FREQ_BANDS)) {
            if (frequency >= band.min && frequency <= band.max) {
                return symbol;
            }
        }
        return null;
    }

    /**
     * Get current buffer state for debugging
     * @returns {object} - Buffer state
     */
    getBufferState() {
        const dataSymbols = this.symbolBuffer.filter(s => s.symbol !== 'X');
        return {
            totalSymbols: this.symbolBuffer.length,
            dataSymbols: dataSymbols.length,
            raw: this.symbolBuffer.map(s => s.symbol).join(''),
            data: dataSymbols.map(s => s.symbol).join(''),
            syncDetected: this.syncDetected,
            noiseFloor: this.noiseFloor,
            decodedPackets: this.decodedPackets.length
        };
    }

    /**
     * Get frequency data for visualization
     * @returns {object|null} - Frequency data
     */
    getFrequencyData() {
        if (!this.analyser) return null;

        const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(frequencyData);

        const binWidth = this.sampleRate / StringAudioDecoder.FFT_SIZE;
        const startBin = Math.floor(15000 / binWidth);
        const endBin = Math.ceil(20000 / binWidth);

        return {
            data: frequencyData.slice(startBin, endBin),
            startFreq: 15000,
            endFreq: 20000,
            binWidth: binWidth
        };
    }
}

export default StringAudioDecoder;
