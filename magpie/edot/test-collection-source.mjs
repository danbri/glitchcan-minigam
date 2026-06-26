// test-collection-source.mjs — collections scale by WINDOWED access, and item
// actions resolve once per type (the Mozilla RDF-datasource lesson, enforced).
import { ArrayCollectionSource, VirtualCollectionSource, PagedCollectionSource, actionsForCollection, isCollectionActive } from './js/collection-source.js';
import { CommandRegistry } from './js/command-registry.js';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

// Array source: getRange returns only the window.
const arr = new ArrayCollectionSource('File', Array.from({ length: 1000 }, (_, i) => ({ id: i, label: `file${i}` })));
ok('array source reports its count', arr.count() === 1000);
ok('array source returns only the requested window', arr.getRange(100, 5).map((x) => x.id).join(',') === '100,101,102,103,104');
ok('array source can fetch a single item by id', arr.getItem(42).label === 'file42');

// Virtual source over a HUGE collection — scrolling touches only the window.
let built = 0;
const huge = new VirtualCollectionSource('MailMessage', 1_000_000, (i) => { built++; return { id: i, label: `msg ${i}` }; });
ok('virtual source reports a huge count without materialising', huge.count() === 1_000_000 && built === 0);
const win = huge.getRange(500_000, 5);
ok('virtual source builds ONLY the visible window (5 items, not 1e6)', win.length === 5 && built === 5 && win[0].id === 500_000);
const win2 = huge.getRange(999_998, 50);
ok('virtual source clamps the window at the end', win2.length === 2 && built === 7);

// Paged (async) source — backend returns only the page.
const paged = new PagedCollectionSource('Person', {
  count: async () => 42,
  fetchPage: async (off, lim) => Array.from({ length: Math.min(lim, 42 - off) }, (_, i) => ({ id: off + i, label: `person ${off + i}` })),
});
ok('paged source awaits its count', (await paged.count()) === 42);
ok('paged source fetches only the requested page', (await paged.getRange(40, 10)).length === 2);

// Actions resolve ONCE per item type — not per item, not via a graph walk.
const reg = new CommandRegistry();
let typeLookups = 0;
const origForType = reg.forType.bind(reg);
reg.forType = (t, ctx) => { typeLookups++; return origForType(t, ctx); };
reg.register({ id: 'file.open', title: 'Open', appliesTo: 'File', where: ['item'], run: () => 'open' });
reg.register({ id: 'file.rename', title: 'Rename', appliesTo: 'File', where: ['item'], run: () => 'rename' });
reg.register({ id: 'global.help', title: 'Help', run: () => 'help' }); // global — not an item action

const actions = actionsForCollection(arr, reg);
ok('item actions resolve by type (the File commands, not the global)', actions.map((c) => c.id).sort().join(',') === 'file.open,file.rename');
ok('resolving a 1000-item collection cost ONE type lookup, not 1000', typeLookups === 1);
ok('a File collection is active (has type-specific actions)', isCollectionActive(arr, reg));

// Audio is a File subtype, so it INHERITS File's actions (ontology working).
ok('an Audio collection inherits File actions (subtype)', isCollectionActive(new ArrayCollectionSource('Audio', []), reg));
// A type that is neither acted-on nor a File is purely passive data.
const passive = new ArrayCollectionSource('Calendar', [{ id: 1, label: 'work' }]);
ok('a collection with no applicable type-specific command is passive', !isCollectionActive(passive, reg) && actionsForCollection(passive, reg).length === 0);

console.log(fail ? `\n${fail} COLLECTION-SOURCE FAILURE(S)` : '\nCOLLECTION-SOURCE OK');
process.exit(fail ? 1 : 0);
