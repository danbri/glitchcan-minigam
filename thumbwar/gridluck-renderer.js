// GridLuck Renderer - Handles all drawing and visual effects
// Extracted from gridluck-game.js for better modularity

import { Vec2D } from './gridluck-entities.js';

export class GridLuckRenderer {
  constructor(game) {
    this.game = game;
  }

  draw(t_timestamp) { 
    const cs = this.game.cSize; 
    if (cs < 0.1) return;
    
    const ctx = this.game.ctx; 
    ctx.save();
    ctx.translate(-Math.floor(this.game.cam.x), -Math.floor(this.game.cam.y)); 
    
    const viewX = Math.floor(this.game.cam.x); 
    const viewY = Math.floor(this.game.cam.y);
    ctx.fillStyle = '#000'; 
    ctx.fillRect(viewX, viewY, this.game.w, this.game.h);

    const startGx_view = Math.floor(this.game.cam.x / cs) - 1; 
    const endGx_view = Math.ceil((this.game.cam.x + this.game.w) / cs) + 1;
    const startGy_view = Math.floor(this.game.cam.y / cs) - 1; 
    const endGy_view = Math.ceil((this.game.cam.y + this.game.h) / cs) + 1;
    
    const originalFont = ctx.font;
    const wallFillEmojiBaseSize = Math.max(3, Math.floor(cs * 0.25));
    ctx.textAlign = "center"; 
    ctx.textBaseline = "middle";

    // Draw base tiles
    this.drawBaseTiles(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view);
    
    // Draw path borders
    this.drawPathBorders(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view);
    
    // Draw corner radius details
    this.drawCornerDetails(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view);

    // Draw special tiles (doors, walls, etc.)
    this.drawSpecialTiles(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view, t_timestamp, originalFont);

    // Draw decorations
    this.drawDecorations(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view, originalFont);

    // Draw dots
    this.drawDots(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view, t_timestamp);

    // Draw fruit trails (TV zone)
    this.drawFruitTrails(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view, t_timestamp);

    // Draw fruit
    this.drawFruit(ctx, cs);

    // Draw zone entities
    this.drawZoneEntities(ctx, cs);

    // Draw ghosts
    this.drawGhosts(ctx, cs, t_timestamp);

    // Draw collectibles
    this.drawCollectibles(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view);

    // Draw player
    this.drawPlayer(ctx, cs, t_timestamp);
    
    // Draw zone transition effects
    this.drawZoneTransitions(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view, t_timestamp);
    
    // Draw collection particle effects
    this.drawCollectionEffects(ctx);
    
    ctx.restore();
  }

  drawBaseTiles(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view) {
    for (let b_draw = startGy_view; b_draw <= endGy_view; b_draw++) {
      for (let a_draw = startGx_view; a_draw <= endGx_view; a_draw++) {
        const a_world = a_draw;
        const b_world = b_draw;
        
        // Skip tiles outside world boundaries
        if (a_world < 0 || a_world >= this.game.totalWorldWidthCells || b_world < 0 || b_world >= this.game.totalWorldHeightCells) {
          continue;
        }
        const k = a_world + ',' + b_world;
        const tileType = this.game.maze.get(k);
        if (!tileType && tileType !== ' ') continue;
        
        const theme = this.game.getThemeForCell(a_world, b_world);
        if (!theme) continue; // Skip rendering outside world boundaries
        
        const drawX = a_draw * cs; 
        const drawY = b_draw * cs;

        if (tileType === 'W' || tileType === 'S') {
          ctx.fillStyle = theme.wallColor || '#333';
        } else {
          ctx.fillStyle = theme.pathColor || '#060606'; 
        }
        ctx.fillRect(drawX, drawY, cs, cs);
      }
    }
  }

