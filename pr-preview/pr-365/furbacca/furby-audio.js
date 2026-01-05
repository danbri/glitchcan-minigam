/**
 * Furby Audio Generator
 *
 * Generates audio control signals for Furby toys using Web Audio API.
 * Port of the Perl Furby::Audio module.
 *
 * The audio signal uses frequency-shift keying (FSK) with 5 frequencies:
 * - '0': 16386 Hz
 * - '1': 16943 Hz
 * - 'X': 17500 Hz (base/carrier frequency, delta ~557 Hz)
 * - '3': 18057 Hz
 * - '2': 18614 Hz
 */

import { FurbyPacket } from './furby-packet.js';

export class FurbyAudio {
    // Frequency mapping for each symbol
    static BASE_FREQ = {
        '0': 16386,
        '1': 16943,
        'X': 17500, // Base frequency, used to construct raw commands
        '3': 18057,
        '2': 18614,
    };

    // Audio parameters - matching Perl exactly
    static BITS_SAMPLE = 16;
    static SAMPLE_RATE = 44100;
    static TOP_FREQ = 44100 / 2; // Nyquist frequency (22050 Hz)

    // PI as defined in Perl: (22 / 7) * 2
    // This is slightly different from Math.PI * 2
    static PI = (22 / 7) * 2;

    // Timing parameters (in seconds) - matching Perl exactly
    static BASE_FREQ_LENGTH = 0.016;          // 16ms - duration of each frequency tone
    static XFADE_LENGTH = 0.004;              // 4ms - crossfade between frequencies
    static LEAD_SILENCE_GAP_LENGTH = 0.005;   // 5ms - silence at start/end
    static LEAD_LENGTH = 0.005;               // 5ms - lead-in/lead-out tone
    static SILENCE_GAP_LENGTH = 0.5 - 0.005 * 2; // ~490ms - gap between packet repeats

    // Volume fade parameters (in samples)
    static XFADE_VOLUME_SAMPLES = 220;
    static LEAD_XFADE_VOLUME_SAMPLES = Math.floor(44100 * 0.005); // entire length

    /**
     * Get base frequency for a symbol
     * @param {string} char - Symbol ('0', '1', '2', '3', or 'X')
     * @returns {number} - Frequency in Hz
     */
    static baseFreq(char) {
        if (!(char in this.BASE_FREQ)) {
            throw new Error(`Unknown frequency symbol: '${char}'`);
        }
        return this.BASE_FREQ[char];
    }

    /**
     * Generate audio buffer for a Furby command
     * @param {number|string} command - Command byte or name
     * @param {AudioContext} audioContext - Web Audio context
     * @returns {AudioBuffer} - Generated audio buffer
     */
    static generateAudio(command, audioContext) {
        const sampleRate = audioContext.sampleRate || this.SAMPLE_RATE;

        // Get packet data
        const data = FurbyPacket.make(command);
        const [str1, str2] = data.split(' ');

        // Calculate total duration
        const packetDuration = this.calculatePacketDuration(str1, sampleRate);
        const totalDuration =
            this.LEAD_SILENCE_GAP_LENGTH +
            packetDuration +
            this.SILENCE_GAP_LENGTH +
            packetDuration +
            this.LEAD_SILENCE_GAP_LENGTH;

        // Create buffer
        const totalSamples = Math.ceil(totalDuration * sampleRate);
        const buffer = audioContext.createBuffer(1, totalSamples, sampleRate);
        const channelData = buffer.getChannelData(0);

        // Build the audio
        let offset = 0;
        offset = this.addSilence(channelData, offset, this.LEAD_SILENCE_GAP_LENGTH, sampleRate);
        offset = this.addPacket(channelData, offset, str1, sampleRate);
        offset = this.addSilence(channelData, offset, this.SILENCE_GAP_LENGTH, sampleRate);
        offset = this.addPacket(channelData, offset, str2, sampleRate);
        offset = this.addSilence(channelData, offset, this.LEAD_SILENCE_GAP_LENGTH, sampleRate);

        return buffer;
    }

    /**
     * Calculate duration of a single packet
     * @param {string} str - Packet string
     * @param {number} sampleRate - Sample rate
     * @returns {number} - Duration in seconds
     */
    static calculatePacketDuration(str, sampleRate) {
        // Remove non-digit characters
        const cleaned = str.replace(/[^0123]/g, '');
        // Interleaved format: X0X1X2X3X... (n digits + n+1 X's)
        const numDigits = cleaned.length;
        const numX = numDigits + 1;
        const totalSymbols = numDigits + numX;

        // Each symbol has base_freq_length, plus crossfades between them
        // Plus lead-in and lead-out
        const duration =
            this.LEAD_LENGTH + // Lead-in
            totalSymbols * this.BASE_FREQ_LENGTH + // Main tones
            (totalSymbols - 1) * this.XFADE_LENGTH + // Crossfades
            this.LEAD_LENGTH; // Lead-out

        return duration;
    }

