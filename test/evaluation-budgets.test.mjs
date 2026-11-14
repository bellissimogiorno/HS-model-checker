import test from 'node:test';
import assert from 'node:assert/strict';
import {runExperiment,replayExperiment} from '../src/experiment.mjs';
import {synthesize} from '../src/synthesis.mjs';

const model={format:'history-structure-model/v1',participants:['p','q'],values:['v'],signature:{events:[],predicates:[]},nodes:[],quorums:{v:[['p']]},facts:[]};
const source=declarations=>`# Step budgets\n\n\`\`\`hsm-model\n${JSON.stringify(model)}\n\`\`\`\n\n\`\`\`hsm\n${declarations}\n\`\`\`\n`;

test('invalid evaluation-step limits are rejected before even empty experiment or synthesis queries',async()=>{
  const complete=await runExperiment(source('axiom Base: true'),{selectedProperties:[]});
  for(const maxSteps of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,null,'1']) {
    for(const mode of ['evaluate','synthesize','search'])await assert.rejects(runExperiment(source(''),{mode,maxSteps,selectedProperties:[]}),/maxSteps/);
    assert.throws(()=>synthesize(model,{theory:[],maxSteps}),/maxSteps/);
    assert.throws(()=>replayExperiment(complete.consistency.evidence,{maxSteps}),/maxSteps/);
  }
});

test('tiny concrete replay budgets cannot produce unverified models or counterexamples in any run mode',async()=>{
  for(const mode of ['evaluate','synthesize','search']) {
    const run=await runExperiment(source('axiom Base: true\nproperty Failure: false'),{mode,maxSteps:1,maxAdditionalNodes:0});
    assert.equal(run.status,'incomplete',mode);
    assert.equal(run.complete,false,mode);
    assert.equal(run.consistency.consistent,null,mode);
    assert.equal(run.consistency.evidence,undefined,mode);
    assert.ok(run.properties.every(p=>p.status!=='counterexample'),mode);
  }
});

test('property evaluation honors the step limit even when an empty assumption batch is already verified',async()=>{
  for(const mode of ['evaluate','synthesize','search']) {
    const run=await runExperiment(source('property Failure: false'),{mode,maxSteps:1,maxAdditionalNodes:0});
    assert.equal(run.status,'incomplete',mode);
    assert.equal(run.consistency.consistent,true,mode);
    assert.equal(run.properties[0].status,'incomplete',mode);
    assert.equal(run.properties[0].evidence,undefined,mode);
    assert.equal(replayExperiment(run.consistency.evidence).verified,true,'The earlier zero-obligation model certificate remains valid.');
  }
});

test('explicit step budgets cover the whole assumption batch and separately each property verification',async()=>{
  const declarations='axiom One: true\naxiom Two: true\nproperty Failure: false';
  const theory=[{name:'One',formula:'true'},{name:'Two',formula:'true'}];
  for(const mode of ['evaluate','synthesize','search']) {
    // Each true axiom takes three steps on this two-participant history, so
    // giving each one a separate allowance of five would incorrectly pass.
    const limited=await runExperiment(source(declarations),{mode,maxSteps:5,maxAdditionalNodes:0});
    assert.equal(limited.status,'incomplete',mode);
    const complete=await runExperiment(source(declarations),{mode,maxSteps:6,maxAdditionalNodes:0});
    assert.equal(complete.status,'counterexample',mode);
    assert.equal(complete.snapshot.bounds.maxSteps,6);
    assert.equal(replayExperiment(complete.properties[0].evidence).verified,true);
  }
  assert.equal(synthesize(model,{theory,property:'false',maxSteps:5}).status,'incomplete');
  const complete=synthesize(model,{theory,property:'false',maxSteps:6});
  assert.equal(complete.status,'counterexample');
  assert.equal(complete.witness.experiment.limits.maxSteps,6);
});

test('local replay step limits do not alter the recorded scope or request identity',async()=>{
  const run=await runExperiment(source('axiom Base: true\nproperty Failure: false'),{maxSteps:100000});
  const evidence=run.properties[0].evidence,before=JSON.stringify(evidence);
  const limited=replayExperiment(evidence,{maxSteps:1});
  assert.equal(limited.verified,false);assert.equal(limited.status,'incomplete');
  assert.equal(replayExperiment(evidence,{maxSteps:1000}).verified,true);
  assert.equal(JSON.stringify(evidence),before);
  assert.equal(evidence.snapshot.bounds.maxSteps,100000);
  // Legacy certificates have no request identity but their saved work limits
  // must still control replay, rather than silently using a default allowance.
  const legacy=structuredClone(evidence);delete legacy.snapshot;legacy.bounds.maxSteps=1;
  assert.equal(replayExperiment(legacy).status,'incomplete');
});