  drawPathBorders(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view) {
    ctx.strokeStyle = '#18189F'; 
    ctx.lineWidth = Math.max(0.5, cs * 0.06);
    const BORDER_OFFSET = ctx.lineWidth / 2;
    
    for (let b_draw = startGy_view; b_draw <= endGy_view; b_draw++) {
      for (let a_draw = startGx_view; a_draw <= endGx_view; a_draw++) {
        const a_world = a_draw;
        const b_world = b_draw;
        
        // Skip tiles outside world boundaries
        if (a_world < 0 || a_world >= this.game.totalWorldWidthCells || b_world < 0 || b_world >= this.game.totalWorldHeightCells) {
          continue;
        }
        const tileType = this.game.maze.get(a_world + ',' + b_world);
        if (tileType === 'W' || tileType === 'S' || !tileType) continue;
        
        const x_screen = a_draw * cs; 
        const y_screen = b_draw * cs;
        if (this.game.isWallOrDecor(a_world, b_world - 1)) { 
          ctx.beginPath(); 
          ctx.moveTo(x_screen - BORDER_OFFSET, y_screen); 
          ctx.lineTo(x_screen + cs + BORDER_OFFSET, y_screen); 
          ctx.stroke(); 
        }
        if (this.game.isWallOrDecor(a_world, b_world + 1)) { 
          ctx.beginPath(); 
          ctx.moveTo(x_screen - BORDER_OFFSET, y_screen + cs); 
          ctx.lineTo(x_screen + cs + BORDER_OFFSET, y_screen + cs); 
          ctx.stroke(); 
        }
        if (this.game.isWallOrDecor(a_world - 1, b_world)) { 
          ctx.beginPath(); 
          ctx.moveTo(x_screen, y_screen - BORDER_OFFSET); 
          ctx.lineTo(x_screen, y_screen + cs + BORDER_OFFSET); 
          ctx.stroke(); 
        }
        if (this.game.isWallOrDecor(a_world + 1, b_world)) { 
          ctx.beginPath(); 
          ctx.moveTo(x_screen + cs, y_screen - BORDER_OFFSET); 
          ctx.lineTo(x_screen + cs, y_screen + cs + BORDER_OFFSET); 
          ctx.stroke(); 
        }
      }
    }
  }

  drawCornerDetails(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view) {
    const cornerRadius = cs * 0.25;
    ctx.fillStyle = '#18189F';
    
    for (let b_draw = startGy_view; b_draw <= endGy_view; b_draw++) {
      for (let a_draw = startGx_view; a_draw <= endGx_view; a_draw++) {
        const a_world = a_draw;
        const b_world = b_draw;
        
        // Skip tiles outside world boundaries
        if (a_world < 0 || a_world >= this.game.totalWorldWidthCells || b_world < 0 || b_world >= this.game.totalWorldHeightCells) {
          continue;
        }
        const tileType = this.game.maze.get(a_world + ',' + b_world);
        if (tileType === 'W' || tileType === 'S' || !tileType) continue;
        
        const x_screen = a_draw * cs; 
        const y_screen = b_draw * cs;
        
        if (this.game.isWallOrDecor(a_world - 1, b_world) && this.game.isWallOrDecor(a_world, b_world - 1) && !this.game.isWallOrDecor(a_world-1,b_world-1)) { 
          ctx.beginPath(); 
          ctx.arc(x_screen, y_screen, cornerRadius, Math.PI, Math.PI * 1.5); 
          ctx.lineTo(x_screen,y_screen); 
          ctx.fill(); 
        }
        if (this.game.isWallOrDecor(a_world + 1, b_world) && this.game.isWallOrDecor(a_world, b_world - 1) && !this.game.isWallOrDecor(a_world+1,b_world-1)) { 
          ctx.beginPath(); 
          ctx.arc(x_screen + cs, y_screen, cornerRadius, Math.PI * 1.5, 0); 
          ctx.lineTo(x_screen+cs,y_screen); 
          ctx.fill(); 
        }
        if (this.game.isWallOrDecor(a_world - 1, b_world) && this.game.isWallOrDecor(a_world, b_world + 1) && !this.game.isWallOrDecor(a_world-1,b_world+1)) { 
          ctx.beginPath(); 
          ctx.arc(x_screen, y_screen + cs, cornerRadius, Math.PI * 0.5, Math.PI); 
          ctx.lineTo(x_screen,y_screen+cs); 
          ctx.fill(); 
        }
        if (this.game.isWallOrDecor(a_world + 1, b_world) && this.game.isWallOrDecor(a_world, b_world + 1) && !this.game.isWallOrDecor(a_world+1,b_world+1)) { 
          ctx.beginPath(); 
          ctx.arc(x_screen + cs, y_screen + cs, cornerRadius, 0, Math.PI * 0.5); 
          ctx.lineTo(x_screen+cs,y_screen+cs); 
          ctx.fill(); 
        }
      }
    }
  }

