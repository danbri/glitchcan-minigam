// GridLuck Audio System - Handles all sound generation
// Extracted from gridluck-game.js for better modularity

export class GridLuckAudio {
  constructor(game) {
    this.game = game;
  }

  playSound(type, ...args) {
    if (!this.game.audioCtx) return; 
    if (this.game.audioCtx.state === 'suspended') this.game.audioCtx.resume().catch(e => {});
    
    const now = this.game.audioCtx.currentTime; 
    let osc, gain;
    
    const createOscGain = () => { 
      const newOsc = this.game.audioCtx.createOscillator(); 
      const newGain = this.game.audioCtx.createGain(); 
      newOsc.connect(newGain); 
      newGain.connect(this.game.audioCtx.destination); 
      return {osc: newOsc, gain: newGain}; 
    };
    
    switch (type) {
      case 'chomp': 
        ({osc,gain} = createOscGain()); 
        osc.type = 'square'; 
        osc.frequency.setValueAtTime(args[0] || 150, now); 
        gain.gain.setValueAtTime(0.05, now); 
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08); 
        osc.start(now); 
        osc.stop(now + 0.08); 
        break;
        
      case 'powerPellet': 
        ({osc,gain} = createOscGain()); 
        osc.type = 'sawtooth'; 
        osc.frequency.setValueAtTime(200, now); 
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.4); 
        gain.gain.setValueAtTime(0.15, now); 
        gain.gain.linearRampToValueAtTime(0.001, now + 0.4); 
        osc.start(now); 
        osc.stop(now + 0.4); 
        break;
        
