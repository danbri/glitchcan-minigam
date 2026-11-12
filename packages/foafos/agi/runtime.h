// The little runtime every handler shares: a bump allocator over the memory the shell gives
// (growing it, within the shell's cap, when it must), a growable output buffer, and escaping.
// No libc, no imports but env.memory.
typedef unsigned int u32;
typedef unsigned char u8;
extern u8 __heap_base;
static u8 *top = &__heap_base;

static u8 *grab(u32 n) {
  u8 *p = top;
  u32 end = (u32)(top - (u8 *)0) + ((n + 7) & ~7u);
  u32 have = __builtin_wasm_memory_size(0) * 65536u;
  if (end > have) {
    u32 need = (end - have + 65535u) / 65536u;
    if (__builtin_wasm_memory_grow(0, need) == (unsigned long)-1) return 0;   // over the cap: the shell refuses
  }
  top = (u8 *)0 + end;
  return p;
}

__attribute__((export_name("alloc"))) u8 *alloc(u32 n) { return grab(n); }

typedef struct { u8 *b; u32 n, cap; int bad; } Out;

static void reserve(Out *o, u32 more) {
  if (o->bad || o->n + more <= o->cap) return;
  u32 cap = o->cap ? o->cap * 2 : 4096;
  while (cap < o->n + more) cap *= 2;
  u8 *nb = grab(cap + 4);
  if (!nb) { o->bad = 1; return; }
  for (u32 i = 0; i < o->n; i++) nb[4 + i] = o->b[4 + i];
  o->b = nb; o->cap = cap;
}
static void put(Out *o, const u8 *s, u32 n) { reserve(o, n); if (o->bad) return; for (u32 i = 0; i < n; i++) o->b[4 + o->n + i] = s[i]; o->n += n; }
static void puts_(Out *o, const char *s) { u32 n = 0; while (s[n]) n++; put(o, (const u8 *)s, n); }
static void putc_(Out *o, u8 c) { put(o, &c, 1); }
/** Text into HTML or XML: & < > " ' escaped, so nothing in the input becomes markup. */
static void esc(Out *o, const u8 *s, u32 n) {
  for (u32 i = 0; i < n; i++) {
    u8 c = s[i];
    if (c == '&') puts_(o, "&amp;"); else if (c == '<') puts_(o, "&lt;"); else if (c == '>') puts_(o, "&gt;");
    else if (c == '"') puts_(o, "&quot;"); else if (c == '\'') puts_(o, "&#39;");
    else if (c < 0x20 && c != '\n' && c != '\t') continue;     // control characters are dropped
    else putc_(o, c);
  }
}
/** The result the shell reads: [u32 length][bytes]. A failed buffer gives length 0. */
static u8 *finish(Out *o) {
  if (o->bad || !o->b) { u8 *z = grab(4); if (z) z[0] = z[1] = z[2] = z[3] = 0; return z; }
  o->b[0] = o->n; o->b[1] = o->n >> 8; o->b[2] = o->n >> 16; o->b[3] = o->n >> 24;
  return o->b;
}
__attribute__((unused)) static int starts(const u8 *s, u32 n, const char *p) { u32 i = 0; for (; p[i]; i++) if (i >= n || s[i] != (u8)p[i]) return 0; return 1; }
