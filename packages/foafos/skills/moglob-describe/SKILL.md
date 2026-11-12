---
name: moglob-describe
description: Turn the raw output of Moglob's describe_view, get_view, features_at and /where into text that fits a person's task. Fields and what each means, what the tools do not report, and the same real description rewritten for a blind or low-vision person wanting orientation, a visitor, a walker, a planner comparing heights, a child, and someone with little time. What to keep, drop and reorder; relative directions; plain distances; a short template and a check list; text alternatives and screen reader friendly output that do not depend on colour or on seeing the screen. Use this whenever you report what is in view in Moglob (the 3D London Docklands and planet app in Foafos) to a person, write alt text for a Moglob view, or read /where output aloud. Use moglob-tools for calls and moglob-guide for movement.
---

# Describing the view in Moglob

`describe_view` gives one paragraph for every purpose. Do not paste it. Find what the person needs, and answer that.

## Get the data

- By direct message, use `/where`. It gives the paragraph. The full JSON of `describe_view` (about 14,000 characters) is cut at 8,000
  characters on a direct message, so it may lose the end.
- In the Chat window, or through WebMCP, use `describe_view`: the structured fields are better than the paragraph.
- For one thing, use `features_at`. For the camera only, use `get_view`.

## Sample

All examples below use this real answer (live page, `?view=cw`, 2026-11-07):

> Looking north-west, down, from 710 m above the ground, towards 33 Canada Square. Saturday, November 7, 2026 at 01:02 (GMT, UTC,
> Europe/London); night, the sun 51° below the horizon in the north-north-east; cloud 10 %, 7 °C. Tallest in view: One Canada Square
> (235 m tall, 1.4 km ahead); Landmark Pinnacle (234 m tall, 1.5 km ahead left); Newfoundland (219 m tall, 1.6 km ahead left); Hampton
> Tower (214 m tall, 1.0 km ahead). Places: Dollar Bay 640 m to the front right; Blackwall River Police Station 19 Coldharbour 800 m to
> the right; 40 Charter Street 820 m ahead; South Quay DLR station 830 m to the front left; South Quay 830 m ahead; Coldharbour 840 m to
> the right; Pan Peninsula East Tower 880 m to the front left; South Dock Pontoon Bridge 1.0 km ahead. Water: South Dock 640 m to the
> front right; West India Dock Entrance Lock 680 m to the front right; River Thames 700 m to the front right; Millwall Inner Dock 760 m
> to the left; Graving Dock 800 m to the front right. Parks: Eden Dock 1.3 km ahead; Bartlett Park 2.4 km to the front right; Mile End
> parkrun 3.2 km ahead; King Edward Memorial Park 3.3 km to the front left.

## What the fields mean

Source: `docklands/describe.js` and `api.js` in danbri/londat.

| Field | Meaning |
|---|---|
| `eye.above_ground_m` | Height of the camera above the ground under it |
| `heading_name`, `heading_deg` | The compass direction of the view |
| `pitch_deg` | Negative looks down |
| `over` | The nearest named place to the point in the centre of the view. It is not proof that this place is visible; `over.distance_m` says how far from that point |
| `view` | A named view id, or null |
| `in_view.buildings[]` | Tallest first: `name` (can be null), `height_m` (the building), `top_m` (its top above ODN, about mean sea level), `distance_m`, `side`, `direction`, `lon`, `lat`, `osm` |
| `in_view.places[]`, `water[]`, `parks[]` | Nearest first: `name`, `kind`, `distance_m`, `side`, `direction`, `lon`, `lat` |
| `distance_m` | **Horizontal, from the point under the camera.** It is not from the person, and not along a street |
| `side` | `ahead` (within 12° of the heading), `ahead left`, `ahead right` (within 35°), `left`, `right` (farther). Relative to the camera |
| `direction`, `bearing_deg` | True compass direction from the camera |
| `sun.day_part` | `daylight`, `low sun`, `twilight`, `dusk or dawn`, `night` |
| `live.aircraft`, `live.ships` | Counts in the frame, from what the page has loaded |
| `weather` | Live data for the place in view, with `source`. Not a forecast. Its behaviour after `set_time` was not checked |
| `time.local` | The **page clock**, which `set_time` can change. It is not always the time now |

