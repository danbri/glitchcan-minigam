// pkce.js — PKCE (RFC 7636) primitives plus the random nonces the OIDC client
// needs. Everything here is pure Web Crypto: no external libraries, no Node
// shims, so it runs unchanged in the browser on GitHub Pages.
//
// PKCE ("Proof Key for Code Exchange") lets a public client (no client secret,
// because anything shipped to the browser is public) prove that the party
// redeeming the authorization code is the same party that started the flow.
// We send S256( code_verifier ) up front as the code_challenge and reveal the
// raw code_verifier only at the token endpoint.

// ---- base64url (no '=' padding, '+'→'-', '/'→'_'), the RFC 4648 §5 form ----
export function base64urlEncode(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  const chunk = 0x8000; // avoid call-stack blowups on large inputs
  for (let i = 0; i < arr.length; i += chunk) {
    bin += String.fromCharCode.apply(null, arr.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlDecodeToString(b64url) {
  return new TextDecoder().decode(base64urlDecodeToBytes(b64url));
}

export function base64urlDecodeToBytes(b64url) {
  let s = String(b64url).replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  // Restore '=' padding to a multiple of 4 so atob accepts it.
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---- random tokens --------------------------------------------------------
// The code_verifier charset is the RFC 7636 "unreserved" set:
//   [A-Z] [a-z] [0-9] '-' '.' '_' '~'  — length 43..128.
const VERIFIER_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

// A crypto-random string drawn from `charset`. Uses rejection sampling so the
// distribution stays uniform (no modulo bias).
export function randomString(length = 64, charset = VERIFIER_CHARS) {
  const out = [];
  const max = Math.floor(256 / charset.length) * charset.length;
  const buf = new Uint8Array(1);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    if (buf[0] < max) out.push(charset[buf[0] % charset.length]);
  }
  return out.join('');
}

// A code_verifier of `length` chars (default 64, comfortably inside 43..128).
export function generateCodeVerifier(length = 64) {
  const n = Math.min(128, Math.max(43, length | 0));
  return randomString(n);
}

// S256 challenge: base64url( SHA-256( ASCII(code_verifier) ) ).
export async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(new Uint8Array(digest));
}

// Opaque CSRF state and replay-guard nonce. 32 url-safe chars ≈ 190 bits.
export function generateState() { return randomString(32); }
export function generateNonce() { return randomString(32); }

// Convenience: one call returns the full PKCE bundle a flow needs to launch.
export async function createPkcePair() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
    state: generateState(),
    nonce: generateNonce(),
  };
}
