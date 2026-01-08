// ============================================
// Particle Lenia Physics Worker
// Handles simulation updates off the main thread
// ============================================

let positions = null;
let velocities = null;
let energies = null;
let params = {
    numParticles: 400,
    dt: 0.1,
    mu_k: 2.75,
    sigma_k: 1.25,
    w_k: 0.02625,
    mu_g: 0.7,
    sigma_g: 0.1667,
    c_rep: 1.0
};
let bounds = 12.0;

// Spatial hash grid for O(n) neighbor lookup
let gridCellSize = 4.0;
let grid = new Map();

// Gaussian peak function (inlined for performance)
function peak(x, mu, sigma, a) {
    const diff = x - mu;
    return a * Math.exp(-(diff * diff) / (sigma * sigma));
}

// Build spatial hash grid
function buildGrid() {
    grid.clear();
    const n = params.numParticles;
    const invCellSize = 1 / gridCellSize;

    for (let i = 0; i < n; i++) {
        const cx = Math.floor((positions[i * 2] + bounds) * invCellSize);
        const cy = Math.floor((positions[i * 2 + 1] + bounds) * invCellSize);
        const key = cx + cy * 1000;

        if (!grid.has(key)) {
            grid.set(key, []);
        }
        grid.get(key).push(i);
    }
}

// Get nearby particles using spatial hash
function getNearbyParticles(x, y, radius) {
    const nearby = [];
    const invCellSize = 1 / gridCellSize;
    const radiusCells = Math.ceil(radius / gridCellSize);

    const cx = Math.floor((x + bounds) * invCellSize);
    const cy = Math.floor((y + bounds) * invCellSize);

    for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        for (let dy = -radiusCells; dy <= radiusCells; dy++) {
            const key = (cx + dx) + (cy + dy) * 1000;
            const cell = grid.get(key);
            if (cell) {
                nearby.push(...cell);
            }
        }
    }

    return nearby;
}

// Calculate fields at a point (optimized with spatial hash)
function calculateFields(x, y, excludeIndex) {
    const { mu_k, sigma_k, w_k, mu_g, sigma_g, c_rep } = params;

    // Get particles within interaction range
    const searchRadius = mu_k + 3 * sigma_k; // 3 sigma covers 99.7%
    const nearby = getNearbyParticles(x, y, searchRadius);

    let U = 0;
    let R = 0;

    for (let i = 0; i < nearby.length; i++) {
        const idx = nearby[i];
        if (idx === excludeIndex) continue;

        const dx = x - positions[idx * 2];
        const dy = y - positions[idx * 2 + 1];
        const rSq = dx * dx + dy * dy;

        // Skip distant particles
        if (rSq > searchRadius * searchRadius) continue;

        const r = Math.sqrt(rSq + 1e-10);

        // Kernel contribution (neighborhood density)
        U += peak(r, mu_k, sigma_k, w_k);

        // Repulsion from close particles
        if (r < 1) {
            const overlap = 1 - r;
            R += (c_rep / 2) * overlap * overlap;
        }
    }

    // Growth based on neighborhood density
    const G = peak(U, mu_g, sigma_g, 1.0);

    return { U, G, R, E: R - G };
}

// Calculate gradient using central difference
function calculateGradient(index) {
    const eps = 0.01;
    const x = positions[index * 2];
    const y = positions[index * 2 + 1];

    const Ex_plus = calculateFields(x + eps, y, index).E;
    const Ex_minus = calculateFields(x - eps, y, index).E;
    const Ey_plus = calculateFields(x, y + eps, index).E;
    const Ey_minus = calculateFields(x, y - eps, index).E;

    return {
        gx: (Ex_plus - Ex_minus) / (2 * eps),
        gy: (Ey_plus - Ey_minus) / (2 * eps)
    };
}

// Run one simulation step
function step() {
    const n = params.numParticles;
    const dt = params.dt;

    // Rebuild spatial hash grid
    buildGrid();

    // Pre-allocate arrays for updates
    const gradients = new Float32Array(n * 2);

    // Calculate all gradients first
    for (let i = 0; i < n; i++) {
        const grad = calculateGradient(i);
        gradients[i * 2] = grad.gx;
        gradients[i * 2 + 1] = grad.gy;
    }

    // Apply updates and calculate energies
    for (let i = 0; i < n; i++) {
        // Euler integration: x_new = x_old - dt * ∇E
        positions[i * 2] -= dt * gradients[i * 2];
        positions[i * 2 + 1] -= dt * gradients[i * 2 + 1];

        // Boundary wrapping
        if (positions[i * 2] < -bounds) positions[i * 2] += bounds * 2;
        if (positions[i * 2] > bounds) positions[i * 2] -= bounds * 2;
        if (positions[i * 2 + 1] < -bounds) positions[i * 2 + 1] += bounds * 2;
        if (positions[i * 2 + 1] > bounds) positions[i * 2 + 1] -= bounds * 2;
    }

    // Rebuild grid for energy calculation
    buildGrid();

    // Calculate energies for coloring
    for (let i = 0; i < n; i++) {
        const fields = calculateFields(positions[i * 2], positions[i * 2 + 1], i);
        energies[i] = fields.G - fields.R;
    }
}

// Initialize particles
function initParticles() {
    const n = params.numParticles;
    positions = new Float32Array(n * 2);
    velocities = new Float32Array(n * 2);
    energies = new Float32Array(n);

    for (let i = 0; i < n; i++) {
        positions[i * 2] = (Math.random() - 0.5) * 12;
        positions[i * 2 + 1] = (Math.random() - 0.5) * 12;
        velocities[i * 2] = 0;
        velocities[i * 2 + 1] = 0;
        energies[i] = 0;
    }

    // Update grid cell size based on interaction range
    gridCellSize = Math.max(1, params.mu_k + params.sigma_k);
}

// Handle messages from main thread
self.onmessage = function(e) {
    const { type, data } = e.data;

    switch (type) {
        case 'init':
            params = { ...params, ...data.params };
            initParticles();
            self.postMessage({
                type: 'init',
                positions: positions.buffer,
                energies: energies.buffer
            }, [positions.buffer, energies.buffer]);
            // Reallocate since we transferred
            initParticles();
            break;

        case 'step':
            step();
            // Send back copies (transferable for performance)
            const posCopy = new Float32Array(positions);
            const energyCopy = new Float32Array(energies);
            self.postMessage({
                type: 'update',
                positions: posCopy.buffer,
                energies: energyCopy.buffer
            }, [posCopy.buffer, energyCopy.buffer]);
            break;

        case 'setParams':
            const needsReset = data.numParticles !== undefined &&
                               data.numParticles !== params.numParticles;
            params = { ...params, ...data };
            if (needsReset) {
                initParticles();
            }
            // Update grid cell size
            gridCellSize = Math.max(1, params.mu_k + params.sigma_k);
            break;

        case 'reset':
            initParticles();
            break;
    }
};
