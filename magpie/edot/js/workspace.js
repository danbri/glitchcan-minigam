// workspace.js — the composable host. Mounts the existing app components in panes
// that share ONE kernel, so a result produced in the Data pane flows live into
// the Slides pane as a direct in-process capability call — no file, no serialize,
// no second tab. This is the co-located path the cross-tab BroadcastChannel
// handoff can't take. The same components still run standalone on their own pages.
import '../data/data-workspace.js'; // defines <edot-data>
import '../slides/slides-app.js';   // defines <edot-slides>
import './edot-editor.js';          // defines <edot-editor>
import { getKernel } from './edot-kernel.js';

const kernel = getKernel();
const toast = document.getElementById('ws-toast');

let toastTimer = null;
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// Data publishes its result on the shared bus; fan it out to every pane that can
// hold a table. The capabilities are PROVIDED by the components themselves
// (<edot-slides>, <edot-editor>), each routed to its active instance — so the
// host just invokes; one publish populates Slides AND the Editor live, in-process.
kernel.bus.subscribe('data:share', (p) => {
  const toSlides = kernel.capabilities.invoke('slides.addData', p);
  try { kernel.capabilities.invoke('editor.addData', p); } catch (_) { /* editor pane optional */ }
  if (toSlides) showToast(`Added “${p.title || 'Data'}” to Slides & Editor (${(p.rows || []).length} rows) — live, no file`);
});

// Mobile: a tab shows one pane at a time (wide screens show both side by side).
function setPane(name) {
  document.querySelectorAll('.ws-pane').forEach((s) => s.classList.toggle('active', s.dataset.pane === name));
  document.querySelectorAll('.ws-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
}
document.querySelectorAll('.ws-tab').forEach((b) => b.addEventListener('click', () => setPane(b.dataset.tab)));

// Debug/headless-test hook (cf. window.__slides / window.__tftt elsewhere).
window.__ws = { kernel, setPane };
