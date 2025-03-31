/**
 * Rooms.js - Game levels and layouts
 * Defines the rooms, their layouts, and entities for Jet Set Willy
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
  
  // Room definitions
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
      // Room connections
      leftExit: null,
      rightExit: "quirkafleeg",
      topExit: null,
      bottomExit: null,
      // Initial entities in the room
      entities: [
        { type: "guardian", id: "offLicGuard", x: 80, y: 80, speed: 1.2, direction: 1, minX: 72, maxX: 144 },
        { type: "collectible", id: "coin1", x: 120, y: 64 },
        { type: "collectible", id: "coin2", x: 160, y: 64 },
        { type: "door", id: "offLicDoor", x: 208, y: 72, destinationRoom: "quirkafleeg", locked: false },
        // Background decorations using ZX spectrum patterns instead of emojis
        { type: "background", id: "plant1", x: 40, y: 40 },
        { type: "background", id: "plant2", x: 120, y: 24 },
        { type: "background", id: "plant3", x: 176, y: 32 }
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
      leftExit: "offLicence",
      rightExit: "kitchens",
      topExit: null,
      bottomExit: null,
      entities: [
        { type: "guardian", id: "qGuard1", x: 64, y: 64, speed: 1.5, direction: 1, minX: 64, maxX: 112 },
        { type: "guardian", id: "qGuard2", x: 176, y: 64, speed: 1.5, direction: -1, minX: 128, maxX: 176 },
        { type: "collectible", id: "coin3", x: 96, y: 64 },
        { type: "collectible", id: "coin4", x: 152, y: 64 },
        { type: "door", id: "qDoor", x: 232, y: 64, destinationRoom: "kitchens", locked: false },
        // Space-themed background elements using patterns instead of emojis
        { type: "background", id: "star1", x: 40, y: 24, patternIndex: 1, colorIndex: 7, bright: true }, // Bright white stars
        { type: "background", id: "star2", x: 96, y: 16, patternIndex: 1, colorIndex: 7, bright: true },
        { type: "background", id: "star3", x: 160, y: 32, patternIndex: 1, colorIndex: 7, bright: true },
        { type: "background", id: "star4", x: 224, y: 24, patternIndex: 1, colorIndex: 7, bright: true }
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
      leftExit: "quirkafleeg",
      rightExit: "banyanTree",
      topExit: "masterBedroom",
      bottomExit: null,
      entities: [
        { type: "guardian", id: "kGuard1", x: 32, y: 80, speed: 1.0, direction: 1, minX: 32, maxX: 80 },
        { type: "guardian", id: "kGuard2", x: 176, y: 80, speed: 1.3, direction: -1, minX: 128, maxX: 176 },
        { type: "collectible", id: "coin5", x: 72, y: 32 },
        { type: "collectible", id: "coin6", x: 144, y: 64 },
        { type: "door", id: "kDoor1", x: 232, y: 104, destinationRoom: "banyanTree", locked: false },
        { type: "door", id: "kDoor2", x: 112, y: 16, destinationRoom: "masterBedroom", locked: false },
        // Ocean-themed background elements using patterns instead of emojis
        { type: "background", id: "water1", x: 40, y: 24, patternIndex: 0, colorIndex: 1, bright: true }, // Blue dots for water
        { type: "background", id: "water2", x: 120, y: 16, patternIndex: 2, colorIndex: 5, bright: false }, // Cyan lines for ripples
        { type: "background", id: "shell", x: 192, y: 32, patternIndex: 3, colorIndex: 7, bright: false } // White grid pattern for shell
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
      leftExit: "kitchens",
      rightExit: null,
      topExit: "bathroom",
      bottomExit: null,
      entities: [
        { type: "guardian", id: "bGuard1", x: 80, y: 96, speed: 1.8, direction: 1, minX: 64, maxX: 128 },
        { type: "guardian", id: "bGuard2", x: 160, y: 96, speed: 1.4, direction: -1, minX: 112, maxX: 208 },
        { type: "collectible", id: "coin7", x: 32, y: 40 },
        { type: "collectible", id: "coin8", x: 96, y: 40 },
        { type: "collectible", id: "coin9", x: 192, y: 64 },
        { type: "door", id: "bDoor", x: 144, y: 24, destinationRoom: "bathroom", locked: false },
        // Dungeon-themed background elements using patterns instead of emojis
        { type: "background", id: "spiderweb", x: 48, y: 16, patternIndex: 2, colorIndex: 3, bright: false }, // Magenta lines for spider web
        { type: "background", id: "bat", x: 112, y: 24, patternIndex: 0, colorIndex: 7, bright: false }, // White dots for bat
        { type: "background", id: "candle", x: 224, y: 48, patternIndex: 1, colorIndex: 6, bright: true } // Bright yellow stars for candle
      ]
    },
    {
      id: "masterBedroom",
      name: "The Master Bedroom",
      backgroundColor: MAGENTA,
      backgroundBright: false,
      layout: [
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [2,2,2,2,2,2],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
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
      leftExit: null,
      rightExit: "bathroom",
      topExit: null,
      bottomExit: "kitchens",
      entities: [
        { type: "guardian", id: "mGuard1", x: 48, y: 48, speed: 1.0, direction: 1, minX: 32, maxX: 80 },
        { type: "guardian", id: "mGuard2", x: 144, y: 64, speed: 1.2, direction: -1, minX: 96, maxX: 200 },
        { type: "collectible", id: "coin10", x: 128, y: 48 },
        { type: "collectible", id: "coin11", x: 192, y: 48 },
        { type: "door", id: "mDoor1", x: 128, y: 112, destinationRoom: "kitchens", locked: false },
        { type: "door", id: "mDoor2", x: 224, y: 48, destinationRoom: "bathroom", locked: false },
        // Nature-themed decoration using patterns
        { type: "background", id: "mPlant1", x: 56, y: 32, patternIndex: 0, colorIndex: 4, bright: true }, // Green dots for plants
        { type: "background", id: "mPlant2", x: 176, y: 40, patternIndex: 2, colorIndex: 4, bright: false }, // Green lines for stems
        { type: "background", id: "mPlant3", x: 112, y: 56, patternIndex: 3, colorIndex: 4, bright: true } // Green grid for foliage
      ]
    },
    {
      id: "bathroom",
      name: "The Bathroom",
      backgroundColor: CYAN,
      backgroundBright: true,
      layout: [
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [0,0,0,0,0,0],
        [2,2,2,2,2,2],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,3,3,0],
        [2,0,0,3,3,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,1,1,0,0,1],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,1,1,1,1,1]
      ],
      leftExit: "masterBedroom",
      rightExit: "attic",
      topExit: null,
      bottomExit: "banyanTree",
      entities: [
        { type: "guardian", id: "bathroomGuard1", x: 48, y: 80, speed: 1.1, direction: 1, minX: 32, maxX: 96 },
        { type: "guardian", id: "bathroomGuard2", x: 176, y: 80, speed: 1.3, direction: -1, minX: 128, maxX: 208 },
        { type: "collectible", id: "coin12", x: 128, y: 40 },
        { type: "collectible", id: "coin13", x: 208, y: 40 },
        { type: "door", id: "bathDoor1", x: 24, y: 72, destinationRoom: "masterBedroom", locked: false },
        { type: "door", id: "bathDoor2", x: 128, y: 112, destinationRoom: "banyanTree", locked: false },
        { type: "door", id: "bathDoor3", x: 224, y: 72, destinationRoom: "attic", locked: false },
        // Bathroom-themed decor with patterns
        { type: "background", id: "bathWater1", x: 64, y: 56, patternIndex: 0, colorIndex: 5, bright: true }, // Cyan dots for water droplets
        { type: "background", id: "bathWater2", x: 120, y: 32, patternIndex: 2, colorIndex: 5, bright: true }, // Cyan lines for water streams
        { type: "background", id: "bathShell", x: 192, y: 40, patternIndex: 3, colorIndex: 5, bright: false } // Cyan grid pattern for tiles
      ]
    },
    {
      id: "attic",
      name: "The Attic",
      backgroundColor: BLACK,
      backgroundBright: false,
      layout: [
        [2,2,2,2,2,2],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,1,1,1,1],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,1,1,1,1],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,1,1,1,1],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,1,1,1,1,1]
      ],
      leftExit: "bathroom",
      rightExit: "cellar",
      topExit: null,
      bottomExit: null,
      entities: [
        { type: "guardian", id: "atticGuard1", x: 64, y: 32, speed: 1.0, direction: 1, minX: 32, maxX: 96 },
        { type: "guardian", id: "atticGuard2", x: 128, y: 56, speed: 1.2, direction: -1, minX: 96, maxX: 160 },
        { type: "guardian", id: "atticGuard3", x: 192, y: 80, speed: 1.3, direction: 1, minX: 160, maxX: 208 },
        { type: "collectible", id: "coin14", x: 56, y: 24 },
        { type: "collectible", id: "coin15", x: 128, y: 24 },
        { type: "collectible", id: "coin16", x: 208, y: 24 },
        { type: "door", id: "atticDoor1", x: 24, y: 56, destinationRoom: "bathroom", locked: false },
        { type: "door", id: "atticDoor2", x: 224, y: 56, destinationRoom: "cellar", locked: true },
        { type: "key", id: "atticKey", x: 128, y: 104 },
        // Space-themed attic decorations
        { type: "background", id: "astar1", x: 40, y: 16, patternIndex: 1, colorIndex: 7, bright: true }, // Bright white stars
        { type: "background", id: "astar2", x: 112, y: 24, patternIndex: 1, colorIndex: 7, bright: true },
        { type: "background", id: "astar3", x: 160, y: 16, patternIndex: 1, colorIndex: 7, bright: true }
      ]
    },
    {
      id: "cellar",
      name: "The Cellar",
      backgroundColor: RED,
      backgroundBright: false,
      layout: [
        [0,0,0,0,0,0],
        [2,2,2,2,2,2],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,3,3,0],
        [2,0,0,3,3,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,0,0,0,0,0],
        [2,1,1,1,1,1]
      ],
      leftExit: "attic",
      rightExit: null,
      topExit: null,
      bottomExit: null,
      entities: [
        { type: "guardian", id: "cellarGuard1", x: 96, y: 80, speed: 0.8, direction: 1, minX: 32, maxX: 160 },
        { type: "guardian", id: "cellarGuard2", x: 96, y: 96, speed: 1.2, direction: -1, minX: 32, maxX: 160 },
        { type: "collectible", id: "coin17", x: 32, y: 24 },
        { type: "collectible", id: "coin18", x: 128, y: 24 },
        { type: "collectible", id: "coin19", x: 32, y: 96 },
        { type: "collectible", id: "finalCoin", x: 112, y: 72, value: 500 },
        { type: "door", id: "cellarDoor", x: 24, y: 56, destinationRoom: "attic", locked: false },
        // Dungeon-themed decor with patterns
        { type: "background", id: "cspider", x: 64, y: 16, patternIndex: 2, colorIndex: 2, bright: false }, // Red lines for cobwebs
        { type: "background", id: "cbat", x: 144, y: 24, patternIndex: 0, colorIndex: 2, bright: true }, // Bright red dots for eyes
        { type: "background", id: "ccoffin", x: 40, y: 56, patternIndex: 3, colorIndex: 2, bright: false } // Red grid for coffin
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
    const currentIndex = rooms.findIndex(r => r.id === currentRoomId);
    if (currentIndex === -1) return rooms[0].id;
    
    const nextIndex = (currentIndex + 1) % rooms.length;
    return rooms[nextIndex].id;
  }
  
  /**
   * Get the previous room in sequence
   * @param {string} currentRoomId - Current room ID
   * @returns {string} Previous room ID
   */
  function getPrevRoom(currentRoomId) {
    const currentIndex = rooms.findIndex(r => r.id === currentRoomId);
    if (currentIndex === -1) return rooms[0].id;
    
    const prevIndex = (currentIndex - 1 + rooms.length) % rooms.length;
    return rooms[prevIndex].id;
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
  
  // Public API
  return {
    getRoom,
    getNextRoom,
    getPrevRoom,
    getAllRoomIds,
    getRoomCount
  };
})();

// For use in Node.js environment (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Rooms;
}