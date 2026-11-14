/** Finite history structures, compiled from a DAG of generating dependencies.
 *
 * A node denotes the tuple (place, event, downward-closed past), not an
 * occurrence with an opaque identity. Equal tuples are hash-consed. Times are
 * interned sets of canonical tuples, represented by arbitrary-width bitsets.
 * No library, global state, or browser dependency is needed.
 */

export class ModelError extends Error {
  constructor(message) { super(message); this.name = 'ModelError'; }
}

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ModelError(`${label} must be an object.`);
  return value;
}
function fields(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new ModelError(`${label}: unknown field ${JSON.stringify(key)}.`);
}
function string(value, label) {
  if (typeof value !== 'string' || !value.length) throw new ModelError(`${label} must be a nonempty string.`);
  return value;
}
function strings(value, label, nonempty = false) {
  if (!Array.isArray(value) || (nonempty && !value.length)) throw new ModelError(`${label} must be ${nonempty ? 'a nonempty' : 'an'} array.`);
  const seen = new Set();
  for (const item of value) {
    string(item, `${label} entry`);
    if (seen.has(item)) throw new ModelError(`${label} contains duplicate ${JSON.stringify(item)}.`);
    seen.add(item);
  }
  return [...value];
}

/** Normalize a ground event/atom. null is reserved for the dagger maybe-event. */
export function normalizeEvent(value, { allowNull = true, label = 'event' } = {}) {
  if (value === null && allowNull) return null;
  if (typeof value === 'string') return Object.freeze({ symbol: string(value, label), args: Object.freeze([]) });
  fields(value, ['symbol', 'args'], label);
  string(value.symbol, `${label}.symbol`);
  if (!Array.isArray(value.args)) throw new ModelError(`${label}.args must be an array.`);
  const args = value.args.map((v, i) => string(v, `${label}.args[${i}]`));
  return Object.freeze({ symbol: value.symbol, args: Object.freeze(args) });
}

/** Collision-free canonical representation; symbols and arguments are strings. */
export function eventKey(value) { return value === null ? 'null' : JSON.stringify([value.symbol, ...value.args]); }

/** Upward-closed families are represented by their inclusion-minimal members.
 * This also applies to the families of quorum intersections used by modalities.
 * In particular, the empty set is retained and subsumes every other set.
 */
export function minimizeMasks(input, tick = () => {}) {
  const unique = [...new Set(input)];
  if (unique.includes(0n)) return [0n];
  // A proper subset has a smaller unsigned numeric mask, so sorting means a
  // later entry can never remove an earlier minimal entry.
  unique.sort((a, b) => { tick(); return a < b ? -1 : a > b ? 1 : 0; });
  const minimal = [];
  for (const m of unique) {
    let redundant = false;
    for (const n of minimal) { tick(); if ((m & n) === n) { redundant = true; break; } }
    if (!redundant) minimal.push(m);
  }
  return minimal;
}

