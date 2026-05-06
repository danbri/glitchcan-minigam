// biomorph.js - faithful JavaScript port of the Dawkins biomorph drawing
// algorithm from the Monochrome WatchMaker Pascal source preserved under
// third_party/monochrome_pascal/. The algorithm is what matters here:
//
//   * 9 classic genes (chromosome). Gene 9 is recursion order/depth.
//   * 10 development genes ("dgenes"), each one of swell|same|shrink.
//       dgenes 1..8 mutate the corresponding running classic gene between
//       segments. dgene 9 controls line thickness during recursion. dgene 10
//       controls how the inter-segment offset grows/shrinks.
//   * Segmentation: SegNoGene segments, separated vertically by SegDistGene.
//   * Completeness: 'single' draws once; 'double' draws a left-right
//       mirrored copy.
//   * Spokes: 'northOnly' (one tree growing up), 'nsouth' (also down),
//       'radial' (eight rotational copies).
//   * Trickle gene divides every step length, acting as a fine zoom.
//
// Reference: Dawkins, *The Blind Watchmaker* (1986) and the Monochrome
// WatchMaker v1.1 (1993) Pascal source. Behaviour-faithful JS reimplementation.

export const SWELL  = 'swell';
export const SAME   = 'same';
export const SHRINK = 'shrink';

export const COMPLETENESS = {
    SINGLE: 'single',
    DOUBLE: 'double',
};
export const SPOKES = {
    NORTH_ONLY: 'northOnly',
    NSOUTH:     'nsouth',
    RADIAL:     'radial',
};

// Convenient default genome — gives a recognisable branching shape.
export function defaultGenome() {
    return {
        classic:      [ 0,  0,  1,  0,  0,  3,  0,  0, 8 ],     // genes 1..9 (gene 9 = order)
        dev:          new Array(10).fill(SAME),                  // dgenes 1..10
        segCount:     1,
        segDist:      30,
        completeness: COMPLETENESS.DOUBLE,
        spokes:       SPOKES.NORTH_ONLY,
        trickle:      1,
        mutSize:      1,
        mutProb:      50,
    };
}

// Return a deep clone of a genome (no shared arrays).
export function cloneGenome(g) {
    return {
        classic:      g.classic.slice(),
        dev:          g.dev.slice(),
        segCount:     g.segCount,
        segDist:      g.segDist,
        completeness: g.completeness,
        spokes:       g.spokes,
        trickle:      g.trickle,
        mutSize:      g.mutSize,
        mutProb:      g.mutProb,
    };
}

// PlugIn: derive the 8 compass deltas dx[i], dy[i] from a classic chromosome.
// Index 2 is "due south" (or due north on classic Mac coordinates where +Y is
// down), so trees seeded with dir=2 grow vertically. The mirror assignments
// for indices 0/1/7 give automatic left-right symmetry.
function plugIn(classic) {
    const g = classic;                                  // 1-based genes -> 0-based indices
    const dx = new Array(8);
    const dy = new Array(8);

    dx[3] =  g[0];   // gene 1
    dx[4] =  g[1];   // gene 2
    dx[5] =  g[2];   // gene 3
    dy[2] =  g[3];   // gene 4
    dy[3] =  g[4];   // gene 5
    dy[4] =  g[5];   // gene 6
    dy[5] =  g[6];   // gene 7
    dy[6] =  g[7];   // gene 8

    // Mirror across the vertical axis.
    dx[1] = -dx[3];   dy[1] = dy[3];
    dx[0] = -dx[4];   dy[0] = dy[4];
    dx[7] = -dx[5];   dy[7] = dy[5];

    // Pure-vertical compass slots.
    dx[2] = 0;
    dx[6] = 0;

    return { dx, dy };
}

