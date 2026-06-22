// open-url.js — resolve a user-supplied URL to a directly-fetchable "raw" URL,
// with provider metadata that a future save-back path can use.
//
// Git hosting UIs serve an HTML *page* at the pretty URL; the actual file lives
// at a different "raw" URL. We rewrite the common ones so pasting a normal
// github.com/...blob/... link Just Works. raw.githubusercontent.com and gist
// raw send permissive CORS headers, so they fetch fine from the browser; other
// hosts are flagged corsRisk so the UI can warn.

export function resolveSourceUrl(input) {
  const rawInput = (input || '').trim();
  if (!rawInput) throw new Error('Enter a URL');
  let u;
  try { u = new URL(rawInput); } catch { throw new Error('That does not look like a URL'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) URLs are supported');

  const host = u.hostname.replace(/^www\./, '');
  const parts = u.pathname.replace(/^\/+/, '').split('/').filter(Boolean);

  // GitHub blob/raw page -> raw.githubusercontent.com
  if (host === 'github.com' && (parts[2] === 'blob' || parts[2] === 'raw')) {
    const [owner, repo, , ref, ...path] = parts;
    return {
      url: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path.map(encodeURIComponent).join('/')}`,
      provider: 'github', owner, repo, ref, path: path.join('/'), corsRisk: false,
    };
  }
  // Already a raw GitHub URL.
  if (host === 'raw.githubusercontent.com') {
    const [owner, repo, ref, ...path] = parts;
    return { url: u.href, provider: 'github', owner, repo, ref, path: path.join('/'), corsRisk: false };
  }
  // GitHub gist page -> gist raw (latest revision).
  if (host === 'gist.github.com') {
    const [owner, id] = parts;
    return { url: `https://gist.githubusercontent.com/${owner}/${id}/raw`, provider: 'gist', owner, repo: id, ref: 'HEAD', path: '', corsRisk: false };
  }
  if (host === 'gist.githubusercontent.com') {
    return { url: u.href, provider: 'gist', corsRisk: false };
  }
  // GitLab: /-/blob/ -> /-/raw/
  if (host === 'gitlab.com' && u.pathname.includes('/-/blob/')) {
    return { url: u.href.replace('/-/blob/', '/-/raw/'), provider: 'gitlab', corsRisk: true };
  }
  // Bitbucket: /src/ -> /raw/
  if (host === 'bitbucket.org' && u.pathname.includes('/src/')) {
    return { url: u.href.replace('/src/', '/raw/'), provider: 'bitbucket', corsRisk: true };
  }
  // Gitea / Codeberg: /src/branch/<ref>/<path> -> /raw/branch/<ref>/<path>
  if ((host === 'codeberg.org' || /gitea/i.test(host)) && u.pathname.includes('/src/')) {
    return { url: u.href.replace('/src/', '/raw/'), provider: 'gitea', corsRisk: true };
  }

  // Plain URL: fetch as-is. Cross-origin pages may be blocked by CORS.
  const sameOrigin = typeof location !== 'undefined' && u.origin === location.origin;
  return { url: u.href, provider: 'web', corsRisk: !sameOrigin };
}

// Derive a sensible filename (and therefore format) from a URL/content-type.
export function filenameFromUrl(url, contentType = '') {
  let base = '';
  try { base = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || ''); } catch { /* */ }
  if (base && /\.[a-z0-9]{1,5}$/i.test(base)) return base;

  const ext = ({
    'text/html': 'html',
    'text/markdown': 'md',
    'text/x-markdown': 'md',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'text/css': 'css',
    'text/plain': 'txt',
  })[(contentType || '').split(';')[0].trim()] || 'txt';
  return `${base || 'document'}.${ext}`;
}
