# Foafos: foafbot and `/tell` (2026-11-05)

Owner: foafbot may use `/tell APP ACTION {json}`, "ACL'd sensibly".

foafbot reads room text, and room text is untrusted. So anyone in the room could try to steer it into a `/tell`. The shell's
ACL ([foafos-bus-xmpp-20261105.md](foafos-bus-xmpp-20261105.md)) cannot see this: the shell sees only a good message from a
granted account. The bot therefore has its own rules. They come before the shell's rules and do not replace any of them.

It is **off by default**. With no file, nobody can cause a `/tell`.

## Use it

1. Write `~/foafos-xmpp/foafbot-tell.json` (or name a file with `--tell-config`):

   ```json
   {
     "owners": ["me@localhost"],
     "allow": {"playlist": ["queue", "pause"]},
     "usage": "queue takes {\"track\":\"ID\"}. pause takes nothing."
   }
   ```

2. `foafos-stack restart foafbot`. The bot reads the file only when it starts. The log says `tell: owners ...` or `tell: off (...)`.
3. In Chat: Advanced, tick "Let allowed accounts send actions to apps". Then `/grant foafbot@localhost playlist queue pause`.
4. From an owner's account, send a **direct message** to `foafbot@localhost`:

   ```
   /tell playlist queue {"track":"the-quiet-engines"}
   ```

   Or use words: `queue the-quiet-engines please`. The model turns the words into the same line, and the line goes through
   the same gate.

The owner gets the shell's answer by direct message: `The shell says: Sent queue to Playlist.` The room shows `app.action`.

### Which actions to list

List only **low-risk, reversible** actions. The examples here are Playlist `queue` and `pause`. Anyone who can pause it can
play it again, and a queued track can be removed.

**Do not list** an action that touches secrets, storage, files, accounts or money, or an action that cannot be undone. The bot
cannot tell these apart: it reads names only. The list is the owner's judgement. A grant for `queue` allows any track, because
there are no limits on the values of arguments.

## What decides, in order

| # | Check | Where | On failure |
|---|---|---|---|
| 1 | The stanza is `type="chat"`, and it arrived after the bot's own presence came back | `on_message` | Log `not-live` |
| 2 | The bare `from`, which the server stamps, is in `owners` | `heard`, `Gate.tell` | Log `not-owner`. No answer |
| 3 | One `/tell APP ACTION {json}` and nothing else | `Gate.tell` | Log, and tell the owner |
| 4 | That app and that action are in `allow`, exactly | `Gate.tell` | Log `not-allowed`, and tell the owner. The shell hears nothing |
| 5 | Flat arguments, the shell's limits | `Gate.tell` | Log, and tell the owner |
| 6 | Under 6 sent in 60 seconds, and no earlier `/tell` still waits for the shell | `Gate.tell`, `attempt` | Log `too-fast`, and tell the owner |
| 7 | The six checks of the shell | The shell | The shell's own answer, or none |

The bot does not forward text. `Gate.tell` builds the line again from the checked parts.

`allow` has no wildcard. `*`, `all`, `look` and a mistyped entry refuse the **whole file**, and the bot then runs with nobody
and nothing. An owner cannot be the bot, the shell, or an address on the room service.

## Why room text cannot reach it

This is the shape of the code, not an instruction to the model:

- The `Gate` exists only inside `direct_path()` in `inklet/tools/chat-ai.py`. It is a local variable there.
- `on_room` and `answer` handle room text. They and everything they call have no reference to the gate, to `direct_path`, or to
  `foafbot_tell`. Their only way to the shell is `ask_shell`, which raises an error for anything but `/go PLACE` and `/where`.
- `direct_path` never reads `recent`, the room history. The model on the direct path sees the owner's message and the bot's
  list, and no room text.
- A `/tell` line from the model on the room path is dropped and logged as `room-llm`. It is not said in the room.
- `@foafbot /tell ...` in the room does not reach the model. The bot says that it takes `/tell` only by direct message.

`inklet/tools/test-foafbot-tell.py` reads `chat-ai.py` as code and fails if this shape changes. This is one Python process, so
the wall is what each function can reach, not an operating-system boundary. Code added to the room path could cross it. The
test is there to stop that.

## Replies and app data are data

- A direct message from the shell's account goes to the owner who is waiting, or else to the room, as text. It is never parsed
  as a command, even if it says `/tell`.
