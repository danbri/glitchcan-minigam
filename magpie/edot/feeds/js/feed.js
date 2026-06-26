// feed.js — RSS 2.0 and Atom 1.0 reader. Uses the platform DOMParser (browser),
// so the syndication formats are parsed by a real XML parser rather than by hand.
// Returns a normalized { title, kind, items:[…] } regardless of source dialect.
// (Tested headlessly — DOMParser is a browser API.)

function text(el, sel) {
  if (!el) return '';
  const n = el.querySelector(sel);
  return n ? (n.textContent || '').trim() : '';
}

// Atom <link> can repeat with rel/href; prefer rel="alternate" (or the first).
function atomLink(entry) {
  const links = [...entry.querySelectorAll('link')];
  if (!links.length) return '';
  const alt = links.find((l) => (l.getAttribute('rel') || 'alternate') === 'alternate');
  return (alt || links[0]).getAttribute('href') || '';
}

export function parseFeed(xml) {
  if (typeof DOMParser === 'undefined') throw new Error('feed: DOMParser unavailable (browser only)');
  const doc = new DOMParser().parseFromString(String(xml), 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('feed: not well-formed XML');
  const root = doc.documentElement;
  const tag = (root.localName || root.nodeName || '').toLowerCase();

  if (tag === 'rss' || doc.querySelector('rss > channel')) {
    const channel = doc.querySelector('channel');
    const items = [...doc.querySelectorAll('channel > item')].map((it) => ({
      title: text(it, 'title'),
      link: text(it, 'link'),
      date: text(it, 'pubDate') || text(it, 'date'),
      summary: text(it, 'description'),
      id: text(it, 'guid') || text(it, 'link'),
    }));
    return { title: text(channel, 'title'), kind: 'rss', items };
  }

  if (tag === 'feed') {
    const items = [...doc.querySelectorAll('entry')].map((en) => ({
      title: text(en, 'title'),
      link: atomLink(en),
      date: text(en, 'updated') || text(en, 'published'),
      summary: text(en, 'summary') || text(en, 'content'),
      id: text(en, 'id') || atomLink(en),
    }));
    return { title: text(root, 'title'), kind: 'atom', items };
  }

  throw new Error('feed: unrecognized syndication format (expected RSS or Atom)');
}

// Tabular view for the Data feature.
export function feedToTable(items) {
  const columns = ['Title', 'Date', 'Link'];
  const rows = items.map((i) => [i.title, i.date, i.link]);
  return { columns, rows };
}
