#!/usr/bin/env node
/**
 * Audio Frequency Analyzer
 *
 * Analyzes generated Furby audio to verify the frequencies are correct.
 * Uses zero-crossing detection to estimate frequency content.
 */

import { FurbyAudio } from './furby-audio.js';
import { FurbyPacket } from './furby-packet.js';
import fs from 'fs';

console.log('=== Furby Audio Frequency Analyzer ===\n');

// Generate audio samples for a command
const command = 867;
const sampleRate = 44100;

console.log(`Generating audio for command ${command}...`);
const data = FurbyPacket.make(command);
console.log(`Packet data: ${data}\n`);

// Generate samples directly (without AudioContext)
const [str1, str2] = data.split(' ');
const cleaned1 = str1.replace(/[^0123]/g, '');
const chars1 = ['', ...cleaned1.split(''), ''];
const rawPacket1 = chars1.join('X');
console.log(`Raw packet 1: ${rawPacket1}`);
console.log(`Packet 1 symbols: ${rawPacket1.length}\n`);

// Calculate expected packet duration
const packetDuration = FurbyAudio.calculatePacketDuration(str1, sampleRate);
console.log(`Expected packet duration: ${(packetDuration * 1000).toFixed(1)}ms\n`);

// Generate a simple test tone at each frequency
console.log('--- Testing Individual Frequencies ---');
const testFreqs = ['0', '1', 'X', '3', '2'];

testFreqs.forEach(symbol => {
    const freq = FurbyAudio.baseFreq(symbol);

    // Generate 1000 samples of this frequency
    const samples = new Float32Array(1000);
    const PI = (22 / 7) * 2;

    for (let i = 0; i < 1000; i++) {
        const time = i / sampleRate;
        const phase = PI * time * freq;
        samples[i] = Math.sin(phase);
    }

    // Count zero crossings to estimate frequency
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
        if (samples[i-1] < 0 && samples[i] >= 0) {
            crossings++;
        }
    }

    // Estimated frequency = crossings per second / 2 (each cycle has 2 crossings)
    // But we only count positive crossings, so multiply by 2
    const duration = (samples.length - 1) / sampleRate;
    const estimatedFreq = crossings / duration;

    console.log(`Symbol '${symbol}': target=${freq} Hz, measured≈${estimatedFreq.toFixed(0)} Hz (${crossings} crossings in ${(duration * 1000).toFixed(1)}ms)`);
});

// Now analyze a small segment of the actual packet
console.log('\n--- Analyzing Packet Segment ---');

// Generate full packet
const totalDuration =
    FurbyAudio.LEAD_SILENCE_GAP_LENGTH +
    packetDuration +
    FurbyAudio.SILENCE_GAP_LENGTH +
    packetDuration +
    FurbyAudio.LEAD_SILENCE_GAP_LENGTH;

const totalSamples = Math.ceil(totalDuration * sampleRate);
const channelData = new Float32Array(totalSamples);

let offset = 0;
offset = FurbyAudio.addSilence(channelData, offset, FurbyAudio.LEAD_SILENCE_GAP_LENGTH, sampleRate);
offset = FurbyAudio.addPacket(channelData, offset, str1, sampleRate);

// Analyze samples after lead-in and initial silence
const skipSamples = Math.floor(FurbyAudio.LEAD_SILENCE_GAP_LENGTH * sampleRate) +
                    Math.floor(FurbyAudio.LEAD_LENGTH * sampleRate);

// Analyze the first main tone (should be 'X' at 17500 Hz)
const analyzeStart = skipSamples;
const analyzeEnd = analyzeStart + Math.floor(FurbyAudio.BASE_FREQ_LENGTH * sampleRate);

let crossings = 0;
for (let i = analyzeStart + 1; i < analyzeEnd; i++) {
    if (channelData[i-1] < 0 && channelData[i] >= 0) {
        crossings++;
    }
}

const segmentDuration = (analyzeEnd - analyzeStart) / sampleRate;
const estimatedFreq = crossings / segmentDuration;
console.log(`First tone (should be X/17500Hz): measured≈${estimatedFreq.toFixed(0)} Hz (${crossings} crossings in ${(segmentDuration * 1000).toFixed(1)}ms)`);

// Check sample values at specific points
console.log('\n--- Sample Value Verification ---');
console.log('First 10 non-zero samples after silence:');
for (let i = Math.floor(FurbyAudio.LEAD_SILENCE_GAP_LENGTH * sampleRate); i < Math.floor(FurbyAudio.LEAD_SILENCE_GAP_LENGTH * sampleRate) + 10; i++) {
    console.log(`  Sample ${i}: ${channelData[i].toFixed(6)}`);
}

// Check max/min values
let minVal = Infinity, maxVal = -Infinity;
for (let i = 0; i < channelData.length; i++) {
    if (channelData[i] < minVal) minVal = channelData[i];
    if (channelData[i] > maxVal) maxVal = channelData[i];
}
console.log(`\nSample range: [${minVal.toFixed(4)}, ${maxVal.toFixed(4)}]`);

// Verify the WAV generation
console.log('\n--- WAV Generation Verification ---');
const blob = FurbyAudio.generateWav(command);
console.log(`WAV blob size: ${blob.size} bytes`);

// Calculate expected size
const expectedSamples = Math.ceil(totalDuration * sampleRate);
const expectedSize = 44 + expectedSamples * 2; // 44 byte header + 16-bit samples
console.log(`Expected size: ${expectedSize} bytes (${expectedSamples} samples)`);

// Save WAV for external analysis
const blobBuffer = await blob.arrayBuffer();
fs.writeFileSync('/home/user/glitchcan-minigam/tmp/js_867.wav', Buffer.from(blobBuffer));
console.log('Saved to tmp/js_867.wav');

// Analyze the WAV file header
const wavData = new Uint8Array(blobBuffer);
const view = new DataView(blobBuffer);
console.log('\nWAV Header:');
console.log(`  RIFF: ${String.fromCharCode(...wavData.slice(0, 4))}`);
console.log(`  File size: ${view.getUint32(4, true) + 8}`);
console.log(`  WAVE: ${String.fromCharCode(...wavData.slice(8, 12))}`);
console.log(`  fmt : ${String.fromCharCode(...wavData.slice(12, 16))}`);
console.log(`  Format size: ${view.getUint32(16, true)}`);
console.log(`  Audio format: ${view.getUint16(20, true)} (1=PCM)`);
console.log(`  Channels: ${view.getUint16(22, true)}`);
console.log(`  Sample rate: ${view.getUint32(24, true)}`);
console.log(`  Byte rate: ${view.getUint32(28, true)}`);
console.log(`  Block align: ${view.getUint16(32, true)}`);
console.log(`  Bits/sample: ${view.getUint16(34, true)}`);

// Read first few audio samples from WAV
console.log('\nFirst 10 audio samples from WAV (16-bit):');
for (let i = 0; i < 10; i++) {
    const sample = view.getInt16(44 + i * 2, true);
    console.log(`  Sample ${i}: ${sample} (float equiv: ${(sample / 32767).toFixed(6)})`);
}

console.log('\n=== Analysis Complete ===');
