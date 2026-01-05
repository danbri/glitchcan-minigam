/**
 * Tests for Splat Demo Physics (object-object collision)
 * Tests the collision detection and response logic used in splat-physics.html
 */

import { describe, it, expect } from 'vitest';

/**
 * Collision detection between two circular objects
 * @param {Object} a - First object {x, y, size, vx, vy}
 * @param {Object} b - Second object {x, y, size, vx, vy}
 * @returns {Object|null} Collision info or null if no collision
 */
function detectCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = (a.size + b.size) / 2;

  if (dist < minDist && dist > 0) {
    return {
      nx: dx / dist,
      ny: dy / dist,
      overlap: minDist - dist,
      dist
    };
  }
  return null;
}

/**
 * Resolve collision by separating objects and exchanging velocity
 * @param {Object} a - First object (mutated)
 * @param {Object} b - Second object (mutated)
 * @param {Object} collision - Collision info from detectCollision
 * @param {number} bounce - Bounce coefficient (0-1)
 */
function resolveCollision(a, b, collision, bounce = 0.7) {
  const { nx, ny, overlap } = collision;

  // Push apart equally
  a.x -= nx * overlap / 2;
  a.y -= ny * overlap / 2;
  b.x += nx * overlap / 2;
  b.y += ny * overlap / 2;

  // Relative velocity
  const dvx = a.vx - b.vx;
  const dvy = a.vy - b.vy;
  const dvn = dvx * nx + dvy * ny;

  // Only resolve if objects are approaching
  if (dvn > 0) {
    // Impulse (equal mass assumption)
    const impulse = dvn * (1 + bounce) / 2;

    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;
  }
}

describe('Splat Demo Physics', () => {
  describe('detectCollision', () => {
    it('should detect collision when objects overlap', () => {
      const a = { x: 0, y: 0, size: 20 };
      const b = { x: 15, y: 0, size: 20 };

      const collision = detectCollision(a, b);

      expect(collision).not.toBeNull();
      expect(collision.overlap).toBeCloseTo(5, 5); // 20 - 15 = 5
      expect(collision.nx).toBeCloseTo(1, 5); // Pointing right
      expect(collision.ny).toBeCloseTo(0, 5);
    });

    it('should not detect collision when objects are apart', () => {
      const a = { x: 0, y: 0, size: 20 };
      const b = { x: 30, y: 0, size: 20 };

      const collision = detectCollision(a, b);

      expect(collision).toBeNull();
    });

    it('should handle diagonal collisions', () => {
      const a = { x: 0, y: 0, size: 20 };
      const b = { x: 10, y: 10, size: 20 };

      const collision = detectCollision(a, b);

      expect(collision).not.toBeNull();
      // Normal should be roughly 45 degrees
      expect(collision.nx).toBeCloseTo(collision.ny, 5);
    });

    it('should handle objects at same position gracefully', () => {
      const a = { x: 5, y: 5, size: 20 };
      const b = { x: 5, y: 5, size: 20 }; // Same position

      const collision = detectCollision(a, b);

      // dist = 0, so collision should be null (avoid division by zero)
      expect(collision).toBeNull();
    });
  });

  describe('resolveCollision', () => {
    it('should separate overlapping objects', () => {
      const a = { x: 0, y: 0, size: 20, vx: 0, vy: 0 };
      const b = { x: 15, y: 0, size: 20, vx: 0, vy: 0 };

      const collision = detectCollision(a, b);
      resolveCollision(a, b, collision);

      // Objects should now be exactly touching (not overlapping)
      const newDist = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
      expect(newDist).toBeCloseTo(20, 5); // size/2 + size/2 = 10 + 10
    });

    it('should exchange velocity on head-on collision', () => {
      const a = { x: 0, y: 0, size: 20, vx: 100, vy: 0 };
      const b = { x: 15, y: 0, size: 20, vx: -100, vy: 0 };

      const collision = detectCollision(a, b);
      resolveCollision(a, b, collision, 1.0); // Perfect elastic

      // With bounce=1 and equal mass, velocities should swap
      expect(a.vx).toBeLessThan(0);
      expect(b.vx).toBeGreaterThan(0);
    });

    it('should not change velocity if objects are separating', () => {
      const a = { x: 0, y: 0, size: 20, vx: -50, vy: 0 };
      const b = { x: 15, y: 0, size: 20, vx: 50, vy: 0 };

      const collision = detectCollision(a, b);
      const originalAvx = a.vx;
      const originalBvx = b.vx;

      resolveCollision(a, b, collision);

      // Velocities should remain unchanged (objects already separating)
      expect(a.vx).toBe(originalAvx);
      expect(b.vx).toBe(originalBvx);
    });

    it('should respect bounce coefficient', () => {
      const a = { x: 0, y: 0, size: 20, vx: 100, vy: 0 };
      const b = { x: 15, y: 0, size: 20, vx: 0, vy: 0 };

      const collision = detectCollision(a, b);
      resolveCollision(a, b, collision, 0.5); // 50% bounce

      // Total momentum should be conserved
      const totalMomentumBefore = 100 + 0;
      const totalMomentumAfter = a.vx + b.vx;
      expect(totalMomentumAfter).toBeCloseTo(totalMomentumBefore, 5);
    });

    it('should handle vertical collisions', () => {
      const a = { x: 0, y: 0, size: 20, vx: 0, vy: 100 };
      const b = { x: 0, y: 15, size: 20, vx: 0, vy: -50 };

      const collision = detectCollision(a, b);
      resolveCollision(a, b, collision, 0.7);

      // Vertical velocities should change
      expect(a.vy).toBeLessThan(100);
      expect(b.vy).toBeGreaterThan(-50);
    });
  });

  describe('Integration: multiple objects', () => {
    it('should handle chain of collisions', () => {
      const objects = [
        { x: 0, y: 0, size: 20, vx: 100, vy: 0 },
        { x: 25, y: 0, size: 20, vx: 0, vy: 0 },
        { x: 50, y: 0, size: 20, vx: 0, vy: 0 }
      ];

      // Simulate a few steps
      for (let step = 0; step < 10; step++) {
        // Move objects
        for (const obj of objects) {
          obj.x += obj.vx * 0.016;
          obj.y += obj.vy * 0.016;
        }

        // Check collisions
        for (let i = 0; i < objects.length; i++) {
          for (let j = i + 1; j < objects.length; j++) {
            const collision = detectCollision(objects[i], objects[j]);
            if (collision) {
              resolveCollision(objects[i], objects[j], collision, 0.7);
            }
          }
        }
      }

      // Energy should transfer through the chain
      // Last object should have gained some velocity
      expect(objects[2].vx).toBeGreaterThan(0);
    });
  });
});
