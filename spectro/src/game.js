/**
 * Game.js - Main game controller
 * Manages game state, physics, and integrates all components
 */

const SpectroJSW = (() => {
  // Enhanced platformer physics constants
  const GRAVITY = 0.25;
  const JUMP_STRENGTH = -5.5;
  const MOVE_SPEED = 1.5;
  const MAX_SPEED = 3.0;
  const ACCELERATION = 0.2;
  const DECELERATION = 0.3;
  const FRICTION = 0.8;
  const MAX_FALL_SPEED = 6.0;
  const JUMP_BUFFER_TIME = 100; // ms
  const COYOTE_TIME = 100; // ms
  const JUMP_RELEASE_VELOCITY = -1.0;
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
    deathCount: 0,
    isInvulnerable: false,
    invulnerableTimer: 0
  };
  
  // Expose gameState to debug module
  window.SpectroJSW = { gameState };
  
  // References to other modules
  let canvas, audioContext;
  
  // Frame counter for animations
  let frameCount = 0;
  
  /**
   * Initialize the game
   */
  function init() {
    // Very explicit debug log to verify logging is working
    console.log('====== SPECTRO JSW INITIALIZING v2.0.0 ======');
    console.log('DEBUG MODE ENABLED - Enhanced platformer edition');
    
    // Get canvas element
    canvas = document.getElementById('spectrum-canvas');
    if (!canvas) {
      console.error('Canvas element not found in SpectroJSW.init!');
      return;
    }
    
    try {
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
    } catch (e) {
      console.error('Error in SpectroJSW.init:', e);
    }
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
    
    try {
      // Load first room
      loadRoom(gameState.currentRoomId);
      
      // Hide loading screen and menu
      document.getElementById('loading-screen').classList.add('hidden');
      document.getElementById('game-menu').classList.add('hidden');
      
      // Start game loop
      requestAnimationFrame(gameLoop);
    } catch (e) {
      console.error('Error starting game:', e);
      // Try to show some debug info on screen
      document.getElementById('menu-title').textContent = 'ERROR STARTING GAME';
      document.getElementById('game-menu').classList.remove('hidden');
    }
    
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
    
    // Load room entities including platform definitions
    Entities.loadRoomEntities(room);
    
    // Count collectibles
    const collectibles = Entities.getEntitiesByType(Entities.ENTITY_TYPES.COLLECTIBLE);
    gameState.totalCollectibles = collectibles.length;
    
    // Create player if doesn't exist, or reset position
    const player = Entities.getPlayer();
    if (!player) {
      // Use playerStart position from room data if available
      const startPos = Rooms.getPlayerStartPosition(roomId);
      Entities.createPlayer(startPos.x, startPos.y);
      
      // Initialize player properties for enhanced platformer physics
      const player = Entities.getPlayer();
      player.coyoteTimeCounter = 0;
      player.jumpBufferCounter = 0;
      player.jumpReleased = true;
      player.height = 16; // 2 chars high for better platformer character
      
      console.log(`Created player at position (${startPos.x}, ${startPos.y})`);
    } else {
      // Reset player state based on entry direction
      resetPlayerForRoom(room);
    }
    
    // Update room name in UI
    document.getElementById('room-name').textContent = room.name.toUpperCase();
    
    console.log(`Loaded room: ${room.name} with ${room.platforms ? room.platforms.length : 0} platforms`);
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
    
    // Log the room transition for debugging
    console.log("Player transition:", { 
      from: prevRoomId, 
      to: room.id,
      transition: prevRoom ? 
        (prevRoom.rightExit === room.id ? "right→left" : 
         prevRoom.leftExit === room.id ? "left→right" : 
         prevRoom.bottomExit === room.id ? "bottom→top" : 
         prevRoom.topExit === room.id ? "top→bottom" : "unknown") 
        : "initial spawn"
    });
    
    if (prevRoom && prevRoom.rightExit === room.id) {
      // Entered from left
      player.x = 16;
      player.y = 160; // Back to original position
      player.vx = 0;
      player.vy = 0;
      player.facingLeft = false;
    } else if (prevRoom && prevRoom.leftExit === room.id) {
      // Entered from right
      player.x = 240;
      player.y = 160; // Back to original position
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
      player.y = 168; // Back to original position
      player.vx = 0;
      player.vy = 0;
    } else {
      // Default position
      player.x = 40;
      player.y = 160; // Back to original position
      player.vx = 0;
      player.vy = 0;
      player.facingLeft = false;
    }
    
    // Force player to ground for safe landing
    player.onGround = true;
    player.onRope = false;
    player.standingPlatform = null;
    player.isJumping = false;
  }
  
  /**
   * Main game loop
   * @param {number} timestamp - Current timestamp
   */
  function gameLoop(timestamp) {
    // Schedule next frame immediately to maintain animation even if there's an error
    requestAnimationFrame(gameLoop);
    
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
    
    try {
      // Update game state
      updateGame(deltaTime);
      
      // Render the game
      renderGame(timestamp);
      
      // Increment frame counter
      frameCount++;
    } catch (e) {
      console.error('Error in game loop:', e);
      // Don't stop the game loop on error
    }
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
    
    // Update entities and platforms
    Entities.updateEntities(dt, gameState.currentRoom.layout);
    
    // Update invulnerability timer
    if (gameState.isInvulnerable) {
      gameState.invulnerableTimer -= dt;
      if (gameState.invulnerableTimer <= 0) {
        gameState.isInvulnerable = false;
        console.log("Player vulnerability restored");
      }
    }
    
    // Handle platform collisions first (for jumping/landing)
    const player = Entities.getPlayer();
    if (player) {
      handlePlatformCollisions(player);
    }
    
    // Then check other collisions (enemies, items, etc.)
    checkCollisions();
    
    // Check for room transitions
    checkRoomTransitions();
    
    // Update score display
    document.getElementById('score').textContent = `SCORE: ${gameState.score}`;
    
    // Update lives display
    document.getElementById('lives').textContent = `LIVES: ${gameState.lives}`;
  }
  
  /**
   * Update player position and state with enhanced platformer physics
   * @param {number} deltaTime - Time since last update in ms
   */
  function updatePlayer(deltaTime) {
    const player = Entities.getPlayer();
    if (!player) return;
    
    const timeScale = deltaTime / 16.7; // Scale for 60fps
    
    // Handle horizontal movement with acceleration/deceleration
    const horizontalInput = Input.getHorizontalAxis();
    
    if (horizontalInput !== 0) {
      // Accelerate in input direction
      player.vx += horizontalInput * ACCELERATION * timeScale;
      player.facingRight = horizontalInput > 0;
      player.facingLeft = !player.facingRight;
      
      // Clamp to max speed
      if (Math.abs(player.vx) > MAX_SPEED) {
        player.vx = MAX_SPEED * Math.sign(player.vx);
      }
      
      // Set walking animation
      player.animState = 'walk';
    } else {
      // No input, decelerate
      if (Math.abs(player.vx) > 0) {
        const decel = DECELERATION * timeScale;
        if (Math.abs(player.vx) > decel) {
          player.vx -= decel * Math.sign(player.vx);
        } else {
          player.vx = 0;
        }
      }
      
      // Set idle animation
      player.animState = 'stand';
    }
    
    // Coyote time for more forgiving jumps
    if (player.onGround) {
      player.coyoteTimeCounter = COYOTE_TIME;
    } else {
      player.coyoteTimeCounter -= deltaTime;
    }
    
    // Jump buffer timing
    if (player.jumpBufferCounter > 0) {
      player.jumpBufferCounter -= deltaTime;
    }
    
    // Handle jumping with buffer and coyote time
    const jumpPressed = Input.isActionActive('jump') || 
                        Input.isKeyPressed('Space') || 
                        Input.isKeyPressed(' ') || 
                        Input.isKeyPressed('32');
    
    // Debug info with enhanced details
    if (jumpPressed && !player.isJumping) {
      console.log("Jump key pressed:", {
        playerState: {
          onGround: player.onGround,
          isJumping: player.isJumping,
          coyoteTime: player.coyoteTimeCounter,
          jumpBuffer: player.jumpBufferCounter,
          position: { x: player.x, y: player.y },
          velocity: { vx: player.vx, vy: player.vy }
        },
        roomInfo: {
          id: gameState.currentRoomId,
          name: gameState.currentRoom.name
        }
      });
      
      // Start jump buffer when button is pressed
      player.jumpBufferCounter = JUMP_BUFFER_TIME;
    }
    
    // Execute jump if either on ground or in coyote time and jump was buffered
    if (player.jumpBufferCounter > 0 && player.coyoteTimeCounter > 0 && player.jumpReleased) {
      console.log("JUMPING with enhanced physics!");
      player.vy = JUMP_STRENGTH;
      player.onGround = false;
      player.isJumping = true;
      player.jumpReleased = false;
      player.jumpBufferCounter = 0;
      player.coyoteTimeCounter = 0;
      player.jumpTime = gameState.gameTime;
      player.animState = 'jump';
      
      // Play jump sound
      playSound('jump');
    }
    
    // Variable jump height by checking if jump button is released while still moving upward
    if (player.isJumping && player.vy < 0) {
      if (!jumpPressed) {
        // Cut the jump short if button released
        if (player.vy < JUMP_RELEASE_VELOCITY) {
          player.vy = JUMP_RELEASE_VELOCITY;
        }
        player.isJumping = false;
      }
    }
    
    // Mark jump as released when button is up
    if (!jumpPressed) {
      player.jumpReleased = true;
    }
    
    // Maximum jump time safety cap
    if (player.isJumping && gameState.gameTime - player.jumpTime > player.maxJumpTime) {
      player.isJumping = false;
    }
    
    // Apply gravity if not on rope
    if (!player.onGround && !player.onRope) {
      player.vy += GRAVITY * timeScale;
    } else if (player.onRope) {
      // On rope movement (climb up/down)
      const verticalInput = Input.getVerticalAxis();
      player.vy = verticalInput * 2.0;
    }
    
    // Cap fall speed
    if (player.vy > MAX_FALL_SPEED) {
      player.vy = MAX_FALL_SPEED;
    }
    
    // Apply velocity with time scaling
    player.x += player.vx * timeScale;
    player.y += player.vy * timeScale;
    
    // Keep player within screen bounds
    if (player.x < 0) player.x = 0;
    if (player.x > 256 - player.width) player.x = 256 - player.width;
    if (player.y < 0) player.y = 0;
    if (player.y > 192 - player.height) {
      player.y = 192 - player.height;
      player.vy = 0;
      player.onGround = true;
    }
    
    // Update animation state based on movement
    if (!player.onGround) {
      if (player.vy < 0) {
        // Going up = jump
        player.animState = 'jump';
      } else {
        // Going down = fall
        player.animState = 'fall';
      }
    } else if (Math.abs(player.vx) > 0.1) {
      // Moving = walk
      player.animState = 'walk';
    } else {
      // Standing still = idle
      player.animState = 'stand';
    }
    
    // Check platform and grid collisions
    handlePlatformCollisions(player);
    checkPlayerGridCollisions(player);
    
    // Reset platform state unless colliding
    if (!player.onPlatform) {
      player.standingPlatform = null;
    }
    
    // Update animation state timing
    player.animStateTime = gameState.gameTime;
  }
  
  /**
   * Handle platform collisions for the player
   * @param {Object} player - Player entity
   */
  function handlePlatformCollisions(player) {
    // Skip if player doesn't exist
    if (!player) return;
    
    // Reset ground state unless confirmed otherwise
    const wasOnGround = player.onGround;
    player.onGround = false;
    player.onPlatform = false;
    
    // Get all platform entities 
    const platforms = Entities.getAllEntities().filter(e => 
      (e.type === 'platform' || e.type === 'slope' || 
       e.type === 'moving_platform' || e.type === 'lift' ||
       e.type === 'conveyor') &&
      !e.hidden && !e.removed
    );
    
    for (const platform of platforms) {
      if (!platform) continue;
      
      // Enhanced collision detection based on platform type
      switch(platform.type) {
        case 'platform':
        case 'lift':
        case 'moving_platform':
        case 'conveyor':
          // Standard platform collision
          if (window.checkCollisionBetween(player, platform)) {
            // Check if player is landing on top of platform
            if (player.vy >= 0 && player.y + player.height - player.vy <= platform.y + 2) {
              // Land on platform
              player.y = platform.y - player.height;
              player.vy = 0;
              player.onGround = true;
              player.onPlatform = true;
              player.isJumping = false;
              player.standingPlatform = platform.id;
              
              // Move with platform if moving
              if (platform.type === 'moving_platform' || platform.type === 'lift') {
                if (platform.lastX !== undefined && platform.lastY !== undefined) {
                  player.x += platform.x - platform.lastX;
                }
              }
              
              // Apply conveyor belt effect
              if (platform.type === 'conveyor' && platform.direction) {
                player.x += platform.direction * (platform.speed || 0.5);
              }
            } 
            // Wall collision from sides
            else if (player.x + player.width > platform.x && player.x < platform.x + platform.width) {
              // If moving right and hit left side of platform
              if (player.vx > 0 && player.x + player.width - player.vx <= platform.x + 2) {
                player.x = platform.x - player.width;
                player.vx = 0;
              }
              // If moving left and hit right side of platform
              else if (player.vx < 0 && player.x - player.vx >= platform.x + platform.width - 2) {
                player.x = platform.x + platform.width;
                player.vx = 0;
              }
              
              // Ceiling collision (hitting bottom of platform while jumping)
              if (player.vy < 0 && player.y - player.vy >= platform.y + platform.height - 2) {
                player.y = platform.y + platform.height;
                player.vy = 0;
              }
            }
          }
          break;
          
        case 'slope':
          // Sloped platform - more advanced collision
          if (player.x + player.width > platform.x && player.x < platform.x + platform.width) {
            // Calculate Y position at this X based on slope angle
            const playerCenterX = player.x + player.width / 2;
            const slopeProgress = (playerCenterX - platform.x) / platform.width;
            let slopeY;
            
            if (platform.angle > 0) {
              // Rising slope (left to right)
              slopeY = platform.y + platform.height - (slopeProgress * platform.height);
            } else if (platform.angle < 0) {
              // Falling slope (left to right)
              slopeY = platform.y + (slopeProgress * platform.height);
            } else {
              // Flat slope (no angle)
              slopeY = platform.y;
            }
            
            // Check if player is on or slightly above the slope
            if (player.y + player.height >= slopeY - 2 && 
                player.y + player.height <= slopeY + 5 &&
                player.vy >= 0) {
              player.y = slopeY - player.height;
              player.onGround = true;
              player.onPlatform = true;
              player.isJumping = false;
              
              // Apply slight horizontal slowdown when going uphill
              if ((player.vx > 0 && platform.angle > 0) || 
                  (player.vx < 0 && platform.angle < 0)) {
                player.vx *= 0.95; // Slow down a bit when going uphill
              }
            }
          }
          break;
      }
    }
    
    // Play landing sound if just landed
    if (!wasOnGround && player.onGround) {
      playSound('jump');
      Renderer.startScreenShake(2, 100);
      console.log("Player landed on platform or ground!");
    }
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
    
    // First check if player is at bottom of screen
    if (player.y + player.height >= 192 - 2) {
      player.y = 192 - player.height;
      player.vy = 0;
      onGround = true;
      console.log("Player grounded at screen bottom");
    }
    
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
    
    // Only set onGround from grid if not already set from platforms
    if (onGround) {
      player.onGround = true;
    }
  }
  
  /**
   * Check player collisions with entities
   */
  function checkCollisions() {
    try {
      // Skip deadly entity collision checks if player is invulnerable
      if (!gameState.isInvulnerable) {
        // Check entity collisions with enhanced handling
        const collidingEntity = Entities.checkPlayerEntityCollisions();
        
        if (collidingEntity) {
          // Player hit a deadly entity
          handlePlayerDeath();
          return;
        }
      }
      
      // Check door use
      const doorUse = Entities.checkDoorUse(Input.wasActionJustActivated('action'));
      
      if (doorUse) {
        switch (doorUse.action) {
          case 'enter':
            // Change to new room
            if (doorUse.door.destinationRoom) {
              changeRoom(doorUse.door.destinationRoom, doorUse.door.exitDirection || 'right');
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
    } catch (e) {
      console.error('Error in collision handling:', e);
    }
    
    try {
      // Enhanced collision handling
      const player = Entities.getPlayer();
      if (!player) return;
      
      // Collect items with improved feedback
      const collectibles = Entities.getEntitiesByType(Entities.ENTITY_TYPES.COLLECTIBLE);
      if (collectibles && collectibles.length) {
        for (const item of collectibles) {
          if (item && !item.collected && !item.removed && window.checkCollisionBetween(player, item)) {
            // Enhanced collection logic
            item.collected = true;
            item.removed = true;
            gameState.score += (item.value || 10);
            gameState.collectedItems++;
            playSound('collect');
            
            // Small screen shake for feedback
            Renderer.startScreenShake(1, 100);
          }
        }
      }
      
      // Collect keys
      const keys = Entities.getEntitiesByType(Entities.ENTITY_TYPES.KEY);
      if (keys && keys.length) {
        for (const key of keys) {
          if (key && !key.collected && !key.removed && window.checkCollisionBetween(player, key)) {
            // Enhanced key collection
            key.collected = true;
            key.removed = true;
            player.hasKey = true;
            gameState.hasKey = true; // Also store in game state
            gameState.score += 50;
            playSound('key');
            Renderer.startScreenShake(5, 300);
          }
        }
      }
      
      // Check for rope interaction
      const ropes = Entities.getEntitiesByType(Entities.ENTITY_TYPES.ROPE);
      if (ropes && ropes.length) {
        player.onRope = false; // Reset rope state
        
        for (const rope of ropes) {
          if (rope && !rope.removed) {
            // Check if player is touching rope along its height
            if (player.x + player.width / 2 >= rope.x - 2 && 
                player.x + player.width / 2 <= rope.x + 2 &&
                player.y + player.height >= rope.y &&
                player.y <= rope.y + rope.height) {
              player.onRope = true;
              break;
            }
          }
        }
      }
    } catch (e) {
      console.error('Error in item collection:', e);
    }
  }
  
  /**
   * Check if player should transition to another room
   */
  function checkRoomTransitions() {
    const player = Entities.getPlayer();
    const room = gameState.currentRoom;
    
    // Exit left
    if (player.x <= 0) {
      if (room.leftExit) {
        changeRoom(room.leftExit);
      } else {
        // Prevent going off screen if no exit
        player.x = 0;
      }
    }
    // Exit right
    else if (player.x + player.width >= 256) {
      if (room.rightExit) {
        changeRoom(room.rightExit);
      } else {
        // Prevent going off screen if no exit
        player.x = 256 - player.width;
      }
    }
    // Exit top
    else if (player.y <= 0) {
      if (room.topExit) {
        changeRoom(room.topExit);
      } else {
        // Prevent going off screen if no exit
        player.y = 0;
      }
    }
    // Exit bottom
    else if (player.y + player.height >= 192) {
      if (room.bottomExit) {
        changeRoom(room.bottomExit);
      } else {
        // Prevent going off screen if no exit
        player.y = 192 - player.height;
        player.onGround = true; // Set grounded when at bottom
      }
    }
  }
  
  /**
   * Handle player death
   */
  function handlePlayerDeath() {
    const player = Entities.getPlayer();
    
    // Add detailed debug information about the death
    console.log("PLAYER DEATH:", {
      position: { x: player.x, y: player.y },
      velocity: { vx: player.vx, vy: player.vy },
      state: { 
        onGround: player.onGround, 
        isJumping: player.isJumping,
        room: gameState.currentRoomId
      },
      nearestEntities: Entities.getAllEntities().filter(e => 
        Math.abs(e.x - player.x) < 50 && 
        Math.abs(e.y - player.y) < 50
      ).map(e => ({ type: e.type, id: e.id, x: e.x, y: e.y }))
    });
    
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
   * Change to another room with transition direction
   * @param {string} roomId - Room identifier
   * @param {string} direction - Direction of exit ('left', 'right', 'up', 'down')
   */
  function changeRoom(roomId, direction = 'right') {
    // Play room change sound
    playSound('room');
    
    // Set player invulnerable for a short time after room transition
    gameState.isInvulnerable = true;
    gameState.invulnerableTimer = 1500; // 1.5 seconds of invulnerability
    
    // Transition to new room with direction effect
    Renderer.startRoomTransition(direction)
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
    
    // Show game over screen with more info
    console.log('Game Over - Final state:', {
      room: gameState.currentRoomId,
      score: gameState.score,
      deathCount: gameState.deathCount,
      lastPosition: Entities.getPlayer() ? 
        { x: Entities.getPlayer().x, y: Entities.getPlayer().y } : 
        'Unknown'
    });
    
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
   * Play a sound effect with enhanced platformer sounds
   * @param {string} sound - Sound identifier
   */
  function playSound(sound) {
    if (!gameState.soundEnabled || !audioContext) return;
    
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      switch (sound) {
        case 'jump':
          // Better jump sound with more "bounce" feel
          oscillator.type = 'triangle';
          oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.2);
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.2);
          break;
          
        case 'land':
          // Landing sound for when player hits ground
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1);
          break;
          
        case 'collect':
          // Brighter collection sound
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(900, audioContext.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1);
          break;
          
        case 'death':
          // More dramatic death sound
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.5);
          
          // Add a small crash sound after initial death sound
          setTimeout(() => {
            if (!gameState.soundEnabled || !audioContext) return;
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            
            osc2.type = 'square';
            osc2.frequency.setValueAtTime(100, audioContext.currentTime);
            gain2.gain.setValueAtTime(0.2, audioContext.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            
            osc2.start();
            osc2.stop(audioContext.currentTime + 0.2);
          }, 150);
          break;
          
        case 'room':
          // Smoother room transition sound
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
          // More distinctive key collection sound
          for (let i = 0; i < 4; i++) {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            osc.type = i % 2 === 0 ? 'square' : 'triangle';
            osc.frequency.setValueAtTime(600 + i * 200, audioContext.currentTime + i * 0.08);
            
            gain.gain.setValueAtTime(0.15, audioContext.currentTime + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.08 + 0.1);
            
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.start(audioContext.currentTime + i * 0.08);
            osc.stop(audioContext.currentTime + i * 0.08 + 0.1);
          }
          break;
          
        case 'unlock':
          // More dramatic unlock sound
          for (let i = 0; i < 4; i++) {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            // Alternate between waveforms for a richer sound
            osc.type = i % 2 === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(300 + i * 150, audioContext.currentTime + i * 0.1);
            
            gain.gain.setValueAtTime(0.2, audioContext.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.1 + 0.15);
            
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.start(audioContext.currentTime + i * 0.1);
            osc.stop(audioContext.currentTime + i * 0.1 + 0.15);
          }
          break;
          
        case 'bounce':
          // Sound for bouncing off enemies
          oscillator.type = 'triangle';
          oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.15);
          gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.15);
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