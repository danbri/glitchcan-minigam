# Peer Architecture Design: INK & Games as Equals

**Date:** 2025-10-20
**Context:** Evolution from gamgam-wc.html's hierarchical model to peer-based architecture

---

## Current Architecture Analysis (gamgam-wc.html)

### Component Hierarchy
```
<gc-gamgam> (Parent Coordinator)
│
├── <gc-inkblot> (Narrative View)
│   ├── Story text display
│   ├── Choice buttons
│   └── Events: play-minigame-requested, show-minigame-guide-requested
│
└── <gc-minigam-slovib> (Game View)
    ├── Canvas rendering
    ├── Game loop
    └── Events: return-to-wrld-requested, minigame-won, minigame-lost
```

### Flow Control
1. **GCGamGam** owns state: `activeView` ('wrld' or 'minigam')
2. **GCGamGam** controls activation/deactivation via `_switchView(viewId)`
3. Children are passive - activated/deactivated by parent
4. Communication via custom DOM events (bubbling up to parent)

### Limitations
- **Parent knows too much** - GCGamGam controls children's lifecycle
- **No shared services** - Each component manages its own data
- **Hard to add new components** - Must modify parent coordinator
- **No peer-to-peer communication** - Everything routes through parent
- **No shared infrastructure** - Auth, storage, networking would be duplicated

---

## Proposed Peer Architecture

### Core Principle
**INK narrative engine and arbitrary games (Pacman, Space Invaders, etc.) are architectural peers sharing common infrastructure**

### Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Application Shell                     │
│  - Minimal coordinator (routing, view management)       │
│  - Does NOT control component internals                 │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ INK Player   │   │ Pacman Game  │   │ Space Inv.   │
│ Component    │   │ Component    │   │ Component    │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Service Layer (Shared)                │
│  ┌────────────┬────────────┬────────────┬────────────┐ │
│  │    Auth    │  Storage   │   Network  │  EventBus  │ │
│  │  Service   │  Service   │  Service   │  Service   │ │
│  └────────────┴────────────┴────────────┴────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Service Layer Design

### 1. Auth Service (Identity & Permissions)

**Purpose:** Unified authentication across all game components

```javascript
class AuthService {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
  }

  // Methods
  async login(provider) {
    // OAuth, GitHub, Discord, etc.
    // Returns: { id, username, avatar, permissions }
  }

  async logout() {
    // Cleanup user session
  }

  getCurrentUser() {
    // Returns current user or null
  }

  hasPermission(permission) {
    // Check if user has specific permission
    // e.g., 'save_games', 'multiplayer', 'leaderboard'
  }

  // Observable pattern
  onAuthChange(callback) {
    this.listeners.push(callback);
    return () => this.listeners.filter(cb => cb !== callback);
  }
}
```

**Use Cases:**
- INK player saves story progress under user account
- Pacman posts high scores to leaderboard
- Multiplayer games authenticate before joining rooms
- Premium content gating based on permissions

---

### 2. Storage Service (Save Games & State)

**Purpose:** Unified persistent storage for all components

```javascript
class StorageService {
  constructor(authService) {
    this.auth = authService;
    this.backend = 'indexeddb'; // or 'localstorage', 'cloud', etc.
  }

  // Namespaced storage per component
  async save(namespace, key, data) {
    // namespace: 'ink-player', 'pacman', 'space-invaders'
    // key: 'story-progress', 'high-score', 'settings'
    // Automatically scopes to current user if authenticated
  }

  async load(namespace, key) {
    // Returns data or null
  }

  async list(namespace) {
    // List all keys in namespace for current user
  }

  async delete(namespace, key) {
    // Remove saved data
  }

  // Cross-component shared state
  async saveGlobal(key, data) {
    // Global state accessible by all components
    // e.g., 'user-achievements', 'total-playtime'
  }

  async loadGlobal(key) {
    // Access global state
  }
}
```

