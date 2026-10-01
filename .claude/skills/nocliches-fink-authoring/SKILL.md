---
name: nocliches-fink-authoring
description: Write and review the PROSE of .fink.js stories (and their choice labels) against a ban list of clichéd constructions, stock phrases and AI-default vocabulary — "BANNED: The Definitive Guide", a style guide the owner adopted in October 2026 — adapted to interactive fiction in this repo. Use this when writing or revising story text, choice labels, captions or spoken lines in any .fink.js file, when reviewing story content for generic or AI-sounding prose, or when asked to score a story's writing. It covers what to look for (constructions, words and phrases, accumulation), how to fix it, the interactive-fiction additions (choices, tags, second person, world-only text), the scoring method, and a word scanner (scan.mjs). NOT for story structure, tags or compilation (that is the fink and glitchcanary skills).
---

# No-clichés authoring for .fink.js stories

Source: "BANNED: THE DEFINITIVE GUIDE", a personal style guide shared as a Google Doc:
https://docs.google.com/document/d/1uC9tBgfNZJytzLpg6MGk5mTfgJNbEK-h1hMLncQ5Mho/edit
(read with `curl -sSL "https://docs.google.com/document/d/1uC9tBgfNZJytzLpg6MGk5mTfgJNbEK-h1hMLncQ5Mho/export?format=txt"`).
Its author says it is a personal catalogue, not a universal rule: "Use what applies. Ignore what doesn't." The owner
adopted it for this project in October 2026. This skill summarises Parts 1 to 3 of it and adapts them to
interactive fiction here. Part 4 (rules for explicit content) does not apply to this project and is not used.
Read the source when a rule below is unclear; the numbers (1.1, 2.33 ...) are its section numbers.

## Project rules that come first

These project rules decide before the guide does (CLAUDE.md, the drift-city and glitchcanary skills):
- **Do not invent player-facing prose.** Names, jobs, captions and new story lines come from the owner, or the
  field stays empty. A rewrite that this guide asks for is a PROPOSAL to the owner, not an edit you make on your own.
