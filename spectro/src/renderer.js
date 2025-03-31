/**
 * Renderer.js - Game rendering system
 * Handles rendering game objects using the Spectrum graphics system
 * Manages room transitions, sprite animations, and visual effects
 */

const Renderer = (() => {
  // Constants
  const BORDER_WIDTH = 4;  // Border width in character cells
  
  // Renderer state
  let canvas, screenProps;
  let roomTransitionActive = false;
  let transitionProgress = 0;
  
  // Sprite animation tracking
  const spriteAnimations = {};
  
  // Screen shake effect
  let screenShake = {
    active: false,
    intensity: 0,
    duration: 0,
    startTime: 0
  };
  
  /**
   * Initialize the renderer
   * @param {HTMLCanvasElement} canvasEl - Canvas element to render to
   */
  function initialize(canvasEl) {
    canvas = canvasEl;
    
    // Initialize the Spectrum display
    Spectrum.initialize(canvas, 2);
    screenProps = Spectrum.getScreenProperties();
    
    // Define additional characters for the game
    defineGameCharacters();
  }
  
  /**
   * Define custom characters needed for the game
   */
  function defineGameCharacters() {
    // Define player animations
    Spectrum.defineCharacter('PLAYER_STAND', [
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [0,1,0,1,0,1,1,0],
      [0,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,0,0],
      [0,0,1,0,0,1,0,0],
      [0,0,1,0,0,1,0,0],
      [0,0,1,1,0,1,1,0]
    ]);
    
    Spectrum.defineCharacter('PLAYER_WALK1', [
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [0,1,0,1,0,1,1,0],
      [0,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,0,0],
      [0,0,1,0,0,1,0,0],
      [0,1,0,0,0,0,1,0],
      [1,0,0,0,0,0,0,1]
    ]);
    
    Spectrum.defineCharacter('PLAYER_WALK2', [
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [0,1,0,1,0,1,1,0],
      [0,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,0,0],
      [0,0,1,0,1,0,0,0],
      [0,1,0,0,0,1,0,0],
      [0,1,0,0,0,0,1,0]
    ]);
    
    Spectrum.defineCharacter('PLAYER_JUMP', [
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [0,1,0,1,0,1,1,0],
      [0,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,0,0],
      [0,1,0,1,0,1,0,0],
      [1,0,0,0,0,0,1,0],
      [0,0,0,0,0,0,0,0]
    ]);
    
    // Define different platform types
    Spectrum.defineCharacter('PLATFORM_SOLID', [
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1]
    ]);
    
    Spectrum.defineCharacter('PLATFORM_BRICK', [
      [1,1,1,1,1,1,1,1],
      [1,0,0,1,0,0,1,0],
      [1,0,0,1,0,0,1,0],
      [1,1,1,1,1,1,1,1],
      [0,1,0,0,1,0,0,1],
      [0,1,0,0,1,0,0,1],
      [1,1,1,1,1,1,1,1],
      [1,0,0,1,0,0,1,0]
    ]);
    
    Spectrum.defineCharacter('PLATFORM_TILES', [
      [1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,0,1],
      [1,0,1,0,0,1,0,1],
      [1,0,1,0,0,1,0,1],
      [1,0,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1]
    ]);
    
    // Define enemies
    Spectrum.defineCharacter('ENEMY_GUARDIAN1', [
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,0,1,1,0,1,0],
      [0,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,0],
      [0,1,0,1,1,0,1,0],
      [0,0,1,0,0,1,0,0],
      [0,0,1,0,0,1,0,0]
    ]);
    
    Spectrum.defineCharacter('ENEMY_GUARDIAN2', [
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,0,1,1,0,1,0],
      [0,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,0],
      [0,1,0,1,1,0,1,0],
      [0,1,0,0,0,0,1,0],
      [1,0,0,0,0,0,0,1]
    ]);
    
    // Define collectibles
    Spectrum.defineCharacter('COLLECTIBLE', [
      [0,0,1,1,1,1,0,0],
      [0,1,0,0,0,0,1,0],
      [1,0,1,0,0,1,0,1],
      [1,0,0,1,1,0,0,1],
      [1,0,0,1,1,0,0,1],
      [1,0,1,0,0,1,0,1],
      [0,1,0,0,0,0,1,0],
      [0,0,1,1,1,1,0,0]
    ]);
    
    // Define special tiles
    Spectrum.defineCharacter('HAZARD', [
      [1,0,0,0,0,0,0,1],
      [0,1,0,0,0,0,1,0],
      [0,0,1,0,0,1,0,0],
      [0,0,0,1,1,0,0,0],
      [0,0,0,1,1,0,0,0],
      [0,0,1,0,0,1,0,0],
      [0,1,0,0,0,0,1,0],
      [1,0,0,0,0,0,0,1]
    ]);
    
    Spectrum.defineCharacter('KEY', [
      [0,0,0,1,1,0,0,0],
      [0,0,1,0,0,1,0,0],
      [0,0,1,0,0,1,0,0],
      [0,0,1,1,1,1,0,0],
      [0,0,0,0,0,1,0,0],
      [0,0,0,0,1,0,0,0],
      [0,0,0,0,1,0,0,0],
      [0,0,0,0,1,0,0,0]
    ]);
    
    Spectrum.defineCharacter('DOOR', [
      [0,1,1,1,1,1,1,0],
      [1,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,0,1],
      [1,0,1,0,0,1,0,1],
      [1,0,1,0,0,1,0,1],
      [1,0,1,0,0,1,0,1],
      [1,0,0,0,0,0,0,1],
      [0,1,1,1,1,1,1,0]
    ]);
    
    // Define alphabetical characters for text
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    // For text (simplified for brevity in this example - would be more complete in real implementation)
    // In real implementation, would define all characters or load from a bitmap font
    for (let i = 0; i < alphabet.length; i++) {
      if (!Spectrum.zxCharacters || !Spectrum.zxCharacters[alphabet[i]]) {
        // Simple fallback for letters that aren't defined
        Spectrum.defineCharacter(alphabet[i], [
          [0,0,1,1,1,1,0,0],
          [0,1,0,0,0,0,1,0],
          [0,1,0,0,0,0,1,0],
          [0,1,0,0,0,0,1,0],
          [0,1,0,0,0,0,1,0],
          [0,1,0,0,0,0,1,0],
          [0,1,0,0,0,0,1,0],
          [0,0,1,1,1,1,0,0]
        ]);
      }
    }
  }
  
  /**
   * Create a sprite animation
   * @param {string} id - Unique identifier for the animation
   * @param {Array} frames - Array of frame names
   * @param {number} frameRate - Frames per second
   * @param {boolean} loop - Whether the animation should loop
   */
  function createAnimation(id, frames, frameRate = 8, loop = true) {
    spriteAnimations[id] = {
      frames,
      frameRate,
      frameDuration: 1000 / frameRate,
      loop,
      currentFrame: 0,
      lastFrameTime: 0,
      finished: false
    };
  }
  
  /**
   * Get the current frame for an animation
   * @param {string} animId - Animation ID
   * @param {number} timestamp - Current timestamp
   * @returns {string} Current frame name
   */
  function getAnimationFrame(animId, timestamp) {
    const anim = spriteAnimations[animId];
    if (!anim) return null;
    
    // If the animation is finished and doesn't loop, return the last frame
    if (anim.finished && !anim.loop) {
      return anim.frames[anim.frames.length - 1];
    }
    
    // Calculate frame based on time
    const elapsed = timestamp - anim.lastFrameTime;
    
    if (elapsed >= anim.frameDuration) {
      // Advance frame
      anim.currentFrame = (anim.currentFrame + 1) % anim.frames.length;
      anim.lastFrameTime = timestamp;
      
      // Check if non-looping animation is finished
      if (anim.currentFrame === 0 && !anim.loop) {
        anim.finished = true;
        anim.currentFrame = anim.frames.length - 1;
      }
    }
    
    return anim.frames[anim.currentFrame];
  }
  
  /**
   * Reset an animation to its first frame
   * @param {string} animId - Animation ID
   */
  function resetAnimation(animId) {
    const anim = spriteAnimations[animId];
    if (anim) {
      anim.currentFrame = 0;
      anim.lastFrameTime = 0;
      anim.finished = false;
    }
  }
  
  /**
   * Render subtle background patterns
   * @param {Object} room - Room data with background theme
   */
  function renderBackgroundPatterns(room) {
    const bgColorIndex = room.backgroundColor || 0;
    
    // Add subtle background patterns based on room theme
    for (let y = 2; y < 22; y++) {
      for (let x = 2; x < 30; x++) {
        // Skip cells that will contain gameplay elements
        if (room.layout[y-2] && room.layout[y-2][x-2] !== 0) {
          continue;
        }
        
        // Only add background to some cells for a sparse effect
        if ((x + y) % 7 === 0) {
          // Choose a pattern based on room theme and position
          let pattern;
          const patternIndex = (x * y) % 4;
          
          switch (patternIndex) {
            case 0: pattern = 'BG_DOTS'; break;
            case 1: pattern = 'BG_STARS'; break;
            case 2: pattern = 'BG_LINES'; break;
            case 3: pattern = 'BG_GRID'; break;
          }
          
          // Set a very subtle attribute for the background
          // Low contrast against the background color
          let inkColor = (bgColorIndex + 2) % 8;
          if (inkColor === bgColorIndex) inkColor = (inkColor + 1) % 8;
          
          // Apply with low-intensity ink color - very subtle
          Spectrum.setAttribute(x, y, inkColor, bgColorIndex, false, false);
          Spectrum.drawChar(x, y, pattern);
        }
      }
    }
  }
  
  /**
   * Render a game room
   * @param {Object} room - Room data
   * @param {Array} entities - Entities in the room
   * @param {Object} player - Player data
   * @param {number} timestamp - Current timestamp
   */
  function renderRoom(room, entities, player, timestamp) {
    // Clear screen with room background color
    const bgColorIndex = room.backgroundColor || 0;
    const bgBright = room.backgroundBright || false;
    Spectrum.clearScreen(bgColorIndex, bgBright);
    
    // Add subtle background patterns
    renderBackgroundPatterns(room);
    
    // Set up standard border attributes
    const borderAttr = {
      inkColor: 6, // Yellow
      paperColor: bgColorIndex,
      bright: true,
      flash: false
    };
    
    // Apply border attributes
    // Top and bottom borders
    for (let x = 0; x < screenProps.cols; x++) {
      Spectrum.setAttribute(x, 0, borderAttr.inkColor, borderAttr.paperColor, borderAttr.bright, borderAttr.flash);
      Spectrum.setAttribute(x, 1, borderAttr.inkColor, borderAttr.paperColor, borderAttr.bright, borderAttr.flash);
      Spectrum.setAttribute(x, screenProps.rows - 2, borderAttr.inkColor, borderAttr.paperColor, borderAttr.bright, borderAttr.flash);
      Spectrum.setAttribute(x, screenProps.rows - 1, borderAttr.inkColor, borderAttr.paperColor, borderAttr.bright, borderAttr.flash);
    }
    
    // Left and right borders
    for (let y = 0; y < screenProps.rows; y++) {
      Spectrum.setAttribute(0, y, borderAttr.inkColor, borderAttr.paperColor, borderAttr.bright, borderAttr.flash);
      Spectrum.setAttribute(1, y, borderAttr.inkColor, borderAttr.paperColor, borderAttr.bright, borderAttr.flash);
      Spectrum.setAttribute(screenProps.cols - 2, y, borderAttr.inkColor, borderAttr.paperColor, borderAttr.bright, borderAttr.flash);
      Spectrum.setAttribute(screenProps.cols - 1, y, borderAttr.inkColor, borderAttr.paperColor, borderAttr.bright, borderAttr.flash);
    }
    
    // Render room name in top border
    const roomName = room.name.toUpperCase();
    const nameStartX = Math.floor((screenProps.cols - roomName.length) / 2);
    
    for (let i = 0; i < roomName.length; i++) {
      const x = nameStartX + i;
      if (x >= 0 && x < screenProps.cols) {
        const char = roomName[i];
        Spectrum.drawChar(x, 1, char);
      }
    }
    
    // Render platform tiles
    for (let y = 0; y < room.layout.length; y++) {
      for (let x = 0; x < room.layout[y].length; x++) {
        const tileType = room.layout[y][x];
        if (tileType === 0) continue; // Empty space
        
        const cellX = x + BORDER_WIDTH; // Offset by border
        const cellY = y + BORDER_WIDTH;
        
        // Skip if outside screen bounds
        if (cellX < 0 || cellX >= screenProps.cols || cellY < 0 || cellY >= screenProps.rows) {
          continue;
        }
        
        // Set attributes and draw the appropriate character based on tile type
        switch (tileType) {
          case 1: // Floor
            Spectrum.setAttribute(cellX, cellY, 5, 0, true, false); // Cyan ink, black paper, bright
            Spectrum.drawChar(cellX, cellY, 'PLATFORM_SOLID');
            break;
          case 2: // Wall
            Spectrum.setAttribute(cellX, cellY, 6, 0, true, false); // Yellow ink, black paper, bright
            Spectrum.drawChar(cellX, cellY, 'PLATFORM_BRICK');
            break;
          case 3: // Hazard
            Spectrum.setAttribute(cellX, cellY, 2, 0, true, false); // Red ink, black paper, bright
            Spectrum.drawChar(cellX, cellY, 'HAZARD');
            break;
          case 4: // Special
            Spectrum.setAttribute(cellX, cellY, 3, 0, true, false); // Magenta ink, black paper, bright
            Spectrum.drawChar(cellX, cellY, 'PLATFORM_TILES');
            break;
          default:
            if (tileType >= 5) {
              // Custom tiles can be added here
              const colorIndex = (tileType - 5) % 7 + 1; // Avoid black (0)
              Spectrum.setAttribute(cellX, cellY, colorIndex, 0, true, false);
              Spectrum.drawChar(cellX, cellY, 'PLATFORM_TILES');
            }
            break;
        }
      }
    }
    
    // Render entities (collectibles, enemies, doors, etc.)
    for (const entity of entities) {
      // Skip if entity is not visible
      if (entity.hidden) continue;
      
      // Convert pixel coordinates to character cell coordinates
      const cellX = Math.floor(entity.x / screenProps.cellWidth);
      const cellY = Math.floor(entity.y / screenProps.cellHeight);
      
      // Skip if outside screen bounds
      if (cellX < 0 || cellX >= screenProps.cols || cellY < 0 || cellY >= screenProps.rows) {
        continue;
      }
      
      // Set attributes and draw based on entity type
      switch (entity.type) {
        case 'collectible':
          Spectrum.setAttribute(cellX, cellY, 7, 0, true, false); // White ink, black paper, bright
          Spectrum.drawChar(cellX, cellY, 'COLLECTIBLE');
          break;
        case 'enemy':
        case 'guardian':
          // Animate guardians
          const guardianFrame = entity.direction > 0 ? 
            'ENEMY_GUARDIAN1' : 'ENEMY_GUARDIAN2';
          Spectrum.setAttribute(cellX, cellY, 2, 0, true, false); // Red ink, black paper, bright
          Spectrum.drawChar(cellX, cellY, guardianFrame);
          break;
        case 'door':
          Spectrum.setAttribute(cellX, cellY, 5, 0, entity.locked ? false : true, false);
          Spectrum.drawChar(cellX, cellY, 'DOOR');
          break;
        case 'key':
          Spectrum.setAttribute(cellX, cellY, 6, 0, true, true); // Yellow with flash
          Spectrum.drawChar(cellX, cellY, 'KEY');
          break;
        case 'background':
          // Draw background decoration elements using Spectrum patterns instead of emojis
          let patternName;
          switch (entity.patternIndex || Math.floor(Math.random() * 4)) {
            case 0: patternName = 'BG_DOTS'; break;
            case 1: patternName = 'BG_STARS'; break;
            case 2: patternName = 'BG_LINES'; break;
            case 3: patternName = 'BG_GRID'; break;
            default: patternName = 'BG_DOTS';
          }
          
          // Use entity color or a default
          const colorIdx = entity.colorIndex || (cellX + cellY) % 6 + 1; // 1-7 (avoiding black)
          const isBright = entity.bright || false;
          
          // Use low-intensity for background elements to make them subtle
          Spectrum.setAttribute(cellX, cellY, colorIdx, 0, isBright, false);
          Spectrum.drawChar(cellX, cellY, patternName);
          break;
        // Add more entity types as needed
      }
    }
    
    // Render player
    const playerCellX = Math.floor(player.x / screenProps.cellWidth);
    const playerCellY = Math.floor(player.y / screenProps.cellHeight);
    
    // Determine player sprite based on state
    let playerSprite;
    if (!player.onGround) {
      playerSprite = 'PLAYER_JUMP';
    } else if (Math.abs(player.vx) > 0.5) {
      // Walking animation
      playerSprite = getAnimationFrame('playerWalk', timestamp);
    } else {
      playerSprite = 'PLAYER_STAND';
    }
    
    // Set player color
    Spectrum.setAttribute(playerCellX, playerCellY, 4, 0, true, false); // Green ink, black paper, bright
    
    // Draw player sprite
    Spectrum.drawChar(playerCellX, playerCellY, playerSprite);
    
    // Apply screen effects
    applyScreenEffects(timestamp);
    
    // Update the display (handle flashing, etc.)
    Spectrum.update(timestamp);
  }
  
  /**
   * Apply screen effects (shake, transitions, etc.)
   * @param {number} timestamp - Current timestamp
   */
  function applyScreenEffects(timestamp) {
    // Handle screen shake effect
    if (screenShake.active) {
      const elapsed = timestamp - screenShake.startTime;
      if (elapsed > screenShake.duration) {
        screenShake.active = false;
      } else {
        const intensity = screenShake.intensity * (1 - elapsed / screenShake.duration);
        const offsetX = Math.random() * intensity * 2 - intensity;
        const offsetY = Math.random() * intensity * 2 - intensity;
        
        canvas.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      }
    } else {
      canvas.style.transform = 'translate(0, 0)';
    }
    
    // Handle room transition effect
    if (roomTransitionActive) {
      // Implement room transition visual effect here
      // This could fade between rooms, wipe, etc.
    }
  }
  
  /**
   * Start a screen shake effect
   * @param {number} intensity - Shake intensity in pixels
   * @param {number} duration - Shake duration in milliseconds
   */
  function startScreenShake(intensity = 5, duration = 500) {
    screenShake.active = true;
    screenShake.intensity = intensity;
    screenShake.duration = duration;
    screenShake.startTime = performance.now();
  }
  
  /**
   * Start a room transition effect
   */
  function startRoomTransition() {
    roomTransitionActive = true;
    transitionProgress = 0;
    
    // Return a promise that resolves when transition is complete
    return new Promise(resolve => {
      const transitionInterval = setInterval(() => {
        transitionProgress += 0.05;
        
        if (transitionProgress >= 1) {
          clearInterval(transitionInterval);
          roomTransitionActive = false;
          resolve();
        }
      }, 20);
    });
  }
  
  /**
   * Set up default animations
   */
  function setupDefaultAnimations() {
    // Create player walking animation
    createAnimation('playerWalk', ['PLAYER_WALK1', 'PLAYER_WALK2'], 6, true);
    
    // Create other animations as needed
  }
  
  // Public API
  return {
    initialize,
    renderRoom,
    createAnimation,
    resetAnimation,
    startScreenShake,
    startRoomTransition,
    setupDefaultAnimations
  };
})();

// For use in Node.js environment (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Renderer;
}