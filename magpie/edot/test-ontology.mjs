// test-ontology.mjs — the explicit entity/format/action ontology: class hierarchy,
// inherited formats, RDF (Turtle) emission, widget bindings, and integrity.
import { TYPES, FORMATS, WIDGETS, COLLECTIONS, LOCALITY, NS, isA, isType, formatsFor, ancestorsOf, toTurtle } from './js/ontology.js';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

// Class hierarchy + subtype reasoning.
ok('isType recognises known + rejects unknown', isType('SlideDeck') && !isType('Nonsense'));
ok('isA is reflexive and transitive', isA('TextElement', 'TextElement') && isA('TextElement', 'SlideElement') && isA('TextElement', 'Entity'));
ok('isA is not symmetric', !isA('SlideElement', 'TextElement'));
ok('every type ultimately subclasses Entity', Object.keys(TYPES).every((t) => t === 'Entity' || ancestorsOf(t).includes('Entity')));

// Inherited formats: a View is a Table, so inherits Table's serializations.
ok('formatsFor inherits up the hierarchy (View → Table formats)', ['csv', 'sqlite', 'nquads'].every((f) => formatsFor('View').includes(f)));
ok('Calendar serializes to ics', formatsFor('Calendar').includes('ics'));

// Integrity: every referenced format/contained type actually exists.
let integrity = true;
for (const [id, t] of Object.entries(TYPES)) {
  for (const f of t.formats || []) if (!FORMATS[f]) { integrity = false; console.log(`  ${id} → unknown format ${f}`); }
  for (const c of t.contains || []) if (!TYPES[c]) { integrity = false; console.log(`  ${id} → unknown contained type ${c}`); }
  if (t.parent && !TYPES[t.parent]) { integrity = false; console.log(`  ${id} → unknown parent ${t.parent}`); }
}
ok('ontology integrity: all parents/formats/contains resolve', integrity);
ok('widget bindings reference known types', Object.values(WIDGETS).every((tys) => [].concat(tys).every((t) => isType(t))));

// RDF emission.
const ttl = toTurtle({ widgets: WIDGETS, commands: [{ id: 'slides.rotate', title: 'Rotate', category: 'arrange', appliesTo: 'SlideElement' }] });
ok('Turtle declares the namespace', ttl.includes('@prefix edot: <' + NS + '>'));
ok('Turtle emits classes with subClassOf', /edot:Document a rdfs:Class/.test(ttl) && /rdfs:subClassOf edot:Entity/.test(ttl));
ok('Turtle emits hasFormat triples', /edot:Calendar a rdfs:Class[\s\S]*edot:hasFormat edot:ics/.test(ttl));
ok('Turtle emits Format individuals with mime', /edot:ics a edot:Format ;[\s\S]*edot:mime "text\/calendar"/.test(ttl));
ok('Turtle emits widget→type bindings', /edot:edot-place-input a edot:Widget ; edot:editsType edot:Place/.test(ttl));
ok('Turtle emits command→appliesTo bindings', /edot:cmd_slides_rotate a edot:Command[\s\S]*edot:appliesTo edot:SlideElement/.test(ttl));

// Collection/item types (the "windows of items" — files, images, videos, people).
ok('item types subclass File / Entity', isA('Image', 'File') && isA('Video', 'File') && isA('Image', 'Entity') && isA('Person', 'Entity'));
ok('media item types carry formats', formatsFor('Image').includes('png') && formatsFor('Video').includes('mp4') && formatsFor('Audio').includes('mp3'));
ok('locality vocabulary is local|remote', LOCALITY.join(',') === 'local,remote');
ok('collection windows present known item types', Object.values(COLLECTIONS).every((t) => isType(t)) && COLLECTIONS['edot-people'] === 'Person');
const ttl2 = toTurtle({ collections: COLLECTIONS });
ok('Turtle emits relation properties (locality, presentsItemsOf)', /edot:locality a rdf:Property/.test(ttl2) && /edot:presentsItemsOf a rdf:Property/.test(ttl2));
ok('Turtle emits collection→item bindings', /edot:edot-people a edot:CollectionView ; edot:presentsItemsOf edot:Person/.test(ttl2));

console.log(fail ? `\n${fail} ONTOLOGY FAILURE(S)` : '\nONTOLOGY OK');
process.exit(fail ? 1 : 0);