- **Data ethics.** No memorial, dedication or personal content from real datasets, whatever the prose needs.
- **A choice that only moves the camera onto a person reads as watching her** (owner, September 2026: "Look at her
  from the side" was "creepy"). Name what the reader does or feels.
- Story text the owner wrote stands as the owner's voice. Score it like everything else, but say so in the report.

## The root problem (guide, 3.1)

Every banned element substitutes form for content: rhythm that sounds literary but carries no meaning, gestures
that look like emotion but specify nothing, metaphors that feel poetic but clarify nothing. They are
interchangeable (they could appear in any story), they tell instead of showing, and they default to the familiar.

**Accumulation is the test, not single hits** (guide, 3.1). One "jaw tightens" can be right. The same default
across characters and scenes is the problem. When you find a banned element, ask: how many times in this file? For
several characters the same way? First use, or fifth?

## Part 1: constructions (patterns, not words)

| id | pattern | ask instead |
|---|---|---|
| 1.1 | "X, then Y" between two actions | does the order show psychology, or only choreography? |
| 1.2 | "Something [verbs] in/behind [body part]" | what exactly happens? what would an observer see? |
| 1.3 | silence as an actor ("the silence stretches") | who breaks it, who endures it, what does it cost? |
| 1.4 | "Not X, but Y" | name what it is |
| 1.5 | three nouns or fragments for effect ("The wine. The laughter. The silence.") | building tension, or performing it? |
| 1.6 | "[Verb]. [Verb]. [Verb]." | vary the syntax |
| 1.7 | sentences starting "And"/"But" for rhythm (overuse) | only for earned emphasis |
| 1.8 | standalone "Because ..." fragments | show the cause through action |
| 1.9 | "a laugh that isn't quite a laugh" | what is the gesture actually doing? |
| 1.10 | echo lines: two mirrored sentences, the second adds nothing | develop, contradict or cut |
| 1.11 | an action at once negated ("tea he didn't want") | why does the character do it? |
| 1.12 | narration about story mechanics ("the scene", "the moment", "the next beat") | re-enter through action |
| 1.13 | opening on weather, skyline or architecture before any person | start with a character doing something |
| 1.14 | attraction as physics (pulled, drawn, orbit, gravity, magnetic) | make it a choice |
| 1.15 | "hangs in the air / between them" | show the aftermath |
| 1.16 | impact similes (punch to the gut, freight train) | the actual sensation |
| 1.17 | ripple and stillness similes | show the impact directly |
| 1.18 | precision words (surgical, practised ease, calculated, methodical) | the specific movement |
| 1.19 | texture defaults (velvet, silk, steel, iron, granite, marble) | a different texture, or the sensation |
| 1.20 | desire with no object ("he wanted her") | wanted what, for what? |
| 1.21 | communication claimed, not shown ("a look that said everything") | show the exchange |
| 1.22 | restraint with nothing named ("held it together") | what is held, how, and what breaks? |
| 1.23 | damage as decoration (drink he didn't need, no sleep) | show what it costs |
| 1.24 | poster aphorisms ("We are all just stories in the end.") | would THIS character think it now? |
| 1.25 | epic tone for small moments ("changed everything") | scale down |
| 1.26 | elegant variation (rotating descriptors for one person) | use the name unless the descriptor does work |
| 1.27 | false range ("from heartbreak to revolution") | is there a real scale? |
| 1.28 | participle that interprets ("..., highlighting her frustration") | delete; the action carries itself |
| 1.29 | "not only ... but", "it's not about X, it's about Y" | state it directly |
| 1.30 | "with the [noun] of someone [verb]ing" | describe the actual behaviour |
| 1.31 | trailing participles, three or more sentences in a row | vary the structure |

## Part 2: words and phrases (short form; the source has the full lists)

- 2.1 **Physical tells** used as emotion: jaw tightens, throat works, breath catches, released a breath, eyes
  darken, gaze hardens, knuckles whiten, goes very still, heart stutters, chest tightens.
- 2.2 **Vague interiority**: something shifts, the weight of X settles, a wave of X, the air thickens, the room
  feels smaller.
- 2.3 **Intensity defaults**: raw, visceral, primal, bone-deep, paper-thin, frayed edges.
- 2.4 **Beat placeholders**: for a long moment, for a beat, after a moment, a pause, then, finally (as transition).
- 2.5 **Dialogue tag adverbs** (softly, quietly, flatly ...) and voice descriptors (voice drops, barely above a
  whisper, falsely casual).
- 2.6 **Gaze words**: assessing, appraising, guarded, shuttered, unreadable, seeing too much.
- 2.7-2.9 **Precision, competence and texture** words: effortless, seamless, fluid, quiet competence, coiled
  energy; velvet, silk, steel, iron.
- 2.10 **Temperature as emotion**: cold voice, blood ran cold, warmth spread, heat pooled.
  (On Titan, cold is literal. Literal cold is not this rule; "her voice was cold" is.)
- 2.11-2.13 **Impact, ripple and breaking** phrases: hit like a blow, rippled through, something cracked open,
  fault lines.
- 2.14-2.15 **Anchor and edge** metaphors: anchored, tethered, grounded, rooted; on the edge of, hanging by a thread.
  (Literal tethers, such as the Warmhouse's, are not this rule.)
- 2.16-2.17 **Silence and time**: deafening silence, the quiet pressed in, time stretched, the world held its breath.
- 2.18-2.19 **Permission and realisation**: allowed himself to, it clicked into place, understanding dawned.
- 2.20-2.24 **Threat, presence, intimacy, possession, repression** stock phrases: lethal grace, commanded the room,
  closed the distance, got under her skin, tamped down, white-knuckled control.
- 2.25 **Transition verbs** used alone: shifted, settled, flickered, softened, hardened, eased.
- 2.26 **Stock banter**: "You're impossible." "You're trouble." "You love it."
- 2.27 **Cinematic wallpaper**: light spills/pools, shadows play across, the skyline stretches, neon glow,
  the city hummed. (Drift City is a neon city on Titan. Neon as a THING in the scene is fine; neon as wallpaper
  before any person acts is this rule.)
- 2.28-2.29 **Description and domestic filler**: orbs, porcelain skin, broad shoulders; tea and coffee as filler.
- 2.30 **Religious exclamations**: Oh God, Jesus, Christ.
- 2.31 **Ending clichés**: "And for now, that was enough." "It was a start." "Everything had changed."
- 2.32 **Pseudo-analysis**: cut through the noise, the architecture of X, the geometry of X, the calculus of X.
- 2.33 **AI vocabulary**: tapestry, landscape (figurative), interplay, nuanced, delve, foster, underscore, showcase,
  pivotal, crucial, vibrant, profound, palpable, seemingly, ultimately ...
- 2.34 **Narrator as analyst**: [action], highlighting / underscoring / reflecting / symbolising [meaning].
- 2.35-2.36 **Puffery and brochure** language: a testament to, enduring legacy, plays a vital role; nestled, in the
  heart of, boasts, stunning, breathtaking, bustling, picturesque.
- 2.37 **Familiarity words** with nothing named: familiar, usual, routine, ritual, rhythm.
- 2.38 **Time-skip fillers**: passed in a blur, before she knew it, the days blended together.

## Part 3: how to apply it

- **Corrective questions** (3.2): for a tell, how does THIS character show it? For vague interiority, what would an
  observer see? For a metaphor, does it clarify or decorate? For a tag, can the line carry its own tone? For a
  transition, what happens during the pause? For an ending, what changes?
- **Final tests** (3.7), used for scoring below: Specificity (could the line appear unchanged in another story?),
  Interchangeability (could the tell belong to any character?), Consequence (does something change?), Decoration
  (does the detail clarify or only ornament?), Earned (built to, or announced?).
- **When rules conflict** (3.8): specificity beats brevity; a character may use a banned term in DIALOGUE if they
  would really say it (flag it); narration has no such excuse; clarity beats rhythm; precision beats convention.

## Additions for interactive fiction in this repo

These are this project's, not the guide's; each comes from a decision or a defect recorded in the repo.
- **F1. Choice labels name what the reader does or feels**, in their own words, not a camera move and not a menu
  item ("Look at her from the side" was creepy; "Take a minute to think" replaced it). A label that is only
  navigation ("Look at the stage") is acceptable in a fixture and weak in a story.
- **F2. A beat is short.** A knot's first line is often all a reader sees before choosing; front-loading weather
  (1.13) costs more here than on a page.
- **F3. Second person present** is the house mode for player prose. "You" doing a stock tell (your jaw tightens)
  is still 2.1.
- **F4. Repeated text across visits** (a `{cellar == 1: ... - else: ...}` revisit line, a `{~a|b|c}` shuffle) counts
  once for accumulation, but a shuffle of four stock lines is four defaults.
- **F5. World-only text** (hotspot labels, prop captions, `# speech:` lines) is prose too and gets the same check;
  it must also have a text route (story-game-sync skill).
- **F6. Fixtures are not stories.** Platform test fixtures (inklet/apps/storyrunner/*.fink.js,
  inklet/validation/tests/*, the dream and annex demos) exist to test mechanisms. Score them, but report them
  separately and do not count them in the project score.

## Scoring method (used for the October 2026 review)

1. **Scan** for words: `node .claude/skills/nocliches-fink-authoring/scan.mjs [files...]` (default: every tracked
   .fink.js). It reads each file with the real capture code (packages/backticks `extractBlocks`), then searches each
   ink line for the Part 1 and Part 2 trigger words, the way grep would. It does not interpret ink structure (NO
   HACKPARSING, CLAUDE.md): it prints file:line, the rule id and the line, and per file the hits per 100 prose
   lines. A hit is a place to look, not a verdict: "cold" on Titan, "neon" in Neon Row and a literal tether are not
   faults.
2. **Read every prose line yourself** (the scanner misses constructions: echo lines, front-loading, false range,
   elegant variation, choice labels). Record each fault as `file:line  rule  quoted text  why`.
3. **Score each file 1 to 5 on the five final tests** (Specificity, Interchangeability, Consequence, Decoration,
   Earned), 5 = no problem found, and give the density (faults per 100 prose lines). The file grade is the
   mean of the five, minus 0.5 for each full 5 faults per 100 lines above 5 (accumulation), floored at 1.
4. **Report** fixtures separately (F6), name owner-written text as the owner's, and propose fixes; do not apply them.
