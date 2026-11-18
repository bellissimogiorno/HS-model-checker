import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseDocument,selectTheory} from '../src/document.mjs';
import {checkCustomTheory} from '../src/custom.mjs';
import {runExperiment,replayExperiment} from '../src/experiment.mjs';
import {compileModel} from '../src/model.mjs';
import {Evaluator} from '../src/evaluator.mjs';
import {correctnessProperties} from '../src/theories.mjs';
import {parseFormula} from '../src/parser.mjs';

const ROOT=dirname(dirname(fileURLToPath(import.meta.url)));
const read=async file=>parseDocument(await readFile(join(ROOT,'examples/theories',file),'utf8'));
const canonical=correctnessProperties('HBBSafe');
const badEcho='forall v,w. sometime (live & dia[] past propose(v)) -> sometime echo(w)';

// An existential scenario elsewhere is insufficient: each failed conditional
// must have a true complete premise and trigger at its own failure world.
function assertNonvacuousFailure(evidence,property) {
  const model=compileModel(evidence.model),evaluator=new Evaluator(model);
  const world=model.world(evidence.failure),variables=[];
  let body=property.ast;
  while(body.type==='forall'){variables.push(body.variable);body=body.body;}
  let witness=null;
  function find(index,env) {
    if(index===variables.length) {
      if(!evaluator.evaluate(body,world,env)){witness=env;return true;}
      return false;
    }
    return model.values.some(value=>find(index+1,{...env,[variables[index]]:value}));
  }
  assert.ok(find(0,{}),`${property.name}: false grounded conditional`);
  assert.equal(body.type,'implies');
  assert.equal(body.right.type,'implies');
  assert.equal(evaluator.evaluate(body.left,world,witness),true);
  assert.equal(evaluator.evaluate(body.right.left,world,witness),true);
  assert.equal(evaluator.evaluate(body.right.right,world,witness),false);
  assert.equal(evaluator.evaluate(property.nonvacuityAst,world),true);
  if(['Happy Termination','Cascade Termination'].includes(property.name))assert.equal(evaluator.evaluate(parseFormula('live'),world),true);
}

test('HBBSafe fixed-history examples retain full ThyLive, check exact conditional claims and replay every model and failure',async()=>{
  const matrix=JSON.parse(await readFile(join(ROOT,'examples/hbb1-cases.json'),'utf8'));
  assert.equal(matrix.theory,'HBBSafe');
  assert.equal(matrix.cases.length,15);
  assert.deepEqual(matrix.properties,canonical.map(p=>p.name));
  let models=0,failures=0,probes=0;
  for(const spec of matrix.cases) {
    const doc=await read(spec.file);
    assert.equal(spec.theory,'HBBSafe');
    assert.equal(doc.includeLive,true);
    assert.ok(!spec.droppedAxioms.includes('ThyLive'));
    for(const property of canonical) {
      const declared=doc.properties.find(p=>p.name===property.name);
      assert.deepEqual(declared.ast,property.ast,`${spec.id}: exact ${property.name}`);
      assert.equal(declared.scope,'end');
    }
    const original=checkCustomTheory(doc.model,selectTheory(doc).theory,{maxMilliseconds:30000});
    assert.equal(original.complete,true,`${spec.id}: complete original audit`);
    assert.deepEqual(original.axioms.filter(a=>a.holds===false).map(a=>a.name),spec.expectedOriginalFailures,`${spec.id}: no hidden rule failure`);
    const run=await runExperiment(doc,{mode:'synthesize',droppedAxioms:spec.droppedAxioms,selectedProperties:matrix.properties,maxMilliseconds:30000,pinFacts:true});
    assert.equal(run.complete,true,`${spec.id}: ${run.reason}`);
    assert.equal(run.status,spec.expectedStatus,spec.id);
    assert.deepEqual(run.properties.map(p=>p.status),spec.expectedProperties,spec.id);
    assert.ok(run.retainedAxioms.includes('ThyLive'));
    if(!run.consistency.consistent) {
      assert.equal(run.status,'no-model');
      assert.equal(run.witness,null);
      assert.ok(run.properties.every(p=>p.status==='not-tested'));
      continue;
    }
    const model=compileModel(run.consistency.witness.model);
    assert.deepEqual(canonical.map(p=>new Evaluator(model).check(p.nonvacuityAst,{scope:'end'}).holds),spec.expectedScenarios,`${spec.id}: scenario presence`);
    const replay=replayExperiment(run.consistency.evidence,{maxMilliseconds:30000});
    assert.equal(replay.verified,true,`${spec.id}: model replay`);models++;
    assert.equal(replay.assumptions.includeLive,true);
    assert.equal(replay.assumptions.complete,true);
    assert.equal(replay.assumptions.counts.failed,0);
    assert.equal(replay.assumptions.counts.inconclusive,0);
    assert.ok(replay.assumptions.axioms.some(a=>a.name.startsWith('KnowledgeDia:')));
    assert.ok(replay.assumptions.axioms.some(a=>a.name.startsWith('KnowledgeBox:')));
    for(const result of run.properties.filter(p=>p.status==='counterexample')) {
      assert.equal(replayExperiment(result.evidence,{maxMilliseconds:30000}).verified,true,`${spec.id}: ${result.name} replay`);
      assertNonvacuousFailure(result.evidence,canonical.find(p=>p.name===result.name));failures++;
      if(spec.expectedFailurePlace)assert.equal(result.evidence.failure.place,spec.expectedFailurePlace);
    }
    for(const probe of spec.diagnosticProbes??[]) {
      const result=await runExperiment(doc,{mode:'synthesize',droppedAxioms:spec.droppedAxioms,selectedProperties:[probe.name],maxMilliseconds:30000,pinFacts:true});
      assert.equal(result.status,probe.expectedStatus);
      assert.equal(result.properties[0].status,probe.expectedStatus);
      assert.equal(replayExperiment(result.properties[0].evidence,{maxMilliseconds:30000}).verified,true);
      probes++;
    }
  }
  assert.deepEqual([models,failures,probes],[8,6,2]);
});

