/**
 * Dependency-free Boolean circuits and deterministic CDCL SAT solving.
 *
 * Adapted from 3muQL Explorer, muql/sat.py.
 * Copyright (c) 2026 MuQL contributors. MIT License; see ../LICENSE.
 *
 * The upstream watched-literal propagation, first-UIP learning, saved phases,
 * activity branching and restart algorithm are retained. This JavaScript port
 * additionally rechecks every satisfying assignment against the original CNF.
 * Resource exhaustion is unknown, never unsatisfiable.
 */

const numericOrder = (a, b) => a - b;
const clock = () => Date.now();

/** A hash-consed Tseitin circuit. Variable 1 is asserted true. */
export class Circuit {
  constructor() {
    this.true = 1;
    this.false = -1;
    this.nvars = 1;
    this.clauses = [[1]];
    this.names = new Map([[1, 'true']]);
    this._gates = new Map();
  }

  newVar(name) {
    if (!Number.isSafeInteger(this.nvars + 1)) throw new RangeError('Circuit variable count exceeds the safe integer range.');
    const literal = ++this.nvars;
    if (name !== undefined) this.names.set(literal, name);
    return literal;
  }

  _validate(literal) {
    if (!Number.isSafeInteger(literal) || literal === 0 || Math.abs(literal) > this.nvars) {
      throw new RangeError(`Circuit literal ${String(literal)} must be a nonzero integer in -${this.nvars}..${this.nvars}.`);
    }
  }

  addClause(...literals) {
    const seen = new Set();
    let satisfied = false;
    for (const literal of literals) {
      this._validate(literal);
      if (literal === this.true || seen.has(-literal)) satisfied = true;
      else if (literal !== this.false) seen.add(literal);
    }
    if (!satisfied) this.clauses.push([...seen].sort(numericOrder));
  }

  and(...literals) {
    const seen = new Set();
    let impossible = false;
    for (const literal of literals) {
      this._validate(literal);
      if (literal === this.false || seen.has(-literal)) impossible = true;
      else if (literal !== this.true) seen.add(literal);
    }
    if (impossible) return this.false;
    if (!seen.size) return this.true;
    if (seen.size === 1) return seen.values().next().value;
    const inputs = [...seen].sort(numericOrder);
    const key = JSON.stringify(['and', ...inputs]);
    if (this._gates.has(key)) return this._gates.get(key);
    const output = this.newVar();
    this._gates.set(key, output);
    for (const literal of inputs) this.clauses.push([-output, literal]);
    this.clauses.push([output, ...inputs.map(literal => -literal)]);
    return output;
  }

  or(...literals) {
    for (const literal of literals) this._validate(literal);
    return -this.and(...literals.map(literal => -literal));
  }

  iff(left, right) {
    this._validate(left); this._validate(right);
    if (left === right) return this.true;
    if (left === -right) return this.false;
    if (left === this.true) return right;
    if (right === this.true) return left;
    if (left === this.false) return -right;
    if (right === this.false) return -left;
    const negative = (left < 0) !== (right < 0);
    const inputs = [Math.abs(left), Math.abs(right)].sort(numericOrder);
    const key = JSON.stringify(['iff', ...inputs]);
    if (!this._gates.has(key)) {
      const output = this.newVar(), [a,b] = inputs;
      this._gates.set(key, output);
      this.clauses.push([-output,-a,b],[-output,a,-b],[output,a,b],[output,-a,-b]);
    }
    const output = this._gates.get(key);
    return negative ? -output : output;
  }

  implies(left, right) {
    this._validate(left); this._validate(right);
    return this.or(-left, right);
  }
}

class Timeout extends Error {}

