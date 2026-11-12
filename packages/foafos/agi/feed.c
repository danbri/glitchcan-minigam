// feed: an Atom feed from a folder of Markdown posts. Input: u32 count, then for each file u32
// name length, name, u32 data length, data. Output: the feed. Each entry's title is the post's
// first heading (else its file name), its link the page md2html would write (site/{dir}{name}.html,
// relative), and its date the YYYY-MM-DD the file name starts with (else none is claimed: a handler
// has no clock). Newest first, by file name. All text is escaped.
#include "runtime.h"

static u32 rd32(const u8 *p) { return p[0] | (p[1] << 8) | (p[2] << 16) | ((u32)p[3] << 24); }
typedef struct { const u8 *name; u32 nn; const u8 *data; u32 dn; } File;

static int name_lt(const File *a, const File *b) {   // descending by name: b < a
  u32 n = a->nn < b->nn ? a->nn : b->nn;
  for (u32 i = 0; i < n; i++) if (a->name[i] != b->name[i]) return a->name[i] > b->name[i];
  return a->nn > b->nn;
}
static int dated(const u8 *s, u32 n) {                // YYYY-MM-DD at the start
  if (n < 10) return 0;
  for (u32 i = 0; i < 10; i++) { if (i == 4 || i == 7) { if (s[i] != '-') return 0; } else if (s[i] < '0' || s[i] > '9') return 0; }
  return 1;
}

__attribute__((export_name("run"))) u8 *run(u8 *in, u32 len) {
  Out o = { 0, 0, 0, 0 }; reserve(&o, 4096);
  u32 count = len >= 4 ? rd32(in) : 0;
  if (count > 200) count = 200;
  File *fs = (File *)grab(sizeof(File) * (count + 1));
  u32 k = 0, at = 4;
  for (u32 i = 0; i < count && fs; i++) {
    if (at + 4 > len) break; u32 nn = rd32(in + at); at += 4; if (at + nn > len) break;
    const u8 *name = in + at; at += nn; if (at + 4 > len) break; u32 dn = rd32(in + at); at += 4; if (at + dn > len) break;
    fs[k].name = name; fs[k].nn = nn; fs[k].data = in + at; fs[k].dn = dn; k++; at += dn;
  }
  for (u32 i = 1; i < k; i++) { File f = fs[i]; u32 j = i; while (j > 0 && name_lt(&f, &fs[j - 1])) { fs[j] = fs[j - 1]; j--; } fs[j] = f; }
  puts_(&o, "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<feed xmlns=\"http://www.w3.org/2005/Atom\">\n  <title>Posts</title>\n  <id>urn:foafos:feed</id>\n");
  for (u32 i = 0; i < k; i++) {
    const u8 *nm = fs[i].name; u32 nn = fs[i].nn;
    u32 slash = nn; while (slash > 0 && nm[slash - 1] != '/') slash--;
    u32 dot = nn; while (dot > slash && nm[dot - 1] != '.') dot--; u32 stemEnd = dot > slash ? dot - 1 : nn;
    const u8 *t = nm + slash; u32 tn = stemEnd - slash;
    const u8 *d = fs[i].data; u32 dn = fs[i].dn;
    for (u32 p = 0; p < dn;) { u32 e = p; while (e < dn && d[e] != '\n') e++; if (d[p] == '#') { u32 a = p; while (a < e && d[a] == '#') a++; while (a < e && d[a] == ' ') a++; u32 b = e; while (b > a && (d[b - 1] == '\r' || d[b - 1] == ' ')) b--; t = d + a; tn = b - a; break; } p = e + 1; }
    puts_(&o, "  <entry>\n    <title>"); esc(&o, t, tn); puts_(&o, "</title>\n    <link href=\""); esc(&o, nm, slash); esc(&o, nm + slash, stemEnd - slash); puts_(&o, ".html\"/>\n    <id>urn:foafos:post:"); esc(&o, nm, nn); puts_(&o, "</id>\n");
    if (dated(nm + slash, nn - slash)) { puts_(&o, "    <updated>"); esc(&o, nm + slash, 10); puts_(&o, "T00:00:00Z</updated>\n"); }
    puts_(&o, "  </entry>\n");
  }
  puts_(&o, "</feed>\n");
  return finish(&o);
}
