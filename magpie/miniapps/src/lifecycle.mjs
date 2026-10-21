// MiniApp lifecycle state machines: W3C MiniApp Lifecycle, Discontinued Draft of 2026-08-11.
// https://www.w3.org/TR/miniapp-lifecycle/
//
// Global states: launched, shown, hidden, error, unloaded (events "global<state>").
// Page states:   loaded, ready, shown, hidden, unloaded   (events "page<state>").
// The draft gives no transitions out of "error" and no order between page
// "ready" and "shown"; the choices made here are in magpie/miniapps/README.md.
// No DOM in here: the host drives these and forwards the events.

const GLOBAL_NEXT = {
  initial: ['launched'],
  launched: ['shown', 'hidden', 'error', 'unloaded'],
  shown: ['hidden', 'error', 'unloaded'],
  hidden: ['shown', 'error', 'unloaded'],
  error: ['shown', 'hidden', 'unloaded'],
  unloaded: [],
};

const PAGE_NEXT = {
  initial: ['loaded'],
  loaded: ['ready', 'unloaded'],
  ready: ['shown', 'hidden', 'unloaded'],
  shown: ['hidden', 'unloaded'],
  hidden: ['shown', 'unloaded'],
  unloaded: [],
};

class Machine extends EventTarget {
  #state = 'initial';
  #table;
  #prefix;
  #log = [];

  constructor(table, prefix) {
    super();
    this.#table = table;
    this.#prefix = prefix;
  }

  get state() { return this.#state; }
  /** Every transition taken, as [state, detail] pairs, oldest first. */
  get history() { return this.#log.slice(); }

  can(next) { return this.#table[this.#state].includes(next); }

  /** Move to `next`, fire "<prefix><next>", call on<prefix><next>. Throws on an illegal move. */
  to(next, detail = {}) {
    if (!this.can(next)) {
      throw new Error(`${this.#prefix} lifecycle: ${this.#state} -> ${next} is not allowed`);
    }
    this.#state = next;
    this.#log.push([next, detail]);
    const type = this.#prefix + next;
    const ev = new CustomEvent(type, { detail });
    const handler = this['on' + type];
    if (typeof handler === 'function') handler.call(this, ev);
    this.dispatchEvent(ev);
    return this;
  }

  /** Like `to`, but a no-op (returning false) when the move is not allowed. */
  try(next, detail = {}) {
    if (!this.can(next)) return false;
    this.to(next, detail);
    return true;
  }
}

/** The app-wide machine. `inputObject` is { pagePath, referrerInfo, lang, dir }. */
export class GlobalLifecycle extends Machine {
  constructor() {
    super(GLOBAL_NEXT, 'global');
    this.ongloballaunched = null;
    this.onglobalshown = null;
    this.onglobalhidden = null;
    this.onglobalerror = null;
    this.onglobalunloaded = null;
  }
  get globalState() { return this.state === 'initial' ? null : this.state; }
}

/** One machine per open page. */
export class PageLifecycle extends Machine {
  constructor(route) {
    super(PAGE_NEXT, 'page');
    this.route = route;
    this.onpageloaded = null;
    this.onpageready = null;
    this.onpageshown = null;
    this.onpagehidden = null;
    this.onpageunloaded = null;
  }
  get pageState() { return this.state === 'initial' ? null : this.state; }
}

export const GLOBAL_STATES = Object.freeze(['launched', 'shown', 'hidden', 'error', 'unloaded']);
export const PAGE_STATES = Object.freeze(['loaded', 'ready', 'shown', 'hidden', 'unloaded']);
