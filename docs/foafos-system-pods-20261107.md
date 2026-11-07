# Foafos: pods in the System app (2026-11-07)

Owner, 2026-11-07, verbatim: "System UI app is better except pods opens the old confusing one and it is even harder now.
I didn't have a general saved setup so I had to remember this and I could not see how to add username and pass for fly
(or choose xmpp vs http etc.) when all I couild enter was a "token". Confusing. ALso can the pods thing be folded into
System fully?"

The screen that the owner saw: "fly / error: no access token set / On foafos-xmpp.fly.dev:8443, over HTTPS / Token / Enter
token / Connect / Use for apps / More".

## What the Fly server accepts

Read from `deploy/foafos-xmpp` in https://github.com/danbri/factoidal-core (`entrypoint.sh`, `Caddyfile`, `README.md`,
origin/main on 2026-11-07), and tested live (section "Test").

| Way | Address | Sign-in | Limit |
|---|---|---|---|
| HTTPS | `https://foafos-xmpp.fly.dev:8443/` | A bearer token only. Caddy compares it with `POD_TOKEN`. There is no username and password on HTTP. | One token for the whole pod. |
| XMPP (XEP-0332) | `wss://foafos-xmpp.fly.dev/xmpp-websocket`, domain `foafos-xmpp.fly.dev`, pod `pod@foafos-xmpp.fly.dev/lws` | Username and password of an account on the server (SCRAM). | The pod has `--allow foafos@foafos-xmpp.fly.dev`, so today only that account can open it. Other accounts log in to the server and then get 403 from the pod. |

Both ways reach the same files. WebSocket Origin and CORS allow `https://danbri.github.io` and `http://localhost:8080` only.

So the owner's question has this answer: "username and password" is real, but it is XMPP, not HTTPS. The old form did not
say this. It showed a token field because the saved record was HTTPS.

**A server change is necessary if the owner wants to open the pod as `me@`:** in `deploy/foafos-xmpp/entrypoint.sh`, add the
account to `--allow` (for example `--allow "foafos@$XMPP_DOMAIN,me@$XMPP_DOMAIN"`) and deploy. This work did not change it.

## Design

- **One UI.** The Pods tab of System is the only pods screen. `mountPods()` in `inklet/finkapp/foafos-shell.js` draws it.
  The app row `inklet/finkapp/apps/pods.jsonld` and the PodStore window are deleted. `FoafOS.openPods()` and an old
  `?app=pods` link open the tab. The `office` root now offers `system`.
- **Unchanged for apps.** `pod.*` verbs, grants, `POD_OWNER`, `foafos.pods` in localStorage and `#foafos-pods` as an
  element id do not change.
- **Known servers.** `inklet/finkapp/foafos-known-pods.js` is content. It has addresses and `ways`: only what the server
  accepts. It has no account, password or token. A known server with no pod shows "Add this server" at the top of the tab.
  The press saves the pod. A pod whose `base` is a known server, such as the owner's old `fly` record, gets the same choice.
- **Sign in.** One form with one button. `FoafPods.signIn(id, { way, secret })` changes the way, holds the secret and connects.
  A change of carriage forgets the old secret. A full JID in the Username field is cut to its local part.
- **Any other server.** "Add another pod" asks how to reach it (HTTPS or XMPP), then how to sign in (HTTPS: no sign-in or
  token; XMPP: username and password). Username and password over HTTP is not offered, because no pod here accepts it.
- **Status in words.** New status `needs-login`. The errors "no access token set", "no password set" and "could not log
  in to the relay" are gone. Each case says what to do next:

  | Case | Words |
  |---|---|
  | No token held | Enter your token, then press Sign in. |
  | No password held | Enter your password, then press Sign in. |
  | Wrong password | The server did not accept this username and password. Check them, then sign in again. |
  | Account not on the pod's list (403) | The server accepted this account, but the pod does not let it in. Sign in with an account on the pod's list, or ask the pod's owner to add this one. |
  | Wrong token | The server did not accept this token. Check it, then sign in again. |
  | HTTPS pod with no token, 401 | This storage asks for a token. Enter it, then press Sign in. |
  | Login sealed and locked | Locked. Unlock your saved logins to connect. |

  Before this change, 403 over XMPP and 401 on an HTTPS pod with no token showed as online ("HEAD 403"). They do not now.
  A refused secret is forgotten, so that it is not sealed.