/** Minimal deterministic binary heap of [negative activity, variable]. */
class Heap {
  constructor(items = []) {
    this.items = [];
    for (const item of items) this.push(item);
  }
  static before(a,b) { return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]); }
  push(item) {
    const array = this.items;
    let i = array.length;
    array.push(item);
    while (i) {
      const parent = (i-1) >> 1;
      if (!Heap.before(item,array[parent])) break;
      array[i] = array[parent]; i = parent;
    }
    array[i] = item;
  }
  pop() {
    const array = this.items;
    if (!array.length) return undefined;
    const first = array[0], last = array.pop();
    if (array.length) {
      let i = 0;
      while (2*i+1 < array.length) {
        let child = 2*i+1;
        if (child+1 < array.length && Heap.before(array[child+1],array[child])) child++;
        if (!Heap.before(array[child],last)) break;
        array[i] = array[child]; i = child;
      }
      array[i] = last;
    }
    return first;
  }
  get length() { return this.items.length; }
}

// Exported for focused invariant/heuristic regression tests; applications use solve.
export class _Solver {
  constructor(nvars, deadline, maxDecisions, onProgress) {
    this.nvars = nvars;
    this.deadline = deadline;
    this.maxDecisions = maxDecisions;
    this.onProgress = onProgress;
    this.decisions = 0;
    this.conflicts = 0;
    this.restarts = 0;
    this.clauses = [];
    this.watches = Array.from({length:2*(nvars+1)},()=>[]);
    this.values = new Int8Array(nvars+1);
    this.levels = new Int32Array(nvars+1);
    this.reasons = Array(nvars+1).fill(null);
    this.phase = new Int8Array(nvars+1).fill(-1);
    this.activity = new Float64Array(nvars+1);
    // Activity is merely heuristic. Track every occurring variable separately
    // so floating-point underflow cannot make a live variable disappear.
    this.occurringVariables = new Set();
    this.increment = 1;
    this.heap = new Heap();
    this.trail = [];
    this.trailLimits = [];
    this.qhead = 0;
    this.work = 0;
  }

  checkTime(force = false) {
    this.work++;
    if ((force || this.work % 256 === 0) && clock() >= this.deadline) throw new Timeout();
    if (this.onProgress && this.work % 16384 === 0) this.onProgress(this.stats());
  }
  stats() { return {decisions:this.decisions,conflicts:this.conflicts,restarts:this.restarts,clauses:this.clauses.length,work:this.work}; }
  index(literal) { return 2*Math.abs(literal) + Number(literal < 0); }
  value(literal) { const value=this.values[Math.abs(literal)];return literal>0?value:-value; }

  enqueue(literal,reason) {
    const variable = Math.abs(literal), value = literal > 0 ? 1 : -1;
    if (this.values[variable]) return this.values[variable] === value;
    this.values[variable] = value;
    this.levels[variable] = this.trailLimits.length;
    this.reasons[variable] = reason;
    this.trail.push(literal);
    return true;
  }

  add(clause) {
    const index = this.clauses.length;
    this.clauses.push(clause);
    for (const literal of clause) this.occurringVariables.add(Math.abs(literal));
    if (clause.length >= 2) {
      this.watches[this.index(clause[0])].push(index);
      this.watches[this.index(clause[1])].push(index);
    }
    return index;
  }

  propagate() {
    while (this.qhead < this.trail.length) {
      this.checkTime(true);
      const falseLiteral = -this.trail[this.qhead++];
      const watched = this.watches[this.index(falseLiteral)];
      let position = 0;
      while (position < watched.length) {
        this.checkTime();
        const clauseID = watched[position], clause = this.clauses[clauseID];
        if (clause[0] === falseLiteral) [clause[0],clause[1]] = [clause[1],clause[0]];
        const first = clause[0];
        if (this.value(first) === 1) { position++;continue; }
        let replacement = 2;
        while (replacement < clause.length) {
          this.checkTime();
          if (this.value(clause[replacement]) !== -1) break;
          replacement++;
        }
        if (replacement < clause.length) {
          const newLiteral = clause[replacement];
          clause[1] = newLiteral;clause[replacement] = falseLiteral;
          watched[position] = watched[watched.length-1];watched.pop();
          this.watches[this.index(newLiteral)].push(clauseID);
          continue;
        }
        position++;
        if (!this.enqueue(first,clauseID)) return clauseID;
      }
    }
    return null;
  }

