import test from 'node:test';
import assert from 'node:assert/strict';
import {compileModel} from '../src/model.mjs';
import {Evaluator} from '../src/evaluator.mjs';
import {parseFormula} from '../src/parser.mjs';
import {buildTheory,checkTheory,knowledgeFamilies} from '../src/theories.mjs';
import {synthesize} from '../src/synthesis.mjs';
import {runExperiment,replayExperiment} from '../src/experiment.mjs';
import {createRunSnapshot,ENGINE_IDENTITY,SEMANTICS_PROFILE} from '../src/run-identity.mjs';

const truth=(data,formula,scope='all')=>new Evaluator(compileModel(data)).check(parseFormula(formula),{scope}).holds;
const live=(place)=>({place,at:'*',atom:'live'});
const emptyTrust=()=>({format:'history-structure-model/v1',participants:['p','q'],values:['a','b'],
  signature:{events:['E'],predicates:['live']},nodes:[],quorums:{a:[['p']],b:[['q']]},facts:[live('p'),live('q')]});

test('Figure 7 permits inactive live participants and does not add cross-learner Knowledge axioms',()=>{
  const data=emptyTrust(),theory=buildTheory(data,'ThyLive');
  assert.equal(checkTheory(data,'ThyLive').holds,true);
  assert.equal(synthesize(data,{theory:'ThyLive'}).status,'model');
  assert.equal(theory.completeness.events,0);
  assert.deepEqual(theory.axioms.map(a=>a.name),['LiveAlways','LiveSeq']);
  assert.equal(truth(data,'box[a,b] past (live & E)'),true);
  assert.equal(truth(data,'(end (box[a,b] past (live & E))) -> live -> sometime (box[a,b] past E)'),false,
    'The stronger list-of-learners schema would incorrectly impose activity in this empty model.');
  assert.deepEqual(knowledgeFamilies(data).families.map(f=>f.learners),[['a'],['b']]);
  assert.throws(()=>buildTheory(data,'ThyLive',{maxKnowledgeFamilies:0}),/maxKnowledgeFamilies/);
});

test('omitted nonoccurring ground events have false Knowledge antecedents at all worlds',()=>{
  const data=emptyTrust();
  data.nodes=[{id:'actual',place:'p',event:{symbol:'E',args:['a']},past:[]}];
  // Vary rho independently of event occurrence. Nonempty one-learner quorums
  // make the Box antecedent false for every absent event, just like Diamond.
  for(const facts of [[],[live('p')],[live('q')],[live('p'),live('q')]]) {
    data.facts=facts;
    for(const absent of ['E()','E("b")','E("a","a","a","a","a","a","a","a")']) {
      assert.equal(truth(data,`not end (dia[] past (live & ${absent}))`),true);
      for(const learner of data.values)
        assert.equal(truth(data,`not end (box["${learner}"] past (live & ${absent}))`),true);
    }
  }
  const built=buildTheory(data,'ThyLive');
  assert.equal(built.completeness.events,1);
  assert.deepEqual(built.axioms.filter(a=>a.scheme==='KnowledgeBox').map(a=>a.learners),[['a'],['b']]);
});

function unobservedProposal(observation='none') {
  const nodes=[{id:'proposal',place:'q',event:{symbol:'propose',args:['a']},past:[]}];
  if(observation!=='none')nodes.push({id:'p-record',place:'p',event:null,past:observation==='after'?['proposal']:[]});
  return {format:'history-structure-model/v1',participants:['p','q'],values:['a'],
    signature:{events:['propose','echo','vote','deliver'],predicates:['live']},
    nodes,quorums:{a:[['q']]},facts:[live('p')]};
}

