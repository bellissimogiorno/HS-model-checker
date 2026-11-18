import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseDocument,selectTheory} from '../src/document.mjs';
import {compileModel} from '../src/model.mjs';
import {Evaluator} from '../src/evaluator.mjs';
import {parseFormula} from '../src/parser.mjs';
import {buildTheory,correctnessProperties} from '../src/theories.mjs';
import {checkCustomTheory} from '../src/custom.mjs';
import {runExperiment,replayExperiment} from '../src/experiment.mjs';

const ROOT=dirname(dirname(fileURLToPath(import.meta.url)));
const matrix=JSON.parse(await readFile(join(ROOT,'examples/hbb3-cases.json'),'utf8'));
const canonical=correctnessProperties('HBBCorr');
const read=async file=>parseDocument(await readFile(join(ROOT,'examples/theories',file),'utf8'));
const options={mode:'synthesize',pinFacts:true,maxMilliseconds:60000,maxCompilationNodes:1000000};

// Check the particular false conditional, rather than merely finding a
// non-vacuity scenario at another place or with different learner values.
function checkFalseConditional(model,property,failure) {
  const ev=new Evaluator(model),world=model.world(failure),variables=[];
  let body=property.ast;
  while(body.type==='forall'){variables.push(body.variable);body=body.body;}
  assert.equal(body.type,'implies');assert.equal(body.right.type,'implies');
  let binding;
  function visit(i,env) {
    if(i===variables.length) {
      if(!ev.evaluate(body,world,env)){binding=env;return true;}
      return false;
    }
    return model.values.some(v=>visit(i+1,{...env,[variables[i]]:v}));
  }
  assert.equal(visit(0,{}),true);
  assert.equal(ev.evaluate(body.left,world,binding),true);
  assert.equal(ev.evaluate(body.right.left,world,binding),true);
  assert.equal(ev.evaluate(body.right.right,world,binding),false);
  if(['Happy Termination','Cascade Termination'].includes(property.name))assert.equal(ev.evaluate(parseFormula('live'),world),true);
}

test('HBBCorr examples preserve every literal rule and all three full canonical claims',async()=>{
  assert.equal(matrix.theory,'HBBCorr');
  assert.deepEqual(matrix.properties,canonical.map(p=>p.name));
  assert.equal(matrix.cases.length,14);
  for(const spec of matrix.cases) {
    assert.equal(spec.theory,'HBBCorr');
    const doc=await read(spec.file),model=compileModel(doc.model);
    assert.equal(doc.includeLive,true);
    assert.equal(spec.droppedAxioms.includes('ThyLive'),false);
    assert.deepEqual(doc.properties.slice(0,3).map(({name,ast,scope})=>({name,ast,scope})),canonical.map(({name,ast,scope})=>({name,ast,scope})));
    const built=buildTheory(model,'HBBCorr').axioms.filter(a=>!a.scheme&&!['LiveAlways','LiveSeq'].includes(a.name));
    const incorrect=spec.file==='hbb3-corr-definition-wrong.md';
    for(const expected of built) {
      const actual=doc.axioms.find(a=>a.name===expected.name);
      if(incorrect&&['CorrSeq','CorrPast'].includes(expected.name)){assert.equal(actual,undefined);continue;}
      assert.ok(actual,`${spec.id}: missing retained ${expected.name}`);
      assert.deepEqual(actual.ast,expected.ast,`${spec.id}: edited ${expected.name}`);
      assert.equal(actual.kind,expected.kind);
    }
    const audit=checkCustomTheory(model,selectTheory(doc).theory,{maxMilliseconds:30000});
    assert.equal(audit.complete,true);
    assert.deepEqual(audit.axioms.filter(a=>a.holds===false).map(a=>a.name),spec.expectedOriginalFailures,`${spec.id}: hidden original failure`);
  }
});

