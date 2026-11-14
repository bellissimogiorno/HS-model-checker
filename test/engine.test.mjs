import test from 'node:test';
import assert from 'node:assert/strict';
import { compileModel, ModelError, minimizeMasks } from '../src/model.mjs';
import { Evaluator, EvaluationLimitError } from '../src/evaluator.mjs';

const val = value => ({ type: 'value', value });
const variable = name => ({ type: 'var', name });
const atom = (symbol, ...args) => ({ type: 'atom', symbol, args: args.map(val) });
const unary = (type, body) => ({ type, body });
const modal = (type, learners, body) => ({ type, learners: learners.map(val), body });
const truth = { type: 'true' };
function data(changes = {}) {
  return {
    format: 'history-structure-model/v1', participants: ['p', 'q'], values: ['a', 'b'],
    signature: { events: ['send', 'echo'], predicates: ['live', 'mark'] },
    nodes: [], quorums: { a: [['p']], b: [['q']] }, facts: [], ...changes,
  };
}
function chain() {
  return data({ nodes: [
    { id: 'n0', place: 'p', event: { symbol: 'send', args: ['a'] }, past: [] },
    { id: 'n1', place: 'q', event: null, past: ['n0'] },
    { id: 'n2', place: 'p', event: { symbol: 'echo', args: ['a'] }, past: ['n1'] },
  ] });
}

test('DAG closure uses sets of tuples and hash-conses extensional aliases', () => {
  const source = chain();
  source.nodes.push({ id: 'copy0', place: 'p', event: { symbol: 'send', args: ['a'] }, past: [] });
  source.nodes.push({ id: 'copy2', place: 'p', event: { symbol: 'echo', args: ['a'] }, past: ['n1', 'copy0'] });
  const model = compileModel(source);
  assert.equal(model.nodes.length, 3);
  assert.equal(model.aliases.get('n0'), model.aliases.get('copy0'));
  assert.equal(model.aliases.get('n2'), model.aliases.get('copy2'));
  assert.deepEqual(model.resolveTime('n2').nodeIds, ['n0', 'n1']);
  assert.equal(model.fullTime.mask, 7n);
});

test('forward DAG references work and raw cycles are rejected before evaluation', () => {
  const source = chain();
  source.nodes.reverse();
  const model = compileModel(source);
  assert.equal(model.resolveTime('n2').mask, 3n);
  assert.throws(() => compileModel(data({ nodes: [
    { id: 'a0', place: 'p', event: null, past: ['a1'] },
    { id: 'a1', place: 'p', event: null, past: ['a0'] },
  ] })), /cycle/);
});

test('times comprise represented histories and end, excluding arbitrary ideals', () => {
  const model = compileModel(data({ nodes: [
    { id: 'p0', place: 'p', event: 'send', past: [] },
    { id: 'q0', place: 'q', event: 'echo', past: [] },
  ] }));
  assert.deepEqual(model.times.map(t => t.mask), [0n, 3n]);
  assert.equal(model.nodes.length, 2);
  assert.equal([...model.worlds('all')].length, 6);
});

test('an event requires matching current event and an actual tuple at that time', () => {
  const model = compileModel(chain()), evaluator = new Evaluator(model);
  const send = atom('send', 'a');
  assert.equal(evaluator.evaluate(send, { place: 'p', time: 'n0', event: { symbol: 'send', args: ['a'] } }), true);
  assert.equal(evaluator.evaluate(send, { place: 'q', time: 'n0', event: { symbol: 'send', args: ['a'] } }), false);
  assert.equal(evaluator.evaluate(send, { place: 'p', time: 'end', event: { symbol: 'send', args: ['a'] } }), false);
  assert.equal(evaluator.evaluate(send, { place: 'p', time: 'n0', event: null }), false);
  assert.equal(evaluator.evaluate(send, { place: 'p', time: 'n0', event: { symbol: 'echo', args: ['a'] } }), false);
});

