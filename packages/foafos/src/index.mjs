// foafos — a shell for the social, playable web. (Working name; the
// terminology is the project owner's to settle.)
//
// The pieces:
//   FoafBus          local realtime event spine (+ cross-tab bridge)
//   session          ephemeral identity, persistable only sealed (AES-GCM)
//   widgets / cards  everything on screen is a web component fed an item
//   <foafos-feed>    a social-style stream of bus events
//   transports       adapters into the wider notification ecosystem
//
// No story, game, or site names live in this package (NPM boundary rule).

export { FoafBus } from './bus.mjs';
export {
  createSession, sealSession, openSession,
  saveSealed, loadSealed, clearSealed, SESSION_KEY,
} from './session.mjs';
export { WidgetRegistry, widgets, defineBaseCards, defineActivityCard } from './widgets.mjs';
export { defineFeed } from './feed.mjs';
export { SseTransport, WebSocketTransport, FeedPoller } from './transports.mjs';
export { FoafCluster } from './cluster.mjs';
export { scopeBus, defineGuest } from './guest.mjs';
export { defineTable } from './table.mjs';
export { defineTree } from './tree.mjs';
export { FoafInput, ACTIONS, ACTION_KEYS } from './input.mjs';
export { FoafVars, SHARED_DEFAULT, HOST_CONTEXT } from './vars.mjs';
export { FoafAudio, AUDIO_KEY } from './audio.mjs';
export { FoafStore, localBackend, memoryBackend, STORE_CAP } from './store.mjs';
// A secret is not storage: PUT and USE, never GET. See secrets.mjs for why.
export { FoafSecrets, SECRETS_CAP, MAX_SECRET_BYTES } from './secrets.mjs';
// …and what "USE" means: named shell-side verbs over a named secret, aimed
// by the grant rather than by the caller. Broker the action, not the token.
export {
  FoafOps, defaultOps, DEFAULT_OPS, gitCommitOp, s3PutOp, solidPutOp,
  cleanPath, withinPrefix,
} from './ops.mjs';
export { sigv4, awsUriEncode, sha256hex, amzDate, EMPTY_SHA256 } from './sigv4.mjs';
export { AppTree } from './apptree.mjs';
// The user's LWS storages ("pods"), over HTTPS or XMPP (XEP-0332), held by the shell and
// brokered to apps by grant. See pods.mjs and docs/foafos-pods-20261103.md.
export { FoafPods, POD_OWNER, POD_VERBS, checkPod, BUILTIN_BASE, BUILTIN_PRINCIPAL, BUILTIN_ACL } from './pods.mjs';
export { XmppWs, XmppError } from './xmpp-ws.mjs';
export { deviceFetch } from './device-fetch.mjs';
export { describeLocation } from './locations.mjs';
// The shell's XMPP connection and the bus room (MUC), on the in-page Factoidal server or a
// localhost one. See chat.mjs and docs/foafos-chat-20261103.md.
export { FoafChat, CHAT_OWNER, DEFAULT_MIRROR, BUILTIN_DOMAIN } from './chat.mjs';
// The tools framed apps offer, and chat commands that reach them. See tools.mjs.
export { FoafTools } from './tools.mjs';
export { ToolGrants, PERSON, BROWSER_AGENT, SHELL_APP, accountCaller, describeGrant } from './tool-grants.mjs';
export { createChatCommands, explainToolFailure } from './chat-commands.mjs';
export { lwsStore, cachedBackend, mergeKeys, LwsConflict } from './lws-store.mjs';
