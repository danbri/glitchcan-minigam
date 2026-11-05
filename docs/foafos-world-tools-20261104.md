# World tools: what Moglob and Drift have in common (2026-11-04)

Owner, verbatim: "add webmcp to Drift too, and look for opportunity to find common concerns across Drift game and Moglob world
explorer applications."

Both are large 3D worlds in a sandboxed frame, with a camera, places, a time of day and a way to fly. Moglob is the real
Docklands and the planet, and Drift is an invented city on Titan. A caller should not need to know which is open.

## The shared tools

Same names, same frame protocol (`webmcp.*`, see `packages/foafos/src/tools.mjs`), and both registered with WebMCP.

| Tool | Moglob | Drift | Reads or changes |
|---|---|---|---|
| `get_view` | Eye, target, heading, time, weather | Place, activity, altitude, time | Reads |
| `describe_view` | A long sentence, with what is tallest in view | A short sentence | Reads |
| `find_places` | Real places | Destinations on Titan and in the Saturn system | Reads |
| `go_to` | `{place}`, or coordinates | `{place}` | Changes |
| `set_time` | Any date and time | `day`, `dusk`, `night` or `snow` | Changes |

Only Moglob: autopilot and sweeps, layers, script preference, share links, time zones. Only Drift: `start_tour`, `stop_tour`.

`/where` and `/go PLACE` in Chat use `get_view`, `describe_view` and `go_to` on whichever world is open, so a person never needs
the tool names.

## Where they differ, on purpose

- Moglob's answers are measured: longitude, latitude, metres. Drift's are named: places and moods. So the shared contract is only
  `text` and `place`, read by name, and anything else is the app's own.
- `set_time` takes different values. That is honest: Titan has no calendar here. A caller reads the tool's `inputSchema`.
- Drift has a story, and the story is not a tool. It belongs to the story runner, which owns what you may do next. A tool that
  moved the reader past a story beat would break the book.

## Common concerns worth sharing next

Not built, in the order I would do them.

1. **One small script for the frame protocol.** Moglob's `frame-bridge.js` and Drift's `worldtools.js` each carry the same 20
   lines. Any app could load one file. It stays copied for now because Moglob lives in another repo and Drift is one baked page.
2. **Places as data.** Both have lists of named places. As Linked Data (`schema:Place`, `geo:asWKT`) they could be saved to a pod,
   queried with SPARQL, and offered as `potentialAction`, the bridge between WebMCP and Schema.org raised on 2026-11-04.
3. **A shared view link.** Moglob has `share_link`. Drift could have one, so a chat message can hold a place in either world.
4. **The live thumbnail.** Drift sends the shell small frames (`hostLive`), and Moglob could too, for the Task Manager.
5. **Pause and sound.** Drift obeys the shell's pause and volume. Moglob speaks no guest protocol, so it does not.
6. **The mascot.** Moglob could appear in Drift, and the other way round, as a visitor between worlds.
