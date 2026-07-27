// Waterworld campaign — THE RISING. Newly sentient fatbergs stir beneath
// the dock and mean to take the city. You cannot fight them alone: build
// a coalition of three — the unquiet ghosts of the whales, the divided
// tribes of the electric eels, and the river itself, appeased by what
// you do with the East India Company's ill-gotten rubies. Then herd the
// risen bergs into Blight Corner and let the Eel Federation light it up.
//
// This module is the story state machine. game.js owns the world and
// calls in; quests.js decides what the campaign wants next.

export const STORY_FACTS = {
  bergs_wake: {
    title: 'THE RISING',
    icon: '🟤',
    text: 'The bergs are waking. Fat, wipes and grease, dreaming under London since the sewers were young — and now they want the city. You cannot stop them alone, Captain. Build a coalition of three.',
  },
  steelyard: {
    title: 'THE STEELYARD',
    icon: '⚓',
    text: 'The Hanseatic League traded from the Steelyard for 400 years — Cannon Street Station stands on it now. Old ground, older law: what is buried there is remembered. The whale ghosts ask to rest in remembered ground.',
  },
  whale_lament: {
    title: 'THE LAMENT',
    icon: '🐋',
    text: 'London burned whale oil for light and boiled spermaceti for candles. The whales were never mourned. A loudspeaker — magnet and living current — can carry a song sad enough to be heard by the dead. If they can hear. If they are there at all.',
  },
  candle_barge: {
    title: 'PALE & SONS',
    icon: '🕯️',
    text: 'The Pale family lit Mayfair on whale fat for six generations. Their candle drones still ship "heritage spermaceti blend". The ghosts will not join you while that barge floats.',
  },
  eel_schism: {
    title: 'THE EEL SCHISM',
    icon: '⚡',
    text: 'The tribes split over the Eel Pie Charter: who holds the island, who holds the current. The charter was torn in three and the pieces scattered. Find them, and the tribes can read what was actually agreed.',
  },
  eel_federation: {
    title: 'THE EEL FEDERATION',
    icon: '🤝',
    text: 'The charter, restored, says what both tribes forgot: the island was held IN COMMON. The tribes unite. The Federation grants you a spark-cell — a jar of living lightning, for when the moment comes.',
  },
  eic_rubies: {
    title: 'ILL-GOTTEN GAINS',
    icon: '💎',
    text: 'The East India Company strongbox: uncut rubies, taken and never returned. The river remembers every cargo. Use them if you must, Captain — but what you return, the river repays.',
  },
  river_folk: {
    title: 'THE RIVER FOLK',
    icon: '🦭',
    text: 'The seals, the dolphins, the bright fish — the river folk saw what you gave back. The third seat of the coalition is taken.',
  },
  the_corralling: {
    title: 'BLIGHT CORNER',
    icon: '💥',
    text: 'The plan: the whale ghosts fear-herd the bergs wherever your sonar sings. The vents gas them fat with methane. And when every berg is penned in Blight Corner — the Federation throws the spark.',
  },
  victory: {
    title: 'THE END',
    icon: '🎆',
    text: 'Methane, whale-song and one unified spark. The bergs go up over Blight Corner like a second Great Fire, backwards. Democracy is saved. Somewhere in City Hall, a stinky wet wipe lands in the Mayor\'s lunch. The end.',
  },
}

// Coalition seats and their arc definitions.
export class Campaign {
  constructor(game) {
    this.g = game;
    this.stage = 'dormant';         // dormant → rising → finale → spark → won
    this.coalition = { whales: false, eels: false, river: false };
    // whale arc: bones → bury → speaker → lament → barge → JOINED
    this.whale = { step: 'bones', bonesBuried: 0, bargeHits: 0 };
    // eel arc: parley → fragments → restore → JOINED
    this.eel = { step: 'parley', parleyed: new Set(), fragments: 0, returned: new Set() };
    // ruby arc: chest → decide (per ruby) → JOINED (3+ returned)
    this.ruby = { step: 'chest', held: 0, returned: 0, spent: 0 };
    this.finale = { bergs: [], penned: 0, sparked: false };
    this._facted = new Set();
  }

  fact(key) {
    if (this._facted.has(key)) return;
    this._facted.add(key);
    const f = STORY_FACTS[key];
    this.g.ui.fact(f.title, f.text, f.icon);
    this.g.codex.add('story_' + key);
  }

  seats() { return Object.values(this.coalition).filter(Boolean).length; }

  begin() {
    if (this.stage !== 'dormant') return;
    this.stage = 'rising';
    this.fact('bergs_wake');
    this.g._spawnCampaignSites();
    this.g.ui.announce('The bergs are waking. Build a coalition of three.');
  }

