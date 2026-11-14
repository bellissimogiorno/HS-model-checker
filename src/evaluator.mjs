/** Exact finite-model evaluator for Figures 2--5 of hbb-disc.
 *
 * Quantification is over values; learners use that same domain. Predicate
 * interpretations do not depend on the current event. Modal jumps preserve or
 * reset that event exactly as specified in Figure 3.
 */
import { HistoryModel, ModelError, eventKey, minimizeMasks, normalizeEvent } from './model.mjs';

export class EvaluationLimitError extends Error {
  constructor(message, stats) {
    super(message); this.name = 'EvaluationLimitError'; this.code = 'INCOMPLETE'; this.stats = stats;
  }
}

const unary = new Set(['not', 'past', 'allpast', 'end', 'sometime', 'everytime']);
const binary = new Set(['and', 'or', 'implies', 'iff']);
const quantified = new Set(['forall', 'exists', 'exists01', 'exists1']);
const now = () => globalThis.performance?.now?.() ?? Date.now();

export class Evaluator {
  constructor(model, { maxSteps = 5_000_000, maxMilliseconds = 15_000, maxMemoEntries = 100_000 } = {}) {
    if (!(model instanceof HistoryModel)) throw new ModelError('Evaluator needs a compiled HistoryModel; use compileModel(data).');
    if (!Number.isSafeInteger(maxSteps) || maxSteps < 1) throw new ModelError('maxSteps must be a positive safe integer.');
    if (!Number.isFinite(maxMilliseconds) || maxMilliseconds <= 0) throw new ModelError('maxMilliseconds must be a positive finite number.');
    if (!Number.isSafeInteger(maxMemoEntries) || maxMemoEntries < 1) throw new ModelError('maxMemoEntries must be a positive safe integer.');
    this.model = model;
    this.maxSteps = maxSteps;
    this.maxMilliseconds = maxMilliseconds;
    this.maxMemoEntries = maxMemoEntries;
    this.memo = new Map();
    this._astIds = new WeakMap();
    this._nextId = 0;
    this._families = new Map([[JSON.stringify([]), [model.allPlacesMask]]]);
    this._started = now();
    this._steps = 0;
    this._memoHits = 0;
    this._memoEvictions = 0;
  }

  get stats() {
    return { steps: this._steps, memoHits: this._memoHits, memoEntries: this.memo.size, memoEvictions: this._memoEvictions, elapsedMs: Math.max(0, now() - this._started) };
  }

  _start() {
    this._started = now(); this._steps = 0; this._memoHits = 0; this._memoEvictions = 0;
    // Public ASTs are ordinary objects and may be edited between checks.
    this.memo.clear();
  }
  _tick() {
    this._steps++;
    if (this._steps > this.maxSteps) throw new EvaluationLimitError(`Evaluation stopped after ${this.maxSteps} steps; result is incomplete.`, this.stats);
    if ((this._steps & 63) === 1 && now() - this._started > this.maxMilliseconds) throw new EvaluationLimitError(`Evaluation exceeded ${this.maxMilliseconds} ms; result is incomplete.`, this.stats);
  }

  _environment(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ModelError('Environment must be an object or Map.');
    const env = input instanceof Map ? new Map(input) : new Map(Object.entries(input));
    for (const [key, value] of env) {
      if (typeof key !== 'string' || !key.length) throw new ModelError('Variable names must be nonempty strings.');
      if (!this.model.valueSet.has(value)) throw new ModelError(`Unknown environment value ${JSON.stringify(value)} for ${JSON.stringify(key)}.`);
    }
    return env;
  }