test('past visits strict local ancestors, while sometime jumps to all local recorded tuples', () => {
  const evaluator = new Evaluator(compileModel(chain()));
  const send = atom('send', 'a'), echo = atom('echo', 'a');
  const atEcho = { place: 'p', time: 'n2', event: { symbol: 'echo', args: ['a'] } };
  assert.equal(evaluator.evaluate(unary('past', send), atEcho), true);
  assert.equal(evaluator.evaluate(unary('past', echo), atEcho), false);
  assert.equal(evaluator.evaluate(unary('past', send), { place: 'q', time: 'end' }), false);
  assert.equal(evaluator.evaluate(unary('sometime', echo), { place: 'p', time: 'empty' }), true);
  assert.equal(evaluator.evaluate(unary('allpast', { type: 'false' }), { place: 'p', time: 'empty' }), true);
  assert.equal(evaluator.evaluate(unary('everytime', truth), { place: 'q', time: 'empty' }), true);
});

test('end and quorum modalities reset the event to dagger', () => {
  const evaluator = new Evaluator(compileModel(chain()));
  const send = atom('send', 'a');
  const current = { place: 'p', time: 'n0', event: { symbol: 'send', args: ['a'] } };
  assert.equal(evaluator.evaluate(send, current), true);
  assert.equal(evaluator.evaluate(modal('dia', [], send), current), false);
  assert.equal(evaluator.evaluate(unary('end', send), current), false);
  assert.equal(evaluator.evaluate(unary('end', unary('past', atom('echo', 'a'))), current), true);
});

test('all-world validity includes non-recorded worlds and current actual event worlds', () => {
  const evaluator = new Evaluator(compileModel(chain()));
  const negativeEvent = unary('not', atom('send', 'a'));
  assert.equal(evaluator.check(negativeEvent, { scope: 'end' }).holds, true);
  const all = evaluator.check(negativeEvent, { scope: 'all' });
  assert.equal(all.holds, false);
  assert.equal(all.failures[0].node, 'n0');
  const failsElsewhere = { type: 'implies', left: unary('not', unary('past', truth)), right: atom('live') };
  const failure = evaluator.check(failsElsewhere, { scope: 'all' }).failures[0];
  assert.equal(failure.node, null);
  assert.equal(failure.event, null);
});

test('sequentiality concerns causal comparability, including silent tuples', () => {
  const fork = data({ nodes: [
    { id: 'p0', place: 'p', event: null, past: [] },
    { id: 'p1', place: 'p', event: 'send', past: [] },
  ] });
  const evaluator = new Evaluator(compileModel(fork));
  assert.equal(evaluator.evaluate({ type: 'seq' }, { place: 'p' }), false);
  assert.equal(evaluator.evaluate({ type: 'seq' }, { place: 'q' }), true);
  assert.equal(evaluator.evaluate({ type: 'seq' }, { place: 'p', time: 'empty' }), true);
  assert.equal(new Evaluator(compileModel(chain())).check({ type: 'seq' }, { scope: 'all' }).holds, true);
});

test('quorum bases denote upward closure, with duality and empty intersections', () => {
  const source = data({ facts: [{ place: 'p', at: '*', atom: 'live' }] });
  const evaluator = new Evaluator(compileModel(source));
  const live = atom('live');
  assert.equal(evaluator.evaluate(modal('box', ['a'], live)), true);
  assert.equal(evaluator.evaluate(modal('dia', ['a'], live)), true);
  assert.equal(evaluator.evaluate(modal('dia', ['a', 'b'], truth)), false);
  assert.equal(evaluator.evaluate(modal('box', ['a', 'b'], { type: 'false' })), true);
  assert.equal(evaluator.evaluate(modal('dia', [], live)), true);
  assert.equal(evaluator.evaluate(modal('box', [], live)), false);
  for (const learners of [[], ['a'], ['b'], ['a', 'b']]) {
    assert.equal(evaluator.evaluate(modal('box', learners, live)), !evaluator.evaluate(modal('dia', learners, unary('not', live))));
  }
});

