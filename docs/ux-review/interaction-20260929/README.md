# How the game offers the reader something to do (September 2026)

Owner's request: "Study all the ways user interaction opportunities are
presented in the game, across app, world, ink and finkos/foafos surfaces."

Method:
- Four code surveys, one per layer, with file:line references:
  - the foafos shell (level 0)
  - the story runner and the ink content (level 1)
  - the Drift city world
  - the stage apps (minigame guests) and the guest SDK
- Phone screenshots at 390×844, taken headless on SwiftShader WebGL.
- I checked the six strongest claims against the code by hand. All six are
  correct. Every other claim comes from the code surveys. Some claims may
  need a check before anyone acts on them.

Screenshots:
- `phone-story-and-game.png`, from left to right:
  1. The TOC in the runner.
  2. Gem Hunt, full.
  3. Split.
  4. Picture-in-picture.
- `phone-world.png`: Per Aspera with the city beside it, then the city's
  ☰ menu open.

## 1. What a reader sees, layer by layer

### Story runner (the reading surface)
- **Choices are the only story control.** Each choice is a native button, and
  every choice looks the same. You cannot tell a plain choice, a link to another
  story, a dream (goDeeper), a peer, a merge, or a game launch apart. A
  once-only choice looks the same as a sticky one.
- **Games and links start with no warning.** A `# MINIGAME:` or `# FINK:` tag
  acts when the beat reaches it. The reader is not asked. The only cue is the
  small grey `#status` line ("playing gems…", "loading…").
- **The other buttons the runner shows:**
  - "↺ Start again", at the outermost END only.
  - "Show the world again", after the world is closed.
  - The `Subtree` details panel.
- **Tapping media:** an accent image switches to a large image when you tap
  it. This is a plain div: no role, and no keyboard path.
- **The keyboard:** there are no keyboard shortcuts. You Tab to a choice.
  After a choice, focus goes to the new text. After a game, a link, a dream, a
  restart or a peer, focus does not move.
- **Sound:** if the browser blocks audio, the audio waits for a pointer or a
  touch. A key press does not unlock it.

### Ink content (how authors word the choices)
- The corpus has 26 stories and about 1020 choices.
- **Words for the same meaning vary.** For example:
  - To go back: "Back to…", "Return to…", "Leave → street", "[Back]".
  - To go on: "Continue", "Next".
  - To enter: "enter X" and "Enter X", in different letter case.