**Storage Schema:**
```
User: alice@example.com
├── ink-player/
│   ├── hampstead-progress.json
│   ├── bagend-progress.json
│   └── bookmarks.json
├── pacman/
│   ├── high-score.json
│   ├── settings.json
│   └── saved-games.json
├── space-invaders/
│   └── high-score.json
└── global/
    ├── achievements.json
    ├── total-playtime.json
    └── cross-game-unlocks.json
```

---

### 3. Network Service (Multiplayer & Sync)

**Purpose:** Unified networking for real-time features

```javascript
class NetworkService {
  constructor(authService) {
    this.auth = authService;
    this.socket = null;
    this.rooms = new Map();
  }

  // Connection management
  async connect() {
    // WebSocket or WebRTC connection
    // Authenticated via authService
  }

  async disconnect() {
    // Cleanup connections
  }

  // Room-based multiplayer
  async joinRoom(roomId, componentType) {
    // componentType: 'pacman', 'space-invaders'
    // Returns room object with peers
  }

  async leaveRoom(roomId) {
    // Exit multiplayer room
  }

  // Messaging
  sendToRoom(roomId, message) {
    // Broadcast to all peers in room
  }

  sendToPeer(peerId, message) {
    // Direct peer-to-peer message
  }

  onMessage(callback) {
    // Listen for incoming messages
  }

  // Leaderboards
  async submitScore(game, score, metadata) {
    // Post score to global leaderboard
  }

  async getLeaderboard(game, limit = 10) {
    // Fetch top scores
  }

  // Cloud sync (optional)
  async syncState(namespace, data) {
    // Sync local state to cloud
  }
}
```

**Use Cases:**
- Multiplayer Pacman with shared maze
- Real-time INK story collaboration
- Cross-device save game sync
- Global leaderboards
- Spectator mode for games

---

### 4. Event Bus Service (Coordination)

**Purpose:** Decoupled communication between peer components

```javascript
class EventBusService {
  constructor() {
    this.listeners = new Map();
    this.eventHistory = []; // Debug/replay
  }

  // Publish-subscribe pattern
  emit(eventType, data, metadata = {}) {
    const event = {
      type: eventType,
      data: data,
      metadata: {
        timestamp: Date.now(),
        source: metadata.source || 'unknown',
        ...metadata
      }
    };

    this.eventHistory.push(event);

    const handlers = this.listeners.get(eventType) || [];
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`EventBus handler error for ${eventType}:`, error);
      }
    });

    return event;
  }

  on(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(eventType);
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    };
  }

  once(eventType, handler) {
    const unsubscribe = this.on(eventType, (event) => {
      handler(event);
      unsubscribe();
    });
    return unsubscribe;
  }

  // Wildcard subscriptions
  onAny(handler) {
    // Listen to all events
  }

  // Replay events (debugging/testing)
  replay(filter = null) {
    return filter
      ? this.eventHistory.filter(filter)
      : this.eventHistory;
  }
}
```

**Event Taxonomy:**
```javascript
// Navigation events
'app:navigate' - { to: 'component-name', from: 'previous', params: {} }
'app:back' - { to: 'previous-component' }

// Lifecycle events
'component:mounted' - { component: 'ink-player', instance: <ref> }
'component:unmounted' - { component: 'pacman' }
'component:activated' - { component: 'space-invaders' }
'component:deactivated' - { component: 'ink-player' }

// Game state events
'game:started' - { game: 'pacman', difficulty: 'hard' }
'game:paused' - { game: 'ink-player', storyPosition: 'knot-name' }
'game:completed' - { game: 'pacman', score: 1500, duration: 180 }
'game:saved' - { game: 'ink-player', saveSlot: 1 }

// Cross-component events
'achievement:unlocked' - { id: 'first-win', game: 'pacman' }
'score:high-score' - { game: 'pacman', score: 5000, rank: 3 }
'state:shared' - { key: 'player-level', value: 5 }

// User events
'user:login' - { user: { id, username } }
'user:logout' - {}

// Network events
'network:connected' - { roomId: 'abc123' }
'network:peer-joined' - { peerId: 'user-456', roomId: 'abc123' }
'network:message' - { from: 'user-456', data: {...} }
```

