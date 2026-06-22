// git-remote.js — minimal GitHub REST client for reading a file and writing it
// back as a branch + pull request. No git protocol, no packfiles: api.github.com
// is CORS-enabled, so these calls work directly from the browser with a token
// (see docs/git-sync-methodology.md). `fetchImpl` is injectable for testing.

const API = 'https://api.github.com';

export class GitHubRemote {
  constructor(token, fetchImpl) {
    this.token = token;
    this.fetch = fetchImpl || ((...a) => fetch(...a));
  }

  async _req(method, path, body) {
    const res = await this.fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text }; }
    if (!res.ok) {
      const err = new Error(json.message || `GitHub API ${res.status}`);
      err.status = res.status; err.data = json;
      throw err;
    }
    return json;
  }

  me() { return this._req('GET', '/user'); }
  getRepo(owner, repo) { return this._req('GET', `/repos/${owner}/${repo}`); }

  // File text + blob sha. Returns { sha:null } if the file does not exist yet.
  async getFile(owner, repo, path, ref) {
    const q = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    try {
      const j = await this._req('GET', `/repos/${owner}/${repo}/contents/${encPath(path)}${q}`);
      return { sha: j.sha, text: j.encoding === 'base64' ? b64ToUtf8(j.content) : (j.content || ''), exists: true };
    } catch (err) {
      if (err.status === 404) return { sha: null, text: '', exists: false };
      throw err;
    }
  }

  getRef(owner, repo, branch) {
    return this._req('GET', `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  }

  async createBranch(owner, repo, fromBranch, newBranch) {
    const base = await this.getRef(owner, repo, fromBranch);
    return this._req('POST', `/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/heads/${newBranch}`, sha: base.object.sha,
    });
  }

  putFile(owner, repo, path, { branch, message, contentText, sha }) {
    return this._req('PUT', `/repos/${owner}/${repo}/contents/${encPath(path)}`, {
      message, content: utf8ToB64(contentText), branch, ...(sha ? { sha } : {}),
    });
  }

  openPullRequest(owner, repo, { head, base, title, body }) {
    return this._req('POST', `/repos/${owner}/${repo}/pulls`, { head, base, title, body });
  }
}

/**
 * High-level safe write: create a branch off `baseBranch`, commit the new
 * content to it, and open a PR. Returns the created pull request.
 */
export async function commitViaPullRequest(remote, {
  owner, repo, path, baseBranch, message, contentText, title, body,
}) {
  const branch = `edot-patch-${Date.now().toString(36)}`;
  const existing = await remote.getFile(owner, repo, path, baseBranch); // sha (or null)
  await remote.createBranch(owner, repo, baseBranch, branch);
  await remote.putFile(owner, repo, path, { branch, message, contentText, sha: existing.sha });
  const pr = await remote.openPullRequest(owner, repo, {
    head: branch, base: baseBranch, title: title || message, body: body || '',
  });
  return { branch, pr };
}

// ---- encoding helpers (unicode-safe) ----
function encPath(path) {
  return String(path).replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
}

export function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

export function b64ToUtf8(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
