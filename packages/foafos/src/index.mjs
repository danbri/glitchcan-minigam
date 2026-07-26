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
export { WidgetRegistry, widgets, defineBaseCards } from './widgets.mjs';
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
