/**
 * Furby Audio Receiver
 *
 * Listens for Furby audio signals using microphone input and FFT analysis.
 * Detects the quaternary FSK encoding used by Furby toys.
 */

import { FurbyPacket } from './furby-packet.js';

export class FurbyReceiver {
    // Frequency thresholds for symbol detection
    static FREQUENCIES = {
        '0': { center: 16386, min: 16100, max: 16650 },
        '1': { center: 16943, min: 16650, max: 17220 },
        'X': { center: 17500, min: 17220, max: 17780 },
        '3': { center: 18057, min: 17780, max: 18335 },
        '2': { center: 18614, min: 18335, max: 18900 },
    };

    static SAMPLE_RATE = 44100;
    static FFT_SIZE = 2048;

    // Timing constants (ms)
    static SYMBOL_DURATION = 16;      // Expected symbol duration
    static MIN_SYMBOL_DURATION = 8;   // Minimum to accept
    static MAX_SYMBOL_DURATION = 60;  // Maximum to accept (allow some merging)
    static PACKET_TIMEOUT = 500;      // Time to wait for packet completion
    static BUFFER_MAX_AGE = 2000;     // Max age of symbols in buffer

    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isListening = false;
        this.onSignalDetected = null;
        this.onPacketReceived = null;
        this.onFrequencyUpdate = null;
        this.onRawSymbols = null;      // New: callback for raw symbol stream