- Mirrored events in the room reach only the room path.
- The shell's reply and app events are never put into the direct path's prompt.

## Every `/tell` is visible

Confirmed on the live stack. `deliverAction` publishes `app.action`, and `app.action` is in `DEFAULT_MIRROR`, so the room sees
this, with the arguments (redacted):

```
app.action {"summary":"foafbot@localhost → Playlist: queue","id":"playlist","action":"queue","args":{"track":"the-quiet-engines"},"from":{"kind":"account","label":"foafbot@localhost"}}
```

This is true while the default mirror list stands. An owner who removes `app.action` from the list removes this record.

A shell refusal shows as `chat.refused`. A bot refusal shows only in the bot's log, `~/.foafos-stack/logs/foafbot.log`:

```
tell refused: {"from": "me@localhost/e2e-bus", "reason": "not-owner", "app": null, "action": null}
```

The log holds who, why, and the names if they were valid. It never holds what was sent. It holds 30 lines a minute at most,
because anyone can cause these lines. Room nicknames in the log are untrusted.

## Found while testing: stored messages

The Factoidal server keeps a direct message for an offline account. It delivers the message at the next sign-in **with no
`<delay>` stamp**, so nothing marks it as old. A first version of the bot ran a `/tell` that was sent while it was stopped.

The fix: the message always came before the echo of the bot's own presence (10 of 10 sign-ins, measured). So the bot counts
direct messages only after that echo. If the echo does not come, direct messages stay refused. Sometimes the stored message
arrives in the same read as the bind answer, and the sign-in code discards it. That is also safe, but no log line shows.

**Not fixed: the same thing can happen at the shell.** A `/tell` to `foafos@localhost` while no shell is connected is probably
kept and run when the shell next connects, if the switch is on and the grant stands. This comes from reading the bot's
behaviour on the same server. It was not tested at the shell. The bot warns the owner in its "did not answer" message. The fix
belongs in `chat.mjs`, or in Factoidal as a `<delay>` stamp.

## The model

- `chat-ai.py` defaults to `claude-haiku-5-5`, and `foafos-stack` passes no `--model`, so the running bot uses Haiku. A call on
  2026-11-05 reported `modelUsage` for `claude-haiku-5-5` only, and `total_cost_usd` 0.16. **The owner has not decided** if this
  fits the rule in `CLAUDE.md` about Haiku. This work did not change the default.
- The safety above does not depend on which model runs. On the direct path a weak model can choose the wrong action from the
  list, or the wrong track, but it cannot go past the list.

## Tests

- `python3 -B inklet/tools/test-foafbot-tell.py`: the file rules, the gate, and the shape of the code. No server.
- `node inklet/finkapp/test/e2e-foafbot-tell.mjs`: Chrome, the stack's shell and XMPP server, the real Playlist in its sandboxed
  frame, the real `chat-ai.py`, in a new room. Stop the `foafbot` service first. A stand-in `claude` command gives the worst case,
  a fully steered model, and records each prompt. `E2E_REAL_CLAUDE=1` adds two calls to the real model.

The server has three accounts: `foafos`, `foafbot`, `me`. A new one needs an XMPP restart, which would disturb other sessions.
So "not an owner" is tested by restarting the bot with another owner and asking again from `me`.

## Not built

- **Confirmation for the direct path.** A model reading an owner's message acts at once. If the owner pastes room text into a
  direct message, that text can steer the model, within the bot's list. The form `/tell ...` does not use the model at all.
- **Limits on argument values.**
- **Reloading the file** without a restart.
- **A way to see bot refusals in the room.** They are in the log only.

## Test results, 2026-11-05

- `test-foafbot-tell.py`: 14 of 14 pass.
- `e2e-foafbot-tell.mjs` with `E2E_REAL_CLAUDE=1`: all 47 checks pass on the live stack. The real model was `claude-haiku-5-5`. It
  refused the room injection in words, and it sent the owner's direct-message request. The injection check proves little
  about the design: the stand-in model is the proof, because it obeys the injection every time.
- Without the real model: repeated runs passed, except two runs that failed one check on the `not-live` log line. That line is
  now a printed note, because of the discarded case under "Found while testing". No action ran in those two runs.
- `e2e-bus-xmpp`: 32 pass. `e2e-chat`, `e2e-bus`: pass. foafos package suite: 151 of 151. `test-foafos-stack`: 18 of 18.
