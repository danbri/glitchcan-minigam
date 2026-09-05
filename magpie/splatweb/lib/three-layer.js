// three-layer.js — a three.js scene as one compositor layer (see
// lib/layer-compositor.js). Kept separate from layers.js so nothing else
// in this project pulls in three.js just by importing that file.
//
// Uses the repo's shared vendored copy (third_party/three/, MIT licensed)
// instead of a CDN fetch — same "no CDN dependency" rule this project
// already follows elsewhere (see CLAUDE.md's trees/vendor/three note).
import * as THREE from '../../../third_party/three/three.module.min.js';

// setup({THREE, scene, camera, renderer}) runs once — build the scene.
// update(time, {THREE, scene, camera, renderer}) runs every frame, before
// render() — animate it.
export function createThreeLayer({ width, height, setup, update }) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  // alpha: true + a transparent clear (below) so this layer composites
  // over whatever's behind it, same as the splat/SDF layers.
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(width, height, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 100);
  camera.position.set(0, 1, 3);
  const ctx = { THREE, scene, camera, renderer };
  if (setup) setup(ctx);
  return {
    canvas, scene, camera, renderer,
    render(time) {
      if (update) update(time, ctx);
      renderer.render(scene, camera);
      return canvas;
    },
  };
}