  _validate(ast, env) {
    // Explicit stack makes validation independent of the JavaScript recursion
    // limit and rejects cyclic/unreasonably deep programmatically supplied ASTs.
    const stack = [{ ast, bound: new Set(env.keys()), depth: 0 }];
    const term = (t, bound) => {
      this._tick();
      if (!t || typeof t !== 'object' || Array.isArray(t)) throw new ModelError('Malformed formula term.');
      if (t.type === 'value') {
        if (!this.model.valueSet.has(t.value)) throw new ModelError(`Formula mentions unknown value ${JSON.stringify(t.value)}.`);
      } else if (t.type === 'var') {
        if (!bound.has(t.name)) throw new ModelError(`Free variable ${JSON.stringify(t.name)}; close the formula with a quantifier.`);
      } else throw new ModelError(`Unknown term type ${JSON.stringify(t.type)}.`);
    };
    let count = 0;
    while (stack.length) {
      this._tick();
      const { ast: a, bound, depth } = stack.pop();
      if (!a || typeof a !== 'object' || Array.isArray(a) || depth > 400 || ++count > 100_000) throw new ModelError('Malformed, cyclic, or excessively deep formula (maximum depth 400).');
      const push = (child, bindings = bound) => stack.push({ ast: child, bound: bindings, depth: depth + 1 });
      if (['true', 'false', 'seq'].includes(a.type)) continue;
      if (a.type === 'atom') {
        if (!this.model.eventSymbols.has(a.symbol) && !this.model.predicateSymbols.has(a.symbol)) throw new ModelError(`Formula has unknown symbol ${JSON.stringify(a.symbol)}.`);
        if (!Array.isArray(a.args)) throw new ModelError('Atom arguments must be an array.');
        for (const t of a.args) term(t, bound);
      } else if (a.type === 'eq') { term(a.left, bound); term(a.right, bound); }
      else if (unary.has(a.type)) push(a.body);
      else if (binary.has(a.type)) { push(a.left); push(a.right); }
      else if (quantified.has(a.type)) {
        if (typeof a.variable !== 'string' || !a.variable.length) throw new ModelError('Quantifier variable must be a nonempty string.');
        push(a.body, new Set([...bound, a.variable]));
      } else if (a.type === 'dia' || a.type === 'box') {
        if (!Array.isArray(a.learners)) throw new ModelError('Modality learners must be an array.');
        for (const t of a.learners) term(t, bound);
        push(a.body);
      } else throw new ModelError(`Unknown formula node ${JSON.stringify(a.type)}.`);
    }
  }

  _world(input) {
    if (input !== undefined && (!input || typeof input !== 'object' || Array.isArray(input))) throw new ModelError('World must be an object.');
    if (input && Object.hasOwn(input, 'timeIndex')) {
      if (!Number.isInteger(input.timeIndex)) throw new ModelError('World timeIndex must be an integer.');
      this.model.requirePlace(input.place);
      if (input.timeIndex < 0 || input.timeIndex >= this.model.times.length) throw new ModelError('World has an unknown time index.');
      const event = normalizeEvent(input.event ?? null);
      this.model.requireGround(event);
      return { place: input.place, timeIndex: input.timeIndex, event };
    }
    return this.model.world(input);
  }

  /** Evaluate at one possible world (default: first participant at end, dagger).
   * Passing an environment is useful for programmatic exploration; UI/theory
   * checks should normally use closed formulas.
   */
  evaluate(ast, world, environment = {}) {
    this._start();
    const env = this._environment(environment);
    this._validate(ast, env);
    return this._eval(ast, this._world(world), env);
  }

  /** Validate a formula against this model's signature/domain, without testing
   * any possible world. Useful before launching an exploration job. */
  validate(ast, environment = {}) {
    this._start();
    this._validate(ast, this._environment(environment));
    return true;
  }

