/**
 * Tests for Splat Object Physics System
 * LCD-047: Physics for Gaussian Splat Objects
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  quat,
  RigidBody,
  SoftBodyCage,
  SplatObject,
  SplatPhysicsWorld
} from '../lucid/core/physics/splat-physics.js';
import { vec3 } from '../lucid/core/physics/xpbd.js';

describe('Splat Physics', () => {
  describe('Quaternion Utilities', () => {
    it('should create identity quaternion', () => {
      const q = quat.identity();
      expect(q).toEqual([0, 0, 0, 1]);
    });

    it('should create quaternion from axis-angle', () => {
      const q = quat.fromAxisAngle([0, 1, 0], Math.PI / 2);
      expect(q[3]).toBeCloseTo(Math.cos(Math.PI / 4), 5);
      expect(q[1]).toBeCloseTo(Math.sin(Math.PI / 4), 5);
    });

    it('should rotate vector by quaternion', () => {
      // 90 degree rotation around Y axis
      const q = quat.fromAxisAngle([0, 1, 0], Math.PI / 2);
      const v = [1, 0, 0];
      const rotated = quat.rotateVector(q, v);

      expect(rotated[0]).toBeCloseTo(0, 5);
      expect(rotated[1]).toBeCloseTo(0, 5);
      expect(rotated[2]).toBeCloseTo(-1, 5);
    });

    it('should multiply quaternions', () => {
      const q1 = quat.fromAxisAngle([0, 1, 0], Math.PI / 4);
      const q2 = quat.fromAxisAngle([0, 1, 0], Math.PI / 4);
      const combined = quat.multiply(q1, q2);

      // Should equal 90 degree rotation
      const expected = quat.fromAxisAngle([0, 1, 0], Math.PI / 2);
      expect(combined[0]).toBeCloseTo(expected[0], 5);
      expect(combined[1]).toBeCloseTo(expected[1], 5);
      expect(combined[2]).toBeCloseTo(expected[2], 5);
      expect(combined[3]).toBeCloseTo(expected[3], 5);
    });

    it('should normalize quaternion', () => {
      const q = [1, 2, 3, 4];
      const normalized = quat.normalize(q);
      const len = Math.sqrt(
        normalized[0] ** 2 + normalized[1] ** 2 +
        normalized[2] ** 2 + normalized[3] ** 2
      );
      expect(len).toBeCloseTo(1, 5);
    });

    it('should slerp between quaternions', () => {
      const q1 = quat.identity();
      const q2 = quat.fromAxisAngle([0, 1, 0], Math.PI);

      const half = quat.slerp(q1, q2, 0.5);
      // Should be 90 degree rotation
      const expected = quat.fromAxisAngle([0, 1, 0], Math.PI / 2);
      expect(half[1]).toBeCloseTo(expected[1], 4);
      expect(half[3]).toBeCloseTo(expected[3], 4);
    });
  });

  describe('RigidBody', () => {
    it('should create rigid body with defaults', () => {
      const body = new RigidBody();
      expect(body.position).toEqual([0, 0, 0]);
      expect(body.velocity).toEqual([0, 0, 0]);
      expect(body.mass).toBe(1.0);
    });

    it('should create rigid body with options', () => {
      const body = new RigidBody({
        position: [1, 2, 3],
        mass: 5.0,
        restitution: 0.8
      });
      expect(body.position).toEqual([1, 2, 3]);
      expect(body.mass).toBe(5.0);
      expect(body.invMass).toBeCloseTo(0.2, 5);
      expect(body.restitution).toBe(0.8);
    });

    it('should transform local point to world space', () => {
      const body = new RigidBody({
        position: [10, 0, 0],
        scale: [2, 2, 2]
      });

      const world = body.transformPoint([1, 0, 0]);
      expect(world[0]).toBeCloseTo(12, 5); // 10 + 1*2
      expect(world[1]).toBeCloseTo(0, 5);
      expect(world[2]).toBeCloseTo(0, 5);
    });

    it('should transform with rotation', () => {
      const body = new RigidBody({
        position: [0, 0, 0],
        rotation: quat.fromAxisAngle([0, 1, 0], Math.PI / 2)
      });

      const world = body.transformPoint([1, 0, 0]);
      expect(world[0]).toBeCloseTo(0, 5);
      expect(world[2]).toBeCloseTo(-1, 5);
    });

    it('should integrate motion under gravity', () => {
      const body = new RigidBody({ position: [0, 10, 0] });
      body.integrate(1 / 60, [0, -9.81, 0]);

      expect(body.position[1]).toBeLessThan(10);
      expect(body.velocity[1]).toBeLessThan(0);
    });

    it('should apply impulse', () => {
      const body = new RigidBody({ mass: 2.0 });
      body.applyImpulse([10, 0, 0]);

      expect(body.velocity[0]).toBe(5); // 10 * (1/2)
    });

    it('should not move static body', () => {
      const body = new RigidBody({ mass: 0 }); // Static
      body.integrate(1, [0, -9.81, 0]);

      expect(body.position).toEqual([0, 0, 0]);
    });

    it('should return 4x4 transform matrix', () => {
      const body = new RigidBody({ position: [1, 2, 3] });
      const matrix = body.getMatrix();

      expect(matrix).toBeInstanceOf(Float32Array);
      expect(matrix.length).toBe(16);
      // Translation in last column
      expect(matrix[12]).toBe(1);
      expect(matrix[13]).toBe(2);
      expect(matrix[14]).toBe(3);
    });
  });

  describe('SoftBodyCage', () => {
    it('should create box cage with 8 particles', () => {
      const cage = new SoftBodyCage({
        bounds: { min: [-1, -1, -1], max: [1, 1, 1] }
      });

      expect(cage.particles.length).toBe(8);
      expect(cage.restPositions.length).toBe(8);
    });

    it('should create edge constraints', () => {
      const cage = new SoftBodyCage();
      // 12 edges + 4 cross braces = 16 constraints
      expect(cage.constraints.length).toBe(16);
    });

    it('should interpolate center point correctly', () => {
      const bounds = { min: [0, 0, 0], max: [2, 2, 2] };
      const cage = new SoftBodyCage({ bounds });

      // Center of undeformed box
      const center = cage.getDeformedPosition([1, 1, 1], bounds);
      expect(center[0]).toBeCloseTo(1, 3);
      expect(center[1]).toBeCloseTo(1, 3);
      expect(center[2]).toBeCloseTo(1, 3);
    });

    it('should interpolate corner points correctly', () => {
      const bounds = { min: [0, 0, 0], max: [2, 2, 2] };
      const cage = new SoftBodyCage({ bounds });

      // Corner should match cage particle
      const corner = cage.getDeformedPosition([0, 0, 0], bounds);
      expect(corner[0]).toBeCloseTo(0, 3);
      expect(corner[1]).toBeCloseTo(0, 3);
      expect(corner[2]).toBeCloseTo(0, 3);
    });

    it('should step simulation', () => {
      const cage = new SoftBodyCage();
      const initialY = cage.particles[6].pos[1]; // Top corner

      cage.step(1 / 60, { gravity: [0, -9.81, 0], iterations: 5 });

      // Top corners should have moved down (gravity)
      expect(cage.particles[6].pos[1]).toBeLessThan(initialY);
    });

    it('should anchor particles', () => {
      const cage = new SoftBodyCage();
      cage.anchorParticle(0);

      expect(cage.particles[0].invMass).toBe(0);
    });
  });

  describe('SplatObject', () => {
    it('should create rigid splat object', () => {
      const obj = new SplatObject({
        id: 'test_rigid',
        mode: 'rigid',
        position: [1, 2, 3]
      });

      expect(obj.id).toBe('test_rigid');
      expect(obj.mode).toBe('rigid');
      expect(obj.body).toBeInstanceOf(RigidBody);
      expect(obj.body.position).toEqual([1, 2, 3]);
    });

    it('should create soft splat object', () => {
      const obj = new SplatObject({
        id: 'test_soft',
        mode: 'soft'
      });

      expect(obj.mode).toBe('soft');
      expect(obj.cage).toBeInstanceOf(SoftBodyCage);
      expect(obj.body).toBeNull();
    });

    it('should create static splat object', () => {
      const obj = new SplatObject({
        mode: 'static',
        position: [5, 0, 0]
      });

      expect(obj.mode).toBe('static');
      expect(obj.staticTransform.position).toEqual([5, 0, 0]);
    });

    it('should compute world positions for rigid body', () => {
      const obj = new SplatObject({
        mode: 'rigid',
        position: [10, 0, 0],
        splatCount: 2,
        localPositions: new Float32Array([
          0, 0, 0,  // Splat 0 at origin
          1, 0, 0   // Splat 1 at (1, 0, 0)
        ])
      });

      const worldPos = obj.getWorldPositions();

      expect(worldPos[0]).toBeCloseTo(10, 5); // 10 + 0
      expect(worldPos[3]).toBeCloseTo(11, 5); // 10 + 1
    });

    it('should return transform matrix for rigid body', () => {
      const obj = new SplatObject({
        mode: 'rigid',
        position: [1, 2, 3]
      });

      const matrix = obj.getTransformMatrix();
      expect(matrix).toBeInstanceOf(Float32Array);
      expect(matrix[12]).toBe(1); // Translation
    });

    it('should return null matrix for soft body', () => {
      const obj = new SplatObject({ mode: 'soft' });
      expect(obj.getTransformMatrix()).toBeNull();
    });

    it('should step physics', () => {
      const obj = new SplatObject({
        mode: 'rigid',
        position: [0, 10, 0],
        mass: 1.0
      });

      obj.step(1 / 60, { gravity: [0, -9.81, 0] });

      expect(obj.body.position[1]).toBeLessThan(10);
    });
  });

  describe('SplatPhysicsWorld', () => {
    let world;

    beforeEach(() => {
      world = new SplatPhysicsWorld();
    });

    it('should create world with defaults', () => {
      expect(world.gravity).toEqual([0, -9.81, 0]);
      expect(world.groundPlane).toBe(true);
      expect(world.groundY).toBe(0);
    });

    it('should add and retrieve objects', () => {
      const obj = new SplatObject({ id: 'test' });
      world.addObject(obj);

      expect(world.getObject('test')).toBe(obj);
    });

    it('should remove objects', () => {
      const obj = new SplatObject({ id: 'test' });
      world.addObject(obj);
      world.removeObject('test');

      expect(world.getObject('test')).toBeUndefined();
    });

    it('should step all objects', () => {
      const obj = new SplatObject({
        id: 'falling',
        mode: 'rigid',
        position: [0, 10, 0]
      });
      world.addObject(obj);

      world.step(1 / 60);

      expect(obj.body.position[1]).toBeLessThan(10);
    });

    it('should resolve ground collisions', () => {
      const obj = new SplatObject({
        id: 'bouncing',
        mode: 'rigid',
        position: [0, 0.3, 0],
        mass: 1.0
      });
      obj.body.velocity = [0, -5, 0];
      world.addObject(obj);

      world.step(1 / 60);

      // Should have bounced - velocity now positive
      expect(obj.body.velocity[1]).toBeGreaterThanOrEqual(0);
    });

    it('should return objects sorted by layer', () => {
      world.addObject(new SplatObject({ id: 'back', layer: 0 }));
      world.addObject(new SplatObject({ id: 'front', layer: 2 }));
      world.addObject(new SplatObject({ id: 'mid', layer: 1 }));

      const sorted = world.getObjectsByLayer();

      expect(sorted[0].id).toBe('back');
      expect(sorted[1].id).toBe('mid');
      expect(sorted[2].id).toBe('front');
    });

    it('should create splat object from cloud', () => {
      const mockCloud = {
        count: 3,
        gaussians: [
          { position: [0, 0, 0], scale: [1, 1, 1], rotation: [0, 0, 0, 1], color: [1, 0, 0], opacity: 1 },
          { position: [1, 0, 0], scale: [1, 1, 1], rotation: [0, 0, 0, 1], color: [0, 1, 0], opacity: 1 },
          { position: [0, 1, 0], scale: [1, 1, 1], rotation: [0, 0, 0, 1], color: [0, 0, 1], opacity: 1 }
        ]
      };

      const obj = world.createFromCloud(mockCloud, {
        id: 'from_cloud',
        mode: 'rigid'
      });

      expect(obj.splatCount).toBe(3);
      expect(obj.localPositions.length).toBe(9);
      expect(obj.bounds.min[0]).toBe(0);
      expect(obj.bounds.max[0]).toBe(1);
    });
  });

  describe('Integration: Falling Football Scenario', () => {
    it('should simulate football falling and bouncing', () => {
      const world = new SplatPhysicsWorld({ groundY: 0 });

      // Create football as soft body at height
      const football = new SplatObject({
        id: 'football',
        mode: 'rigid',
        position: [0, 5, 0],
        mass: 0.43, // ~430g football
        splatCount: 100,
        localPositions: new Float32Array(300) // 100 splats
      });

      // Initialize some random splat positions within a sphere
      for (let i = 0; i < 100; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 0.11; // ~11cm radius football
        football.localPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        football.localPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        football.localPositions[i * 3 + 2] = r * Math.cos(phi);
      }

      world.addObject(football);

      // Simulate 2 seconds
      for (let i = 0; i < 120; i++) {
        world.step(1 / 60);
      }

      // Football should have bounced and settled near ground
      expect(football.body.position[1]).toBeGreaterThan(0);
      expect(football.body.position[1]).toBeLessThan(5);

      // World positions should be offset
      const worldPos = football.getWorldPositions();
      expect(worldPos).not.toBeNull();
      expect(worldPos.length).toBe(300);
    });
  });
});
