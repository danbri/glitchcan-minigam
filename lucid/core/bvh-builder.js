/**
 * BVH (Bounding Volume Hierarchy) Builder
 *
 * Recursively partitions objects into a tree structure with AABB bounds.
 * Each node is a union with a boundingBox for early-out optimization.
 */

/**
 * Compute AABB for a single node based on its transform
 * @param {Object} node - SDF node with transform.translate
 * @param {number} radius - Bounding radius of the object
 * @returns {{min: number[], max: number[]}}
 */
function computeNodeAABB(node, radius = 1.0) {
  let center = [0, 0, 0];

  // Extract center from transform
  if (node.transform?.translate) {
    const t = node.transform.translate;
    if (Array.isArray(t)) {
      center = t;
    } else if (t.type === 'var') {
      // Dynamic position - use a default center, bounds will be loose
      // Could be improved by tracking initial positions
      center = [0, 0, 0];
    }
  }

  // Use boundingRadius if available
  const r = node.boundingRadius || radius;

  return {
    min: [center[0] - r, center[1] - r, center[2] - r],
    max: [center[0] + r, center[1] + r, center[2] + r]
  };
}

/**
 * Compute combined AABB for multiple nodes
 * @param {Object[]} nodes - Array of SDF nodes
 * @param {number} defaultRadius - Default bounding radius
 * @returns {{min: number[], max: number[], center: number[], halfSize: number[]}}
 */
function computeCombinedAABB(nodes, defaultRadius = 1.0) {
  if (nodes.length === 0) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
      center: [0, 0, 0],
      halfSize: [0, 0, 0]
    };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const node of nodes) {
    const aabb = computeNodeAABB(node, defaultRadius);
    minX = Math.min(minX, aabb.min[0]);
    minY = Math.min(minY, aabb.min[1]);
    minZ = Math.min(minZ, aabb.min[2]);
    maxX = Math.max(maxX, aabb.max[0]);
    maxY = Math.max(maxY, aabb.max[1]);
    maxZ = Math.max(maxZ, aabb.max[2]);
  }

  const center = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2
  ];

  const halfSize = [
    (maxX - minX) / 2 + 0.1,  // Small padding
    (maxY - minY) / 2 + 0.1,
    (maxZ - minZ) / 2 + 0.1
  ];

  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ], center, halfSize };
}

/**
 * Get centroid of a node for sorting
 */
function getNodeCentroid(node) {
  if (node.transform?.translate) {
    const t = node.transform.translate;
    if (Array.isArray(t)) {
      return t;
    }
  }
  return [0, 0, 0];
}

/**
 * Build BVH tree from array of SDF nodes
 *
 * @param {Object[]} nodes - Array of SDF nodes with transform.translate
 * @param {Object} options - Build options
 * @param {number} options.leafSize - Max objects per leaf node (default: 2)
 * @param {number} options.defaultRadius - Default bounding radius (default: 1.0)
 * @returns {Object} - Union node with boundingBox, potentially nested
 */
export function buildBVH(nodes, options = {}) {
  const leafSize = options.leafSize ?? 2;
  const defaultRadius = options.defaultRadius ?? 1.0;

  // Base case: small enough for a leaf
  if (nodes.length <= leafSize) {
    if (nodes.length === 1) {
      return nodes[0];
    }
    const aabb = computeCombinedAABB(nodes, defaultRadius);
    return {
      type: "union",
      boundingBox: {
        center: aabb.center,
        halfSize: aabb.halfSize
      },
      children: nodes
    };
  }

  // Find longest axis of combined AABB
  const aabb = computeCombinedAABB(nodes, defaultRadius);
  const extents = [
    aabb.max[0] - aabb.min[0],
    aabb.max[1] - aabb.min[1],
    aabb.max[2] - aabb.min[2]
  ];

  let splitAxis = 0;
  if (extents[1] > extents[0] && extents[1] > extents[2]) splitAxis = 1;
  else if (extents[2] > extents[0] && extents[2] > extents[1]) splitAxis = 2;

  // Sort nodes along split axis
  const sorted = [...nodes].sort((a, b) => {
    const ca = getNodeCentroid(a);
    const cb = getNodeCentroid(b);
    return ca[splitAxis] - cb[splitAxis];
  });

  // Split at median
  const mid = Math.floor(sorted.length / 2);
  const leftNodes = sorted.slice(0, mid);
  const rightNodes = sorted.slice(mid);

  // Recursively build subtrees
  const leftChild = buildBVH(leftNodes, options);
  const rightChild = buildBVH(rightNodes, options);

  // Combine into parent node with bounding box
  return {
    type: "union",
    boundingBox: {
      center: aabb.center,
      halfSize: aabb.halfSize
    },
    children: [leftChild, rightChild]
  };
}

/**
 * Build BVH with dynamic position support
 * For physics objects, we can't know exact positions at build time.
 * This version uses initial positions and adds padding.
 *
 * @param {Object[]} nodesWithInitialPos - Array of {node, initialPos: [x,y,z]}
 * @param {Object} options
 * @returns {Object}
 */
export function buildDynamicBVH(nodesWithInitialPos, options = {}) {
  const leafSize = options.leafSize ?? 2;
  const defaultRadius = options.defaultRadius ?? 1.0;
  const padding = options.padding ?? 2.0;  // Extra padding for movement

  // Augment nodes with position info for sorting
  const augmented = nodesWithInitialPos.map(({ node, initialPos }) => ({
    ...node,
    _initialPos: initialPos,
    _radius: node.boundingRadius || defaultRadius
  }));

  function computeAABB(nodes) {
    if (nodes.length === 0) return null;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const n of nodes) {
      const [x, y, z] = n._initialPos;
      const r = n._radius + padding;
      minX = Math.min(minX, x - r);
      minY = Math.min(minY, y - r);
      minZ = Math.min(minZ, z - r);
      maxX = Math.max(maxX, x + r);
      maxY = Math.max(maxY, y + r);
      maxZ = Math.max(maxZ, z + r);
    }

    return {
      center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
      halfSize: [(maxX - minX) / 2, (maxY - minY) / 2, (maxZ - minZ) / 2]
    };
  }

  function build(nodes) {
    if (nodes.length <= leafSize) {
      // Clean up internal properties
      const cleaned = nodes.map(n => {
        const { _initialPos, _radius, ...rest } = n;
        return rest;
      });
      if (cleaned.length === 1) return cleaned[0];

      const aabb = computeAABB(nodes);
      return {
        type: "union",
        boundingBox: aabb,
        children: cleaned
      };
    }

    const aabb = computeAABB(nodes);
    const extents = aabb.halfSize.map(h => h * 2);

    let axis = 0;
    if (extents[1] > extents[0] && extents[1] > extents[2]) axis = 1;
    else if (extents[2] > extents[0] && extents[2] > extents[1]) axis = 2;

    const sorted = [...nodes].sort((a, b) => a._initialPos[axis] - b._initialPos[axis]);
    const mid = Math.floor(sorted.length / 2);

    return {
      type: "union",
      boundingBox: aabb,
      children: [
        build(sorted.slice(0, mid)),
        build(sorted.slice(mid))
      ]
    };
  }

  return build(augmented);
}

export { computeNodeAABB, computeCombinedAABB };