  /** Explain one world judgement. The truth value is computed conclusively
   * before constructing a bounded tree, so a truncated explanation cannot turn
   * a partial search into a positive logical result.
   *
   * `partial` means some explanatory branches were omitted. It does not weaken
   * the root `holds` value. World descriptors omit full history arrays to keep
   * the trace compact even for a large DAG.
   */
  explain(ast, world, { maxNodes = 80, maxDepth = 12 } = {}) {
    if (!Number.isSafeInteger(maxNodes) || maxNodes < 1 || maxNodes > 10_000) throw new ModelError('Explanation maxNodes must be between 1 and 10000.');
    if (!Number.isSafeInteger(maxDepth) || maxDepth < 0 || maxDepth > 100) throw new ModelError('Explanation maxDepth must be between 0 and 100.');
    this._start();
    const bindings = new Map();
    this._validate(ast, bindings);
    const at = this._world(world);
    const holds = this._eval(ast, at, bindings);
    const model = this.model;
    let count = 0, partial = false, root;
    const compactWorld = w => {
      const time = model.times[w.timeIndex];
      const node = model._tuples.get(model.tupleKey(w.place, w.timeIndex, w.event));
      return { place: w.place, time: time.id, timeLabel: time === model.fullTime ? 'end' : time.mask === 0n ? 'empty' : time.id, event: w.event, node: node?.id ?? null };
    };
    const nodeWorld = n => ({ place: n.place, timeIndex: n.timeIndex, event: n.event });
    const shortList = items => items.slice(0, 20);
    const maskPlaces = mask => model.participants.filter((_, i) => (mask & (1n << BigInt(i))) !== 0n);
    const build = (a, w, env, depth) => {
      const result = this._eval(a, w, env);
      const out = { type: a.type, holds: result, reason: '', world: compactWorld(w), bindings: Object.fromEntries(env), children: [] };
      count++;
      root ??= out;
      const add = (child, where = w, bound = env) => {
        if (count >= maxNodes || depth >= maxDepth) { partial = true; out.partial = true; return; }
        out.children.push(build(child, where, bound, depth + 1));
      };
      const test = (child, where = w, bound = env) => this._eval(child, where, bound);
      switch (a.type) {
        case 'true': out.reason = 'Truth holds at every world.'; break;
        case 'false': out.reason = 'Falsehood holds at no world.'; break;
        case 'eq': {
          const left = this._term(a.left, env), right = this._term(a.right, env);
          out.details = { left, right };
          out.reason = result ? 'The two terms denote the same value.' : 'The two terms denote different values.';
          break;
        }
        case 'atom': {
          const atom = this._atom(a, env);
          out.details = { atom };
          if (model.eventSymbols.has(a.symbol)) {
            const matches = eventKey(w.event) === eventKey(atom);
            const occurs = model.hasTuple(w.place, w.timeIndex, atom);
            out.details.currentEvent = w.event;
            out.details.tupleOccurs = occurs;
            out.reason = result ? 'The current event matches, and its exact tuple occurs in the history.'
              : !matches ? 'The current maybe-event does not match this event atom.'
              : 'The matching event tuple does not occur at this place and time in the history.';
          } else out.reason = result ? 'The predicate interpretation contains this atom here.' : 'The predicate interpretation does not contain this atom here.';
          break;
        }
        case 'seq': {
          out.reason = result ? 'All local tuples in this history are causally ordered.' : 'Two local tuples in this history are causally incomparable.';
          if (!result) {
            const local = model.nodesAt(w.timeIndex, w.place);
            for (let i = 1; i < local.length; i++) {
              this._tick();
              if ((local[i].past & local[i - 1].bit) === 0n) {
                out.details = { incomparable: [compactWorld(nodeWorld(local[i - 1])), compactWorld(nodeWorld(local[i]))] };
                break;
              }
            }
          }
          break;
        }
        case 'not': out.reason = result ? 'The subformula is false.' : 'The subformula is true.'; add(a.body); break;
        case 'implies': {
          const left = test(a.left);
          out.reason = !left ? 'The antecedent is false, so the implication holds.' : result ? 'The antecedent and consequent both hold.' : 'The antecedent holds but the consequent is false.';
          add(a.left);
          if (left) add(a.right);
          break;
        }
        case 'and': {
          out.reason = result ? 'Both conjuncts hold.' : 'A conjunct is false.';
          if (result) { add(a.left); add(a.right); }
          else add(test(a.left) ? a.right : a.left);
          break;
        }
        case 'or': {
          out.reason = result ? 'A disjunct holds.' : 'Both disjuncts are false.';
          if (result) add(test(a.left) ? a.left : a.right);
          else { add(a.left); add(a.right); }
          break;
        }
        case 'iff': out.reason = result ? 'Both sides have the same truth value.' : 'The two sides have different truth values.'; add(a.left); add(a.right); break;
        case 'end':
          out.reason = 'Jump to the end of time at this participant, with current maybe-event reset to dagger.';
          add(a.body, { place: w.place, timeIndex: model.fullTime.index, event: null });
          break;
        case 'past': case 'allpast': case 'sometime': case 'everytime': {
          const all = a.type === 'allpast' || a.type === 'everytime';
          const global = a.type === 'sometime' || a.type === 'everytime';
          const local = model.nodesAt(global ? model.fullTime.index : w.timeIndex, w.place);
          out.details = { candidates: local.length, range: global ? 'all recorded tuples at this participant' : 'strict local past' };
          if ((!all && result) || (all && !result)) {
            for (const n of local) {
              this._tick();
              if (test(a.body, nodeWorld(n)) === result) {
                out.details[all ? 'counterexampleTuple' : 'witnessTuple'] = n.id;
                add(a.body, nodeWorld(n));
                break;
              }
            }
            out.reason = all ? 'A local tuple falsifies the subformula.' : 'A local tuple satisfies the subformula.';
          } else {
            out.reason = all ? 'Every local tuple satisfies the subformula.' : 'No local tuple satisfies the subformula.';
            if (!local.length) out.reason += all ? ' The range is empty, so this is vacuous.' : ' The range is empty.';
            for (const n of local) { if (count >= maxNodes || depth >= maxDepth) { if (local.length) partial = out.partial = true; break; } add(a.body, nodeWorld(n)); }
          }
          break;
        }
        case 'forall': case 'exists': case 'exists01': case 'exists1': {
          out.details = { variable: a.variable, domainSize: model.values.length };
          const withValue = value => { const b = new Map(env); b.set(a.variable, value); return b; };
          if ((a.type === 'forall' && !result) || (a.type === 'exists' && result)) {
            for (const value of model.values) {
              this._tick();
              const b = withValue(value);
              if (test(a.body, w, b) === result) {
                out.details[a.type === 'forall' ? 'counterexampleBinding' : 'witnessBinding'] = { [a.variable]: value };
                add(a.body, w, b);
                break;
              }
            }
            out.reason = a.type === 'forall' ? 'This value falsifies the universally quantified body.' : 'This value witnesses the existential quantifier.';
          } else if (a.type === 'exists01' || a.type === 'exists1') {
            const witnesses = [];
            for (const value of model.values) {
              this._tick();
              if (test(a.body, w, withValue(value))) { witnesses.push(value); if (witnesses.length === 2) break; }
            }
            out.details.witnessBindings = witnesses.map(v => ({ [a.variable]: v }));
            out.reason = witnesses.length > 1 ? 'At least two distinct values satisfy the body.' : witnesses.length === 1 ? 'Exactly one value satisfies the body.' : 'No value satisfies the body.';
            if (witnesses.length) for (const value of witnesses) add(a.body, w, withValue(value));
            else for (const value of model.values) { if (count >= maxNodes || depth >= maxDepth) { partial = out.partial = true; break; } add(a.body, w, withValue(value)); }
          } else {
            out.reason = a.type === 'forall' ? 'Every value satisfies the body.' : 'No value satisfies the body.';
            for (const value of model.values) { if (count >= maxNodes || depth >= maxDepth) { partial = out.partial = true; break; } add(a.body, w, withValue(value)); }
          }
          break;
        }
        case 'dia': case 'box': {
          const learners = a.learners.map(t => this._term(t, env));
          const family = this.intersectionFamily(learners);
          let good = 0n;
          for (let i = 0; i < model.participants.length; i++) {
            this._tick();
            if (test(a.body, { place: model.participants[i], timeIndex: w.timeIndex, event: null })) good |= 1n << BigInt(i);
          }
          out.details = { learners: shortList(learners), learnerCount: learners.length, minimalIntersections: family.length, satisfyingParticipants: shortList(maskPlaces(good)) };
          const explainAt = p => add(a.body, { place: p, timeIndex: w.timeIndex, event: null });
          if (a.type === 'dia' && !result) {
            const blocking = family.find(q => (q & good) === 0n);
            const places = maskPlaces(blocking);
            out.details.blockingIntersection = shortList(places);
            out.details.intersectionSize = places.length;
            out.reason = places.length ? 'A quorum intersection contains no participant satisfying the body.' : 'A quorum intersection is empty, so it has no witness.';
            for (const p of places) { if (count >= maxNodes || depth >= maxDepth) { partial = out.partial = true; break; } explainAt(p); }
          } else if (a.type === 'box' && result) {
            const witness = family.find(q => (q & good) === q);
            const places = maskPlaces(witness);
            out.details.witnessIntersection = shortList(places);
            out.details.intersectionSize = places.length;
            out.reason = places.length ? 'Every participant in this quorum intersection satisfies the body.' : 'An empty quorum intersection witnesses the box vacuously.';
            for (const p of places) { if (count >= maxNodes || depth >= maxDepth) { partial = out.partial = true; break; } explainAt(p); }
          } else {
            out.reason = a.type === 'dia' ? 'Each minimal quorum intersection has a participant satisfying the body.' : 'Every quorum intersection has a participant falsifying the body.';
            const used = new Set();
            for (const q of family) {
              this._tick();
              const chosen = q & (a.type === 'dia' ? good : model.allPlacesMask ^ good);
              const p = model.participants.find((_, i) => (chosen & (1n << BigInt(i))) !== 0n);
              if (p !== undefined && !used.has(p)) {
                if (count >= maxNodes || depth >= maxDepth) { partial = out.partial = true; break; }
                used.add(p); explainAt(p);
              }
            }
          }
          break;
        }
      }
      return out;
    };
    try { root = build(ast, at, bindings, 0); }
    catch (error) {
      if (!(error instanceof EvaluationLimitError)) throw error;
      root ??= { type: ast.type, holds, reason: 'The judgement was evaluated before explanation was stopped.', world: compactWorld(at), bindings: {}, children: [] };
      root.explanationStopped = error.message;
      partial = true;
    }
    return { ...root, holds, partial, stats: this.stats };
  }

