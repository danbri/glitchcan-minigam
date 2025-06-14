// GridLuck Game Entities - Vector Math and Entity Classes
// Extracted from gridluck.html for better modularity

export class Vec2D {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    add(v) { return new Vec2D(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vec2D(this.x - v.x, this.y - v.y); }
    mult(s) { return new Vec2D(this.x * s, this.y * s); }
    div(s) { return s === 0 ? new Vec2D() : new Vec2D(this.x / s, this.y / s); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() { const m = this.mag(); return m === 0 ? new Vec2D() : this.div(m); }
    limit(max) { if (this.mag() > max) return this.normalize().mult(max); return this; }
    setMag(m) { return this.normalize().mult(m); }
    static dist(v1, v2) { return v1.sub(v2).mag(); }
    static random2D() { const angle = Math.random() * Math.PI * 2; return new Vec2D(Math.cos(angle), Math.sin(angle));}
}

export class Boid {
    constructor(x, y, zonePixelBounds, emojis = ['🐦'], baseCellSize = 10, gameRef = null) {
        this.pos = new Vec2D(x, y);
        this.vel = Vec2D.random2D().mult(Math.random() * 1.5 + 0.5);
        this.acc = new Vec2D();
        this.maxSpeed = 2.2;
        this.maxForce = 0.12;
        this.perceptionRadius = 45;
        this.separationRadius = 18;
        this.zoneBounds = zonePixelBounds;
        this.emojis = Array.isArray(emojis) ? emojis : [emojis];
        this.currentEmoji = this.emojis[Math.floor(Math.random() * this.emojis.length)];
        this.emojiChangeTimer = Math.random() * 5000 + 3000; // Change emoji every 3-8s
        this.baseCellSize = baseCellSize;
        this.gameRef = gameRef;
        this.type = 'boid';
    }
    applyForce(force) { this.acc = this.acc.add(force); }
    flock(boids) {
        let separation = new Vec2D(); let alignment = new Vec2D(); let cohesion = new Vec2D();
        let separationCount = 0; let neighborCount = 0;
        let fearForce = new Vec2D();
        
        // Fear response to player and ghosts
        if (this.gameRef) {
            const playerDist = Vec2D.dist(this.pos, new Vec2D(this.gameRef.ply.x * this.gameRef.cSize, this.gameRef.ply.y * this.gameRef.cSize));
            if (playerDist < this.perceptionRadius * 2) {
                const flee = this.pos.sub(new Vec2D(this.gameRef.ply.x * this.gameRef.cSize, this.gameRef.ply.y * this.gameRef.cSize));
                fearForce = fearForce.add(flee.normalize().mult(this.maxForce * 3));
            }
            
            // Also fear ghosts
            this.gameRef.ghosts.forEach(ghost => {
                const ghostDist = Vec2D.dist(this.pos, new Vec2D(ghost.x * this.gameRef.cSize, ghost.y * this.gameRef.cSize));
                if (ghostDist < this.perceptionRadius * 1.5) {
                    const flee = this.pos.sub(new Vec2D(ghost.x * this.gameRef.cSize, ghost.y * this.gameRef.cSize));
                    fearForce = fearForce.add(flee.normalize().mult(this.maxForce * 2));
                }
            });
        }
        
        for (let other of boids) {
            if (other === this || other.type !== 'boid') continue;
            let d = Vec2D.dist(this.pos, other.pos);
            if (d > 0 && d < this.perceptionRadius) {
                alignment = alignment.add(other.vel); cohesion = cohesion.add(other.pos); neighborCount++;
                if (d < this.separationRadius) {
                    let diff = this.pos.sub(other.pos); diff = diff.normalize().div(d); separation = separation.add(diff); separationCount++;
                }
            }
        }
        if (neighborCount > 0) {
            alignment = alignment.div(neighborCount).setMag(this.maxSpeed).sub(this.vel).limit(this.maxForce);
            cohesion = cohesion.div(neighborCount).sub(this.pos).setMag(this.maxSpeed).sub(this.vel).limit(this.maxForce);
        }
        if (separationCount > 0) separation = separation.div(separationCount).setMag(this.maxSpeed).sub(this.vel).limit(this.maxForce*1.5);
        
        this.applyForce(alignment.mult(0.5)); this.applyForce(cohesion.mult(0.4)); this.applyForce(separation.mult(1.2));
        this.applyForce(fearForce); // Fear overrides other behaviors
    }
    wrap() {
        // Gentle constraint - only redirect if clearly in a wall center
        if (this.gameRef) {
            const gx = Math.floor(this.pos.x / this.gameRef.cSize);
            const gy = Math.floor(this.pos.y / this.gameRef.cSize);
            const wrappedGx = Math.max(0, Math.min(gx, this.gameRef.totalWorldWidthCells - 1));
            const wrappedGy = Math.max(0, Math.min(gy, this.gameRef.totalWorldHeightCells - 1));
            const tile = this.gameRef.maze.get(wrappedGx + ',' + wrappedGy);
            
            // Only redirect if clearly in wall center (not near edges)
            const cellX = this.pos.x % this.gameRef.cSize;
            const cellY = this.pos.y % this.gameRef.cSize;
            const margin = this.gameRef.cSize * 0.3;
            const inWallCenter = (cellX > margin && cellX < this.gameRef.cSize - margin) && 
                               (cellY > margin && cellY < this.gameRef.cSize - margin);
            
            if ((tile === 'W' || tile === 'S') && inWallCenter) {
                // Check if cornered - no nearby paths
                const directions = [
                    { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
                ];
                let pathFound = false;
                
                for (const dir of directions) {
                    const testGx = Math.max(0, Math.min(gx + dir.dx, this.gameRef.totalWorldWidthCells - 1));
                    const testGy = Math.max(0, Math.min(gy + dir.dy, this.gameRef.totalWorldHeightCells - 1));
                    const testTile = this.gameRef.maze.get(testGx + ',' + testGy);
                    if (testTile === ' ' || testTile === '.' || testTile === 'P' || testTile === 'O' || testTile === 'T') {
                        // Gently push towards this direction
                        this.vel.x += dir.dx * 0.1;
                        this.vel.y += dir.dy * 0.1;
                        pathFound = true;
                        break;
                    }
                }
                
                // If truly cornered, eat through the maze!
                if (!pathFound && Math.random() < 0.02) { // 2% chance per frame when cornered
                    const eatDir = directions[Math.floor(Math.random() * directions.length)];
                    const eatGx = Math.max(0, Math.min(gx + eatDir.dx, this.gameRef.totalWorldWidthCells - 1));
                    const eatGy = Math.max(0, Math.min(gy + eatDir.dy, this.gameRef.totalWorldHeightCells - 1));
                    const eatKey = eatGx + ',' + eatGy;
                    const eatTile = this.gameRef.maze.get(eatKey);
                    
                    if (eatTile === 'W') {
                        // Eat the wall - convert to path
                        this.gameRef.maze.set(eatKey, ' ');
                        this.gameRef.wallFillDecorations.delete(eatKey);
                        // Add a temporary glow effect
                        setTimeout(() => {
                            this.gameRef.maze.set(eatKey, 'W'); // Wall regenerates after 5 seconds
                        }, 5000);
                    }
                }
            }
        }
        
        // Regular zone wrapping
        if (this.pos.x < this.zoneBounds.x) this.pos.x = this.zoneBounds.x + this.zoneBounds.width;
        if (this.pos.x > this.zoneBounds.x + this.zoneBounds.width) this.pos.x = this.zoneBounds.x;
        if (this.pos.y < this.zoneBounds.y) this.pos.y = this.zoneBounds.y + this.zoneBounds.height;
        if (this.pos.y > this.zoneBounds.y + this.zoneBounds.height) this.pos.y = this.zoneBounds.y;
    }
    update(dt_ms) {
        this.emojiChangeTimer -= dt_ms;
        if (this.emojiChangeTimer <= 0 && this.emojis.length > 1) {
            this.currentEmoji = this.emojis[Math.floor(Math.random() * this.emojis.length)];
            this.emojiChangeTimer = Math.random() * 5000 + 3000;
        }
        this.vel = this.vel.add(this.acc); this.vel = this.vel.limit(this.maxSpeed);
        this.pos = this.pos.add(this.vel); this.acc = new Vec2D(); this.wrap();
    }
    draw(ctx) {
        const currentSize = this.gameRef ? this.baseCellSize * (this.gameRef.cSize / this.gameRef.originalCSize) : this.baseCellSize;
        ctx.font = `${currentSize}px monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.save(); ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(Math.atan2(this.vel.y, this.vel.x) + Math.PI/2);
        ctx.fillText(this.currentEmoji, 0, 0); ctx.restore();
    }
}

export class Asteroid {
    constructor(x, y, zonePixelBounds, baseCellSize = 1, gameRef = null) {
        this.pos = new Vec2D(x, y);
        this.vel = Vec2D.random2D().mult(Math.random() * 0.8 + 0.15);
        this.zoneBounds = zonePixelBounds;
        this.baseCellSize = baseCellSize;
        this.baseSize = Math.random() * 12 + 8;
        this.angle = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.025;
        this.numSides = Math.floor(Math.random() * 3) + 3;
        this.color = `rgb(${Math.floor(Math.random()*80+150)}, ${Math.floor(Math.random()*80+150)}, ${Math.floor(Math.random()*80+150)})`;
        this.type = 'asteroid';
        this.gameRef = gameRef;
        this.offsets = Array.from({length: this.numSides}, () => Math.random()*0.3 + 0.85);
    }
    wrap() {
        // Gentle constraint for asteroids too
        if (this.gameRef) {
            const gx = Math.floor(this.pos.x / this.gameRef.cSize);
            const gy = Math.floor(this.pos.y / this.gameRef.cSize);
            const wrappedGx = Math.max(0, Math.min(gx, this.gameRef.totalWorldWidthCells - 1));
            const wrappedGy = Math.max(0, Math.min(gy, this.gameRef.totalWorldHeightCells - 1));
            const tile = this.gameRef.maze.get(wrappedGx + ',' + wrappedGy);
            
            const cellX = this.pos.x % this.gameRef.cSize;
            const cellY = this.pos.y % this.gameRef.cSize;
            const margin = this.gameRef.cSize * 0.3;
            const inWallCenter = (cellX > margin && cellX < this.gameRef.cSize - margin) && 
                               (cellY > margin && cellY < this.gameRef.cSize - margin);
            
            if ((tile === 'W' || tile === 'S') && inWallCenter) {
                const directions = [
                    { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
                ];
                for (const dir of directions) {
                    const testGx = Math.max(0, Math.min(gx + dir.dx, this.gameRef.totalWorldWidthCells - 1));
                    const testGy = Math.max(0, Math.min(gy + dir.dy, this.gameRef.totalWorldHeightCells - 1));
                    const testTile = this.gameRef.maze.get(testGx + ',' + testGy);
                    if (testTile === ' ' || testTile === '.' || testTile === 'P' || testTile === 'O' || testTile === 'T') {
                        this.vel.x += dir.dx * 0.05;
                        this.vel.y += dir.dy * 0.05;
                        break;
                    }
                }
            }
        }
        
        const currentSize = this.gameRef ? this.baseSize * this.baseCellSize * (this.gameRef.cSize / this.gameRef.originalCSize) : this.baseSize;
        const margin = currentSize;
        if (this.pos.x < this.zoneBounds.x - margin) this.pos.x = this.zoneBounds.x + this.zoneBounds.width + margin;
        if (this.pos.x > this.zoneBounds.x + this.zoneBounds.width + margin) this.pos.x = this.zoneBounds.x - margin;
        if (this.pos.y < this.zoneBounds.y - margin) this.pos.y = this.zoneBounds.y + this.zoneBounds.height + margin;
        if (this.pos.y > this.zoneBounds.y + this.zoneBounds.height + margin) this.pos.y = this.zoneBounds.y - margin;
    }
    update(dt_ms) {
        this.pos = this.pos.add(this.vel);
        this.angle += this.rotationSpeed;
        this.wrap();
    }
    draw(ctx) {
        const currentSize = this.gameRef ? this.baseSize * this.baseCellSize * (this.gameRef.cSize / this.gameRef.originalCSize) : this.baseSize;
        ctx.save(); 
        ctx.translate(this.pos.x, this.pos.y); 
        ctx.rotate(this.angle);
        
        // Green wireframe with glow
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = currentSize * 0.3;
        ctx.strokeStyle = '#00ff00'; 
        ctx.lineWidth = Math.max(1, currentSize * 0.15); 
        ctx.beginPath();
        
        for (let i = 0; i < this.numSides; i++) {
            const angle = (i / this.numSides) * Math.PI * 2; 
            const r = currentSize * this.offsets[i];
            const x = r * Math.cos(angle); 
            const y = r * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); 
        ctx.stroke(); 
        ctx.restore();
    }
}

export class DecorativeShip {
    constructor(x, y, zonePixelBounds, size = 15) {
        this.pos = new Vec2D(x, y);
        this.vel = Vec2D.random2D().mult(0.25);
        this.angle = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.008;
        this.zoneBounds = zonePixelBounds;
        this.size = size;
        this.color = '#b0b0b0';
        this.type = 'decorShip';
    }
    wrap() {
        const margin = this.size;
        if (this.pos.x < this.zoneBounds.x - margin) this.pos.x = this.zoneBounds.x + this.zoneBounds.width + margin;
        if (this.pos.x > this.zoneBounds.x + this.zoneBounds.width + margin) this.pos.x = this.zoneBounds.x - margin;
        if (this.pos.y < this.zoneBounds.y - margin) this.pos.y = this.zoneBounds.y + this.zoneBounds.height + margin;
        if (this.pos.y > this.zoneBounds.y + this.zoneBounds.height + margin) this.pos.y = this.zoneBounds.y - margin;
    }
    update(dt_ms) { this.pos = this.pos.add(this.vel); this.angle += this.rotationSpeed; this.wrap(); }
    draw(ctx) {
        ctx.save(); ctx.translate(this.pos.x, this.pos.y); ctx.rotate(this.angle);
        ctx.fillStyle = this.color; ctx.beginPath();
        ctx.moveTo(0, -this.size * 0.6); ctx.lineTo(-this.size * 0.4, this.size * 0.4);
        ctx.lineTo(this.size * 0.4, this.size * 0.4); ctx.closePath(); ctx.fill(); ctx.restore();
    }
}

export class Collectible {
    constructor(gx, gy, gameRef) {
        this.gx = gx; this.gy = gy;
        this.gameRef = gameRef;
        this.type = 'collectible';
        this.collected = false;
        this.bobPhase = Math.random() * Math.PI * 2; // For floating animation
        
        // Weighted random collectible type (rarer items have lower spawn chance)
        const rand = Math.random();
        let chosen;
        
        if (rand < 0.02) { // 2% - Ultra Rare
            const ultraRare = [
                { emoji: '🌟', name: 'Stellar Core', category: 'legendary', value: 1000, rarity: 'legendary',
                  effect: 'ghost_immunity', duration: 10000, description: '10s ghost immunity' },
                { emoji: '⚡', name: 'Lightning Orb', category: 'legendary', value: 800, rarity: 'legendary',
                  effect: 'speed_boost', duration: 15000, description: '15s speed boost' },
                { emoji: '🔮', name: 'Crystal Ball', category: 'legendary', value: 1200, rarity: 'legendary',
                  effect: 'reveal_map', duration: 20000, description: 'Reveals all nearby items' }
            ];
            chosen = ultraRare[Math.floor(Math.random() * ultraRare.length)];
        } else if (rand < 0.08) { // 6% - Rare
            const rare = [
                { emoji: '💰', name: 'Gold Bag', category: 'treasure', value: 500, rarity: 'rare',
                  effect: 'score_multiplier', duration: 8000, description: '2x score for 8s' },
                { emoji: '🔥', name: 'Fire Gem', category: 'treasure', value: 400, rarity: 'rare',
                  effect: 'wall_phase', duration: 5000, description: 'Phase through walls 5s' },
                { emoji: '🧿', name: 'Evil Eye', category: 'tool', value: 350, rarity: 'rare',
                  effect: 'ghost_fear', duration: 12000, description: 'Ghosts flee from you' }
            ];
            chosen = rare[Math.floor(Math.random() * rare.length)];
        } else if (rand < 0.25) { // 17% - Uncommon
            const uncommon = [
                { emoji: '💎', name: 'Crystal', category: 'treasure', value: 200, rarity: 'uncommon' },
                { emoji: '📜', name: 'Scroll', category: 'literature', value: 150, rarity: 'uncommon' },
                { emoji: '🗝️', name: 'Key', category: 'key', value: 100, rarity: 'uncommon',
                  color: ['red', 'blue', 'green', 'yellow'][Math.floor(Math.random() * 4)] },
                { emoji: '🧭', name: 'Compass', category: 'tool', value: 120, rarity: 'uncommon',
                  effect: 'mini_map', duration: 30000, description: 'Shows mini-map' }
            ];
            chosen = uncommon[Math.floor(Math.random() * uncommon.length)];
        } else { // 75% - Common
            const common = [
                { emoji: '📚', name: 'Book', category: 'literature', value: 50, rarity: 'common' },
                { emoji: '💾', name: 'Floppy Disk', category: 'software', value: 30, rarity: 'common',
                  content: 'LOAD "MYSTERY.EXE"\nRUN\n> Hello, traveler...' },
                { emoji: '🪙', name: 'Coin', category: 'treasure', value: 25, rarity: 'common' },
                { emoji: '⚙️', name: 'Gear', category: 'tool', value: 40, rarity: 'common' }
            ];
            chosen = common[Math.floor(Math.random() * common.length)];
        }
        
        Object.assign(this, chosen);
        
        if (this.category === 'key') {
            this.name = `${this.color} Key`;
        }
        
        // Generate content after object creation to avoid 'this' issues
        if (this.category === 'literature') {
            if (this.name === 'Book') {
                this.content = this.generateBookContent();
            } else if (this.name === 'Scroll') {
                this.content = this.generateScrollContent();
            }
        }
    }
    
    generateBookContent() {
        const titles = [
            "The Infinite Maze\nby M.C. Escher",
            "Digital Dreams\nCyberpunk Tales",
            "Ghost in the Machine\nAI Philosophy",
            "Quantum Mechanics\nFor Beginners",
            "The Art of Code\nBeautiful Algorithms"
        ];
        return titles[Math.floor(Math.random() * titles.length)];
    }
    
    generateScrollContent() {
        const scrolls = [
            "mi tawa tomo sina\n(I go to your house)",
            ".- .-.. .. ...- .\n(ALIVE in Morse)",
            "HERE BE DRAGONS\nExplore with caution",
            "Follow the glowing paths\nto find zone passages",
            "The answer is 42\n- Deep Thought"
        ];
        return scrolls[Math.floor(Math.random() * scrolls.length)];
    }
    
    update(dt_ms) {
        this.bobPhase += dt_ms / 1000;
    }
    
    draw(ctx, cs) {
        const centerX = this.gx * cs + cs/2;
        const centerY = this.gy * cs + cs/2 + Math.sin(this.bobPhase * 2) * cs * 0.1;
        
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${cs * 0.6}px monospace`;
        
        // Glow effect
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = cs * 0.3;
        ctx.fillText(this.emoji, centerX, centerY);
        
        ctx.restore();
    }
}

export class SlimeMold {
    constructor(gx, gy, zonePixelBounds, gameRef) {
        this.gx = gx; this.gy = gy; // Game grid cell position
        this.zoneBounds = zonePixelBounds; // Pixel bounds of the module it lives in
        this.gameRef = gameRef; // Reference to the Game instance for canMove
        this.type = 'slimeMold';
        this.subGridSize = 4;
        this.cells = Array(this.subGridSize * this.subGridSize).fill(0);
        for(let i=0; i<5; i++) this.cells[Math.floor(Math.random()*this.cells.length)] = 1; // Initial random live cells
        this.pulseTimer = 0;
        this.moveTimer = Math.random() * 4000 + 3000; // Move every 3-7 seconds
        this.color = "rgba(100, 200, 100, "; // Base color, alpha will change
    }

