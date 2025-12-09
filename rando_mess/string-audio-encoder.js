/**
 * String Audio Encoder
 *
 * Encodes arbitrary strings (identifiers, URIs) into audio using FSK
 * (Frequency-Shift Keying). Based on the Furbacca/Hacksby protocol but
 * generalized for arbitrary data.
 *
 * Encoding scheme:
 * - Uses 5 frequencies for quaternary (base-4) encoding + carrier
 * - Each byte encoded as 4 quaternary digits
 * - Includes sync preamble, length header, data, and CRC checksum
 * - Frequencies are in ultrasonic range (16-19 kHz) for minimal audibility
 */

export class StringAudioEncoder {
    // Frequency mapping for quaternary symbols (matching Furbacca)
    static FREQUENCIES = {
        '0': 16386,  // Symbol 0
        '1': 16943,  // Symbol 1
        'X': 17500,  // Carrier/sync frequency
        '3': 18057,  // Symbol 3
        '2': 18614,  // Symbol 2
    };

    // Audio parameters
    static SAMPLE_RATE = 44100;
    static NYQUIST = 44100 / 2;

    // Timing parameters (seconds)
    static SYMBOL_DURATION = 0.016;        // 16ms per symbol
    static CROSSFADE_DURATION = 0.004;     // 4ms crossfade
    static SYNC_DURATION = 0.050;          // 50ms sync tone
    static PACKET_GAP = 0.100;             // 100ms between packets

    // Protocol constants
    static SYNC_PATTERN = 'XXXX';          // Sync preamble
    static MAX_STRING_LENGTH = 255;        // Max bytes per message
    static MAGIC_HEADER = 0xAE;            // Magic byte for validation

    /**
     * Encode a string to audio samples
     * @param {string} text - String to encode (UTF-8)
     * @param {number} sampleRate - Audio sample rate (default 44100)
     * @returns {Float32Array} - Audio samples
     */
    static encode(text, sampleRate = this.SAMPLE_RATE) {
        // Convert to UTF-8 bytes
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);

        if (bytes.length > this.MAX_STRING_LENGTH) {
            throw new Error(`String too long: ${bytes.length} bytes (max ${this.MAX_STRING_LENGTH})`);
        }

        // Build packet: MAGIC + LENGTH + DATA + CRC16
        const packet = this.buildPacket(bytes);

        // Convert to quaternary symbols
        const symbols = this.bytesToQuaternary(packet);

        // Interleave with carrier
        const interleaved = this.interleaveWithCarrier(symbols);

        // Add sync preamble
        const fullSequence = this.SYNC_PATTERN + interleaved;

