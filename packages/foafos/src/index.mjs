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
