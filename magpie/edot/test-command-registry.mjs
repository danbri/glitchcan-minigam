// test-command-registry.mjs — the registry's core contract, including the new
// ontology applies-to typing and the shared singleton. Pure Node.
import { CommandRegistry, getRegistry } from './js/command-registry.js';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

const reg = new CommandRegistry();
let ran = null;
reg.register({ id: 'a.do', title: 'Do A', group: '1', run: (ctx, args) => { ran = args; return 'didA'; } });
reg.register({ id: 'a.gated', title: 'Gated', when: (ctx) => ctx.app === 'a', run: () => 'gated' });

ok('register + get + has', reg.has('a.do') && reg.get('a.do').title === 'Do A');
ok('run() returns the command result', reg.run('a.do', {}, { x: 1 }) === 'didA' && ran.x === 1);
let threw = false; try { reg.run('nope'); } catch { threw = true; }
ok('run() throws on unknown command', threw);
ok('run() respects when() (returns false when gated out)', reg.run('a.gated', { app: 'b' }) === false);
ok('run() runs when when() passes', reg.run('a.gated', { app: 'a' }) === 'gated');

// when() filters contributions/search.
ok('contributions honour when(ctx)', reg.contributions({ app: 'b' }).every((c) => c.id !== 'a.gated'));
ok('search filters by title/keywords/id', reg.search('Do A').some((c) => c.id === 'a.do') && !reg.search('zzz').length);

// ---- ontology applies-to typing ----
reg.register({ id: 'el.rotate', title: 'Rotate', appliesTo: 'SlideElement', run: () => 'rot' });
reg.register({ id: 'el.fill', title: 'Fill', appliesTo: 'ShapeElement', run: () => 'fill' });
reg.register({ id: 'global.help', title: 'Help', run: () => 'help' });

const forText = reg.forType('TextElement').map((c) => c.id);
ok('forType offers commands for the type and its supertypes', forText.includes('el.rotate'));   // TextElement isA SlideElement
ok('forType excludes commands for sibling/sub types', !forType_has(reg, 'TextElement', 'el.fill')); // ShapeElement is not a supertype of TextElement
ok('forType always includes global (no appliesTo) commands', forText.includes('global.help'));
const forShape = reg.forType('ShapeElement').map((c) => c.id);
ok('a ShapeElement gets both element-level and shape-level commands', forShape.includes('el.rotate') && forShape.includes('el.fill'));

// ---- menu locations (VSCode-style contribution points) ----
reg.register({ id: 'item.open', title: 'Open', appliesTo: 'File', where: ['item', 'palette'], run: () => 'open' });
reg.register({ id: 'tb.only', title: 'Toolbar only', where: ['toolbar'], run: () => 'tb' });
ok('commands default to the palette location', reg.menusFor('palette').some((c) => c.id === 'a.do'));
ok('menusFor("item") returns only item-surfaced commands', reg.menusFor('item').some((c) => c.id === 'item.open') && !reg.menusFor('item').some((c) => c.id === 'a.do'));
ok('a toolbar-only command is absent from the palette', !reg.menusFor('palette').some((c) => c.id === 'tb.only'));

// ---- passive vs active is emergent (type-specific commands only) ----
ok('a type with a type-specific command is actionable', reg.actionable('File') && reg.actionable('TextElement'));
ok('a type with only global commands is passive (not actionable)', !reg.actionable('Calendar'));

// audit hook fires on run.
const audited = []; reg.onAudit((e) => audited.push(e.id));
reg.run('a.do');
ok('audit hook records invocations', audited.includes('a.do'));

// shared singleton.
ok('getRegistry returns a stable singleton', getRegistry() === getRegistry());

function forType_has(r, type, id) { return r.forType(type).some((c) => c.id === id); }

console.log(fail ? `\n${fail} COMMAND-REGISTRY FAILURE(S)` : '\nCOMMAND-REGISTRY OK');
process.exit(fail ? 1 : 0);
