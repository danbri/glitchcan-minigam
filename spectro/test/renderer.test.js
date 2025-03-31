/**
 * renderer.test.js - Tests for the spectrum renderer
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
      imageSmoothingEnabled: false
    })
  })
};

describe('Spectrum Renderer', () => {
  // Mock canvas element
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      fillStyle: '',
      fillRect: jest.fn(),
      drawImage: jest.fn(),
      imageSmoothingEnabled: false
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
    
    test('should provide screen properties', () => {
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
  
  describe('Renderer module', () => {
    test('should initialize correctly', () => {
      expect(() => {
        Renderer.initialize(mockCanvas);
      }).not.toThrow();
    });
    
    test('should create animations', () => {
      Renderer.initialize(mockCanvas);
      
      expect(() => {
        Renderer.createAnimation('test', ['frame1', 'frame2'], 10, true);
      }).not.toThrow();
      
      expect(() => {
        Renderer.resetAnimation('test');
      }).not.toThrow();
    });
    
    test('should provide screen shake effect', () => {
      Renderer.initialize(mockCanvas);
      
      expect(() => {
        Renderer.startScreenShake(5, 200);
      }).not.toThrow();
    });
  });
});