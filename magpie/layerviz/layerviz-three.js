/**
 * layerviz-three.js — three.js implementation of the layerviz
 * RendererAdapter contract (see layerviz.js). All three.js types stay inside
 * this module; the core never sees them. A port to another backend (Z*)
 * replaces this file only.
 *
 * `three` is a bare specifier: the host page maps it to the repo's vendored
 * module (trees/vendor/three.module.min.js) with an import map. No CDN.
 */
import * as THREE from 'three';

export function createThreeRenderer({ container, model, config }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2a2a3a, 1, 100);

  const perspCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000);
  const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
  let camera = perspCamera; // active camera; setProjection swaps it
  let aspect = 1;
  let orthoHalfHeight = 10;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const projected = new THREE.Vector3();

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));

  const sun = new THREE.DirectionalLight(0xffffff, 0.6);
  sun.position.set(15, 25, 15);
  sun.castShadow = true;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  scene.add(sun);

  const fill = new THREE.PointLight(0xffffff, 0.3);
  fill.position.set(-10, 20, -10);
  scene.add(fill);

  // Scene content built from the model
  const nodeMeshes = [];
  const meshByNode = new Map();
  const linkMeshes = [];
  // Every layer-owned material, for layer spotlighting: {material,
  // baseOpacity, layerId} — links carry a height span instead of an id.
  const focusables = [];
  const layerHeights = new Map(model.layers.map(l => [l.id, l.height]));

  for (const layer of model.layers) {
    buildLayerFrame(layer);
    for (const node of layer.nodes) {
      const mesh = buildNode(node, layer.color);
      nodeMeshes.push(mesh);
      meshByNode.set(node, mesh);
      focusables.push({ material: mesh.material, baseOpacity: 1, layerId: layer.id });
    }
    for (const edge of layer.edges) {
      const line = buildEdge(edge);
      scene.add(line);
      focusables.push({ material: line.material, baseOpacity: 0.6, layerId: layer.id });
    }
  }
  for (const link of model.links) {
    const mesh = buildLink(link);
    linkMeshes.push(mesh);
    scene.add(mesh);
    focusables.push({ material: mesh.material, baseOpacity: 0.7,
      span: [link.minY, link.maxY] });
  }

  function buildLayerFrame(layer) {
    const size = config.frameSize;
    const thick = config.frameThickness;
    const material = new THREE.MeshPhongMaterial({
      color: layer.color,
      emissive: layer.color,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.8
    });
    focusables.push({ material, baseOpacity: 0.8, layerId: layer.id });
    const edgeGeometry = new THREE.BoxGeometry(size, thick, thick);
    const sideGeometry = new THREE.BoxGeometry(thick, thick, size);
    const rails = [
      [0, layer.height, size / 2, edgeGeometry],
      [0, layer.height, -size / 2, edgeGeometry],
      [size / 2, layer.height, 0, sideGeometry],
      [-size / 2, layer.height, 0, sideGeometry]
    ];
    for (const [x, y, z, geometry] of rails) {
      const rail = new THREE.Mesh(geometry, material);
      rail.position.set(x, y, z);
      rail.castShadow = true;
      rail.receiveShadow = true;
      scene.add(rail);
    }

    const planeMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide
    });
    focusables.push({ material: planeMaterial, baseOpacity: 0.05, layerId: layer.id });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), planeMaterial);
    plane.position.y = layer.height;
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);
  }

  function buildNode(node, color) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(config.nodeRadius, 32, 32),
      new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: config.emissiveIdle,
        shininess: 100
      })
    );
    mesh.position.set(node.pos.x, node.pos.y, node.pos.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.node = node;
    scene.add(mesh);
    return mesh;
  }

  function buildEdge(edge) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(edge.a.x, edge.a.y, edge.a.z),
      new THREE.Vector3(edge.b.x, edge.b.y, edge.b.z)
    ]);
    return new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: edge.color,
        transparent: true,
        opacity: 0.6
      })
    );
  }

  function buildLink(link) {
    const height = link.maxY - link.minY;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(config.linkRadius, config.linkRadius, height, 16),
      new THREE.MeshPhongMaterial({
        color: config.linkColor,
        emissive: config.linkColor,
        emissiveIntensity: config.pulseBase,
        transparent: true,
        opacity: 0.7
      })
    );
    mesh.position.set(link.x, link.minY + height / 2, link.z);
    mesh.castShadow = true;
    return mesh;
  }

  return {
    resize(width, height) {
      aspect = width / height;
      perspCamera.aspect = aspect;
      perspCamera.updateProjectionMatrix();
      this.setProjection({ mode: camera === orthoCamera ? 'orthographic' : 'perspective',
        fovDeg: perspCamera.fov, halfHeight: orthoHalfHeight });
      renderer.setSize(width, height);
    },

    setView(view) {
      camera.position.set(view.position.x, view.position.y, view.position.z);
      camera.lookAt(view.target.x, view.target.y, view.target.z);
      // Fog scales with camera distance, so the dolly-zoom recession of
      // the plan-view snap (and deep zoom-out) never fogs the scene away.
      const d = camera.position.distanceTo(
        new THREE.Vector3(view.target.x, view.target.y, view.target.z));
      scene.fog.near = d * 0.035;
      scene.fog.far = d * 3.5;
    },

    /**
     * Optional contract extension: switch/blend the projection.
     * { mode: 'perspective', fovDeg } or { mode: 'orthographic', halfHeight }
     * — halfHeight is half the vertical view extent in world units.
     */
    setProjection(p) {
      if (p.mode === 'orthographic') {
        orthoHalfHeight = p.halfHeight ?? orthoHalfHeight;
        orthoCamera.top = orthoHalfHeight;
        orthoCamera.bottom = -orthoHalfHeight;
        orthoCamera.left = -orthoHalfHeight * aspect;
        orthoCamera.right = orthoHalfHeight * aspect;
        orthoCamera.updateProjectionMatrix();
        camera = orthoCamera;
      } else {
        if (p.fovDeg) perspCamera.fov = p.fovDeg;
        perspCamera.updateProjectionMatrix();
        camera = perspCamera;
      }
    },

    animate(timeMs, animating) {
      if (!animating) return;
      nodeMeshes.forEach((mesh, i) => {
        const node = mesh.userData.node;
        mesh.position.y =
          node.pos.y +
          Math.sin(timeMs * config.bobSpeed + i * 0.5) * config.bobAmplitude;
      });
      linkMeshes.forEach((mesh, i) => {
        mesh.material.emissiveIntensity =
          config.pulseBase +
          Math.sin(timeMs * config.pulseSpeed + i) * config.pulseAmplitude;
      });
    },

    render() {
      renderer.render(scene, camera);
    },

    projectNode(node) {
      const mesh = meshByNode.get(node);
      if (!mesh) return null;
      projected.copy(mesh.position);
      projected.y += config.labelYOffset;
      const distance = camera.position.distanceTo(mesh.position);
      projected.project(camera);
      return {
        x: (projected.x * 0.5 + 0.5) * renderer.domElement.clientWidth,
        y: (-projected.y * 0.5 + 0.5) * renderer.domElement.clientHeight,
        distance,
        inFront: projected.z < 1
      };
    },

    pick(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(nodeMeshes);
      return hits.length ? hits[0].object.userData.node : null;
    },

    /**
     * Optional contract extension: spotlight one layer by dimming every
     * other layer's geometry. null restores. Vertical links stay lit when
     * their span touches the focused layer's height.
     */
    setLayerFocus(layerId) {
      const height = layerHeights.get(layerId);
      for (const f of focusables) {
        const lit = layerId == null
          || (f.layerId ? f.layerId === layerId
            : f.span[0] <= height && height <= f.span[1]);
        f.material.transparent = true;
        f.material.opacity = lit ? f.baseOpacity : f.baseOpacity * 0.12;
      }
    },

    setHighlight(node) {
      for (const mesh of nodeMeshes) {
        const on = node && mesh.userData.node === node;
        mesh.material.emissiveIntensity = on
          ? config.emissiveHover
          : config.emissiveIdle;
        const s = on ? config.hoverScale : 1;
        mesh.scale.set(s, s, s);
      }
    },

    dispose() {
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of materials) m.dispose();
        }
      });
    }
  };
}
