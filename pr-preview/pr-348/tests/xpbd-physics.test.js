/**
 * XPBD Physics Tests - Test-First Development
 *
 * LCD-044: XPBD Physics System
 *
 * Run with: npx vitest run tests/xpbd-physics.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  createParticle,
  createDistanceConstraint,
  createPositionConstraint,
  createChain,
  integratePositions,
  solveDistanceConstraint,
  solvePositionConstraint,
  simulationStep,
  vec3
} from '../lucid/core/physics/xpbd.js';

describe('XPBD Physics', () => {

  describe('Particle Creation', () => {
    it('should create a particle with position', () => {
      const p = createParticle([1, 2, 3], 1.0);
      expect(p.pos).toEqual([1, 2, 3]);
      expect(p.prevPos).toEqual([1, 2, 3]);
      expect(p.velocity).toEqual([0, 0, 0]);
    });

    it('should compute inverse mass correctly', () => {
      const p1 = createParticle([0, 0, 0], 2.0);
      expect(p1.invMass).toBe(0.5);

      const p2 = createParticle([0, 0, 0], 0.5);
      expect(p2.invMass).toBe(2.0);
    });

    it('should create anchored particle with zero mass', () => {
      const p = createParticle([0, 0, 0], 0);
      expect(p.invMass).toBe(0);
    });

    it('should assign optional name', () => {
      const p = createParticle([0, 0, 0], 1.0, 'tail_tip');
      expect(p.name).toBe('tail_tip');
    });
  });

  describe('Vector Math', () => {
    it('should add vectors', () => {
      expect(vec3.add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    });

    it('should subtract vectors', () => {
      expect(vec3.sub([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3]);
    });

    it('should scale vectors', () => {
      expect(vec3.scale([1, 2, 3], 2)).toEqual([2, 4, 6]);
    });

    it('should compute dot product', () => {
      expect(vec3.dot([1, 0, 0], [0, 1, 0])).toBe(0); // perpendicular
      expect(vec3.dot([1, 0, 0], [1, 0, 0])).toBe(1); // parallel
      expect(vec3.dot([2, 3, 4], [1, 1, 1])).toBe(9);
    });

    it('should compute vector length', () => {
      expect(vec3.length([3, 4, 0])).toBe(5);
      expect(vec3.length([0, 0, 0])).toBe(0);
    });

    it('should normalize vectors', () => {
      const n = vec3.normalize([3, 0, 0]);
      expect(n[0]).toBeCloseTo(1);
      expect(n[1]).toBe(0);
      expect(n[2]).toBe(0);
    });

    it('should handle zero vector normalization', () => {
      expect(vec3.normalize([0, 0, 0])).toEqual([0, 0, 0]);
    });
  });

  describe('Particle Integration', () => {
    it('should not move anchored particles', () => {
      const particles = [createParticle([0, 10, 0], 0)]; // anchored
      integratePositions(particles, 1/60, [0, -9.81, 0]);
      expect(particles[0].pos).toEqual([0, 10, 0]);
    });

    it('should apply gravity to free particles', () => {
      const p = createParticle([0, 10, 0], 1.0);
      const particles = [p];

      integratePositions(particles, 1/60, [0, -9.81, 0]);

      // After one step, should have moved down
      expect(p.pos[1]).toBeLessThan(10);
    });

    it('should preserve velocity with Verlet integration', () => {
      const p = createParticle([0, 0, 0], 1.0);
      // Simulate initial velocity by offsetting prevPos
      p.prevPos = [-1, 0, 0]; // Moving +x at 1 unit/step

      const particles = [p];
      integratePositions(particles, 1/60, [0, 0, 0]); // no gravity

      // Should continue moving in +x direction
      expect(p.pos[0]).toBeGreaterThan(0);
    });

    it('should update prevPos after integration', () => {
      const p = createParticle([5, 5, 5], 1.0);
      const particles = [p];

      const oldPos = [...p.pos];
      integratePositions(particles, 1/60, [0, -9.81, 0]);

      expect(p.prevPos).toEqual(oldPos);
    });
  });

  describe('Distance Constraints', () => {
    it('should create distance constraint', () => {
      const c = createDistanceConstraint(0, 1, 2.0, 0.001);
      expect(c.type).toBe('distance');
      expect(c.particles).toEqual([0, 1]);
      expect(c.restValue).toBe(2.0);
      expect(c.compliance).toBe(0.001);
    });

    it('should maintain rest length between particles', () => {
      const restLength = 1.0;
      const particles = [
        createParticle([0, 0, 0], 1.0),
        createParticle([2, 0, 0], 1.0)  // 2 units apart, should be 1
      ];
      const constraint = createDistanceConstraint(0, 1, restLength, 0);

      // Solve constraint multiple times
      for (let i = 0; i < 10; i++) {
        solveDistanceConstraint(particles, constraint, 1/60);
      }

      const dist = vec3.length(vec3.sub(particles[1].pos, particles[0].pos));
      expect(dist).toBeCloseTo(restLength, 2);
    });

    it('should not move anchored particle in constraint', () => {
      const particles = [
        createParticle([0, 0, 0], 0),   // anchored
        createParticle([2, 0, 0], 1.0)  // free
      ];
      const constraint = createDistanceConstraint(0, 1, 1.0, 0);

      solveDistanceConstraint(particles, constraint, 1/60);

      expect(particles[0].pos).toEqual([0, 0, 0]); // didn't move
      expect(particles[1].pos[0]).toBeLessThan(2); // moved toward anchor
    });

    it('should do nothing if both particles anchored', () => {
      const particles = [
        createParticle([0, 0, 0], 0),
        createParticle([5, 0, 0], 0)
      ];
      const constraint = createDistanceConstraint(0, 1, 1.0, 0);

      solveDistanceConstraint(particles, constraint, 1/60);

      expect(particles[0].pos).toEqual([0, 0, 0]);
      expect(particles[1].pos).toEqual([5, 0, 0]);
    });

    it('should handle compliance (soft constraints)', () => {
      const restLength = 1.0;
      const particles = [
        createParticle([0, 0, 0], 1.0),
        createParticle([3, 0, 0], 1.0)  // 3 units apart
      ];

      // Stiff constraint
      const stiff = createDistanceConstraint(0, 1, restLength, 0);
      const particlesStiff = [
        createParticle([0, 0, 0], 1.0),
        createParticle([3, 0, 0], 1.0)
      ];
      solveDistanceConstraint(particlesStiff, stiff, 1/60);

      // Soft constraint
      const soft = createDistanceConstraint(0, 1, restLength, 0.1);
      const particlesSoft = [
        createParticle([0, 0, 0], 1.0),
        createParticle([3, 0, 0], 1.0)
      ];
      solveDistanceConstraint(particlesSoft, soft, 1/60);

      // Stiff should move more than soft in one iteration
      const stiffDist = vec3.length(vec3.sub(particlesStiff[1].pos, particlesStiff[0].pos));
      const softDist = vec3.length(vec3.sub(particlesSoft[1].pos, particlesSoft[0].pos));

      expect(stiffDist).toBeLessThan(softDist);
    });
  });

  describe('Position Constraints', () => {
    it('should create position constraint', () => {
      const c = createPositionConstraint(0, [5, 5, 5], 0.01);
      expect(c.type).toBe('position');
      expect(c.particles).toEqual([0]);
      expect(c.targetPos).toEqual([5, 5, 5]);
    });

    it('should pull particle toward target', () => {
      const particles = [createParticle([0, 0, 0], 1.0)];
      const constraint = createPositionConstraint(0, [10, 0, 0], 0);

      solvePositionConstraint(particles, constraint, 1/60);

      expect(particles[0].pos[0]).toBeGreaterThan(0);
    });

    it('should not move anchored particle', () => {
      const particles = [createParticle([0, 0, 0], 0)]; // anchored
      const constraint = createPositionConstraint(0, [10, 0, 0], 0);

      solvePositionConstraint(particles, constraint, 1/60);

      expect(particles[0].pos).toEqual([0, 0, 0]);
    });
  });

  describe('Chain Creation', () => {
    it('should create chain with correct number of particles', () => {
      const { particles, constraints } = createChain(
        [0, 0, 0], [0, -1, 0], 0.5, 5, 1.0
      );

      expect(particles).toHaveLength(5);
      expect(constraints).toHaveLength(4); // n-1 constraints
    });

    it('should anchor first particle', () => {
      const { particles } = createChain([0, 0, 0], [0, -1, 0], 0.5, 3);

      expect(particles[0].invMass).toBe(0); // anchored
      expect(particles[1].invMass).toBeGreaterThan(0); // free
      expect(particles[2].invMass).toBeGreaterThan(0); // free
    });

    it('should space particles correctly', () => {
      const { particles } = createChain([0, 0, 0], [1, 0, 0], 2.0, 3);

      expect(particles[0].pos).toEqual([0, 0, 0]);
      expect(particles[1].pos).toEqual([2, 0, 0]);
      expect(particles[2].pos).toEqual([4, 0, 0]);
    });

    it('should create constraints with correct rest length', () => {
      const { constraints } = createChain([0, 0, 0], [0, -1, 0], 1.5, 4);

      for (const c of constraints) {
        expect(c.restValue).toBe(1.5);
      }
    });
  });

  describe('Simulation Step', () => {
    it('should integrate and solve in one step', () => {
      const { particles, constraints } = createChain(
        [0, 0, 0], [0, -1, 0], 1.0, 3
      );

      const initialY = particles[2].pos[1];

      simulationStep(particles, constraints, 1/60, {
        iterations: 5,
        gravity: [0, -9.81, 0]
      });

      // Chain tip should have moved down
      expect(particles[2].pos[1]).toBeLessThan(initialY);

      // But constraint should keep it attached
      const dist = vec3.length(vec3.sub(particles[2].pos, particles[1].pos));
      expect(dist).toBeCloseTo(1.0, 1);
    });

    it('should converge with more iterations', () => {
      const particles = [
        createParticle([0, 0, 0], 0),   // anchored
        createParticle([5, 0, 0], 1.0)  // should snap to 1.0 distance
      ];
      const constraints = [createDistanceConstraint(0, 1, 1.0, 0)];

      // Few iterations
      const p1 = [
        createParticle([0, 0, 0], 0),
        createParticle([5, 0, 0], 1.0)
      ];
      simulationStep(p1, constraints, 1/60, { iterations: 1, gravity: [0, 0, 0] });
      const dist1 = vec3.length(vec3.sub(p1[1].pos, p1[0].pos));

      // More iterations
      const p2 = [
        createParticle([0, 0, 0], 0),
        createParticle([5, 0, 0], 1.0)
      ];
      simulationStep(p2, constraints, 1/60, { iterations: 10, gravity: [0, 0, 0] });
      const dist2 = vec3.length(vec3.sub(p2[1].pos, p2[0].pos));

      // More iterations should be closer to (or equal to) rest length
      // With stiff constraints, even 1 iteration may converge perfectly
      expect(Math.abs(dist2 - 1.0)).toBeLessThanOrEqual(Math.abs(dist1 - 1.0));
    });

    it('should update velocity after step', () => {
      const particles = [createParticle([0, 5, 0], 1.0)];

      simulationStep(particles, [], 1/60, {
        iterations: 1,
        gravity: [0, -9.81, 0]
      });

      // Velocity should be non-zero after falling
      expect(particles[0].velocity[1]).toBeLessThan(0);
    });
  });

  describe('Stability', () => {
    it('should remain stable over many steps', () => {
      const { particles, constraints } = createChain(
        [0, 0, 0], [0, -1, 0], 1.0, 10
      );

      // Run 1000 steps
      for (let i = 0; i < 1000; i++) {
        simulationStep(particles, constraints, 1/60, {
          iterations: 5,
          gravity: [0, -9.81, 0]
        });
      }

      // Check all positions are finite
      for (const p of particles) {
        expect(Number.isFinite(p.pos[0])).toBe(true);
        expect(Number.isFinite(p.pos[1])).toBe(true);
        expect(Number.isFinite(p.pos[2])).toBe(true);
      }

      // Check constraints are roughly satisfied
      for (const c of constraints) {
        const [iA, iB] = c.particles;
        const dist = vec3.length(vec3.sub(particles[iB].pos, particles[iA].pos));
        expect(dist).toBeCloseTo(c.restValue, 0);
      }
    });
  });
});