    /**
     * Add a packet to the audio buffer
     * @param {Float32Array} channelData - Audio buffer channel
     * @param {number} offset - Starting sample offset
     * @param {string} str - Packet string
     * @param {number} sampleRate - Sample rate
     * @returns {number} - New offset after adding packet
     */
    static addPacket(channelData, offset, str, sampleRate) {
        // Remove non-digit characters (matching Perl: $str =~ s/[^0123]//g;)
        const cleaned = str.replace(/[^0123]/g, '');

        // Interleave all digits with base frequency:
        // 0123 => X0X1X2X3X
        // Matching Perl: my @a = ('', split(//, $str), ''); join('X', @a)
        const chars = ['', ...cleaned.split(''), ''];
        const rawPacket = chars.join('X');

        return this.addRawPacket(channelData, offset, rawPacket, sampleRate);
    }

    /**
     * Add a raw packet (already interleaved) to the audio buffer
     * Matches Perl add_raw_packet exactly
     * @param {Float32Array} channelData - Audio buffer channel
     * @param {number} offset - Starting sample offset
     * @param {string} str - Raw packet string (e.g., "X0X1X2X3X")
     * @param {number} sampleRate - Sample rate
     * @returns {number} - New offset after adding packet
     */
    static addRawPacket(channelData, offset, str, sampleRate) {
        const chars = str.split('');
        const maxIdx = chars.length - 1;

        // Lead-in: sweep from top_freq to first symbol frequency
        offset = this.addSine(
            channelData, offset,
            this.TOP_FREQ, this.baseFreq(chars[0]),
            this.LEAD_LENGTH,
            this.LEAD_XFADE_VOLUME_SAMPLES, this.XFADE_VOLUME_SAMPLES,
            sampleRate
        );

        // Main packet: tones with crossfades
        for (let i = 0; i <= maxIdx; i++) {
            // Add main tone (hz1 == hz2, so no sweep)
            offset = this.addSine(
                channelData, offset,
                this.baseFreq(chars[i]), this.baseFreq(chars[i]),
                this.BASE_FREQ_LENGTH,
                this.XFADE_VOLUME_SAMPLES, this.XFADE_VOLUME_SAMPLES,
                sampleRate
            );

            // Add crossfade to next tone (if not last)
            if (i < maxIdx) {
                offset = this.addSine(
                    channelData, offset,
                    this.baseFreq(chars[i]), this.baseFreq(chars[i + 1]),
                    this.XFADE_LENGTH,
                    this.XFADE_VOLUME_SAMPLES, this.XFADE_VOLUME_SAMPLES,
                    sampleRate
                );
            }
        }

        // Lead-out: sweep from last symbol frequency to top_freq
        // NOTE: Perl uses same fade order for lead-in and lead-out
        offset = this.addSine(
            channelData, offset,
            this.baseFreq(chars[maxIdx]), this.TOP_FREQ,
            this.LEAD_LENGTH,
            this.LEAD_XFADE_VOLUME_SAMPLES, this.XFADE_VOLUME_SAMPLES,
            sampleRate
        );

        return offset;
    }

    /**
     * Add a sine wave with frequency sweep and volume fades
     * Matches Perl add_sine exactly, including "FFT magic"
     * @param {Float32Array} channelData - Audio buffer channel
     * @param {number} offset - Starting sample offset
     * @param {number} hz1 - Starting frequency (Hz)
     * @param {number} hz2 - Ending frequency (Hz)
     * @param {number} length - Duration (seconds)
     * @param {number} fadeinSamples - Fade-in duration (samples)
     * @param {number} fadeoutSamples - Fade-out duration (samples)
     * @param {number} sampleRate - Sample rate
     * @param {number} volume - Base volume (0-1)
     * @returns {number} - New offset after adding sine
     */
    static addSine(channelData, offset, hz1, hz2, length, fadeinSamples, fadeoutSamples, sampleRate, volume = 1) {
        // "FFT magic" from Perl: average the frequencies
        // $hz2 = ($hz1 + $hz2) / 2;
        hz2 = (hz1 + hz2) / 2;

        const lengthSamples = Math.floor(length * sampleRate);

        for (let pos = 0; pos < lengthSamples; pos++) {
            const time = pos / sampleRate;

            // Linear frequency sweep from hz1 to (averaged) hz2
            const hz = (pos / (lengthSamples - 1 || 1)) * (hz2 - hz1) + hz1;

            // Phase calculation matching Perl exactly:
            // $phase = $PI * $time * $hz;
            // where $PI = (22 / 7) * 2
            const phase = this.PI * time * hz;

            // Calculate current volume with fades
            let curVol = volume;

            // Fade in
            if (fadeinSamples > 0 && pos < fadeinSamples) {
                curVol = (pos / (fadeinSamples + 1)) * curVol;
            }

            // Fade out
            if (fadeoutSamples > 0 && (lengthSamples - 1 - pos) < fadeoutSamples) {
                curVol = ((lengthSamples - 1 - pos) / (fadeoutSamples + 1)) * curVol;
            }

            // Write sample
            channelData[offset + pos] = Math.sin(phase) * curVol;
        }

        return offset + lengthSamples;
    }