// Render a biomorph for `genome` centred at (cx, cy) onto a 2D canvas
// context. Returns the bounding rectangle of the rendered figure
// {left, top, right, bottom} (in canvas coordinates).
export function develop(genome, ctx, cx, cy, opts = {}) {
    const penSize = opts.penSize ?? 1;
    const inkStyle = opts.inkStyle ?? '#f6f1d6';
    ctx.strokeStyle = inkStyle;
    ctx.lineCap = 'round';

    const trickle = Math.max(1, Math.trunc(genome.trickle) || 1);
    let order = clampOrder(genome.classic[8]);
    const segCount = Math.max(1, Math.trunc(genome.segCount) || 1);

    // Margin tracker: grows as we draw, used by post-render symmetry passes.
    const margin = { left: cx, right: cx, top: cy, bottom: cy };

    // Inter-segment vertical drift growth. dgene 10 (index 9) makes the
    // gap between successive segments grow (swell), shrink, or stay constant.
    let extraDistance;
    switch (genome.dev[9]) {
        case SWELL:  extraDistance =  trickle; break;
        case SHRINK: extraDistance = -trickle; break;
        default:     extraDistance = 0;
    }

    // Running classic gene state — mutated by dgenes between segments.
    let running = genome.classic.slice();
    let { dx, dy } = plugIn(running);

    let here = { x: cx, y: cy };
    let incDistance = 0;

    for (let seg = 1; seg <= segCount; seg++) {
        const oddSegment = (seg & 1) === 1;

        if (seg > 1) {
            // Vertical link line between segments.
            const oldHere = here;
            here = {
                x: oldHere.x,
                y: oldHere.y + Math.trunc((genome.segDist + incDistance) / trickle),
            };
            incDistance += extraDistance;

            const linkThickness = (genome.dev[8] === SHRINK) ? running[8] : 1;
            drawLine(ctx, oldHere.x, oldHere.y, here.x, here.y, linkThickness * penSize, margin);

            // Mutate the running genes 1..8 according to dgenes 1..8.
            for (let j = 0; j < 8; j++) {
                if (genome.dev[j] === SWELL)  running[j] += trickle;
                if (genome.dev[j] === SHRINK) running[j] -= trickle;
            }
            running[8] = clampOrder(running[8]);

            // Refresh dx/dy from the mutated running chromosome.
            const refreshed = plugIn(running);
            dx = refreshed.dx;
            dy = refreshed.dy;
            order = running[8];
        }

        // Recursively draw one tree from the current segment seed point. The
        // initial direction is 2 ("up" on classic Mac coords; on HTML canvas
        // we use the same convention with +Y going down — a positive dy[2]
        // grows the tree downward, a negative dy[2] grows it upward, exactly
        // as in the Pascal original).
        renderTree(ctx, here.x, here.y, order, 2, {
            order, dx, dy, trickle, penSize,
            thicknessRule: genome.dev[8],   // dgene 9 (1-based) -> index 8
            geneNine:      running[8],
            oddOne:        oddSegment,
            margin,
        });
    }

    // Post-render symmetry adjustments (bounding box only — the actual extra
    // mirrored / radial copies are drawn below using the canvas transform
    // rather than by replaying the Pascal post-pass).
    if (genome.spokes === SPOKES.NSOUTH || genome.spokes === SPOKES.RADIAL) {
        const upExtent   = cy - margin.top;
        const downExtent = margin.bottom - cy;
        if (upExtent > downExtent) margin.bottom = cy + upExtent;
        else                       margin.top    = cy - downExtent;
    }

    // NOTE: `completeness` (single vs double) is currently informational.
    // The plugIn mirror entries (dx[0]/dx[1]/dx[7] = -dx[4]/-dx[3]/-dx[5])
    // already give bilateral symmetry intrinsically, so the JS port always
    // renders the equivalent of "double". A true SINGLE pass (one-sided,
    // plant-like) would need a non-mirrored plugIn variant; not yet
    // implemented.

    return margin;
}