  bump(variable) {
    this.activity[variable] += this.increment;
    if (this.activity[variable] > 1e100) {
      for (let v=0;v<this.activity.length;v++) { this.checkTime();this.activity[v] *= 1e-100; }
      this.increment *= 1e-100;
      this.heap = new Heap();
      for (const v of this.occurringVariables) if (!this.values[v]) { this.checkTime();this.heap.push([-this.activity[v],v]); }
    } else this.heap.push([-this.activity[variable],variable]);
  }

  analyze(conflict) {
    const learned = [0], seen = new Set();
    let pending=0,pivot=0,cursor=this.trail.length-1;
    const currentLevel = this.trailLimits.length;
    while (true) {
      for (const literal of this.clauses[conflict]) {
        this.checkTime();
        const variable = Math.abs(literal);
        if (variable === Math.abs(pivot) || seen.has(variable) || !this.levels[variable]) continue;
        seen.add(variable);this.bump(variable);
        if (this.levels[variable] === currentLevel) pending++;
        else learned.push(literal);
      }
      while (cursor >= 0 && !seen.has(Math.abs(this.trail[cursor]))) { this.checkTime();cursor--; }
      if (cursor < 0) throw new Error('SAT invariant violated: conflict analysis lost its implication point.');
      pivot = this.trail[cursor--];
      seen.delete(Math.abs(pivot));pending--;
      if (pending === 0) break;
      const reason = this.reasons[Math.abs(pivot)];
      if (reason === null) throw new Error('SAT invariant violated: missing implication reason.');
      conflict = reason;
    }
    learned[0] = -pivot;
    let backtrackLevel=0;
    if (learned.length>1) {
      let position=1;
      for (let i=2;i<learned.length;i++) { this.checkTime();if (this.levels[Math.abs(learned[i])]>this.levels[Math.abs(learned[position])]) position=i; }
      [learned[1],learned[position]] = [learned[position],learned[1]];
      backtrackLevel = this.levels[Math.abs(learned[1])];
    }
    this.increment /= 0.95;
    return [learned,backtrackLevel];
  }

  backtrack(level) {
    if (this.trailLimits.length<=level) return;
    const boundary = this.trailLimits[level];
    for (let i=boundary;i<this.trail.length;i++) {
      this.checkTime();
      const variable = Math.abs(this.trail[i]);
      this.phase[variable] = this.values[variable];
      this.values[variable] = 0;this.levels[variable] = 0;this.reasons[variable] = null;
      this.heap.push([-this.activity[variable],variable]);
    }
    this.trail.length = boundary;this.trailLimits.length = level;
    this.qhead = Math.min(this.qhead,this.trail.length);
  }

  choose() {
    while (this.heap.length) {
      this.checkTime();
      const [priority,variable] = this.heap.pop();
      if (!this.values[variable] && priority === -this.activity[variable]) return variable;
    }
    return null;
  }

  run() {
    let restartLimit=100,nextRestart=100;
    while (true) {
      this.checkTime(true);
      const conflict = this.propagate();
      if (conflict !== null) {
        if (!this.trailLimits.length) { this.checkTime(true);return this.result('unsat',new Map(),'Conflict at decision level zero.'); }
        const [learned,level] = this.analyze(conflict);
        this.backtrack(level);
        const clauseID = this.add(learned);
        if (!this.enqueue(learned[0],clauseID)) throw new Error('SAT invariant violated by learned clause.');
        this.conflicts++;
        if (this.conflicts>=nextRestart) {
          this.backtrack(0);this.restarts++;
          restartLimit = Math.floor(restartLimit*1.5);
          nextRestart = this.conflicts+restartLimit;
        }
        continue;
      }
      const variable = this.choose();
      if (variable === null) {
        const assignment = new Map();
        for (let v=1;v<=this.nvars;v++) { this.checkTime();assignment.set(v,this.values[v]===1); }
        this.checkTime(true);
        return this.result('sat',assignment,'Satisfying assignment found.');
      }
      if (this.decisions>=this.maxDecisions) return this.result('unknown',new Map(),'Decision budget exhausted.');
      this.decisions++;
      this.trailLimits.push(this.trail.length);
      this.enqueue(this.phase[variable]>0?variable:-variable,null);
    }
  }
  result(status,assignment,reason) { return {status,assignment,decisions:this.decisions,reason,stats:this.stats()}; }
}

