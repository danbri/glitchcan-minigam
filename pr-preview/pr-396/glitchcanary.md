
# Glitch Canary

Glitch Canary is the name of a game-like-thing that is also a sort of platform for making game-like-things.

## Themes

The idea has gone through several mutations but common themes are:

 * to make something where stories can be told through lightweight web games
 * users as players can also contribute
 * something of the minecraft spirit but with more visual and other diversity
 * something of the classic textual (and graphical) adventure games
 * something of lambdamoo
 * using and exploring the new AI without being tedious slop
 * the impossibility of having a story and a decent game structure while also being pluralistic openended extensible etc.

 In its current iteration the idea is for a platform which hosts a primary entry point, login and state storage facilities, and some core bits of a game that kind of hangs together. But for it also to be freely extensible, not just places/objects/challenges and stories but for different kinds of game to be plugging together into a larger whole.

 It was tempting to reimplement a lot of LambdaMOO, whose OO world graph + scripts model is immensely powerful. We may use Knowledge Graph abstractions for some core state storage / sharing / query. Lambdamoo is freeform in that with the right permissions a player can type "dig north to atlantis, 'a rainy island in a scary sea; sunken.'" and it will add an exit labelled "north" to the current location and wire it up to a new location with that identifier and blurb. This is more freeform than a fixed map or grid, but still fundamentally grounds things in ''place'' rather than story or gameplay.

 What we currently try is a little different. Using the Ink language from Inkle studies, we can try a narrative-first data format which looks like markdown but also feels like a wierd cousin of voicexml or xslt. Ink lets your quickly write out a text file with situations ("knots") and choices with labels and blurbs, and control their flow, introducing computeryness cautiously and as needed. Inkle have shipped some 
 great games that use this (buy them!) and one compelling aspect is that Ink works well when paired with a second game engine, e.g. in their case a default of Unity but now also [Unreal](https://github.com/The-Chinese-Room/Inkpot). 

 Ink's main opensource codebase is in C# but there is also a Javascript implementation. Historically this has lagged the C# but the gap seems narrow or gone now. The JS module "ink-full" also now includes an Ink compiler, allowing Javascript apps to compile Ink text content down into JSON, closer to the form interpreted by the Ink game engine(s). The Ink language is very text centric but it allows chunks of Ink to be annotated with "tags" that can carry arbitrary additional information, such as media URLs for imagery, video, or sound.

 The plan is to build on the JS ink-full capability and be very runtime dynamic with loading Ink. We have proof of concepts that use a Javascript-wrapped variant on Ink syntax we call Fink (for "FOAFy Ink"). Fink files are very readable (unlike JSON) but can be loaded relatively freely from diverse websites so long as they are served as Javascript files. 
 
 We expect to build up some additional lightweight conventions expressed with Ink tags (ideally in line with other uses of the language) and also to use the language support for integrating with external game engines.
 Instead of picking a single highly capable engine, we hope to plug in a large number of relatively ad-hoc web based game fragments, and to explore ways of telling a story across the web using different "mini games" (hence [glitchcan-minigam](https://danbri.github.io/glitchcan-minigam/)) and playing with the dual game engines idea ("gamgam"), especially in the light of modern AI which makes it possible to create code,  and media content, and to create variations on those corresponding to different branches in a game or story.

AI is not mandatory for fInk authoring but opens up possibilities; and experimenting here gives a mostly harmless venue for people to explore what this overhyped and yet extraordinary technology really amounts to.

## FINK Technical Architecture

**FINK = "FOAFy Ink"** - JavaScript-wrapped INK content for dynamic web loading.

### File Structure
FINK files (.fink.js) are executable JavaScript containing template literals:
```javascript
oooOO`
-> main_menu

=== main_menu ===
# IMAGE: peaceful_sunset.png
Welcome to the story!

+ [Start] -> beginning
`
```

### Execution Model
1. **Sandbox iframe**: Creates isolated execution environment with `oooOO` function
2. **Script injection**: .fink.js file loaded via `<script>` tag in sandbox
3. **Template literal capture**: `oooOO` function captures INK content from template literal
4. **Content extraction**: Pure INK content sent back to main page for compilation
5. **INK compilation**: Real ink-full.js compiler processes the extracted content

### Key Points
- **NOT text parsing**: Content extracted via JavaScript execution, not regex
- **Template literals**: `oooOO` is a JavaScript tagged template function
- **Legitimate tags**: `# IMAGE:`, `# FINK:`, `# BASEHREF:` are proper INK extensions
- **Security**: Sandbox isolation prevents cross-origin issues
- **Dynamic loading**: Stories can reference and load other FINK stories at runtime

This approach allows readable INK syntax while enabling web-native dynamic loading.

## Code and prototypes

The code is messy, often hacked up on phone by blabbing at Claude.ai, Gemini or ChatGPT. You'll see a few arcade/retro minigame prototypes. The most important is probably gamgam, which tries to integrate the ink-full game engine and compiler with other stuff. Right now you can find examples where Fink files contain videos, images, ... no sounds yet. There are examples in which an Ink story is directly embedded in a webapp "player" including [Hampstead](https://danbri.github.io/glitchcan-minigam/inklet/hampstead1.fink.js) (a social climbing adventure), and some test files with bits of [Hobbit](https://danbri.github.io/glitchcan-minigam/inklet/bagend1.fink.js) and [jungle adventure](https://danbri.github.io/glitchcan-minigam/inklet/jungle2.fink.js) situations flung together sloppily.

The best gamgam demo is probably [gamgam-wc](https://danbri.github.io/glitchcan-minigam/inklet/gamgam-wc.html) which is a mix inspired by boulderdash, sabre wulf, jet set willy and others of that era. In practice the map was not designed with any care, you basically collect diamonds and 4 keys, and there's an underexplored piece of state in which a river is blocked using logs. It can be completed by finding a portal and collecting all the stuff. Very rough but it is enough to give some state that can in theory be passed back and forth between (f)Ink and different embedded arcade/retro minigames. 

There's also a simpler [gamgam](https://danbri.github.io/glitchcan-minigam/inklet/gamgam.html) version and various [Fink test files](https://danbri.github.io/glitchcan-minigam/inklet/finktest1.html) showing the progression of ideas. 

For interactive fiction with imagery, there's also the [Riverbend mystery](https://danbri.github.io/glitchcan-minigam/inklet/inklet2.html) which demonstrates how Ink stories can be enhanced with illustrations.

**IMPORTANT**: For a working example of proper INK engine integration (not manual parsing), see [hamfinkdemo.html](https://danbri.github.io/glitchcan-minigam/inklet/hamfinkdemo.html) which correctly uses `inkjs.Compiler()` and handles conditional syntax like `{variable: text}` properly.

Beyond the Ink experiments, there are also standalone retro game prototypes including [Spectro](https://danbri.github.io/glitchcan-minigam/spectro/), a more developed ZX Spectrum-inspired platformer with proper collision detection and multiple rooms. 

There is an example in which a remote Fink URL mentioned in the game code is fetched at runtime and the two Ink files are compiled together. We do not yet have any discipline, rules, best practices etc for doing this. One obvious idea is to distinguish between Ink scenes that are intended to work together and which endorse each other with reciprocal links/mentions, vs those that are independent or one-sided. This roughly echoes ideas like fanfic vs canon, multiverse MCU and so on.

In terms of content and tone we'll probably say "don't be a creep, don't break laws, don't be tacky, do as you would be done by" or whatever. For core game we'll ask that people don't mention certain things, names, topics that are reserved for a central story arc, as it would be good to tie things together at least slightly. But nothing stops you using the Inkle opensource tooling to do whatever you like.

## UI

The Ink abstraction is that your engine will mediate between spooling out lines of textual content and interacting with user to present choices, determine their selection, and continue along the way based on a fairly simple choice. We might complicate things a bit with music, sounds, images, video, and generating larger worlds via AI. We're starting with an attempt to generally have 3 options presented for each decision (a crass simplification of a Jon-from-Inkle conference talk). The idea that the UI can be *almost* like doomscrolling except you've 3 options at the foot of the page, swiping from left middle or right, is horribly appealing. There's a CSS mockup somewhere.

## Issues

Notes here please, Claude especially.