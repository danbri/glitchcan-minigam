/**
 * Configuration for the Lucid human visual-verification harness.
 *
 * WHY THIS EXISTS
 * Headless Chromium (the CI / agent environment) cannot render WebGPU at all and
 * renders WebGL at ~2 FPS via SwiftShader, so an agent can never actually SEE
 * what Stinkyfish (WebGPU) produces on real hardware. This harness closes that
 * gap: a human opens the page on a real GPU device, the page interviews them
 * about what they see across both backends, and packages the answers +
 * screenshots into a GitHub issue the agent can read back.
 *
 * The `scenes` list is deliberately biased toward the known GLSL↔WGSL divergences
 * documented in skills/lucid-renderer-interop/references/codegen-parity.md, so a
 * single pass exercises the exact things headless cannot verify. Edit freely —
 * add scenes, reword questions; the harness is fully data-driven.
 */

export const VERIFY_CONFIG = {
  // GitHub target for the pre-filled issue. Owner/repo only — no tokens (this is
  // a public page and must never hold secrets).
  repo: 'danbri/glitchcan-minigam',
  issueLabel: 'visual-verification',
  issueTitlePrefix: 'Visual verification',

  // Report format version, so the agent-side parser can evolve.
  reportVersion: 1,

  // Scenes to walk through, each rendered in BOTH backends side by side.
  // `focus` names the interop concern the scene stresses (shown to the human);
  // `paths` are relative to lucid/scenes/.
  scenes: [
    {
      id: 'walk-rig',
      path: 'animation/walk-rig.json',
      title: 'Walk cycle (rig)',
      focus: 'WebGPU rig animation test — hit Animate. The Stinkyfish legs should now move in step with Mayfly (rig eval was recently wired into the WebGPU path). If the WebGPU side is frozen while Mayfly walks, the rig gap is not fully closed.',
    },
    {
      id: 'sphere',
      path: 'primitives/sphere.json',
      title: 'Single sphere',
      focus: 'Baseline — lighting, shading, and colour parity on the simplest shape.',
    },
    {
      id: 'table',
      path: 'patterns/table.json',
      title: 'CSG table',
      focus: 'Boolean CSG (union/subtract) and transforms.',
    },
    {
      id: 'mirror',
      path: 'patterns/mirror.json',
      title: 'Mirror symmetry',
      focus: 'WGSL mirror lacks the ancestor-rotation fix and may drop the node transform — watch for a mirrored half that is offset, rotated wrong, or missing.',
    },
    {
      id: 'radial',
      path: 'patterns/radial-flower.json',
      title: 'Radial symmetry',
      focus: 'Radial domain fold. WGSL drops the modifier transform — watch for petals that are misplaced or a different count/rotation than WebGL.',
    },
    {
      id: 'infinite-field',
      path: 'patterns/infinite-field.json',
      title: 'Infinite repeat',
      focus: 'Repeat/tiling domain fold (mod-based in GLSL, fract-based in WGSL, both marked unverified). Watch for seams, doubled/missing tiles, or misalignment between backends.',
    },
    {
      id: 'snowman',
      path: 'creatures/snowman.json',
      title: 'Snowman (creature)',
      focus: 'A composed creature — overall shape, proportions, and material parity.',
    },
  ],

  // Questions asked for every scene. `type` drives the input widget.
  // - 'match'   : the headline verdict (single choice)
  // - 'checks'  : multi-select of specific discrepancies
  // - 'text'    : free observation
  perSceneQuestions: [
    {
      id: 'match',
      type: 'match',
      label: 'Do the WebGL (Mayfly) and WebGPU (Stinkyfish) renders match?',
      reportLabel: 'Match',
      options: [
        { value: 'match', label: 'Match — visually equivalent' },
        { value: 'minor', label: 'Minor differences (shading/tone)' },
        { value: 'major', label: 'Major differences (geometry/colour)' },
        { value: 'webgpu-blank', label: 'WebGPU is blank / errored' },
        { value: 'webgl-blank', label: 'WebGL is blank / errored' },
        { value: 'na', label: 'WebGPU unavailable on this device' },
      ],
    },
    {
      // Aspect ratio / shape distortion — a round shape must read as round. A
      // squashed/stretched sphere (ellipse) means the canvas backing-store
      // aspect doesn't match its displayed box. Ask per-backend because the
      // two size their canvases differently.
      id: 'aspect',
      type: 'aspect',
      label: 'Aspect ratio — is a round shape actually round (not a stretched ellipse)?',
      reportLabel: 'Aspect ratio',
      options: [
        { value: 'both-correct', label: 'Correct in both' },
        { value: 'webgl-stretched', label: 'WebGL (Mayfly) is stretched / squashed' },
        { value: 'webgpu-stretched', label: 'WebGPU (Stinkyfish) is stretched / squashed' },
        { value: 'both-stretched', label: 'Both are stretched / squashed' },
        { value: 'changes-on-scroll', label: 'Distortion appears or changes when I scroll / rotate the device' },
      ],
    },
    {
      id: 'discrepancies',
      type: 'checks',
      label: 'If they differ, what differs? (tick all that apply)',
      reportLabel: 'Differs',
      options: [
        { value: 'geometry', label: 'Shape / geometry' },
        { value: 'aspect', label: 'Aspect ratio / stretch' },
        { value: 'position', label: 'Position / symmetry / count' },
        { value: 'colour', label: 'Colour / material' },
        { value: 'lighting', label: 'Lighting / shading / tone' },
        { value: 'ground', label: 'Ground plane' },
        { value: 'artifacts', label: 'Noise / artefacts / banding' },
        { value: 'missing', label: 'Missing parts' },
      ],
    },
    {
      id: 'notes',
      type: 'text',
      label: 'Anything else you notice (optional)',
      reportLabel: 'Notes',
      placeholder: 'e.g. "WebGPU petals rotated ~15° vs WebGL"',
    },
  ],
};
