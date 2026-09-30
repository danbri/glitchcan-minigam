---
name: game-mcp
description: The project's own MCP server for exploring and testing the game during development ("glitchcan" in .mcp.json, tools/game-mcp/server.mjs). One headless browser stays open between calls, and the game's test hooks are tools — open a story or app in the foafos shell, read and choose, set story variables, ask Drift City where the camera is (IAU_2015:60600 with the view vector), pick in the world, run the window menu's actions, switch the window mode and the pad, tail the bus, read errors, take a screenshot, eval in any frame, and render a city view with the real WebGPU shaders in software. Use it when you want to look around or check something in the running game without writing a new Playwright script; use the e2e suites for regression tests.
---

# game-mcp

Owner, September 2026: "would mcp and/or webmcp make testing or exploring the
game easier during development?" — then "Build it". What made exploring slow:
every check was a new script that launched a new browser, and the city takes
30-90 s to load headless. This keeps one page warm and makes the hooks tools.

## Run it

- Claude Code starts it from `.mcp.json` (server "glitchcan"). A project
  server asks for approval the first time; after that its tools appear as
  `mcp__glitchcan__*`. It is picked up when a session starts.
- By hand: `npm run game-mcp` speaks MCP (newline-delimited JSON-RPC 2.0) on
  stdin/stdout; logs go to stderr.
- Its test: `npm run test:game-mcp` (about 2 minutes), `RENDER=1` adds the
  WebGPU render (1-2 minutes more). It drives the server as a client does.

## The tools

| tool | what |
|---|---|
| `open_story {story, width?, height?, touch?, query?}` | fresh page on `?story=/glitchcan-minigam/<story>`; phone size by default; waits until playable |
| `open_app {app?, root?}` | `?app=<id>` (or `?player=none`); returns the app tree |
| `story_state {lines?}` | file, knot, choices, last prose, status, world, depth |
| `choose {index \| text}` | chooses, waits for the story to move |
| `story_goto {knot}`, `story_var {name, value?}` | the runner's test hooks |
| `world_state` | renderer, camera on Titan (crs, lat, lon east, lonW, alt, view az/el/enu/iau), mode, scene, place, the shell's readout, the selection |
| `world_places`, `world_goto {place}` | the city's places; put the camera at one |
| `world_pick {x, y}` | a tap at fractions of the city view; the shell's selection entity |
| `actions_list`, `action_run {id}` | the window menu's app actions, flattened with paths ("Time and weather › Night") |
| `wm {mode?, pad?}` | full / split / pip; show / faint / hidden / off |
| `bus_tail {prefix?, n?}` | the last 300 bus events (no heartbeat, no SDK tap) |
| `errors` | page and console errors, all frames |
| `screenshot` | PNG of the page |
| `eval {expression, frame}` | shell (`FoafOS`, `FinkWM`, `FinkMinigames`), runner (`__storyrunner`), city (`__drift`) |
| `render_webgpu {place?, tod?, width?, height?, frames?}` | Node Dawn on lavapipe via `drift-city/tests/dawn-run.mjs`; PNG |
| `close` | closes the browser |

## Limits, stated

- **The browser runs the city's WebGL fallback.** Headless Chromium has no
  WebGPU unless forced into SwiftShader, and the whole page there did not
  produce a frame in ten minutes (container-improver skill). The fallback
  only flies: it has **no visits**, so `world_goto` cannot hold the camera at
  a place and says so (`note`); orbit and Saturn views need WebGPU too.
  `render_webgpu` renders any place with the real shaders, one frame.
- `render_webgpu` needs `npm i --no-save webgpu` (in the repo root; not in
  package.json on purpose) and `mesa-vulkan-drivers`. The error says so if
  either is missing.
- Frame rates here mean nothing (software GL).
- `eval` runs anything in the page. It is a development tool for this
  machine; it is not exposed to readers, and it holds no capability a reader
  lacks only because the page is local and unsandboxed at the top.
- The page is served from the working tree at `/glitchcan-minigam/`, with
  CORS (sandboxed frames have an opaque origin) and no caching, so an edit
  shows on the next `open_story`. Rebuild `drift-city/dist/city.html`
  (`python3 drift-city/tools/assemble.py`) after changing `drift-city/src/`.

## Built by hand, no SDK

The MCP stdio transport needs `initialize`, `tools/list`, `tools/call` and
`ping`; about 30 lines. Adding `@modelcontextprotocol/sdk` would be a new
dependency for that. If the protocol grows a need (resources, progress
notifications), move to the SDK rather than growing the hand-rolled part.

## Related

- WebMCP (a page declaring its own tools to an agent in the browser) is the
  in-product version of the same idea. The app actions (spec §5.9), the
  activity stream (§5.10) and the selection (§5.11) are data, so the shell
  could declare them; the shell (level 0) must declare them, never the
  sandboxed apps, and every call must pass the same capability checks as a
  tap. Not built: the proposal's API and browser support were not checked.