test('the HBBSafe safety-guard example changes only Vote? and violates Agreement with Safe retained',async()=>{
  const full=await read('hbb1-vote-safe.md'),weak=await read('hbb1-vote-safe-omitted.md');
  assert.deepEqual(full.model,weak.model);
  const rules=doc=>doc.axioms.map(({name,kind,formula})=>({name,kind,formula}));
  assert.deepEqual(rules(full).filter(a=>a.name!=='Vote?'),rules(weak).filter(a=>a.name!=='Vote?'));
  assert.deepEqual(weak.axioms.find(a=>a.name==='Vote?').ast,parseFormula('forall l,v. vote(l,v) -> box[l] past echo(v)'));
  assert.deepEqual(weak.axioms.find(a=>a.name==='NoLive').ast,parseFormula('not live'));
  assert.equal(checkCustomTheory(weak.model,selectTheory(weak).theory).holds,true);
  const model=compileModel(weak.model),agreement=canonical.find(p=>p.name==='Agreement');
  assert.equal(new Evaluator(model).check(agreement.ast,{scope:'end'}).holds,false);
  assert.equal(new Evaluator(model).check(agreement.nonvacuityAst,{scope:'end'}).holds,true);
  // Reporting learner c overlaps itself at sequential p, although source
  // learners a,b use distinct echo participants q,r.
  assert.deepEqual(weak.model.quorums,{a:[['q']],b:[['r']],c:[['p']]});
});

test('the paper incorrect Echo! is an independently universal bad-axiom probe and an inconsistent replacement',async()=>{
  const correct=await read('hbb1-echo-choice.md'),wrong=await read('hbb1-echo-choice-wrong.md');
  assert.deepEqual(wrong.model,correct.model);
  assert.deepEqual(wrong.axioms.filter(a=>a.name!=='Echo!').map(a=>a.ast),correct.axioms.filter(a=>a.name!=='Echo!').map(a=>a.ast));
  assert.deepEqual(wrong.axioms.find(a=>a.name==='Echo!').ast,parseFormula(badEcho));
  const probe=correct.properties.find(p=>p.name==='Bad Echo!');
  assert.equal(probe.scope,'all');
  assert.deepEqual(probe.ast,parseFormula(badEcho));
  assert.equal(checkCustomTheory(correct.model,selectTheory(correct).theory).holds,true);
  assert.equal(new Evaluator(compileModel(correct.model)).check(probe.ast,{scope:'all'}).holds,false);
  assert.deepEqual(correct.model.nodes.filter(n=>n.event?.symbol==='echo').map(n=>n.event.args),[['a']]);
  assert.deepEqual(correct.model.nodes.filter(n=>n.event?.symbol==='propose').map(n=>n.event.args),[['a'],['b']]);
  // The second universally closed value is independent of the proposal value.
  assert.equal(parseFormula(badEcho).body.type,'forall');
});

test('the paper missing-sometime Echo! wrongly activates on end-only knowledge at an inactive live participant',async()=>{
  const correct=await read('hbb1-echo-end-only.md'),wrong=await read('hbb1-echo-end-only-wrong.md');
  assert.deepEqual(wrong.model,correct.model);
  const meaning=({name,kind,ast})=>({name,kind,ast});
  assert.deepEqual(wrong.axioms.filter(a=>a.name!=='Echo!').map(meaning),correct.axioms.filter(a=>a.name!=='Echo!').map(meaning));
  const model=compileModel(correct.model),ev=new Evaluator(model),world=model.world({place:'p',time:'end'});
  assert.equal(model.nodes.filter(n=>n.place==='p').length,0);
  assert.equal(ev.evaluate(parseFormula('live & dia[] past propose("v")'),world),true);
  assert.equal(ev.evaluate(parseFormula('sometime (live & dia[] past propose("v"))'),world),false);
  assert.equal(ev.evaluate(parseFormula('exists w. sometime echo(w)'),world),false);
  assert.equal(checkCustomTheory(model,selectTheory(correct).theory).holds,true);
  const diagnostic=correct.properties.find(p=>p.name==='Bad end-only Echo!');
  assert.deepEqual(diagnostic.ast,wrong.axioms.find(a=>a.name==='Echo!').ast);
  assert.equal(ev.check(diagnostic.ast,{scope:'all'}).holds,false);
  for(const property of canonical) {
    assert.equal(ev.check(property.ast,{scope:'end'}).holds,true);
    assert.equal(ev.check(property.nonvacuityAst,{scope:'end'}).holds,false);
  }
  const rejected=await runExperiment(wrong,{mode:'synthesize',pinFacts:true,maxMilliseconds:30000});
  assert.equal(rejected.status,'no-model');
  assert.equal(rejected.complete,true);
});