test('outer sometime guards forward progress by actual local knowledge, not end-time hypothetical knowledge',()=>{
  for(const observation of ['none','before']) {
    const data=unobservedProposal(observation),built=buildTheory(data,'HBBSimp');
    const echo=built.axioms.find(a=>a.name==='Echo!');
    assert.equal(truth(data,echo.formula),true);
    assert.equal(checkTheory(data,'HBBSimp').holds,true);
    assert.equal(truth(data,'forall v. (live & dia[] past propose(v)) -> exists w. sometime echo(w)'),false,
      'Without the outer sometime, a live participant is forced to act on a purely hypothetical end-world premise.');
    assert.equal(synthesize(data,{theory:'HBBSimp'}).status,'model');
    const protocol=built.axioms.filter(a=>!a.scheme&&!['LiveAlways','LiveSeq'].includes(a.name))
      .map(({name,kind,formula})=>({name,kind,formula:name==='Echo!'?'forall v. (live & dia[] past propose(v)) -> exists w. sometime echo(w)':formula}));
    assert.equal(synthesize(data,{theory:{includeLive:true,axioms:protocol}}).status,'no-model');
  }
  const observed=unobservedProposal('after');
  assert.equal(checkTheory(observed,'HBBSimp').holds,false);
  assert.equal(checkTheory(observed,'HBBSimp').axioms.find(a=>a.name==='Echo!').holds,false,
    'An actual local observation still triggers the revised progress obligation.');
});

const document=(model,include=true)=>`# Profile regression\n\n\`\`\`hsm-model\n${JSON.stringify(model)}\n\`\`\`\n\n\`\`\`hsm\n${include?'include ThyLive':'axiom Literal: true'}\nproperty Tautology: true\n\`\`\`\n`;
function priorSnapshot(evidence) {
  evidence.snapshot=createRunSnapshot(evidence.sourceMarkdown,
    {bounds:evidence.bounds,selectedProperties:evidence.snapshot.selectedProperties,droppedAxioms:evidence.droppedAxioms},
    {...ENGINE_IDENTITY,version:'0.6.10',semantics:'hbb-disc/2026-11-07'});
}

test('dynamic ThyLive replay requires an explicit matching reference profile, not a release version',async()=>{
  const run=await runExperiment(document(emptyTrust()),{selectedProperties:[]});
  assert.equal(run.semantics,SEMANTICS_PROFILE);
  assert.equal(run.snapshot.engine.semantics,SEMANTICS_PROFILE);
  const evidence=run.consistency.evidence;
  assert.equal(evidence.semantics,SEMANTICS_PROFILE);
  assert.equal(replayExperiment(evidence).verified,true);
  for(const mutate of [
    e=>{delete e.semantics;},
    e=>{delete e.semantics;delete e.snapshot;e.version='0.7.0';},
    e=>{e.semantics='hbb-disc/2026-11-07';priorSnapshot(e);},
  ]) {
    const changed=structuredClone(evidence);mutate(changed);
    assert.throws(()=>replayExperiment(changed),/ThyLive.*profile|profile.*ThyLive/i);
  }
  const changed=structuredClone(evidence);priorSnapshot(changed);
  assert.throws(()=>replayExperiment(changed),/profile.*snapshot/i);
});

test('literal unchanged-core certificates remain replayable, but mismatched or unknown profiles are rejected',async()=>{
  const run=await runExperiment(document(emptyTrust(),false),{selectedProperties:[]});
  const legacy=structuredClone(run.consistency.evidence);
  priorSnapshot(legacy);delete legacy.semantics;
  assert.equal(replayExperiment(legacy).verified,true);
  const bare=structuredClone(legacy);delete bare.snapshot;
  assert.equal(replayExperiment(bare).verified,true);
  legacy.semantics='unknown/profile';
  assert.throws(()=>replayExperiment(legacy),/profile/i);
  legacy.semantics=SEMANTICS_PROFILE;
  assert.throws(()=>replayExperiment(legacy),/profile.*snapshot/i);
  const omitted=await runExperiment(document(emptyTrust()),{droppedAxioms:['ThyLive'],selectedProperties:[]});
  const literal=structuredClone(omitted.consistency.evidence);priorSnapshot(literal);delete literal.semantics;
  assert.equal(replayExperiment(literal).verified,true,
    'The profile guard concerns retained dynamic assumptions, not an omitted group in the source.');
});
