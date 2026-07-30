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

---

## 8. Tags on Their Own Line Attach FORWARD — Even Through a Divert

A bare tag line before a divert does not annotate "this moment"; it
attaches to the **next text line**, wherever that is:

```ink
Something sings below.

# MINIGAME: robbin      ← attaches to the first line of tube_return!
-> tube_return
```

The engine breaks on the tag *after* the destination knot's first line
has already been evaluated — so any `{var: ...}` conditional there ran
BEFORE the minigame did anything.

### Fix: inline the tag, and put reactions behind a choice

```ink
Something sings below. # MINIGAME: robbin mode=hampstead
-> tube_return

=== tube_return ===
The lift hauls you back up.
+ [Out into the rain]
    { robbin_birds > 0: The flock rides below. - else: Unfinished song. }
    -> street
```

Choice output is evaluated when the choice is *taken* — after the
minigame completed and wrote its variables. (Found and E2E-locked
2026-07, `inklet/finkapp/test/e2e-robbin.mjs`.)

## 9. Sandboxed Guests Have No localStorage

A `# MINIGAME:` iframe runs with an opaque origin: touching
`window.localStorage` **throws**, killing ES modules at import time.
Guest games must shim it (see the head of `magpie/robbin/robbin.html`).
Same for module/asset fetches: they need CORS (fine on GitHub Pages,
needs a CORS-enabled server locally).

---

## 10. A tag binds to the line that FOLLOWS it

**`# TAG:` attaches to the NEXT piece of content, not the previous one.**
Verified by dumping `story.currentTags` after each `Continue()`.

This matters because the engine BREAKS the beat on `# MINIGAME:` and
`# FINK:` — and the break happens *after* the line those tags landed on
has already been shown.

```ink
// WRONG — the tag rides the POST-game line
You climb into the rig.
# MINIGAME: waterworld
-> surfacing

=== surfacing ===
You surface with {diamonds} diamonds.     // shown BEFORE the game runs,
                                          // with the pre-game value
```

```ink
// RIGHT — tag first, lead-in second, after-content behind a divert
# MINIGAME: waterworld
You climb into the rig.
-> surfacing

=== surfacing ===
You surface with {diamonds} diamonds.     // shown on resume, with the
                                          // value the game produced
```

The symptoms are quiet and look like engine bugs:

- **`# MINIGAME:`** — the "after the game" beat prints with the values
  from *before* it, and the game appears over text that has already moved
  on. (`mudslidemines.fink.js` has always had this right; it is the
  convention to copy.)
- **`# FINK:` + `# LINKREL: goDeeper`** — the beat emits the line you
  meant to show *after* surfacing, and the state saved for the way back
  is already past it. Coming back up, the reader gets an empty beat.
- **`# IMAGE:` / `# VIDEO:`** — media attaches to the next beat, so a
  picture appears one beat late.

Rule of thumb: **write the tag directly above the line it decorates.**