  /** All-world checks use exact equivalence-class representatives, not just
   * recorded DAG nodes. A false result may stop once maxFailures are collected;
   * a true result always exhausts the requested semantic scope.
   */
  check(ast, { scope = 'end', world, maxFailures = 1 } = {}) {
    if (!['end', 'all', 'world'].includes(scope)) throw new ModelError(`Unknown check scope ${JSON.stringify(scope)}.`);
    if (!Number.isSafeInteger(maxFailures) || maxFailures < 1) throw new ModelError('maxFailures must be a positive safe integer.');
    this._start();
    const env = new Map();
    this._validate(ast, env);
    const worlds = scope === 'world' ? [this._world(world)] : this.model.worlds(scope);
    const total = scope === 'world' ? 1 : scope === 'end' ? this.model.participants.length : this.model.participants.length * this.model.times.length + this.model.nodes.filter(n => n.event !== null).length;
    const failures = [];
    let checked = 0;
    for (const w of worlds) {
      checked++;
      if (!this._eval(ast, w, env)) {
        failures.push(this.model.describeWorld(w));
        if (failures.length >= maxFailures) break;
      }
    }
    return { holds: failures.length === 0, complete: true, scope, failures, checked, totalRepresentatives: total, exhaustive: checked === total, stats: this.stats };
  }

