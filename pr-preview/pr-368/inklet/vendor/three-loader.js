/**
 * THREE.js Loader with CDN + Offline Fallback
 *
 * Tries to load from CDN first, falls back to local cache if offline.
 * Usage: import * as THREE from './vendor/three-loader.js';
 */

const THREE_VERSION = '0.169.0';
const CDN_URL = `https://unpkg.com/three@${THREE_VERSION}/build/three.module.min.js`;
const LOCAL_FALLBACK = './vendor/cdn-cache/three.module.min.js';

let threeModule = null;
let loadPromise = null;

/**
 * Load THREE.js with CDN primary, local fallback
 */
async function loadThree() {
  if (threeModule) return threeModule;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // Try CDN first
    try {
      console.log(`[THREE Loader] Trying CDN: ${CDN_URL}`);
      threeModule = await import(CDN_URL);
      console.log(`[THREE Loader] Loaded from CDN (v${THREE_VERSION})`);
      return threeModule;
    } catch (cdnError) {
      console.warn('[THREE Loader] CDN failed, trying local fallback...', cdnError.message);
    }

    // Fallback to local cache
    try {
      threeModule = await import(LOCAL_FALLBACK);
      console.log('[THREE Loader] Loaded from local cache');
      return threeModule;
    } catch (localError) {
      console.error('[THREE Loader] Both CDN and local cache failed!');
      throw new Error(`Failed to load THREE.js: CDN and local fallback both failed. ${localError.message}`);
    }
  })();

  return loadPromise;
}

// For synchronous import compatibility, we re-export a promise-based API
// Consumers should use: const THREE = await import('./vendor/three-loader.js').then(m => m.load());
export const load = loadThree;
export const version = THREE_VERSION;

// Also provide direct access for dynamic import scenarios
export default { load, version };