  drawSpecialTiles(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view, t_timestamp, originalFont) {
    for (let b_draw = startGy_view; b_draw <= endGy_view; b_draw++) {
      for (let a_draw = startGx_view; a_draw <= endGx_view; a_draw++) {
        const a_world = a_draw;
        const b_world = b_draw;
        
        // Skip tiles outside world boundaries
        if (a_world < 0 || a_world >= this.game.totalWorldWidthCells || b_world < 0 || b_world >= this.game.totalWorldHeightCells) {
          continue;
        }
        const k = a_world + ',' + b_world;
        const tileType = this.game.maze.get(k);
        if (!tileType) continue;
        
        const drawX = a_draw * cs; 
        const drawY = b_draw * cs;

        if (tileType === 'L') {
          // Render locked door
          const lockedArea = this.game.lockedAreas.get(k);
          if (lockedArea && !lockedArea.unlocked) {
            const doorColors = {
              red: '#ff3333', blue: '#3366ff', green: '#33cc33', yellow: '#ffcc33'
            };
            const doorColor = doorColors[lockedArea.color] || '#ff3333';
            
            // Draw door background
            ctx.fillStyle = doorColor;
            ctx.fillRect(drawX, drawY, cs, cs);
            
            // Draw lock symbol
            ctx.fillStyle = '#ffffff';
            ctx.font = `${cs * 0.6}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔒', drawX + cs/2, drawY + cs/2);
            
            // Add pulsing glow effect
            const pulsePhase = (t_timestamp / 1000) + (a_world + b_world) * 0.1;
            const pulseIntensity = (Math.sin(pulsePhase) + 1) * 0.3 + 0.4;
            ctx.save();
            ctx.globalAlpha = pulseIntensity;
            ctx.shadowColor = doorColor;
            ctx.shadowBlur = cs * 0.3;
            ctx.fillStyle = doorColor;
            ctx.fillRect(drawX, drawY, cs, cs);
            ctx.restore();
          }
        } else if (tileType === 'W') {
          // Use pattern fill for walls
          const theme = this.game.getThemeForCell(a_world, b_world);
          if (theme) { // Only render if within world boundaries
            const pattern = this.game.createWallPattern(theme, cs);
            ctx.fillStyle = pattern;
            ctx.fillRect(drawX, drawY, cs, cs);
          }
        } else if (tileType === 'T') {
          ctx.fillStyle = '#101010'; 
          ctx.fillRect(drawX, drawY, cs, cs);
          ctx.fillStyle = '#1C1C1C'; 
          ctx.fillRect(drawX + cs * 0.1, drawY + cs * 0.1, cs * 0.8, cs * 0.8);
        } else if (tileType === 'TV') {
          // Draw TV screen with flickering effect
          ctx.fillStyle = '#222'; 
          ctx.fillRect(drawX, drawY, cs, cs);
          
          // TV screen
          const flickerIntensity = 0.3 + Math.sin(t_timestamp * 0.01) * 0.2 + Math.random() * 0.1;
          const screenColor = `hsl(${Math.floor(Math.random() * 360)}, 70%, ${Math.floor(30 + flickerIntensity * 40)}%)`;
          ctx.fillStyle = screenColor;
          ctx.fillRect(drawX + cs * 0.1, drawY + cs * 0.1, cs * 0.8, cs * 0.7);
          
          // TV base
          ctx.fillStyle = '#111';
          ctx.fillRect(drawX + cs * 0.2, drawY + cs * 0.8, cs * 0.6, cs * 0.2);
          
          // Flickering emoji on screen
          if (Math.random() < 0.8) {
            const tvEmojis = ['📺', '🎮', '🕹️', '👾', '🎬'];
            const emoji = tvEmojis[Math.floor(t_timestamp * 0.003) % tvEmojis.length];
            ctx.font = `${cs * 0.4}px Arial`;
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(emoji, drawX + cs * 0.5, drawY + cs * 0.5);
          }
        } else if (tileType === '-') {
          ctx.fillStyle = '#f55'; 
          ctx.fillRect(drawX, drawY + cs * 0.4, cs, cs * 0.2);
        }
      }
    }
    ctx.font = originalFont;
  }

  drawDecorations(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view, originalFont) {
    const largeEmojiBaseSize = Math.max(8, cs*0.9); 
    
    this.game.specialDecorRenderList.forEach(decor => {
      let decorDrawGx = decor.gx; 
      let decorDrawGy = decor.gy;
      
      // Check if decor needs to be drawn wrapped relative to camera view
      if (this.game.cam.x > decor.gx * cs + (decor.w_cells * cs) / 2  + this.game.totalWorldWidthCells * cs / 2 ) 
        decorDrawGx += this.game.totalWorldWidthCells;
      else if (this.game.cam.x < decor.gx * cs + (decor.w_cells * cs) / 2 - this.game.totalWorldWidthCells * cs / 2) 
        decorDrawGx -= this.game.totalWorldWidthCells;

      if (decorDrawGx + decor.w_cells < startGx_view || decorDrawGx > endGx_view || decorDrawGy + decor.h_cells < startGy_view || decorDrawGy > endGy_view) return; 
      
      const decorCenterX = (decorDrawGx + decor.w_cells / 2) * cs; 
      const decorCenterY = (decorDrawGy + decor.h_cells / 2) * cs;
      const decorEmojiActualSize = Math.min(decor.w_cells, decor.h_cells) * largeEmojiBaseSize * 0.8;
      ctx.font = `${decorEmojiActualSize}px sans-serif`; 
      ctx.textAlign = "center"; 
      ctx.textBaseline = "middle";
      ctx.fillText(decor.emoji, decorCenterX, decorCenterY + decorEmojiActualSize * 0.05); 
    });
    ctx.font = originalFont;
  }

  drawDots(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view, t_timestamp) {
    ctx.fillStyle='#ffb'; 
    this.game.dots.forEach(k => { 
      const[xStr,yStr] = k.split(','); 
      let a_world = parseInt(xStr), b_world = parseInt(yStr); 
      let a_draw = a_world; 
      let b_draw = b_world;
      
      if(this.game.ply.x < this.game.totalWorldWidthCells/3 && a_world > this.game.totalWorldWidthCells*2/3) 
        a_draw -= this.game.totalWorldWidthCells;
      else if(this.game.ply.x > this.game.totalWorldWidthCells*2/3 && a_world < this.game.totalWorldWidthCells/3) 
        a_draw += this.game.totalWorldWidthCells;
      if(this.game.ply.y < this.game.totalWorldHeightCells/3 && b_world > this.game.totalWorldHeightCells*2/3) 
        b_draw -= this.game.totalWorldHeightCells;
      else if(this.game.ply.y > this.game.totalWorldHeightCells*2/3 && b_world < this.game.totalWorldHeightCells/3) 
        b_draw += this.game.totalWorldHeightCells;

      if (a_draw < startGx_view || a_draw > endGx_view || b_draw < startGy_view || b_draw > endGy_view) return;
      
      const tileTypeAtDot = this.game.maze.get(k); 
      const r = tileTypeAtDot ==='P'? cs*0.3*(1+Math.sin(t_timestamp/150)*0.15) : cs*0.1;
      ctx.beginPath();
      ctx.arc(a_draw*cs+cs/2,b_draw*cs+cs/2,r,0,Math.PI*2);
      ctx.fill(); 
    });
  }

  drawFruitTrails(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view, t_timestamp) {
    // Draw fruit trail tiles (F) in TV zone as small fruit emojis
    for (let gy = 0; gy < this.game.totalWorldHeightCells; gy++) {
      for (let gx = 0; gx < this.game.totalWorldWidthCells; gx++) {
        const k = gx + ',' + gy;
        const tileType = this.game.maze.get(k);
        
        if (tileType === 'F') {
          // Check if in view
          if (gx >= startGx_view && gx <= endGx_view && gy >= startGy_view && gy <= endGy_view) {
            const centerX = gx * cs + cs/2;
            const centerY = gy * cs + cs/2;
            
            // Rotate through different small fruits
            const fruits = ['🍒', '🍓', '🍊', '🍌'];
            const fruitIndex = (gx + gy) % fruits.length;
            const fruit = fruits[fruitIndex];
            
            // Small size and slight animation
            const size = cs * 0.4;
            const bounce = Math.sin((t_timestamp + gx * 100 + gy * 200) / 300) * 2;
            
            ctx.font = `${size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(fruit, centerX, centerY + bounce);
          }
        }
      }
    }
  }

  drawFruit(ctx, cs) {
    if(this.game.fruit.active){ 
      let fruitDrawX = this.game.fruit.gx; 
      let fruitDrawY = this.game.fruit.gy;
      
      if(this.game.ply.x < this.game.totalWorldWidthCells/3 && this.game.fruit.gx > this.game.totalWorldWidthCells*2/3) 
        fruitDrawX -= this.game.totalWorldWidthCells;
      else if(this.game.ply.x > this.game.totalWorldWidthCells*2/3 && this.game.fruit.gx < this.game.totalWorldWidthCells/3) 
        fruitDrawX += this.game.totalWorldWidthCells;
      if(this.game.ply.y < this.game.totalWorldHeightCells/3 && this.game.fruit.gy > this.game.totalWorldHeightCells*2/3) 
        fruitDrawY -= this.game.totalWorldHeightCells;
      else if(this.game.ply.y > this.game.totalWorldHeightCells*2/3 && this.game.fruit.gy < this.game.totalWorldHeightCells/3) 
        fruitDrawY += this.game.totalWorldHeightCells;

      const fruitCenterX = fruitDrawX*cs+cs/2; 
      const fruitCenterY = fruitDrawY*cs+cs/2;
      
      // Draw fruit emoji with glow effect
      ctx.save();
      ctx.shadowColor = this.game.fruit.color || '#ffff00';
      ctx.shadowBlur = cs * 0.4;
      ctx.font = `${cs * 0.7}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.game.fruit.emoji || '🍒', fruitCenterX, fruitCenterY);
      ctx.restore(); 
    }
  }

  drawZoneEntities(ctx, cs) {
    this.game.zoneEntities.forEach(entity => {
      let entityDrawX = entity.type === 'slimeMold' ? entity.gx * cs : entity.pos.x;
      let entityDrawY = entity.type === 'slimeMold' ? entity.gy * cs : entity.pos.y;
      
      const camCenterX = this.game.cam.x + this.game.w / 2;
      const camCenterY = this.game.cam.y + this.game.h / 2;
      const worldPixelW = this.game.totalWorldWidthCells * cs;
      const worldPixelH = this.game.totalWorldHeightCells * cs;

      if (Math.abs(entityDrawX - camCenterX) > worldPixelW / 2) {
        entityDrawX += (entityDrawX < camCenterX ? worldPixelW : -worldPixelW);
      }
      if (Math.abs(entityDrawY - camCenterY) > worldPixelH / 2) {
        entityDrawY += (entityDrawY < camCenterY ? worldPixelH : -worldPixelH);
      }

      const screenX = entityDrawX - this.game.cam.x;
      const screenY = entityDrawY - this.game.cam.y;
      const renderMargin = entity.size ? entity.size * 2 : cs * 2; 

      if (screenX > -renderMargin && screenX < this.game.w + renderMargin &&
          screenY > -renderMargin && screenY < this.game.h + renderMargin) {
        
        if(entity.type === 'slimeMold'){
          entity.draw(ctx, cs, entityDrawX/cs, entityDrawY/cs); // Slime needs its draw gx,gy
        } else {
          const tempPos = entity.pos; 
          entity.pos = new Vec2D(entityDrawX, entityDrawY); 
          entity.draw(ctx);
          entity.pos = tempPos; 
        }
      }
    });
  }

  drawGhosts(ctx, cs, t_timestamp) {
    [...this.game.ghosts, ...this.game.frenziedGhosts].forEach(g => {
      let ghostDrawX = g.x; 
      let ghostDrawY = g.y;
      
      if(Math.abs(g.x - this.game.ply.x) > this.game.totalWorldWidthCells/2) 
        ghostDrawX += (g.x < this.game.ply.x ? this.game.totalWorldWidthCells : -this.game.totalWorldWidthCells);
      if(Math.abs(g.y - this.game.ply.y) > this.game.totalWorldHeightCells/2) 
        ghostDrawY += (g.y < this.game.ply.y ? this.game.totalWorldHeightCells : -this.game.totalWorldHeightCells);

      let ghostFillColor = g.color; 
      if (!g.isEaten && this.game.power){ 
        if(this.game.pTimer > 2000 || Math.floor(this.game.pTimer/200)%2 !==0) 
          ghostFillColor = '#22f'; 
        else 
          ghostFillColor = '#eef'; 
      }
      
      ctx.fillStyle = ghostFillColor;
      const gxPos = ghostDrawX*cs, gyPos = ghostDrawY*cs; 
      ctx.beginPath(); 
      ctx.arc(gxPos+cs/2,gyPos+cs/2,cs*0.45,Math.PI,0); 
      ctx.lineTo(gxPos+cs*0.95,gyPos+cs*0.85); 
      
      const humps = 3; 
      const skirtBaseY = gyPos+cs*0.85;
      for(let i=0; i<humps; i++){ 
        const x1 = gxPos + cs*(0.95 - (i+0.25)*(0.9/humps)); 
        const y1 = skirtBaseY + cs*0.1; 
        const x2 = gxPos + cs*(0.95 - (i+0.5)*(0.9/humps)); 
        const y2 = skirtBaseY; 
        if (i < humps -1) 
          ctx.quadraticCurveTo(x1, y1, x2, y2); 
        else 
          ctx.quadraticCurveTo(x1, y1, gxPos+cs*0.05, skirtBaseY); 
      }
      ctx.closePath();
      ctx.fill();
      
      if (!g.isEaten && this.game.power && ghostFillColor === '#eef') {
        // Skip eyes when flashing white
      } else { 
        ctx.fillStyle = '#fff'; 
        const eyeBaseX = gxPos+cs/2; 
        const eyeBaseY = gyPos+cs*0.4; 
        const eyeOuterRad = cs*0.12; 
        const eyePupilRad = cs*0.06; 
        let eyeOffsetX = cs*0.15; 
        let pupilOffsetX = 0; 
        let pupilOffsetY = 0; 
        const pupilDist = eyeOuterRad - eyePupilRad - cs*0.01; 
        
        if (g.dir === 'L') pupilOffsetX = -pupilDist; 
        else if (g.dir === 'R') pupilOffsetX = pupilDist; 
        else if (g.dir === 'U') pupilOffsetY = -pupilDist; 
        else if (g.dir === 'D') pupilOffsetY = pupilDist; 
        
        ctx.beginPath(); 
        ctx.arc(eyeBaseX - eyeOffsetX, eyeBaseY, eyeOuterRad, 0, Math.PI*2); 
        ctx.fill(); 
        ctx.beginPath(); 
        ctx.arc(eyeBaseX + eyeOffsetX, eyeBaseY, eyeOuterRad, 0, Math.PI*2); 
        ctx.fill(); 
        
        ctx.fillStyle = g.isEaten ? '#555' : '#00f'; 
        ctx.beginPath(); 
        ctx.arc(eyeBaseX - eyeOffsetX + pupilOffsetX, eyeBaseY + pupilOffsetY, eyePupilRad, 0, Math.PI*2); 
        ctx.fill(); 
        ctx.beginPath(); 
        ctx.arc(eyeBaseX + eyeOffsetX + pupilOffsetX, eyeBaseY + pupilOffsetY, eyePupilRad, 0, Math.PI*2); 
        ctx.fill(); 
      }
    });
  }

  drawCollectibles(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view) {
    this.game.collectibles.forEach(collectible => {
      if (!collectible.collected) {
        // Check if in view
        const screenGx = collectible.gx;
        const screenGy = collectible.gy;
        
        if (screenGx >= startGx_view && screenGx <= endGx_view && 
            screenGy >= startGy_view && screenGy <= endGy_view) {
          collectible.draw(ctx, cs);
        }
      }
    });
  }

  drawPlayer(ctx, cs, t_timestamp) {
    let playerDrawX = this.game.ply.x; 
    let playerDrawY = this.game.ply.y;
    
    if (this.game.ply.dying) {
      // Glitchy mysterious death animation inspired by original
      const centerX = playerDrawX*cs+cs/2;
      const centerY = playerDrawY*cs+cs/2;
      const phase = this.game.ply.deathPhase;
      
      ctx.save();
      
      if (phase < 8) {
        // Phase 1-8: Pacman opening sequence (like original death)
        const openness = (phase + 1) / 8; // 0 to 1
        const mouthAngle = 0.1 + openness * (Math.PI - 0.2); // Open wider
        const rot = {R:0,D:Math.PI/2,L:Math.PI,U:-Math.PI/2}[this.game.ply.dir];
        
        // Glitchy color effects
        const glitchColors = ['#ff0', '#f80', '#f40', '#f00', '#800', '#400', '#200', '#000'];
        ctx.fillStyle = glitchColors[phase] || '#000';
        
        ctx.beginPath(); 
        ctx.moveTo(centerX, centerY); 
        ctx.arc(centerX, centerY, cs*0.45, rot-mouthAngle, rot+mouthAngle); 
        ctx.fill();
        
        // Add glitch effect 
        if (phase > 3) {
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = '#fff';
          for (let i = 0; i < 3; i++) {
            const glitchX = centerX + (Math.random() - 0.5) * cs * 0.3;
            const glitchY = centerY + (Math.random() - 0.5) * cs * 0.3;
            ctx.fillRect(glitchX, glitchY, 2, 1);
          }
        }
      } else {
        // Phase 9+: Digital dissolution effect
        const dissolve = Math.min(1, (phase - 8) / 5);
        ctx.globalAlpha = 1 - dissolve;
        
        // Fragmented pixels
        const fragments = 20;
        for (let i = 0; i < fragments; i++) {
          const angle = (i / fragments) * Math.PI * 2;
          const dist = dissolve * cs * 0.8;
          const x = centerX + Math.cos(angle) * dist;
          const y = centerY + Math.sin(angle) * dist;
          
          ctx.fillStyle = i % 2 ? '#ff0' : '#f80';
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }
      
      ctx.restore();
    } else {
      // Normal pacman
      ctx.fillStyle='#ff0'; 
      const mouthAngle=0.35+Math.sin(t_timestamp/90)/4.5; 
      const rot={R:0,D:Math.PI/2,L:Math.PI,U:-Math.PI/2}[this.game.ply.dir];
      ctx.beginPath(); 
      ctx.moveTo(playerDrawX*cs+cs/2,playerDrawY*cs+cs/2); 
      ctx.arc(playerDrawX*cs+cs/2,playerDrawY*cs+cs/2,cs*0.45,rot+mouthAngle,rot-mouthAngle); 
      ctx.fill();
    }
  }

  drawZoneTransitions(ctx, cs, startGx_view, endGx_view, startGy_view, endGy_view, t_timestamp) {
    // Draw striking swirly zone transition effects ON TOP of everything
    let glowsRendered = 0;
    for (let b_draw = startGy_view; b_draw <= endGy_view; b_draw++) {
      for (let a_draw = startGx_view; a_draw <= endGx_view; a_draw++) {
        const a_world = a_draw;
        const b_world = b_draw;
        
        // Skip tiles outside world boundaries
        if (a_world < 0 || a_world >= this.game.totalWorldWidthCells || b_world < 0 || b_world >= this.game.totalWorldHeightCells) {
          continue;
        }
        const k = a_world + ',' + b_world;
        const transition = this.game.zoneTransitions.get(k);
        
        if (transition) {
          glowsRendered++;
          const centerX = a_draw * cs + cs/2; 
          const centerY = b_draw * cs + cs/2;
          
          // Swirling particle vortex effect
          const time = t_timestamp * 0.003 + (a_world + b_world) * 0.1;
          const intensity = (Math.sin(time * 2) + 1) * 0.5; // 0 to 1
          
          ctx.save();
          
          // Draw swirling particles
          const particleCount = 12;
          const radius = cs * (0.8 + intensity * 0.4);
          
          for (let p = 0; p < particleCount; p++) {
            const angle = (p / particleCount) * Math.PI * 2 + time * 3;
            const spiralRadius = radius * (0.3 + (p / particleCount) * 0.7);
            const x = centerX + Math.cos(angle) * spiralRadius;
            const y = centerY + Math.sin(angle) * spiralRadius;
            
            // Particle trail with decreasing alpha
            const alpha = (1 - p / particleCount) * 0.8 * intensity;
            const size = cs * (0.15 + p / particleCount * 0.1);
            
            // Create single striking color based on themes
            const hue = (transition.fromTheme.name.length * 60 + transition.toTheme.name.length * 40) % 360;
            
            ctx.globalAlpha = alpha;
            ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
            ctx.shadowBlur = size;
            ctx.fillStyle = `hsl(${hue}, 100%, 80%)`;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          }
          
          ctx.restore();
        }
      }
    }
  }

  drawCollectionEffects(ctx) {
    // Draw collection particle effects
    this.game.collectionEffects.forEach(effect => {
      ctx.save();
      ctx.globalAlpha = effect.life;
      ctx.fillStyle = effect.color;
      ctx.shadowColor = effect.color;
      ctx.shadowBlur = effect.size;
      ctx.beginPath();
      ctx.arc(effect.x - this.game.cam.x, effect.y - this.game.cam.y, effect.size * effect.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}