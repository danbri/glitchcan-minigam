# FinkNet

Secure JSONP-like loader for tagged template literal content.

## What is this?

FinkNet is a content loading pattern similar to JSONP, but using JavaScript tagged template literals instead of callback functions.

### JSONP (Traditional)

```javascript
// server responds with: callback({"data": "hello"})
function callback(data) { console.log(data); }
const script = document.createElement('script');
script.src = 'https://example.com/api?callback=callback';
document.body.appendChild(script);
```

### FinkNet (Template Literals)

```javascript
// content.fink.js contains: oooOO`Hello, this is the content`
const content = await FinkNet.load('./content.fink.js');
console.log(content); // "Hello, this is the content"
```

## Why?

FinkNet was designed for loading interactive fiction content (INK stories), but the core mechanism is completely generic. Benefits:

1. **Secure** - Content executes in a sandboxed iframe with no same-origin access
2. **Simple authoring** - Content files are just JavaScript with template literals
3. **Multiline-friendly** - Template literals handle multiline content naturally
4. **Raw strings** - Uses `strings.raw` to preserve backslashes and escapes
5. **Browser-native** - No build step required, works with `<script>` tags

## Installation

```bash
npm install finknet
```

Or include directly:

```html
<script type="module">
import { FinkNet } from './finknet/index.js';
</script>
```

## Usage

### Loading content

```javascript
import { FinkNet } from 'finknet';

// Load a single file
const content = await FinkNet.load('./my-content.fink.js');

// Load multiple files in parallel
const [a, b, c] = await FinkNet.loadAll([
    './chapter1.fink.js',
    './chapter2.fink.js',
    './chapter3.fink.js'
]);
```

### Creating content files

Content files use a tagged template literal:

```javascript
// my-story.fink.js
oooOO`
This is the story content.
It can span multiple lines.
Special characters like $ and \ are preserved.

You can include any text here - JSON, Markdown, INK syntax, etc.
`
```

Or use the helper:

```javascript
const fileContent = FinkNet.createFile('My content here');
// Returns: oooOO`My content here`
```

### Configuration

```javascript
await FinkNet.load('./content.js', {
    timeout: 15000,        // Execution timeout (default: 10000ms)
    tagFunction: 'myTag',  // Custom function name (default: 'oooOO')
});
```

## How it works

1. **Fetch** - Parent page fetches the .fink.js file content (has same-origin access)
2. **Sandbox** - Creates hidden iframe with `sandbox="allow-scripts"` (no same-origin)
3. **Inject** - Sends script content to sandbox via `postMessage`
4. **Execute** - Sandbox runs `new Function(content)()` with `oooOO` defined
5. **Capture** - `oooOO` tagged template collects content into array
6. **Return** - Sandbox sends collected content back via `postMessage`

```
┌─────────────────┐     postMessage      ┌─────────────────┐
│   Parent Page   │ ◄──────────────────► │  Sandboxed      │
│                 │                      │  iframe         │
│  1. fetch()     │  → script content    │                 │
│  2. create      │                      │  3. oooOO``     │
│     iframe      │  ← extracted data    │  4. collect     │
│  5. resolve     │                      │                 │
└─────────────────┘                      └─────────────────┘
```

## Security

- The sandbox iframe has **only** `allow-scripts` - no `allow-same-origin`
- Script content cannot access parent page DOM, cookies, or localStorage
- Content is fetched by parent (which has credentials) but executed in isolation
- Similar security model to Web Workers, but with DOM access in the sandbox

## Use cases

- **Interactive fiction** - Load INK stories (the original use case)
- **Configuration** - Load config that needs preprocessing
- **Templates** - Load template content without build tools
- **User content** - Safely execute user-provided content files

## Name

"FinkNet" comes from FINK (Finkleverse INK), an interactive fiction format. The "net" part refers to the network loading pattern, similar to how JSONP is "JSON with Padding."

## License

MIT
