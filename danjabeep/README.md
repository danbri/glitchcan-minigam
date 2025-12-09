# DanjaBeep - WebBeep JavaScript Port

JavaScript/Web Audio port of [WebBeep](https://github.com/danja/WebBeep) by Danny Ayers.

Encodes strings (identifiers, URIs, short messages) into audible audio using pentatonic dual-tone FSK.

## Key Features

- **Pentatonic Scale Encoding**: Uses musical notes (C, D, E, G, A) in audible range (~260-1760 Hz)
- **Dual-Tone**: Each byte encoded as two simultaneous frequencies (low + high)
- **Goertzel Detection**: Efficient single-frequency pitch detection for decoding
- **Checksum**: Simple error detection
- **Web Audio API**: Works in modern browsers

## Protocol

Each ASCII byte is split into two 4-bit nibbles:
- **High nibble (0-15)** → Low frequency (262-440 Hz, modulo 8)
- **Low nibble (0-15)** → High frequency (523-1760 Hz)

| Low Frequencies | High Frequencies |
|----------------|------------------|
| C4: 262 Hz | C5: 523 Hz |
| D4: 294 Hz | D5: 587 Hz |
| E4: 330 Hz | E5: 659 Hz |
| G4: 392 Hz | G5: 784 Hz |
| A4: 440 Hz | A5: 880 Hz |
| | C6: 1047 Hz |
| | ... up to A6: 1760 Hz |

## Usage

### Browser

```html
<script type="module">
import { Encoder } from './encoder.js';

const ctx = new AudioContext();
Encoder.play('Hello World', ctx);

// Download as WAV
Encoder.downloadWav('https://example.com', 'encoded.wav');
</script>
```

### Node.js (for testing)

```javascript
import { Encoder } from './encoder.js';

const samples = Encoder.encode('test');
console.log(`Generated ${samples.length} samples`);
```

## Files

| File | Description |
|------|-------------|
| `constants.js` | Audio configuration (sample rate, timing, etc.) |
| `maps.js` | Pentatonic frequency mappings |
| `wavemaker.js` | Audio sample generation |
| `goertzel.js` | Goertzel pitch detection algorithm |
| `encoder.js` | Main encoder class |
| `decoder.js` | Decoder with microphone support |
| `index.html` | Interactive UI |
| `test.mjs` | Node.js unit tests (32 tests) |
| `test-browser.spec.mjs` | Playwright browser tests |

## Running Tests

```bash
# Node.js tests
node test.mjs

# Browser tests (requires Playwright)
npm install
npx playwright install chromium
npx playwright test
```

## Original

Ported from [WebBeep](https://github.com/danja/WebBeep) Java implementation.

## License

MIT
