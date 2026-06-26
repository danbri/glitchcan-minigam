// webxr.js — EXPERIMENTAL, capability-gated WebXR for the map.
//
// WebXR is absent from iOS Safari and can't be exercised headless, so this is
// deliberately conservative: the suite only SHOWS an XR button when the device
// actually reports support (xrSupport), and entering a session is best-effort and
// defensive. It enters an immersive session and renders a minimal confirmed
// scene; a full map-in-XR (re-rendering terrain/buildings into the XR layer) is a
// large follow-up. Everything here is guarded so it can never break the 2D map.

// Returns 'immersive-ar' | 'immersive-vr' | null (preferring AR).
export async function xrSupport() {
  const xr = (typeof navigator !== 'undefined') && navigator.xr;
  if (!xr || !xr.isSessionSupported) return null;
  for (const mode of ['immersive-ar', 'immersive-vr']) {
    try { if (await xr.isSessionSupported(mode)) return mode; } catch (_) { /* keep trying */ }
  }
  return null;
}

// Enter an immersive session. Resolves with the XRSession (already running its
// frame loop) or rejects with a reason. Minimal scene: clear the view so the user
// can confirm they're in XR.
export async function enterXr(mode) {
  if (!navigator.xr) throw new Error('WebXR unavailable');
  const session = await navigator.xr.requestSession(mode,
    mode === 'immersive-ar' ? { optionalFeatures: ['dom-overlay', 'local-floor'] } : { optionalFeatures: ['local-floor'] });

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { xrCompatible: true }) || canvas.getContext('experimental-webgl', { xrCompatible: true });
  if (!gl) { try { await session.end(); } catch (_) {} throw new Error('No WebGL for XR'); }
  if (gl.makeXRCompatible) { try { await gl.makeXRCompatible(); } catch (_) {} }
  session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

  let refSpace = null;
  for (const t of ['local-floor', 'local', 'viewer']) {
    try { refSpace = await session.requestReferenceSpace(t); break; } catch (_) { /* next */ }
  }

  const onFrame = (time, frame) => {
    const s = frame.session;
    s.requestAnimationFrame(onFrame);
    const layer = s.renderState.baseLayer;
    if (!layer) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    const pose = refSpace && frame.getViewerPose(refSpace);
    const views = (pose && pose.views) || [{}];
    for (const view of views) {
      const vp = view.transform ? layer.getViewport(view) : { x: 0, y: 0, width: layer.framebufferWidth, height: layer.framebufferHeight };
      gl.viewport(vp.x, vp.y, vp.width, vp.height);
      gl.clearColor(0.04, 0.06, 0.10, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
  };
  session.requestAnimationFrame(onFrame);
  return session;
}