export class HistoryModel {
  constructor(data) {
    fields(data, ['format', 'name', 'participants', 'values', 'signature', 'nodes', 'quorums', 'facts'], 'model');
    if (data.format !== 'history-structure-model/v1') throw new ModelError('model.format must be "history-structure-model/v1".');
    if (own(data, 'name')) string(data.name, 'model.name');
    this.name = data.name || 'Untitled history';
    this.participants = Object.freeze(strings(data.participants, 'participants', true));
    this.values = Object.freeze(strings(data.values, 'values', true));
    this.placeIndex = new Map(this.participants.map((p, i) => [p, i]));
    this.valueSet = new Set(this.values);
    fields(data.signature, ['events', 'predicates'], 'signature');
    this.signature = Object.freeze({
      events: Object.freeze(strings(data.signature.events, 'signature.events')),
      predicates: Object.freeze(strings(data.signature.predicates, 'signature.predicates')),
    });
    this.eventSymbols = new Set(this.signature.events);
    this.predicateSymbols = new Set(this.signature.predicates);
    for (const s of this.eventSymbols) if (this.predicateSymbols.has(s)) throw new ModelError(`Signature symbol ${JSON.stringify(s)} is both an event and a predicate.`);
    this.allPlacesMask = (1n << BigInt(this.participants.length)) - 1n;
    this.quorums = new Map();
    object(data.quorums, 'quorums');
    for (const v of Object.keys(data.quorums)) if (!this.valueSet.has(v)) throw new ModelError(`quorums has unknown value ${JSON.stringify(v)}.`);
    for (const v of this.values) {
      if (!own(data.quorums, v) || !Array.isArray(data.quorums[v]) || !data.quorums[v].length) throw new ModelError(`quorums[${JSON.stringify(v)}] must be a nonempty family.`);
      const bases = data.quorums[v].map((q, i) => {
        const places = strings(q, `quorums[${JSON.stringify(v)}][${i}]`, true);
        let mask = 0n;
        for (const p of places) { this.requirePlace(p); mask |= 1n << BigInt(this.placeIndex.get(p)); }
        return mask;
      });
      for (let i = 0; i < bases.length; i++) for (let j = i + 1; j < bases.length; j++) {
        if ((bases[i] & bases[j]) === 0n) throw new ModelError(`Learner ${JSON.stringify(v)} has disjoint quorums; its family is not a semifilter (Definition 3.3.2).`);
      }
      this.quorums.set(v, Object.freeze(minimizeMasks(bases)));
    }

    const rawNodes = data.nodes ?? [];
    if (!Array.isArray(rawNodes)) throw new ModelError('nodes must be an array.');
    const rawById = new Map();
    for (const raw of rawNodes) {
      fields(raw, ['id', 'place', 'event', 'past'], 'node');
      string(raw.id, 'node.id');
      if (['end', 'empty', '*'].includes(raw.id) || raw.id.startsWith('@')) throw new ModelError(`Node ID ${JSON.stringify(raw.id)} is reserved; use another ID.`);
      if (rawById.has(raw.id)) throw new ModelError(`Duplicate node ID ${JSON.stringify(raw.id)}.`);
      this.requirePlace(raw.place);
      if (!own(raw, 'event')) throw new ModelError(`Node ${JSON.stringify(raw.id)} must specify event (use null for dagger).`);
      const event = normalizeEvent(raw.event, { label: `node ${JSON.stringify(raw.id)} event` });
      this.requireGround(event, 'event');
      const past = strings(raw.past ?? [], `node ${JSON.stringify(raw.id)} past`);
      rawById.set(raw.id, { ...raw, event, past });
    }

    // Kahn's algorithm accepts forward references and avoids a call-stack limit
    // on long histories. Canonical indices are necessarily topological.
    const pending = new Map(), dependents = new Map();
    for (const raw of rawById.values()) {
      pending.set(raw.id, raw.past.length);
      for (const id of raw.past) {
        if (!rawById.has(id)) throw new ModelError(`Node ${JSON.stringify(raw.id)} refers to unknown past node ${JSON.stringify(id)}.`);
        if (!dependents.has(id)) dependents.set(id, []);
        dependents.get(id).push(raw.id);
      }
    }
    const queue = [...rawById.keys()].filter(id => pending.get(id) === 0);
    this.nodes = [];
    this.aliases = new Map();
    const tupleMap = new Map();
    for (let next = 0; next < queue.length; next++) {
      const raw = rawById.get(queue[next]);
      let past = 0n;
      for (const id of raw.past) {
        const parent = this.aliases.get(id);
        past |= parent.past | parent.bit;
      }
      const key = JSON.stringify([raw.place, eventKey(raw.event)]);
      if (!tupleMap.has(key)) tupleMap.set(key, new Map());
      const byHistory = tupleMap.get(key);
      let node = byHistory.get(past);
      if (node) node.aliases.push(raw.id);
      else {
        const index = this.nodes.length;
        node = { id: raw.id, aliases: [raw.id], index, bit: 1n << BigInt(index), place: raw.place, event: raw.event, past, timeIndex: -1 };
        this.nodes.push(node);
        byHistory.set(past, node);
      }
      this.aliases.set(raw.id, node);
      for (const id of dependents.get(raw.id) || []) {
        pending.set(id, pending.get(id) - 1);
        if (pending.get(id) === 0) queue.push(id);
      }
    }
    if (queue.length !== rawById.size) {
      const cycle = [...pending].filter(([, count]) => count > 0).map(([id]) => id);
      throw new ModelError(`The event DAG contains a cycle involving ${cycle.slice(0, 8).map(JSON.stringify).join(', ')}.`);
    }

    this.times = [];
    this.timeByMask = new Map();
    const internTime = mask => {
      if (this.timeByMask.has(mask)) return this.timeByMask.get(mask);
      const index = this.times.length;
      // Histories may contain thousands of tuples. Materializing every time as
      // a string array would destroy the compact DAG representation on chains.
      const model = this;
      const time = { index, id: `@t${index}`, mask, get nodeIds() { return model.nodes.filter(n => (n.bit & mask) !== 0n).map(n => n.id); } };
      this.times.push(time);
      this.timeByMask.set(mask, time);
      return time;
    };
    for (const node of this.nodes) node.timeIndex = internTime(node.past).index;
    this.fullTime = internTime((1n << BigInt(this.nodes.length)) - 1n);
    this.emptyTime = this.timeByMask.get(0n);
    this._timeById = new Map(this.times.map(t => [t.id, t]));
    this._at = new Map();
    this._localNodes = new Map(this.participants.map(p => [p, []]));
    this._eventsAt = new Map();
    for (const node of this.nodes) {
      this._localNodes.get(node.place).push(node);
      if (node.event !== null) {
        const key = JSON.stringify([node.place, node.timeIndex]);
        if (!this._eventsAt.has(key)) this._eventsAt.set(key, []);
        this._eventsAt.get(key).push(node.event);
      }
    }
    this._tuples = new Map();
    for (const node of this.nodes) this._tuples.set(this.tupleKey(node.place, node.timeIndex, node.event), node);
    this._facts = new Map();
    const facts = data.facts ?? [];
    if (!Array.isArray(facts)) throw new ModelError('facts must be an array.');
    for (const fact of facts) {
      fields(fact, ['place', 'at', 'atom'], 'fact');
      this.requirePlace(fact.place);
      const atom = normalizeEvent(fact.atom, { allowNull: false, label: 'fact.atom' });
      this.requireGround(atom, 'predicate');
      let selectors = Array.isArray(fact.at) ? fact.at : [fact.at];
      if (!selectors.length) throw new ModelError('fact.at array must be nonempty.');
      const indices = new Set();
      for (const selector of selectors) {
        if (selector === '*') for (const t of this.times) indices.add(t.index);
        else indices.add(this.resolveTime(selector).index);
      }
      for (const index of indices) {
        const key = JSON.stringify([fact.place, index]);
        if (!this._facts.has(key)) this._facts.set(key, new Set());
        this._facts.get(key).add(eventKey(atom));
      }
    }
    this._seq = new Map();
    for (const node of this.nodes) { Object.freeze(node.aliases); Object.freeze(node); }
    for (const time of this.times) Object.freeze(time);
    Object.freeze(this.nodes);
    Object.freeze(this.times);
    this.rawNodeCount = rawNodes.length;
  }

