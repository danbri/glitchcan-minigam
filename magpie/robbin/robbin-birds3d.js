/*
  The cut-paper birds in 3D — shared builder.

  The original lino-cut paths (from the CodePen prototype, mirrored in
  codepen-backups/pens/QwdBKbE/) mounted as hinged paper layers: each
  part is drawn into a transparent canvas texture, placed on a slightly
  bowed plane, and hung beneath a pivot group so head, wing and tail
  swing independently. Deliberately NOT a rounded 3D bird — a shallow
  toy-theatre cutout that catches real light.

  Used by robbin3d.html (the gallery) and robbin-wipe3d.js (the flock
  screen-wipe). three.js is passed in, never imported here, so callers
  control when the 687 KB vendored module is actually loaded.

  makeBirdFactory(THREE, renderer) returns { createBird }; textures,
  materials and the bowed-plane geometry are cached inside the factory
  and SHARED between every bird it builds — fifty birds cost the same
  GPU memory as two.
*/

export const BIRDS = {
  bluetit: {
    name: "Blue tit",
    legColour: "#1b1713",
    hips: [
      [44, 74],
      [57, 72]
    ],
    parts: [
      {
        id: "tail",
        pivot: [31, 52],
        layers: [
          {
            path: "M4,60 L33,47 L36,59 L12,71 Z",
            fill: "#3d6cb2"
          }
        ]
      },
      {
        id: "body",
        layers: [
          {
            path:
              "M28,34 C24,42 23,54 30,64 L40,68 " +
              "C33,54 35,41 43,33 Z",
            fill: "#3d6cb2"
          },
          {
            path:
              "M30,44 C38,32 58,30 70,40 " +
              "C79,49 78,64 66,73 " +
              "C53,81 38,77 31,66 " +
              "C26,58 26,50 30,44 Z",
            fill: "#e2c22a"
          }
        ]
      },
      {
        id: "wing",
        pivot: [37, 46],
        layers: [
          {
            path:
              "M32,44 C42,38 55,41 58,49 " +
              "C56,58 46,64 37,61 " +
              "C29,57 27,50 32,44 Z",
            fill: "#3d6cb2"
          }
        ]
      },
      {
        id: "head",
        pivot: [60, 32],
        layers: [
          {
            path:
              "M46,30 C47,17 59,9 70,11 " +
              "C80,13 85,22 84,30 " +
              "C83,39 74,45 63,45 " +
              "C53,44 46,39 46,30 Z",
            fill: "#f7f3e8"
          },
          {
            path:
              "M45,25 C49,12 63,5 74,10 " +
              "C81,13 85,19 85,25 " +
              "C75,15 58,13 46,22 Z",
            fill: "#3d6cb2"
          },
          {
            path:
              "M47,25 C58,22 70,22 82,25 " +
              "L82,29 C70,26 58,26 47,30 Z",
            fill: "#1b1713"
          },
          {
            path:
              "M46,36 C54,44 70,45 82,38 " +
              "L82,42 C70,48 54,47 45,40 Z",
            fill: "#1b1713"
          },
          {
            path: "M66,42 L76,39 L72,48 Z",
            fill: "#1b1713"
          },
          {
            path: "M83,23 L96,27 L83,31 Z",
            fill: "#1b1713"
          }
        ]
      }
    ]
  },

  robin: {
    name: "Robin",
    legColour: "#1b1713",
    hips: [
      [44, 72],
      [56, 70]
    ],
    parts: [
      {
        id: "tail",
        pivot: [33, 49],
        layers: [
          {
            path: "M5,42 L35,43 L33,57 L8,55 Z",
            fill: "#26221e"
          }
        ]
      },
      {
        id: "body",
        layers: [
          {
            path:
              "M26,48 C27,33 40,23 55,23 " +
              "C69,23 79,32 80,43 " +
              "C80,54 71,66 57,73 " +
              "C43,79 29,72 26,60 Z",
            fill: "#26221e"
          },
          {
            path:
              "M57,32 C67,30 76,36 77,44 " +
              "C76,54 68,63 57,70 " +
              "C46,75 36,71 34,63 " +
              "C44,58 52,50 55,43 " +
              "C56,38 56,34 57,32 Z",
            fill: "#d94327"
          }
        ]
      },
      {
        id: "wing",
        pivot: [38, 45],
        layers: [
          {
            path:
              "M33,44 C43,38 55,40 59,48 " +
              "C57,57 47,63 38,61 " +
              "C30,57 28,50 33,44 Z",
            fill: "#3a322b"
          }
        ]
      },
      {
        id: "head",
        pivot: [58, 38],
        layers: [
          {
            path:
              "M45,34 C45,22 55,13 66,14 " +
              "C76,15 82,23 82,31 " +
              "C82,40 74,46 64,46 " +
              "C53,46 45,43 45,34 Z",
            fill: "#26221e"
          },
          {
            path:
              "M61,23 C71,20 79,28 79,35 " +
              "C78,41 71,46 63,45 " +
              "C55,43 52,37 53,30 " +
              "C55,26 58,24 61,23 Z",
            fill: "#d94327"
          },
          {
            circle: [68, 27, 3.4],
            fill: "#1b1713"
          },
          {
            circle: [69.2, 25.9, 1.1],
            fill: "#f7f2e6"
          },
          {
            path: "M79,25 L95,30 L79,35 Z",
            fill: "#1b1713"
          }
        ]
      }
    ]
  }
};