- **A game launch is rarely named as a game.** The TOC says "Play X" (good).
  In most other places the choice is diegetic (Hampstead "Down into Hampstead
  tube", Skydock "Clock on", chess "Study the position deeply") and the game
  takes the screen at once.
- **The same label does different things:**
  - "Go into the Cold Tap and ask Mags" and "Go down to the Lantern Cellar"
    start a stage app in the Drift hub.
  - In Per Aspera, the same two labels are ordinary story moves.
- **Drift's stories give every hotspot a text route**, `[Look around]`,
  because `in_world` stays false in the runner.

### Drift city as a world
- **On-screen UI in the city:** the ☰ burger, the status line, clue glints,
  and a long-press card ("Fly there", "Walk there"). The bottom toolbar and the
  climb buttons are hidden by CSS (`head.html:158-159`), so they do nothing.
- **Many city controls still act on the story's state:**
  - Places in the city
  - Travel
  - the map
  - the tours
  - Return to opening
  - Time and weather
  - the long press

  They move the camera away from the story's `# place:`, and they write
  `here`, `hour` and `snowing` back to the story. Nothing brings the camera back
  until the story's next beat. A clue glint follows whatever view is shown, not
  only the story's scene.
- **Hints are silent to screen readers.** `#hint` has no live region, and
  "You notice X." is one of these hints.

### Stage apps (minigames)
- **Start:** most apps start by themselves. Skydock ("TAP TO START") and
  Canary Wharf ("TAKE FLIGHT") wait for a tap. The shell's own "▶ Play"
  splash is used only by inline widgets.
- **End:** when an app sends `complete`, the shell removes the app frame at
  once. So the reader never sees the result screens of chess, Mudslider,
  Waterworld, Boidwars or Canary Wharf, or their Replay / Back buttons.
- **Pause:** five apps show their own PAUSED screen under the shell's frost,
  so the reader sees two pause screens. Skydock ignores pause. GridLuck's pause
  did not reach the game (fixed 30 September 2026: the wrapper forwards it,
  e2e-input checks the board holds still).
- **Quit:** Robbin is the only app that can own the ✕ (the `quit` verb). The
  guest SDK cannot declare verbs (see section 3, item 1).
- **Accessibility:** support is uneven.
  - guest-a11y announcements: GridLuck, Boidwars, Mudslider, Waterworld.
    Chess uses it but announces almost nothing.
  - Own live region only: Robbin, Drift.
  - Nothing: Skydock, Canary Wharf, the talking head.
  - Chess has no keyboard path.

### foafos shell
- **Main controls:**
  - the ⊞ dock and its drawer: sound, skin, apps, windows, widgets
  - the Apps grid (Alt+H)
  - the Task Manager (Alt+Tab)
  - window bars: ⧉ – ▢ ✕
  - the window-manager toolbar: ▣ ◫ ◰ ⏸ ✕
  - the split grip with ⇅ Swap
  - the on-screen pad or sticks
  - the "Tap for sound" chip
  - the breadcrumb
  - Back and Forward
- **Many controls hide themselves, or can only be found by hover or by keys:**
  - the WM toolbar collapses after 4.5 s
  - Swap hides 3 s after release
  - the pane labels show for 2.6 s
  - a second ✕ within 10 s force-closes, and nothing says so
  - a tap on the frost resumes, and nothing says so
  - the keyboard shortcuts are shown only in tooltips

## 2. Problems across layers

| Topic | What differs | Where |
|---|---|---|
| Menus | Two menus on one screen: the shell ⊞ (bottom-right) and the city ☰ (top-left) | shell, world |
| One glyph, two meanings | ⊞ is both the dock and "Apps". ⧉ is both "Task Manager" and "Show all windows" | shell |
| Close | "Exit minigame", "Close X", "Close: X", "Close shell" (which only hides the drawer), chess "Back", Mudslider "Return to WRLD" (does nothing), Drift "Back to the story" | shell, apps |
| Pause | WM ⏸ (a toggle; the icon becomes ▶ but the name stays "Pause game"), Task Manager pause (three states), the app's own PAUSED, the frost, the city's tour pause | all |
| Full screen | WM "Full screen" (not the browser's full screen), window "Maximize", Waterworld's own ⛶ (the sandbox does not allow full screen) | shell, apps |
| B on the pad | Named "Back", but sends Escape. Robbin quits, Waterworld closes a panel, the other apps ignore it | shell, apps |
| "tour" | The city's Guided flight and its Grand tour both say "Carry on … tour" | world |
| Time and route names | Menu: Day / Dusk / Night. Presets: "Amber day / Saturnshine". The HTML: "Golden hour" | world |
| Stacked layers | The collapsed WM button covers story text (`phone-world.png`). The shell sticks cover rows of the city menu (`phone-world.png`, right). The dock moves up 200 px while the pad shows | shell over world |

## 3. Defects I checked in the code (clear, small)

1. **The guest SDK cannot declare verbs.**
   - The SDK sends `ready` with
     `capabilities: ['pause','resume','debug-clock']`
     (`packages/finkgame/src/minigame-sdk.js:69`).
   - The shell reads `data.capabilities?.verbs`
     (`inklet/finkapp/fink-minigames.js:1189`).
   - So only Robbin (hand-written `ready`) owns ✕. The SDK also ignores an
     incoming `quit`.
2. **The shell's game keys go to the game from shell controls too.**
   - `FoafInput` listens on `window` and skips only INPUT, TEXTAREA and SELECT
     (`packages/foafos/src/input.mjs:96-100`).
   - So while a game runs:
     - Escape that closes a shell dialog also sends B.
     - Arrows in the Task Manager or on the split grip also steer the game.
     - Space on a shell button also sends A.
3. **The keyboard cannot reopen the WM toolbar.** The `#wm-handle` grip listens
   only to pointer events (`inklet/finkapp/fink-wm.js:466-503`). After the 4.5 s
   collapse, Enter and Space do nothing.
4. **Two city actions use the `t` key.**
   - `drift-city/src/main.js:1798` (time of day) returns first, so line 1802
     (story) never runs.
   - Also, `.bar` and `.climb` are `display:none !important`
     (`drift-city/src/head.html:158-159`), so the Story button and ▲▼ are not
     shown.
5. **TOC episode links act before their description.**
   - `# FINK:` is the first tag of each `*_selected` knot (for example
     `inklet/toc.fink.js:81`).
   - So the blurb, the cover image and the "[enter X]" choice are never shown.
     The knot `external_story` is dead.
6. **GridLuck never reported a result** (fixed 30 September 2026: the game sends its score and end by message; e2e-input). Its wrapper reads
   `gameFrame.contentDocument` (`inklet/minigames/gridluck/index.html:90`),
   which the opaque sandbox blocks. The only way out is ✕.

The surveys found more defects (not checked by hand).

Drift feel mode:
- A slide in feel mode can choose "Go on" as an ink choice (`feel.js:140`).

Shell:
- The Widgets ✕ in the drawer removes the window but leaves its app node
  running.
- The Home buttons have `role="listitem"`, which removes their button role.
- The compact breadcrumb says "Show full tree" but collapses.
- A late controls answer can show the old pad on top of the new one
  (`fink-minigames.js:1362`).
- Alt+H and Alt+M fail on macOS, because they check `e.key`.
- An app launch that the root refuses shows nothing on screen.

Ink content:
- "Play again" in Lamplighter and Per Aspera does not replay in the runner:
  `# restart` is not a runner tag.
- diamond-cave promises "Mini-Chess (new tab)" but prints an inert link.

## 4. Correction to my last report

I wrote that the city's Story button and its `t` key opened the city's own
ink in world mode. That was wrong:
- The Story button is never shown (defect 4).
- The `t` key changes the time of day.

The real path was "Return to opening". Its flight ended in `taleOpen()`.
The fix (`taleOpen` returns in world mode) is correct and covers all paths.
The e2e-drift check 20b calls `taleOpen` directly, so it tests the fix.

## 5. Decisions for the owner

These are choices, not defects:
1. **Should a choice show what it does?**
   - For example: a small mark for "opens a game", "goes to another story",
     "a dream".
   - Or: the runner asks "Play Gem Hunt now? / Not now" before it gives the
     screen to a game.
   - At this time only the words of the choice can say it.
2. **One place for "leave this".** Should ✕, B, Escape and the app's own
   Back all mean the same thing, and should the shell own it?
3. **Result screens.** Should the shell keep an app on screen after
   `complete` until the reader taps "Back to the story", so that the end
   screen and Replay can be used? Or should the apps stop drawing them in
   the shell?
4. **Who controls the camera in world mode.** Should Places, Travel, the map
   and the tours leave the story's scene while a story is open, or should
   they return to the story's `# place:` when they end?
5. **One menu.** Should the city's ☰ go into the shell (an app menu
   in the window bar), so that the reader has one menu per screen?
