/**
 * Game.js - Main game controller
 * Manages game state, physics, and integrates all components
 */

const SpectroJSW = (() => {
  // Game constants
  const GRAVITY = 0.5;
  const JUMP_STRENGTH = -8.5;
  const MOVE_SPEED = 2.5;
  const FRICTION = 0.8;
  const MAX_FALL_SPEED = 10;
  const TILE_SIZE = 8; // ZX Spectrum character cell size
  
  // Game state
  let gameState = {
    isPlaying: false,
    isPaused: false,
    score: 0,
    lives: 3,
    currentRoomId: "offLicence",
    currentRoom: null,
    totalCollectibles: 0,
    collectedItems: 0,
    soundEnabled: true,
    hasKey: false,
    gameTime: 0,
    lastUpdate: 0,
    deathCount: 0
  };
  
  // References to other modules
  let canvas, audioContext;
  
  // Frame counter for animations
  let frameCount = 0;
  
  /**
   * Initialize the game
   */
  function init() {
    // Get canvas element
    canvas = document.getElementById('spectrum-canvas');
    
    // Initialize modules
    Renderer.initialize(canvas);
    Input.initialize();
    Renderer.setupDefaultAnimations();
    
    // Initialize audio context
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
    
    // Set up event listeners for game controls
    document.getElementById('sound-btn').addEventListener('click', toggleSound);
    document.getElementById('menu-btn').addEventListener('click', () => {
      pauseGame();
      document.getElementById('game-menu').classList.remove('hidden');
    });
    
    console.log('SpectroJSW initialized');
  }
  
  /**
   * Start the game
   */
  function startGame() {
    // Reset game state
    gameState = {
      isPlaying: true,
      isPaused: false,
      score: 0,
      lives: 3,
      currentRoomId: "offLicence",
      currentRoom: null,
      totalCollectibles: 0,
      collectedItems: 0,
      soundEnabled: gameState.soundEnabled,
      hasKey: false,
      gameTime: 0,
      lastUpdate: performance.now(),
      deathCount: 0
    };
    
    // Load first room
    loadRoom(gameState.currentRoomId);
    
    // Hide loading screen and menu
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('game-menu').classList.add('hidden');
    
    // Start game loop
    requestAnimationFrame(gameLoop);
    
    console.log('Game started');
  }
  
  /**
   * Pause the game
   */
  function pauseGame() {
    gameState.isPaused = true;
  }
  
  /**
   * Resume the game
   */
  function resumeGame() {
    gameState.isPaused = false;
    gameState.lastUpdate = performance.now();
    requestAnimationFrame(gameLoop);
  }
  
  /**
   * Toggle sound on/off
   */
  function toggleSound() {
    gameState.soundEnabled = !gameState.soundEnabled;
    document.getElementById('sound-btn').textContent = 
      gameState.soundEnabled ? 'Sound: ON' : 'Sound: OFF';
    
    Input.setVibration(gameState.soundEnabled);
  }
  
  /**
   * Load a game room
   * @param {string} roomId - Room identifier
   */
  function loadRoom(roomId) {
    // Get room data
    const room = Rooms.getRoom(roomId);
    if (!room) {
      console.error(`Room not found: ${roomId}`);
      return;
    }
    
    // Set current room
    gameState.currentRoomId = roomId;
    gameState.currentRoom = room;
    
    // Load room entities
    Entities.loadRoomEntities(room);
    
    // Count collectibles
    const collectibles = Entities.getEntitiesByType(Entities.ENTITY_TYPES.COLLECTIBLE);
    gameState.totalCollectibles = collectibles.length;
    
    // Create player if doesn't exist, or reset position
    const player = Entities.getPlayer();
    if (!player) {
      // Create player at default position
      Entities.createPlayer(40, 160);
    } else {
      // Reset player state based on entry direction
      resetPlayerForRoom(room);
    }
    
    // Update room name in UI
    document.getElementById('room-name').textContent = room.name.toUpperCase();
    
    console.log(`Loaded room: ${room.name}`);
  }
  
  /**
   * Reset player position for a new room
   * @param {Object} room - Room data
   */
  function resetPlayerForRoom(room) {
    const player = Entities.getPlayer();
    
    // Check from which direction we entered the room
    const prevRoomId = gameState.currentRoomId;
    const prevRoom = Rooms.getRoom(prevRoomId);
    
    if (prevRoom && prevRoom.rightExit === room.id) {
      // Entered from left
      player.x = 16;
      player.y = 120;
      player.vx = 0;
      player.vy = 0;
      player.facingLeft = false;
    } else if (prevRoom && prevRoom.leftExit === room.id) {
      // Entered from right
      player.x = 240;
      player.y = 120;
      player.vx = 0;
      player.vy = 0;
      player.facingLeft = true;
    } else if (prevRoom && prevRoom.bottomExit === room.id) {
      // Entered from top
      player.x = 128;
      player.y = 16;
      player.vx = 0;
      player.vy = 0;
    } else if (prevRoom && prevRoom.topExit === room.id) {
      // Entered from bottom
      player.x = 128;
      player.y = 168;
      player.vx = 0;
      player.vy = 0;
    } else {
      // Default position
      player.x = 40;
      player.y = 160;
      player.vx = 0;
      player.vy = 0;
      player.facingLeft = false;
    }
    
    player.onGround = false;
    player.onRope = false;
    player.standingPlatform = null;
    player.isJumping = false;
  }
  
  /**
   * Main game loop
   * @param {number} timestamp - Current timestamp
   */
  function gameLoop(timestamp) {
    // Skip if game is not playing or paused
    if (!gameState.isPlaying || gameState.isPaused) {
      return;
    }
    
    // Calculate delta time
    const deltaTime = timestamp - gameState.lastUpdate;
    gameState.lastUpdate = timestamp;
    gameState.gameTime += deltaTime;
    
    // Update input
    Input.update();
    
    // Update game state
    updateGame(deltaTime);
    
    // Render the game
    renderGame(timestamp);
    
    // Schedule next frame
    requestAnimationFrame(gameLoop);
    
    // Increment frame counter
    frameCount++;
  }
  
  /**
   * Update game state
   * @param {number} deltaTime - Time since last update in ms
   */
  function updateGame(deltaTime) {
    // Cap delta time to avoid large jumps
    const dt = Math.min(deltaTime, 33);
    
    // Update player
    updatePlayer(dt);
    
    // Update entities
    Entities.updateEntities(dt, gameState.currentRoom.layout);
    
    // Check collisions
    checkCollisions();
    
    // Check for room transitions
    checkRoomTransitions();
    
    // Update score display
    document.getElementById('score').textContent = `SCORE: ${gameState.score}`;
    
    // Update lives display
    document.getElementById('lives').textContent = `LIVES: ${gameState.lives}`;
  }
  
  /**
   * Update player position and state
   * @param {number} deltaTime - Time since last update in ms
   */
  function updatePlayer(deltaTime) {
    const player = Entities.getPlayer();
    if (!player) return;
    
    // Handle horizontal movement
    const horizontalInput = Input.getHorizontalAxis();
    
    if (horizontalInput < 0) {
      player.vx = -MOVE_SPEED;
      player.facingLeft = true;
      player.animState = 'walk';
    } else if (horizontalInput > 0) {
      player.vx = MOVE_SPEED;
      player.facingLeft = false;
      player.animState = 'walk';
    } else {
      player.vx *= FRICTION;
      if (Math.abs(player.vx) < 0.1) {
        player.vx = 0;
      }
      player.animState = 'stand';
    }
    
    // Handle jumping
    const jumpPressed = Input.isActionActive('jump');
    
    if (jumpPressed && player.onGround && !player.isJumping) {
      player.vy = JUMP_STRENGTH;
      player.onGround = false;
      player.isJumping = true;
      player.jumpTime = gameState.gameTime;
      player.animState = 'jump';
      
      // Play jump sound
      playSound('jump');
    }
    
    // Allow variable jump height based on how long jump button is held
    if (player.isJumping && !jumpPressed) {
      // Release jump early
      if (player.vy < 0) {
        player.vy *= 0.5; // Cut jump short
      }
      player.isJumping = false;
    }
    
    // Maximum jump time
    if (player.isJumping && gameState.gameTime - player.jumpTime > player.maxJumpTime) {
      player.isJumping = false;
    }
    
    // Apply gravity
    if (!player.onGround) {
      player.vy += GRAVITY;
      
      // Slow fall if on rope
      if (player.onRope && player.vy > 0) {
        player.vy = 1;
      }
    }
    
    // Cap fall speed
    if (player.vy > MAX_FALL_SPEED) {
      player.vy = MAX_FALL_SPEED;
    }
    
    // Apply velocity
    player.x += player.vx;
    player.y += player.vy;
    
    // Keep player within screen bounds
    if (player.x < 0) player.x = 0;
    if (player.x > 256 - player.width) player.x = 256 - player.width;
    if (player.y < 0) player.y = 0;
    if (player.y > 192 - player.height) {
      player.y = 192 - player.height;
      player.vy = 0;
      player.onGround = true;
    }
    
    // Check grid collisions
    checkPlayerGridCollisions(player);
    
    // Reset platform state unless colliding
    player.standingPlatform = null;
    
    // Update animation state timing
    player.animStateTime = gameState.gameTime;
  }
  
  /**
   * Check player collision with grid tiles
   * @param {Object} player - Player entity
   */
  function checkPlayerGridCollisions(player) {
    const layout = gameState.currentRoom.layout;
    
    // Get player bounds in grid coordinates
    const left = Math.floor(player.x / TILE_SIZE);
    const right = Math.floor((player.x + player.width) / TILE_SIZE);
    const top = Math.floor(player.y / TILE_SIZE);
    const bottom = Math.floor((player.y + player.height) / TILE_SIZE);
    
    // Check collisions with floor and walls
    let onGround = false;
    
    // Check each potential colliding tile
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        // Skip if outside grid
        if (y < 0 || y >= layout.length || x < 0 || x >= layout[y].length) {
          continue;
        }
        
        const tile = layout[y][x];
        
        // Skip empty tiles
        if (tile === 0) continue;
        
        if (tile === 1 || tile === 2) {
          // Solid tile (floor or wall)
          
          // Calculate tile bounds
          const tileLeft = x * TILE_SIZE;
          const tileRight = tileLeft + TILE_SIZE;
          const tileTop = y * TILE_SIZE;
          const tileBottom = tileTop + TILE_SIZE;
          
          // Check horizontal collision (side)
          if (player.y < tileBottom && player.y + player.height > tileTop) {
            // Left collision
            if (player.x + player.width > tileLeft && player.x < tileLeft) {
              player.x = tileLeft - player.width;
              player.vx = 0;
            }
            // Right collision
            else if (player.x < tileRight && player.x + player.width > tileRight) {
              player.x = tileRight;
              player.vx = 0;
            }
          }
          
          // Check vertical collision
          if (player.x + player.width > tileLeft && player.x < tileRight) {
            // Bottom collision (player is above tile)
            if (player.y + player.height > tileTop && player.y < tileTop && player.vy >= 0) {
              player.y = tileTop - player.height;
              player.vy = 0;
              onGround = true;
            }
            // Top collision (player is below tile)
            else if (player.y < tileBottom && player.y + player.height > tileBottom && player.vy < 0) {
              player.y = tileBottom;
              player.vy = 0;
            }
          }
        } else if (tile === 3) {
          // Hazard tile
          // Check if player is touching this tile
          const tileLeft = x * TILE_SIZE;
          const tileRight = tileLeft + TILE_SIZE;
          const tileTop = y * TILE_SIZE;
          const tileBottom = tileTop + TILE_SIZE;
          
          if (player.x + player.width > tileLeft && player.x < tileRight && 
              player.y + player.height > tileTop && player.y < tileBottom) {
            // Player hit a hazard
            handlePlayerDeath();
            return; // Exit early after death
          }
        }
      }
    }
    
    player.onGround = onGround;
  }
  
  /**
   * Check player collisions with entities
   */
  function checkCollisions() {
    // Check entity collisions
    const collidingEntity = Entities.checkPlayerEntityCollisions();
    
    if (collidingEntity) {
      // Player hit a deadly entity
      handlePlayerDeath();
      return;
    }
    
    // Check door use
    const doorUse = Entities.checkDoorUse(Input.wasActionJustActivated('action'));
    
    if (doorUse) {
      switch (doorUse.action) {
        case 'enter':
          // Change to new room
          if (doorUse.door.destinationRoom) {
            changeRoom(doorUse.door.destinationRoom);
          }
          break;
        case 'unlock':
          // Door was unlocked
          playSound('unlock');
          Renderer.startScreenShake(3, 200);
          break;
        case 'locked':
          // Door is locked, show message
          console.log('This door is locked! Find a key.');
          break;
      }
    }
    
    // Collect items
    const player = Entities.getPlayer();
    const collectibles = Entities.getEntitiesByType(Entities.ENTITY_TYPES.COLLECTIBLE);
    
    for (const item of collectibles) {
      if (!item.collected && !item.removed && Entities.isColliding(player, item)) {
        const value = Entities.collectItem(item);
        if (value) {
          gameState.score += value;
          gameState.collectedItems++;
          playSound('collect');
        }
      }
    }
    
    // Collect keys
    const keys = Entities.getEntitiesByType(Entities.ENTITY_TYPES.KEY);
    
    for (const key of keys) {
      if (!key.collected && !key.removed && Entities.isColliding(player, key)) {
        Entities.collectKey(key);
        player.hasKey = true;
        gameState.score += 50;
        playSound('key');
        Renderer.startScreenShake(5, 300);
      }
    }
  }
  
  /**
   * Check if player should transition to another room
   */
  function checkRoomTransitions() {
    const player = Entities.getPlayer();
    const room = gameState.currentRoom;
    
    // Exit left
    if (player.x <= 0 && room.leftExit) {
      changeRoom(room.leftExit);
    }
    // Exit right
    else if (player.x + player.width >= 256 && room.rightExit) {
      changeRoom(room.rightExit);
    }
    // Exit top
    else if (player.y <= 0 && room.topExit) {
      changeRoom(room.topExit);
    }
    // Exit bottom
    else if (player.y + player.height >= 192 && room.bottomExit) {
      changeRoom(room.bottomExit);
    }
  }
  
  /**
   * Handle player death
   */
  function handlePlayerDeath() {
    const player = Entities.getPlayer();
    
    // Decrease lives
    gameState.lives--;
    gameState.deathCount++;
    
    // Play death sound
    playSound('death');
    
    // Screen shake effect
    Renderer.startScreenShake(10, 500);
    
    if (gameState.lives <= 0) {
      // Game over
      gameOver();
    } else {
      // Reset player position in current room
      resetPlayerForRoom(gameState.currentRoom);
    }
  }
  
  /**
   * Change to another room
   * @param {string} roomId - Room identifier
   */
  function changeRoom(roomId) {
    // Play room change sound
    playSound('room');
    
    // Transition to new room
    Renderer.startRoomTransition()
      .then(() => {
        loadRoom(roomId);
      });
  }
  
  /**
   * Game over
   */
  function gameOver() {
    // Game over logic
    gameState.isPlaying = false;
    
    // Show game over screen
    console.log('Game Over');
    
    // Show menu with game over message
    document.getElementById('menu-title').textContent = 'GAME OVER';
    document.getElementById('game-menu').classList.remove('hidden');
  }
  
  /**
   * Render the game
   * @param {number} timestamp - Current timestamp
   */
  function renderGame(timestamp) {
    // Get player and entities
    const player = Entities.getPlayer();
    const entities = Entities.getAllEntities();
    
    // Render current room
    Renderer.renderRoom(
      gameState.currentRoom,
      entities,
      player,
      timestamp
    );
  }
  
  /**
   * Play a sound effect
   * @param {string} sound - Sound identifier
   */
  function playSound(sound) {
    if (!gameState.soundEnabled || !audioContext) return;
    
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      switch (sound) {
        case 'jump':
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.2);
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.2);
          break;
          
        case 'collect':
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1);
          break;
          
        case 'death':
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.5);
          break;
          
        case 'room':
          oscillator.type = 'triangle';
          oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.3);
          break;
          
        case 'key':
          // Play a descending arpeggio for key collection
          for (let i = 0; i < 3; i++) {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            osc.type = 'square';
            osc.frequency.setValueAtTime(800 - i * 200, audioContext.currentTime + i * 0.1);
            
            gain.gain.setValueAtTime(0.2, audioContext.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.1 + 0.1);
            
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.start(audioContext.currentTime + i * 0.1);
            osc.stop(audioContext.currentTime + i * 0.1 + 0.1);
          }
          break;
          
        case 'unlock':
          // Play an ascending arpeggio for unlocking
          for (let i = 0; i < 3; i++) {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400 + i * 200, audioContext.currentTime + i * 0.1);
            
            gain.gain.setValueAtTime(0.2, audioContext.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.1 + 0.1);
            
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.start(audioContext.currentTime + i * 0.1);
            osc.stop(audioContext.currentTime + i * 0.1 + 0.1);
          }
          break;
      }
    } catch (e) {
      console.error("Error playing sound:", e);
    }
  }
  
  /**
   * Reset the current room
   */
  function resetRoom() {
    loadRoom(gameState.currentRoomId);
  }
  
  /**
   * Go to next room
   */
  function nextRoom() {
    const nextRoomId = Rooms.getNextRoom(gameState.currentRoomId);
    changeRoom(nextRoomId);
  }
  
  /**
   * Go to previous room
   */
  function prevRoom() {
    const prevRoomId = Rooms.getPrevRoom(gameState.currentRoomId);
    changeRoom(prevRoomId);
  }
  
  // Public API
  return {
    init,
    startGame,
    pauseGame,
    resumeGame,
    resetRoom,
    nextRoom,
    prevRoom
  };
})();

// For use in Node.js environment (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpectroJSW;
}