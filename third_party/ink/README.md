# ink.js - JavaScript port of inkle's ink scripting language

## Source
- **Package**: inkjs v2.2.3
- **CDN**: https://cdn.jsdelivr.net/npm/inkjs@2.2.3/dist/
- **NPM**: https://www.npmjs.com/package/inkjs
- **GitHub**: https://github.com/y-lohse/inkjs

## Files
- `ink-full.js` - Full unminified build with compiler + runtime
- `ink-full.min.js` - Minified production build

## License
MIT License

Copyright (c) 2017 Yannick Lohse

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Original ink
ink itself is created by inkle (https://www.inklestudios.com/) and is also MIT licensed.
https://github.com/inkle/ink

## Usage
```html
<script src="third_party/ink/ink-full.min.js"></script>
<script>
  const story = new inkjs.Story(compiledJsonString);
  // or compile from source:
  const compiled = new inkjs.Compiler(inkSource).Compile();
  const story = new inkjs.Story(compiled);
</script>
```

## Downloaded
2026-01-15
