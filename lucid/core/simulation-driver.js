/**
 * SimulationDriver — backend-neutral per-frame simulation for Lucid.
 *
 * The two renderers (Mayfly/WebGL, Stinkyfish/WebGPU) differ only in shader
 * language. Everything upstream of the shader — evaluating the rig (derived /
 * phase animation) and stepping physics — is identical, so it lives here once
 * and pushes results into whichever renderer through the shared param contract:
 *
 *   - rig params (base + derived + phase) -> sink.setParam(name, value)  -> u_<name>
 *   - physics body positions              -> sink.setParam('phys_'+name) -> u_phys_<name>
 *
 * A "sink" is anything with setParam(name, value) — both renderers qualify, as
 * does the <lucid-renderer> component. This keeps one simulation feeding both
 * engines instead of Mayfly evaluating the rig internally while Stinkyfish froze.
 *
 * Physics is optional and lazily initialised (initPhysics) so `core` stays
 * dependency-light for scenes that don't use it.
 */

import { evaluateRig } from './rig-evaluator.js';

export class SimulationDriver {
  /**
   * @param {object} scene  loaded scene (from loadJsonScene) — reads .rig / .params / .physics
   */
  constructor(scene) {
    this._scene = scene || {};
    this.rig = this._scene.rig || null;
    this.baseParams = this._scene.params || {};
    this.physics = null;
    this._physicsEnabled = !!(this._scene.physics && this._scene.physics.enabled);
    this.lastRigValues = null;
  }

  get hasRig() { return !!this.rig; }
  get hasPhysics() { return this._physicsEnabled; }

  /**
   * Lazily create the (renderer-agnostic, CPU) physics stack. Safe no-op when
   * the scene has no physics. `json` is the raw scene JSON PhysicsScene parses.
   */
  async initPhysics(basePath, json) {
    if (!this._physicsEnabled || this.physics) return;
    try {
      const mod = await import(`${basePath}/core/physics/physics-scene.js`);
      const PhysicsScene = mod.PhysicsScene || mod.default;
      this.physics = new PhysicsScene(json || this._scene);
    } catch (e) {
      this.physics = null;  // physics stays disabled rather than breaking the loop
    }
  }

  /**
   * Advance the simulation to `time` (seconds) and push every result into
   * `sink` via setParam. `dt` is the physics timestep (seconds).
   * Returns the rig result (or null) for callers that need lastRigValues.
   */
  step(time, dt, sink) {
    if (!sink || typeof sink.setParam !== 'function') return null;

    let rigResult = null;
    if (this.rig) {
      rigResult = evaluateRig(this.baseParams, this.rig, time);
      this.lastRigValues = rigResult.values;
      // Base params: prefer the rig-evaluated value.
      for (const [name, param] of Object.entries(this.baseParams)) {
        if (typeof param === 'object' && param !== null && rigResult.values[name] !== undefined) {
          sink.setParam(name, rigResult.values[name]);
        }
      }
      // Derived + phase-coupled params.
      for (const [name, value] of Object.entries(rigResult.derived || {})) sink.setParam(name, value);
      for (const [name, value] of Object.entries(rigResult.phaseValues || {})) sink.setParam(name, value);
    }

    if (this.physics) {
      if (rigResult) this.physics.updateFromRig(rigResult.values);
      this.physics.step(dt);
      for (const body of (this.physics.bodies || [])) {
        // Codegen declares physics uniforms as u_phys_<name>; body identity is
        // its name (falling back to id) to match that convention.
        const key = body.name || body.id;
        if (key && body.position) sink.setParam(`phys_${key}`, body.position);
      }
    }

    return rigResult;
  }

  /** Forward an interaction impulse to the physics stack, if any. */
  applyImpulse(bodyKey, impulse) {
    if (this.physics && typeof this.physics.applyImpulse === 'function') {
      this.physics.applyImpulse(bodyKey, impulse);
    }
  }

  dispose() { this.physics = null; }
}
