// md2html: a Markdown file to an HTML page. Input: path \0 bytes. Output: the page.
// A safe subset: headings, paragraphs, *em*, **strong**, `code`, fenced code, [links](url),
// - / * / 1. lists, > quotes. All text is escaped; raw HTML is shown as text, never passed
// through; a link is kept only if it is http(s), mailto, a fragment or a relative path.
#include "runtime.h"

static int safe_url(const u8 *u, u32 n) {
  if (n == 0) return 0;
  if (starts(u, n, "http://") || starts(u, n, "https://") || starts(u, n, "mailto:") || u[0] == '#' || u[0] == '/' || u[0] == '.') return 1;
  for (u32 i = 0; i < n; i++) { if (u[i] == ':') return 0; if (u[i] == '/' || u[i] == '?' || u[i] == '#') return 1; }
  return 1;                                                    // a bare relative name
}

static void inline_(Out *o, const u8 *s, u32 n) {
  for (u32 i = 0; i < n;) {
    if (s[i] == '`') { u32 j = i + 1; while (j < n && s[j] != '`') j++; if (j < n) { puts_(o, "<code>"); esc(o, s + i + 1, j - i - 1); puts_(o, "</code>"); i = j + 1; continue; } }
    if (i + 1 < n && s[i] == '*' && s[i + 1] == '*') { u32 j = i + 2; while (j + 1 < n && !(s[j] == '*' && s[j + 1] == '*')) j++; if (j + 1 < n) { puts_(o, "<strong>"); inline_(o, s + i + 2, j - i - 2); puts_(o, "</strong>"); i = j + 2; continue; } }
    if (s[i] == '*' || s[i] == '_') { u8 m = s[i]; u32 j = i + 1; while (j < n && s[j] != m) j++; if (j < n && j > i + 1) { puts_(o, "<em>"); inline_(o, s + i + 1, j - i - 1); puts_(o, "</em>"); i = j + 1; continue; } }
    if (s[i] == '[') {
      u32 j = i + 1; while (j < n && s[j] != ']') j++;
      if (j + 1 < n && s[j + 1] == '(') {
        u32 k = j + 2; while (k < n && s[k] != ')' && s[k] != ' ') k++;
        if (k < n && s[k] == ')') {
          if (safe_url(s + j + 2, k - j - 2)) { puts_(o, "<a href=\""); esc(o, s + j + 2, k - j - 2); puts_(o, "\">"); inline_(o, s + i + 1, j - i - 1); puts_(o, "</a>"); }
          else inline_(o, s + i + 1, j - i - 1);                 // an unsafe link keeps its words only
          i = k + 1; continue;
        }
      }
    }
    esc(o, s + i, 1); i++;
  }
}

static u32 line_end(const u8 *s, u32 n, u32 i) { while (i < n && s[i] != '\n') i++; return i; }
static int blank(const u8 *s, u32 a, u32 b) { for (u32 i = a; i < b; i++) if (s[i] != ' ' && s[i] != '\t' && s[i] != '\r') return 0; return 1; }

