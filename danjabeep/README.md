# DanjaBeep - Audio String Encoder/Decoder

Encode short strings (identifiers, URIs, short messages) into ultrasonic audio using FSK (Frequency-Shift Keying). Works in browsers using Web Audio API.

## Features

- Encodes arbitrary UTF-8 strings up to 255 bytes
- Uses ultrasonic frequencies (16-19 kHz) for minimal audibility
- CRC-16 checksum for data integrity
- Real-time microphone decoding
- WAV file export
- Debug visualization tools

## Quick Start

### Browser

```html
<script type="module">
import { StringAudioEncoder } from './string-audio-encoder.js';

// Encode and play a string
const audioContext = new AudioContext();
StringAudioEncoder.play('Hello World', audioContext);

// Download as WAV
StringAudioEncoder.downloadWav('https://example.com', 'encoded-url.wav');

// Get encoding statistics
const stats = StringAudioEncoder.getStats('test');
console.log(stats.durationMs); // Duration in milliseconds
</script>
```

### Node.js (for testing)

```javascript
import { StringAudioEncoder } from './string-audio-encoder.js';

// Encode to raw samples
const samples = StringAudioEncoder.encode('test');
console.log(`Generated ${samples.length} samples`);

// Get statistics
const stats = StringAudioEncoder.getStats('Hello');
console.log(stats);
```

## Protocol

| Frequency | Symbol | Description |
|-----------|--------|-------------|
| 16,386 Hz | 0 | Quaternary digit 0 |
| 16,943 Hz | 1 | Quaternary digit 1 |
| 17,500 Hz | X | Carrier/sync |
| 18,057 Hz | 3 | Quaternary digit 3 |
| 18,614 Hz | 2 | Quaternary digit 2 |

### Packet Structure

```
[MAGIC: 0xAE][LENGTH][DATA...][CRC-16]
```

- Magic header: 0xAE (validates packet start)
- Length: 1 byte (0-255)
- Data: UTF-8 encoded string
- CRC-16: CCITT checksum

### Symbol Encoding

- Each byte encoded as 4 quaternary (base-4) digits
- Symbols interleaved with 'X' carrier: `X0X1X2X3X`
- 16ms per symbol, 4ms crossfade
- Sync preamble: `XXXX`

## Running Tests

### Node.js Tests

```bash
cd danjabeep
node test-encoder.mjs
```

### Browser Tests (Playwright)

```bash
npm install
npx playwright install chromium
npx playwright test
```

## Files

| File | Description |
|------|-------------|
| `string-audio-encoder.js` | Main encoder module |
| `string-audio-decoder.js` | Decoder with microphone support |
| `index.html` | Interactive UI with send/receive |
| `test-encoder.mjs` | Node.js unit tests |
| `test-browser.spec.mjs` | Playwright browser tests |
| `test-browser.html` | Browser test page |

## UI Features

1. **Send Tab**: Encode text, play audio, download WAV
2. **Receive Tab**: Listen via microphone, decode messages
3. **Debug Tab**: Test tones, packet inspection, loopback test

## Based On

Protocol adapted from [Furbacca/Hacksby](https://github.com/iafan/Hacksby) Furby audio control system.

## License

MIT