    /**
     * Add silence to the audio buffer
     * @param {Float32Array} channelData - Audio buffer channel
     * @param {number} offset - Starting sample offset
     * @param {number} length - Duration (seconds)
     * @param {number} sampleRate - Sample rate
     * @returns {number} - New offset after adding silence
     */
    static addSilence(channelData, offset, length, sampleRate) {
        const lengthSamples = Math.floor(length * sampleRate);

        for (let pos = 0; pos < lengthSamples; pos++) {
            channelData[offset + pos] = 0;
        }

        return offset + lengthSamples;
    }

    /**
     * Play a Furby command
     * @param {number|string} command - Command byte or name
     * @param {AudioContext} audioContext - Web Audio context
     * @returns {Promise<AudioBufferSourceNode>} - The playing source node
     */
    static async play(command, audioContext) {
        const buffer = this.generateAudio(command, audioContext);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
        return source;
    }

    /**
     * Generate a WAV file blob from a command
     * @param {number|string} command - Command byte or name
     * @returns {Blob} - WAV file blob
     */
    static generateWav(command) {
        // Create offline context for rendering
        const sampleRate = this.SAMPLE_RATE;

        // Get packet data to calculate duration
        const data = FurbyPacket.make(command);
        const [str1] = data.split(' ');
        const packetDuration = this.calculatePacketDuration(str1, sampleRate);
        const totalDuration =
            this.LEAD_SILENCE_GAP_LENGTH +
            packetDuration +
            this.SILENCE_GAP_LENGTH +
            packetDuration +
            this.LEAD_SILENCE_GAP_LENGTH;

        // Create buffer directly
        const totalSamples = Math.ceil(totalDuration * sampleRate);
        const channelData = new Float32Array(totalSamples);

        // Build the audio
        let offset = 0;
        offset = this.addSilence(channelData, offset, this.LEAD_SILENCE_GAP_LENGTH, sampleRate);
        offset = this.addPacket(channelData, offset, data.split(' ')[0], sampleRate);
        offset = this.addSilence(channelData, offset, this.SILENCE_GAP_LENGTH, sampleRate);
        offset = this.addPacket(channelData, offset, data.split(' ')[1], sampleRate);
        offset = this.addSilence(channelData, offset, this.LEAD_SILENCE_GAP_LENGTH, sampleRate);

        // Convert to WAV
        return this.float32ToWav(channelData, sampleRate);
    }

    /**
     * Convert Float32Array to WAV blob
     * @param {Float32Array} samples - Audio samples (-1 to 1)
     * @param {number} sampleRate - Sample rate
     * @returns {Blob} - WAV file blob
     */
    static float32ToWav(samples, sampleRate) {
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

        // Write WAV header
        let offset = 0;

        // "RIFF" chunk descriptor
        this.writeString(view, offset, 'RIFF'); offset += 4;
        view.setUint32(offset, totalSize - 8, true); offset += 4;
        this.writeString(view, offset, 'WAVE'); offset += 4;

        // "fmt " sub-chunk
        this.writeString(view, offset, 'fmt '); offset += 4;
        view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size (16 for PCM)
        view.setUint16(offset, 1, true); offset += 2; // AudioFormat (1 = PCM)
        view.setUint16(offset, numChannels, true); offset += 2;
        view.setUint32(offset, sampleRate, true); offset += 4;
        view.setUint32(offset, byteRate, true); offset += 4;
        view.setUint16(offset, blockAlign, true); offset += 2;
        view.setUint16(offset, bitsPerSample, true); offset += 2;

        // "data" sub-chunk
        this.writeString(view, offset, 'data'); offset += 4;
        view.setUint32(offset, dataSize, true); offset += 4;

        // Write audio samples
        const maxVal = Math.pow(2, bitsPerSample - 1) - 1;
        for (let i = 0; i < samples.length; i++) {
            // Clamp and convert to 16-bit signed integer
            const sample = Math.max(-1, Math.min(1, samples[i]));
            const intSample = Math.floor(sample * maxVal);
            view.setInt16(offset, intSample, true);
            offset += 2;
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    /**
     * Write a string to a DataView
     * @param {DataView} view - DataView to write to
     * @param {number} offset - Byte offset
     * @param {string} str - String to write
     */
    static writeString(view, offset, str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    /**
     * Download a WAV file for a command
     * @param {number|string} command - Command byte or name
     * @param {string} filename - Filename for download
     */
    static downloadWav(command, filename = 'furby-command.wav') {
        const blob = this.generateWav(command);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export default FurbyAudio;
