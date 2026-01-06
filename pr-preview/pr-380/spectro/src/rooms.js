/**
 * Rooms.js - Enhanced room management for the Spectro platformer game
 * Handles room definitions, layouts, and transitions
 */

const Rooms = (() => {
  // Define layout constants
  const EMPTY = 0;     // Empty space
  const FLOOR = 1;     // Solid floor
  const WALL = 2;      // Solid wall
  const HAZARD = 3;    // Deadly hazard
  const SPECIAL = 4;   // Special tile
  
  // ZX Spectrum colors
  const BLACK = 0;
  const BLUE = 1;
  const RED = 2;
  const MAGENTA = 3;
  const GREEN = 4;
  const CYAN = 5;
  const YELLOW = 6;
  const WHITE = 7;
  
  /**
   * Room layout format:
   * Each room is a 2D array of numbers representing tile types
   * The layout is sized for the ZX Spectrum's visible area (excluding borders)
   * 24x32 characters minus borders = a game grid of approximately 24x24
   */
  
  // Custom decompression function to convert compressed data to room layouts
  function decompress(data) {
    // Decompress ZX Spectrum-style byte data into a 2D array
    // This is a simplified version for clarity
    const grid = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = [];
      for (let j = 0; j < data[i].length; j++) {
        const byte = data[i][j];
        
        // Each byte contains 4 tiles (2 bits per tile)
        row.push((byte >> 6) & 3);
        row.push((byte >> 4) & 3);
        row.push((byte >> 2) & 3);
        row.push(byte & 3);
      }
      grid.push(row);
    }
    
    return grid;
  }
  
  // Enhanced room definitions with platformer features
  const rooms = [
    {
      id: "offLicence",
      name: "The Off Licence",
      backgroundColor: BLUE,
      backgroundBright: false,
      // Compressed layout data (6 bytes per row, 16 rows total)
      layout: [
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,170,170,170],
        [0,0,0,128,0,0],
        [0,0,0,128,0,0],
        [0,0,0,140,0,0],
        [0,0,0,128,0,0],
        [0,0,0,128,0,0],
        [0,0,0,128,0,0],
        [0,0,0,170,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [85,85,85,85,85,85]
      ],
      // Platform definitions for the room - including regular, sloped, and moving platforms
      platforms: [
        // Bottom floor
        {
          type: 'platform',
          x: 16,
          y: 184,
          width: 224,
          height: 8
        },
        // Middle platforms
        {
          type: 'platform',
          x: 32,
          y: 112,
          width: 64,
          height: 8
        },
        // Moving platform
        {
          type: 'moving_platform',
          x: 112,
          y: 80,
          width: 32,
          height: 8,
          vx: 0.5,
          vy: 0,
          bounds: {
            left: 112,
            right: 160,
            top: 80,
            bottom: 80
          },
          movementType: 'horizontal'
        }
      ],
      // Room connections
      leftExit: null,
      rightExit: "quirkafleeg",
      topExit: null,
      bottomExit: null,
      // Player start position (or respawn position)
      playerStart: { x: 48, y: 160 },
      // Initial entities in the room with enhanced properties
      entities: [
        { 
          type: "guardian", 
          id: "offLicGuard", 
          x: 80, 
          y: 80, 
          speed: 1.2, 
          direction: 1, 
          minX: 72, 
          maxX: 144,
          behavior: 'patrol',
          deadly: true
        },
        { 
          type: "collectible", 
          id: "coin1", 
          x: 120, 
          y: 64,
          value: 10
        },
        { 
          type: "collectible", 
          id: "coin2", 
          x: 160, 
          y: 64,
          value: 10
        },
        { 
          type: "door", 
          id: "offLicDoor", 
          x: 208, 
          y: 72, 
          destinationRoom: "quirkafleeg", 
          locked: false,
          exitDirection: 'right'
        }
      ]
    },
    {
      id: "quirkafleeg",
      name: "We Must Perform a Quirkafleeg",
      backgroundColor: BLACK,
      backgroundBright: false,
      // Compressed layout data
      layout: [
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [170,0,0,0,0,0],
        [170,64,0,0,0,0],
        [170,64,0,0,0,0],
        [170,64,0,0,0,0],
        [170,64,0,0,0,0],
        [170,64,0,0,0,0],
        [170,127,255,255,255,255]
      ],
      // Enhanced platforms with slopes
      platforms: [
        // Bottom floor
        {
          type: 'platform',
          x: 16,
          y: 184,
          width: 224,
          height: 8
        },
        // Left platforms
        {
          type: 'platform',
          x: 16,
          y: 112,
          width: 48,
          height: 8
        },
        // Central sloped platform
        {
          type: 'slope',
          x: 64,
          y: 144,
          width: 128,
          height: 24,
          angle: 45 // 45 degrees upward slope
        },
        // Right platform
        {
          type: 'platform',
          x: 192,
          y: 112,
          width: 48,
          height: 8
        }
      ],
      leftExit: "offLicence",
      rightExit: "kitchens",
      topExit: null,
      bottomExit: null,
      playerStart: { x: 32, y: 160 },
      entities: [
        { 
          type: "guardian", 
          id: "qGuard1", 
          x: 100, 
          y: 64, 
          speed: 1.5, 
          direction: 1, 
          minX: 80, 
          maxX: 112,
          behavior: 'patrol',
          deadly: true
        },
        { 
          type: "guardian", 
          id: "qGuard2", 
          x: 150, 
          y: 64, 
          speed: 1.5, 
          direction: -1, 
          minX: 128, 
          maxX: 176,
          behavior: 'patrol',
          deadly: true
        },
        { 
          type: "collectible", 
          id: "coin3", 
          x: 96, 
          y: 64,
          value: 10
        },
        { 
          type: "collectible", 
          id: "coin4", 
          x: 152, 
          y: 64,
          value: 10
        },
        { 
          type: "door", 
          id: "qDoor", 
          x: 232, 
          y: 64, 
          destinationRoom: "kitchens", 
          locked: false,
          exitDirection: 'right'
        }
      ]
    },
    {
      id: "kitchens",
      name: "To the Kitchens",
      backgroundColor: CYAN,
      backgroundBright: false,
      layout: [
        [0,0,128,0,0,0],
        [0,0,128,0,0,0],
        [0,0,128,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,1,149,85,85,80],
        [0,0,128,0,0,0],
        [0,0,128,0,0,0],
        [165,85,133,0,0,0],
        [160,0,128,0,0,0],
        [160,0,128,0,1,64],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [170,170,170,170,170,170],
        [170,170,170,170,170,170]
      ],
      // Enhanced platforms with moving platforms
      platforms: [
        // Bottom floors
        {
          type: 'platform',
          x: 16,
          y: 184,
          width: 224,
          height: 8
        },
        // Middle platform
        {
          type: 'platform',
          x: 32,
          y: 80,
          width: 96,
          height: 8
        },
        // Moving platforms (vertical)
        {
          type: 'moving_platform',
          x: 160,
          y: 120,
          width: 32,
          height: 8,
          vx: 0,
          vy: 0.5,
          bounds: {
            left: 160,
            right: 160,
            top: 80,
            bottom: 136
          },
          movementType: 'vertical'
        },
        // Right platform
        {
          type: 'platform',
          x: 192,
          y: 112,
          width: 48,
          height: 8
        }
      ],
      leftExit: "quirkafleeg",
      rightExit: "banyanTree",
      topExit: "atticRoom",
      bottomExit: null,
      playerStart: { x: 32, y: 64 },
      entities: [
        { 
          type: "guardian", 
          id: "kGuard1", 
          x: 32, 
          y: 64, 
          speed: 1.0, 
          direction: 1, 
          minX: 32, 
          maxX: 80,
          behavior: 'patrol',
          deadly: true
        },
        { 
          type: "enemy", 
          id: "kGuard2", 
          x: 176, 
          y: 96, 
          width: 16, 
          height: 16,
          speed: 0.8, 
          jumpPower: 4.5,
          behavior: 'jumper',
          deadly: true
        },
        { 
          type: "collectible", 
          id: "coin5", 
          x: 72, 
          y: 32,
          value: 10
        },
        { 
          type: "collectible", 
          id: "coin6", 
          x: 144, 
          y: 64,
          value: 10
        },
        { 
          type: "door", 
          id: "kDoor1", 
          x: 232, 
          y: 96, 
          destinationRoom: "banyanTree", 
          locked: false,
          exitDirection: 'right'
        },
        { 
          type: "door", 
          id: "kDoor2", 
          x: 112, 
          y: 16, 
          destinationRoom: "atticRoom", 
          locked: true,
          exitDirection: 'up'
        },
        {
          type: "key",
          id: "kitchenKey",
          x: 208,
          y: 96
        }
      ]
    },
    {
      id: "banyanTree",
      name: "The Banyan Tree",
      backgroundColor: GREEN,
      backgroundBright: false,
      layout: [
        [0,0,0,160,0,0],
        [0,0,0,160,0,0],
        [0,0,0,144,0,0],
        [0,0,0,148,0,0],
        [0,0,0,149,80,0],
        [0,0,0,129,8,0],
        [0,0,0,1,4,0],
        [0,0,0,0,4,0],
        [0,0,0,128,0,0],
        [0,0,0,130,0,0],
        [0,8,32,130,8,0],
        [0,8,32,130,8,0],
        [170,170,170,170,170,170],
        [170,170,0,0,0,0],
        [170,170,0,0,0,0],
        [170,170,85,85,85,85]
      ],
      // Complex platform layouts with multiple slope angles
      platforms: [
        // Bottom floor
        {
          type: 'platform',
          x: 16,
          y: 184,
          width: 224,
          height: 8
        },
        // Tree platforms
        {
          type: 'platform',
          x: 16,
          y: 160,
          width: 64,
          height: 8
        },
        // Sloped platforms (branches)
        {
          type: 'slope',
          x: 80,
          y: 144,
          width: 64,
          height: 16,
          angle: 30 // Gentle upward slope
        },
        {
          type: 'slope',
          x: 144,
          y: 128,
          width: 48,
          height: 16,
          angle: -30 // Gentle downward slope
        },
        // Top platform
        {
          type: 'platform',
          x: 192,
          y: 112,
          width: 48,
          height: 8
        },
        // Moving platform (circular)
        {
          type: 'moving_platform',
          x: 128,
          y: 80,
          width: 32,
          height: 8,
          vx: 0.3,
          vy: 0.3,
          bounds: {
            left: 96,
            right: 160,
            top: 48,
            bottom: 96
          },
          movementType: 'circular'
        }
      ],
      leftExit: "kitchens",
      rightExit: null,
      topExit: "atticRoom",
      bottomExit: null,
      playerStart: { x: 32, y: 136 },
      entities: [
        { 
          type: "guardian", 
          id: "bGuard1", 
          x: 80, 
          y: 120, 
          speed: 1.0, 
          direction: 1, 
          minX: 64, 
          maxX: 128,
          behavior: 'patrol',
          deadly: true
        },
        { 
          type: "enemy", 
          id: "flyingGuard", 
          x: 160, 
          y: 64, 
          vx: 0.8, 
          vy: 0.5,
          behavior: 'bounce',
          deadly: true
        },
        { 
          type: "collectible", 
          id: "coin7", 
          x: 32, 
          y: 136,
          value: 10
        },
        { 
          type: "collectible", 
          id: "coin8", 
          x: 96, 
          y: 112,
          value: 10
        },
        { 
          type: "collectible", 
          id: "coin9", 
          x: 192, 
          y: 96,
          value: 10
        },
        { 
          type: "door", 
          id: "bDoor", 
          x: 128, 
          y: 24, 
          destinationRoom: "atticRoom", 
          locked: false,
          exitDirection: 'up'
        },
        {
          type: "rope",
          id: "climbingRope",
          x: 208,
          y: 112,
          height: 64,
          swingSpeed: 0.5,
          swingAmplitude: 4
        }
      ]
    },
    {
      id: "atticRoom",
      name: "The Attic Room",
      backgroundColor: MAGENTA,
      backgroundBright: false,
      layout: [
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [2,2,2,2,2,2],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,1,1,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,1,1,1,1,1]
      ],
      // Advanced platform layout with boss encounter arena
      platforms: [
        // Bottom floor
        {
          type: 'platform',
          x: 32,
          y: 184,
          width: 208,
          height: 8
        },
        // Middle platform for boss arena
        {
          type: 'platform',
          x: 128,
          y: 112,
          width: 64,
          height: 8
        },
        // Moving platforms for reaching boss
        {
          type: 'moving_platform',
          x: 64,
          y: 144,
          width: 32,
          height: 8,
          vx: 0.7,
          vy: 0,
          bounds: {
            left: 64,
            right: 112,
            top: 144,
            bottom: 144
          },
          movementType: 'horizontal'
        },
        {
          type: 'moving_platform',
          x: 192,
          y: 144,
          width: 32,
          height: 8,
          vx: 0.7,
          vy: 0,
          bounds: {
            left: 160,
            right: 208,
            top: 144,
            bottom: 144
          },
          movementType: 'horizontal'
        },
        // Top ledges
        {
          type: 'platform',
          x: 32,
          y: 64,
          width: 40,
          height: 8
        },
        {
          type: 'platform',
          x: 192,
          y: 64,
          width: 40,
          height: 8
        }
      ],
      leftExit: null,
      rightExit: null,
      topExit: null,
      bottomExit: "kitchens",
      playerStart: { x: 64, y: 160 },
      entities: [
        // Boss entity
        {
          type: "boss",
          id: "atticBoss",
          x: 128,
          y: 80,
          width: 24,
          height: 24,
          health: 3,
          speed: 0.8,
          deadly: true,
          attackCooldown: 2000,
          state: 'chase',
          value: 500
        },
        // Guardians
        { 
          type: "guardian", 
          id: "aGuard1", 
          x: 48, 
          y: 48, 
          speed: 1.2, 
          direction: 1, 
          minX: 32, 
          maxX: 72,
          behavior: 'patrol',
          deadly: true
        },
        { 
          type: "guardian", 
          id: "aGuard2", 
          x: 208, 
          y: 48, 
          speed: 1.2, 
          direction: -1, 
          minX: 192, 
          maxX: 232,
          behavior: 'patrol',
          deadly: true
        },
        // Collectibles
        { 
          type: "collectible", 
          id: "coin10", 
          x: 56, 
          y: 40,
          value: 10
        },
        { 
          type: "collectible", 
          id: "coin11", 
          x: 208, 
          y: 40,
          value: 10
        },
        { 
          type: "collectible", 
          id: "coin12", 
          x: 128, 
          y: 40,
          value: 50
        },
        // Doors
        { 
          type: "door", 
          id: "aDoor1", 
          x: 64, 
          y: 156, 
          destinationRoom: "kitchens", 
          locked: false,
          exitDirection: 'down'
        },
        {
          type: "door",
          id: "finalDoor",
          x: 192,
          y: 96,
          destinationRoom: "theWatch",
          locked: true,
          exitDirection: 'right',
          requiresAllItems: true
        },
        // Keys
        {
          type: "key",
          id: "atticKey",
          x: 128,
          y: 96
        },
        // Rope for climbing
        {
          type: "rope",
          id: "atticRope1",
          x: 112,
          y: 64,
          height: 48,
          swingSpeed: 0.3,
          swingAmplitude: 2
        },
        {
          type: "rope",
          id: "atticRope2",
          x: 160,
          y: 64,
          height: 48,
          swingSpeed: 0.3,
          swingAmplitude: 2
        }
      ]
    },
    {
      id: "theWatch",
      name: "The Watch", // Final room
      backgroundColor: YELLOW,
      backgroundBright: true,
      layout: [
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [85,85,85,85,85,85]
      ],
      // Victory room with special platforms
      platforms: [
        // Bottom floor
        {
          type: 'platform',
          x: 16,
          y: 184,
          width: 224,
          height: 8
        },
        // Victory platform
        {
          type: 'platform',
          x: 112,
          y: 112,
          width: 64,
          height: 8
        }
      ],
      leftExit: "atticRoom",
      rightExit: null,
      topExit: null,
      bottomExit: null,
      playerStart: { x: 32, y: 160 },
      entities: [
        // Victory collectible
        { 
          type: "collectible", 
          id: "victoryCoin", 
          x: 128, 
          y: 80,
          value: 1000
        },
        // Moving platforms to reach victory
        {
          type: 'moving_platform',
          x: 64,
          y: 144,
          width: 32,
          height: 8,
          vx: 0,
          vy: 0.5,
          bounds: {
            left: 64,
            right: 64,
            top: 112,
            bottom: 160
          },
          movementType: 'vertical'
        },
        {
          type: 'moving_platform',
          x: 192,
          y: 144,
          width: 32,
          height: 8,
          vx: 0,
          vy: 0.5,
          bounds: {
            left: 192,
            right: 192,
            top: 112,
            bottom: 160
          },
          movementType: 'vertical'
        },
        // Exit door back to attic
        { 
          type: "door", 
          id: "watchDoor", 
          x: 32, 
          y: 168, 
          destinationRoom: "atticRoom", 
          locked: false,
          exitDirection: 'left'
        }
      ]
    }
  ];
  
  /**
   * Get a room by ID
   * @param {string} roomId - Room identifier
   * @returns {Object} Room data with decompressed layout
   */
  function getRoom(roomId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return null;
    
    // Create a new object to avoid modifying the original
    const roomWithLayout = { ...room };
    
    // Decompress the layout
    roomWithLayout.layout = decompress(room.layout);
    
    return roomWithLayout;
  }
  
  /**
   * Get the next room in sequence
   * @param {string} currentRoomId - Current room ID
   * @returns {string} Next room ID
   */
  function getNextRoom(currentRoomId) {
    const room = rooms.find(r => r.id === currentRoomId);
    if (!room) return rooms[0].id;
    
    return room.rightExit || currentRoomId;
  }
  
  /**
   * Get the previous room in sequence
   * @param {string} currentRoomId - Current room ID
   * @returns {string} Previous room ID
   */
  function getPrevRoom(currentRoomId) {
    const room = rooms.find(r => r.id === currentRoomId);
    if (!room) return rooms[0].id;
    
    return room.leftExit || currentRoomId;
  }
  
  /**
   * Get the room above the current room
   * @param {string} currentRoomId - Current room ID
   * @returns {string} Room ID above or null
   */
  function getTopRoom(currentRoomId) {
    const room = rooms.find(r => r.id === currentRoomId);
    if (!room) return null;
    
    return room.topExit || null;
  }
  
  /**
   * Get the room below the current room
   * @param {string} currentRoomId - Current room ID
   * @returns {string} Room ID below or null
   */
  function getBottomRoom(currentRoomId) {
    const room = rooms.find(r => r.id === currentRoomId);
    if (!room) return null;
    
    return room.bottomExit || null;
  }
  
  /**
   * Get all room IDs
   * @returns {Array} Array of room IDs
   */
  function getAllRoomIds() {
    return rooms.map(room => room.id);
  }
  
  /**
   * Get room count
   * @returns {number} Total number of rooms
   */
  function getRoomCount() {
    return rooms.length;
  }
  
  /**
   * Get the player start position for a room
   * @param {string} roomId - Room ID
   * @returns {Object} Player start position {x, y}
   */
  function getPlayerStartPosition(roomId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room || !room.playerStart) {
      return { x: 128, y: 160 }; // Default position
    }
    
    return room.playerStart;
  }
  
  /**
   * Get the room in a specified direction
   * @param {string} currentRoomId - Current room ID
   * @param {string} direction - Direction to check ('left', 'right', 'up', 'down')
   * @returns {string} Room ID in that direction or null
   */
  function getRoomInDirection(currentRoomId, direction) {
    const room = rooms.find(r => r.id === currentRoomId);
    if (!room) return null;
    
    switch (direction) {
      case 'left':
        return room.leftExit;
      case 'right':
        return room.rightExit;
      case 'up':
        return room.topExit;
      case 'down':
        return room.bottomExit;
      default:
        return null;
    }
  }
  
  // Public API
  return {
    getRoom,
    getNextRoom,
    getPrevRoom,
    getTopRoom,
    getBottomRoom,
    getAllRoomIds,
    getRoomCount,
    getPlayerStartPosition,
    getRoomInDirection
  };
})();

// For use in Node.js environment (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Rooms;
}