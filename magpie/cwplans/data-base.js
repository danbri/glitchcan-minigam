// Base URL of the bulk open-data extracts that live in the danbri/londat repository (owner, 2026-10-05): the folders
// feeds/london-datastore/ and feeds/portals/ (data files only; code and READMEs stay here). One constant, DATA_BASE:
// switch it to PAGES when https://danbri.github.io/londat/ answers (GitHub Pages on for londat). raw.githubusercontent.com
// sends Access-Control-Allow-Origin: *. Tools use tools/londat.mjs; rule and file list: skill docklands-data-curation,
// "Data hosted in danbri/londat".
//   CwData.url('feeds/london-datastore/index.json') -> the URL to fetch (a path relative to magpie/cwplans)
//   await CwData.json(path) -> the parsed JSON (a name ending in .gz is gunzipped with DecompressionStream)
(function () {
  const PAGES = 'https://danbri.github.io/londat/cwplans/';
  const RAW = 'https://raw.githubusercontent.com/danbri/londat/main/cwplans/';
  const DATA_BASE = RAW;
  const HOSTED = /^feeds\/(london-datastore|portals)\//, KEEP = /(^|\/)README\.md$|\.js$/;
  // this page's own base (the magpie/cwplans folder), for a path that is not hosted in londat
  const here = (document.currentScript && document.currentScript.src) ? new URL('.', document.currentScript.src).href : '';
  const hosted = path => HOSTED.test(path) && !KEEP.test(path);
  const url = path => (hosted(path) ? DATA_BASE : here) + path;
  async function json(path) {
    const u = url(path), r = await fetch(u);
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    if (!/\.gz$/.test(path)) return r.json();
    return JSON.parse(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text());
  }
  window.CwData = { base: DATA_BASE, pages: PAGES, raw: RAW, hosted, url, json };
})();
