import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileModel} from '../src/model.mjs';
import {Evaluator} from '../src/evaluator.mjs';
import {parseFormula} from '../src/parser.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'src', 'cli.mjs');
const temporary = await mkdtemp(join(root, '.cli-test-'));
after(() => rm(temporary, {recursive:true, force:true}));
let serial = 0;

function empty() {
  return {
    format:'history-structure-model/v1', participants:['p'], values:['v'],
    signature:{events:['E'], predicates:['live']}, nodes:[],
    quorums:{v:[['p']]}, facts:[],
  };
}
async function fixture(value, suffix='.json') {
  const path = join(temporary, `fixture-${serial++}${suffix}`);
  await writeFile(path, JSON.stringify(value));
  return path;
}
function run(...args) {
  const child = spawnSync(process.execPath, [cli, ...args], {encoding:'utf8', cwd:root, timeout:15_000, maxBuffer:10_000_000});
  assert.ifError(child.error);
  return {code:child.status, stdout:child.stdout, stderr:child.stderr};
}
function result(child) {
  assert.equal(child.stderr, '');
  return JSON.parse(child.stdout);
}

test('CLI help requires no input file and describes semantic scopes and exits', () => {
  const child = run('--help');
  assert.equal(child.code, 0);
  assert.equal(child.stderr, '');
  assert.match(child.stdout, /all-world validity/);
  assert.match(child.stdout, /2 error\/incomplete/);
});

test('CLI returns 0 for a valid model and a true property, 1 for a false property', async () => {
  const path = await fixture(empty());
  const validation = run('validate', path);
  assert.equal(validation.code, 0);
  assert.equal(result(validation).valid, true);
  const pass = run('check', path, '--formula', 'seq');
  assert.equal(pass.code, 0);
  assert.equal(result(pass).scope, 'end');
  const failure = run('check', path, '--formula', 'false');
  assert.equal(failure.code, 1);
  assert.equal(result(failure).holds, false);
});

test('CLI world selection distinguishes recorded events from the end and dagger worlds', async () => {
  const model = empty();
  model.nodes = [{id:'recorded',place:'p',event:'E',past:[]}];
  const path = await fixture(model);
  const selected = run('check', path, '--formula', 'E', '--scope', 'world', '--place', 'p', '--time', 'recorded', '--event', '"E"');
  assert.equal(selected.code, 0);
  assert.equal(result(selected).holds, true);
  const dagger = run('check', path, '--formula', 'E', '--scope', 'world', '--time', 'recorded');
  assert.equal(dagger.code, 1);
  const end = run('check', path, '--formula', 'E', '--scope', 'world', '--event', '"E"');
  assert.equal(end.code, 1);
});

test('CLI accepts exported projects and writes the exact JSON result requested', async () => {
  const path = await fixture({format:'history-structure-project/v1',model:empty(),formula:'false'});
  const output = join(temporary, 'check-result.json');
  const child = run('check', path, '--formula', 'true', '--output', output);
  assert.equal(child.code, 0);
  assert.equal(await readFile(output,'utf8'), child.stdout);
  assert.equal(result(child).holds, true);
});

test('CLI and UI use project modelSource as the authoritative editable model',async()=>{
  const displayed=empty();
  displayed.nodes=[{id:'e',place:'p',event:'E',past:[]}];
  const path=await fixture({format:'history-structure-project/v1',model:empty(),modelSource:JSON.stringify(displayed)});
  const child=run('check',path,'--formula','past E');
  assert.equal(child.code,0);
  assert.equal(result(child).holds,true);
});

test('CLI custom axioms retain rule names and always use all-world scope', async () => {
  const model = empty();
  model.nodes = [{id:'e',place:'p',event:'E',past:[]}];
  const path = await fixture(model);
  const axioms = await fixture([{name:'Backward?',formula:'true'},{name:'Forward!',formula:'not E'}]);
  const child = run('custom', path, '--axioms', axioms);
  assert.equal(child.code, 1);
  const output = result(child);
  assert.equal(output.holds, false);
  assert.deepEqual(output.axioms.map(a=>[a.name,a.scope]), [['Backward?','all'],['Forward!','all']]);
});

test('CLI custom wrappers check the full ThyLive schemes rather than a copied finite subset', async () => {
  const model = empty();
  model.nodes = [{id:'e',place:'p',event:'E',past:[]}];
  model.facts = [{place:'p',at:'*',atom:'live'}];
  const path = await fixture(model);
  const flat = await fixture([]);
  assert.equal(run('custom',path,'--axioms',flat).code, 0);
  const wrapper = await fixture({includeLive:true,axioms:[]});
  const child = run('custom',path,'--axioms',wrapper);
  assert.equal(child.code, 1);
  const output = result(child);
  assert.equal(output.includeLive, true);
  assert.equal(output.holds, false);
  assert.ok(output.axioms.some(a=>a.scheme==='KnowledgeDia' && a.holds===false));
});

test('CLI reports unknown property theories as errors instead of empty success', async () => {
  const path = await fixture(empty());
  for (const name of ['ThyLive', 'Bogus']) {
    const child = run('properties', path, '--theory', name);
    assert.equal(child.code, 2);
    assert.equal(child.stdout, '');
    assert.match(child.stderr, /Correctness properties require/);
  }
});

