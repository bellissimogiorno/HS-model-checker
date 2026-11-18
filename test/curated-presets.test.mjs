/** Presets are requests, not hard-coded answers. Run the real checker with
 * each declared preset and compare its outcomes with the checked case matrix. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EXAMPLES,exampleOptions} from '../src/example-catalog.mjs';
import {parseDocument} from '../src/document.mjs';
import {runExperiment,replayExperiment} from '../src/experiment.mjs';

const canonical=['Happy Termination','Cascade Termination','Agreement'];
const omissions={
  'hbb1-echo-progress.md':['Echo!'],
  'hbb1-vote-progress.md':['Vote!'],
  'hbb1-deliver-progress.md':['Deliver!'],
  'hbb1-safe-removed.md':['Safe'],
  'echo-ne.md':['EchoNE'],
  'echo-progress.md':['Echo!'],
  'vote-progress.md':['Vote!'],
  'deliver-progress.md':['Deliver!'],
  'hbb3-echo-progress.md':['Echo!'],
  'hbb3-vote-progress.md':['Vote!'],
  'hbb3-deliver-progress.md':['Deliver!'],
  'hbb3-vote-prime-progress.md':["Vote'!"],
  'hbb3-corr-seq.md':['CorrSeq'],
  'hbb3-corr-past.md':['CorrPast'],
  'hbb3-vote-ne.md':['VoteNE'],
  'hbb3-three-twined.md':['3twined'],
};

test('every removal preset starts with exactly its named axiom omitted',()=>{
  assert.equal(Object.keys(omissions).length,16);
  for(const example of EXAMPLES)assert.deepEqual(exampleOptions(example.file).droppedAxioms,omissions[example.file]??[],example.file);
  for(const file of ['hbb1-vote-safe.md','hbb1-echo-choice-wrong.md','hbb3-corr-definition-wrong.md','hbb1-vote-safe-omitted.md','echo-ne-live-only.md']) {
    assert.deepEqual(exampleOptions(file).droppedAxioms,[],file+': retain its actual source assumptions');
  }
});

test('correct-theory presets test canonical claims separately from incorrect-axiom probes',()=>{
  for(const file of ['hbb1-echo-choice.md','hbb3-corr-definition.md'])assert.deepEqual(exampleOptions(file).selectedProperties,canonical,file);
});

test('all31 real preset requests produce their intended finite outcomes and replay their witnesses',async()=>{
  const cases=[];
  for(const manifest of ['hbb1-cases.json','weakening-cases.json','hbb3-cases.json']) {
    cases.push(...JSON.parse(await readFile(new URL('../examples/'+manifest,import.meta.url),'utf8')).cases);
  }
  const diagnostics={
    'first-steps.md':{status:'counterexample',properties:['counterexample']},
    'majority.md':{status:'counterexample',properties:['holds','counterexample']},
    'heterogeneous.md':{status:'counterexample',properties:['holds','holds','counterexample']},
  };
  let checked=0,replayed=0,fullControls=0;
  for(const example of EXAMPLES) {
    const source=await readFile(new URL('../examples/theories/'+example.file,import.meta.url),'utf8'),doc=parseDocument(source);
    const options=exampleOptions(example.file);
    assert.deepEqual(options.droppedAxioms,omissions[example.file]??[],example.file);
    const expected=cases.find(spec=>spec.file===example.file&&JSON.stringify(spec.droppedAxioms)===JSON.stringify(options.droppedAxioms));
    assert(expected||diagnostics[example.file],example.file+': independently declared expected outcome');
    // Give ordinary test runs headroom under parallel CI load; every other
    // preset setting, including compilation/step limits and selections, is exact.
    const maxMilliseconds=Math.max(30000,options.maxMilliseconds);
    const run=await runExperiment(source,{...options,maxMilliseconds});
    assert.equal(run.complete,true,example.file+': '+run.reason);
    // Registry controls test the three correctness claims, with any explicitly
    // incorrect candidate recorded separately as a diagnostic probe. A browser
    // lesson can deliberately select both, so compare each selected name with
    // its independently declared expectation rather than treating the probe's
    // failure as failure of a correctness theorem.
    const selected=options.selectedProperties??doc.properties.map(p=>p.name);
    const expectedProperties=expected?selected.map(name=>{
      const index=canonical.indexOf(name);
      if(index>=0)return expected.expectedProperties[index];
      const probe=expected.diagnosticProbes?.find(row=>row.name===name);
      assert(probe,`${example.file}: no declared expectation for ${name}`);
      return expected.expectedStatus==='no-model'?'not-tested':probe.expectedStatus;
    }):diagnostics[example.file].properties;
    const expectedStatus=expected?(expected.expectedStatus==='no-model'?'no-model':expectedProperties.includes('counterexample')?'counterexample':expectedProperties.length?'holds':'model'):diagnostics[example.file].status;
    assert.equal(run.status,expectedStatus,example.file);
    assert.deepEqual(run.properties.map(p=>p.status),expectedProperties,example.file);
    assert.deepEqual(run.droppedAxioms,options.droppedAxioms,example.file);
    assert.deepEqual(run.selectedProperties,options.selectedProperties??doc.properties.map(p=>p.name),example.file);
    if(run.consistency.consistent) {
      const modelReplay=replayExperiment(run.consistency.evidence,{maxMilliseconds});
      assert.equal(modelReplay.verified,true,example.file+': consistent model replay');
      assert.equal(modelReplay.assumptions.includeLive,doc.includeLive);replayed++;
      for(const property of run.properties.filter(p=>p.status==='counterexample')) {
        const replay=replayExperiment(property.evidence,{maxMilliseconds});
        assert.equal(replay.verified,true,example.file+': '+property.name+' replay');
        assert.equal(replay.assumptions.complete,true);assert.equal(replay.assumptions.holds,true);replayed++;
      }
    } else {
      assert.equal(run.status,'no-model',example.file);
      assert(run.properties.every(p=>p.status==='not-tested'),example.file+': inconsistent controls do not prove claims');
    }
    if(options.droppedAxioms.length) {
      const full=await runExperiment(source,{...options,droppedAxioms:[],maxMilliseconds});
      assert.equal(full.complete,true,example.file+': full-theory control '+full.reason);
      assert.equal(full.status,'no-model',example.file+': restoring the omitted rule rejects this fixed history');
      assert.equal(full.consistency.consistent,false,example.file);
      assert(full.properties.every(p=>p.status==='not-tested'),example.file+': full-control properties remain untested');
      fullControls++;
    }
    checked++;
  }
  assert.equal(checked,31);assert.equal(fullControls,16);
  assert.ok(replayed>31,'all returned models and failures are checked concretely');
});