- **What a reload keeps.** The pod list (server, way, username) is in localStorage and has no secret. The password or token
  goes through FoafSecrets only (`POD_OWNER`). After a sign-in, the tab offers "Keep my login": one passphrase, the same
  seal as Session's Save (`FoafOS._saveLogins`). After a reload the start dialog asks to unlock, and the card has an Unlock
  button. Unlocking connects each pod that was signed in (`auto` in the record). Disconnect clears `auto`. With no
  passphrase, a reload keeps the setup and the username and asks only for the password.
- **Password managers.** The account form has `autocomplete="username"` and `current-password`, so a browser password
  manager can fill it. That store is the person's. The token field keeps `autocomplete="off"`.
- **Redraw.** The tab redraws on `pods.*` events. A redraw now waits while someone types in a field.

## How a person gets a token

From the person who runs the server. It is the `POD_TOKEN` secret of the Fly app, and the laptop that set it up has a copy
in `~/.config/foafos-xmpp-fly/token` (depmap-33 confirmed this on 2026-11-07, and it works against the pod). The tab says this
under the token field.

The commits for https://github.com/danbri/glitchcan-minigam/pull/969 and https://github.com/danbri/glitchcan-minigam/pull/970
added a token help line, "Sign in with XMPP instead" and a "Foafos server" button to the old window, with the account
`foafos` written in the code. The Pods tab replaces all three, and the code names no account.

## Test

See the result table at the end of this file. New test: `packages/foafos/pod/test/e2e-system.mjs`, the person's flow against
a local relay and pod. The known list is replaced so that it points at them. Run it with
`cd packages/foafos/pod && RELAY=factoidal FACTOIDAL_BIN=$PWD/node_modules/@factoidal/core/bin/factoidal.mjs node test/e2e-system.mjs --shots DIR`.

## Result (2026-11-07, headless Chrome, macOS)

| Suite | Result |
|---|---|
| `packages/foafos` `npm test` | All files pass, `pods.test.js` 29. `bus.test.js` and `input.test.js` are timing tests: they failed under load, on unmodified master too, and passed when the machine was quiet. |
| `pod/test/e2e-system.mjs` (new, local relay and pod) | 27 of 27 |
| `pod/test/e2e-shell.mjs` | 22 of 22 |
| `pod/test/run.mjs` | All pass |
| `pod/test/live-fly.mjs` (new, real Fly server, page from this checkout at the github.io address) | 8 of 8 |
| e2e-powers, e2e-chrome, e2e-taskmanager, e2e-desktop, e2e-builtin-pod, e2e-files-locations, e2e-chat, e2e-foafos, aria-audit | Pass |
| e2e-root | 2 failures, the same 2 on unmodified master (`serviceWorker` SecurityError in a sandboxed frame) |
| e2e-caps | 1 failure, not from this work: the test looks for "Not brokered by us", and the shell says "No Foafos service yet" |

e2e-foafos looked for the old menu name "Session and capabilities". It now looks for "System".

**Trap:** some suites need a checkout folder with the name `glitchcan-minigam`, because `fink-config.js` has absolute paths. In a
worktree with another name, stories 404, and aria-audit and e2e-foafos fail for that reason alone.

**Trap:** `e2e-system.mjs` replaces `foafos-known-pods.js`, so it cannot see a fault in the real file. A syntax fault there stopped
the whole shell during this work, and only the other suites showed it. `pods.test.js` now imports the real file.

Live test accounts: `test1` (wrong password, then refused by the pod's list) and `foafos` (connected, listed the root, read
only). The account `me` was not used. The real token was not used, so a correct token on the live server was not tested in this
work; depmap-33 reported on 2026-11-07 that the token works against the pod.

**Open item:** since "what you open comes to the front", an app that boots under a root (edot under `?root=office`) can cover a
window that `?app=` opened. So `?root=office&app=pods` can show System behind edot. Both pod tests press System first. This
is not new to pods: it applies to any `?app=` link under a root that boots an app. Commit 896e98eb ("boot windows stay back")
came after this work and is meant to fix it; this work did not test that.

After the deploy, `live-fly.mjs` passed 8 of 8 on https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?root=office&app=pods
with no local files.