  _term(term, env) { return term.type === 'value' ? term.value : env.get(term.name); }
  _atom(ast, env) { return { symbol: ast.symbol, args: ast.args.map(t => this._term(t, env)) }; }

  /** Minimal intersection families for a finite learner list. Multiplicity
   * matters: q[l,l,l] need not have the same family as q[l,l].
   */
  intersectionFamily(learners) {
    if (!Array.isArray(learners)) throw new ModelError('Learners must be an array of value names.');
    for (const l of learners) if (!this.model.quorums.has(l)) throw new ModelError(`Unknown learner ${JSON.stringify(l)}.`);
    const key = JSON.stringify([...learners].sort());
    if (this._families.has(key)) return this._families.get(key);
    let result = [this.model.allPlacesMask];
    for (const learner of learners) {
      const next = [];
      for (const a of result) for (const b of this.model.quorums.get(learner)) { this._tick(); next.push(a & b); }
      result = minimizeMasks(next, () => this._tick());
      if (result.length === 1 && result[0] === 0n) break;
    }
    if (this._families.size >= 10_000) {
      this._families.clear();
      this._families.set(JSON.stringify([]), [this.model.allPlacesMask]);
    }
    this._families.set(key, Object.freeze(result));
    return result;
  }

  _eval(ast, world, env) {
    this._tick();
    let id = this._astIds.get(ast);
    if (id === undefined) { id = this._nextId++; this._astIds.set(ast, id); }
    const envKey = [...env].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    const key = JSON.stringify([id, world.place, world.timeIndex, eventKey(world.event), envKey]);
    if (this.memo.has(key)) { this._memoHits++; return this.memo.get(key); }
    const model = this.model;
    const evaluate = (child, at = world, bindings = env) => this._eval(child, at, bindings);
    const atNode = n => ({ place: n.place, timeIndex: n.timeIndex, event: n.event });
    let result;
    switch (ast.type) {
      case 'true': result = true; break;
      case 'false': result = false; break;
      case 'seq': result = model.isSequential(world.timeIndex, world.place); break;
      case 'eq': result = this._term(ast.left, env) === this._term(ast.right, env); break;
      case 'atom': {
        const atom = this._atom(ast, env);
        result = model.eventSymbols.has(ast.symbol)
          ? eventKey(world.event) === eventKey(atom) && model.hasTuple(world.place, world.timeIndex, atom)
          : model.hasFact(world.place, world.timeIndex, atom);
        break;
      }
      case 'not': result = !evaluate(ast.body); break;
      case 'and': result = evaluate(ast.left) && evaluate(ast.right); break;
      case 'or': result = evaluate(ast.left) || evaluate(ast.right); break;
      case 'implies': result = !evaluate(ast.left) || evaluate(ast.right); break;
      case 'iff': result = evaluate(ast.left) === evaluate(ast.right); break;
      case 'past': result = model.nodesAt(world.timeIndex, world.place).some(n => evaluate(ast.body, atNode(n))); break;
      case 'allpast': result = model.nodesAt(world.timeIndex, world.place).every(n => evaluate(ast.body, atNode(n))); break;
      case 'sometime': result = model.nodesAt(model.fullTime.index, world.place).some(n => evaluate(ast.body, atNode(n))); break;
      case 'everytime': result = model.nodesAt(model.fullTime.index, world.place).every(n => evaluate(ast.body, atNode(n))); break;
      case 'end': result = evaluate(ast.body, { place: world.place, timeIndex: model.fullTime.index, event: null }); break;
      case 'forall': case 'exists': case 'exists01': case 'exists1': {
        let successes = 0;
        result = ast.type === 'forall';
        for (const v of model.values) {
          const bound = new Map(env); bound.set(ast.variable, v);
          const holds = evaluate(ast.body, world, bound);
          if (ast.type === 'forall' && !holds) { result = false; break; }
          if (ast.type === 'exists' && holds) { result = true; break; }
          if (holds) successes++;
          if ((ast.type === 'exists01' || ast.type === 'exists1') && successes > 1) break;
        }
        if (ast.type === 'exists01') result = successes <= 1;
        if (ast.type === 'exists1') result = successes === 1;
        break;
      }
      case 'dia': case 'box': {
        const family = this.intersectionFamily(ast.learners.map(t => this._term(t, env)));
        if (family.length === 1 && family[0] === 0n) {
          // Empty intersections settle both modalities without evaluating a
          // potentially expensive body at any unrelated participant.
          result = ast.type === 'box';
          break;
        }
        const relevant = family.reduce((mask,q) => mask | q,0n);
        let good = 0n;
        for (let i = 0; i < model.participants.length; i++) {
          if ((relevant & (1n << BigInt(i))) === 0n) continue;
          this._tick();
          if (evaluate(ast.body, { place: model.participants[i], timeIndex: world.timeIndex, event: null })) good |= 1n << BigInt(i);
        }
        result = ast.type === 'dia'
          ? family.every(q => (q & good) !== 0n)
          : family.some(q => (q & good) === q);
        break;
      }
      default: throw new ModelError(`Unknown formula type ${JSON.stringify(ast.type)}.`);
    }
    // Keep a large quantified formula from retaining millions of serialized
    // environment keys. Eviction affects speed, never truth values.
    if (this.memo.size >= this.maxMemoEntries) { this._memoEvictions += this.memo.size; this.memo.clear(); }
    this.memo.set(key, result);
    return result;
  }
}
