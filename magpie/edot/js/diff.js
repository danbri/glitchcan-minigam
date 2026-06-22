// diff.js — small dependency-free line diff for the save-back preview.
// LCS-based (no CDN, no library), with a size guard that falls back to a
// prefix/suffix coarse diff so huge files can't blow up O(n·m) memory.

const MAX_CELLS = 4_000_000; // ~16 MB of Uint32 — cap before falling back

export function diffLines(oldText, newText) {
  const A = String(oldText).split('\n');
  const B = String(newText).split('\n');
  if (A.length * B.length > MAX_CELLS) return coarse(A, B);

  const n = A.length, m = B.length;
  // dp[i][j] = LCS length of A[i:], B[j:]
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ type: 'ctx', text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'del', text: A[i] }); i++; }
    else { out.push({ type: 'add', text: B[j] }); j++; }
  }
  while (i < n) out.push({ type: 'del', text: A[i++] });
  while (j < m) out.push({ type: 'add', text: B[j++] });
  return out;
}

function coarse(A, B) {
  let s = 0;
  while (s < A.length && s < B.length && A[s] === B[s]) s++;
  let e = 0;
  while (e < A.length - s && e < B.length - s && A[A.length - 1 - e] === B[B.length - 1 - e]) e++;
  const out = [];
  for (let i = 0; i < s; i++) out.push({ type: 'ctx', text: A[i] });
  for (let i = s; i < A.length - e; i++) out.push({ type: 'del', text: A[i] });
  for (let j = s; j < B.length - e; j++) out.push({ type: 'add', text: B[j] });
  for (let i = A.length - e; i < A.length; i++) out.push({ type: 'ctx', text: A[i] });
  return out;
}

export function diffStats(diff) {
  let add = 0, del = 0;
  for (const d of diff) { if (d.type === 'add') add++; else if (d.type === 'del') del++; }
  return { add, del, changed: add + del };
}

// Collapse long unchanged runs to `context` lines on each side of a change.
export function collapse(diff, context = 3) {
  const keep = new Array(diff.length).fill(false);
  diff.forEach((d, i) => {
    if (d.type !== 'ctx') {
      for (let k = Math.max(0, i - context); k <= Math.min(diff.length - 1, i + context); k++) keep[k] = true;
    }
  });
  const rows = [];
  let gap = 0;
  diff.forEach((d, i) => {
    if (keep[i]) { if (gap) { rows.push({ type: 'gap', count: gap }); gap = 0; } rows.push(d); }
    else gap++;
  });
  if (gap) rows.push({ type: 'gap', count: gap });
  return rows;
}