---

## Component Interface (Peer Contract)

### Standard Component API

Every peer component (INK player, Pacman, etc.) implements:

```javascript
class GameComponent extends HTMLElement {
  // Required properties
  static componentName = 'unique-name';
  static version = '1.0.0';

  constructor(services) {
    super();
    // Inject services
    this.auth = services.auth;
    this.storage = services.storage;
    this.network = services.network;
    this.eventBus = services.eventBus;

    // Component-specific state
    this.state = {};
  }

  // Lifecycle hooks
  async init() {
    // Initialize component (load assets, setup)
  }

  async activate() {
    // Component becomes visible/active
    // Start game loop, load story, etc.
  }

  async deactivate() {
    // Component hidden (pause, cleanup)
  }

  async destroy() {
    // Permanent cleanup
  }

  // State management
  async saveState() {
    // Persist component state via storage service
    await this.storage.save(
      this.constructor.componentName,
      'state',
      this.state
    );
  }

  async loadState() {
    // Restore component state from storage
    this.state = await this.storage.load(
      this.constructor.componentName,
      'state'
    ) || {};
  }

  // Event emission
  emitEvent(eventType, data) {
    this.eventBus.emit(eventType, data, {
      source: this.constructor.componentName
    });
  }

  // Service access
  getCurrentUser() {
    return this.auth.getCurrentUser();
  }
}
```

---

## Example: INK Player as Peer

```javascript
class InkPlayerComponent extends GameComponent {
  static componentName = 'ink-player';
  static version = '2.0.0';

  constructor(services) {
    super(services);
    this.story = null;
    this.storyUrl = null;
  }

  async activate() {
    // Load saved story progress
    const savedState = await this.loadState();
    if (savedState.storyUrl) {
      await this.loadStory(savedState.storyUrl);
      if (savedState.storyState) {
        this.story.state.LoadJson(savedState.storyState);
      }
    }

    // Subscribe to cross-component events
    this.eventBus.on('achievement:unlocked', (event) => {
      // Show achievement notification in story UI
      this.displayAchievement(event.data);
    });

    this.emitEvent('component:activated', { component: 'ink-player' });
  }

  async loadStory(url) {
    // Load and compile FINK story
    const finkContent = await this.fetchStory(url);
    this.story = new inkjs.Compiler(finkContent).Compile();
    this.storyUrl = url;

    // Save progress
    await this.saveState();
  }

  async makeChoice(choiceIndex) {
    this.story.ChooseChoiceIndex(choiceIndex);

    // Check for minigame launch tags
    const tags = this.story.currentTags;
    const minigameTag = tags.find(t => t.startsWith('MINIGAME:'));

    if (minigameTag) {
      const gameName = minigameTag.split(':')[1].trim();

      // Emit navigation event
      this.emitEvent('app:navigate', {
        to: gameName,
        from: 'ink-player',
        params: {
          returnTo: 'ink-player',
          context: this.story.variablesState
        }
      });

      // Save story state before switching
      await this.saveState();
    }
  }

  async saveState() {
    await this.storage.save(this.constructor.componentName, 'state', {
      storyUrl: this.storyUrl,
      storyState: this.story?.state?.ToJson(),
      variablesState: this.story?.variablesState
    });

    this.emitEvent('game:saved', {
      game: 'ink-player',
      story: this.storyUrl
    });
  }
}
```

---

## Example: Pacman as Peer

