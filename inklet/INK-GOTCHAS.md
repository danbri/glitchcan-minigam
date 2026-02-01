# INK Gotchas for FINK Authors

Common pitfalls when writing INK content. Applies to humans and AI alike.

---

## 1. Double Slash `//` = Comment

**Everything after `//` on a line is discarded.**

```ink
// This whole line is a comment

# FINK: https://example.com/story.fink.js
            ↑↑
            GONE! Only "https:" survives
```

### Fix: Escape with backslash

```ink
# FINK: https:\/\/example.com\/story.fink.js
```

The `\/` becomes `/` after compilation. Use for all URLs in tags.

---

## 2. Square Brackets `[]` = Choice Syntax

**`[text]` in prose is parsed as choice markup, not literal brackets.**

```ink
The format is [Name]-[Version]    ← COMPILE ERROR
```

### Fix: Avoid brackets in prose, or restructure

```ink
The format is: Name-Version       ← OK
The format is (Name)-(Version)    ← OK
```

Or use them only in actual choices:

```ink
+ [Pick this option] -> somewhere   ← OK
```

---

## 3. Curly Braces `{}` = Logic

**`{text}` is conditional/sequence logic, not literal braces.**

```ink
Call the function {doThing}       ← Interpreted as variable
```

### Fix: Escape or rephrase

```ink
Call the function called doThing  ← Rephrase
```

---

## 4. Asterisk `*` at Line Start = Once-Only Choice

```ink
* This looks like a bullet point  ← It's a choice!
```

### Fix: Don't start lines with `*` unless it's a choice

```ink
- This is a bullet point          ← Use dash instead
• This works too                  ← Unicode bullet
```

---

## 5. Hash `#` at Line Start = Tag

```ink
# This is a tag, not a heading
```

### Fix: Tags are intentional; for prose headings, use bold

```ink
**Chapter One**                   ← Markdown bold, not a tag
```

---

## Quick Reference

| Character | Meaning in INK | Escape/Alternative |
|-----------|----------------|-------------------|
| `//` | Comment start | `\/\/` |
| `[text]` | Choice text | Avoid or restructure |
| `{text}` | Logic/variable | Rephrase |
| `*` at start | Once-only choice | Use `-` or `•` |
| `+` at start | Sticky choice | (intentional) |
| `#` at start | Tag | (intentional) |
| `->` | Divert | (intentional) |
| `~` at start | Logic line | (intentional) |

---

## Testing Your INK

Before publishing, compile-test your content:

```bash
node inklet/debug-awakening.mjs  # Modify path as needed
```

Errors will show line numbers. Fix and re-test.

---

*This guide: `inklet/INK-GOTCHAS.md`*
