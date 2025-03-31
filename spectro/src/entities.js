/**
 * Entities.js - Game entity management
 * Handles creation, updating, and collision checking for game entities
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
    BACKGROUND: 'background'  // For decorative elements in the room
  };
  
  // Width/height for entity collision (8 pixels for standard characters)
  const ENTITY_SIZE = 8;
  
  // Entity collections
  let playerEntity = null;
  let entities = [];
  let entitiesById = {};
  
  /**
   * Create the player entity
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
      width: ENTITY_SIZE,
      height: ENTITY_SIZE,
      facingLeft: false,
      onGround: false,
      onRope: false,
      standingPlatform: null,
      isJumping: false,
      jumpTime: 0,
      maxJumpTime: 350, // ms
      collectedItems: new Set(),
      hasKey: false,
      // Animation state
      animState: 'stand', // stand, walk, jump
      animStateTime: 0
    };
    
    return playerEntity;
  }
  
  /**
   * Create a game entity
   * @param {Object} entityData - Entity data
   * @returns {Object} Entity object
   */
  function createEntity(entityData) {
    const entity = {
      ...entityData,
      width: entityData.width || ENTITY_SIZE,
      height: entityData.height || ENTITY_SIZE,
      hidden: false,
      removed: false,
      colliding: false,
      // Add extra properties based on entity type
      ...getEntityTypeProperties(entityData.type)
    };
    
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
          collected: false
        };
      case ENTITY_TYPES.GUARDIAN:
      case ENTITY_TYPES.ENEMY:
        return {
          speed: 1,
          direction: 1,
          minX: 0,
          maxX: 256,
          deadly: true
        };
      case ENTITY_TYPES.DOOR:
        return {
          locked: false,
          destinationRoom: null
        };
      case ENTITY_TYPES.KEY:
        return {
          collected: false
        };
      case ENTITY_TYPES.ROPE:
        return {
          height: 32,
          phase: 0
        };
      case ENTITY_TYPES.LIFT:
        return {
          width: 32,
          height: 8,
          originalY: 0,
          lastY: 0,
          solid: true
        };
      case ENTITY_TYPES.CONVEYOR:
        return {
          width: 32,
          height: 8,
          direction: 1,
          speed: 0.5,
          solid: true
        };
      case ENTITY_TYPES.BOSS:
        return {
          width: 16,
          height: 16,
          health: 3,
          speed: 0.8,
          deadly: true
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
   * Update all entities
   * @param {number} deltaTime - Time since last update in ms
   * @param {Array} gridData - Room grid data for collision
   */
  function updateEntities(deltaTime, gridData) {
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
          updateLift(entity, deltaTime);
          break;
        case ENTITY_TYPES.CONVEYOR:
          // Static, no update needed
          break;
        case ENTITY_TYPES.BOSS:
          updateBoss(entity, deltaTime);
          break;
        // Other entity types...
      }
    }
  }
  
  /**
   * Update a guardian entity
   * @param {Object} entity - Guardian entity
   * @param {number} deltaTime - Time since last update in ms
   */
  function updateGuardian(entity, deltaTime) {
    // Move horizontally
    entity.x += entity.speed * entity.direction * deltaTime / 16;
    
    // Check boundaries
    if (entity.x <= entity.minX) {
      entity.x = entity.minX;
      entity.direction = 1;
    } else if (entity.x >= entity.maxX) {
      entity.x = entity.maxX;
      entity.direction = -1;
    }
  }
  
  /**
   * Update a lift entity
   * @param {Object} entity - Lift entity
   * @param {number} deltaTime - Time since last update in ms
   */
  function updateLift(entity, deltaTime) {
    // Store last position for player movement
    entity.lastY = entity.y;
    
    // Simple vertical oscillation
    const time = performance.now() / 1000;
    const newY = entity.originalY + Math.sin(time) * 24;
    
    entity.y = newY;
  }
  
  /**
   * Update a boss entity
   * @param {Object} entity - Boss entity
   * @param {number} deltaTime - Time since last update in ms
   */
  function updateBoss(entity, deltaTime) {
    // More complex movement pattern for boss
    const time = performance.now() / 1000;
    
    // Circular movement pattern
    const radius = 16;
    const centerX = (entity.minX + entity.maxX) / 2;
    const centerY = entity.y;
    
    entity.x = centerX + Math.sin(time * entity.speed) * radius;
    entity.y = centerY + Math.cos(time * entity.speed) * radius / 2;
  }
  
  /**
   * Check if player is colliding with any entities
   * @returns {Object|null} Colliding entity or null if none
   */
  function checkPlayerEntityCollisions() {
    if (!playerEntity) return null;
    
    // Check each entity
    for (const entity of entities) {
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
            if (entity.deadly) {
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
          // If player has a key, unlock the door
          if (playerEntity.hasKey) {
            door.locked = false;
            playerEntity.hasKey = false;
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
   * Handle collecting an item
   * @param {Object} item - Collectible entity
   */
  function collectItem(item) {
    if (item.collected) return;
    
    // Mark as collected
    item.collected = true;
    item.removed = true;
    
    // Add to player's collection
    playerEntity.collectedItems.add(item.id);
    
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
    playerEntity.hasKey = true;
    
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