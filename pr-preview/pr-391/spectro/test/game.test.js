/**
 * game.test.js - Comprehensive tests for the platformer game mechanics
 * Tests physics, player movement, animations, collisions, and game state
 */

const Rooms = require('../src/rooms');
const Entities = require('../src/entities');

// Mock the modules needed for testing
jest.mock('../src/renderer', () => ({
  initialize: jest.fn(),
  renderRoom: jest.fn(),
  createAnimation: jest.fn(),
  resetAnimation: jest.fn(),
  startScreenShake: jest.fn(),
  startRoomTransition: jest.fn().mockResolvedValue(),
  setupDefaultAnimations: jest.fn(),
  playAnimation: jest.fn(),
  getCurrentFrame: jest.fn().mockReturnValue('idle_1'),
  drawSprite: jest.fn()
}));

jest.mock('../src/input', () => ({
  initialize: jest.fn(),
  isActionActive: jest.fn(),
  wasActionJustActivated: jest.fn(),
  getHorizontalAxis: jest.fn(),
  getVerticalAxis: jest.fn(),
  update: jest.fn(),
  reset: jest.fn(),
  setVibration: jest.fn()
}));

// Set up mock document and canvas
global.document = {
  getElementById: () => ({
    addEventListener: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn()
    },
    getContext: () => ({
      fillStyle: '',
      fillRect: jest.fn(),
      imageSmoothingEnabled: false,
      drawImage: jest.fn()
    }),
    width: 0,
    height: 0,
    style: {},
    textContent: ''
  }),
  createElement: () => ({
    getContext: () => ({
      fillStyle: '',
      fillRect: jest.fn(),
      drawImage: jest.fn(),
      imageSmoothingEnabled: false
    }),
    width: 0,
    height: 0
  })
};

global.performance = {
  now: () => Date.now()
};

global.requestAnimationFrame = jest.fn();

// Import SpectroJSW after setting up mocks
const SpectroJSW = require('../src/game');
const Input = require('../src/input');
const Renderer = require('../src/renderer');