test('repeated learner occurrences retain higher intersection requirements', () => {
  const source = data({ participants: ['p', 'q', 'r'], quorums: { a: [['p', 'q'], ['p', 'r'], ['q', 'r']], b: [['p', 'q', 'r']] } });
  const evaluator = new Evaluator(compileModel(source));
  assert.equal(evaluator.evaluate(modal('dia', ['a', 'a'], truth)), true);
  assert.equal(evaluator.evaluate(modal('dia', ['a', 'a', 'a'], truth)), false);
});

test('predicate facts are place/time dependent and ignore the current event', () => {
  const source = chain();
  source.facts = [{ place: 'p', at: ['n0', 'end'], atom: 'live' }];
  const evaluator = new Evaluator(compileModel(source));
  assert.equal(evaluator.evaluate(atom('live'), { place: 'p', time: 'empty' }), true);
  assert.equal(evaluator.evaluate(atom('live'), { place: 'p', time: 'n1' }), false);
  assert.equal(evaluator.evaluate(atom('live'), { place: 'p', time: 'end', event: 'echo' }), true);
  assert.equal(evaluator.evaluate(atom('live'), { place: 'q', time: 'end' }), false);
});

test('value quantifiers, uniqueness, and shadowing have the usual finite-domain semantics', () => {
  const evaluator = new Evaluator(compileModel(data()));
  const equality = { type: 'eq', left: variable('x'), right: val('a') };
  assert.equal(evaluator.evaluate({ type: 'forall', variable: 'x', body: equality }), false);
  assert.equal(evaluator.evaluate({ type: 'exists', variable: 'x', body: equality }), true);
  assert.equal(evaluator.evaluate({ type: 'exists01', variable: 'x', body: equality }), true);
  assert.equal(evaluator.evaluate({ type: 'exists1', variable: 'x', body: equality }), true);
  assert.equal(evaluator.evaluate({ type: 'exists1', variable: 'x', body: truth }), false);
  assert.equal(evaluator.evaluate({ type: 'exists01', variable: 'x', body: { type: 'false' } }), true);
  assert.equal(evaluator.evaluate({ type: 'forall', variable: 'x', body: { type: 'exists', variable: 'x', body: equality } }), true);
  assert.throws(() => evaluator.evaluate(equality), /Free variable/);
});

test('validation rejects model typos, malformed semifilters, unknown values, and reserved IDs', () => {
  for (const bad of [
    data({ participant: ['oops'] }),
    data({ quorums: { a: [['p'], ['q']], b: [['q']] } }),
    data({ quorums: { a: [], b: [['q']] } }),
    data({ quorums: { a: [[]], b: [['q']] } }),
    data({ signature: { events: ['send'], predicates: ['send'] } }),
    data({ nodes: [{ id: 'n', place: 'p', event: { symbol: 'send', args: ['unknown'] } }] }),
    data({ nodes: [{ id: 'end', place: 'p', event: null }] }),
    data({ nodes: [{ id: '@t0', place: 'p', event: null }] }),
  ]) assert.throws(() => compileModel(bad), ModelError);
  const evaluator = new Evaluator(compileModel(data()));
  assert.throws(() => evaluator.check(atom('absent')), /unknown symbol/);
  assert.throws(() => evaluator.check(atom('send', 'unknown')), /unknown value/);
});

test('resource exhaustion is explicit and never reported as valid', () => {
  const evaluator = new Evaluator(compileModel(chain()), { maxSteps: 1, maxMilliseconds: 10_000 });
  assert.throws(() => evaluator.check(unary('not', { type: 'false' }), { scope: 'all' }), e => e instanceof EvaluationLimitError && e.code === 'INCOMPLETE');
});

test('AST edits between checks cannot reuse stale memoized truth', () => {
  const evaluator = new Evaluator(compileModel(data()));
  const ast = { type: 'true' };
  assert.equal(evaluator.evaluate(ast), true);
  ast.type = 'false';
  assert.equal(evaluator.evaluate(ast), false);
});