```javascript
class PacmanComponent extends GameComponent {
  static componentName = 'pacman';
  static version = '1.0.0';

  constructor(services) {
    super(services);
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.gameLoop = null;
  }

  async activate(params = {}) {
    // Restore saved game or start fresh
    const savedState = await this.loadState();
    if (savedState && !params.newGame) {
      this.score = savedState.score;
      this.lives = savedState.lives;
      this.level = savedState.level;
    }

    // Check if launched from INK story
    if (params.context) {
      // Use INK variables to modify game
      const inkVars = params.context;
      if (inkVars.pacman_power_up) {
        this.lives += 2; // Bonus lives from story
      }
      if (inkVars.difficulty_level) {
        this.level = inkVars.difficulty_level;
      }
    }

    // Start game
    this.startGame();
    this.emitEvent('game:started', {
      game: 'pacman',
      level: this.level
    });
  }

  async deactivate() {
    // Pause game
    this.pauseGame();
    await this.saveState();
  }

  onGameOver() {
    this.emitEvent('game:completed', {
      game: 'pacman',
      score: this.score,
      level: this.level,
      completed: false
    });

    // Submit to leaderboard
    this.network.submitScore('pacman', this.score, {
      level: this.level,
      user: this.getCurrentUser()?.username
    });

    // Check if launched from INK - return with results
    const currentRoute = this.getActivationParams();
    if (currentRoute?.returnTo === 'ink-player') {
      this.emitEvent('app:navigate', {
        to: 'ink-player',
        from: 'pacman',
        params: {
          minigameResult: {
            game: 'pacman',
            score: this.score,
            won: false
          }
        }
      });
    }
  }

  onLevelComplete() {
    this.level++;

    if (this.level > 10) {
      // Game won!
      this.emitEvent('game:completed', {
        game: 'pacman',
        score: this.score,
        level: this.level,
        completed: true
      });

      // Unlock achievement
      this.emitEvent('achievement:unlocked', {
        id: 'pacman-master',
        game: 'pacman',
        title: 'Pacman Master',
        description: 'Completed all 10 levels'
      });

      // Return to INK if launched from story
      const currentRoute = this.getActivationParams();
      if (currentRoute?.returnTo === 'ink-player') {
        this.emitEvent('app:navigate', {
          to: 'ink-player',
          from: 'pacman',
          params: {
            minigameResult: {
              game: 'pacman',
              score: this.score,
              won: true,
              achievementUnlocked: 'pacman-master'
            }
          }
        });
      }
    }
  }
}
```

---

## Application Shell (Minimal Coordinator)

```javascript
class GlitchCanaryApp {
  constructor() {
    // Initialize services
    this.services = {
      auth: new AuthService(),
      storage: new StorageService(this.auth),
      network: new NetworkService(this.auth),
      eventBus: new EventBusService()
    };

    // Component registry
    this.components = new Map();
    this.activeComponent = null;
    this.componentParams = null;

    // Setup navigation
    this.setupNavigation();
  }

  // Register peer components
  registerComponent(ComponentClass) {
    const instance = new ComponentClass(this.services);
    this.components.set(ComponentClass.componentName, instance);

    // Add to DOM but hide initially
    document.body.appendChild(instance);
    instance.style.display = 'none';

    // Initialize
    instance.init();

    console.log(`Registered component: ${ComponentClass.componentName}`);
  }

  setupNavigation() {
    // Listen for navigation events
    this.services.eventBus.on('app:navigate', async (event) => {
      const { to, from, params } = event.data;
      await this.navigate(to, params);
    });

    this.services.eventBus.on('app:back', async (event) => {
      // Implement browser-like back navigation
      const returnTo = event.data.to;
      await this.navigate(returnTo);
    });
  }

  async navigate(componentName, params = {}) {
    // Deactivate current component
    if (this.activeComponent) {
      const current = this.components.get(this.activeComponent);
      await current.deactivate();
      current.style.display = 'none';
    }

    // Activate new component
    const next = this.components.get(componentName);
    if (!next) {
      console.error(`Component not found: ${componentName}`);
      return;
    }

    next.style.display = 'block';
    next.activationParams = params; // Store for component access
    await next.activate(params);

    this.activeComponent = componentName;
    this.componentParams = params;

    // Update URL (if using history API)
    window.history.pushState(
      { component: componentName, params },
      '',
      `#${componentName}`
    );
  }

  // Initialize app
  async init() {
    // Register all components
    this.registerComponent(InkPlayerComponent);
    this.registerComponent(PacmanComponent);
    this.registerComponent(SpaceInvadersComponent);
    // ... more components

    // Restore auth session
    await this.services.auth.restoreSession();

    // Navigate to initial component (from URL or default)
    const initialComponent = this.getComponentFromURL() || 'ink-player';
    await this.navigate(initialComponent);
  }
}

