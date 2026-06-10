#!/usr/bin/env bash
# Mirror danbri's CodePen pens listed in slugs.txt into pens/<slug>/.
# Run from an unrestricted network (codepen.io is Cloudflare-protected and
# blocks plain curl from some egresses; a residential/dev machine works).
set -euo pipefail
cd "$(dirname "$0")"

USER="danbri"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

while read -r slug; do
  [ -z "$slug" ] && continue
  dest="pens/$slug"
  if [ -e "$dest/index.html" ] || [ -e "$dest/pen.json" ]; then
    echo "SKIP $slug (already mirrored)"
    continue
  fi
  mkdir -p "$dest"
  echo "FETCH $slug"

  # 1) Official zip export
  if curl -sfL -A "$UA" "https://codepen.io/$USER/share/zip/$slug" -o "$dest/pen.zip" \
     && file "$dest/pen.zip" | grep -qi zip; then
    (cd "$dest" && unzip -oq pen.zip && rm pen.zip)
    echo "  ok (zip export)"
    continue
  fi
  rm -f "$dest/pen.zip"

  # 2) Pen page scrape: the page embeds the pen JSON in window.__item
  if curl -sfL -A "$UA" "https://codepen.io/$USER/pen/$slug" -o "$dest/page.html"; then
    node - "$dest" <<'EOF'
const fs = require('fs');
const dir = process.argv[2];
const html = fs.readFileSync(dir + '/page.html', 'utf8');
const m = html.match(/window\.__item\s*=\s*(\{.*?\});\s*\n/s);
if (!m) { console.error('  no __item payload found; left page.html for manual extraction'); process.exit(0); }
const item = JSON.parse(m[1]);
fs.writeFileSync(dir + '/pen.json', JSON.stringify(item, null, 2));
if (item.html) fs.writeFileSync(dir + '/index.html', item.html);
if (item.css)  fs.writeFileSync(dir + '/style.css', item.css);
if (item.js)   fs.writeFileSync(dir + '/script.js', item.js);
console.log('  ok (page scrape)');
EOF
    continue
  fi

  echo "  FAILED $slug — fetch blocked; try a browser session and File > Export .zip"
done < slugs.txt