function sourceToWorldX(sourceX) {
  return (sourceX - 50) / 66.6667;
}

function sourceToWorldY(sourceY) {
  return (50 - sourceY) / 66.6667;
}

export function makeBirdFactory(THREE, renderer) {
  const textures = new Map();
  const materials = new Map();
  let geometry = null;

  function finishTexture(canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function partTexture(species, partIndex, layers) {
    const key = `${species}/${partIndex}`;
    if (textures.has(key)) return textures.get(key);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    context.scale(5.12, 5.12);
    context.lineJoin = "round";
    context.lineCap = "round";
    for (const layer of layers) {
      context.fillStyle = layer.fill;
      context.strokeStyle = layer.stroke || layer.fill;
      if (layer.path) {
        context.fill(new Path2D(layer.path));
      }
      if (layer.circle) {
        const [x, y, radius] = layer.circle;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      if (layer.line) {
        const [x1, y1, x2, y2] = layer.line;
        context.lineWidth = layer.width || 2;
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
      }
    }
    const texture = finishTexture(canvas);
    textures.set(key, texture);
    return texture;
  }

  function legTexture(species, definition) {
    const key = `${species}/legs`;
    if (textures.has(key)) return textures.get(key);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    context.scale(5.12, 5.12);
    context.strokeStyle = definition.legColour;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const [hipX, hipY] of definition.hips) {
      const ankleX = hipX - 1;
      const ankleY = 91;
      context.beginPath();
      context.moveTo(hipX, hipY);
      context.lineTo(ankleX, ankleY);
      context.moveTo(ankleX, ankleY);
      context.lineTo(ankleX - 8, 96);
      context.moveTo(ankleX, ankleY);
      context.lineTo(ankleX + 5, 96);
      context.moveTo(ankleX, ankleY);
      context.lineTo(ankleX + 1, 98);
      context.stroke();
    }
    const texture = finishTexture(canvas);
    textures.set(key, texture);
    return texture;
  }

  function paperGeometry() {
    if (geometry) return geometry;
    geometry = new THREE.PlaneGeometry(1.5, 1.5, 4, 4);
    const positions = geometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      /*
        Very shallow bowing. The bird remains graphically flat, but
        catches changing light when the viewer moves around it.
      */
      const curl =
        Math.abs(x) * 0.018 +
        y * 0.006 +
        Math.sin((x + y) * 3) * 0.002;
      positions.setZ(index, curl);
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  function paperSheet(key, texture) {
    let material = materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.08,
        side: THREE.DoubleSide,
        roughness: 0.94,
        metalness: 0
      });
      materials.set(key, material);
    }
    const mesh = new THREE.Mesh(paperGeometry(), material);
    mesh.castShadow = true;
    return mesh;
  }

  function createBird(species, scale = 1) {
    const definition = BIRDS[species];
    const root = new THREE.Group();
    root.userData = {
      species,
      animationOffset: Math.random() * 10,
      parts: {}
    };

    const legSheet = paperSheet(`${species}/legs`, legTexture(species, definition));
    legSheet.position.set(0, 0.45, -0.035);
    root.add(legSheet);

    definition.parts.forEach((part, index) => {
      const pivot = new THREE.Group();
      const sourcePivot = part.pivot || [50, 50];
      const pivotX = sourceToWorldX(sourcePivot[0]);
      const pivotY = sourceToWorldY(sourcePivot[1]);
      pivot.position.set(pivotX, pivotY, index * 0.022);

      const sheet = paperSheet(`${species}/${index}`, partTexture(species, index, part.layers));
      /*
        Offset the complete original drawing so that the requested
        source-space pivot sits at the origin of this pivot group.
      */
      sheet.position.set(-pivotX, 0.45 - pivotY, 0);
      pivot.add(sheet);
      root.add(pivot);
      root.userData.parts[part.id] = pivot;
    });

    root.scale.setScalar(scale);
    return root;
  }

  return { createBird };
}
