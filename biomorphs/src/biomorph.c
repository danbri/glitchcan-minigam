/*
 * biomorph.c - Clean-room WebAssembly implementation of the Dawkins biomorph
 * concept (recursive symmetric tree drawing parameterised by 9 integer genes).
 *
 * Built from the public algorithmic description in *The Blind Watchmaker*
 * (1986), not translated from any specific source code.
 *
 * Build (freestanding wasm32):
 *   clang --target=wasm32 -O2 -nostdlib -fvisibility=hidden \
 *     -Wl,--no-entry -Wl,--export-dynamic -Wl,--allow-undefined \
 *     -o biomorph.wasm biomorph.c
 */

#define WASM_EXPORT __attribute__((visibility("default"))) __attribute__((used))

#define FB_W 256
#define FB_H 256
#define FB_PIX (FB_W * FB_H)

#define NUM_GENES 9
#define DEPTH_GENE 8     /* index of the depth/order gene */
#define MAX_DEPTH 8

/* Freestanding memset so clang doesn't emit an env.memset import. */
void* memset(void* dst, int c, unsigned long n) {
    unsigned char* p = (unsigned char*)dst;
    unsigned char v = (unsigned char)c;
    while (n--) *p++ = v;
    return dst;
}

/* Framebuffer: one byte per pixel, 0 = background, 255 = ink. */
static unsigned char g_fb[FB_PIX];

/* Genes: 0..7 are integer offsets (signed) used to perturb branch deltas.
 * Gene 8 is the recursion order (clamped to 1..MAX_DEPTH). */
static int g_genes[NUM_GENES];

/* ---------- exported accessors ---------- */

WASM_EXPORT int fb_width(void)  { return FB_W; }
WASM_EXPORT int fb_height(void) { return FB_H; }
WASM_EXPORT int num_genes(void) { return NUM_GENES; }

WASM_EXPORT unsigned char* framebuffer(void) { return g_fb; }
WASM_EXPORT int* genes(void)                 { return g_genes; }

WASM_EXPORT int get_gene(int i) {
    if (i < 0 || i >= NUM_GENES) return 0;
    return g_genes[i];
}

WASM_EXPORT void set_gene(int i, int v) {
    if (i < 0 || i >= NUM_GENES) return;
    if (i == DEPTH_GENE) {
        if (v < 1) v = 1;
        if (v > MAX_DEPTH) v = MAX_DEPTH;
    } else {
        if (v < -32) v = -32;
        if (v >  32) v =  32;
    }
    g_genes[i] = v;
}

WASM_EXPORT void reset_genes(void) {
    /* A reasonable, mildly asymmetric starting genome that produces a
     * recognisable branching shape rather than a single dot. */
    g_genes[0] =  3;
    g_genes[1] = -1;
    g_genes[2] =  2;
    g_genes[3] = -2;
    g_genes[4] =  4;
    g_genes[5] =  0;
    g_genes[6] = -3;
    g_genes[7] =  1;
    g_genes[8] =  5;   /* depth */
}

/* Mutate one gene by delta (typically +/-1). Gene 8 (depth) is clamped. */
WASM_EXPORT void mutate(int gene_idx, int delta) {
    if (gene_idx < 0 || gene_idx >= NUM_GENES) return;
    set_gene(gene_idx, g_genes[gene_idx] + delta);
}

/* ---------- drawing ---------- */

static inline void put_pixel(int x, int y) {
    if ((unsigned)x >= (unsigned)FB_W) return;
    if ((unsigned)y >= (unsigned)FB_H) return;
    g_fb[y * FB_W + x] = 255;
}

/* Bresenham line. */
static void draw_line(int x0, int y0, int x1, int y1) {
    int dx =  (x1 > x0) ? (x1 - x0) : (x0 - x1);
    int dy = -((y1 > y0) ? (y1 - y0) : (y0 - y1));
    int sx = (x0 < x1) ? 1 : -1;
    int sy = (y0 < y1) ? 1 : -1;
    int err = dx + dy;
    for (;;) {
        put_pixel(x0, y0);
        if (x0 == x1 && y0 == y1) break;
        int e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
}

/* Recursive tree.
 *
 * At each level we extend from (x,y) by (dx,dy) and draw the segment, then
 * recurse twice with (dx,dy) perturbed by the gene at the current level.
 * The two recursive calls flip the sign of the x-perturbation, which is what
 * gives the biomorph its left-right symmetry across the whole figure.
 *
 * `dx_sign` is propagated so that mirrored sub-branches stay mirrored all the
 * way down. */
static void tree(int x, int y, int dx, int dy, int level, int max_level) {
    int x2 = x + dx;
    int y2 = y + dy;
    draw_line(x, y, x2, y2);
    if (level >= max_level) return;
    int gx = g_genes[level & 7];
    int gy = g_genes[(level + 3) & 7];
    /* Branch "outward" and "inward" with gene-modified deltas. */
    tree(x2, y2, dx + gx, dy - gy, level + 1, max_level);
    tree(x2, y2, dx - gx, dy + gy, level + 1, max_level);
}

WASM_EXPORT void render(void) {
    /* Clear framebuffer. */
    for (int i = 0; i < FB_PIX; i++) g_fb[i] = 0;

    int cx = FB_W / 2;
    int cy = FB_H / 2;
    int depth = g_genes[DEPTH_GENE];
    if (depth < 1) depth = 1;
    if (depth > MAX_DEPTH) depth = MAX_DEPTH;

    /* Initial step length scaled inversely with depth so deep biomorphs still
     * fit on the canvas. */
    int step = 24 - depth * 2;
    if (step < 4) step = 4;

    /* Render two halves from the centre to give bilateral symmetry: one
     * branch grows up, one grows down. The recursive `tree` already mirrors
     * each branch left/right, so these two seed calls produce the classic
     * symmetric biomorph silhouette. */
    tree(cx, cy, 0, -step, 0, depth);
    tree(cx, cy, 0,  step, 0, depth);
}
