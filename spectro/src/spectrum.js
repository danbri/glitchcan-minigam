/**
 * Spectrum.js - ZX Spectrum graphics emulation
 * Handles the ZX Spectrum display specifics, including:
 * - 256�192 pixel resolution
 * - 32�24 character grid (8�8 pixel characters)
 * - Color attributes per character cell (ink/paper colors + bright + flash)
 * - Implementing authentic color clash
 */

const Spectrum = (() => {
  // ZX Spectrum original resolution
  const SCREEN_WIDTH = 256;
  const SCREEN_HEIGHT = 192;
  
  // Character cell dimensions (attributes)
  const CHAR_WIDTH = 8;
  const CHAR_HEIGHT = 8;
  const ATTR_COLS = SCREEN_WIDTH / CHAR_WIDTH;   // 32
  const ATTR_ROWS = SCREEN_HEIGHT / CHAR_HEIGHT; // 24
  
  // Spectrum colors (standard 8 colors + bright variants)
  const COLORS = {
    BLACK: [0, 0, 0],
    BLUE: [0, 0, 215],
    RED: [215, 0, 0],
    MAGENTA: [215, 0, 215],
    GREEN: [0, 215, 0],
    CYAN: [0, 215, 215],
    YELLOW: [215, 215, 0],
    WHITE: [215, 215, 215],
    
    BRIGHT_BLACK: [0, 0, 0], // Black is the same in bright mode
    BRIGHT_BLUE: [0, 0, 255],
    BRIGHT_RED: [255, 0, 0],
    BRIGHT_MAGENTA: [255, 0, 255],
    BRIGHT_GREEN: [0, 255, 0],
    BRIGHT_CYAN: [0, 255, 255],
    BRIGHT_YELLOW: [255, 255, 0],
    BRIGHT_WHITE: [255, 255, 255]
  };
  
  // Store canvas and context
  let canvas, ctx;
  let screenBuffer;
  let attributeBuffer = new Array(ATTR_COLS * ATTR_ROWS);
  
  // For tracking attribute flashing
  let flashPhase = false;
  let lastFlashToggle = 0;
  
  // ASCII representation of the ZX Spectrum character set
  // 0 = background (paper), 1 = foreground (ink)
  const zxCharacters = {
    // Some common characters for games, will be expanded
    'A': [
      [0,0,1,1,1,0,0,0],
      [0,1,1,0,1,1,0,0],
      [1,1,0,0,0,1,1,0],
      [1,1,0,0,0,1,1,0],
      [1,1,1,1,1,1,1,0],
      [1,1,0,0,0,1,1,0],
      [1,1,0,0,0,1,1,0],
      [0,0,0,0,0,0,0,0]
    ],
    // Add more characters as needed...
    // Default block for player
    'PLAYER': [
      [0,1,1,1,1,1,0,0],
      [1,1,1,1,1,1,1,0],
      [1,1,0,1,0,1,1,0],
      [1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,0],
      [0,1,0,1,0,1,0,0],
      [0,1,1,0,1,1,0,0],
      [0,1,0,0,0,1,0,0]
    ],
    // Default block for enemy
    'ENEMY': [
      [0,1,0,0,0,1,0,0],
      [0,0,1,0,1,0,0,0],
      [0,1,1,1,1,1,0,0],
      [1,1,0,1,0,1,1,0],
      [1,1,1,1,1,1,1,0],
      [1,0,1,1,1,0,1,0],
      [0,0,1,0,1,0,0,0],
      [0,1,0,0,0,1,0,0]
    ],
    // Solid block (for platforms)
    'BLOCK': [
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1]
    ],
    // Collectible item
    'ITEM': [
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,1,0,0,1,1,1],
      [1,1,0,0,0,0,1,1],
      [1,1,0,0,0,0,1,1],
      [1,1,1,0,0,1,1,1],
      [0,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,0,0]
    ],
    // Subtle background patterns
    'BG_DOTS': [
      [1,0,0,0,1,0,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,1,0,0,0,1,0],
      [0,0,0,0,0,0,0,0],
      [1,0,0,0,1,0,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,1,0,0,0,1,0],
      [0,0,0,0,0,0,0,0]
    ],
    'BG_GRID': [
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,0,1,0,0,1,0,0],
      [0,0,1,0,0,1,0,0],
      [0,0,1,1,1,1,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0]
    ],
    'BG_LINES': [
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0],
      [1,1,0,0,0,0,1,1],
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0],
      [1,1,0,0,0,0,1,1],
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0]
    ],
    'BG_STARS': [
      [0,0,0,1,0,0,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,1,0,0],
      [0,0,0,0,0,0,0,0],
      [1,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,1]
    ]
  };
  
  /**
   * Initialize the Spectrum display
   * @param {HTMLCanvasElement} canvasEl - Canvas element for rendering
   * @param {number} scale - Scale factor for rendering 
   */
  function initialize(canvasEl, scale = 2) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    
    canvas.width = SCREEN_WIDTH * scale;
    canvas.height = SCREEN_HEIGHT * scale;
    
    // Create an off-screen canvas for double buffering
    screenBuffer = document.createElement('canvas');
    screenBuffer.width = SCREEN_WIDTH;
    screenBuffer.height = SCREEN_HEIGHT;
    
    const bufferCtx = screenBuffer.getContext('2d');
    bufferCtx.imageSmoothingEnabled = false;
    
    // Clear to black
    bufferCtx.fillStyle = 'rgb(0,0,0)';
    bufferCtx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    // Set up smooth disabled (for pixelated rendering)
    ctx.imageSmoothingEnabled = false;
    
    // Initialize attribute buffer (Default: black paper, white ink, no bright, no flash)
    for (let i = 0; i < ATTR_COLS * ATTR_ROWS; i++) {
      attributeBuffer[i] = {
        inkColor: 7,      // White (index into COLORS)
        paperColor: 0,    // Black (index into COLORS)
        bright: false,    // Bright attribute off
        flash: false      // Flash attribute off
      };
    }
  }
  
  /**
   * Set attribute for a specific character cell
   * @param {number} cellX - X position of cell (0-31)
   * @param {number} cellY - Y position of cell (0-23)
   * @param {number} inkColorIndex - Ink color index (0-7)
   * @param {number} paperColorIndex - Paper color index (0-7)
   * @param {boolean} bright - Bright attribute
   * @param {boolean} flash - Flash attribute
   */
  function setAttribute(cellX, cellY, inkColorIndex, paperColorIndex, bright = false, flash = false) {
    if (cellX < 0 || cellX >= ATTR_COLS || cellY < 0 || cellY >= ATTR_ROWS) {
      return; // Outside screen bounds
    }
    
    attributeBuffer[cellY * ATTR_COLS + cellX] = {
      inkColor: inkColorIndex & 7, // Ensure 0-7 range
      paperColor: paperColorIndex & 7,
      bright,
      flash
    };
  }
  
  /**
   * Set multiple attributes for a rectangle of character cells
   * @param {number} startX - Starting X position (0-31)
   * @param {number} startY - Starting Y position (0-23)
   * @param {number} width - Width in character cells
   * @param {number} height - Height in character cells
   * @param {Object} attr - Attribute object {inkColor, paperColor, bright, flash}
   */
  function setAttributeRect(startX, startY, width, height, attr) {
    for (let y = startY; y < startY + height; y++) {
      for (let x = startX; x < startX + width; x++) {
        if (x >= 0 && x < ATTR_COLS && y >= 0 && y < ATTR_ROWS) {
          attributeBuffer[y * ATTR_COLS + x] = {
            inkColor: attr.inkColor & 7,
            paperColor: attr.paperColor & 7,
            bright: !!attr.bright,
            flash: !!attr.flash
          };
        }
      }
    }
  }
  
  /**
   * Draw a character at the specified position
   * @param {number} cellX - X position in character cells (0-31)
   * @param {number} cellY - Y position in character cells (0-23)
   * @param {string|Array} char - Character to draw (from zxCharacters) or 8x8 binary array
   */
  function drawChar(cellX, cellY, char) {
    if (cellX < 0 || cellX >= ATTR_COLS || cellY < 0 || cellY >= ATTR_ROWS) {
      return; // Outside screen bounds
    }
    
    const attrIndex = cellY * ATTR_COLS + cellX;
    const attr = attributeBuffer[attrIndex];
    
    // Get the character pattern
    let pattern;
    if (Array.isArray(char)) {
      pattern = char;
    } else if (typeof char === 'string' && zxCharacters[char]) {
      pattern = zxCharacters[char];
    } else {
      return; // Invalid character
    }
    
    const bufferCtx = screenBuffer.getContext('2d');
    
    // Determine actual colors based on attributes
    let inkColorName = Object.keys(COLORS)[attr.inkColor];
    let paperColorName = Object.keys(COLORS)[attr.paperColor];
    
    // Apply brightness if set
    if (attr.bright) {
      inkColorName = 'BRIGHT_' + inkColorName;
      paperColorName = 'BRIGHT_' + paperColorName;
    }
    
    // Apply flash effect if enabled
    if (attr.flash && flashPhase) {
      // Swap ink and paper colors during flash
      [inkColorName, paperColorName] = [paperColorName, inkColorName];
    }
    
    const inkRGB = COLORS[inkColorName];
    const paperRGB = COLORS[paperColorName];
    
    const inkStyle = `rgb(${inkRGB[0]},${inkRGB[1]},${inkRGB[2]})`;
    const paperStyle = `rgb(${paperRGB[0]},${paperRGB[1]},${paperRGB[2]})`;
    
    // Draw the character pixel by pixel
    for (let y = 0; y < CHAR_HEIGHT; y++) {
      for (let x = 0; x < CHAR_WIDTH; x++) {
        const pixelValue = pattern[y][x];
        
        bufferCtx.fillStyle = pixelValue ? inkStyle : paperStyle;
        bufferCtx.fillRect(
          cellX * CHAR_WIDTH + x,
          cellY * CHAR_HEIGHT + y,
          1, 1
        );
      }
    }
  }
  
  /**
   * Draw sprite at pixel position, handling color clash
   * @param {number} x - X position in pixels (0-255)
   * @param {number} y - Y position in pixels (0-191)
   * @param {string|Array} sprite - Sprite pattern (8x8 array or named character)
   * @param {number} inkColorIndex - Ink color for the sprite (0-7)
   * @param {boolean} bright - Whether to use bright color variant
   */
  function drawSprite(x, y, sprite, inkColorIndex = 7, bright = false) {
    // Calculate affected character cells
    const startCellX = Math.floor(x / CHAR_WIDTH);
    const startCellY = Math.floor(y / CHAR_HEIGHT);
    
    // Get sprite pattern
    let pattern;
    if (Array.isArray(sprite)) {
      pattern = sprite;
    } else if (typeof sprite === 'string' && zxCharacters[sprite]) {
      pattern = zxCharacters[sprite];
    } else {
      return; // Invalid sprite
    }
    
    // Update attributes for affected cells (implementing color clash)
    // In a real ZX Spectrum, this would be handled differently, but this simulates the effect
    for (let cellY = startCellY; cellY < startCellY + 1; cellY++) {
      for (let cellX = startCellX; cellX < startCellX + 1; cellX++) {
        if (cellX >= 0 && cellX < ATTR_COLS && cellY >= 0 && cellY < ATTR_ROWS) {
          const attrIndex = cellY * ATTR_COLS + cellX;
          attributeBuffer[attrIndex].inkColor = inkColorIndex;
          attributeBuffer[attrIndex].bright = bright;
        }
      }
    }
    
    // Draw the sprite using character cell attributes (color clash effect)
    const bufferCtx = screenBuffer.getContext('2d');
    
    // For each pixel in the sprite
    for (let sy = 0; sy < CHAR_HEIGHT; sy++) {
      for (let sx = 0; sx < CHAR_WIDTH; sx++) {
        const pixelX = x + sx;
        const pixelY = y + sy;
        
        // Skip if outside screen bounds
        if (pixelX < 0 || pixelX >= SCREEN_WIDTH || pixelY < 0 || pixelY >= SCREEN_HEIGHT) {
          continue;
        }
        
        // Calculate which character cell this pixel belongs to
        const cellX = Math.floor(pixelX / CHAR_WIDTH);
        const cellY = Math.floor(pixelY / CHAR_HEIGHT);
        const attrIndex = cellY * ATTR_COLS + cellX;
        const attr = attributeBuffer[attrIndex];
        
        // Only draw if the sprite pixel is set
        if (pattern[sy] && pattern[sy][sx]) {
          // Determine color based on attribute
          let inkColorName = Object.keys(COLORS)[attr.inkColor];
          
          // Apply brightness if set
          if (attr.bright) {
            inkColorName = 'BRIGHT_' + inkColorName;
          }
          
          // Apply flash effect if enabled
          if (attr.flash && flashPhase) {
            inkColorName = attr.paperColor;
            
            if (attr.bright) {
              inkColorName = 'BRIGHT_' + inkColorName;
            }
          }
          
          const inkRGB = COLORS[inkColorName];
          bufferCtx.fillStyle = `rgb(${inkRGB[0]},${inkRGB[1]},${inkRGB[2]})`;
          bufferCtx.fillRect(pixelX, pixelY, 1, 1);
        }
      }
    }
  }
  
  /**
   * Fill a character cell with a solid color
   * @param {number} cellX - X position in character cells
   * @param {number} cellY - Y position in character cells
   */
  function fillChar(cellX, cellY) {
    if (cellX < 0 || cellX >= ATTR_COLS || cellY < 0 || cellY >= ATTR_ROWS) {
      return; // Outside screen bounds
    }
    
    const attrIndex = cellY * ATTR_COLS + cellX;
    const attr = attributeBuffer[attrIndex];
    
    const bufferCtx = screenBuffer.getContext('2d');
    
    // Use paper color to fill
    let paperColorName = Object.keys(COLORS)[attr.paperColor];
    
    // Apply brightness if set
    if (attr.bright) {
      paperColorName = 'BRIGHT_' + paperColorName;
    }
    
    const paperRGB = COLORS[paperColorName];
    bufferCtx.fillStyle = `rgb(${paperRGB[0]},${paperRGB[1]},${paperRGB[2]})`;
    bufferCtx.fillRect(
      cellX * CHAR_WIDTH,
      cellY * CHAR_HEIGHT,
      CHAR_WIDTH,
      CHAR_HEIGHT
    );
  }
  
  /**
   * Clear the entire screen with specified paper color and attributes
   * @param {number} paperColorIndex - Paper color index (0-7)
   * @param {boolean} bright - Whether to use bright colors
   */
  function clearScreen(paperColorIndex = 0, bright = false) {
    const bufferCtx = screenBuffer.getContext('2d');
    
    // Determine the background color
    let colorName = Object.keys(COLORS)[paperColorIndex & 7];
    
    if (bright) {
      colorName = 'BRIGHT_' + colorName;
    }
    
    const colorRGB = COLORS[colorName];
    bufferCtx.fillStyle = `rgb(${colorRGB[0]},${colorRGB[1]},${colorRGB[2]})`;
    bufferCtx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    // Reset attributes
    for (let i = 0; i < ATTR_COLS * ATTR_ROWS; i++) {
      attributeBuffer[i] = {
        inkColor: 7,               // White ink
        paperColor: paperColorIndex & 7,
        bright: bright,
        flash: false
      };
    }
  }
  
  /**
   * Update the display (handle flashing attributes and render to canvas)
   * @param {number} timestamp - Current timestamp for animations
   */
  function update(timestamp) {
    // Handle flash attribute (toggle every ~0.5 seconds)
    if (timestamp - lastFlashToggle > 500) {
      flashPhase = !flashPhase;
      lastFlashToggle = timestamp;
      
      // Redraw any flashing cells
      const bufferCtx = screenBuffer.getContext('2d');
      
      for (let y = 0; y < ATTR_ROWS; y++) {
        for (let x = 0; x < ATTR_COLS; x++) {
          const attrIndex = y * ATTR_COLS + x;
          if (attributeBuffer[attrIndex].flash) {
            // We'd need to redraw the content of the cell here
            // For simplicity, we'll just fill with the paper color
            fillChar(x, y);
          }
        }
      }
    }
    
    // Render screen buffer to main canvas (scaled)
    ctx.drawImage(
      screenBuffer,
      0, 0, SCREEN_WIDTH, SCREEN_HEIGHT,
      0, 0, canvas.width, canvas.height
    );
  }
  
  /**
   * Add a new character pattern to the character set
   * @param {string} name - Name/identifier for the character
   * @param {Array} pattern - 8x8 binary array representing the character
   */
  function defineCharacter(name, pattern) {
    if (pattern.length !== 8) {
      console.error('Character pattern must be 8x8');
      return;
    }
    
    zxCharacters[name] = pattern;
  }
  
  /**
   * Draw text using the ZX character set
   * @param {number} cellX - Starting X position in cells
   * @param {number} cellY - Y position in cells
   * @param {string} text - Text to draw
   */
  function drawText(cellX, cellY, text) {
    // For each character in the text
    for (let i = 0; i < text.length; i++) {
      const char = text[i].toUpperCase();
      
      // Skip if character isn't defined
      if (!zxCharacters[char]) continue;
      
      // Draw the character
      drawChar(cellX + i, cellY, char);
    }
  }
  
  /**
   * Get screen dimensions and properties
   * @returns {Object} Object containing screen dimensions and properties
   */
  function getScreenProperties() {
    return {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      cellWidth: CHAR_WIDTH,
      cellHeight: CHAR_HEIGHT,
      cols: ATTR_COLS,
      rows: ATTR_ROWS
    };
  }
  
  return {
    initialize,
    setAttribute,
    setAttributeRect,
    drawChar,
    drawSprite,
    clearScreen,
    update,
    defineCharacter,
    drawText,
    getScreenProperties,
    COLORS
  };
})();

// For use in Node.js environment (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Spectrum;
}