// image-util.js — shared image import for Slides and the Editor (docs). SVG is
// kept as vector (lossless); large bitmaps are downscaled on a canvas so
// documents and decks stay small. Browser-only (uses Image/canvas).

export const MAX_IMG_PX = 1600; // longest edge for embedded bitmaps

function fileToDataUrl(file) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(file); });
}

// Returns { dataUrl, aspect, width, height, vector }. aspect = width/height of the
// source. For SVG, width/height are the viewBox dims (or 0 if absent) and vector
// is true. maxPx caps the longest edge of rasterized bitmaps.
export async function prepareImage(file, maxPx = MAX_IMG_PX) {
  const isSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name || '');
  if (isSvg) {
    const text = await file.text();
    const vb = /viewBox\s*=\s*["']\s*[\d.+-]+\s+[\d.+-]+\s+([\d.+-]+)\s+([\d.+-]+)/i.exec(text);
    const w = vb ? parseFloat(vb[1]) : 0, h = vb ? parseFloat(vb[2]) : 0;
    const aspect = (w && h) ? (w / h) || 1 : 1;
    return { dataUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text), aspect, width: w, height: h, vector: true };
  }
  const url = await fileToDataUrl(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image decode failed')); i.src = url; });
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const aspect = (w && h) ? w / h : 1;
  const longest = Math.max(w, h);
  if (longest <= maxPx) return { dataUrl: url, aspect, width: w, height: h, vector: false };
  const scale = maxPx / longest;
  const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch;
  canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
  // PNG keeps alpha; JPEG is far smaller for photos. Pick by source MIME.
  const out = /png|gif|webp/i.test(file.type) ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
  return { dataUrl: out, aspect, width: cw, height: ch, vector: false };
}

// Fit a source aspect (w/h pixels) into a 16:9 slide as normalized w/h,
// undistorted (equal normalized w/h is NOT square on a 16:9 surface).
export function fitImage(aspect, maxW = 0.55, maxH = 0.7) {
  const SLIDE = 16 / 9;
  let w = maxW;
  let hh = (w * SLIDE) / (aspect || 1);
  if (hh > maxH) { hh = maxH; w = (hh * (aspect || 1)) / SLIDE; }
  return { w, h: hh };
}