        // Signal detection state
        this.symbolBuffer = [];         // All symbols with timestamps
        this.lastSymbol = null;
        this.symbolStartTime = 0;
        this.noiseFloor = 0;
        this.lastPacketTime = 0;
        this.processedPackets = new Set(); // Avoid duplicate packet reports
    }

    /**
     * Start listening for Furby signals
     * @returns {Promise<boolean>} - Success status
     */
    async startListening() {
        if (this.isListening) return true;

        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: FurbyReceiver.SAMPLE_RATE
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: FurbyReceiver.SAMPLE_RATE
            });

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = FurbyReceiver.FFT_SIZE;
            this.analyser.smoothingTimeConstant = 0.2; // Faster response

            // Connect microphone to analyser
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);

            this.isListening = true;
            this.stream = stream;

            // Start analysis loop
            this.analyzeLoop();

            return true;
        } catch (error) {
            console.error('Failed to start listening:', error);
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
        this.symbolBuffer = [];
        this.lastSymbol = null;
        this.processedPackets.clear();
    }

    /**
     * Main analysis loop
     */
    analyzeLoop() {
        if (!this.isListening) return;

        const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(frequencyData);

        // Analyze the frequency spectrum
        const analysis = this.analyzeSpectrum(frequencyData);

        // Report frequency data for visualization
        if (this.onFrequencyUpdate) {
            this.onFrequencyUpdate(analysis);
        }

        // Detect symbols
        if (analysis.detectedSymbol && analysis.signalStrength > this.noiseFloor + 25) {
            this.processSymbol(analysis.detectedSymbol, analysis.signalStrength);
        } else {
            // No signal - record gap and try to find packets
            this.processGap();
        }

        // Periodically try to find packets in buffer
        this.tryFindPackets();

        // Clean old symbols from buffer
        this.cleanBuffer();

        // Continue loop
        requestAnimationFrame(() => this.analyzeLoop());
    }

    /**
     * Analyze frequency spectrum to detect Furby symbols
     * @param {Uint8Array} frequencyData - FFT frequency data
     * @returns {object} - Analysis results
     */
    analyzeSpectrum(frequencyData) {
        const binWidth = this.audioContext.sampleRate / FurbyReceiver.FFT_SIZE;
        const results = {
            frequencies: {},
            detectedSymbol: null,
            signalStrength: 0,
            noiseLevel: 0
        };

        // Calculate noise floor (average of lower frequencies)
        let noiseSum = 0;
        const noiseBins = Math.floor(10000 / binWidth);
        for (let i = 0; i < noiseBins; i++) {
            noiseSum += frequencyData[i];
        }
        results.noiseLevel = noiseSum / noiseBins;
        this.noiseFloor = this.noiseFloor * 0.9 + results.noiseLevel * 0.1;

        // Check each Furby frequency
        let maxStrength = 0;
        let maxSymbol = null;

        for (const [symbol, freq] of Object.entries(FurbyReceiver.FREQUENCIES)) {
            const centerBin = Math.round(freq.center / binWidth);
            const minBin = Math.round(freq.min / binWidth);
            const maxBin = Math.round(freq.max / binWidth);

            // Get peak in this frequency range
            let peakValue = 0;
            let peakBin = centerBin;
            for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
                if (frequencyData[i] > peakValue) {
                    peakValue = frequencyData[i];
                    peakBin = i;
                }
            }

            const peakFreq = peakBin * binWidth;
            results.frequencies[symbol] = {
                strength: peakValue,
                frequency: peakFreq
            };

            if (peakValue > maxStrength) {
                maxStrength = peakValue;
                maxSymbol = symbol;
            }
        }

        results.signalStrength = maxStrength;

        // Only detect if signal is significantly above noise
        if (maxStrength > this.noiseFloor + 30) {
            results.detectedSymbol = maxSymbol;
        }

        return results;
    }

    /**
     * Process a detected symbol
     * @param {string} symbol - Detected symbol
     * @param {number} strength - Signal strength
     */
    processSymbol(symbol, strength) {
        const now = performance.now();

        if (symbol !== this.lastSymbol) {
            // New symbol detected - record the previous one
            if (this.lastSymbol !== null) {
                const duration = now - this.symbolStartTime;

                // Accept symbols with reasonable duration
                if (duration >= FurbyReceiver.MIN_SYMBOL_DURATION &&
                    duration <= FurbyReceiver.MAX_SYMBOL_DURATION) {

                    // Add to buffer with timestamp
                    this.symbolBuffer.push({
                        symbol: this.lastSymbol,
                        time: this.symbolStartTime,
                        duration: duration,
                        strength: strength
                    });

                    if (this.onSignalDetected) {
                        this.onSignalDetected({
                            symbol: this.lastSymbol,
                            duration: duration,
                            strength: strength
                        });
                    }
                }
            }

            this.lastSymbol = symbol;
            this.symbolStartTime = now;
        }
    }

    /**
     * Process a gap in the signal
     */
    processGap() {
        const now = performance.now();

        // If we had a symbol, record it before the gap
        if (this.lastSymbol !== null) {
            const duration = now - this.symbolStartTime;

            if (duration >= FurbyReceiver.MIN_SYMBOL_DURATION &&
                duration <= FurbyReceiver.MAX_SYMBOL_DURATION) {

                this.symbolBuffer.push({
                    symbol: this.lastSymbol,
                    time: this.symbolStartTime,
                    duration: duration,
                    strength: 0
                });

                if (this.onSignalDetected) {
                    this.onSignalDetected({
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
     * Try to find valid packets in the symbol buffer
     */
    tryFindPackets() {
        if (this.symbolBuffer.length < 10) return;

        // Extract just the data symbols (non-X)
        const dataSymbols = this.symbolBuffer
            .filter(s => s.symbol !== 'X')
            .map(s => s.symbol);

        // Need at least 10 data symbols for a packet
        if (dataSymbols.length < 10) return;

        // Try to find valid packets using sliding window
        for (let i = 0; i <= dataSymbols.length - 10; i++) {
            const candidate = dataSymbols.slice(i, i + 10).join('');

            // Skip if we've already processed this exact sequence recently
            if (this.processedPackets.has(candidate)) continue;

            try {
                const parsed = FurbyPacket.parsePacket(candidate);

                if (parsed.checksumValid) {
                    this.processedPackets.add(candidate);

                    // Clear old processed packets (keep last 50)
                    if (this.processedPackets.size > 50) {
                        const first = this.processedPackets.values().next().value;
                        this.processedPackets.delete(first);
                    }

                    if (this.onPacketReceived) {
                        this.onPacketReceived({
                            packet: candidate,
                            parsed: parsed,
                            timestamp: Date.now(),
                            bufferSize: this.symbolBuffer.length,
                            dataSymbolCount: dataSymbols.length
                        });
                    }

                    this.lastPacketTime = performance.now();

                    // Don't clear buffer immediately - might have more packets
                    return;
                }
            } catch (e) {
                // Invalid packet, continue
            }
        }

        // Also report raw symbol stream for debugging
        if (this.onRawSymbols && dataSymbols.length >= 5) {
            this.onRawSymbols({
                raw: this.symbolBuffer.map(s => s.symbol).join(''),
                data: dataSymbols.join(''),
                count: dataSymbols.length
            });
        }
    }

    /**
     * Clean old symbols from buffer
     */
    cleanBuffer() {
        const now = performance.now();
        const cutoff = now - FurbyReceiver.BUFFER_MAX_AGE;

        // Remove symbols older than max age
        this.symbolBuffer = this.symbolBuffer.filter(s => s.time > cutoff);

        // Also clear if too many symbols (prevent memory growth)
        if (this.symbolBuffer.length > 200) {
            this.symbolBuffer = this.symbolBuffer.slice(-100);
        }
    }

    /**
     * Get current buffer state for debugging
     * @returns {object} - Buffer statistics
     */
    getBufferState() {
        const dataSymbols = this.symbolBuffer.filter(s => s.symbol !== 'X');
        return {
            totalSymbols: this.symbolBuffer.length,
            dataSymbols: dataSymbols.length,
            raw: this.symbolBuffer.map(s => s.symbol).join(''),
            data: dataSymbols.map(s => s.symbol).join(''),
            noiseFloor: this.noiseFloor
        };
    }

    /**
     * Get frequency bin data for visualization
     * @returns {object} - Frequency data in the Furby range
     */
    getFrequencyData() {
        if (!this.analyser) return null;

        const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(frequencyData);

        const binWidth = this.audioContext.sampleRate / FurbyReceiver.FFT_SIZE;
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

export default FurbyReceiver;
