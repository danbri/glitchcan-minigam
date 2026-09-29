// FINK links: the two-part link id in the address bar, and which story a
// page address asks for. The format is docs/fink-linking-spec: an 8-hex
// hash of the story URL, a hyphen, a 9-hex hash of "#knot", both SHA-256
// with the salt below. The story runner mints the same ids (it keeps its
// own copy of this code, and the two must stay byte-identical).

window.FinkLinks = {
    config: { salt: 'glitchcan-fink-v2', urlHashLength: 8, knotHashLength: 9 },

    async sha256hex(data) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    },

    // Inputs are trimmed before hashing; the knot hash includes the '#'.
    async generateUrlHash(finkUrl) {
        const h = await this.sha256hex(`${this.config.salt}:url:${(finkUrl || '').trim()}`);
        return h.slice(0, this.config.urlHashLength);
    },
    async generateKnotHash(knotName) {
        const h = await this.sha256hex(`${this.config.salt}:knot:#${(knotName || '').trim()}`);
        return h.slice(0, this.config.knotHashLength);
    },
    async generateFinkLinkId(finkUrl, knotName) {
        return `${await this.generateUrlHash(finkUrl)}-${await this.generateKnotHash(knotName)}`;
    },

    // "urlHash-knotHash" → { urlHash, knotHash }, or null.
    parseFinkLinkId(fragmentId) {
        const t = (fragmentId || '').trim();
        if (!t.includes('-')) return null;
        const [urlHash, knotHash] = t.split('-', 2);
        return urlHash && knotHash ? { urlHash: urlHash.trim(), knotHash: knotHash.trim() } : null;
    },

    // The story a page address names: ?story=, #story=, or a #path.fink.js.
    storyFromLocation(loc = window.location) {
        const q = new URLSearchParams(loc.search).get('story');
        if (q) return decodeURIComponent(q);
        const hash = (loc.hash || '').slice(1);
        if (!hash) return null;
        const m = /story=([^&]+)/.exec(hash);
        if (m) return decodeURIComponent(m[1]);
        return hash.endsWith('.fink.js') ? decodeURIComponent(hash) : null;
    },
};
