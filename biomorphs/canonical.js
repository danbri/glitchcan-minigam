// canonical.js — three "ground truth" biomorph genomes extracted from the
// hardcoded constructor procedures in the Monochrome WatchMaker v1.1 Pascal
// source (Biomorphs unit, MakeGenes / Chess / BasicTree / Insect).
//
// These three are the only named genomes hardcoded directly in Dawkins'
// source — Main.pas seeds the breeder with `BasicTree(topan); Insect(leftan);
// Chess(rightan)` whenever no saved biomorph is available. They function as
// our visual ground truth: rendering each via biomorph.js should produce a
// figure clearly recognisable as a "tree" / a "chess piece" / an "insect".
//
// Pascal `MakeGenes` defaults set: all 10 dgenes = same, segCount = 1,
// segDist = 150, completeness = double, spokes = northOnly, trickle = 10,
// mutSize = 5, mutProb = 10.

import { SAME, SHRINK, COMPLETENESS, SPOKES } from './biomorph.js';

function makeGenes(g1, g2, g3, g4, g5, g6, g7, g8, depth) {
    return {
        classic:      [g1, g2, g3, g4, g5, g6, g7, g8, depth],
        dev:          new Array(10).fill(SAME),
        segCount:     1,
        segDist:      150,
        completeness: COMPLETENESS.DOUBLE,
        spokes:       SPOKES.NORTH_ONLY,
        trickle:      10,
        mutSize:      5,
        mutProb:      10,
    };
}

// Three named canonical genomes from Biomorphs.pas (MakeGenes args reduced to
// integer literals — Chess and Insect multiply by the global trickle constant
// which equals 10 at the call site).

export const CANONICAL = {
    chess: {
        name: 'Chess',
        notes: 'Hardcoded constructor `Chess` in Biomorphs.pas. ' +
               'A symmetric tournament-like silhouette.',
        genome: makeGenes(-10, 30, -30, -30, 10, -20, 60, -50, 7),
    },

    basicTree: {
        name: 'BasicTree',
        notes: 'Hardcoded constructor `BasicTree` in Biomorphs.pas. ' +
               'Uses two segments stacked vertically with shrinking dgenes ' +
               'on the lower-half y-deltas; renders as a tapering tree.',
        genome: (() => {
            const g = makeGenes(-10, -20, -20, -15, -15, 0, 15, 15, 7);
            g.segCount = 2;
            g.segDist = 150;
            g.completeness = COMPLETENESS.SINGLE;
            // Pascal dgene[4..6] = shrink  (1-based) -> dev[3..5] (0-based)
            g.dev[3] = SHRINK;
            g.dev[4] = SHRINK;
            g.dev[5] = SHRINK;
            // Pascal dgene[9] = shrink — controls per-recursion line thickness
            g.dev[8] = SHRINK;
            g.trickle = 9;
            return g;
        })(),
    },

    insect: {
        name: 'Insect',
        notes: 'Hardcoded constructor `Insect` in Biomorphs.pas. ' +
               'Wider lateral spread + lower depth — bug-shaped silhouette.',
        genome: makeGenes(10, 10, -40, 10, -10, -20, 80, -40, 6),
    },
};
