// GridLuck Game Class - Main game logic and state management
// Extracted from gridluck.html for better modularity

import { Vec2D, Boid, Asteroid, DecorativeShip, Collectible, SlimeMold } from './gridluck-entities.js';
import { GridLuckRenderer } from './gridluck-renderer.js';
import { GridLuckAudio } from './gridluck-audio.js';

export class Game{
  audioCtx = null; ctx;w;h;
  cam={x:0,y:0, isFullyZoomedOut: false};
  ply={gx:9,gy:15,x:9,y:15,dir:'L',next:null,t:0,lives:3,dying:false,deathTimer:0,deathPhase:0,lastZoneTheme:null,
       activeEffects:new Map(), speedMultiplier:1, ghostImmune:false, canPhaseWalls:false, scoreMultiplier:1};
  ghosts=[]; maze=new Map(); dots=new Set();
  score=0;power=false;pTimer=0; gameOverFlag = false; deathEffectActive = false;
  gameOverScreen; gameOverMessageText; lastTime = 0; 

  MOVE=170; GSPD=[175, 180, 185, 190];
  PAT=[ 
"WWWWWWWWWWWWWWWWWWW", "W........W........W", "W.WW.WWW.W.WWW.WW.W", "WP.......W.......PW",
"W.WW.W.WWWWW.W.WW.W", "W....W...W...W....W", "WWWW.WWW.W.WWW.WWWW", "O....W...^...W....O", 
"WWWW.W.WSSS.W.WWWW", "W......WSSS.W......W", "WWWW.W.WSSS.W.WWWW", "O....W.......W....O", 
"WWWW.W.WWWWW.W.WWWW", "W........W........W", "W.WW.WWW.W.WWW.WW.W", "WP.W.....W.....W.PW",
"WW.W.W.WWWWW.W.W.WW", "W....W...W...W....W", "WWWWWWWWWWWWWWWWWWW"];
  VEC={U:[0,-1],D:[0,1],L:[-1,0],R:[1,0]};
  OPPOSITE_DIR = { U: 'D', D: 'U', L: 'R', R: 'L' };
  fruit = {
    gx: 9, gy: 11, type: 'cherry', value: 100, active: false, timer: 0, spawnCooldown: 0,
    LIFETIME: 15000, SPAWN_INTERVAL: 12000, dotsEatenForSpawn: 0, DOTS_THRESHOLD: 15
  };
  frenziedGhosts = []; // Extra ghosts spawned by apple
  originalCSize = 0; cSize = 0; targetCSize = 0;   
  ghostHouseExitCoord; ghostDoorCoord;

  WORLD_MODULE_DIM = 7; 
  totalWorldWidthCells; totalWorldHeightCells;
  lockedAreas = new Map(); // Track locked doors/areas
  keyUsageLog = []; // Track which keys unlock what

  themes = [
    { name: "Classic", pathColor: '#000020', wallColor: '#000080', wallPattern: ['█', '▓', '▒'], largeDecorativeEmojis: ['👻'], entityTypes: [] },
    { name: "Forest",  pathColor: '#0a1a0a', wallColor: '#1a4a1a', wallPattern: ['🌲', '🌿', '🍃', '🌱', '🌴'], largeDecorativeEmojis: ['🌳','🦉'], entityTypes: [{type: 'boids', count: 5, emojis:['🦋','🐦']}, {type: 'slimeMold', count:1}] },
    { name: "Ocean",   pathColor: '#001122', wallColor: '#004466', wallPattern: ['🌊', '🐚', '⚓', '🫧'], largeDecorativeEmojis: ['⚓','🐳'], entityTypes: [{type: 'boids', count: 6, emojis:['🐟','🦐']}] },
    { name: "Desert",  pathColor: '#2a1a0a', wallColor: '#6b4423', wallPattern: ['🧱', '🏺', '🪨', '🌵'], largeDecorativeEmojis: ['🏜️','🐍'], entityTypes: [] },
    { name: "Space",   pathColor: '#0a0015', wallColor: '#2a0845', wallPattern: ['✨', '⭐', '🌌', '💫'], largeDecorativeEmojis: ['🪐','🚀'], entityTypes: [{type: 'asteroids', count: 8}, {type: 'decorShip', count: 2}] }
  ];
  PAT_C = this.PAT[0].length; PAT_R = this.PAT.length;
  specialDecorRenderList = []; 
  wallFillDecorations = new Map();
  zoneEntities = [];