      case 'eatGhost': 
        ({osc,gain} = createOscGain()); 
        osc.type = 'sawtooth'; 
        osc.frequency.setValueAtTime(100, now); 
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.5); 
        gain.gain.setValueAtTime(0.2, now); 
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5); 
        osc.start(now); 
        osc.stop(now + 0.5); 
        break;
        
      case 'death': 
        // Much shorter, quieter death sound
        const deathDuration = 0.8; // Short duration
        
        // Simple descending tone with subtle glitch
        ({osc,gain} = createOscGain());
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + deathDuration);
        
        // Just two small glitches
        osc.frequency.setValueAtTime(160, now + 0.2);
        osc.frequency.setValueAtTime(90, now + 0.22);
        osc.frequency.setValueAtTime(120, now + 0.5);
        osc.frequency.setValueAtTime(70, now + 0.52);
        
        gain.gain.setValueAtTime(0.08, now); // Much quieter
        gain.gain.exponentialRampToValueAtTime(0.001, now + deathDuration);
        osc.start(now); 
        osc.stop(now + deathDuration);
        break;
        
      case 'fruit': 
        ({osc,gain} = createOscGain()); 
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(880, now); 
        gain.gain.setValueAtTime(0.2, now); 
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25); 
        osc.start(now); 
        osc.stop(now + 0.25); 
        break;
        
      case 'collectBook': 
        ({osc,gain} = createOscGain()); 
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(600, now); 
        osc.frequency.linearRampToValueAtTime(800, now + 0.15); 
        osc.frequency.linearRampToValueAtTime(1000, now + 0.3); 
        gain.gain.setValueAtTime(0.15, now); 
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3); 
        osc.start(now); 
        osc.stop(now + 0.3); 
        break;
        
      case 'collectSoftware': 
        // Digital beeping sound
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            ({osc, gain} = createOscGain());
            osc.type = 'square';
            osc.frequency.setValueAtTime(800 + i * 200, this.game.audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, this.game.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.game.audioCtx.currentTime + 0.1);
            osc.start(); 
            osc.stop(this.game.audioCtx.currentTime + 0.1);
          }, i * 80);
        }
        break;
        
      case 'collectKey': 
        ({osc,gain} = createOscGain()); 
        osc.type = 'sawtooth'; 
        osc.frequency.setValueAtTime(400, now); 
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4); 
        gain.gain.setValueAtTime(0.2, now); 
        gain.gain.linearRampToValueAtTime(0.001, now + 0.4); 
        osc.start(now); 
        osc.stop(now + 0.4); 
        break;
        
      case 'collectTreasure': 
        ({osc,gain} = createOscGain()); 
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(523, now); // C5
        osc.frequency.setValueAtTime(659, now + 0.1); // E5
        osc.frequency.setValueAtTime(784, now + 0.2); // G5
        gain.gain.setValueAtTime(0.2, now); 
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4); 
        osc.start(now); 
        osc.stop(now + 0.4); 
        break;
        
      case 'collectRare':
        // Epic ascending chord
        for (let i = 0; i < 4; i++) {
          setTimeout(() => {
            ({osc, gain} = createOscGain());
            osc.type = 'triangle';
            const freqs = [523, 659, 784, 1047]; // C-E-G-C octave
            osc.frequency.setValueAtTime(freqs[i], this.game.audioCtx.currentTime);
            gain.gain.setValueAtTime(0.15, this.game.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.game.audioCtx.currentTime + 0.6);
            osc.start(); 
            osc.stop(this.game.audioCtx.currentTime + 0.6);
          }, i * 100);
        }
        break;
        
      case 'collectLegendary':
        // Magical shimmer cascade
        for (let i = 0; i < 8; i++) {
          setTimeout(() => {
            ({osc, gain} = createOscGain());
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000 + i * 200, this.game.audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, this.game.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.game.audioCtx.currentTime + 0.8);
            osc.start(); 
            osc.stop(this.game.audioCtx.currentTime + 0.8);
          }, i * 50);
        }
        // Add bell tone
        setTimeout(() => {
          ({osc, gain} = createOscGain());
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1568, this.game.audioCtx.currentTime); // High C
          gain.gain.setValueAtTime(0.2, this.game.audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.game.audioCtx.currentTime + 1.2);
          osc.start(); 
          osc.stop(this.game.audioCtx.currentTime + 1.2);
        }, 200);
        break;
        
      case 'zoneTransition':
        // Cool swirling transition sound
        ({osc,gain} = createOscGain());
        osc.type = 'sine';
        
        // Create sweeping frequency effect
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.5);
        
        // Add tremolo effect for swirling feel
        const tremolo = this.game.audioCtx.createOscillator();
        const tremoloGain = this.game.audioCtx.createGain();
        tremolo.frequency.setValueAtTime(8, now); // 8Hz tremolo
        tremolo.connect(tremoloGain);
        tremoloGain.connect(gain.gain);
        tremoloGain.gain.setValueAtTime(0.03, now);
        
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        
        osc.start(now); 
        osc.stop(now + 0.6);
        tremolo.start(now); 
        tremolo.stop(now + 0.6);
        break;
        
      case 'unlockArea':
        // Magical unlocking sound
        ({osc,gain} = createOscGain());
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.6);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.start(now); 
        osc.stop(now + 0.8);
        
        // Add sparkle effect
        setTimeout(() => {
          for (let i = 0; i < 3; i++) {
            setTimeout(() => {
              ({osc, gain} = createOscGain());
              osc.type = 'sine';
              osc.frequency.setValueAtTime(1500 + i * 300, this.game.audioCtx.currentTime);
              gain.gain.setValueAtTime(0.08, this.game.audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, this.game.audioCtx.currentTime + 0.4);
              osc.start(); 
              osc.stop(this.game.audioCtx.currentTime + 0.4);
            }, i * 100);
          }
        }, 200);
        break;
        
      case 'synergyActivated':
        // Epic synergy activation sound
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            ({osc, gain} = createOscGain());
            osc.type = 'sawtooth';
            const baseFreq = 200 + i * 150;
            osc.frequency.setValueAtTime(baseFreq, this.game.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 2, this.game.audioCtx.currentTime + 0.4);
            gain.gain.setValueAtTime(0.1, this.game.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.game.audioCtx.currentTime + 0.6);
            osc.start(); 
            osc.stop(this.game.audioCtx.currentTime + 0.6);
          }, i * 80);
        }
        
        // Add harmonic overtones
        setTimeout(() => {
          ({osc, gain} = createOscGain());
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(800, this.game.audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1600, this.game.audioCtx.currentTime + 1);
          gain.gain.setValueAtTime(0.12, this.game.audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.game.audioCtx.currentTime + 1.2);
          osc.start(); 
          osc.stop(this.game.audioCtx.currentTime + 1.2);
        }, 400);
        break;
        
      case 'levelUp':
        // Epic level up fanfare
        for (let i = 0; i < 7; i++) {
          setTimeout(() => {
            ({osc, gain} = createOscGain());
            osc.type = 'triangle';
            const notes = [261, 329, 392, 523, 659, 784, 1047]; // C major scale
            osc.frequency.setValueAtTime(notes[i], this.game.audioCtx.currentTime);
            gain.gain.setValueAtTime(0.12, this.game.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.game.audioCtx.currentTime + 0.8);
            osc.start(); 
            osc.stop(this.game.audioCtx.currentTime + 0.8);
          }, i * 100);
        }
        
        // Add triumphant chord
        setTimeout(() => {
          for (let freq of [523, 659, 784]) { // C major chord
            ({osc, gain} = createOscGain());
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.game.audioCtx.currentTime);
            gain.gain.setValueAtTime(0.08, this.game.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.game.audioCtx.currentTime + 1.5);
            osc.start(); 
            osc.stop(this.game.audioCtx.currentTime + 1.5);
          }
        }, 700);
        break;
        
      case 'achievementUnlocked':
        // Achievement unlock chime
        ({osc,gain} = createOscGain());
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(1200, now + 0.1);
        osc.frequency.setValueAtTime(1600, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now); 
        osc.stop(now + 0.5);
        
        // Add bell overtone
        setTimeout(() => {
          ({osc, gain} = createOscGain());
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(2400, this.game.audioCtx.currentTime);
          gain.gain.setValueAtTime(0.1, this.game.audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.game.audioCtx.currentTime + 0.8);
          osc.start(); 
          osc.stop(this.game.audioCtx.currentTime + 0.8);
        }, 100);
        break;
        
      case 'appleFrenzy':
        // Scary apple frenzy sound - dramatic horror effect
        ({osc,gain} = createOscGain());
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 1.5);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        osc.start(now); 
        osc.stop(now + 1.5);
        
        // Add ominous rumble
        setTimeout(() => {
          ({osc, gain} = createOscGain());
          osc.type = 'square';
          osc.frequency.setValueAtTime(40, this.game.audioCtx.currentTime);
          gain.gain.setValueAtTime(0.15, this.game.audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.game.audioCtx.currentTime + 2);
          osc.start(); 
          osc.stop(this.game.audioCtx.currentTime + 2);
        }, 200);
        
        // Add high pitched screech
        setTimeout(() => {
          ({osc, gain} = createOscGain());
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(2000, this.game.audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(3000, this.game.audioCtx.currentTime + 0.3);
          gain.gain.setValueAtTime(0.1, this.game.audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.game.audioCtx.currentTime + 0.5);
          osc.start(); 
          osc.stop(this.game.audioCtx.currentTime + 0.5);
        }, 800);
        break;
    }
  }
}