test('mask minimization removes redundant supersets and supports budget callbacks', () => {
  let steps = 0;
  assert.deepEqual(minimizeMasks([7n, 1n, 3n, 6n, 6n], () => steps++), [1n, 6n]);
  assert(steps > 0);
  assert.deepEqual(minimizeMasks([7n, 0n, 1n]), [0n]);
});

test('validate checks the signature without evaluating a false property', () => {
  const evaluator = new Evaluator(compileModel(data()));
  assert.equal(evaluator.validate({ type: 'false' }), true);
  assert.throws(() => evaluator.validate(atom('typo')), /unknown symbol/);
});

test('explanations identify quantified counterexample values and implication branches', () => {
  const evaluator = new Evaluator(compileModel(data()));
  const formula = { type: 'forall', variable: 'x', body: {
    type: 'implies', left: truth,
    right: { type: 'eq', left: variable('x'), right: val('a') },
  } };
  const explanation = evaluator.explain(formula);
  assert.equal(explanation.holds, false);
  assert.deepEqual(explanation.details.counterexampleBinding, { x: 'b' });
  assert.equal(explanation.children[0].children[0].holds, true);
  assert.equal(explanation.children[0].children[1].holds, false);
  assert.equal(explanation.children[0].bindings.x, 'b');
  assert.equal(explanation.partial, false);
});

test('explanations identify event mismatch, absent tuples, and strict past witnesses', () => {
  const evaluator = new Evaluator(compileModel(chain()));
  const send = atom('send', 'a');
  assert.match(evaluator.explain(send).reason, /does not match/);
  const absent = evaluator.explain(send, { place: 'q', time: 'n0', event: { symbol: 'send', args: ['a'] } });
  assert.equal(absent.details.tupleOccurs, false);
  assert.match(absent.reason, /does not occur/);
  const past = evaluator.explain(unary('past', send), { place: 'p' });
  assert.equal(past.details.witnessTuple, 'n0');
  assert.equal(past.children[0].holds, true);
});

test('explanations show quorum vacuity, blockers, and causal incomparability', () => {
  const evaluator = new Evaluator(compileModel(data()));
  const dia = evaluator.explain(modal('dia', ['a', 'b'], truth));
  assert.equal(dia.holds, false);
  assert.deepEqual(dia.details.blockingIntersection, []);
  const box = evaluator.explain(modal('box', ['a', 'b'], { type: 'false' }));
  assert.equal(box.holds, true);
  assert.match(box.reason, /vacuously/);
  const fork = compileModel(data({ nodes: [
    { id: 'p0', place: 'p', event: null },
    { id: 'p1', place: 'p', event: 'send' },
  ] }));
  const seq = new Evaluator(fork).explain({ type: 'seq' });
  assert.equal(seq.holds, false);
  assert.deepEqual(seq.details.incomparable.map(w => w.node), ['p0', 'p1']);
});

test('bounded explanations preserve conclusive truth and omit oversized branches', () => {
  const evaluator = new Evaluator(compileModel(data()));
  const formula = { type: 'forall', variable: 'x', body: truth };
  const limited = evaluator.explain(formula, undefined, { maxNodes: 1, maxDepth: 0 });
  assert.equal(limited.holds, true);
  assert.equal(limited.partial, true);
  assert.deepEqual(limited.children, []);
  assert.equal('history' in limited.world, false);
});

test('bounded memo eviction preserves semantics and reports evicted entries', () => {
  const evaluator = new Evaluator(compileModel(chain()), { maxMemoEntries: 2 });
  const formula = { type: 'forall', variable: 'x', body: unary('end', truth) };
  const result = evaluator.check(formula, { scope: 'all' });
  assert.equal(result.holds, true);
  assert(result.stats.memoEntries <= 2);
  assert(result.stats.memoEvictions > 0);
});