    update(dt_ms) {
        this.pulseTimer += dt_ms;
        this.moveTimer -= dt_ms;

        if (Math.floor(this.pulseTimer / 300) % 2 === 0) { // Update slime every ~300ms
            const nextCells = Array(this.cells.length).fill(0);
            for (let i = 0; i < this.cells.length; i++) {
                const x = i % this.subGridSize;
                const y = Math.floor(i / this.subGridSize);
                let liveNeighbors = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < this.subGridSize && ny >= 0 && ny < this.subGridSize) {
                            if (this.cells[ny * this.subGridSize + nx] === 1) liveNeighbors++;
                        }
                    }
                }
                if (this.cells[i] === 1 && (liveNeighbors === 2 || liveNeighbors === 3)) nextCells[i] = 1;
                else if (this.cells[i] === 0 && liveNeighbors === 3) nextCells[i] = 1;
            }
            this.cells = nextCells;
        }
        
        if (this.moveTimer <= 0) {
            const dirs = ['U','D','L','R'].sort(()=>Math.random()-0.5);
            let moved = false;
            for(const dir of dirs){
                const [vx,vy] = this.gameRef.VEC[dir];
                const nextGx = this.gx + vx;
                const nextGy = this.gy + vy;
                const wrappedNextGx = Math.max(0, Math.min(nextGx, this.gameRef.totalWorldWidthCells - 1));
                const wrappedNextGy = Math.max(0, Math.min(nextGy, this.gameRef.totalWorldHeightCells - 1));

                if (this.gameRef.maze.get(wrappedNextGx + ',' + wrappedNextGy) === ' ') { // Check if target cell is empty path
                    this.gx = wrappedNextGx;
                    this.gy = wrappedNextGy;
                    moved = true;
                    break;
                }
            }
            this.moveTimer = Math.random() * 4000 + 3000;
        }
    }

    draw(ctx, cs) {
        const subCellSize = cs / this.subGridSize;
        const alpha = 0.5 + Math.sin(this.pulseTimer / 500) * 0.4; // Pulsating alpha
        ctx.fillStyle = this.color + alpha + ")";

        for (let i = 0; i < this.cells.length; i++) {
            if (this.cells[i] === 1) {
                const x = i % this.subGridSize;
                const y = Math.floor(i / this.subGridSize);
                ctx.fillRect(this.gx * cs + x * subCellSize, this.gy * cs + y * subCellSize, subCellSize, subCellSize);
            }
        }
    }
}