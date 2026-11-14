import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFormula, printFormula, freeVariables, FormulaSyntaxError} from '../src/parser.mjs';

const val = (value) => ({type:'value', value});
const variable = (name) => ({type:'var', name});
const atom = (symbol, args = []) => ({type:'atom', symbol, args});

test('implication is right associative; conjunction and modal scopes are tighter', () => {
  assert.deepEqual(parseFormula('past A and B -> C -> D'), {
    type:'implies',
    left:{type:'and', left:{type:'past', body:atom('A')}, right:atom('B')},
    right:{type:'implies', left:atom('C'), right:atom('D')},
  });
});

test('quantifier scope extends right; lexical binding and constants remain distinct', () => {
  const result = parseFormula('forall a,b. echo(a, "a") -> box[a,b] sometime vote(red)');
  assert.equal(result.type, 'forall');
  assert.equal(result.variable, 'a');
  assert.equal(result.body.variable, 'b');
  const formula = result.body.body;
  assert.deepEqual(formula.left.args, [variable('a'), val('a')]);
  assert.deepEqual(formula.right.learners, [variable('a'), variable('b')]);
  assert.deepEqual(formula.right.body.body.args, [val('red')]);
  assert.deepEqual([...freeVariables(result)], []);
});

test('shadowing is restored after nested quantification', () => {
  const ast = parseFormula('forall a. (exists a. P(a)) and P(a) and P(?free)');
  assert.deepEqual([...freeVariables(ast)], ['free']);
  assert.deepEqual(ast.body.left.right.args, [variable('a')]);
});

test('unbound bare identifiers are values; explicit variables are free', () => {
  const ast = parseFormula('P(v, ?x) and dia[?l] (?x = v)');
  assert.deepEqual([...freeVariables(ast)], ['x', 'l']);
  assert.deepEqual(ast.left.args, [val('v'), variable('x')]);
});

test('Unicode notation agrees with ASCII notation', () => {
  assert.deepEqual(
    parseFormula('∀ l. (♢[l,l] seq ∧ □[l] live) ⇒ ⇕(¬echo("bad") ∨ ↕echo("ok"))'),
    parseFormula('forall l. (dia[l,l] seq and box[l] live) -> everytime(not echo("bad") or sometime echo("ok"))'),
  );
  assert.deepEqual(parseFormula('⇓ ⊥ ⇔ ¬ ↓ ⊤'), parseFormula('allpast false <-> not past true'));
});

test('at most one and unique quantifiers have dedicated AST nodes', () => {
  assert.deepEqual(parseFormula('∃01 v. P(v)'), parseFormula('exists01 v. P(v)'));
  assert.deepEqual(parseFormula('∃1 v. P(v)'), parseFormula('exists1 v. P(v)'));
  assert.deepEqual(parseFormula('∃! v. P(v)'), parseFormula('exists1 v. P(v)'));
});

test('empty learner lists, repeated learners, and zero arity atoms survive roundtrip', () => {
  for (const source of [
    'dia P()', 'box[] P', 'dia["l", "l", "l"] end(allpast seq)',
    'forall v. echo(v) -> sometime echo("hello\\nworld")',
    'exists01 v. (P(v) and not (?free = "v"))',
    "Q('a\\\'b', '\\u03bb', 'line\\nnext')",
    'forall λ. Q(λ, "λ", ?x)',
    'exists1 a,b. a != b',
    'P(0, 42, "true")',
  ]) {
    const ast = parseFormula(source);
    assert.deepEqual(parseFormula(printFormula(ast)), ast, source);
  }
});

test('inequality is represented using negated equality', () => {
  assert.deepEqual(parseFormula('"a" != "b"'), {type:'not', body:{type:'eq', left:val('a'), right:val('b')}});
  assert.deepEqual(parseFormula('"a" ≠ "b"'), parseFormula('"a" != "b"'));
});

test('quoted atom symbols allow arbitrary signature names and reserved words', () => {
  for (const source of ['"bad-name"("x")', '"past"()', '"hello world"(red)', '"quote\\\"inside"()']) {
    const ast = parseFormula(source);
    assert.equal(ast.type, 'atom');
    assert.deepEqual(parseFormula(printFormula(ast)), ast);
  }
  assert.deepEqual(parseFormula('"past"()'), atom('past'));
});

test('reserved word variable names remain bound in equality and argument positions', () => {
  const ast = parseFormula('forall seq. seq = seq and P(seq)');
  assert.deepEqual(ast.body.left, {type:'eq', left:variable('seq'), right:variable('seq')});
  assert.deepEqual(ast.body.right.args, [variable('seq')]);
  assert.deepEqual(parseFormula(printFormula(ast)), ast);
  assert.deepEqual(parseFormula('true = false'), {type:'eq', left:val('true'), right:val('false')});
});

test('error messages include useful line and column positions', () => {
  assert.throws(() => parseFormula('P and\n  )'), (error) => error instanceof FormulaSyntaxError && error.line === 2 && error.column === 3);
  assert.throws(() => parseFormula('P("bad\\q")'), /Unknown string escape/);
  assert.throws(() => parseFormula('P("bad)'), /Unterminated quoted value/);
  assert.throws(() => parseFormula('dia[l,] P'), /Expected a value or variable/);
  assert.throws(() => parseFormula('forall a P(a)'), /Expected "\."/);
  assert.throws(() => parseFormula('P Q'), /after formula/);
  assert.throws(() => parseFormula(''), /Expected a formula/);
  assert.throws(() => parseFormula('P("line\nnext")'), /unescaped newline/);
});

test('input and nesting budgets fail predictably', () => {
  assert.throws(() => parseFormula('('.repeat(150) + 'P' + ')'.repeat(150)), /nesting exceeds/);
  assert.throws(() => parseFormula('not '.repeat(150) + 'P'), /nesting exceeds/);
  assert.throws(() => parseFormula(Array(150).fill('P').join(' and ')), /nesting exceeds/);
  assert.throws(() => parseFormula(`forall ${Array.from({length:150}, (_, i) => `v${i}`).join(',')}. P`), /nesting exceeds/);
  assert.throws(() => parseFormula('P'.repeat(100_001)), /characters/);
  assert.throws(() => parseFormula(null), TypeError);
});

test('printing accepted formulas near the depth budget remains parseable', () => {
  const formulas = [
    'not '.repeat(110) + 'P',
    Array(110).fill('P').join(' -> '),
    `forall ${Array.from({length:110}, (_, i) => `v${i}`).join(',')}. P`,
  ];
  for (const source of formulas) {
    const ast = parseFormula(source);
    assert.deepEqual(parseFormula(printFormula(ast)), ast);
  }
});

test('line comments and common symbolic aliases are accepted', () => {
  assert.deepEqual(parseFormula('P && !Q // reason\n => R # another reason'), parseFormula('P and not Q -> R'));
  assert.deepEqual(parseFormula('diamond[] P <=> square[] Q'), parseFormula('dia[] P <-> box[] Q'));
});
