// Waterworld codex — one true(ish) line of London history per artifact.
// Educational payload for the salvage loop: shown once, on the first find
// of each type, and collected in the codex. Keep entries short, factual
// and tasteful. No dataset-derived personal content (CLAUDE.md rule).

export const FACTS = {
  clay_pipe: {
    name: 'Clay pipe',
    icon: '🪈',
    value: 10,
    text: 'Clay tobacco pipes are the mudlark’s commonest find — Londoners smoked and tossed them from Elizabethan times onward, three centuries of disposable pipes.',
  },
  green_bottle: {
    name: 'Green bottle',
    icon: '🍾',
    value: 10,
    text: 'For centuries London barged its rubbish downriver, which is why the Thames foreshore glitters with old glass.',
  },
  sugar_barrel: {
    name: 'Sugar barrel',
    icon: '🛢️',
    value: 20,
    text: 'The West India Docks opened in 1802 to land sugar and rum produced by enslaved people in the Caribbean — wealth with a heavy shadow.',
  },
  cannonball: {
    name: 'Cannonball',
    icon: '⚫',
    value: 25,
    text: 'Pirates — Captain Kidd among them, in 1701 — were hanged at Execution Dock in Wapping, at the low-water mark of the Thames.',
  },
  roman_coin: {
    name: 'Roman coin',
    icon: '🪙',
    value: 40,
    text: 'The Romans founded Londinium around AD 47. The Thames riverbed is effectively Britain’s longest archaeological site.',
  },
  whale_bone: {
    name: 'Whale bone',
    icon: '🦴',
    value: 30,
    text: 'Whale strandings on the Thames have been recorded since 1240. In 2006 a northern bottlenose whale swam right past Parliament.',
  },
  ships_bell: {
    name: 'Ship’s bell',
    icon: '🔔',
    value: 35,
    text: 'A bell was a ship’s voice in fog — and salvaged bells are often how a wreck gets its name back.',
  },
  tea_chest: {
    name: 'Tea chest',
    icon: '🫖',
    value: 20,
    text: 'Clippers like the Cutty Sark raced to bring each season’s first tea to London — fortunes turned on a few days of wind.',
  },
  figurehead: {
    name: 'Figurehead',
    icon: '🗿',
    value: 45,
    text: 'Sailors believed a ship’s figurehead carried her spirit. Losing one was a terrible omen.',
  },
  anchor_chain: {
    name: 'Anchor chain',
    icon: '⛓️',
    value: 15,
    text: 'Dock chains and anchors were forged so well that Victorian ironwork still comes up barely rusted from the anaerobic Thames mud.',
  },
  fatberg_relic: {
    name: 'Fatberg core',
    icon: '🧈',
    value: 50,
    text: 'The 2017 Whitechapel fatberg was 250 metres long and weighed about 130 tonnes. A chunk of it went on display at the Museum of London.',
  },
  dolphin_visit: {
    name: 'Thames dolphins',
    icon: '🐬',
    value: 0,
    text: 'Bottlenose dolphins and porpoises really do follow fish up the Thames — sightings run from Gravesend to Putney.',
  },
  shark_visit: {
    name: 'Thames sharks',
    icon: '🦈',
    value: 0,
    text: 'The Thames estuary has real sharks — tope, starry smooth-hound and spurdog. The smooth-hounds mostly eat crabs.',
  },
  eel_zap: {
    name: 'London eels',
    icon: '⚡',
    value: 0,
    text: 'The Thames once ran thick with eels — jellied eels fed the East End, and Eel Pie Island still carries the name. Electric ones are… a local embellishment.',
  },
  seal_visit: {
    name: 'Thames seal',
    icon: '🦭',
    value: 0,
    text: 'Harbour and grey seals really do live in the Thames — conservationists count hundreds in the annual seal survey.',
  },
  captains_chest: {
    name: 'Captain’s chest',
    icon: '🏴‍☠️',
    value: 250,
    text: 'Legend says condemned pirates sank their takings in the docks rather than let the Crown have them. Legends, of course, are sometimes true.',
  },
};

// Quest items — combine in pairs, adventure-style. Auto-crafts when you
// hold both halves.
export const QUEST_ITEMS = {
  magnet: { name: 'Bar magnet', icon: '🧲', pairsWith: 'rope', makes: 'grapple' },
  rope: { name: 'Tarred rope', icon: '🪢', pairsWith: 'magnet', makes: 'grapple' },
  lamp: { name: 'Arc lamp', icon: '🏮', pairsWith: 'battery', makes: 'arclamp' },
  battery: { name: 'Wet cell', icon: '🔋', pairsWith: 'lamp', makes: 'arclamp' },
  soda: { name: 'Soda crate', icon: '📦', pairsWith: 'nozzle', makes: 'fizzlance' },
  nozzle: { name: 'Brass nozzle', icon: '🔩', pairsWith: 'soda', makes: 'fizzlance' },
};

export const TOOLS = {
  grapple: {
    name: 'Magnet grapple', icon: '🪝',
    text: 'Magnet + rope. Hauls heavy salvage — even a pirate chest — off the dock floor.',
  },
  arclamp: {
    name: 'Arc lamp', icon: '💡',
    text: 'Lamp + wet cell. Burns through the dark of the old culvert tunnels.',
  },
  fizzlance: {
    name: 'Fizz lance', icon: '🫧',
    text: 'Soda + nozzle. Fizzes fatbergs apart — the sewer crews used jets much like it.',
  },
};

export const HINTS = [
  'B pings the sonar: it lights up salvage, stuns eels up close, and sets off mines at a safe distance.',
  'Bank your cargo at the diving bell — a bigger haul means a bigger bonus, but air is short.',
  'Fatbergs block the culverts. Something fizzy might shift them.',
  'The deep basin is dark. You’ll want a light.',
  'They say a pale whale still swims the dock. Follow her.',
];