// Bound classic genes to a reasonable range. The original Pascal stored
// genes as 16-bit Integers; we bound a bit tighter to keep both the recursion
// step deltas and the running-gene mutation pass well-behaved over many
// generations of breeding.
const CLASSIC_MIN = -127;
const CLASSIC_MAX =  127;

function clampOrder(v) {
    const n = Math.trunc(v);
    if (!Number.isFinite(n) || n < 1) return 1;
    if (n > 12) return 12;       // MaxGene9 from Globals
    return n;
}

function clampClassic(v) {
    const n = Math.trunc(v);
    if (!Number.isFinite(n)) return 0;
    if (n < CLASSIC_MIN) return CLASSIC_MIN;
    if (n > CLASSIC_MAX) return CLASSIC_MAX;
    return n;
}

// Recursive tree procedure. Splits at every step into "outer" (dir-1) and
// "inner" (dir+1) children; the inner child is only emitted while
// lgth < order, which limits how wide the figure spreads laterally and
// produces the characteristic biomorph silhouette. The oddOne flag
// alternates which child fires first per segment, mirroring the original
// Pascal recursion order.
function renderTree(ctx, x, y, lgth, dir, env) {
    if (dir < 0)  dir += 8;
    if (dir >= 8) dir -= 8;

    const { dx, dy, trickle, penSize, thicknessRule, geneNine,
            oddOne, order, margin } = env;

    const xnew = x + Math.trunc((lgth * dx[dir]) / trickle);
    const ynew = y + Math.trunc((lgth * dy[dir]) / trickle);

    let thick;
    switch (thicknessRule) {
        case SHRINK: thick = lgth; break;
        case SWELL:  thick = 1 + geneNine - lgth; break;
        default:     thick = 1;
    }
    if (thick < 1) thick = 1;

    drawLine(ctx, x, y, xnew, ynew, thick * penSize, margin);

    if (lgth <= 1) return;

    if (oddOne) {
        renderTree(ctx, xnew, ynew, lgth - 1, dir + 1, env);
        if (lgth < order) {
            renderTree(ctx, xnew, ynew, lgth - 1, dir - 1, env);
        }
    } else {
        renderTree(ctx, xnew, ynew, lgth - 1, dir - 1, env);
        if (lgth < order) {
            renderTree(ctx, xnew, ynew, lgth - 1, dir + 1, env);
        }
    }
}

function drawLine(ctx, x0, y0, x1, y1, lineWidth, margin) {
    if (lineWidth < 1) lineWidth = 1;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x0 + 0.5, y0 + 0.5);
    ctx.lineTo(x1 + 0.5, y1 + 0.5);
    ctx.stroke();
    if (x0 < margin.left)   margin.left   = x0;
    if (x1 < margin.left)   margin.left   = x1;
    if (x0 > margin.right)  margin.right  = x0;
    if (x1 > margin.right)  margin.right  = x1;
    if (y0 < margin.top)    margin.top    = y0;
    if (y1 < margin.top)    margin.top    = y1;
    if (y0 > margin.bottom) margin.bottom = y0;
    if (y1 > margin.bottom) margin.bottom = y1;
}

// Render including spoke duplication. For radial spokes we redraw the figure
// rotated 8 times around (cx, cy); for nsouth we redraw it once flipped.
export function renderInto(genome, ctx, cx, cy, opts = {}) {
    const passes = [];
    switch (genome.spokes) {
        case SPOKES.RADIAL:
            for (let i = 0; i < 8; i++) passes.push(i * Math.PI / 4);
            break;
        case SPOKES.NSOUTH:
            passes.push(0, Math.PI);
            break;
        default:
            passes.push(0);
    }
    let bbox = null;
    for (const angle of passes) {
        ctx.save();
        if (angle !== 0) {
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.translate(-cx, -cy);
        }
        const m = develop(genome, ctx, cx, cy, opts);
        if (!bbox) bbox = { ...m };
        else {
            if (m.left   < bbox.left)   bbox.left   = m.left;
            if (m.top    < bbox.top)    bbox.top    = m.top;
            if (m.right  > bbox.right)  bbox.right  = m.right;
            if (m.bottom > bbox.bottom) bbox.bottom = m.bottom;
        }
        ctx.restore();
    }
    return bbox;
}

