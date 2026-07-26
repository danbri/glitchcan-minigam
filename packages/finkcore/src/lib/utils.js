export function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function resolveUrl(url, base = (typeof window !== 'undefined' ? window.location.href : 'http://localhost/')) {
  try {
    return new URL(url, base).href;
  } catch (e) {
    return url;
  }
}

