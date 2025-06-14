// Generated image descriptions for Riverbend story
// Automatically created by Claude Code

export const imageDescriptions = {
  "village_overview.png": {
    description: "Picturesque village scene with thatched-roof cottages along a winding river path, rolling green hills in the background, vibrant gardens and trees creating an idyllic countryside setting",
    mood: "peaceful, welcoming, pastoral",
    characters: "none",
    location: "village overview"
  },
  
  "elara_cottage.png": {
    description: "Stone cottage with orange thatched roof, chimney smoke, colorful flower garden, picket fence, rolling green hills and tree in background during daytime",
    mood: "cozy, homey, tranquil",
    characters: "none",
    location: "Elara's cottage exterior"
  },
  
  "peaceful_sunset.png": {
    description: "Same stone cottage during dramatic sunset/dusk with purple and orange sky, golden lighting, same garden and tree creating a romantic evening atmosphere",
    mood: "serene, contemplative, ending",
    characters: "none", 
    location: "Elara's cottage at sunset"
  },
  
  "neighbor_gardening.png": {
    description: "Two women talking in a village street - an elderly woman in blue and a younger woman in white lab coat, surrounded by abundant rose bushes, Tudor-style houses in background",
    mood: "friendly, conversational, secretive",
    characters: "Mrs. Gable (elderly), Elara (young woman)",
    location: "village street near roses"
  },
  
  "mrs_gable_wary.png": {
    description: "Close-up of elderly woman's face showing wariness and suspicion, grey hair, brown eyes, slight frown expressing concern or distrust",
    mood: "suspicious, guarded, warning",
    characters: "Mrs. Gable",
    location: "close-up portrait"
  },
  
  "children_playing.png": {
    description: "Village square scene with children and adults playing cricket, Tudor-style houses with timber framing in background, cheerful outdoor activity",
    mood: "playful, community, innocent",
    characters: "village children, adults",
    location: "village square"
  },
  
  "old_mill.png": {
    description: "Atmospheric view of old water mill with wooden waterwheel beside flowing stream, weathered timber construction, moss and ivy growth, forest setting",
    mood: "mysterious, abandoned, atmospheric",
    characters: "none",
    location: "old mill exterior"
  },
  
  "elara_approaching_mill_day.png": {
    description: "Young woman in blue dress walking along dirt path toward old mill building through forest, distant view showing her from behind approaching the mysterious structure",
    mood: "curious, determined, approaching mystery",
    characters: "Elara (distant figure)",
    location: "path to mill"
  },
  
  "inside_dilapidated_mill.png": {
    description: "Interior of abandoned mill showing old wooden machinery, mill wheels, support beams, dusty atmosphere with sunlight streaming through gaps, cobwebs visible",
    mood: "abandoned, dusty, forgotten",
    characters: "none",
    location: "mill interior"
  },
  
  "metal_door.png": {
    description: "Heavy blue metal door with rivets set into old stone wall, appears modern and well-maintained compared to surrounding ancient stonework",
    mood: "mysterious, anachronistic, hidden",
    characters: "none",
    location: "secret door"
  },
  
  "look_for_clues.png": {
    description: "Hand reaching toward blue metal door with rivets, finger pointing or about to press, suggesting investigation or interaction with the mechanism",
    mood: "investigative, tentative, discovery",
    characters: "hand only",
    location: "at the metal door"
  },
  
  "hidden_inscription.png": {
    description: "Ancient inscription carved into dark stone or metal beam, showing weathered text that appears to be in an old script or cipher",
    mood: "ancient, mysterious, cryptic",
    characters: "none",
    location: "hidden inscription detail"
  },
  
  "roman_numerals.png": {
    description: "Close-up of carved Roman numerals 'VDIX' etched into dark stone or metal surface, appears weathered and ancient",
    mood: "ancient, puzzle-like, significant",
    characters: "none", 
    location: "gear or machinery marking"
  },
  
  "search_mill_interior.png": {
    description: "Young woman in blue dress exploring inside the mill, reaching toward machinery or walls, sunlight streaming through windows creating dramatic lighting",
    mood: "investigative, determined, searching",
    characters: "Elara",
    location: "inside mill during search"
  },
  
  "elara_thinking.png": {
    description: "Young woman with brown hair sitting at desk in library or study, surrounded by bookshelves, lamp, books, and research materials, appearing contemplative",
    mood: "thoughtful, scholarly, planning",
    characters: "Elara",
    location: "library/study"
  },
  
  "elara_metal_door.png": {
    description: "Young woman in blue shirt kneeling before the metal door, hands pressed against the stone wall beside it, searching for clues or mechanisms",
    mood: "determined, investigative, focused",
    characters: "Elara", 
    location: "at the secret door"
  },
  
  "elara_looking_for_clues.png": {
    description: "Close-up profile of young woman with dark hair examining old stone wall intently, hand touching the weathered surface as she searches for hidden details",
    mood: "focused, detective-like, concentrated",
    characters: "Elara",
    location: "examining stone wall"
  },
  
  "elara_reading_inscription.png": {
    description: "Close-up of young woman's face as she reads ancient carved text, hand positioned near the inscription, intense concentration visible",
    mood: "deciphering, concentrated, revelation",
    characters: "Elara",
    location: "reading the hidden inscription"
  },
  
  "elara_searching_details.png": {
    description: "Hands carefully examining old mill machinery or metal mechanisms, fingers tracing surfaces to find hidden details or moving parts",
    mood: "methodical, careful, investigative",
    characters: "hands only",
    location: "examining mill machinery"
  }
};

// Helper function to get image data
export function getImageData(filename) {
  return imageDescriptions[filename] || {
    description: "Image not found in catalog",
    mood: "unknown",
    characters: "unknown", 
    location: "unknown"
  };
}

// Get all images by mood
export function getImagesByMood(mood) {
  return Object.entries(imageDescriptions)
    .filter(([filename, data]) => data.mood.includes(mood))
    .map(([filename, data]) => ({filename, ...data}));
}

// Get all images with specific character
export function getImagesByCharacter(character) {
  return Object.entries(imageDescriptions)
    .filter(([filename, data]) => data.characters.includes(character))
    .map(([filename, data]) => ({filename, ...data}));
}