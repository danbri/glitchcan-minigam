# Eclipse Watch

A viewer guide to the **12 August 2026** solar eclipse, written for young
children, built mobile-first. Default place is London; the user can pick a
different one, and every figure in the app changes with it.

    magpie/eclipse/index.html

## What it is

From London this is a deep partial eclipse in the evening. The Moon covers
**91 per cent** of the Sun at **19:13 BST**, with the Sun only about 10
degrees above the horizon — low, in the west, behind most rooftops. The total
part of the shadow crosses Greenland, Iceland and northern Spain.

The app has five screens on a thumb-reachable tab bar:

| screen | what it does |
|---|---|
| **Now** | live sky drawing, coverage per cent, countdown, and a scrubber that plays the whole eclipse in 22 seconds |
| **Look** | which way to face, in words and on a compass dial that uses the device sensors when they work |
| **Safe** | the one rule, how to check eclipse glasses, and a draggable pinhole-projector demo |
| **Why** | animated Sun–Moon–Earth diagram, and the 400-times coincidence |
| **Spot** | a checklist of things to notice, none of which need looking up |

## The numbers are computed, not typed in

All astronomy comes from **Astronomy Engine** (MIT, `vendor/`, no CDN) — the
same class of open ephemeris that photographic planning apps are built on.

* Contact times and peak obscuration: `SearchLocalSolarEclipse()`.
* The drawing: apparent radii of both discs, and the Moon's offset from the
  Sun's centre in a frame with the zenith up, recomputed every frame.

So the picture on screen is the real geometry at that instant, and a scrubbed
preview is a real prediction rather than an artist's loop. Checked against the
library: the discs touch within 0.00002° of its own contact times, and the
peak coverage agrees to 0.1 per cent.

There is one clock. Every screen reads `viewTime()`, so no two screens can
disagree about what the sky is doing.

## Safety is structural

An eclipse guide for children that is casual about eye safety is a hazard, so:

* A gate carries the one rule before the app opens.
* Red is used for the safety colour and for nothing else.
* The Sun is drawn as a flat cartoon disc that could not be mistaken for a
  photograph, so nothing here teaches that a real Sun is safe to look at.
* Every teaching picture — pinhole, colander, tree dapple — points the child
  at the **ground**, not the sky.
* The read-aloud button is on the safety text, because the youngest user in
  the group cannot read it.
* There is no camera view. Pointing a phone at the Sun invites a child to
  look along the phone, and it damages sensors.

## Web platform features

Every one is feature-detected and optional. The guide works without all of
them.

Geolocation · Device Orientation (with the iOS permission tap) · Speech
Synthesis · Web Audio chimes · Vibration · Screen Wake Lock · Canvas 2D ·
Service Worker · Web App Manifest · `prefers-reduced-motion` · Page
Visibility (the loop stops in the background).

Offline matters here for a real reason: families watch from parks and hills
where the signal is poor. Everything is a static file plus a calculation that
runs on the device, so the service worker can make the whole guide work with
no network.

## Test

    npm install --no-save playwright        # once
    node magpie/eclipse/test/e2e.mjs        # add --shots to write screenshots

25 checks at 390×844: the gate, the tab journey, every canvas actually drawing
pixels, the scrubber, the place switcher, and no console errors. The page's
times are compared against an **independent** run of the same library in Node,
not against hard-coded strings — so the test still passes if the place
changes, and fails if the app's own maths drifts.

That test earned its keep on the first run: it caught `Horizon(..., 'none')`,
which Astronomy Engine rejects. The correct way to ask for no refraction is a
falsy option. The contact times were right anyway, so a code read would have
missed it — the app was throwing on every frame while showing correct times.

## Files

    index.html            markup and all of the child-facing words
    eclipse.css           mobile-first, 48px targets, dark for dusk
    js/eclipse-calc.js    all astronomy; the only file that talks to the library
    js/eclipse-sky.js     the sky picture and the plain disc pair
    js/eclipse-compass.js sensors and the direction dial
    js/eclipse-explain.js why-diagram, pinhole, tree dapple
    js/eclipse-senses.js  speech, chime, haptics, wake lock
    js/eclipse-app.js     screens, the one clock, storage, milestones
    sw.js                 offline shell
    vendor/               Astronomy Engine 2.1.19 (MIT) + NOTICE
    test/e2e.mjs          headless checks