__attribute__((export_name("run"))) u8 *run(u8 *in, u32 len) {
  u32 z = 0; while (z < len && in[z]) z++;
  const u8 *s = in + (z < len ? z + 1 : len); u32 n = len - (z < len ? z + 1 : len);
  Out o = { 0, 0, 0, 0 }; reserve(&o, n * 2 + 256);
  // the title: the first heading, else the file name
  const u8 *t = in; u32 tn = z;
  for (u32 i = 0; i < n;) { u32 e = line_end(s, n, i); if (s[i] == '#') { u32 a = i; while (a < e && s[a] == '#') a++; while (a < e && s[a] == ' ') a++; t = s + a; tn = e - a; while (tn && (t[tn - 1] == '\r' || t[tn - 1] == ' ')) tn--; break; } i = e + 1; }
  puts_(&o, "<!doctype html>\n<html><head><meta charset=\"utf-8\"><title>"); esc(&o, t, tn); puts_(&o, "</title></head>\n<body>\n");
  int inPara = 0, inList = 0, inQuote = 0; char listTag = 'u';
  for (u32 i = 0; i < n;) {
    u32 e = line_end(s, n, i); u32 le = e; if (le > i && s[le - 1] == '\r') le--;
    const u8 *l = s + i; u32 ln = le - i;
    if (starts(l, ln, "```")) {                                  // fenced code, to the closing fence
      if (inPara) { puts_(&o, "</p>\n"); inPara = 0; }
      puts_(&o, "<pre><code>"); i = e + 1;
      while (i < n) { u32 e2 = line_end(s, n, i); if (starts(s + i, e2 - i, "```")) { i = e2 + 1; break; } esc(&o, s + i, e2 - i); putc_(&o, '\n'); i = e2 + 1; }
      puts_(&o, "</code></pre>\n"); continue;
    }
    int isItem = ln >= 2 && (l[0] == '-' || l[0] == '*') && l[1] == ' ';
    u32 num = 0; while (num < ln && l[num] >= '0' && l[num] <= '9') num++;
    int isNum = num > 0 && num + 1 < ln && l[num] == '.' && l[num + 1] == ' ';
    if ((inList && !isItem && !isNum) || blank(s, i, le)) { if (inList) { puts_(&o, listTag == 'o' ? "</ol>\n" : "</ul>\n"); inList = 0; } }
    if (inQuote && (ln == 0 || l[0] != '>')) { if (inPara) { puts_(&o, "</p>\n"); inPara = 0; } puts_(&o, "</blockquote>\n"); inQuote = 0; }
    if (blank(s, i, le)) { if (inPara) { puts_(&o, "</p>\n"); inPara = 0; } i = e + 1; continue; }
    if (l[0] == '#') {
      u32 h = 0; while (h < ln && l[h] == '#' && h < 6) h++;
      if (h < ln && l[h] == ' ') {
        if (inPara) { puts_(&o, "</p>\n"); inPara = 0; }
        char tag[5] = { '<', 'h', (char)('0' + h), '>', 0 }; puts_(&o, tag); inline_(&o, l + h + 1, ln - h - 1);
        char end[6] = { '<', '/', 'h', (char)('0' + h), '>', 0 }; puts_(&o, end); putc_(&o, '\n'); i = e + 1; continue;
      }
    }
    if (isItem || isNum) {
      if (inPara) { puts_(&o, "</p>\n"); inPara = 0; }
      char want = isNum ? 'o' : 'u';
      if (inList && listTag != want) { puts_(&o, listTag == 'o' ? "</ol>\n" : "</ul>\n"); inList = 0; }
      if (!inList) { puts_(&o, want == 'o' ? "<ol>\n" : "<ul>\n"); inList = 1; listTag = want; }
      u32 skip = isNum ? num + 2 : 2;
      puts_(&o, "<li>"); inline_(&o, l + skip, ln - skip); puts_(&o, "</li>\n"); i = e + 1; continue;
    }
    if (l[0] == '>') {
      if (!inQuote) { if (inPara) { puts_(&o, "</p>\n"); inPara = 0; } puts_(&o, "<blockquote>\n"); inQuote = 1; }
      u32 a = 1; if (a < ln && l[a] == ' ') a++;
      l += a; ln -= a;
    }
    if (!inPara) { puts_(&o, "<p>"); inPara = 1; } else putc_(&o, '\n');
    inline_(&o, l, ln);
    i = e + 1;
  }
  if (inPara) puts_(&o, "</p>\n");
  if (inList) puts_(&o, listTag == 'o' ? "</ol>\n" : "</ul>\n");
  if (inQuote) puts_(&o, "</blockquote>\n");
  puts_(&o, "</body></html>\n");
  return finish(&o);
}