// Mutation: in the original WatchMaker each child differs from the parent in
// exactly one gene by exactly one step. We expose two helpers — one that
// mutates a specific gene index by ±1, and one that picks a random mutation
// of a chosen "type" matching the original mutation menu (1..MutTypeNo=9).
export const MUT_TYPE = {
    CLASSIC_GENE:    'classic',     // bump one of classic genes 1..8
    ORDER:           'order',       // bump gene 9 (depth) ±1
    DEV_GENE:        'dev',         // step one dgene through swell/same/shrink
    SEG_COUNT:       'segCount',    // ±1
    SEG_DIST:        'segDist',     // ±trickle
    COMPLETENESS:    'completeness',
    SPOKES:          'spokes',
    TRICKLE:         'trickle',
    HOPEFUL_MONSTER: 'hopeful',     // randomise everything (rare in originals)
};

// Apply a one-step mutation deterministically given a (typeKey, sub-index, sign).
// Returns a new mutated genome.
export function mutateGene(genome, typeKey, idx = 0, sign = +1) {
    const child = cloneGenome(genome);
    const step = Math.max(1, Math.trunc(child.mutSize) || 1) * (sign < 0 ? -1 : +1);
    switch (typeKey) {
        case MUT_TYPE.CLASSIC_GENE: {
            const i = Math.max(0, Math.min(7, idx));
            child.classic[i] = clampClassic(child.classic[i] + step);
            break;
        }
        case MUT_TYPE.ORDER:
            child.classic[8] = clampOrder(child.classic[8] + (sign < 0 ? -1 : +1));
            break;
        case MUT_TYPE.DEV_GENE: {
            const states = [SHRINK, SAME, SWELL];
            const i = Math.max(0, Math.min(9, idx));
            const cur = states.indexOf(child.dev[i]);
            const next = (cur + (sign < 0 ? -1 : +1) + states.length) % states.length;
            child.dev[i] = states[next];
            break;
        }
        case MUT_TYPE.SEG_COUNT:
            child.segCount = Math.max(1, child.segCount + (sign < 0 ? -1 : +1));
            break;
        case MUT_TYPE.SEG_DIST:
            child.segDist = Math.max(1, child.segDist + step);
            break;
        case MUT_TYPE.COMPLETENESS:
            child.completeness =
                child.completeness === COMPLETENESS.DOUBLE
                    ? COMPLETENESS.SINGLE : COMPLETENESS.DOUBLE;
            break;
        case MUT_TYPE.SPOKES: {
            const order = [SPOKES.NORTH_ONLY, SPOKES.NSOUTH, SPOKES.RADIAL];
            const cur = order.indexOf(child.spokes);
            const next = (cur + (sign < 0 ? -1 : +1) + order.length) % order.length;
            child.spokes = order[next];
            break;
        }
        case MUT_TYPE.TRICKLE:
            child.trickle = Math.max(1, child.trickle + (sign < 0 ? -1 : +1));
            break;
        case MUT_TYPE.HOPEFUL_MONSTER: {
            for (let i = 0; i < 8; i++) {
                child.classic[i] = clampClassic(Math.floor(Math.random() * 13) - 6);
            }
            child.classic[8] = clampOrder(2 + Math.floor(Math.random() * 7));
            const states = [SHRINK, SAME, SWELL];
            for (let i = 0; i < 10; i++) {
                child.dev[i] = states[Math.floor(Math.random() * 3)];
            }
            child.segCount = 1 + Math.floor(Math.random() * 6);
            child.segDist  = 10 + Math.floor(Math.random() * 60);
            break;
        }
    }
    return child;
}