  constructor(){
    this.c=document.getElementById('game'); this.ctx=this.c.getContext('2d');
    this.renderer = new GridLuckRenderer(this);
    this.audio = new GridLuckAudio(this);
    this.wallPatterns = new Map(); // Cache canvas patterns
    this.lastPatternCSize = 0; // Track when to regenerate patterns
    this.collectibles = []; // World collectibles
    this.inventory = []; // Player inventory
    this.treasureScore = 0; // Separate score for treasures
    this.collectionEffects = []; // Particle effects for collections
    this.rarityCount = {common: 0, uncommon: 0, rare: 0, legendary: 0}; // Track rarity finds
    this.activeSynergies = new Set(); // Track active synergy combinations
    this.synergyEffects = new Map(); // Track synergy effect timers
    
    // Progression system
    this.playerLevel = this.loadProgress('level') || 1;
    this.totalExperience = this.loadProgress('totalXP') || 0;
    this.achievements = this.loadProgress('achievements') || [];
    this.unlockedAbilities = this.loadProgress('abilities') || [];
    this.playSession = {
      dotsEaten: 0,
      ghostsEaten: 0,
      itemsCollected: 0,
      synergiesToday: 0,
      zonesExplored: new Set(),
      startTime: Date.now()
    };
    this.totalWorldWidthCells = this.WORLD_MODULE_DIM * this.PAT_C;
    this.totalWorldHeightCells = this.WORLD_MODULE_DIM * this.PAT_R;

    this.gameOverScreen = document.getElementById('gameOverScreen'); this.gameOverMessageText = document.getElementById('gameOverMessageText');
    document.getElementById('playAgainBtn').addEventListener('click', () => this.resetGame());
    this.ghostHouseExitCoord = { gx: Math.floor(this.PAT_C/2), gy: Math.floor(this.PAT_R/2) - 2 }; 
    this.ghostDoorCoord = { gx: Math.floor(this.PAT_C/2), gy: Math.floor(this.PAT_R/2) - 1 };     
    try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.audioCtx = null; }
    addEventListener('resize',()=>this.setupCanvas()); this.setupCanvas(); 
    this.resetGame(); 
    this.input(); this.setupExtraInputs();
    this.gameLoop = this.gameLoop.bind(this); this.lastTime = performance.now(); requestAnimationFrame(this.gameLoop);
  }

  resetGame() {
    this.gameOverFlag = false; this.gameOverScreen.style.display = 'none';
    this.ply = {gx:9,gy:15,x:9,y:15,dir:'L',next:null,t:0,lives:3,activeEffects:new Map()};
    this.score = 0; this.power = false; this.pTimer = 0;
    this.fruit = { ...this.fruit, active: false, timer: 0, spawnCooldown: this.fruit.SPAWN_INTERVAL / 2, dotsEatenForSpawn: 0};
    this.zoneEntities = []; this.wallFillDecorations.clear();
    this.buildWorld(); this.spawnGhosts();
    if (this.lastTime === 0) { this.lastTime = performance.now(); requestAnimationFrame(this.gameLoop.bind(this)); }
  }

  gameLoop(timestamp){
      if (this.gameOverFlag) { this.lastTime = 0; return; }
      const dt = Math.min(100, timestamp - this.lastTime); this.lastTime = timestamp;
      this.update(dt); this.draw(timestamp); 
      requestAnimationFrame(this.gameLoop.bind(this));
  }

  setupCanvas(){
    this.w=innerWidth;this.h=innerHeight; this.c.width=this.w;this.c.height=this.h;
    const baseScreenDimForNormalZoom = Math.min(this.w, this.h); 
    const newOriginalCSize = Math.floor(baseScreenDimForNormalZoom / 15); // Slightly smaller normal view

    if (this.originalCSize === 0) { 
        this.originalCSize = newOriginalCSize; this.cSize = this.originalCSize; this.targetCSize = this.originalCSize;
    } else {
        this.originalCSize = newOriginalCSize;
        if(this.cam.isFullyZoomedOut){
            // More conservative zoom out to maintain visual clarity
            const maxZoomOut = Math.min(this.w / this.totalWorldWidthCells, this.h / this.totalWorldHeightCells);
            this.targetCSize = Math.max(4, maxZoomOut * 0.7); // Keep more padding for clarity
        } else {
            this.targetCSize = this.originalCSize;
        }
    }
    if (this.cSize < 0.1) this.cSize = 0.1;
  }

  buildWorld() {
    this.maze.clear(); this.dots.clear(); this.specialDecorRenderList = []; this.zoneEntities = []; this.wallFillDecorations.clear();
    this.zoneTransitions = new Map(); // Track zone boundary paths
    const R_PAT = this.PAT_R, C_PAT = this.PAT_C;

    const baseSpecialDecorBlocks = [];
    let visitedForDecor = new Array(R_PAT*C_PAT).fill(false);
    for (let y = 0; y < R_PAT; y++) { for (let x = 0; x < C_PAT; x++) { if (this.PAT[y][x] === 'S' && !visitedForDecor[y*C_PAT + x]) {
        let blockWidth = 0, blockHeight = 0; while (x + blockWidth < C_PAT && this.PAT[y][x + blockWidth] === 'S') blockWidth++; let currentHeight = 0;
        while(y + currentHeight < R_PAT) { let rowMatch = true; for(let i=0; i<blockWidth; i++) if (this.PAT[y+currentHeight][x+i] !== 'S') rowMatch = false; if(rowMatch) currentHeight++; else break; } blockHeight = currentHeight;
        if (blockWidth > 0 && blockHeight > 0) { baseSpecialDecorBlocks.push({ x, y, w: blockWidth, h: blockHeight }); for (let by = 0; by < blockHeight; by++) for (let bx = 0; bx < blockWidth; bx++) visitedForDecor[(y + by) * C_PAT + (x + bx)] = true; } } } }
    
    for (let smy = 0; smy < this.WORLD_MODULE_DIM; smy++) {
        for (let smx = 0; smx < this.WORLD_MODULE_DIM; smx++) {
            const currentTheme = this.getThemeForCell(smx * C_PAT, smy * R_PAT);
            
            baseSpecialDecorBlocks.forEach(decorBlock => {
                this.specialDecorRenderList.push({ gx: smx * C_PAT + decorBlock.x, gy: smy * R_PAT + decorBlock.y, w_cells: decorBlock.w, h_cells: decorBlock.h,
                    emoji: currentTheme.largeDecorativeEmojis[ (Math.abs(smx*7 + smy*13 + decorBlock.x + decorBlock.y) % currentTheme.largeDecorativeEmojis.length) ] || '❓' });
            });

            if (currentTheme.entityTypes && this.cSize > 0.1) {
                const zonePixelX = smx * C_PAT * this.cSize; 
                const zonePixelY = smy * R_PAT * this.cSize;
                const zonePixelW = C_PAT * this.cSize;
                const zonePixelH = R_PAT * this.cSize;
                const zonePixelBounds = { x: zonePixelX, y: zonePixelY, width: zonePixelW, height: zonePixelH };

                currentTheme.entityTypes.forEach(entityDef => {
                    for (let i = 0; i < entityDef.count; i++) {
                        const entityX = zonePixelBounds.x + Math.random() * zonePixelBounds.width;
                        const entityY = zonePixelBounds.y + Math.random() * zonePixelBounds.height;
                        let newEntity = null;
                        if (entityDef.type === 'boids') {
                            newEntity = new Boid(entityX, entityY, zonePixelBounds, entityDef.emojis, 10, this);
                        } else if (entityDef.type === 'asteroids') {
                            newEntity = new Asteroid(entityX, entityY, zonePixelBounds, 0.15, this);
                        } else if (entityDef.type === 'decorShip') {
                            newEntity = new DecorativeShip(entityX, entityY, zonePixelBounds, this.cSize * 0.35);
                        } else if (entityDef.type === 'slimeMold') {
                            // Find a valid empty game cell to spawn slime mold
                            let spawnGx = -1, spawnGy = -1;
                            for(let attempts = 0; attempts < 10; attempts++){ // Try a few times
                                const rdx = Math.floor(Math.random() * C_PAT);
                                const rdy = Math.floor(Math.random() * R_PAT);
                                if(this.PAT[rdy][rdx] === ' '){
                                    spawnGx = smx * C_PAT + rdx;
                                    spawnGy = smy * R_PAT + rdy;
                                    break;
                                }
                            }
                            if(spawnGx !== -1) newEntity = new SlimeMold(spawnGx, spawnGy, zonePixelBounds, this);
                        }
                        if(newEntity) this.zoneEntities.push(newEntity);
                    }
                });
            }

            for (let y_pat = 0; y_pat < R_PAT; y_pat++) {
                for (let x_pat = 0; x_pat < C_PAT; x_pat++) {
                    const ch = this.PAT[y_pat][x_pat]; 
                    const gx = x_pat + smx * C_PAT; 
                    const gy = y_pat + smy * R_PAT; 
                    const k = gx + ',' + gy;
                    let tileType = ' '; 
                    if (ch === 'W') tileType = 'W'; else if (ch === '-') tileType = '-'; else if (ch === '^') tileType = ' '; // Ghost house exit - open path
                    else if (ch === 'O') tileType = 'T'; else if (ch === '.') tileType = '.'; else if (ch === 'P') tileType = 'P'; 
                    else if (ch === 'S') tileType = 'S'; 
                    this.maze.set(k, tileType); 
                    if (tileType === '.' || tileType === 'P') this.dots.add(k);
                    
                    // Add locked doors to some zones (much more frequent)
                    if (tileType === ' ' && Math.random() < 0.02) { // 2% chance for locked door
                      const colors = ['red', 'blue', 'green', 'yellow'];
                      const doorColor = colors[Math.floor(Math.random() * colors.length)];
                      this.maze.set(k, 'L'); // L = Locked door
                      this.lockedAreas.set(k, {
                        color: doorColor,
                        unlocked: false,
                        gx: gx,
                        gy: gy,
                        reward: this.generateLockedAreaReward()
                      });
                    }

                    if(tileType === 'W' && currentTheme.wallPattern && currentTheme.wallPattern.length > 0){
                        // Simple pattern selection for CSS background
                        const patternIndex = (gx + gy * 3) % currentTheme.wallPattern.length;
                        this.wallFillDecorations.set(k, {
                            patternIndex: patternIndex,
                            theme: currentTheme.name
                        });
                    }
                }
            }
        }
    }
    
    // Detect zone transitions after building the world
    this.detectZoneTransitions();
    
    // Spawn collectibles
    this.spawnCollectibles();
  }

  detectZoneTransitions() {
    // Scan all path cells to find zone boundaries
    let transitionCount = 0;
    for (let gy = 0; gy < this.totalWorldHeightCells; gy++) {
      for (let gx = 0; gx < this.totalWorldWidthCells; gx++) {
        const k = gx + ',' + gy;
        const tileType = this.maze.get(k);
        
        // Only check path cells
        if (tileType === ' ' || tileType === '.' || tileType === 'P' || tileType === 'O' || tileType === 'T') {
          const currentTheme = this.getThemeForCell(gx, gy);
          
          // Check adjacent cells for different themes
          const directions = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
          ];
          
          for (const dir of directions) {
            const adjGx = this._wrapCoord(gx + dir.dx, this.totalWorldWidthCells);
            const adjGy = this._wrapCoord(gy + dir.dy, this.totalWorldHeightCells);
            const adjKey = adjGx + ',' + adjGy;
            const adjTileType = this.maze.get(adjKey);
            
            // If adjacent is also a path and has different theme
            if ((adjTileType === ' ' || adjTileType === '.' || adjTileType === 'P' || adjTileType === 'O' || adjTileType === 'T')) {
              const adjTheme = this.getThemeForCell(adjGx, adjGy);
              
              if (currentTheme.name !== adjTheme.name) {
                // This is a zone transition cell
                this.zoneTransitions.set(k, {
                  fromTheme: currentTheme,
                  toTheme: adjTheme,
                  glowIntensity: Math.random() * 0.3 + 0.7 // Vary glow intensity
                });
                transitionCount++;
                if (transitionCount < 10) console.log(`Zone transition: ${currentTheme.name} -> ${adjTheme.name} at ${gx},${gy}`);
                break; // Found one transition, that's enough for this cell
              }
            }
          }
        }
      }
    }
    console.log(`Total detected ${transitionCount} zone transition cells`);
  }

  spawnCollectibles() {
    this.collectibles = [];
    const targetCount = Math.floor(this.totalWorldWidthCells * this.totalWorldHeightCells / 50); // Much higher density
    
    for (let i = 0; i < targetCount; i++) {
      // Find valid spawn location
      for (let attempts = 0; attempts < 50; attempts++) {
        const gx = Math.floor(Math.random() * this.totalWorldWidthCells);
        const gy = Math.floor(Math.random() * this.totalWorldHeightCells);
        const k = gx + ',' + gy;
        const tileType = this.maze.get(k);
        
        // Spawn on empty paths, away from dots and teleport zones
        if (tileType === ' ' && !this.dots.has(k)) {
          // Check if location is clear of other collectibles
          const tooClose = this.collectibles.some(c => 
            Math.abs(c.gx - gx) < 3 || Math.abs(c.gy - gy) < 3
          );
          
          if (!tooClose) {
            this.collectibles.push(new Collectible(gx, gy, this));
            break;
          }
        }
      }
    }
  }

  getThemeForCell(gx, gy) {
    const wrappedGx = this._wrapCoord(gx, this.totalWorldWidthCells);
    const wrappedGy = this._wrapCoord(gy, this.totalWorldHeightCells);
    const sectionX = Math.floor(wrappedGx / this.PAT_C); 
    const sectionY = Math.floor(wrappedGy / this.PAT_R);
    let hash = Math.abs(sectionX * 7 + sectionY * 13 + sectionX + sectionY);
    return this.themes[hash % this.themes.length];
  }

  spawnGhosts(){
    this.ghosts = []; 
    const classicGhostSetup = [
      { color: '#f00', name: 'Blinky', initialPos: { gx: this.ghostHouseExitCoord.gx, gy: this.ghostHouseExitCoord.gy}, inHouse: false },
      { color: '#fbf', name: 'Pinky',  initialPos: { gx: Math.floor(this.PAT_C/2), gy: Math.floor(this.PAT_R/2)},     inHouse: true },
      { color: '#0ff', name: 'Inky',   initialPos: { gx: Math.floor(this.PAT_C/2) - 1, gy: Math.floor(this.PAT_R/2)}, inHouse: true },
      { color: '#fb4', name: 'Clyde',  initialPos: { gx: Math.floor(this.PAT_C/2) + 1, gy: Math.floor(this.PAT_R/2)}, inHouse: true }
    ];
    classicGhostSetup.forEach((setup, i) => {
      this.ghosts.push({
        id: setup.name, originalColor: setup.color, color: setup.color,
        gx: setup.initialPos.gx, gy: setup.initialPos.gy, x: setup.initialPos.gx, y: setup.initialPos.gy,
        dir: 'U', t: 0, speed: this.GSPD[i], inHouse: setup.inHouse,
        homePos: { gx: setup.initialPos.gx, gy: setup.initialPos.gy }, isEaten: false
      });
    });
  }
  
  input(){
    const setD=d=>{ if(this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume(); this.ply.next=d; };
    addEventListener('keydown',e=>{ 
      if (this.gameOverFlag) {
        // Allow restart with Enter or Space when game is over
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.resetGame();
        }
        return; 
      }
      const k={ArrowUp:'U',ArrowLeft:'L',ArrowDown:'D',ArrowRight:'R',w:'U',a:'L',s:'D',d:'R'}[e.key]; 
      if(k)setD(k); 
    });
    let sx,sy; 
    const touchStart = e => { if (this.gameOverFlag) return; if(this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume(); if(e.touches.length === 1){ sx=e.touches[0].clientX; sy=e.touches[0].clientY; } };
    const touchEnd = e => { if (this.gameOverFlag) return; if(sx==null || !e.changedTouches[0])return; const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy; const absDx = Math.abs(dx), absDy = Math.abs(dy); if(absDx > 20 || absDy > 20){ if(absDx > absDy) setD(dx>0?'R':'L'); else setD(dy>0?'D':'U'); } sx=sy=null; };
    this.c.addEventListener('touchstart',touchStart,{passive:true}); this.c.addEventListener('touchend',touchEnd,{passive:true});
  }

  setupExtraInputs() {
    const teleportBtn = document.getElementById('teleportBtn'); const zoomBtn = document.getElementById('zoomBtn');
    teleportBtn.addEventListener('click', () => {if (!this.gameOverFlag) this.activateTeleport()});
    const handleZoomPress = () => { 
        if (!this.gameOverFlag) {
            this.cam.isFullyZoomedOut = true;
            const maxZoomOut = Math.min(this.w / this.totalWorldWidthCells, this.h / this.totalWorldHeightCells);
            this.targetCSize = Math.max(4, maxZoomOut * 0.7); // More conservative zoom out to maintain clarity
        }
    };
    const handleZoomRelease = () => { 
        if (!this.gameOverFlag) {
            this.cam.isFullyZoomedOut = false;
            this.targetCSize = this.originalCSize;
        }
    };
    zoomBtn.addEventListener('mousedown', handleZoomPress); zoomBtn.addEventListener('mouseup', handleZoomRelease);
    zoomBtn.addEventListener('mouseleave', () => { if (this.cam.isFullyZoomedOut) handleZoomRelease();});
    zoomBtn.addEventListener('touchstart', (e) => { e.preventDefault(); handleZoomPress(); }, {passive:false});
    zoomBtn.addEventListener('touchend', (e) => { e.preventDefault(); handleZoomRelease(); }, {passive:false});
    addEventListener('keydown', e => { if (this.gameOverFlag) return; if (e.key.toLowerCase() === 't') this.activateTeleport(); if (e.key.toLowerCase() === 'z' && !e.repeat) handleZoomPress(); });
    addEventListener('keyup', e => { if (e.key.toLowerCase() === 'z') handleZoomRelease(); });
    
    // Add scroll wheel zoom support
    this.c.addEventListener('wheel', e => {
        if (this.gameOverFlag) return;
        e.preventDefault();
        
        if (e.deltaY < 0) {
            // Scroll up - zoom out
            handleZoomPress();
        } else {
            // Scroll down - zoom in
            handleZoomRelease();
        }
    }, { passive: false });
  }

  _wrapCoord(val, max) { return (val % max + max) % max; }

  canMove(nx,ny, isGhost = false){
    const wrappedNx = this._wrapCoord(nx, this.totalWorldWidthCells);
    const wrappedNy = this._wrapCoord(ny, this.totalWorldHeightCells);
    const tile = this.maze.get(wrappedNx+','+wrappedNy);
    const key = wrappedNx + ',' + wrappedNy;
    
    // Player can phase through walls with special effect
    if (!isGhost && this.ply.canPhaseWalls && (tile === 'W' || tile === 'S')) return true;
    
    // Handle locked doors
    if (!isGhost && tile === 'L') {
      const lockedArea = this.lockedAreas.get(key);
      if (lockedArea && !lockedArea.unlocked) {
        // Check if player has matching key OR master key synergy
        let usableKey = this.inventory.find(item => 
          item.category === 'key' && item.color === lockedArea.color
        );
        
        // Master key synergy allows any key to open any door
        if (!usableKey && this.ply.masterKey) {
          usableKey = this.inventory.find(item => item.category === 'key');
        }
        
        if (usableKey) {
          this.unlockArea(key, usableKey, this.ply.masterKey);
          return true;
        }
        return false; // Door is locked and no key
      }
      return true; // Door is unlocked
    }
    
    if (tile === 'W' || tile === 'S') return false; 
    if (!isGhost && tile === '-') return false; 
    return true; 
  }

  step(ent,spd){
    if(ent.t>0)return; let newDir = ent.dir;
    if(ent===this.ply){ if(this.ply.next){ const [nextVx,nextVy]=this.VEC[this.ply.next]; if(this.canMove(ent.gx+nextVx,ent.gy+nextVy)) newDir = this.ply.next; }
    }else{ const availableMoves = []; for(const d of ['U','D','L','R']){ const [vx,vy]=this.VEC[d]; if(this.canMove(ent.gx+vx,ent.gy+vy, true)) availableMoves.push({dir:d,gx:ent.gx+vx,gy:ent.gy+vy}); } if(availableMoves.length===0) return;
      if(this.power && !ent.isEaten){ const nonReverseMoves = availableMoves.filter(m=>m.dir!==this.OPPOSITE_DIR[ent.dir]); if(nonReverseMoves.length>0) newDir = nonReverseMoves[Math.floor(Math.random()*nonReverseMoves.length)].dir; else newDir = availableMoves[0].dir; 
      } else { let targetGx, targetGy;
        if (ent.isEaten) { targetGx = ent.homePos.gx; targetGy = ent.homePos.gy; if (ent.gx === targetGx && ent.gy === targetGy) { ent.isEaten = false; ent.inHouse = (ent.id !== 'Blinky'); ent.color = ent.originalColor;}
        } else if(ent.inHouse){ targetGx = this.ghostDoorCoord.gx; targetGy = this.ghostDoorCoord.gy; if(ent.gx === this.ghostDoorCoord.gx && ent.gy === this.ghostDoorCoord.gy){ targetGx = this.ghostHouseExitCoord.gx; targetGy = this.ghostHouseExitCoord.gy;} if(ent.gx === this.ghostHouseExitCoord.gx && ent.gy === this.ghostHouseExitCoord.gy) ent.inHouse = false; 
        } if (!ent.inHouse && !ent.isEaten) { targetGx = this.ply.gx; targetGy = this.ply.gy; }
        let minDistance = Infinity; const preferredDirs = []; const filterableMoves = availableMoves.filter(m => m.dir !== this.OPPOSITE_DIR[ent.dir]); const movesToConsider = filterableMoves.length > 0 ? filterableMoves : availableMoves;
        if (targetGx !== undefined && targetGy !== undefined) { for(const move of movesToConsider){ 
            const dx = Math.abs(this._wrapCoord(move.gx, this.totalWorldWidthCells) - this._wrapCoord(targetGx, this.totalWorldWidthCells)); 
            const dy = Math.abs(this._wrapCoord(move.gy, this.totalWorldHeightCells) - this._wrapCoord(targetGy, this.totalWorldHeightCells));
            const dist = Math.min(dx, this.totalWorldWidthCells - dx) + Math.min(dy, this.totalWorldHeightCells - dy);
            if(dist < minDistance){ minDistance = dist; preferredDirs.length=0; preferredDirs.push(move.dir); }else if(dist === minDistance) preferredDirs.push(move.dir); } }
        if(preferredDirs.length>0){ const order = ['U','L','D','R']; if (preferredDirs.includes(ent.dir) && movesToConsider.some(m => m.dir === ent.dir)) newDir = ent.dir; else for(const d of order) if(preferredDirs.includes(d)){newDir=d;break;}
        } else if (movesToConsider.length > 0) newDir = movesToConsider[Math.floor(Math.random()*movesToConsider.length)].dir; else if (availableMoves.length > 0) newDir = availableMoves[0].dir;
      }
    }
    ent.dir = newDir; 
    const [vx,vy]=this.VEC[ent.dir]; 
    const nextRawGx = ent.gx + vx;
    const nextRawGy = ent.gy + vy;
    if(this.canMove(nextRawGx, nextRawGy, ent !== this.ply)){ 
        ent.gx = this._wrapCoord(nextRawGx, this.totalWorldWidthCells);
        ent.gy = this._wrapCoord(nextRawGy, this.totalWorldHeightCells);
        ent.t=spd; 
    }
  }

  interp(ent,spd,dt){
    let dx = ent.gx - ent.x;
    let dy = ent.gy - ent.y;

    if (Math.abs(dx) > this.totalWorldWidthCells / 2) dx = dx > 0 ? dx - this.totalWorldWidthCells : dx + this.totalWorldWidthCells;
    if (Math.abs(dy) > this.totalWorldHeightCells / 2) dy = dy > 0 ? dy - this.totalWorldHeightCells : dy + this.totalWorldHeightCells;
    
    if( (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) && ent.t > 0 ){ 
        const r=Math.min(1,dt/(spd || this.MOVE)); 
        ent.x += dx * r;
        ent.y += dy * r;
        ent.x = this._wrapCoord(ent.x, this.totalWorldWidthCells + 0); // Add 0 to ensure float wrap
        ent.y = this._wrapCoord(ent.y, this.totalWorldHeightCells + 0);
        ent.t = Math.max(0, ent.t-dt); 
    } else {
        ent.t=0;
        ent.x = ent.gx; 
        ent.y = ent.gy;
    }
  }

  update(dt_ms){
    // Ultra-fast zoom interpolation for responsiveness
    const zoomAnimationSpeed = 0.6; 
    const threshold = 0.02; // Very small threshold
    
    if (Math.abs(this.cSize - this.targetCSize) > threshold) {
         this.cSize += (this.targetCSize - this.cSize) * zoomAnimationSpeed;
    } else {
        this.cSize = this.targetCSize;
    }
    
    // Only update patterns when zoom settles AND there's a significant size change
    const significantSizeChange = Math.abs(this.cSize - this.lastPatternCSize) > 15;
    const zoomIsStable = Math.abs(this.cSize - this.targetCSize) < 0.1;
    
    if (zoomIsStable && significantSizeChange) {
        // Add longer delay before updating patterns to prevent zone-crossing flicker
        if (!this.patternUpdateDelay) this.patternUpdateDelay = Date.now();
        if (Date.now() - this.patternUpdateDelay > 300) { // Longer 300ms delay
            this.wallPatterns.clear();
            this.lastPatternCSize = this.cSize;
            this.patternUpdateDelay = null;
        }
    } else if (!zoomIsStable) {
        this.patternUpdateDelay = null; // Reset delay if still zooming
    }

    // Handle death animation
    if (this.ply.dying) {
      this.ply.deathTimer += dt_ms;
      this.ply.deathPhase = Math.floor(this.ply.deathTimer / 150); // Phase every 150ms
      
      if (this.ply.deathTimer > 2000) { // 2 second death sequence
        this.ply.dying = false;
        this.deathEffectActive = false;
        
        if(this.ply.lives < 0 && !this.gameOverFlag) { 
          this.gameOverFlag = true; 
          this.gameOverMessageText.textContent = 'GAME OVER! Final Score: ' + this.score + '\n\nPress ENTER or SPACE to restart'; 
          this.gameOverScreen.style.display = 'flex';
        } else if (this.ply.lives >= 0) { 
          Object.assign(this.ply,{gx:9,gy:15,x:9,y:15,t:0, dir: 'L', next:null, deathTimer:0, deathPhase:0}); 
          this.spawnGhosts(); 
        }
      }
    } else {
      // Reset speedMultiplier to base value each frame
      this.ply.speedMultiplier = 1.0;
      this.ply.ghostImmune = false;
      this.ply.canPhaseWalls = false;
      this.ply.scoreMultiplier = 1;
      
      // Apply active effects
      this.ply.activeEffects.forEach((effectData, effectType) => {
        switch(effectType) {
          case 'ghost_immunity':
            this.ply.ghostImmune = true;
            break;
          case 'speed_boost':
            this.ply.speedMultiplier = 0.9;
            break;
          case 'wall_phase':
            this.ply.canPhaseWalls = true;
            break;
          case 'score_multiplier':
            this.ply.scoreMultiplier = 2;
            break;
        }
      });
      
      const playerSpeed = this.MOVE / this.ply.speedMultiplier; // Lower multiplier = faster movement (lower ms delay)
      console.log(`DEBUG: MOVE=${this.MOVE}, speedMultiplier=${this.ply.speedMultiplier}, playerSpeed=${playerSpeed}`);
      this.step(this.ply, playerSpeed); 
      this.interp(this.ply, playerSpeed, dt_ms);
    }
    
    // Update all ghosts (normal + frenzied)
    [...this.ghosts, ...this.frenziedGhosts].forEach(g=>this.step(g,g.speed));
    [...this.ghosts, ...this.frenziedGhosts].forEach(g=>this.interp(g,g.speed,dt_ms));
    
    // Remove expired frenzied ghosts
    this.frenziedGhosts = this.frenziedGhosts.filter(g => {
      if (g.frenzyTimer > 0) {
        g.frenzyTimer -= dt_ms;
        return true;
      }
      return false;
    });
    
    this.zoneEntities.forEach(entity => {
        if (entity.type === 'boid' || entity.type === 'asteroid' || entity.type === 'decorShip' || entity.type === 'slimeMold') {
            const moduleGx = Math.floor(this._wrapCoord(entity.type === 'slimeMold' ? entity.gx : entity.pos.x / this.cSize, this.totalWorldWidthCells) / this.PAT_C);
            const moduleGy = Math.floor(this._wrapCoord(entity.type === 'slimeMold' ? entity.gy : entity.pos.y / this.cSize, this.totalWorldHeightCells) / this.PAT_R);
            
            if(entity.type !== 'slimeMold'){ // Slime mold gx,gy are grid cells, others are pixel positions
                 entity.zoneBounds = {
                    x: this._wrapCoord(moduleGx, this.WORLD_MODULE_DIM) * this.PAT_C * this.cSize,
                    y: this._wrapCoord(moduleGy, this.WORLD_MODULE_DIM) * this.PAT_R * this.cSize,
                    width: this.PAT_C * this.cSize, height: this.PAT_R * this.cSize
                };
            }
            if(entity.type === 'boid') entity.flock(this.zoneEntities);
            entity.update(dt_ms);
        }
    });

    // Update collectibles and check for collection
    this.collectibles.forEach(collectible => {
        if (!collectible.collected) {
            collectible.update(dt_ms);
            
            // Check if player is on collectible OR treasure magnet effect
            const dx = Math.abs(this.ply.gx - collectible.gx);
            const dy = Math.abs(this.ply.gy - collectible.gy);
            const distance = dx + dy;
            
            const collectRange = this.ply.treasureMagnet && collectible.category === 'treasure' ? 2 : 0;
            
            if (distance <= collectRange) {
                this.collectItem(collectible);
            }
        }
    });

    // Check asteroid collisions for points
    this.zoneEntities.forEach((entity, index) => {
        if (entity.type === 'asteroid') {
            const dx = entity.pos.x - (this.ply.x * this.cSize + this.cSize/2);
            const dy = entity.pos.y - (this.ply.y * this.cSize + this.cSize/2);
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance < this.cSize * 0.4) {
                // Collected asteroid
                this.score += 25;
                this.playSound('chomp', 300);
                this.zoneEntities.splice(index, 1);
            }
        }
    });
    
    // Update collection particle effects
    this.collectionEffects = this.collectionEffects.filter(effect => {
        effect.x += effect.vx;
        effect.y += effect.vy;
        effect.life -= effect.decay;
        effect.vy += 0.1; // Gravity
        return effect.life > 0;
    });

    const pk_wrapped_x = this._wrapCoord(this.ply.gx, this.totalWorldWidthCells);
    const pk_wrapped_y = this._wrapCoord(this.ply.gy, this.totalWorldHeightCells);
    const pk_key = pk_wrapped_x + ',' + pk_wrapped_y;

    const currentTileType = this.maze.get(pk_key);
    if(this.dots.has(pk_key)){ this.dots.delete(pk_key); this.fruit.dotsEatenForSpawn++;
      this.playSession.dotsEaten++;
      if(currentTileType ==='P'){ 
        // Apply longer power ability
        const powerDuration = this.unlockedAbilities.includes('longer_power') ? 11250 : 9000;
        this.power=true;this.pTimer=powerDuration;this.score+=50; 
        this.playSound('powerPellet'); 
        this.addExperience(5, 'power pellet');
        this.ghosts.forEach(g => { if (!g.inHouse && !g.isEaten) g.dir = this.OPPOSITE_DIR[g.dir] || g.dir; });
      } else { 
        this.score+=10; 
        this.playSound('chomp', 200); 
        this.addExperience(1, 'dot');
      }
    }
    
    // Check for zone transitions
    const currentTheme = this.getThemeForCell(pk_wrapped_x, pk_wrapped_y);
    if (this.ply.lastZoneTheme && this.ply.lastZoneTheme.name !== currentTheme.name) {
      this.playSound('zoneTransition');
      this.playSession.zonesExplored.add(currentTheme.name);
      this.addExperience(3, 'zone exploration');
      
      // Zone master ability
      if (this.unlockedAbilities.includes('zone_master')) {
        this.applyItemEffect({
          effect: 'ghost_immunity',
          duration: 3000,
          name: 'Zone Master'
        });
      }
    }
    this.ply.lastZoneTheme = currentTheme;
    if(this.power){ this.pTimer-=dt_ms; if(this.pTimer<=0) this.power=false; }

    // Skip ghost collisions if player is dying or ghost immune
    if (!this.ply.dying && !this.ply.ghostImmune) {
      [...this.ghosts, ...this.frenziedGhosts].forEach(g=>{ if (g.isEaten) return; 
          let dx = g.x - this.ply.x; let dy = g.y - this.ply.y;
          if (Math.abs(dx) > this.totalWorldWidthCells / 2) dx = dx > 0 ? dx - this.totalWorldWidthCells : dx + this.totalWorldWidthCells;
          if (Math.abs(dy) > this.totalWorldHeightCells / 2) dy = dy > 0 ? dy - this.totalWorldHeightCells : dy + this.totalWorldHeightCells;

        if(dx*dx+dy*dy<0.35){ 
          if(this.power){ this.playSound('eatGhost'); this.score+=200; g.isEaten = true; g.color = '#888'; g.inHouse = false;
          this.playSession.ghostsEaten++;
          this.addExperience(10, 'ghost'); 
          } else { 
            this.ply.lives--;
            this.ply.dying = true;
            this.ply.deathTimer = 0;
            this.ply.deathPhase = 0;
            this.deathEffectActive = true;
            this.playSound('death');
            
            // Don't immediately respawn - let death animation play
          }
        }
      });
    }

    const plyModuleGx = Math.floor(this._wrapCoord(this.ply.gx, this.totalWorldWidthCells) / this.PAT_C);
    const plyModuleGy = Math.floor(this._wrapCoord(this.ply.gy, this.totalWorldHeightCells) / this.PAT_R);
    const fruitSpawnGx = plyModuleGx * this.PAT_C + Math.floor(this.PAT_C/2); 
    const fruitSpawnGy = plyModuleGy * this.PAT_R + 11; 
    
    if(this.fruit.active){
      this.fruit.timer-=dt_ms; if(this.fruit.timer<=0) this.fruit.active=false;
      else if(this.ply.gx===this.fruit.gx && this.ply.gy===this.fruit.gy){
        this.score+=this.fruit.value; 
        this.playSound('fruit'); 
        
        // Handle special fruit effects
        if (this.fruit.special === 'ghost_frenzy') {
          this.triggerAppleGhostFrenzy();
          console.log('🍎 APPLE EATEN! 8 frenzied ghosts appear!');
        } else if (this.fruit.special === 'super_power') {
          this.power = true;
          this.pTimer = 15000; // Extra long power mode
          console.log('🍍 PINEAPPLE POWER! Super long power mode!');
        }
        
        // Create fruit collection effect
        this.createFruitEffect(this.fruit.gx, this.fruit.gy, this.fruit.color);
        this.fruit.active=false;
      }
    }else{ 
      this.fruit.spawnCooldown-=dt_ms;
      if(this.fruit.spawnCooldown<=0 && this.fruit.dotsEatenForSpawn >= this.fruit.DOTS_THRESHOLD){
        const fruitKey = this._wrapCoord(fruitSpawnGx, this.totalWorldWidthCells) +','+ this._wrapCoord(fruitSpawnGy, this.totalWorldHeightCells); 
        const fTile = this.maze.get(fruitKey);
        if(fTile !=='W' && fTile !=='-' && fTile !== 'S'){
          // Random fruit types with different effects
          const fruits = [
            { type: 'cherry', value: 100, color: '#ff1493', emoji: '🍒' },
            { type: 'strawberry', value: 300, color: '#ff6347', emoji: '🍓' },
            { type: 'orange', value: 500, color: '#ffa500', emoji: '🍊' },
            { type: 'banana', value: 800, color: '#ffff00', emoji: '🍌' },
            { type: 'apple', value: 1500, color: '#ff0000', emoji: '🍎', special: 'ghost_frenzy' },
            { type: 'grapes', value: 2000, color: '#9932cc', emoji: '🍇' },
            { type: 'pineapple', value: 5000, color: '#ffd700', emoji: '🍍', special: 'super_power' }
          ];
          
          const chosenFruit = fruits[Math.floor(Math.random() * fruits.length)];
          Object.assign(this.fruit, chosenFruit);
          this.fruit.gx=fruitSpawnGx; this.fruit.gy=fruitSpawnGy;
          this.fruit.active=true; this.fruit.timer=this.fruit.LIFETIME;
          this.fruit.dotsEatenForSpawn=0;
          
          console.log(`🍎 ${chosenFruit.emoji} ${chosenFruit.type} spawned! Worth ${chosenFruit.value} points`);
        }
        this.fruit.spawnCooldown=this.fruit.SPAWN_INTERVAL; 
      }
    }
    
    if (this.cam.isFullyZoomedOut) {
        // Center on player but allow smooth movement in endless world
        const worldPixelWidth = this.totalWorldWidthCells * this.cSize;
        const worldPixelHeight = this.totalWorldHeightCells * this.cSize;
        
        // If world fits on screen, center it
        if (worldPixelWidth <= this.w && worldPixelHeight <= this.h) {
            this.cam.x = (worldPixelWidth - this.w) / 2;
            this.cam.y = (worldPixelHeight - this.h) / 2;
        } else {
            // Allow smooth camera movement for endless appearance
            const targetX = this.ply.x * this.cSize - this.w / 2;
            const targetY = this.ply.y * this.cSize - this.h / 2;
            
            // Smooth camera interpolation for zoom-out view
            this.cam.x += (targetX - this.cam.x) * 0.05;
            this.cam.y += (targetY - this.cam.y) * 0.05;
        }
    } else {
        this.cam.x=this.ply.x*this.cSize-this.w/2 + this.cSize/2; 
        this.cam.y=this.ply.y*this.cSize-this.h/2 + this.cSize/2;
    }
    // Enhanced UI with active effects and progression stats
    const xpForNext = this.getXPForNextLevel();
    const xpTowardNext = this.totalExperience - ((this.playerLevel - 1) * (this.playerLevel - 1) * 100);
    const xpNeededForNext = xpForNext - this.totalExperience;
    
    // VERSION CONTROL: Always bump this when making changes!
    // Major.Minor.Patch (semver) - Update for: major features, new features, bug fixes
    // Remember to update after: refactoring, new systems, bug fixes, feature additions
    const version = '1.2.0'; // Updated: Fixed critical crash bugs in collectible system
    let uiText = `v${version} Lv.${this.playerLevel} Score ${this.score} Treasures ${this.treasureScore} Lives ${this.ply.lives}`;
    uiText += ` XP: ${xpTowardNext}/${xpTowardNext + xpNeededForNext} (+${xpNeededForNext})`;
    if (this.power) uiText += ` POWER (${Math.ceil(this.pTimer/1000)}s)`;
    uiText += ` Items: ${this.inventory.length}`;
    
    // Show active effects
    if (this.ply.activeEffects.size > 0) {
      uiText += ' ✨ ';
      this.ply.activeEffects.forEach((effect, type) => {
        const timeLeft = Math.ceil((effect.endTime - Date.now()) / 1000);
        uiText += `${effect.name}(${timeLeft}s) `;
      });
    }
    
    // Show active synergies
    if (this.activeSynergies.size > 0) {
      uiText += ' 🎆 ';
      this.synergyEffects.forEach((synergyData, id) => {
        const timeLeft = Math.ceil((synergyData.endTime - Date.now()) / 1000);
        const shortName = synergyData.synergy.name.split(' ')[0]; // First word only
        uiText += `${shortName}(${timeLeft}s) `;
      });
    }
    
    // Show rarity counts
    const rarities = [];
    if (this.rarityCount.legendary > 0) rarities.push(`✨${this.rarityCount.legendary}`);
    if (this.rarityCount.rare > 0) rarities.push(`💫${this.rarityCount.rare}`);
    if (this.rarityCount.uncommon > 0) rarities.push(`🔷${this.rarityCount.uncommon}`);
    if (rarities.length > 0) uiText += ` | ${rarities.join(' ')}`;
    
    document.getElementById('ui').textContent = uiText;
  }
  
  isWallOrDecor(gx, gy) {
    const wrappedGx = this._wrapCoord(gx, this.totalWorldWidthCells);
    const wrappedGy = this._wrapCoord(gy, this.totalWorldHeightCells);
    const type = this.maze.get(wrappedGx + ',' + wrappedGy);
    return type === 'W' || type === 'S';
  }

  createWallPattern(theme, cellSize) {
    const patternKey = `${theme.name}-${cellSize}`;
    if (this.wallPatterns.has(patternKey)) {
      return this.wallPatterns.get(patternKey);
    }

    // Create pattern canvas
    const patternSize = Math.max(64, cellSize * 2); // At least 64px for good tiling
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = patternSize;
    patternCanvas.height = patternSize;
    const pCtx = patternCanvas.getContext('2d');

    // Fill with theme wall color
    pCtx.fillStyle = theme.wallColor;
    pCtx.fillRect(0, 0, patternSize, patternSize);

    // Add deterministic emoji overlay using theme name as seed
    pCtx.textAlign = 'center';
    pCtx.textBaseline = 'middle';
    pCtx.globalAlpha = 0.8;

    // Create deterministic random based on theme name
    const seedRandom = (seed) => {
      let x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    
    let themeSeed = 0;
    for (let i = 0; i < theme.name.length; i++) {
      themeSeed += theme.name.charCodeAt(i) * (i + 1);
    }

    const emojiCount = Math.floor(patternSize / 12); // Density based on size
    for (let i = 0; i < emojiCount; i++) {
      const emoji = theme.wallPattern[i % theme.wallPattern.length];
      const x = seedRandom(themeSeed + i * 123) * patternSize;
      const y = seedRandom(themeSeed + i * 456) * patternSize;
      const size = (seedRandom(themeSeed + i * 789) * cellSize * 0.8) + cellSize * 0.4;
      const rotation = seedRandom(themeSeed + i * 101112) * Math.PI * 2;
      
      pCtx.save();
      pCtx.translate(x, y);
      pCtx.rotate(rotation);
      pCtx.font = `${size}px monospace`;
      pCtx.fillText(emoji, 0, 0);
      pCtx.restore();
    }

    // Create repeating pattern
    const pattern = this.ctx.createPattern(patternCanvas, 'repeat');
    this.wallPatterns.set(patternKey, pattern);
    return pattern;
  }

  collectItem(collectible) {
    collectible.collected = true;
    this.inventory.push(collectible);
    
    // Apply synergy bonuses to value
    let finalValue = collectible.value * this.ply.scoreMultiplier;
    
    // Knowledge boost synergy
    if (this.ply.knowledgeBoost && collectible.category === 'literature') {
      finalValue *= 1.5;
    }
    
    // Tech synergy bonus
    if (this.ply.techMaster && (collectible.category === 'software' || collectible.category === 'tool')) {
      finalValue *= 1.3;
    }
    
    this.treasureScore += Math.floor(finalValue);
    
    // Track rarity statistics and session progress
    if (collectible.rarity) {
      this.rarityCount[collectible.rarity]++;
    }
    this.playSession.itemsCollected++;
    
    // Award experience based on rarity
    const xpValues = { common: 5, uncommon: 15, rare: 50, legendary: 150 };
    const xp = xpValues[collectible.rarity] || 10;
    this.addExperience(xp, `${collectible.rarity} item`);
    
    // Check achievements after collecting
    this.checkAchievements();
    
    // Enhanced sound based on rarity and type
    if (collectible.rarity === 'legendary') {
      this.playSound('collectLegendary');
    } else if (collectible.rarity === 'rare') {
      this.playSound('collectRare');
    } else {
      switch(collectible.category) {
        case 'book': this.playSound('collectBook'); break;
        case 'software': this.playSound('collectSoftware'); break;
        case 'key': this.playSound('collectKey'); break;
        default: this.playSound('collectTreasure');
      }
    }
    
    // Create particle burst effect at collection point
    this.createCollectionEffect(collectible.gx, collectible.gy, collectible.rarity || collectible.category);
    
    // Apply special effects
    if (collectible.effect) {
      this.applyItemEffect(collectible);
    }
    
    // Check for synergies after adding item
    this.checkCollectibleSynergies();
    
    // Special logging for rare items
    if (collectible.rarity === 'legendary' || collectible.rarity === 'rare') {
      console.log(`✨ ${collectible.rarity.toUpperCase()}: ${collectible.name}! ${collectible.description || ''}`);
    } else if (collectible.category === 'key') {
      console.log(`Found ${collectible.name}! Keys can unlock special areas.`);
    } else if (collectible.category === 'book') {
      console.log(`Discovered: ${collectible.name} - ${collectible.content}`);
    }
  }

  draw(t_timestamp) {
    this.renderer.draw(t_timestamp);
  }

  playSound(type, ...args) {
    this.audio.playSound(type, ...args);
  }

  loadProgress(key) {
    try {
      const saved = localStorage.getItem(`gridluck_${key}`);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.warn('Failed to load progress:', e);
      return null;
    }
  }

  saveProgress(key, value) {
    try {
      localStorage.setItem(`gridluck_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn('Failed to save progress:', e);
    }
  }

  addExperience(amount, source = 'unknown') {
    this.totalExperience += amount;
    const newLevel = this.calculateLevel(this.totalExperience);
    
    if (newLevel > this.playerLevel) {
      this.levelUp(newLevel);
    }
    
    this.saveProgress('totalXP', this.totalExperience);
    console.log(`+${amount} XP from ${source} (Total: ${this.totalExperience})`);
  }

  calculateLevel(totalXP) {
    // Exponential leveling: level = floor(sqrt(totalXP / 100)) + 1
    return Math.floor(Math.sqrt(totalXP / 100)) + 1;
  }

  getXPForNextLevel() {
    const nextLevel = this.playerLevel + 1;
    return (nextLevel - 1) * (nextLevel - 1) * 100;
  }

  levelUp(newLevel) {
    const oldLevel = this.playerLevel;
    this.playerLevel = newLevel;
    this.saveProgress('level', this.playerLevel);
    
    // Grant level up rewards
    this.grantLevelRewards(newLevel);
    
    // Play level up sound and effects
    this.playSound('levelUp');
    this.createLevelUpEffect();
    
    console.log(`🎉 LEVEL UP! ${oldLevel} → ${newLevel}`);
    console.log(`💪 New abilities unlocked! Check your progression.`);
  }

  grantLevelRewards(level) {
    const rewards = {
      2: { ability: 'longer_power', description: 'Power pellets last 25% longer' },
      3: { ability: 'fast_start', description: 'Start each life with 2x speed for 5s' },
      5: { ability: 'ghost_radar', description: 'See ghost positions through walls' },
      7: { ability: 'treasure_sense', description: 'Collectibles glow from further away' },
      10: { ability: 'zone_master', description: 'Zone transitions grant temporary invincibility' },
      15: { ability: 'synergy_expert', description: 'Synergies last 50% longer' },
      20: { ability: 'legendary_luck', description: 'Double chance for legendary items' },
      25: { ability: 'master_explorer', description: 'All zones permanently unlocked' }
    };
    
    const reward = rewards[level];
    if (reward && !this.unlockedAbilities.includes(reward.ability)) {
      this.unlockedAbilities.push(reward.ability);
      this.saveProgress('abilities', this.unlockedAbilities);
      console.log(`🔓 Unlocked: ${reward.description}`);
    }
  }

  createLevelUpEffect() {
    // Spectacular level up effect
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      const speed = 5 + Math.random() * 7;
      
      this.collectionEffects.push({
        x: this.ply.x * this.cSize + this.cSize/2,
        y: this.ply.y * this.cSize + this.cSize/2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: ['#FFD700', '#FFA500', '#FF69B4', '#00FFFF', '#ADFF2F'][i % 5],
        life: 3.0,
        decay: 0.008,
        size: 8 + Math.random() * 6
      });
    }
  }

  checkAchievements() {
    const achievementDefs = [
      {
        id: 'first_steps',
        name: 'First Steps',
        description: 'Collect your first item',
        condition: () => this.playSession.itemsCollected >= 1,
        xp: 50
      },
      {
        id: 'treasure_hunter',
        name: 'Treasure Hunter',
        description: 'Collect 25 items in one session',
        condition: () => this.playSession.itemsCollected >= 25,
        xp: 200
      },
      {
        id: 'synergy_master',
        name: 'Synergy Master',
        description: 'Activate 3 synergies in one session',
        condition: () => this.playSession.synergiesToday >= 3,
        xp: 300
      },
      {
        id: 'ghost_buster',
        name: 'Ghost Buster',
        description: 'Eat 50 ghosts in one session',
        condition: () => this.playSession.ghostsEaten >= 50,
        xp: 250
      },
      {
        id: 'explorer',
        name: 'Explorer',
        description: 'Visit all 5 zone types',
        condition: () => this.playSession.zonesExplored.size >= 5,
        xp: 400
      },
      {
        id: 'legendary_collector',
        name: 'Legendary Collector',
        description: 'Find 5 legendary items (lifetime)',
        condition: () => this.rarityCount.legendary >= 5,
        xp: 500
      },
      {
        id: 'key_master',
        name: 'Key Master',
        description: 'Unlock 10 doors (lifetime)',
        condition: () => this.keyUsageLog.length >= 10,
        xp: 350
      },
      {
        id: 'marathon_player',
        name: 'Marathon Player',
        description: 'Play for 30 minutes straight',
        condition: () => (Date.now() - this.playSession.startTime) >= 30 * 60 * 1000,
        xp: 600
      }
    ];
    
    for (const achievement of achievementDefs) {
      if (!this.achievements.includes(achievement.id) && achievement.condition()) {
        this.unlockAchievement(achievement);
      }
    }
  }

  unlockAchievement(achievement) {
    this.achievements.push(achievement.id);
    this.saveProgress('achievements', this.achievements);
    this.addExperience(achievement.xp, `achievement: ${achievement.name}`);
    
    this.playSound('achievementUnlocked');
    this.createAchievementEffect();
    
    console.log(`🏆 ACHIEVEMENT UNLOCKED: ${achievement.name}`);
    console.log(`📝 ${achievement.description} (+${achievement.xp} XP)`);
  }

  createAchievementEffect() {
    // Achievement unlock effect
    for (let i = 0; i < 25; i++) {
      const angle = (i / 25) * Math.PI * 2;
      const speed = 3 + Math.random() * 4;
      
      this.collectionEffects.push({
        x: this.ply.x * this.cSize + this.cSize/2,
        y: this.ply.y * this.cSize + this.cSize/2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: ['#FFD700', '#FFA500', '#FF4500'][i % 3],
        life: 2.5,
        decay: 0.01,
        size: 5 + Math.random() * 3
      });
    }
  }

  applyLevelAbilities() {
    // Apply passive abilities based on unlocked progression
    if (this.unlockedAbilities.includes('longer_power')) {
      // Power pellets last 25% longer - applied in power timer logic
    }
    
    // Disabled fast_start - was making game too fast
    // if (this.unlockedAbilities.includes('fast_start') && this.ply.lives === 3) {
    //   this.applyItemEffect({
    //     effect: 'speed_boost',
    //     duration: 5000,
    //     name: 'Fast Start'
    //   });
    // }
    
    if (this.unlockedAbilities.includes('synergy_expert')) {
      // Synergies last 50% longer - applied in synergy activation
    }
  }

  checkCollectibleSynergies() {
    const synergies = [
      {
        id: 'scholar',
        name: 'Scholar\'s Arsenal',
        requirements: [{category: 'literature', count: 3}],
        effect: 'knowledge_boost',
        description: 'All books grant +50% more treasure points',
        duration: 30000
      },
      {
        id: 'tech_master',
        name: 'Tech Master',
        requirements: [{category: 'software', count: 2}, {category: 'tool', count: 1}],
        effect: 'tech_synergy',
        description: 'Digital items enhance tool effectiveness',
        duration: 25000
      },
      {
        id: 'treasure_hunter',
        name: 'Treasure Hunter',
        requirements: [{category: 'treasure', count: 4}],
        effect: 'treasure_magnet',
        description: 'Treasure items attract each other',
        duration: 40000
      },
      {
        id: 'keymaster',
        name: 'Keymaster',
        requirements: [{category: 'key', count: 3}],
        effect: 'master_key',
        description: 'Can unlock any door with any key',
        duration: 60000
      },
      {
        id: 'rainbow_collection',
        name: 'Rainbow Collection',
        requirements: [
          {category: 'key', color: 'red', count: 1},
          {category: 'key', color: 'blue', count: 1},
          {category: 'key', color: 'green', count: 1},
          {category: 'key', color: 'yellow', count: 1}
        ],
        effect: 'rainbow_power',
        description: 'Ultimate power! All abilities enhanced',
        duration: 120000
      },
      {
        id: 'hoarder',
        name: 'Hoarder',
        requirements: [{any: true, count: 10}],
        effect: 'inventory_boost',
        description: 'Massive inventory grants score multiplier',
        duration: 45000
      }
    ];
    
    for (const synergy of synergies) {
      if (!this.activeSynergies.has(synergy.id) && this.checkSynergyRequirements(synergy.requirements)) {
        this.activateSynergy(synergy);
      }
    }
  }

  checkSynergyRequirements(requirements) {
    for (const req of requirements) {
      if (req.any) {
        // Count all items
        if (this.inventory.length < req.count) return false;
      } else if (req.color) {
        // Specific color requirement
        const matchingItems = this.inventory.filter(item => 
          item.category === req.category && item.color === req.color
        );
        if (matchingItems.length < req.count) return false;
      } else {
        // Category requirement
        const matchingItems = this.inventory.filter(item => item.category === req.category);
        if (matchingItems.length < req.count) return false;
      }
    }
    return true;
  }

  activateSynergy(synergy) {
    this.activeSynergies.add(synergy.id);
    this.playSession.synergiesToday++;
    
    // Apply synergy effect with potential duration bonus
    this.applySynergyEffect(synergy);
    
    // Synergy expert ability extends duration
    const duration = this.unlockedAbilities.includes('synergy_expert') ? 
      Math.floor(synergy.duration * 1.5) : synergy.duration;
    
    // Set timer to remove synergy
    const timeout = setTimeout(() => {
      this.deactivateSynergy(synergy.id);
    }, duration);
    
    // Award experience for synergy activation
    this.addExperience(100, `synergy: ${synergy.name}`);
    this.checkAchievements();
    
    this.synergyEffects.set(synergy.id, {
      timeout: timeout,
      endTime: Date.now() + synergy.duration,
      synergy: synergy
    });
    
    // Play special synergy sound
    this.playSound('synergyActivated');
    
    // Create epic visual effect
    this.createSynergyEffect(synergy);
    
    console.log(`🎆 SYNERGY ACTIVATED: ${synergy.name} - ${synergy.description}`);
  }

  applySynergyEffect(synergy) {
    switch(synergy.effect) {
      case 'knowledge_boost':
        this.ply.knowledgeBoost = true;
        break;
      case 'tech_synergy':
        this.ply.techMaster = true;
        break;
      case 'treasure_magnet':
        this.ply.treasureMagnet = true;
        break;
      case 'master_key':
        this.ply.masterKey = true;
        break;
      case 'rainbow_power':
        this.ply.rainbowPower = true;
        // Removed speed boost - was too fast: this.ply.speedMultiplier = Math.min(this.ply.speedMultiplier, 0.7);
        this.ply.scoreMultiplier = Math.max(this.ply.scoreMultiplier, 5);
        this.ply.ghostImmune = true;
        break;
      case 'inventory_boost':
        this.ply.scoreMultiplier = Math.max(this.ply.scoreMultiplier, Math.floor(this.inventory.length / 3));
        break;
    }
  }

  deactivateSynergy(synergyId) {
    if (!this.activeSynergies.has(synergyId)) return;
    
    const synergyData = this.synergyEffects.get(synergyId);
    if (synergyData) {
      const synergy = synergyData.synergy;
      
      // Remove synergy effects
      switch(synergy.effect) {
        case 'knowledge_boost':
          this.ply.knowledgeBoost = false;
          break;
        case 'tech_synergy':
          this.ply.techMaster = false;
          break;
        case 'treasure_magnet':
          this.ply.treasureMagnet = false;
          break;
        case 'master_key':
          this.ply.masterKey = false;
          break;
        case 'rainbow_power':
          this.ply.rainbowPower = false;
          // Don't remove other effects as they might be from items
          break;
        case 'inventory_boost':
          // Score multiplier will be recalculated
          break;
      }
      
      console.log(`💫 Synergy ended: ${synergy.name}`);
      clearTimeout(synergyData.timeout);
    }
    
    this.activeSynergies.delete(synergyId);
    this.synergyEffects.delete(synergyId);
  }

  createSynergyEffect(synergy) {
    // Create spectacular visual effect for synergy activation
    const colors = {
      scholar: ['#8B4513', '#D2691E', '#F4A460'],
      tech_master: ['#00FF00', '#32CD32', '#7FFF00'],
      treasure_hunter: ['#FFD700', '#FFA500', '#FF8C00'],
      keymaster: ['#FF69B4', '#FF1493', '#DA70D6'],
      rainbow_collection: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'],
      hoarder: ['#800080', '#9932CC', '#BA55D3']
    };
    
    const effectColors = colors[synergy.id] || colors.treasure_hunter;
    
    // Create massive burst of particles
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const speed = 4 + Math.random() * 6;
      
      this.collectionEffects.push({
        x: this.ply.x * this.cSize + this.cSize/2,
        y: this.ply.y * this.cSize + this.cSize/2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: effectColors[i % effectColors.length],
        life: 2.0,
        decay: 0.01,
        size: 6 + Math.random() * 4
      });
    }
  }

  generateLockedAreaReward() {
    const rewards = [
      { type: 'treasure_cache', value: 500, description: 'Hidden treasure cache!' },
      { type: 'power_upgrade', effect: 'extended_power', description: 'Permanent power pellet boost!' },
      { type: 'score_bonus', multiplier: 3, description: '3x score multiplier zone!' },
      { type: 'secret_passage', description: 'Secret teleportation chamber!' },
      { type: 'legendary_item', rarity: 'legendary', description: 'Guaranteed legendary item!' }
    ];
    return rewards[Math.floor(Math.random() * rewards.length)];
  }

  applyItemEffect(collectible) {
    const effect = collectible.effect;
    const duration = collectible.duration || 5000;
    
    // Remove existing effect of same type
    if (this.ply.activeEffects.has(effect)) {
      clearTimeout(this.ply.activeEffects.get(effect).timeout);
    }
    
    // Apply effect
    switch(effect) {
      case 'ghost_immunity':
        this.ply.ghostImmune = true;
        console.log('✨ Ghost immunity activated!');
        break;
      case 'speed_boost':
        this.ply.speedMultiplier = 0.9;
        console.log('⚡ Speed boost activated!');
        break;
      case 'wall_phase':
        this.ply.canPhaseWalls = true;
        console.log('🔥 Wall phasing activated!');
        break;
      case 'score_multiplier':
        this.ply.scoreMultiplier = 2;
        console.log('💰 Score multiplier activated!');
        break;
      case 'ghost_fear':
        this.ghostsScared = true;
        console.log('🧿 Ghosts are now afraid!');
        break;
    }
    
    // Set timeout to remove effect
    const timeout = setTimeout(() => {
      this.removeItemEffect(effect);
    }, duration);
    
    this.ply.activeEffects.set(effect, {
      timeout: timeout,
      endTime: Date.now() + duration,
      name: collectible.name
    });
  }

  removeItemEffect(effect) {
    switch(effect) {
      case 'ghost_immunity':
        this.ply.ghostImmune = false;
        console.log('Ghost immunity ended');
        break;
      case 'speed_boost':
        this.ply.speedMultiplier = 1;
        console.log('Speed boost ended');
        break;
      case 'wall_phase':
        this.ply.canPhaseWalls = false;
        console.log('Wall phasing ended');
        break;
      case 'score_multiplier':
        this.ply.scoreMultiplier = 1;
        console.log('Score multiplier ended');
        break;
      case 'ghost_fear':
        this.ghostsScared = false;
        console.log('Ghosts are no longer afraid');
        break;
    }
    
    this.ply.activeEffects.delete(effect);
  }

  unlockArea(areaKey, key, usingMasterKey = false) {
    const lockedArea = this.lockedAreas.get(areaKey);
    if (!lockedArea || lockedArea.unlocked) return;
    
    // Unlock the area
    lockedArea.unlocked = true;
    this.maze.set(areaKey, ' '); // Convert to normal path
    
    // Remove the key from inventory (it's used up) - unless using master key synergy with wrong color
    if (!usingMasterKey || key.color === lockedArea.color) {
      const keyIndex = this.inventory.indexOf(key);
      if (keyIndex > -1) {
        this.inventory.splice(keyIndex, 1);
      }
    }
    
    // Log the unlock
    this.keyUsageLog.push({
      key: key.name,
      area: areaKey,
      reward: lockedArea.reward,
      timestamp: Date.now(),
      masterKey: usingMasterKey
    });
    
    // Play unlock sound and show effects
    this.playSound('unlockArea');
    this.createUnlockEffect(lockedArea.gx, lockedArea.gy, lockedArea.color);
    
    // Grant reward
    this.grantAreaReward(lockedArea.reward, lockedArea.gx, lockedArea.gy);
    
    const keyType = usingMasterKey && key.color !== lockedArea.color ? 
      `${key.name} (Master Key)` : key.name;
    console.log(`🔓 Unlocked ${lockedArea.color} door with ${keyType}! Reward: ${lockedArea.reward.description}`);
  }

  grantAreaReward(reward, gx, gy) {
    switch(reward.type) {
      case 'treasure_cache':
        this.treasureScore += reward.value;
        this.createCollectionEffect(gx, gy, 'legendary');
        break;
      case 'power_upgrade':
        this.ply.permanentPowerBoost = true;
        console.log('💫 Permanent power boost unlocked!');
        break;
      case 'score_bonus':
        // Create a special zone with score multiplier
        this.createBonusZone(gx, gy, reward.multiplier);
        break;
      case 'secret_passage':
        this.createSecretPassage(gx, gy);
        break;
      case 'legendary_item':
        this.spawnGuaranteedLegendary(gx, gy);
        break;
    }
  }

  createUnlockEffect(gx, gy, color) {
    const colorMap = {
      red: ['#ff0000', '#ff6666', '#ffcccc'],
      blue: ['#0066ff', '#6699ff', '#ccddff'],
      green: ['#00cc00', '#66ff66', '#ccffcc'],
      yellow: ['#ffcc00', '#ffdd66', '#ffffcc']
    };
    
    const effectColors = colorMap[color] || colorMap.red;
    
    // Create dramatic unlock burst
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const speed = 3 + Math.random() * 4;
      
      this.collectionEffects.push({
        x: gx * this.cSize + this.cSize/2,
        y: gy * this.cSize + this.cSize/2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: effectColors[i % effectColors.length],
        life: 1.5,
        decay: 0.015,
        size: 4 + Math.random() * 3
      });
    }
  }

  createBonusZone(gx, gy, multiplier) {
    // Mark area around the unlocked door as bonus zone
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const newGx = this._wrapCoord(gx + dx, this.totalWorldWidthCells);
        const newGy = this._wrapCoord(gy + dy, this.totalWorldHeightCells);
        const key = newGx + ',' + newGy;
        const tile = this.maze.get(key);
        if (tile === ' ' || tile === '.' || tile === 'P') {
          // Mark as bonus zone in some tracking system
          // For now, just add golden dots
          if (!this.dots.has(key)) {
            this.dots.add(key);
            // These will give bonus points when collected
          }
        }
      }
    }
    console.log(`🎆 Created ${multiplier}x score bonus zone at ${gx},${gy}`);
  }

  createSecretPassage(gx, gy) {
    // Create a teleportation point
    this.maze.set(gx + ',' + gy, 'T'); // T for teleport
    console.log(`✨ Secret passage created at ${gx},${gy}`);
  }

  spawnGuaranteedLegendary(gx, gy) {
    // Force spawn a legendary item
    const legendary = new Collectible(gx, gy, this);
    // Override to force legendary
    const legendaryItems = [
      { emoji: '🌟', name: 'Stellar Core', category: 'legendary', value: 1000, rarity: 'legendary',
        effect: 'ghost_immunity', duration: 10000, description: '10s ghost immunity' },
      { emoji: '⚡', name: 'Lightning Orb', category: 'legendary', value: 800, rarity: 'legendary',
        effect: 'speed_boost', duration: 15000, description: '15s speed boost' }
    ];
    const chosen = legendaryItems[Math.floor(Math.random() * legendaryItems.length)];
    Object.assign(legendary, chosen);
    
    this.collectibles.push(legendary);
    console.log(`✨ Guaranteed legendary spawned: ${legendary.name}`);
  }

  activateTeleport() {
    this.playSound('powerPellet'); 
    const currentModuleX = Math.floor(this._wrapCoord(this.ply.gx, this.totalWorldWidthCells) / this.PAT_C);
    const currentModuleY = Math.floor(this._wrapCoord(this.ply.gy, this.totalWorldHeightCells) / this.PAT_R);
    const emptySpots = [];
    for (let modYOffset = -1; modYOffset <= 1; modYOffset++) { 
        for (let modXOffset = -1; modXOffset <= 1; modXOffset++) {
            const smx = this._wrapCoord(currentModuleX + modXOffset, this.WORLD_MODULE_DIM); 
            const smy = this._wrapCoord(currentModuleY + modYOffset, this.WORLD_MODULE_DIM);
            for (let y_pat = 0; y_pat < this.PAT_R; y_pat++) { 
                for (let x_pat = 0; x_pat < this.PAT_C; x_pat++) {
                    const patChar = this.PAT[y_pat][x_pat]; 
                    if (patChar === '.' || patChar === 'P' || patChar === ' ' || patChar === 'O') { 
                        const gx = x_pat + smx * this.PAT_C; 
                        const gy = y_pat + smy * this.PAT_R;
                        let isSafe = true;
                        for(const ghost of this.ghosts) {
                           if(this._wrapCoord(ghost.gx, this.totalWorldWidthCells) === gx && this._wrapCoord(ghost.gy, this.totalWorldHeightCells) === gy) {isSafe=false; break;}
                        }
                        if(isSafe && !(this.ply.gx === gx && this.ply.gy === gy)) emptySpots.push({ gx, gy }); 
                    } 
                } 
            } 
        } 
    }
    if (emptySpots.length > 0) { const spot = emptySpots[Math.floor(Math.random() * emptySpots.length)]; Object.assign(this.ply, {gx:spot.gx, gy:spot.gy, x:spot.gx, y:spot.gy, t:0}); }
  }

  triggerAppleGhostFrenzy() {
    // Spawn 8 red frenzied ghosts near the player
    this.frenziedGhosts = [];
    const playerGx = this.ply.gx;
    const playerGy = this.ply.gy;
    
    for (let i = 0; i < 8; i++) {
      // Find valid spawn locations around the player
      let spawnGx, spawnGy;
      let attempts = 0;
      
      do {
        const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
        const distance = 3 + Math.random() * 5; // 3-8 cells away
        spawnGx = Math.floor(playerGx + Math.cos(angle) * distance);
        spawnGy = Math.floor(playerGy + Math.sin(angle) * distance);
        spawnGx = this._wrapCoord(spawnGx, this.totalWorldWidthCells);
        spawnGy = this._wrapCoord(spawnGy, this.totalWorldHeightCells);
        attempts++;
      } while (this.maze.get(spawnGx + ',' + spawnGy) === 'W' && attempts < 20);
      
      // Create frenzied ghost with aggressive properties
      const frenziedGhost = {
        id: `Frenzy${i}`,
        originalColor: '#ff0000',
        color: '#ff0000',
        gx: spawnGx,
        gy: spawnGy,
        x: spawnGx,
        y: spawnGy,
        dir: ['U','D','L','R'][Math.floor(Math.random() * 4)],
        t: 0,
        speed: this.GSPD[0] - 20, // Faster than normal ghosts
        inHouse: false,
        homePos: { gx: spawnGx, gy: spawnGy },
        isEaten: false,
        frenzyTimer: 20000, // 20 seconds of frenzy
        frenzied: true
      };
      
      this.frenziedGhosts.push(frenziedGhost);
    }
    
    // Play scary sound effect
    this.playSound('appleFrenzy');
    
    // Create dramatic visual effect
    this.createAppleFrenzyEffect();
  }

  createFruitEffect(gx, gy, color) {
    // Create fruit collection particle burst
    for (let i = 0; i < 15; i++) {
      const angle = (i / 15) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      
      this.collectionEffects.push({
        x: gx * this.cSize + this.cSize/2,
        y: gy * this.cSize + this.cSize/2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        life: 1.5,
        decay: 0.015,
        size: 4 + Math.random() * 3
      });
    }
  }

  createCollectionEffect(gx, gy, rarity) {
    // Create collectible collection particle burst with rarity-based colors
    const colors = {
      common: '#00ff00',
      uncommon: '#0088ff', 
      rare: '#ff8800',
      legendary: '#ff00ff',
      treasure: '#ffff00',
      key: '#ff0000',
      literature: '#ffffff',
      software: '#00ffff'
    };
    const color = colors[rarity] || '#00ff00';
    const particleCount = rarity === 'legendary' ? 25 : rarity === 'rare' ? 20 : 15;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      
      this.collectionEffects.push({
        x: gx * this.cSize + this.cSize/2,
        y: gy * this.cSize + this.cSize/2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        life: 1.5,
        decay: 0.015,
        size: 4 + Math.random() * 3
      });
    }
  }

  createAppleFrenzyEffect() {
    // Dramatic red explosion effect
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * Math.PI * 2;
      const speed = 5 + Math.random() * 8;
      
      this.collectionEffects.push({
        x: this.ply.x * this.cSize + this.cSize/2,
        y: this.ply.y * this.cSize + this.cSize/2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: ['#ff0000', '#ff4444', '#cc0000', '#880000'][i % 4],
        life: 3.0,
        decay: 0.008,
        size: 6 + Math.random() * 4
      });
    }
  }
}