  // Called when a coalition seat fills; three seats trigger the finale.
  _seatCheck() {
    if (this.stage === 'rising' && this.seats() >= 3) {
      this.stage = 'finale';
      this.fact('the_corralling');
      this.g._beginFinale();
    }
  }

  joinWhales() {
    if (this.coalition.whales) return;
    this.coalition.whales = true;
    this.whale.step = 'joined';
    this.g.ui.toast('🐋 THE WHALE GHOSTS JOIN THE COALITION', 'gold');
    this.g.ui.announce('The whale ghosts join the coalition.');
    this._seatCheck();
  }

  joinEels() {
    if (this.coalition.eels) return;
    this.coalition.eels = true;
    this.eel.step = 'joined';
    this.fact('eel_federation');
    this.g.ui.toast('⚡ THE EEL FEDERATION JOINS THE COALITION', 'gold');
    this._seatCheck();
  }

  joinRiver() {
    if (this.coalition.river) return;
    this.coalition.river = true;
    this.ruby.step = 'joined';
    this.fact('river_folk');
    this.g.ui.toast('🦭 THE RIVER FOLK JOIN THE COALITION', 'gold');
    this._seatCheck();
  }

  // The campaign's idea of what to do next — game.js merges this with
  // survival objectives (air, spills). Returns {icon,text,target} or null.
  objective() {
    const g = this.g;
    if (this.stage === 'dormant') return null;
    if (this.stage === 'finale') {
      const loose = this.finale.bergs.filter(b => !b.penned && !b.dead);
      if (loose.length) {
        return { icon: '🐋', text: `Ping near a berg — the whales herd it! ${this.finale.penned}/${this.finale.bergs.length} penned`, target: loose[0].mesh.position };
      }
      return { icon: '⚡', text: 'ALL PENNED — ping the eel pylon!', target: g.pylon.position };
    }
    if (this.stage === 'won' || this.stage === 'spark') return null;
    // rising: offer the nearest actionable arc step
    const options = [];
    const w = this.whale, e = this.eel, r = this.ruby;
    if (w.step === 'bones') {
      const bone = g.bones.find(b => !b.taken);
      if (bone) options.push({ icon: '🦴', text: `Whales: gather the ghosts' bones (${g.bones.filter(b => b.taken).length}/3)`, target: bone.mesh.position });
    } else if (w.step === 'bury') {
      options.push({ icon: '⚓', text: `Whales: bury the bones at the Steelyard stone (${this.whale.bonesBuried}/3)`, target: g.steelyard.position });
    } else if (w.step === 'speaker') {
      const part = g.quest.find(q => !q.taken && (q.id === 'magnet' || q.id === 'coil'));
      options.push({ icon: '🔊', text: 'Whales: craft the loudspeaker — magnet + coil', target: part ? part.mesh.position : g.steelyard.position });
    } else if (w.step === 'lament') {
      options.push({ icon: '🎵', text: 'Whales: sing the lament at the Steelyard (press B there)', target: g.steelyard.position });
    } else if (w.step === 'barge') {
      options.push({ icon: '🕯️', text: `Whales: sink the candle barge — ping the charges under it (${this.whale.bargeHits}/2)`, target: g.candleBarge.position });
    }
    if (e.step === 'parley') {
      const elder = g.elders.find(el => !this.eel.parleyed.has(el.tribe));
      if (elder) options.push({ icon: '⚡', text: `Eels: parley with the ${elder.tribe} elder (press B near them)`, target: elder.mesh.position });
    } else if (e.step === 'fragments') {
      const frag = g.fragments.find(f => !f.taken);
      if (frag) options.push({ icon: '📜', text: `Eels: recover the charter fragments (${this.eel.fragments}/3)`, target: frag.mesh.position });
    } else if (e.step === 'restore') {
      const elder = g.elders.find(el => !this.eel.returned.has(el.tribe));
      if (elder) options.push({ icon: '🤝', text: `Eels: return the charter to the ${elder.tribe} elder`, target: elder.mesh.position });
    }
    if (r.step === 'chest') {
      options.push({ icon: '💎', text: g.tools.has('grapple')
        ? 'Rubies: raise the East India strongbox'
        : 'Rubies: craft the grapple (hook + rope) for the strongbox', target: g.chest.mesh.position });
    } else if (r.step === 'decide') {
      options.push({ icon: '💎', text: `Rubies: decide at the bell — use or return (${r.held} held, ${r.returned} returned)`, target: g.dock.bell.position });
    }
    if (!options.length) return null;
    // nearest actionable step wins
    let best = options[0], bd = Infinity;
    for (const o of options) {
      const d = o.target ? o.target.distanceTo(g.pos) : 1e9;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  hudSeats() {
    return `${this.coalition.whales ? '🐋' : '·'}${this.coalition.eels ? '⚡' : '·'}${this.coalition.river ? '🦭' : '·'}`;
  }
}