        // Generate audio samples
        return this.generateAudio(fullSequence, sampleRate);
    }

    /**
     * Build a packet with header and checksum
     * @param {Uint8Array} data - Data bytes
     * @returns {Uint8Array} - Complete packet
     */
    static buildPacket(data) {
        const packet = new Uint8Array(2 + data.length + 2); // magic + len + data + crc16

        packet[0] = this.MAGIC_HEADER;
        packet[1] = data.length;
        packet.set(data, 2);

        // Calculate CRC16
        const crc = this.crc16(packet.subarray(0, 2 + data.length));
        packet[2 + data.length] = (crc >> 8) & 0xFF;
        packet[2 + data.length + 1] = crc & 0xFF;

        return packet;
    }

    /**
     * Calculate CRC16-CCITT
     * @param {Uint8Array} data - Data to checksum
     * @returns {number} - 16-bit CRC
     */
    static crc16(data) {
        let crc = 0xFFFF;
        const polynomial = 0x1021;

        for (const byte of data) {
            crc ^= (byte << 8);
            for (let i = 0; i < 8; i++) {
                if (crc & 0x8000) {
                    crc = ((crc << 1) ^ polynomial) & 0xFFFF;
                } else {
                    crc = (crc << 1) & 0xFFFF;
                }
            }
        }

        return crc;
    }

    /**
     * Convert bytes to quaternary (base-4) string
     * @param {Uint8Array} bytes - Bytes to convert
     * @returns {string} - Quaternary string (4 digits per byte)
     */
    static bytesToQuaternary(bytes) {
        let result = '';
        for (const byte of bytes) {
            // Each byte = 4 quaternary digits (2 bits each)
            result += ((byte >> 6) & 3).toString();
            result += ((byte >> 4) & 3).toString();
            result += ((byte >> 2) & 3).toString();
            result += (byte & 3).toString();
        }
        return result;
    }

    /**
     * Convert quaternary string back to bytes
     * @param {string} quad - Quaternary string
     * @returns {Uint8Array} - Bytes
     */
    static quaternaryToBytes(quad) {
        const bytes = new Uint8Array(Math.floor(quad.length / 4));
        for (let i = 0; i < bytes.length; i++) {
            const offset = i * 4;
            bytes[i] = (parseInt(quad[offset], 10) << 6) |
                       (parseInt(quad[offset + 1], 10) << 4) |
                       (parseInt(quad[offset + 2], 10) << 2) |
                       parseInt(quad[offset + 3], 10);
        }
        return bytes;
    }

    /**
     * Interleave data symbols with carrier frequency
     * @param {string} symbols - Data symbols
     * @returns {string} - Interleaved sequence
     */
    static interleaveWithCarrier(symbols) {
        // Format: X<sym>X<sym>X...X
        const chars = ['', ...symbols.split(''), ''];
        return chars.join('X');
    }

    /**
     * Generate audio samples from symbol sequence
     * @param {string} sequence - Symbol sequence
     * @param {number} sampleRate - Sample rate
     * @returns {Float32Array} - Audio samples
     */
    static generateAudio(sequence, sampleRate) {
        // Calculate total duration
        const symbolCount = sequence.length;
        const mainDuration = symbolCount * this.SYMBOL_DURATION +
                            (symbolCount - 1) * this.CROSSFADE_DURATION;
        const leadDuration = 0.005; // Lead-in/out
        const totalDuration = leadDuration * 2 + mainDuration;

        const totalSamples = Math.ceil(totalDuration * sampleRate);
        const samples = new Float32Array(totalSamples);

        let offset = 0;

        // Lead-in sweep
        offset = this.addSweep(samples, offset, this.NYQUIST,
            this.FREQUENCIES[sequence[0]], leadDuration, sampleRate);

        // Main symbols
        const chars = sequence.split('');
        for (let i = 0; i < chars.length; i++) {
            const freq = this.FREQUENCIES[chars[i]];

            // Main tone
            offset = this.addTone(samples, offset, freq,
                this.SYMBOL_DURATION, sampleRate);

            // Crossfade to next
            if (i < chars.length - 1) {
                const nextFreq = this.FREQUENCIES[chars[i + 1]];
                offset = this.addSweep(samples, offset, freq, nextFreq,
                    this.CROSSFADE_DURATION, sampleRate);
            }
        }

        // Lead-out sweep
        const lastFreq = this.FREQUENCIES[chars[chars.length - 1]];
        offset = this.addSweep(samples, offset, lastFreq, this.NYQUIST,
            leadDuration, sampleRate);

        return samples.subarray(0, offset);
    }

    /**
     * Add a pure tone to the sample buffer
     * @param {Float32Array} samples - Sample buffer
     * @param {number} offset - Start offset
     * @param {number} frequency - Tone frequency
     * @param {number} duration - Duration in seconds
     * @param {number} sampleRate - Sample rate
     * @returns {number} - New offset
     */
    static addTone(samples, offset, frequency, duration, sampleRate) {
        const numSamples = Math.floor(duration * sampleRate);
        const fadeLength = 100; // Fade samples

        for (let i = 0; i < numSamples; i++) {
            const time = i / sampleRate;
            const phase = 2 * Math.PI * time * frequency;
            let amplitude = 1.0;

            // Fade in
            if (i < fadeLength) {
                amplitude = i / fadeLength;
            }
            // Fade out
            if (i >= numSamples - fadeLength) {
                amplitude = (numSamples - i) / fadeLength;
            }

            samples[offset + i] = Math.sin(phase) * amplitude;
        }

        return offset + numSamples;
    }

    /**
     * Add a frequency sweep to the sample buffer
     * @param {Float32Array} samples - Sample buffer
     * @param {number} offset - Start offset
     * @param {number} startFreq - Starting frequency
     * @param {number} endFreq - Ending frequency
     * @param {number} duration - Duration in seconds
     * @param {number} sampleRate - Sample rate
     * @returns {number} - New offset
     */
    static addSweep(samples, offset, startFreq, endFreq, duration, sampleRate) {
        const numSamples = Math.floor(duration * sampleRate);
        const fadeLength = Math.min(50, Math.floor(numSamples / 4));

        for (let i = 0; i < numSamples; i++) {
            const t = i / numSamples;
            const frequency = startFreq + t * (endFreq - startFreq);
            const time = i / sampleRate;
            const phase = 2 * Math.PI * time * frequency;
            let amplitude = 1.0;

            // Fade in
            if (i < fadeLength) {
                amplitude = i / fadeLength;
            }
            // Fade out
            if (i >= numSamples - fadeLength) {
                amplitude = (numSamples - i) / fadeLength;
            }

            samples[offset + i] = Math.sin(phase) * amplitude;
        }

        return offset + numSamples;
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
     * Play encoded string through Web Audio
     * @param {string} text - String to encode and play
     * @param {AudioContext} audioContext - Web Audio context
     * @returns {AudioBufferSourceNode} - Playing source node
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
        const samples = this.encode(text, this.SAMPLE_RATE);
        return this.samplesToWav(samples, this.SAMPLE_RATE);
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
     * @param {DataView} view - DataView
     * @param {number} offset - Offset
     * @param {string} str - String
     */
    static writeString(view, offset, str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    /**
     * Download encoded audio as WAV file
     * @param {string} text - String to encode
     * @param {string} filename - Output filename
     */
    static downloadWav(text, filename = 'encoded-audio.wav') {
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
     * Get encoding statistics for debugging
     * @param {string} text - String to analyze
     * @returns {object} - Statistics
     */
    static getStats(text) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);
        const packet = this.buildPacket(bytes);
        const symbols = this.bytesToQuaternary(packet);
        const interleaved = this.interleaveWithCarrier(symbols);
        const fullSequence = this.SYNC_PATTERN + interleaved;

        const symbolCount = fullSequence.length;
        const duration = symbolCount * this.SYMBOL_DURATION +
                        (symbolCount - 1) * this.CROSSFADE_DURATION +
                        0.01; // Lead in/out

        return {
            inputLength: text.length,
            byteLength: bytes.length,
            packetLength: packet.length,
            symbolCount: fullSequence.length,
            dataSymbols: symbols.length,
            carrierSymbols: fullSequence.length - symbols.length,
            durationMs: Math.round(duration * 1000),
            frequencies: this.FREQUENCIES,
            symbolDurationMs: this.SYMBOL_DURATION * 1000,
            crc16: this.crc16(packet.subarray(0, 2 + bytes.length)).toString(16).padStart(4, '0'),
        };
    }
}

export default StringAudioEncoder;
