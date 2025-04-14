/**
 * renderer.test.js - Tests for the enhanced spectrum renderer
 * Tests animation system, sprite flipping, and special effects
 */

const Spectrum = require('../src/spectrum');
const Renderer = require('../src/renderer');

// Mock canvas and context for testing
global.document = {
  createElement: () => ({
    getContext: () => ({
      fillStyle: '',
      fillRect: jest.fn(),
      drawImage: jest.fn(),
      imageSmoothingEnabled: false,
      save: jest.fn(),
      restore: jest.fn(),
      scale: jest.fn(),
      translate: jest.fn()
    })
  }),
  getElementById: () => ({
    getContext: () => ({
      fillStyle: '',
      fillRect: jest.fn(),
      drawImage: jest.fn(),
      imageSmoothingEnabled: false,
      save: jest.fn(),
      restore: jest.fn(),
      scale: jest.fn(),
      translate: jest.fn()
    }),
    width: 256,
    height: 192
  })
};

describe('Enhanced Spectrum Renderer', () => {
  // Mock canvas element
  const mockCanvas = {
    width: 256,
    height: 192,
    getContext: () => ({
      fillStyle: '',
      fillRect: jest.fn(),
      drawImage: jest.fn(),
      imageSmoothingEnabled: false,
      save: jest.fn(),
      restore: jest.fn(),
      scale: jest.fn(),
      translate: jest.fn()
    }),
    style: {}
  };
  
  beforeEach(() => {
    // Reset mocks between tests
    jest.clearAllMocks();
  });
  
  describe('Spectrum module', () => {
    test('should initialize with correct dimensions', () => {
      Spectrum.initialize(mockCanvas);
      expect(mockCanvas.width).toBeGreaterThan(0);
      expect(mockCanvas.height).toBeGreaterThan(0);
    });
    
    test('should provide screen properties with character dimensions', () => {
      const props = Spectrum.getScreenProperties();
      expect(props.width).toBe(256);
      expect(props.height).toBe(192);
      expect(props.cellWidth).toBe(8);
      expect(props.cellHeight).toBe(8);
      expect(props.cols).toBe(32);
      expect(props.rows).toBe(24);
    });
    
    test('should define ZX Spectrum colors', () => {
      expect(Spectrum.COLORS.BLACK).toEqual([0, 0, 0]);
      expect(Spectrum.COLORS.BRIGHT_CYAN).toEqual([0, 255, 255]);
      expect(Spectrum.COLORS.RED).toEqual([215, 0, 0]);
    });
  });
  
  describe('Sprite rendering', () => {
    beforeEach(() => {
      Renderer.initialize(mockCanvas);
    });
    
    test('should define sprite data for player animations', () => {
      // Check that sprite definitions exist for player animations
      expect(Renderer.SPRITES).toBeDefined();
      expect(Renderer.SPRITES.player_idle_1).toBeDefined();
      expect(Renderer.SPRITES.player_walk_1).toBeDefined();
      expect(Renderer.SPRITES.player_walk_2).toBeDefined();
      expect(Renderer.SPRITES.player_jump).toBeDefined();
      expect(Renderer.SPRITES.player_fall).toBeDefined();
    });
    
    test('should create multi-frame animations', () => {
      const animationName = 'player_walk';
      const frameKeys = ['player_walk_1', 'player_walk_2', 'player_walk_3', 'player_walk_4'];
      const frameTime = 120; // ms per frame
      const isLooping = true;
      
      Renderer.createAnimation(animationName, frameKeys, frameTime, isLooping);
      
      // Check that animation was created correctly
      expect(Renderer.animations[animationName]).toBeDefined();
      expect(Renderer.animations[animationName].frames).toEqual(frameKeys);
      expect(Renderer.animations[animationName].frameTime).toBe(frameTime);
      expect(Renderer.animations[animationName].isLooping).toBe(isLooping);
    });
    
    test('should reset animation to first frame', () => {
      // Create animation
      const animationName = 'test_animation';
      Renderer.createAnimation(animationName, ['frame1', 'frame2'], 100, true);
      
      // Set current frame index to something other than 0
      Renderer.animations[animationName].currentFrameIndex = 1;
      Renderer.animations[animationName].frameTimeAccumulator = 50;
      
      // Reset animation
      Renderer.resetAnimation(animationName);
      
      // Check that animation was reset
      expect(Renderer.animations[animationName].currentFrameIndex).toBe(0);
      expect(Renderer.animations[animationName].frameTimeAccumulator).toBe(0);
    });
    
    test('should update animation frames based on elapsed time', () => {
      // Create animation
      const animationName = 'test_animation';
      Renderer.createAnimation(animationName, ['frame1', 'frame2'], 100, true);
      
      // Update animation with deltaTime
      Renderer.updateAnimation(animationName, 150); // More than one frame duration
      
      // Check that frame advanced
      expect(Renderer.animations[animationName].currentFrameIndex).toBe(1);
      
      // Update again to test looping
      Renderer.updateAnimation(animationName, 150);
      
      // Should loop back to first frame
      expect(Renderer.animations[animationName].currentFrameIndex).toBe(0);
    });
    
    test('should draw sprites with correct orientation', () => {
      const ctx = mockCanvas.getContext();
      const spriteKey = 'player_idle_1';
      const x = 100;
      const y = 100;
      
      // Draw normally (facing right)
      Renderer.drawSprite(ctx, spriteKey, x, y, true);
      
      // Should call save, translate, scale, drawImage, restore
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.drawImage).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      
      // Reset mocks
      jest.clearAllMocks();
      
      // Draw flipped (facing left)
      Renderer.drawSprite(ctx, spriteKey, x, y, false);
      
      // Should use scale(-1, 1) to flip horizontally
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
      expect(ctx.drawImage).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });
  });
  
  describe('Special effects', () => {
    beforeEach(() => {
      Renderer.initialize(mockCanvas);
    });
    
    test('should provide screen shake effect', () => {
      const intensity = 5;
      const duration = 200;
      
      Renderer.startScreenShake(intensity, duration);
      
      // Check that screen shake parameters are set
      expect(Renderer.screenShake.active).toBe(true);
      expect(Renderer.screenShake.intensity).toBe(intensity);
      expect(Renderer.screenShake.duration).toBe(duration);
      expect(Renderer.screenShake.elapsed).toBe(0);
    });
    
    test('should handle room transitions with effects', () => {
      const transitionType = 'right'; // transitioning to room on the right
      
      const transitionPromise = Renderer.startRoomTransition(transitionType);
      
      // Check that transition is active
      expect(Renderer.transition.active).toBe(true);
      expect(Renderer.transition.type).toBe(transitionType);
      expect(Renderer.transition.progress).toBe(0);
      
      // Should return a promise that resolves when complete
      expect(transitionPromise).toBeInstanceOf(Promise);
    });
    
    test('should update screen shake effect based on time', () => {
      // Start screen shake
      Renderer.startScreenShake(5, 200);
      
      // Update with partial time
      Renderer.updateScreenShake(100);
      
      // Should still be active
      expect(Renderer.screenShake.active).toBe(true);
      expect(Renderer.screenShake.elapsed).toBe(100);
      
      // Update with remaining time
      Renderer.updateScreenShake(150);
      
      // Should be finished
      expect(Renderer.screenShake.active).toBe(false);
    });
    
    test('should handle parallax backgrounds', () => {
      // Setup room with parallax layers
      const room = {
        background: {
          layers: [
            { imageKey: 'bg_layer1', parallaxFactor: 0.2 },
            { imageKey: 'bg_layer2', parallaxFactor: 0.5 }
          ]
        }
      };
      
      // Get mock context
      const ctx = mockCanvas.getContext();
      
      // Render parallax layers
      Renderer.renderParallaxBackground(ctx, room, { x: 50, y: 30 });
      
      // Should have called drawImage for each layer
      expect(ctx.drawImage).toHaveBeenCalledTimes(room.background.layers.length);
    });
  });
  
  describe('Advanced rendering features', () => {
    beforeEach(() => {
      Renderer.initialize(mockCanvas);
    });
    
    test('should render sloped platforms correctly', () => {
      const ctx = mockCanvas.getContext();
      
      const slopedPlatform = {
        x: 100,
        y: 100,
        width: 40,
        height: 20,
        type: 'slope',
        angle: 45
      };
      
      Renderer.renderPlatform(ctx, slopedPlatform);
      
      // Should have used path drawing commands for slopes
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });
    
    test('should render character with correct animation frame', () => {
      const ctx = mockCanvas.getContext();
      
      // Create player entity with animation state
      const player = {
        x: 100,
        y: 100,
        width: 8,
        height: 16,
        currentAnimation: 'walk',
        facingRight: true
      };
      
      // Create animation
      Renderer.createAnimation('walk', ['player_walk_1', 'player_walk_2'], 100, true);
      
      // Render player
      Renderer.renderPlayer(ctx, player);
      
      // Should call drawSprite with correct parameters
      expect(ctx.drawImage).toHaveBeenCalled();
    });
    
    test('should apply color attributes in ZX Spectrum style', () => {
      const ctx = mockCanvas.getContext();
      
      // Create a room with color attributes
      const room = {
        colorAttributes: [
          { x: 0, y: 0, ink: 'BRIGHT_WHITE', paper: 'BLUE' },
          { x: 1, y: 0, ink: 'YELLOW', paper: 'BLACK' }
        ]
      };
      
      // Render attributes
      Renderer.renderColorAttributes(ctx, room);
      
      // Should have filled rectangles for each attribute
      expect(ctx.fillStyle).toHaveBeenCalled;
      expect(ctx.fillRect).toHaveBeenCalledTimes(room.colorAttributes.length * 2); // One for paper, one for ink pattern
    });
  });
});