// Bootstrap
const app = new GlitchCanaryApp();
await app.init();
```

---

## Cross-Component Data Flow Examples

### Example 1: INK Story → Pacman → INK Story

**Scenario:** Player encounters arcade machine in INK story

```javascript
// In INK story (hampstead.fink.js)
=== arcade_room ===
You find an old Pacman arcade machine.

+ [Play Pacman] -> play_pacman

=== play_pacman ===
# MINIGAME: pacman
Loading Pacman...
-> pacman_complete

=== pacman_complete ===
{minigame_result.won:
  You beat Pacman! Score: {minigame_result.score}
  ~ player_coins += 50
  ~ achievement_pacman_master = true
  + [Continue] -> next_room
- else:
  Game over. Score: {minigame_result.score}
  + [Try again] -> play_pacman
  + [Leave] -> arcade_room
}
```

**Flow:**
1. INK detects `# MINIGAME: pacman` tag
2. Emits `app:navigate` to 'pacman' with context
3. Pacman activates, receives INK variables
4. Player plays Pacman
5. On completion, Pacman emits `app:navigate` back to 'ink-player' with results
6. INK continues with `minigame_result` available

### Example 2: Shared Achievement System

```javascript
// Any component can unlock achievements
this.eventBus.emit('achievement:unlocked', {
  id: 'speedrunner',
  title: 'Speedrunner',
  description: 'Complete Hampstead in under 5 minutes',
  game: 'ink-player',
  xp: 100
});

// Achievement service (could be another peer component!)
class AchievementService {
  constructor(services) {
    this.services = services;
    this.unlocked = new Set();

    services.eventBus.on('achievement:unlocked', (event) => {
      this.unlock(event.data);
    });
  }

  async unlock(achievement) {
    if (this.unlocked.has(achievement.id)) return;

    this.unlocked.add(achievement.id);

    // Save globally
    await this.services.storage.saveGlobal('achievements',
      Array.from(this.unlocked)
    );

    // Show notification (toast)
    this.showNotification(achievement);

    // Grant XP
    this.grantXP(achievement.xp);
  }
}
```

### Example 3: Multiplayer Pacman Launched from INK

```javascript
// INK story offers multiplayer option
=== arcade_multiplayer ===
Play solo or multiplayer?

+ [Solo]
  # MINIGAME: pacman
  # MINIGAME_MODE: solo
  -> play_solo

+ [Multiplayer]
  # MINIGAME: pacman
  # MINIGAME_MODE: multiplayer
  -> play_multiplayer

// Pacman component receives mode
async activate(params) {
  if (params.context?.minigame_mode === 'multiplayer') {
    // Join multiplayer room
    const room = await this.network.joinRoom('pacman-lobby', 'pacman');
    this.startMultiplayerGame(room);
  } else {
    this.startSinglePlayerGame();
  }
}
```

---

## Benefits of Peer Architecture

### For Developers
1. **Modularity** - Add new games without modifying app shell
2. **Testability** - Each component independently testable
3. **Reusability** - Services usable across all components
4. **Scalability** - Load components on-demand (code splitting)

