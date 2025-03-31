/**
 * game.test.js - Tests for the main game logic
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
  setupDefaultAnimations: jest.fn()
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
      remove: jest.fn()
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

describe('Game Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Room functionality', () => {
    test('should load room data', () => {
      const offLicence = Rooms.getRoom('offLicence');
      
      expect(offLicence).not.toBeNull();
      expect(offLicence.name).toBe('The Off Licence');
      expect(offLicence.layout).toBeTruthy();
      expect(Array.isArray(offLicence.layout)).toBe(true);
      expect(offLicence.rightExit).toBe('quirkafleeg');
    });
    
    test('should navigate between rooms', () => {
      const firstRoom = 'offLicence';
      const nextRoom = Rooms.getNextRoom(firstRoom);
      const prevRoom = Rooms.getPrevRoom(nextRoom);
      
      expect(nextRoom).toBe('quirkafleeg');
      expect(prevRoom).toBe('offLicence');
    });
    
    test('should return valid room count', () => {
      expect(Rooms.getRoomCount()).toBeGreaterThan(0);
    });
  });
  
  describe('Entity functionality', () => {
    test('should create player entity', () => {
      const player = Entities.createPlayer(100, 100);
      
      expect(player).not.toBeNull();
      expect(player.type).toBe('player');
      expect(player.x).toBe(100);
      expect(player.y).toBe(100);
      expect(player.vx).toBe(0);
      expect(player.vy).toBe(0);
    });
    
    test('should create game entities', () => {
      const collectible = Entities.createEntity({
        type: 'collectible',
        id: 'coin1',
        x: 150,
        y: 100
      });
      
      expect(collectible).not.toBeNull();
      expect(collectible.type).toBe('collectible');
      expect(collectible.id).toBe('coin1');
      expect(collectible.x).toBe(150);
      expect(collectible.y).toBe(100);
    });
    
    test('should check entity collisions', () => {
      // Create player
      const player = Entities.createPlayer(100, 100);
      
      // Create collectible in the same location
      const collectible = Entities.createEntity({
        type: 'collectible',
        id: 'coin1',
        x: 100,
        y: 100,
        width: 8,
        height: 8
      });
      
      // Check collision
      const isColliding = Entities.isColliding(player, collectible);
      expect(isColliding).toBe(true);
      
      // Move entity away
      collectible.x = 200;
      const isCollidingAfterMove = Entities.isColliding(player, collectible);
      expect(isCollidingAfterMove).toBe(false);
    });
  });
  
  describe('Game initialization', () => {
    test('should initialize the game', () => {
      expect(() => {
        SpectroJSW.init();
      }).not.toThrow();
    });
  });
});