test('CLI reserves exit 2 for unknown options, missing operands, invalid budgets and invalid formulas', async () => {
  const path = await fixture(empty());
  for (const args of [
    ['check',path], ['check',path,'--formula'],
    ['check',path,'--formula','true','--formula','false'],
    ['check',path,'--formula','true','--unknown','x'],
    ['check',path,'--formula','true','--scope','typo'],
    ['check',path,'--formula','P'],
    ['check',path,'--formula','true','--milliseconds','0'],
    ['check',path,'--formula','true','--milliseconds','-1'],
    ['check',path,'--formula','true','--milliseconds','9007199254740993'],
  ]) {
    const child = run(...args);
    assert.equal(child.code, 2, args.join(' '));
    assert.equal(child.stdout, '', args.join(' '));
    assert.notEqual(child.stderr, '', args.join(' '));
  }
});

test('CLI returns exit 2 when Knowledge coverage is incomplete and no axiom has failed', async () => {
  const model = empty();
  model.participants = ['p','q'];
  const path = await fixture(model);
  const child = run('theory', path, '--theory', 'ThyLive', '--families', '1');
  assert.equal(child.code, 2);
  const output = result(child);
  assert.equal(output.holds, null);
  assert.equal(output.complete, false);
});

test('CLI returns exit 1 for a conclusive axiom failure even when other Knowledge instances are unclassified', async () => {
  const model = empty();
  model.participants = ['p','q'];
  model.nodes = [{id:'e',place:'p',event:'E',past:[]},{id:'silent',place:'p',event:null,past:[]}];
  model.facts = [{place:'p',at:'*',atom:'live'}];
  const path = await fixture(model);
  const child = run('theory', path, '--theory', 'ThyLive', '--families', '1');
  const output = result(child);
  assert.equal(output.holds, false);
  assert.equal(output.complete, false);
  assert.equal(child.code, 1);
});

test('CLI bounded exhaustion deduplicates concurrent insertion orders and reports its exact coverage', async () => {
  const model = empty();
  model.participants = ['p','q'];
  const path = await fixture(model);
  const child = run('explore', path, '--formula', 'true', '--nodes', '2', '--models', '100');
  assert.equal(child.code, 0);
  const output = result(child);
  assert.equal(output.status, 'exhausted');
  assert.equal(output.complete, true);
  assert.equal(output.stats.examined, 8);
  assert.equal(output.stats.duplicates, 1);
  assert.match(output.coverage, /finite search/);
});

test('CLI counterexamples have reloadable witnesses which satisfy assumptions and falsify the target', async () => {
  const path = await fixture(empty());
  const palette = await fixture([null,'E']);
  const assumptions = await fixture([{name:'Eventually!',formula:'end past E'}]);
  const witness = join(temporary, 'counterexample.json');
  const child = run('explore', path, '--formula', 'not past E', '--nodes', '1', '--palette', palette, '--axioms', assumptions, '--witness', witness);
  assert.equal(child.code, 1);
  const output = result(child);
  assert.equal(output.status, 'counterexample');
  assert.equal(output.witness.assumptions.holds, true);
  assert.equal(output.witness.result.holds, false);
  const model = compileModel(JSON.parse(await readFile(witness,'utf8')));
  assert.equal(new Evaluator(model).check(parseFormula('end past E'),{scope:'all'}).holds, true);
  assert.equal(new Evaluator(model).check(parseFormula('not past E'),{scope:'end'}).holds, false);
});

test('CLI exploration regenerates included ThyLive instances for new candidate events', async () => {
  const model = empty();
  model.facts = [{place:'p',at:'*',atom:'live'}];
  const path = await fixture(model);
  const palette = await fixture(['E']);
  const axioms = await fixture({includeLive:true,axioms:[]});
  const child = run('explore',path,'--formula','not past E','--nodes','1','--palette',palette,'--axioms',axioms);
  assert.equal(child.code, 0);
  const output = result(child);
  assert.equal(output.status, 'exhausted');
  assert.equal(output.stats.examined, 2);
  assert.equal(output.stats.modelsSatisfyingAssumptions, 1);
  assert.equal(output.witness, null);
});

test('CLI limited exploration reports incomplete rather than bounded exhaustion', async () => {
  const path = await fixture(empty());
  const palette = await fixture([null,'E']);
  const child = run('explore', path, '--formula', 'true', '--nodes', '3', '--models', '1', '--palette', palette);
  assert.equal(child.code, 2);
  const output = result(child);
  assert.equal(output.status, 'incomplete');
  assert.equal(output.complete, false);
  assert.equal(output.witness, null);
});

test('CLI rejects mutually exclusive exploration assumptions', async () => {
  const path = await fixture(empty());
  const axioms = await fixture([]);
  const child = run('explore', path, '--formula', 'true', '--nodes', '0', '--theory', 'ThyLive', '--axioms', axioms);
  assert.equal(child.code, 2);
  assert.match(child.stderr, /theory|axioms|assumptions/i);
});

test('CLI rejects options which its selected command would otherwise silently ignore', async () => {
  const path = await fixture(empty());
  for (const args of [
    ['validate',path,'--formula','false'],
    ['check',path,'--formula','true','--theory','ThyLive'],
    ['check',path,'--formula','true','--place','p'],
  ]) {
    const child = run(...args);
    assert.equal(child.code, 2, args.join(' '));
    assert.notEqual(child.stderr, '');
  }
});