  requirePlace(place) {
    if (typeof place !== 'string' || !this.placeIndex.has(place)) throw new ModelError(`Unknown participant ${JSON.stringify(place)}.`);
    return place;
  }
  requireGround(atom, kind = 'event') {
    if (atom === null && kind === 'event') return;
    if (atom === null) throw new ModelError('A predicate cannot be null.');
    const symbols = kind === 'event' ? this.eventSymbols : this.predicateSymbols;
    if (!symbols.has(atom.symbol)) throw new ModelError(`Unknown ${kind} symbol ${JSON.stringify(atom.symbol)}.`);
    for (const value of atom.args) if (!this.valueSet.has(value)) throw new ModelError(`Unknown value ${JSON.stringify(value)} in ${kind} ${JSON.stringify(atom.symbol)}.`);
  }
  resolveTime(selector = 'end') {
    if (selector === 'end') return this.fullTime;
    if (selector === 'empty') return this.emptyTime;
    if (typeof selector !== 'string') throw new ModelError('Time must be "end", "empty", a node ID, or a represented @tN ID.');
    if (this._timeById.has(selector)) return this._timeById.get(selector);
    if (this.aliases.has(selector)) return this.times[this.aliases.get(selector).timeIndex];
    throw new ModelError(`Unknown time ${JSON.stringify(selector)}.`);
  }
  /** Return an internal world. Its event need not occur at this place/time. */
  world(input = {}) {
    object(input, 'world');
    const { place = this.participants[0], time = 'end', event = null } = input;
    this.requirePlace(place);
    const t = this.resolveTime(time);
    const e = normalizeEvent(event);
    this.requireGround(e);
    return { place, timeIndex: t.index, event: e };
  }
  describeWorld(world) {
    const time = this.times[world.timeIndex];
    const node = this._tuples.get(this.tupleKey(world.place, world.timeIndex, world.event));
    return { place: world.place, time: time.id, timeLabel: time === this.fullTime ? 'end' : time.mask === 0n ? 'empty' : time.id, event: world.event, node: node?.id ?? null, history: [...time.nodeIds] };
  }
  tupleKey(place, timeIndex, event) { return JSON.stringify([place, timeIndex, eventKey(event)]); }
  hasTuple(place, timeIndex, event) { return this._tuples.has(this.tupleKey(place, timeIndex, event)); }
  hasFact(place, timeIndex, atom) { return this._facts.get(JSON.stringify([place, timeIndex]))?.has(eventKey(atom)) ?? false; }
  nodesAt(timeIndex, place) {
    const key = JSON.stringify([place, timeIndex]);
    if (this._at.has(key)) return this._at.get(key);
    const mask = this.times[timeIndex].mask;
    const nodes = this._localNodes.get(place).filter(n => (n.bit & mask) !== 0n);
    // A bounded LRU-like cache avoids quadratic retained arrays on long chains.
    if (this._at.size >= 256) this._at.delete(this._at.keys().next().value);
    this._at.set(key, nodes);
    return nodes;
  }
  isSequential(timeIndex, place) {
    const key = JSON.stringify([place, timeIndex]);
    if (this._seq.has(key)) return this._seq.get(key);
    const nodes = this.nodesAt(timeIndex, place);
    // Their indices are topological. A chain is exactly one where each tuple
    // sees the immediately preceding local tuple; transitivity gives the rest.
    let sequential = true;
    for (let i = 1; i < nodes.length; i++) if ((nodes[i].past & nodes[i - 1].bit) === 0n) { sequential = false; break; }
    this._seq.set(key, sequential);
    return sequential;
  }
  /** Exact representatives of every observationally distinct possible world.
   * Any non-occurring maybe-event behaves like null for all formulas in this
   * language. This avoids enumerating the (potentially infinite) event domain.
   */
  *worlds(scope = 'all') {
    if (!['all', 'end'].includes(scope)) throw new ModelError(`Unknown world scope ${JSON.stringify(scope)}.`);
    const times = scope === 'end' ? [this.fullTime] : this.times;
    for (const time of times) for (const place of this.participants) {
      yield { place, timeIndex: time.index, event: null };
      if (scope === 'all') for (const event of this._eventsAt.get(JSON.stringify([place, time.index])) || []) yield { place, timeIndex: time.index, event };
    }
  }
}

export function compileModel(data) { return new HistoryModel(data); }
