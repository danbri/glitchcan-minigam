---
name: container-improver
description: >-
  Before you write "this container has no X", "X is not available in this
  environment", "there is no imagemagick/ffmpeg/PIL here", or design a
  workaround around a missing binary or library — TRY TO INSTALL IT. Claude
  cloud VMs run as root with working apt, pip, npm, cargo and go, and the
  package registries are routed around the agent proxy on purpose. Installing
  imagemagick, ffmpeg and Pillow here took eighteen seconds in total, after a
  CLAUDE.md note had told three sessions they were impossible. Use this skill
  whenever a tool is missing, a `which` comes back empty, an import fails, a
  build needs a compiler, or you are about to describe an environment limit —
  and use it to tell a real limit (no GPU, no WebGPU, no `gh`) from a limit
  that is one command wide.
---

# Do not give up on the container

The environment note in a repo is a snapshot of what was installed at some
moment. It is not a statement about what is possible. Confusing the two is how
`CLAUDE.md` came to warn, in bold, that **"the remote container has NO
imagemagick, ffmpeg or Python PIL"** — a sentence that was true, useless, and
cost a session's worth of workaround.

## 1. The measurement

Run in this container, August 2026, from a cold start:

| want | command | took |
|---|---|---|
| `apt-get update` | `apt-get update -qq` | ~5 s |
| ImageMagick | `apt-get install -y imagemagick` | **12 s** |
| ffmpeg | `apt-get install -y ffmpeg` | **3 s** |
| Pillow | `pip install --break-system-packages pillow` | **3 s** |
| sharp (native libvips) | `npm install sharp` | **4 s** |

All four then did real work: `convert` cropped and re-encoded a PNG, `ffmpeg`
built a GIF from a glob of PNGs, `import PIL` succeeded, `sharp` reported
libvips 8.18.3.

The container runs as **uid 0**. `apt-get`, `dpkg`, `pip`, `pip3`, `npm`,
`cargo` and `go` are all on `PATH`. There was 25 GB of free disk.

## 2. Why installing works here

`curl -sS "$HTTPS_PROXY/__agentproxy/status"` prints the proxy's own state, and
its `noProxy` list contains, deliberately:

    registry.npmjs.org, jsr.io, npm.jsr.io, pypi.org, files.pythonhosted.org,
    index.crates.io, proxy.golang.org

The package registries are routed **around** the agent proxy. Installing
dependencies is a supported activity, not a hole to squeeze through.

Note what that list does *not* include: `crates.io` itself. Its API host
answers **403 through the proxy** while `index.crates.io` and
`static.crates.io` both answer 200 — which is all `cargo` actually uses. One
403 from one host is not evidence that an ecosystem is closed. Check the host
the tool really talks to.

## 3. The rule

**Before writing that something is unavailable, spend two minutes trying to
get it.** In order:

1. `which <tool>` and `apt-cache policy <pkg>` — is it merely not installed?
2. `apt-get install -y <pkg>` / `pip install <pkg>` / `npm install <pkg>`.
3. If the package does not exist: is there a static binary release to `curl`,
   or source to `git clone` and build? `cargo`, `go` and a C toolchain are
   present.
4. Only then, and only after saying what you tried, describe the limit.

Timebox it. Two minutes of `apt-get` beats an hour of workaround, but an hour
of fighting a build for a nice-to-have does not.

**Never** route around the proxy to do it: do not disable TLS verification, do
not unset `HTTPS_PROXY`, do not add `--trusted-host`. If TLS or a 403/405/407
blocks you, read `/root/.ccr/README.md` and the status endpoint above — there
is a per-tool fix there.

## 4. The catch that makes this a judgement, not a reflex

**The container is ephemeral. Your install is not in the repo.** It vanishes
with the session, and it was never on the user's laptop or in CI. So:

- **One-off work** — a crop, a re-encode, a contact sheet, a conversion:
  install and get on with it. Nothing is owed to anyone.
- **A tool you commit** must not silently depend on what you installed. Either
  put the exact install line in a comment at the top of the tool and in its
  README section, so the next session and the user can reproduce it, or keep a
  dependency-free path. `magpie/dbdb/tools/element-sheet.mjs` composes sheets
  on a `<canvas>` and needs no native binary at all — that was the right
  design, chosen for the wrong reason.
- **Say which you did.** "Cropped with ImageMagick, which I installed in this
  session" is honest. "Cropped with ImageMagick" implies it was there.

## 5. Real limits, so this skill is not read as "anything is possible"

Verified in this environment, and NOT fixable by installing anything:

- **No GPU.** Chromium renders through SwiftShader — a CPU pretending to be a
  GPU. Colours, pixel counts, splat counts and sort times are real; frame
  rates are worthless.
- **No WebGPU headless.** A "visual check" of WGSL silently tests the WebGL
  path instead. Never claim a WGSL fix is verified from a headless capture.
- **No `gh` and no `hub`** in the remote execution environment. GitHub work
  goes through the `mcp__github__*` tools.
- **Headless Chromium cannot reach every host `curl` can.** superspl.at
  answers `curl` and resets the browser's connection. When a fetch fails in
  the page, try it from the shell before concluding the site is down.
- **Downloads behind a login** — superspl.at scene files, Sketchfab — answer
  401 without an account, and a signed-in human does that step. Installing
  software does not change an access-control decision, and neither do we.

## 6. When you find a stale note, fix it

The environment claim that sent this sideways lived in `CLAUDE.md`. A snapshot
that reads as a rule needs correcting where it lives, in the same commit as the
work that disproved it — and correcting to something durable: not "imagemagick
is present" (it will not be tomorrow), but "imagemagick installs in 12 seconds
with apt; nothing in the repo depends on it".