describe('Enhanced Platformer Game Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Room functionality', () => {
    test('should load room data with platform types', () => {
      const testRoom = Rooms.getRoom('offLicence');
      
      expect(testRoom).not.toBeNull();
      expect(testRoom.name).toBe('The Off Licence');
      expect(testRoom.layout).toBeTruthy();
      expect(Array.isArray(testRoom.layout)).toBe(true);
      
      // Ensure platforms have types defined (normal, slope, moving)
      const platforms = testRoom.platforms || [];
      if (platforms.length > 0) {
        expect(platforms[0]).toHaveProperty('type');
      }
    });
    
    test('should navigate between rooms with transitions', () => {
      const firstRoom = 'offLicence';
      const nextRoom = Rooms.getNextRoom(firstRoom);
      const prevRoom = Rooms.getPrevRoom(nextRoom);
      
      expect(nextRoom).toBe('quirkafleeg');
      expect(prevRoom).toBe('offLicence');
      
      // Test room transition effect
      SpectroJSW.transitionToRoom(nextRoom, 'right');
      expect(Renderer.startRoomTransition).toHaveBeenCalledWith('right');
    });
  });
  
  describe('Player character functionality', () => {
    test('should create player with animation states', () => {
      const player = Entities.createPlayer(100, 100);
      
      expect(player).not.toBeNull();
      expect(player.type).toBe('player');
      expect(player.x).toBe(100);
      expect(player.y).toBe(100);
      expect(player.width).toBe(8);  // 1 char wide
      expect(player.height).toBe(16); // 2 chars high
      expect(player.animationStates).toHaveProperty('idle');
      expect(player.animationStates).toHaveProperty('walk');
      expect(player.animationStates).toHaveProperty('jump');
    });
    
    test('should handle player movement physics', () => {
      const player = Entities.createPlayer(100, 100);
      
      // Set up initial conditions
      player.vx = 0;
      player.vy = 0;
      player.onGround = true;
      
      // Mock input for movement
      Input.getHorizontalAxis.mockReturnValue(1); // Move right
      Input.wasActionJustActivated.mockReturnValue(true); // Jump
      
      // Update player physics
      Entities.updatePlayerPhysics(player, 16.67); // ~60fps
      
      // Check horizontal acceleration and movement
      expect(player.vx).toBeGreaterThan(0);
      expect(player.facingRight).toBe(true);
      
      // Check jump velocity
      expect(player.vy).toBeLessThan(0);
      expect(player.onGround).toBe(false);
      
      // Subsequent update should apply gravity
      Input.wasActionJustActivated.mockReturnValue(false);
      Entities.updatePlayerPhysics(player, 16.67);
      
      // Gravity should increase fall velocity
      expect(player.vy).toBeGreaterThan(-player.jumpVelocity);
    });
    
    test('should handle variable jump heights', () => {
      const player = Entities.createPlayer(100, 100);
      player.onGround = true;
      
      // Start jump
      Input.wasActionJustActivated.mockReturnValue(true);
      Entities.updatePlayerPhysics(player, 16.67);
      const initialJumpVelocity = player.vy;
      
      // Button released early
      Input.wasActionJustActivated.mockReturnValue(false);
      Input.isActionActive.mockReturnValue(false); // Jump button released
      Entities.updatePlayerPhysics(player, 16.67);
      
      // Variable jump should cut velocity when button released
      expect(player.vy).toBeGreaterThan(initialJumpVelocity);
      
      // Reset for second test
      player.onGround = true;
      player.vy = 0;
      
      // Start second jump
      Input.wasActionJustActivated.mockReturnValue(true);
      Entities.updatePlayerPhysics(player, 16.67);
      
      // Hold jump button
      Input.wasActionJustActivated.mockReturnValue(false);
      Input.isActionActive.mockReturnValue(true); // Jump button held
      Entities.updatePlayerPhysics(player, 16.67);
      
      // Holding jump should maintain more negative velocity
      expect(player.vy).toBeLessThan(0);
    });
  });
  
  describe('Animation system', () => {
    test('should change player animation based on state', () => {
      const player = Entities.createPlayer(100, 100);
      
      // Test idle animation
      player.vx = 0;
      player.vy = 0;
      player.onGround = true;
      Entities.updatePlayerAnimation(player);
      expect(player.currentAnimation).toBe('idle');
      
      // Test walk animation
      player.vx = 2;
      player.vy = 0;
      player.onGround = true;
      Entities.updatePlayerAnimation(player);
      expect(player.currentAnimation).toBe('walk');
      
      // Test jump animation
      player.vx = 0;
      player.vy = -5;
      player.onGround = false;
      Entities.updatePlayerAnimation(player);
      expect(player.currentAnimation).toBe('jump');
      
      // Test fall animation
      player.vx = 0;
      player.vy = 5;
      player.onGround = false;
      Entities.updatePlayerAnimation(player);
      expect(player.currentAnimation).toBe('fall');
    });
    
    test('should flip player sprite based on movement direction', () => {
      const player = Entities.createPlayer(100, 100);
      
      // Move right
      player.vx = 2;
      Entities.updatePlayerPhysics(player, 16.67);
      expect(player.facingRight).toBe(true);
      
      // Move left
      player.vx = 0; // Reset
      Input.getHorizontalAxis.mockReturnValue(-1);
      Entities.updatePlayerPhysics(player, 16.67);
      expect(player.facingRight).toBe(false);
    });
  });
  
  describe('Collision detection', () => {
    test('should detect platform collisions', () => {
      const player = Entities.createPlayer(100, 100);
      player.vy = 5; // Falling
      
      const platform = {
        x: 90,
        y: 116, // Just below player's feet
        width: 32,
        height: 8,
        type: 'platform'
      };
      
      const room = { platforms: [platform] };
      
      // Update with collision
      Entities.handlePlatformCollisions(player, room);
      
      // Player should be on ground
      expect(player.onGround).toBe(true);
      expect(player.y).toBeLessThanOrEqual(platform.y - player.height);
      expect(player.vy).toBe(0);
    });
    
    test('should handle sloped platforms', () => {
      const player = Entities.createPlayer(100, 100);
      player.vy = 5; // Falling
      
      const slopedPlatform = {
        x: 90,
        y: 116,
        width: 32,
        height: 16,
        type: 'slope',
        angle: 45 // 45 degree slope
      };
      
      const room = { platforms: [slopedPlatform] };
      
      // Update with collision
      Entities.handlePlatformCollisions(player, room);
      
      // Player should be on slope
      expect(player.onGround).toBe(true);
      // Y position should be adjusted based on slope at player's x position
      // For a 45-degree slope starting at (90,116) with player at x=100:
      // Expected y should reflect position on slope
      
      // Test walking up slope
      player.vx = 2;
      Entities.updatePlayerPhysics(player, 16.67);
      Entities.handlePlatformCollisions(player, room);
      
      // Player should remain on ground while walking up
      expect(player.onGround).toBe(true);
    });
    
    test('should handle moving platforms', () => {
      const player = Entities.createPlayer(100, 100);
      player.vy = 5; // Falling
      
      const movingPlatform = {
        x: 90,
        y: 116,
        width: 32,
        height: 8,
        type: 'moving',
        vx: 1, // Moving right
        vy: 0,
        bounds: {
          left: 90,
          right: 200,
          top: 100,
          bottom: 116
        }
      };
      
      const room = { platforms: [movingPlatform] };
      
      // Update platform position first
      Entities.updateMovingPlatforms(room, 16.67);
      expect(movingPlatform.x).toBeGreaterThan(90);
      
      // Update with collision
      Entities.handlePlatformCollisions(player, room);
      
      // Player should be on platform
      expect(player.onGround).toBe(true);
      
      // Player should inherit platform velocity
      expect(player.vx).toBeCloseTo(movingPlatform.vx);
      
      // Test platform changing directions at bounds
      movingPlatform.x = movingPlatform.bounds.right;
      Entities.updateMovingPlatforms(room, 16.67);
      expect(movingPlatform.vx).toBeLessThan(0); // Should reverse direction
    });
  });
  
  describe('Enemy and collectible interaction', () => {
    test('should collect items on collision', () => {
      const player = Entities.createPlayer(100, 100);
      
      const coin = Entities.createEntity({
        type: 'collectible',
        subtype: 'coin',
        x: 101,
        y: 101,
        width: 8,
        height: 8
      });
      
      const room = { 
        entities: [coin],
        collectibles: 1
      };
      
      // Process collision
      Entities.handleEntityCollisions(player, room);
      
      // Coin should be collected
      expect(coin.collected).toBe(true);
      expect(room.collectibles).toBe(0);
      expect(player.score).toBeGreaterThan(0);
    });
    
    test('should detect enemy collisions', () => {
      const player = Entities.createPlayer(100, 100);
      player.vy = 1; // Moving down
      
      const enemy = Entities.createEntity({
        type: 'enemy',
        subtype: 'guardian',
        x: 101,
        y: 110,
        width: 16,
        height: 16,
        deadly: true
      });
      
      const room = { entities: [enemy] };
      
      // Process collision - should kill player
      Entities.handleEntityCollisions(player, room);
      expect(player.dead).toBe(true);
      
      // Reset player
      player.dead = false;
      player.vy = 5; // Falling fast
      enemy.y = 124; // Below player
      
      // Process collision for jump-on-enemy
      Entities.handleEntityCollisions(player, room);
      
      // Should defeat enemy when player is falling onto it from above
      expect(enemy.defeated).toBe(true);
      expect(player.vy).toBeLessThan(0); // Bounce effect
      expect(player.dead).toBe(false);
    });
  });
  
  describe('Game progression', () => {
    test('should track collected items and keys', () => {
      SpectroJSW.gameState = {
        score: 0,
        lives: 3,
        keys: 0,
        roomsCleared: [],
        currentRoomId: 'offLicence'
      };
      
      // Simulate collecting a key
      SpectroJSW.collectKey();
      expect(SpectroJSW.gameState.keys).toBe(1);
      
      // Simulate using a key
      SpectroJSW.useKey();
      expect(SpectroJSW.gameState.keys).toBe(0);
      
      // Simulate clearing a room
      SpectroJSW.markRoomCleared('offLicence');
      expect(SpectroJSW.gameState.roomsCleared).toContain('offLicence');
      
      // Check if room is cleared
      expect(SpectroJSW.isRoomCleared('offLicence')).toBe(true);
      expect(SpectroJSW.isRoomCleared('anotherRoom')).toBe(false);
    });
  });
});