test('every HBBCorr matrix result completes across all pinned-fact interpretations and independently replays',async()=>{
  for(const spec of matrix.cases) {
    const doc=await read(spec.file);
    const run=await runExperiment(doc,{...options,droppedAxioms:spec.droppedAxioms,selectedProperties:matrix.properties});
    assert.equal(run.complete,true,`${spec.id}: ${run.reason}`);
    assert.equal(run.status,spec.expectedStatus,spec.id);
    assert.deepEqual(run.properties.map(p=>p.status),spec.expectedProperties,spec.id);
    if(!run.consistency.consistent){assert.ok(run.properties.every(p=>p.status==='not-tested'));continue;}
    const witness=compileModel(run.consistency.witness.model);
    assert.deepEqual(canonical.map(p=>new Evaluator(witness).check(p.nonvacuityAst,{scope:'end'}).holds),spec.expectedScenarios,spec.id);
    const modelReplay=replayExperiment(run.consistency.evidence,{maxMilliseconds:30000});
    assert.equal(modelReplay.verified,true,`${spec.id}: model replay`);
    assert.equal(modelReplay.assumptions.complete,true);
    assert.equal(modelReplay.assumptions.counts.failed,0);
    assert.equal(modelReplay.assumptions.counts.inconclusive,0);
    for(const row of run.properties.filter(p=>p.status==='counterexample')) {
      const replay=replayExperiment(row.evidence,{maxMilliseconds:30000});
      assert.equal(replay.verified,true,`${spec.id}: ${row.name} replay`);
      const property=canonical.find(p=>p.name===row.name);
      checkFalseConditional(compileModel(row.witness.model),property,row.witness.result.failures[0]);
    }
    for(const probe of spec.diagnosticProbes??[]) {
      const diagnostic=await runExperiment(doc,{...options,selectedProperties:[probe.name]});
      assert.equal(diagnostic.complete,true);
      assert.equal(diagnostic.status,probe.expectedStatus);
      assert.equal(replayExperiment(diagnostic.properties[0].evidence,{maxMilliseconds:30000}).verified,true);
    }
  }
});

test('paper-specific examples isolate vote non-equivocation, triple overlap and correlation propagation',async()=>{
  const votes=await read('hbb3-vote-ne.md'),voteModel=compileModel(votes.model);
  const voteAudit=checkCustomTheory(voteModel,selectTheory(votes,{droppedAxioms:['VoteNE']}).theory);
  assert.equal(voteAudit.holds,true);
  assert.equal(new Evaluator(voteModel).evaluate(parseFormula('seq'),voteModel.world({place:'s',time:'end'})),true);
  assert.equal(voteAudit.axioms.find(a=>a.name==='EchoNE').holds,true);

  const triple=await read('hbb3-three-twined.md'),tripleModel=compileModel(triple.model),ev=new Evaluator(tripleModel);
  assert.equal(ev.check(parseFormula('forall l,m. dia[l,m] true'),{scope:'end'}).holds,true);
  assert.equal(ev.check(parseFormula('forall l,m,n. dia[l,m,n] true'),{scope:'end'}).holds,false);
  const tripleAudit=checkCustomTheory(tripleModel,selectTheory(triple,{droppedAxioms:['3twined']}).theory);
  assert.equal(tripleAudit.holds,true);
  assert.equal(tripleAudit.axioms.find(a=>a.name==="Vote'!").holds,true);

  const propagation=await read('hbb3-vote-prime-progress.md');
  const propagationAudit=checkCustomTheory(propagation.model,selectTheory(propagation).theory);
  assert.equal(propagationAudit.axioms.find(a=>a.name==='Vote!').holds,true);
  assert.equal(propagationAudit.axioms.find(a=>a.name==="Vote'!").holds,false);
});

test('the incorrect correlation equivalence rejects a legal nontransitive intersection profile',async()=>{
  const valid=await read('hbb3-corr-definition.md'),wrong=await read('hbb3-corr-definition-wrong.md');
  assert.deepEqual(wrong.model,valid.model);
  const model=compileModel(valid.model),ev=new Evaluator(model),world=model.world({place:'p',time:'end'});
  assert.equal(ev.evaluate(parseFormula('dia["L","M"] seq'),world),true);
  assert.equal(ev.evaluate(parseFormula('dia["M","N"] seq'),world),true);
  assert.equal(ev.evaluate(parseFormula('dia["L","N"] seq'),world),false);
  assert.equal(checkCustomTheory(model,selectTheory(valid).theory).holds,true);
  assert.equal(ev.check(valid.properties.find(p=>p.name==='Incorrect correlation equivalence').ast,{scope:'all'}).holds,false);
  const meaning=({name,kind,ast})=>({name,kind,ast});
  assert.deepEqual(wrong.axioms.filter(a=>a.name!=='CorrWrong').map(meaning),valid.axioms.filter(a=>!['CorrSeq','CorrPast'].includes(a.name)).map(meaning));
});