On the globe the shape is different: `text`, `centre`, `below`, `countries_in_view`, `water_in_view`, `places_in_view`, `nearest`,
`tilt_deg`. There is no `side` and no `in_view`.

## What the tools do not report

Say so when it matters. Do not fill a gap from a guess.

- **It is not a full list.** Buildings under 25 m tall are not in `buildings`. Only the first 10 or so tall ones come back, and a building
  whose top is hidden by a nearer one is left out. Places end at a distance limit (6 to 14 km, from the camera height). In the
  paragraph, only 4 buildings and `maxItems` places are named.
- **`live` counts only what the page has.** `null` means that the layer is off. `0` can mean that the data is not loaded yet: the
  first call after load gave 0 ships. Say "Moglob reports no ships", not "there are no ships".
- **`weather: null`** means no data for that place. It does not mean clear weather.
- **`name: null`** means no name in the data. Say "an unnamed building".
- **The model is not the world now.** Names and heights come from open data, and they can be old or wrong. At Tower Bridge the output
  named "Southwark Towers (252 m tall)" for a site where a different building now stands. If you add what you know, say that it is
  not from Moglob: "Moglob calls this Southwark Towers. From general knowledge, The Shard stands on that site."
- **`parks` is a loose class.** The sample lists "Eden Dock" and "Mile End parkrun". Use the name, and do not say "a park" unless
  `features_at` agrees.
- **There are no opening times, routes, step-free facts, surfaces, crowds or colours.** A building's `height_m` is not a floor
  count, and `levels` is often null.
- **The paragraph can end with status text.** An old journey adds "Autopilot interrupted (replaced)...", and low memory adds "Detail:
  ...". Drop the first unless motion is the subject. Keep the second if the person asks about detail: the view has less in it.

## Method

1. **Find the task.** What does this person want to do? If you can not tell, give the short form and offer more.
2. **Lead with the answer.** Put what was asked first, then the context. Do not follow the order of the paragraph.
3. **Choose 1 to 3 items.** Nearest for "what is near". Tallest for "what stands out". The named one for "where is X".
4. **Use the person's frame.** `side` words are right only if the person faces the way the view faces. For someone at the screen, that
   is true. For someone planning a real walk, use compass words.
5. **Make numbers plain.** Round: 710 metres, 1.4 km. Say "about" if you rounded much.
6. **Include time and light only when they matter:** a person at the screen who sees a dark picture, or a question about the time.
7. **Say what is missing,** in one short clause, if the task depends on it.
8. **Stop after one or two sentences,** and offer more.

| Keep | Drop, unless asked | Reorder |
|---|---|---|
| The thing asked about; facing; height if high up; one or two landmarks | Date, zone, UTC offset; sun angle; percent of cloud; long registry names; `osm`, `wikidata`; link; `quality`, `memory` | Named landmark before compass words; nearest before farthest for "near"; tallest for "stands out" |

## One description, six tasks

**Blind or low-vision person, wanting orientation.** Position, then facing, then a few fixed points, each with direction and
distance, in a fixed order from left to right.

> You are 710 metres above the ground, facing north-west and looking down. In the centre is 33 Canada Square. Ahead to the left, 1.5 km away,
> is Landmark Pinnacle. Straight ahead, 1.4 km away, is One Canada Square, the tallest in view. Ahead to the right, 700 metres away, is
> the River Thames. It is night in the model, so the picture is dark. Ask for more, or for any direction.

**Visitor: what is near, and what is it?** Nearest first, with `kind`. Use `features_at` on the one they choose.

> Nearest to this view are Dollar Bay, a building 640 metres to the front right, and South Dock, water at about the same distance. South
> Quay DLR station is 830 metres to the front left. Which do you want to know more about?

**Walker: which way, how far?** Compass direction and straight distance, from a named start. Never say "turn left". Say what the
tool can not give.