/** Solve a finite CNF without mutating caller clauses.
 *
 * A zero decision budget still permits unit propagation. maxMilliseconds=0 or
 * an expired absolute deadline returns unknown before allocating solver arrays.
 * Infinity disables the relative timeout. All supplied literals are validated,
 * including literals after a tautology or contradictory clause.
 */
export function solve(nvars,clauses,{maxMilliseconds=10000,maxDecisions=100000,deadline,onProgress}={}) {
  if (!Number.isSafeInteger(nvars) || nvars<0) throw new RangeError('nvars must be a nonnegative safe integer.');
  if (!Number.isSafeInteger(maxDecisions) || maxDecisions<0) throw new RangeError('maxDecisions must be a nonnegative safe integer.');
  if (typeof maxMilliseconds!=='number' || Number.isNaN(maxMilliseconds) || maxMilliseconds<0) throw new RangeError('maxMilliseconds must be nonnegative and not NaN.');
  if (deadline!==undefined && (typeof deadline!=='number' || Number.isNaN(deadline))) throw new RangeError('deadline must be an epoch-millisecond number.');
  if (onProgress!==undefined && typeof onProgress!=='function') throw new TypeError('onProgress must be a function.');
  if (clauses===null || typeof clauses?.[Symbol.iterator]!=='function') throw new TypeError('clauses must be iterable.');
  const started=clock(),expires=Math.min(started+maxMilliseconds,deadline??Infinity);
  if (maxMilliseconds===0 || expires<=started) return {status:'unknown',assignment:new Map(),decisions:0,reason:'Time budget exhausted.',stats:{decisions:0,conflicts:0,restarts:0,clauses:0,work:0,elapsedMs:0}};
  const solver = new _Solver(nvars,expires,maxDecisions,onProgress);
  const original=[];
  const finish=result=>({...result,stats:{...result.stats,elapsedMs:clock()-started}});
  try {
    solver.checkTime(true);
    let contradictory=false;
    for (const supplied of clauses) {
      solver.checkTime();
      if (supplied===null || typeof supplied?.[Symbol.iterator]!=='function') throw new TypeError('Each clause must be iterable.');
      const seen=new Set(),clause=[],raw=[];
      let tautology=false;
      for (const literal of supplied) {
        solver.checkTime();
        if (!Number.isSafeInteger(literal) || literal===0 || Math.abs(literal)>nvars) throw new RangeError(`Literal ${String(literal)} must be a nonzero integer in -${nvars}..${nvars}.`);
        raw.push(literal);
        if (seen.has(-literal)) tautology=true;
        if (!seen.has(literal)) { seen.add(literal);clause.push(literal); }
      }
      original.push(raw);
      if (tautology) continue;
      if (!clause.length) { contradictory=true;continue; }
      const clauseID=solver.add(clause);
      for (const literal of clause) { solver.checkTime();solver.activity[Math.abs(literal)]++; }
      if (clause.length===1 && !solver.enqueue(clause[0],clauseID)) contradictory=true;
    }
    solver.checkTime(true);
    if (contradictory) return finish(solver.result('unsat',new Map(),'Contradictory input clauses.'));
    for (const variable of solver.occurringVariables) if (!solver.values[variable]) { solver.checkTime();solver.heap.push([-solver.activity[variable],variable]); }
    const result=solver.run();
    if (result.status==='sat') {
      for (const clause of original) {
        solver.checkTime();
        let satisfied=false;
        for (const literal of clause) { solver.checkTime();if (result.assignment.get(Math.abs(literal))===(literal>0)) {satisfied=true;break;} }
        if (!satisfied) throw new Error('SAT invariant violated: proposed assignment does not satisfy the original CNF.');
      }
      solver.checkTime(true);
      result.stats=solver.stats();
    }
    return finish(result);
  } catch(error) {
    if (!(error instanceof Timeout)) throw error;
    return finish(solver.result('unknown',new Map(),'Time budget exhausted.'));
  }
}
