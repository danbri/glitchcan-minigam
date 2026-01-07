/**
 * Entities.js - Enhanced game entity management for platformer game
 * Handles creation, updating, and collision detection for all game objects
 */

const Entities = (() => {
  // Constants
  const ENTITY_TYPES = {
    PLAYER: 'player',
    COLLECTIBLE: 'collectible',
    GUARDIAN: 'guardian',
    ENEMY: 'enemy',
    DOOR: 'door',
    KEY: 'key',
    ROPE: 'rope',
    LIFT: 'lift',
    CONVEYOR: 'conveyor',
    BOSS: 'boss',
    BACKGROUND: 'background',  // For decorative elements in the room
    PLATFORM: 'platform',       // Standard platforms
    SLOPE: 'slope',            // Sloped platforms
    MOVING_PLATFORM: 'moving_platform' // Moving platforms
  };
  
  // Entity collections
  let playerEntity = null;
  let entities = [];
  let entitiesById = {};
  
  /**
   * Create the player entity with enhanced properties for platformer physics
   * @param {number} x - Initial X position in pixels
   * @param {number} y - Initial Y position in pixels
   * @returns {Object} Player entity object
   */
  function createPlayer(x, y) {
    playerEntity = {
      type: ENTITY_TYPES.PLAYER,
      id: 'player',
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      width: 8,   // 1 character wide
      height: 16, // 2 characters high for better platformer visibility
      facingRight: true,
      onGround: true,
      onRope: false,
      standingPlatform: null,
      
      // Physics properties
      speed: 1.5,
      maxSpeed: 3.0,
      acceleration: 0.2,
      deceleration: 0.3,
      jumpVelocity: -5.5,
      minJumpVelocity: -3.0, // For variable jump heights
      jumpReleaseVelocity: -1.0, // Maximum upward velocity when releasing jump
      gravity: 0.25,
      maxFallSpeed: 6.0,
      
      // Jump properties
      isJumping: false,
      jumpTime: 0,
      maxJumpTime: 350, // ms
      jumpReleased: true,
      coyoteTime: 100, // Time in ms player can jump after leaving a platform
      coyoteTimeCounter: 0,
      jumpBufferTime: 100, // Time in ms to buffer a jump input before hitting ground
      jumpBufferCounter: 0,
      
      // Game state
      collectedItems: new Set(),
      score: 0,
      keys: 0,
      dead: false,
      canMove: true,
      
      // Animation state
      animationStates: {
        idle: true,
        walk: false,
        jump: false,
        fall: false,
        death: false
      },
      currentAnimation: 'idle',
      animFrameTime: 0,
      animFrameIndex: 0
    };
    
    return playerEntity;
  }
  
  /**
   * Create a game entity with enhanced properties
   * @param {Object} entityData - Entity data
   * @returns {Object} Entity object
   */
  function createEntity(entityData) {
    const entity = {
      ...entityData,
      width: entityData.width || 8,
      height: entityData.height || 8,
      hidden: false,
      removed: false,
      colliding: false,
      facingRight: entityData.facingRight !== undefined ? entityData.facingRight : true,
      // Add extra properties based on entity type
      ...getEntityTypeProperties(entityData.type)
    };
    
    // For moving platforms, store original position
    if (entity.type === ENTITY_TYPES.MOVING_PLATFORM || entity.type === ENTITY_TYPES.LIFT) {
      entity.originalX = entity.x;
      entity.originalY = entity.y;
    }
    
    entities.push(entity);
    entitiesById[entity.id] = entity;
    
    return entity;
  }
  
  /**
   * Get additional properties based on entity type
   * @param {string} type - Entity type
   * @returns {Object} Type-specific properties
   */
  function getEntityTypeProperties(type) {
    switch (type) {
      case ENTITY_TYPES.COLLECTIBLE:
        return {
          value: 10,
          collected: false,
          animationSpeed: 200, // ms per frame
          currentFrame: 0,
          frameTime: 0
        };
      case ENTITY_TYPES.GUARDIAN:
      case ENTITY_TYPES.ENEMY:
        return {
          speed: 1,
          direction: 1,
          minX: 0,
          maxX: 256,
          deadly: true,
          // For enemies that jump
          jumpPower: 0, 
          // For enemies that detect player
          detectRadius: 0,
          // Animation state
          animationSpeed: 150, // ms per frame
          currentFrame: 0,
          frameTime: 0,
          defeated: false
        };
      case ENTITY_TYPES.DOOR:
        return {
          locked: false,
          destinationRoom: null,
          exitDirection: 'right', // Direction used for transition effect
          requiresAllItems: false
        };
      case ENTITY_TYPES.KEY:
        return {
          collected: false,
          animationSpeed: 300,
          currentFrame: 0,
          frameTime: 0
        };
      case ENTITY_TYPES.ROPE:
        return {
          height: 32,
          phase: 0,
          swingSpeed: 0.8, // Swing frequency
          swingAmplitude: 4 // Swing distance
        };
      case ENTITY_TYPES.LIFT:
      case ENTITY_TYPES.MOVING_PLATFORM:
        return {
          width: 32,
          height: 8,
          vx: 0.5, // Horizontal velocity
          vy: 0.5, // Vertical velocity
          bounds: {
            left: 0,
            right: 256,
            top: 0,
            bottom: 192
          },
          lastX: 0, // For tracking player movement with platform
          lastY: 0,
          solid: true,
          movementType: 'horizontal' // horizontal, vertical, circular
        };
      case ENTITY_TYPES.CONVEYOR:
        return {
          width: 32,
          height: 8,
          direction: 1,
          speed: 0.5,
          solid: true,
          animationSpeed: 100,
          currentFrame: 0,
          frameTime: 0
        };
      case ENTITY_TYPES.BOSS:
        return {
          width: 24,
          height: 24,
          health: 3,
          speed: 0.8,
          deadly: true,
          attackCooldown: 2000, // ms
          attackTimer: 0,
          state: 'chase', // chase, attack, hurt
          animationSpeed: 120,
          currentFrame: 0,
          frameTime: 0,
          defeated: false
        };
      case ENTITY_TYPES.PLATFORM:
        return {
          width: 32,
          height: 8,
          solid: true
        };
      case ENTITY_TYPES.SLOPE:
        return {
          width: 32,
          height: 16,
          angle: 45, // Angle in degrees
          solid: true
        };
      case ENTITY_TYPES.BACKGROUND:
        return {
          // Replace emoji with spectrum pattern
          patternIndex: Math.floor(Math.random() * 4), // 0-3 corresponding to BG patterns
          colorIndex: Math.floor(Math.random() * 6) + 1, // 1-7 (avoiding black)
          bright: Math.random() > 0.5,
          isDecoration: true // Flag to mark as non-interactive decoration
        };
      default:
        return {};
    }
  }
  
  /**
   * Load entities for a room
   * @param {Object} room - Room data
   */
  function loadRoomEntities(room) {
    // Clear existing entities
    entities = [];
    entitiesById = {};
    
    // Add room entities
    if (room.entities && Array.isArray(room.entities)) {
      room.entities.forEach(entityData => {
        createEntity(entityData);
      });
    }
    
    // Add platforms as entities for unified collision handling
    if (room.platforms && Array.isArray(room.platforms)) {
      room.platforms.forEach((platform, index) => {
        createEntity({
          id: `platform_${index}`,
          type: platform.type || ENTITY_TYPES.PLATFORM,
          x: platform.x,
          y: platform.y,
          width: platform.width,
          height: platform.height,
          angle: platform.angle,
          vx: platform.vx || 0,
          vy: platform.vy || 0,
          bounds: platform.bounds
        });
      });
    }
  }
  
  /**
   * Get all entities
   * @returns {Array} Array of all entities
   */
  function getAllEntities() {
    return [...entities];
  }
  
  /**
   * Get entity by ID
   * @param {string} id - Entity ID
   * @returns {Object} Entity object or null if not found
   */
  function getEntityById(id) {
    return entitiesById[id] || null;
  }
  
  /**
   * Get all entities of a specific type
   * @param {string} type - Entity type
   * @returns {Array} Array of entities of the specified type
   */
  function getEntitiesByType(type) {
    return entities.filter(entity => entity.type === type);
  }
  
  /**
   * Update player physics with enhanced platformer movement
   * @param {number} deltaTime - Time since last update in ms
   * @param {Object} input - Input module for controls
   */
  function updatePlayerPhysics(deltaTime, input) {
    if (!playerEntity || playerEntity.dead || !playerEntity.canMove) return;
    
    const timeScale = deltaTime / 16.7; // Scale for 60fps
    
    // Get horizontal input
    const horizontalInput = input.getHorizontalAxis();
    
    // Apply acceleration/deceleration for more responsive movement
    if (horizontalInput !== 0) {
      // Accelerate in input direction
      playerEntity.vx += horizontalInput * playerEntity.acceleration * timeScale;
      playerEntity.facingRight = horizontalInput > 0;
      
      // Clamp to max speed
      if (Math.abs(playerEntity.vx) > playerEntity.maxSpeed) {
        playerEntity.vx = playerEntity.maxSpeed * Math.sign(playerEntity.vx);
      }
    } else {
      // No input, decelerate
      if (Math.abs(playerEntity.vx) > 0) {
        const decel = playerEntity.deceleration * timeScale;
        if (Math.abs(playerEntity.vx) > decel) {
          playerEntity.vx -= decel * Math.sign(playerEntity.vx);
        } else {
          playerEntity.vx = 0;
        }
      }
    }
    
    // Coyote time for more forgiving jumps
    if (playerEntity.onGround) {
      playerEntity.coyoteTimeCounter = playerEntity.coyoteTime;
    } else {
      playerEntity.coyoteTimeCounter -= deltaTime;
    }
    
    // Jump buffer timing
    if (playerEntity.jumpBufferCounter > 0) {
      playerEntity.jumpBufferCounter -= deltaTime;
    }
    
    // Variable height jumping
    if (input.wasActionJustActivated('jump')) {
      // Start jump buffer
      playerEntity.jumpBufferCounter = playerEntity.jumpBufferTime;
      console.log("Jump key pressed: buffer started");
    }
    
    // Execute jump if either on ground or in coyote time
    if (playerEntity.jumpBufferCounter > 0 && playerEntity.coyoteTimeCounter > 0 && playerEntity.jumpReleased) {
      // Start jump
      playerEntity.vy = playerEntity.jumpVelocity;
      playerEntity.isJumping = true;
      playerEntity.onGround = false;
      playerEntity.jumpReleased = false;
      playerEntity.jumpBufferCounter = 0;
      playerEntity.coyoteTimeCounter = 0;
      console.log("Jump executed: starting jump");
    }
    
    // Variable jump height by checking if jump button is released while still moving upward
    if (playerEntity.isJumping && playerEntity.vy < 0) {
      if (!input.isActionActive('jump')) {
        // Cut the jump short if button released
        if (playerEntity.vy < playerEntity.jumpReleaseVelocity) {
          playerEntity.vy = playerEntity.jumpReleaseVelocity;
        }
      }
    }
    
    // Mark jump as released when button is up
    if (!input.isActionActive('jump')) {
      playerEntity.jumpReleased = true;
    }
    
    // Apply gravity if not on rope
    if (!playerEntity.onRope) {
      playerEntity.vy += playerEntity.gravity * timeScale;
      
      // Limit fall speed
      if (playerEntity.vy > playerEntity.maxFallSpeed) {
        playerEntity.vy = playerEntity.maxFallSpeed;
      }
    } else {
      // On rope movement (climb up/down)
      const verticalInput = input.getVerticalAxis();
      playerEntity.vy = verticalInput * 2.0;
    }
    
    // Update position
    playerEntity.x += playerEntity.vx * timeScale;
    playerEntity.y += playerEntity.vy * timeScale;
    
    // Update animation state based on movement
    updatePlayerAnimation();
    
    // Bounds checking to keep player in screen
    if (playerEntity.x < 0) playerEntity.x = 0;
    if (playerEntity.x > 248) playerEntity.x = 248;
    if (playerEntity.y < 0) playerEntity.y = 0;
    if (playerEntity.y > 192 - playerEntity.height) {
      playerEntity.y = 192 - playerEntity.height;
      playerEntity.vy = 0;
      playerEntity.onGround = true;
    }
  }
  
  /**
   * Updates player animation state based on movement
   */
  function updatePlayerAnimation() {
    // Reset all animation states
    for (const state in playerEntity.animationStates) {
      playerEntity.animationStates[state] = false;
    }
    
    // Set current animation based on player state
    if (playerEntity.dead) {
      playerEntity.animationStates.death = true;
      playerEntity.currentAnimation = 'death';
    } else if (!playerEntity.onGround) {
      if (playerEntity.vy < 0) {
        // Going up = jump
        playerEntity.animationStates.jump = true;
        playerEntity.currentAnimation = 'jump';
      } else {
        // Going down = fall
        playerEntity.animationStates.fall = true;
        playerEntity.currentAnimation = 'fall';
      }
    } else if (Math.abs(playerEntity.vx) > 0.1) {
      // Moving = walk
      playerEntity.animationStates.walk = true;
      playerEntity.currentAnimation = 'walk';
    } else {
      // Standing still = idle
      playerEntity.animationStates.idle = true;
      playerEntity.currentAnimation = 'idle';
    }
  }
  
  /**
   * Update all entities including platforms and enemies
   * @param {number} deltaTime - Time since last update in ms
   */
  function updateEntities(deltaTime) {
    // Update each entity based on its type
    for (const entity of entities) {
      // Skip removed entities
      if (entity.removed) continue;
      
      switch (entity.type) {
        case ENTITY_TYPES.GUARDIAN:
        case ENTITY_TYPES.ENEMY:
          updateGuardian(entity, deltaTime);
          break;
        case ENTITY_TYPES.LIFT:
        case ENTITY_TYPES.MOVING_PLATFORM:
          updateMovingPlatform(entity, deltaTime);
          break;
        case ENTITY_TYPES.CONVEYOR:
          // Update animation frame
          entity.frameTime += deltaTime;
          if (entity.frameTime >= entity.animationSpeed) {
            entity.currentFrame = (entity.currentFrame + 1) % 4;
            entity.frameTime = 0;
          }
          break;
        case ENTITY_TYPES.COLLECTIBLE:
        case ENTITY_TYPES.KEY:
          // Update animation frame
          entity.frameTime += deltaTime;
          if (entity.frameTime >= entity.animationSpeed) {
            entity.currentFrame = (entity.currentFrame + 1) % 4;
            entity.frameTime = 0;
          }
          break;
        case ENTITY_TYPES.ROPE:
          // Update rope swing animation
          entity.phase += deltaTime * 0.001 * entity.swingSpeed;
          entity.offsetX = Math.sin(entity.phase) * entity.swingAmplitude;
          break;
        case ENTITY_TYPES.BOSS:
          updateBoss(entity, deltaTime);
          break;
      }
    }
  }
  
  /**
   * Update a guardian entity with enhanced behaviors
   * @param {Object} entity - Guardian entity
   * @param {number} deltaTime - Time since last update in ms
   */
  function updateGuardian(entity, deltaTime) {
    if (entity.defeated) return;
    
    const timeScale = deltaTime / 16.7; // Scale for 60fps
    
    // Update animation frame
    entity.frameTime += deltaTime;
    if (entity.frameTime >= entity.animationSpeed) {
      entity.currentFrame = (entity.currentFrame + 1) % 4;
      entity.frameTime = 0;
    }
    
    // Different behaviors based on subtype
    switch(entity.behavior) {
      case 'patrol':
        // Move horizontally
        entity.x += entity.speed * entity.direction * timeScale;
        
        // Update facing direction
        entity.facingRight = entity.direction > 0;
        
        // Check boundaries
        if (entity.x <= entity.minX) {
          entity.x = entity.minX;
          entity.direction = 1;
        } else if (entity.x >= entity.maxX) {
          entity.x = entity.maxX;
          entity.direction = -1;
        }
        break;
        
      case 'bounce':
        // Move with velocity
        entity.x += entity.vx * timeScale;
        entity.y += entity.vy * timeScale;
        
        // Update facing direction
        entity.facingRight = entity.vx > 0;
        
        // Bounce off boundaries
        if (entity.x <= entity.minX) {
          entity.x = entity.minX;
          entity.vx = Math.abs(entity.vx);
        } else if (entity.x >= entity.maxX) {
          entity.x = entity.maxX;
          entity.vx = -Math.abs(entity.vx);
        }
        
        // Vertical bounce
        if (entity.y <= 0) {
          entity.y = 0;
          entity.vy = Math.abs(entity.vy);
        } else if (entity.y >= 192 - entity.height) {
          entity.y = 192 - entity.height;
          entity.vy = -Math.abs(entity.vy);
        }
        break;
        
      case 'follow':
        // Follow player if within detection radius
        if (playerEntity && !playerEntity.dead) {
          const dx = playerEntity.x - entity.x;
          const dy = playerEntity.y - entity.y;
          const distance = Math.sqrt(dx*dx + dy*dy);
          
          if (distance < entity.detectRadius) {
            // Move toward player at follow speed
            const followSpeed = 0.7;
            const angle = Math.atan2(dy, dx);
            
            entity.vx = Math.cos(angle) * followSpeed;
            entity.vy = Math.sin(angle) * followSpeed;
            
            // Update facing direction
            entity.facingRight = dx > 0;
            
            // Move
            entity.x += entity.vx * timeScale;
            entity.y += entity.vy * timeScale;
          } else {
            // Return to patrol behavior
            entity.x += entity.speed * entity.direction * timeScale;
            entity.facingRight = entity.direction > 0;
            
            // Check boundaries
            if (entity.x <= entity.minX) {
              entity.x = entity.minX;
              entity.direction = 1;
            } else if (entity.x >= entity.maxX) {
              entity.x = entity.maxX;
              entity.direction = -1;
            }
          }
        }
        break;
        
      case 'jumper':
        // Enemy that jumps periodically
        entity.jumpTimer = (entity.jumpTimer || 0) - deltaTime;
        
        if (entity.onGround && entity.jumpTimer <= 0) {
          // Jump
          entity.vy = -entity.jumpPower;
          entity.onGround = false;
          entity.jumpTimer = 2000 + Math.random() * 1000; // Random time between jumps
        }
        
        // Apply gravity
        if (!entity.onGround) {
          entity.vy += 0.2 * timeScale;
        }
        
        // Move horizontally
        entity.x += entity.speed * entity.direction * timeScale;
        
        // Update facing direction
        entity.facingRight = entity.direction > 0;
        
        // Check boundaries
        if (entity.x <= entity.minX) {
          entity.x = entity.minX;
          entity.direction = 1;
        } else if (entity.x >= entity.maxX) {
          entity.x = entity.maxX;
          entity.direction = -1;
        }
        break;
        
      default:
        // Simple horizontal patrol as fallback
        entity.x += entity.speed * entity.direction * timeScale;
        
        // Update facing direction
        entity.facingRight = entity.direction > 0;
        
        // Check boundaries
        if (entity.x <= entity.minX) {
          entity.x = entity.minX;
          entity.direction = 1;
        } else if (entity.x >= entity.maxX) {
          entity.x = entity.maxX;
          entity.direction = -1;
        }
        break;
    }
  }
  
  /**
   * Update a moving platform entity
   * @param {Object} entity - Platform entity
   * @param {number} deltaTime - Time since last update in ms
   */
  function updateMovingPlatform(entity, deltaTime) {
    const timeScale = deltaTime / 16.7; // Scale for 60fps
    
    // Store last position for player movement
    entity.lastX = entity.x;
    entity.lastY = entity.y;
    
    switch (entity.movementType) {
      case 'horizontal':
        // Horizontal movement
        entity.x += entity.vx * timeScale;
        
        // Check boundaries
        if (entity.x <= entity.bounds.left) {
          entity.x = entity.bounds.left;
          entity.vx *= -1;
        } else if (entity.x + entity.width >= entity.bounds.right) {
          entity.x = entity.bounds.right - entity.width;
          entity.vx *= -1;
        }
        break;
        
      case 'vertical':
        // Vertical movement
        entity.y += entity.vy * timeScale;
        
        // Check boundaries
        if (entity.y <= entity.bounds.top) {
          entity.y = entity.bounds.top;
          entity.vy *= -1;
        } else if (entity.y + entity.height >= entity.bounds.bottom) {
          entity.y = entity.bounds.bottom - entity.height;
          entity.vy *= -1;
        }
        break;
        
      case 'circular':
        // Circular movement pattern
        const time = performance.now() / 1000;
        const centerX = (entity.bounds.left + entity.bounds.right) / 2;
        const centerY = (entity.bounds.top + entity.bounds.bottom) / 2;
        const radiusX = (entity.bounds.right - entity.bounds.left) / 2;
        const radiusY = (entity.bounds.bottom - entity.bounds.top) / 2;
        
        entity.x = centerX + Math.cos(time * entity.vx) * radiusX - entity.width / 2;
        entity.y = centerY + Math.sin(time * entity.vy) * radiusY - entity.height / 2;
        break;
        
      default:
        // Simple oscillation as fallback
        const t = performance.now() / 1000;
        
        // Horizontal oscillation
        if (entity.vx !== 0) {
          const centerX = (entity.bounds.left + entity.bounds.right) / 2;
          const rangeX = (entity.bounds.right - entity.bounds.left) / 2;
          entity.x = centerX + Math.sin(t * entity.vx) * rangeX - entity.width / 2;
        }
        
        // Vertical oscillation
        if (entity.vy !== 0) {
          const centerY = (entity.bounds.top + entity.bounds.bottom) / 2;
          const rangeY = (entity.bounds.bottom - entity.bounds.top) / 2;
          entity.y = centerY + Math.sin(t * entity.vy) * rangeY - entity.height / 2;
        }
        break;
    }
  }
  
  /**
   * Update a boss entity with more complex behavior
   * @param {Object} entity - Boss entity
   * @param {number} deltaTime - Time since last update in ms
   */
  function updateBoss(entity, deltaTime) {
    if (entity.defeated) return;
    
    const timeScale = deltaTime / 16.7; // Scale for 60fps
    
    // Update animation frame
    entity.frameTime += deltaTime;
    if (entity.frameTime >= entity.animationSpeed) {
      entity.currentFrame = (entity.currentFrame + 1) % 4;
      entity.frameTime = 0;
    }
    
    // Update attack cooldown
    entity.attackTimer -= deltaTime;
    
    // State machine for boss behavior
    switch (entity.state) {
      case 'chase':
        // Move toward player
        if (playerEntity && !playerEntity.dead) {
          const dx = playerEntity.x - entity.x;
          const dy = playerEntity.y - entity.y;
          const distance = Math.sqrt(dx*dx + dy*dy);
          
          // Face player
          entity.facingRight = dx > 0;
          
          // Move toward player
          const angle = Math.atan2(dy, dx);
          entity.x += Math.cos(angle) * entity.speed * timeScale;
          entity.y += Math.sin(angle) * entity.speed * timeScale;
          
          // If close to player, prepare to attack
          if (distance < 50 && entity.attackTimer <= 0) {
            entity.state = 'attack';
            entity.attackTimer = entity.attackCooldown;
          }
        }
        break;
        
      case 'attack':
        // Perform attack animation
        entity.currentFrame = 4 + Math.floor(entity.frameTime / 100) % 4; // Use attack frames
        
        // After attack animation, go back to chase
        if (entity.attackTimer <= entity.attackCooldown - 500) {
          entity.state = 'chase';
        }
        break;
        
      case 'hurt':
        // Hurt animation
        entity.currentFrame = 8 + Math.floor(entity.frameTime / 100) % 2; // Use hurt frames
        
        // After hurt animation, go back to chase
        if (entity.hurtTimer <= 0) {
          entity.state = 'chase';
        }
        break;
    }
    
    // Ensure boss stays within room bounds
    if (entity.x < 0) entity.x = 0;
    if (entity.x > 256 - entity.width) entity.x = 256 - entity.width;
    if (entity.y < 0) entity.y = 0;
    if (entity.y > 192 - entity.height) entity.y = 192 - entity.height;
  }
  
  /**
   * Handle platform collisions for player with improved collision response
   * @param {Object} gridData - Room grid data for tile collisions
   */
  function handlePlayerPlatformCollisions(gridData) {
    if (!playerEntity) return;
    
    // Reset ground state
    let wasOnGround = playerEntity.onGround;
    playerEntity.onGround = false;
    playerEntity.standingPlatform = null;
    
    // Get all platform entities
    const platforms = entities.filter(e => 
      (e.type === ENTITY_TYPES.PLATFORM || 
       e.type === ENTITY_TYPES.SLOPE || 
       e.type === ENTITY_TYPES.MOVING_PLATFORM || 
       e.type === ENTITY_TYPES.LIFT || 
       e.type === ENTITY_TYPES.CONVEYOR) && 
      !e.hidden && !e.removed
    );
    
    for (const platform of platforms) {
      switch(platform.type) {
        case ENTITY_TYPES.PLATFORM:
        case ENTITY_TYPES.LIFT:
        case ENTITY_TYPES.MOVING_PLATFORM:
        case ENTITY_TYPES.CONVEYOR:
          // Standard platform collision
          if (isColliding(playerEntity, platform)) {
            // Check if player is landing on top of platform
            if (playerEntity.vy >= 0 && playerEntity.y + playerEntity.height - playerEntity.vy <= platform.y + 2) {
              // Land on platform
              playerEntity.y = platform.y - playerEntity.height;
              playerEntity.vy = 0;
              playerEntity.onGround = true;
              playerEntity.isJumping = false;
              playerEntity.standingPlatform = platform.id;
              
              // Move with platform if it's moving
              if (platform.type === ENTITY_TYPES.MOVING_PLATFORM || platform.type === ENTITY_TYPES.LIFT) {
                // Transfer platform movement to player
                playerEntity.x += platform.x - platform.lastX;
              }
              
              // Apply conveyor belt effect
              if (platform.type === ENTITY_TYPES.CONVEYOR) {
                playerEntity.x += platform.direction * platform.speed;
              }
            } 
            // Wall collision from the sides
            else if (playerEntity.x + playerEntity.width > platform.x && 
                      playerEntity.x < platform.x + platform.width) {
              // If moving right and hit left side of platform
              if (playerEntity.vx > 0 && playerEntity.x + playerEntity.width - playerEntity.vx <= platform.x + 2) {
                playerEntity.x = platform.x - playerEntity.width;
                playerEntity.vx = 0;
              }
              // If moving left and hit right side of platform
              else if (playerEntity.vx < 0 && playerEntity.x - playerEntity.vx >= platform.x + platform.width - 2) {
                playerEntity.x = platform.x + platform.width;
                playerEntity.vx = 0;
              }
              
              // Ceiling collision (hitting bottom of platform while jumping)
              if (playerEntity.vy < 0 && playerEntity.y - playerEntity.vy >= platform.y + platform.height - 2) {
                playerEntity.y = platform.y + platform.height;
                playerEntity.vy = 0;
              }
            }
          }
          break;
          
        case ENTITY_TYPES.SLOPE:
          // Sloped platform - more advanced collision
          if (playerEntity.x + playerEntity.width > platform.x && 
              playerEntity.x < platform.x + platform.width) {
            // Calculate Y position at this X based on slope angle
            const playerCenterX = playerEntity.x + playerEntity.width / 2;
            const slopeProgress = (playerCenterX - platform.x) / platform.width;
            let slopeY;
            
            if (platform.angle > 0) {
              // Rising slope (left to right)
              slopeY = platform.y + platform.height - (slopeProgress * platform.height);
            } else {
              // Falling slope (left to right)
              slopeY = platform.y + (slopeProgress * platform.height);
            }
            
            // Check if player is on or slightly above the slope
            if (playerEntity.y + playerEntity.height >= slopeY - 2 && 
                playerEntity.y + playerEntity.height <= slopeY + 5 &&
                playerEntity.vy >= 0) {
              playerEntity.y = slopeY - playerEntity.height;
              playerEntity.onGround = true;
              playerEntity.isJumping = false;
              
              // Apply slight horizontal slowdown when going uphill
              if ((playerEntity.vx > 0 && platform.angle > 0) || 
                  (playerEntity.vx < 0 && platform.angle < 0)) {
                playerEntity.vx *= 0.95; // Slow down a bit when going uphill
              }
            }
          }
          break;
      }
    }
    
    // Check collision with tile map if available
    if (gridData && Array.isArray(gridData)) {
      // Get player grid position
      const gridX = Math.floor(playerEntity.x / 8);
      const gridY = Math.floor(playerEntity.y / 8);
      const gridX2 = Math.floor((playerEntity.x + playerEntity.width) / 8);
      const gridY2 = Math.floor((playerEntity.y + playerEntity.height) / 8);
      
      // Check grid cells player is overlapping
      for (let y = gridY; y <= gridY2; y++) {
        for (let x = gridX; x <= gridX2; x++) {
          // Skip out of bounds indices
          if (y < 0 || y >= gridData.length || x < 0 || x >= gridData[y].length) continue;
          
          const tile = gridData[y][x];
          
          // Skip empty tiles (0)
          if (tile === 0) continue;
          
          // Create a temporary collision box for this tile
          const tileBox = {
            x: x * 8,
            y: y * 8,
            width: 8,
            height: 8
          };
          
          // Check collision with tile
          if (isColliding(playerEntity, tileBox)) {
            // Handle collision based on tile type
            if (tile === 1) { // Solid tile
              // Determine best direction to resolve collision
              const overlapLeft = playerEntity.x + playerEntity.width - tileBox.x;
              const overlapRight = tileBox.x + tileBox.width - playerEntity.x;
              const overlapTop = playerEntity.y + playerEntity.height - tileBox.y;
              const overlapBottom = tileBox.y + tileBox.height - playerEntity.y;
              
              // Find the smallest overlap
              const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
              
              // Resolve collision in direction of smallest overlap
              if (minOverlap === overlapLeft) {
                // Colliding from left
                playerEntity.x = tileBox.x - playerEntity.width;
                playerEntity.vx = 0;
              } else if (minOverlap === overlapRight) {
                // Colliding from right
                playerEntity.x = tileBox.x + tileBox.width;
                playerEntity.vx = 0;
              } else if (minOverlap === overlapTop) {
                // Colliding from top (landing)
                playerEntity.y = tileBox.y - playerEntity.height;
                playerEntity.vy = 0;
                playerEntity.onGround = true;
                playerEntity.isJumping = false;
              } else if (minOverlap === overlapBottom) {
                // Colliding from bottom (hitting ceiling)
                playerEntity.y = tileBox.y + tileBox.height;
                playerEntity.vy = 0;
              }
            }
          }
        }
      }
    }
    
    // Play landing sound if just landed
    if (!wasOnGround && playerEntity.onGround) {
      // Sound effect would go here
      console.log("Player landed!");
    }
  }
  
  /**
   * Check if player is colliding with any interactive entities
   * @returns {Object|null} Colliding entity or null if none
   */
  function checkPlayerEntityCollisions() {
    if (!playerEntity) return null;
    
    // Check each entity
    for (const entity of entities) {
      // Skip platforms/slopes which are handled separately
      if (entity.type === ENTITY_TYPES.PLATFORM || 
          entity.type === ENTITY_TYPES.SLOPE || 
          entity.type === ENTITY_TYPES.MOVING_PLATFORM) {
        continue;
      }
      
      // Skip removed entities
      if (entity.removed || entity.hidden) continue;
      
      // Check collision
      if (isColliding(playerEntity, entity)) {
        // Handle collision based on entity type
        switch (entity.type) {
          case ENTITY_TYPES.COLLECTIBLE:
            collectItem(entity);
            break;
          case ENTITY_TYPES.KEY:
            collectKey(entity);
            break;
          case ENTITY_TYPES.GUARDIAN:
          case ENTITY_TYPES.ENEMY:
          case ENTITY_TYPES.BOSS:
            // Check if player is jumping on enemy from above
            if (playerEntity.vy > 1 && playerEntity.y + playerEntity.height - playerEntity.vy <= entity.y + 4) {
              // Defeat enemy
              entity.defeated = true;
              
              // Bounce player off enemy
              playerEntity.vy = playerEntity.jumpVelocity * 0.6; // Small bounce
              
              // Add score
              playerEntity.score += entity.value || 50;
              console.log("Defeated enemy! Score:", playerEntity.score);
            } else if (entity.deadly && !entity.defeated) {
              // Log detailed info about the deadly collision
              console.log("Deadly collision with:", {
                entity: { type: entity.type, id: entity.id, x: entity.x, y: entity.y },
                player: { x: playerEntity.x, y: playerEntity.y },
                distance: { 
                  x: Math.abs(entity.x - playerEntity.x),
                  y: Math.abs(entity.y - playerEntity.y)
                }
              });
              return entity; // Return deadly entity for death handling
            }
            break;
          case ENTITY_TYPES.DOOR:
            // Door logic is handled separately
            break;
          case ENTITY_TYPES.ROPE:
            playerEntity.onRope = true;
            break;
          case ENTITY_TYPES.LIFT:
          case ENTITY_TYPES.CONVEYOR:
            if (entity.solid && 
                playerEntity.y + playerEntity.height <= entity.y + 2 &&
                playerEntity.vy >= 0) {
              // Player is standing on platform
              playerEntity.y = entity.y - playerEntity.height;
              playerEntity.vy = 0;
              playerEntity.onGround = true;
              playerEntity.standingPlatform = entity.id;
              
              // Apply conveyor belt effect
              if (entity.type === ENTITY_TYPES.CONVEYOR) {
                playerEntity.x += entity.direction * entity.speed;
              }
            }
            break;
        }
        
        // Mark entities as colliding for visual effects
        entity.colliding = true;
      } else {
        entity.colliding = false;
        
        // Clear rope state if not on rope
        if (entity.type === ENTITY_TYPES.ROPE && playerEntity.onRope) {
          playerEntity.onRope = false;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Check if player is touching a door and trying to use it
   * @param {boolean} actionPressed - Whether action button is pressed
   * @returns {Object|null} Door entity or null if not using any door
   */
  function checkDoorUse(actionPressed) {
    if (!playerEntity || !actionPressed) return null;
    
    // Find all doors
    const doors = entities.filter(e => e.type === ENTITY_TYPES.DOOR && !e.hidden && !e.removed);
    
    for (const door of doors) {
      if (isColliding(playerEntity, door)) {
        // Check if door is locked
        if (door.locked) {
          // If player has keys, unlock the door
          if (playerEntity.keys > 0) {
            door.locked = false;
            playerEntity.keys--;
            return { action: 'unlock', door };
          } else {
            return { action: 'locked', door };
          }
        } else {
          // Enter unlocked door
          return { action: 'enter', door };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Handle collecting an item with enhanced effects
   * @param {Object} item - Collectible entity
   */
  function collectItem(item) {
    if (item.collected) return;
    
    // Mark as collected
    item.collected = true;
    item.removed = true;
    
    // Add to player's collection
    playerEntity.collectedItems.add(item.id);
    
    // Add to score
    playerEntity.score += item.value || 10;
    console.log("Collected item! Score:", playerEntity.score);
    
    // Return item value for score
    return item.value || 10;
  }
  
  /**
   * Handle collecting a key
   * @param {Object} key - Key entity
   */
  function collectKey(key) {
    if (key.collected) return;
    
    // Mark as collected
    key.collected = true;
    key.removed = true;
    
    // Give key to player
    playerEntity.keys++;
    
    // Add to score
    playerEntity.score += 50;
    console.log("Collected key! Keys:", playerEntity.keys);
    
    // Return key value for score
    return 50;
  }
  
  /**
   * Check if two entities are colliding
   * @param {Object} entity1 - First entity
   * @param {Object} entity2 - Second entity
   * @returns {boolean} True if entities are colliding
   */
  function isColliding(entity1, entity2) {
    return (
      entity1.x < entity2.x + entity2.width &&
      entity1.x + entity1.width > entity2.x &&
      entity1.y < entity2.y + entity2.height &&
      entity1.y + entity1.height > entity2.y
    );
  }
  
  /**
   * Reset entity states
   */
  function resetEntities() {
    entities.forEach(entity => {
      // Reset states for all entities
      entity.colliding = false;
      
      // Type-specific resets
      if (entity.type === ENTITY_TYPES.COLLECTIBLE || entity.type === ENTITY_TYPES.KEY) {
        entity.collected = false;
        entity.removed = false;
      }
      
      if (entity.type === ENTITY_TYPES.GUARDIAN || entity.type === ENTITY_TYPES.ENEMY || 
          entity.type === ENTITY_TYPES.BOSS) {
        entity.defeated = false;
      }
    });
  }
  
  /**
   * Get player entity
   * @returns {Object} Player entity
   */
  function getPlayer() {
    return playerEntity;
  }
  
  // Public API
  return {
    createPlayer,
    createEntity,
    loadRoomEntities,
    getAllEntities,
    getEntityById,
    getEntitiesByType,
    updateEntities,
    updatePlayerPhysics,
    updatePlayerAnimation,
    handlePlayerPlatformCollisions,
    checkPlayerEntityCollisions,
    checkDoorUse,
    resetEntities,
    getPlayer,
    isColliding,
    collectItem,
    collectKey,
    ENTITY_TYPES
  };
})();

// For use in Node.js environment (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Entities;
}