### For Users
1. **Seamless experience** - Unified auth, saves, achievements
2. **Cross-game features** - Leaderboards, multiplayer, spectator mode
3. **Persistent progress** - Never lose progress across games
4. **Social features** - Friends, chat, shared experiences

### For Content Creators
1. **INK stories can reference any game** - Not limited to embedded minigames
2. **Games can launch stories** - Two-way navigation
3. **Shared state** - Story choices affect games, game outcomes affect stories
4. **Composability** - Mix and match components freely

---

## Implementation Roadmap

### Phase 1: Service Layer
- [ ] Implement AuthService (basic login/logout)
- [ ] Implement StorageService (IndexedDB)
- [ ] Implement EventBusService (pub/sub)
- [ ] Unit tests for services

### Phase 2: Component Interface
- [ ] Define GameComponent base class
- [ ] Refactor existing gc-inkblot to use services
- [ ] Refactor existing gc-minigam-slovib to use services
- [ ] Create PacmanComponent as proof-of-concept

### Phase 3: Application Shell
- [ ] Minimal GlitchCanaryApp coordinator
- [ ] Component registration system
- [ ] Navigation via EventBus
- [ ] URL-based routing

### Phase 4: Network Service (Optional)
- [ ] WebSocket backend
- [ ] Multiplayer room management
- [ ] Leaderboard API
- [ ] Cloud save sync

### Phase 5: Polish
- [ ] Achievement system
- [ ] User profiles
- [ ] Social features
- [ ] Analytics/telemetry

---

## Code Example: Complete Peer Setup

```html
<!DOCTYPE html>
<html>
<head>
  <title>Glitch Canary - Peer Architecture</title>
  <script type="module">
    import { AuthService } from './services/auth.js';
    import { StorageService } from './services/storage.js';
    import { NetworkService } from './services/network.js';
    import { EventBusService } from './services/eventbus.js';

    import { InkPlayerComponent } from './components/ink-player.js';
    import { PacmanComponent } from './components/pacman.js';
    import { SpaceInvadersComponent } from './components/space-invaders.js';

    // Bootstrap app
    class App {
      constructor() {
        this.services = {
          auth: new AuthService(),
          storage: new StorageService(),
          network: new NetworkService(),
          eventBus: new EventBusService()
        };

        this.components = new Map();
        this.setupNavigation();
      }

      registerComponent(ComponentClass) {
        const instance = new ComponentClass(this.services);
        this.components.set(ComponentClass.componentName, instance);
        document.getElementById('app-container').appendChild(instance);
        instance.style.display = 'none';
        instance.init();
      }

      setupNavigation() {
        this.services.eventBus.on('app:navigate', (event) => {
          this.navigate(event.data.to, event.data.params);
        });
      }

      async navigate(componentName, params) {
        // Hide all components
        this.components.forEach(comp => comp.style.display = 'none');

        // Show and activate target
        const target = this.components.get(componentName);
        target.style.display = 'block';
        await target.activate(params);
      }

      async init() {
        this.registerComponent(InkPlayerComponent);
        this.registerComponent(PacmanComponent);
        this.registerComponent(SpaceInvadersComponent);

        await this.navigate('ink-player');
      }
    }

    const app = new App();
    app.init();
  </script>
</head>
<body>
  <div id="app-container"></div>
</body>
</html>
```

---

## Conclusion

This peer architecture transforms the relationship between INK narrative and games from **parent-child hierarchy** to **collaborative peers**. Components share common infrastructure (auth, storage, networking) while maintaining independence.

The EventBus enables loose coupling - components don't need to know about each other, just the events they emit and listen for. This makes the system:
- **Extensible** - Add new components without modifying existing code
- **Maintainable** - Services isolated and testable
- **Powerful** - Cross-component features (achievements, multiplayer, etc.)
- **Flexible** - Two-way navigation (INK↔Games)

The key insight: **INK and Pacman are equals, sharing the same app-level services.**
