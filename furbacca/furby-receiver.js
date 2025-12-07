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

    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isListening = false;
        this.onSignalDetected = null;
        this.onPacketReceived = null;
        this.onFrequencyUpdate = null;

        // Signal detection state
        this.currentSymbols = [];
        this.lastSymbol = null;
        this.symbolStartTime = 0;
        this.signalHistory = [];
        this.noiseFloor = 0;
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
            this.analyser.smoothingTimeConstant = 0.3;

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
        this.currentSymbols = [];
        this.lastSymbol = null;
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
        if (analysis.detectedSymbol && analysis.signalStrength > this.noiseFloor + 20) {
            this.processSymbol(analysis.detectedSymbol, analysis.signalStrength);
        } else {
            // No signal - might be end of packet
            this.checkPacketComplete();
        }

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
        this.noiseFloor = this.noiseFloor * 0.95 + results.noiseLevel * 0.05;

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
            // New symbol detected
            if (this.lastSymbol !== null) {
                const duration = now - this.symbolStartTime;

                // Only record if duration is reasonable (5-50ms)
                if (duration > 5 && duration < 50) {
                    // Skip carrier 'X' symbols when recording packet
                    if (this.lastSymbol !== 'X') {
                        this.currentSymbols.push(this.lastSymbol);
                    }

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
     * Check if a complete packet has been received
     */
    checkPacketComplete() {
        if (this.currentSymbols.length >= 10) {
            // We have enough symbols for a packet
            const packetStr = this.currentSymbols.slice(0, 10).join('');

            try {
                const parsed = FurbyPacket.parsePacket(packetStr);

                if (parsed.checksumValid && this.onPacketReceived) {
                    this.onPacketReceived({
                        packet: packetStr,
                        parsed: parsed,
                        timestamp: Date.now()
                    });
                }
            } catch (e) {
                // Invalid packet, ignore
            }

            // Clear symbols for next packet
            this.currentSymbols = [];
        }

        // Clear if no activity
        if (this.lastSymbol !== null) {
            const silenceDuration = performance.now() - this.symbolStartTime;
            if (silenceDuration > 100) {
                // Reset after 100ms of silence
                this.lastSymbol = null;
                this.currentSymbols = [];
            }
        }
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