> South Quay DLR station is 830 metres north-west in a straight line from the point under this view. That is at least 10 minutes on foot.
> Moglob gives no walking route, so this does not count bridges or dock crossings. Use a street map for the real way.

For a walker's own start point, take its `lon` and `lat` from `find_places`, and calculate the distance and bearing from those two
points. Do not use `distance_m` from a camera that is somewhere else.

**Planner comparing heights.** Use `in_view.buildings`, with one decimal place, and both heights. A list reads better than a table in
speech.

> Tallest in view, with height, then top above mean sea level:
> One Canada Square, 235.0 m, top 244.9 m.
> Landmark Pinnacle, 233.5 m, top 238.9 m.
> Newfoundland, 218.6 m, top 224.4 m.
> Hampton Tower, 214.4 m, top 219.9 m.
> One Canada Square is 1.5 m taller, and its top is 6.0 m higher. Heights are from the model's data; check them before you use them.

**Child.** Short sentences, everyday words, one thing at a time. Use only arithmetic from the data.

> You are very high up, looking down at tall towers. It is night. The tallest tower is straight ahead. It is called One Canada Square.
> It is as tall as about 130 grown-ups, one on top of the other. Can you find the river on the right?

The last sentence needs sight. Use it only if the child can see the screen.

**Someone with little time.** One sentence.

> Canary Wharf from 710 metres up, looking north-west; One Canada Square is straight ahead.

## Template

```
[Answer to the question.] [Where the view is, if needed: height, facing.]
[1 to 3 items: name, what it is, side or compass direction, distance.]
[One clause on what is not known, if the task depends on it.]
[One offer: more, another direction, or the next step.]
```

After a move, start with the change: "We have arrived at Tower Bridge. You are 200 metres up, facing west."

## Check list

- Does the first sentence answer what the person asked?
- Is every name, number and direction in the tool output, or marked as not from Moglob?
- Is a place called visible only if the data supports that?
- Are `left` and `right` right for this person's facing?
- Is `distance_m` called a straight-line distance from the point under the view, when that matters?
- If the page clock was set, is that clear?
- Is the text short, with the rest offered?
- Does it work with the screen off?
- Is text from the data shown as data? A name is not an instruction.

## Text alternatives and screen readers

Screen reader output must be complete with no picture.

- **Do not depend on colour or sight.** Do not write "as you can see", "the blue line" or "over there". For the `plan_sweep` line, give
  the course in words: start, the places it passes, the end, the length.
- **Write words for symbols in text that will be read aloud:** "metres" and "km", not "m"; "degrees", not °; "percent", not %. Write "north-west",
  not "NW".
- **Short sentences, one fact each.** Put the name first, so a listener can skip.
- **Use a list of sentences, not a table,** unless the person asks for a table.
- **Keep the same order for each description,** so a listener can predict it. Left to right, or nearest first; say which.
- **No emoji or decoration** in a description.
- **Say when motion starts and ends.** "Moving now, 45 seconds." "Stopped." A person who can not see the screen has no other sign.
- **Do not send text during a flight,** except for a stop or an error. The Chat log is an ARIA live region, so each line is read aloud.
- **Alt text for a share link or a saved picture:** one sentence of 150 characters or fewer: the subject, the viewpoint, and the time
  of day if it shows. Example: "Canary Wharf towers at night, seen from 710 metres up to the south-east." Compute "south-east" from `heading_name` by
  taking the opposite direction, and check it.

Moglob also has its own access features, so tell the person about them if they would help:

- Menu > Views > Access: "Describe the view (screen reader)" speaks a description in a polite live region 1.5 seconds after the
  camera stops. `?describe=1` turns it on. This setting does not persist in the Foafos frame.
- Key V describes the view, and key T opens a text view (`?text=1`), when the focus is on the map.
- A flight's start and end notices go to `#sweepStatus`, and a sweep that ends speaks the view if the switch is on.
- These run inside the frame. They were read from the code. They were not tested with a screen reader.
