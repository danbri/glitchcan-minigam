/**
 * Tests for SDF Physics Scene Integration
 * Test-first implementation for LCD-048: Physics-enabled SDF scenes
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Will be implemented in lucid/core/physics/physics-scene.js
import {
  PhysicsScene,
  createPhysicsBodyFromNode,
  extractPhysicsNodes
} from '../lucid/core/physics/physics-scene.js';

describe('SDF Physics Scene Integration', () => {

  describe('extractPhysicsNodes', () => {
    it('should find nodes with physics property', () => {
      const scene = {
        root: {
          type: 'union',
          children: [
            {
              type: 'sphere',
              id: 'ball1',
              params: { r: 0.3 },
              physics: { type: 'dynamic', mass: 1.0 }
            },
            {
              type: 'box',
              id: 'ground',
              params: { size: [10, 0.5, 10] },
              physics: { type: 'static' }
            },
            {
              type: 'sphere',
              params: { r: 0.2 }
              // No physics - should be skipped
            }
          ]
        }
      };

      const nodes = extractPhysicsNodes(scene.root);

      expect(nodes).toHaveLength(2);
      expect(nodes[0].id).toBe('ball1');
      expect(nodes[1].id).toBe('ground');
    });

    it('should handle nested structures', () => {
      const scene = {
        root: {
          type: 'group',
          children: [
            {
              type: 'transform',
              child: {
                type: 'sphere',
                id: 'nested-ball',
                physics: { type: 'dynamic' }
              }
            }
          ]
        }
      };

      const nodes = extractPhysicsNodes(scene.root);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('nested-ball');
    });

    it('should return empty array for scene with no physics', () => {
      const scene = {
        root: {
          type: 'sphere',
          params: { r: 1 }
        }
      };

      const nodes = extractPhysicsNodes(scene.root);

      expect(nodes).toHaveLength(0);
    });
  });

  describe('createPhysicsBodyFromNode', () => {
    it('should create dynamic body with correct properties', () => {
      const node = {
        type: 'sphere',
        id: 'ball',
        params: { r: { type: 'const', value: 0.5 } },
        physics: { type: 'dynamic', mass: 2.0, restitution: 0.8 },
        transform: { translate: { type: 'array', values: [
          { type: 'const', value: 0 },
          { type: 'const', value: 3 },
          { type: 'const', value: 0 }
        ]}}
      };

      const body = createPhysicsBodyFromNode(node);

      expect(body.id).toBe('ball');
      expect(body.mass).toBe(2.0);
      expect(body.restitution).toBe(0.8);
      expect(body.position).toEqual([0, 3, 0]);
      expect(body.isStatic).toBe(false);
    });

    it('should create static body for ground/walls', () => {
      const node = {
        type: 'box',
        id: 'ground',
        physics: { type: 'static' },
        transform: { translate: { type: 'array', values: [
          { type: 'const', value: 0 },
          { type: 'const', value: -1 },
          { type: 'const', value: 0 }
        ]}}
      };

      const body = createPhysicsBodyFromNode(node);

      expect(body.isStatic).toBe(true);
      expect(body.mass).toBe(0);
    });

    it('should use default values when not specified', () => {
      const node = {
        type: 'sphere',
        id: 'simple',
        physics: { type: 'dynamic' }
      };

      const body = createPhysicsBodyFromNode(node);

      expect(body.mass).toBe(1.0);
      expect(body.restitution).toBe(0.7);
      expect(body.position).toEqual([0, 0, 0]);
    });
  });

  describe('PhysicsScene', () => {
    let physicsScene;

    beforeEach(() => {
      const sceneJson = {
        title: 'Physics Test',
        physics: {
          enabled: true,
          gravity: [0, -9.8, 0],
          groundY: -2
        },
        root: {
          type: 'union',
          children: [
            {
              type: 'sphere',
              id: 'ball1',
              params: { r: 0.3 },
              physics: { type: 'dynamic', mass: 1.0 },
              transform: { translate: [0, 2, 0] }
            },
            {
              type: 'sphere',
              id: 'ball2',
              params: { r: 0.3 },
              physics: { type: 'dynamic', mass: 1.0 },
              transform: { translate: [0.5, 3, 0] }
            }
          ]
        }
      };

      physicsScene = new PhysicsScene(sceneJson);
    });

    it('should initialize with correct body count', () => {
      expect(physicsScene.bodies.length).toBe(2);
    });

    it('should have correct gravity', () => {
      expect(physicsScene.gravity).toEqual([0, -9.8, 0]);
    });

    it('should step simulation and update positions', () => {
      const initialY = physicsScene.bodies[0].position[1];

      // Step physics for a few frames
      for (let i = 0; i < 10; i++) {
        physicsScene.step(1/60);
      }

      const newY = physicsScene.bodies[0].position[1];

      // Ball should have fallen due to gravity
      expect(newY).toBeLessThan(initialY);
    });

    it('should detect ground collision', () => {
      // Step until ball hits ground
      for (let i = 0; i < 300; i++) {
        physicsScene.step(1/60);
      }

      const ballY = physicsScene.bodies[0].position[1];
      const groundY = physicsScene.groundY;

      // Ball should be at or above ground (with radius)
      expect(ballY).toBeGreaterThanOrEqual(groundY + 0.3 - 0.01);
    });

    it('should return transform updates for renderer', () => {
      physicsScene.step(1/60);

      const updates = physicsScene.getTransformUpdates();

      expect(updates).toHaveProperty('ball1');
      expect(updates).toHaveProperty('ball2');
      expect(updates.ball1.translate).toHaveLength(3);
    });

    it('should handle body-body collisions', () => {
      // Position balls to collide
      physicsScene.bodies[0].position = [0, 1, 0];
      physicsScene.bodies[1].position = [0.3, 1, 0]; // Overlapping

      physicsScene.step(1/60);

      // Bodies should have separated
      const dx = physicsScene.bodies[1].position[0] - physicsScene.bodies[0].position[0];
      expect(dx).toBeGreaterThan(0.3); // At least sum of radii apart
    });
  });

  describe('Scene format validation', () => {
    it('should handle scene without physics config gracefully', () => {
      const scene = {
        root: { type: 'sphere', params: { r: 1 } }
      };

      const physicsScene = new PhysicsScene(scene);

      expect(physicsScene.enabled).toBe(false);
      expect(physicsScene.bodies.length).toBe(0);
    });

    it('should accept shorthand transform arrays', () => {
      const node = {
        type: 'sphere',
        id: 'ball',
        physics: { type: 'dynamic' },
        transform: { translate: [1, 2, 3] } // Shorthand, not processed
      };

      const body = createPhysicsBodyFromNode(node);

      expect(body.position).toEqual([1, 2, 3]);
    });
  });
});
