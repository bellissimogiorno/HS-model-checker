import test from 'node:test';
import assert from 'node:assert/strict';
import {runExperiment,createEvidence,replayExperiment} from '../src/experiment.mjs';
import {parseDocument} from '../src/document.mjs';
import {compileModel} from '../src/model.mjs';
import {Evaluator} from '../src/evaluator.mjs';
import {parseFormula} from '../src/parser.mjs';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

function model(changes={}) {return {format:'history-structure-model/v1',participants:['p'],values:['red','blue'],signature:{events:[],predicates:['chosen','flag']},nodes:[],quorums:{red:[['p']],blue:[['p']]},facts:[],...changes};}
function source(data,declarations,title='Experiment fixture') {return `# ${title}\n\nOnly tagged declarations execute.\n\n\`\`\`hsm-model\n${JSON.stringify(data,null,2)}\n\`\`\`\n\n\`\`\`hsm\n${declarations}\n\`\`\`\n`;}
const chosenSource=()=>source(model(),'axiom NoConstraint: true\nproperty AtMostOne: exists01 v. chosen(v)');
function echoSource() {
  const data=model({participants:['p','sender'],signature:{events:['propose','echo'],predicates:['flag']},quorums:{red:[['p']],blue:[['p']]},nodes:[
    {id:'r',place:'sender',event:{symbol:'propose',args:['red']},past:[]},
    {id:'b',place:'sender',event:{symbol:'propose',args:['blue']},past:[]},
    {id:'er',place:'p',event:{symbol:'echo',args:['red']},past:['r']},
    {id:'eb',place:'p',event:{symbol:'echo',args:['blue']},past:['er','b']},
  ]});
  return source(data,'axiom Echo? [backward]: forall v. echo(v) -> dia[] past propose(v)\naxiom EchoNE: forall v,w. echo(v) -> past echo(w) -> v=w\nproperty EchoAgreement: forall v,w. ((sometime echo(v)) and (sometime echo(w))) -> v=w');
}

test('theory-first SAT experiment synthesizes two selected values and independently replayable evidence',async()=>{
  const markdown=chosenSource();
  const report=await runExperiment(markdown,{mode:'synthesize',selectedProperties:['AtMostOne']});
  assert.equal(report.status,'counterexample');assert.equal(report.complete,true);
  assert.equal(report.consistency.consistent,true);
  const row=report.properties[0];
  assert.equal(row.status,'counterexample');assert.equal(row.witness.verified,true);
  const actual=compileModel(row.witness.model),evaluator=new Evaluator(actual);
  assert.equal(evaluator.check(parseFormula('chosen("red") and chosen("blue")')).holds,true);
  assert.equal(replayExperiment(row.evidence).verified,true);
  assert.equal(row.evidence.sourceMarkdown,markdown);
  assert.deepEqual(row.evidence.retainedAxioms,['NoConstraint']);
});

test('fixed event histories can be inconsistent, and weakening EchoNE changes the result',async()=>{
  const markdown=echoSource();
  const original=await runExperiment(markdown,{mode:'synthesize'});
  assert.equal(original.status,'no-model');assert.equal(original.consistency.consistent,false);
  assert.equal(original.properties[0].status,'not-tested');
  const weakened=await runExperiment(markdown,{mode:'synthesize',droppedAxioms:['EchoNE']});
  assert.equal(weakened.status,'counterexample');
  assert.deepEqual(weakened.retainedAxioms,['Echo?']);
  assert.deepEqual(weakened.droppedAxioms,['EchoNE']);
  assert.equal(replayExperiment(weakened.properties[0].evidence).verified,true);
  assert.equal(parseDocument(markdown).axioms.length,2,'Per-run omission must preserve source declarations.');
});

test('contradictory assumptions never establish a property through vacuity',async()=>{
  const markdown=source(model(),'axiom Yes: flag\naxiom No: not flag\nproperty Goal: false');
  const result=await runExperiment(markdown,{mode:'synthesize'});
  assert.equal(result.status,'no-model');assert.equal(result.complete,true);
  assert.equal(result.consistency.consistent,false);
  assert.equal(result.properties[0].status,'not-tested');
  assert.equal(result.witness,null);
  const modelOnly=await runExperiment(markdown,{mode:'synthesize',droppedAxioms:['No'],selectedProperties:[]});
  assert.equal(modelOnly.status,'model');assert.equal(modelOnly.properties.length,0);
  assert.equal(replayExperiment(modelOnly.consistency.evidence).status,'model');
});

test('selected claims and assumption names are exact, with invalid choices rejected',async()=>{
  const markdown=source(model(),'axiom Kept?: true\nproperty Pass: true\nproperty Fail: false');
  const report=await runExperiment(markdown,{selectedProperties:['Pass']});
  assert.equal(report.status,'holds');assert.deepEqual(report.selectedProperties,['Pass']);
  assert.equal(report.properties.length,1);
  await assert.rejects(runExperiment(markdown,{selectedProperties:['Typo']}),/Unknown/);
  await assert.rejects(runExperiment(markdown,{droppedAxioms:['Typo']}),/Unknown/);
  await assert.rejects(runExperiment(markdown,{selectedProperties:['Pass','Pass']}),/duplicate/);
});

test('bounded history search exhausts the exact small silent-history class without duplicate insertion orders',async()=>{
  const data=model({participants:['p','q'],values:['v'],signature:{events:[],predicates:['flag']},quorums:{v:[['p']]}});
  const markdown=source(data,'axiom Empty: true\nproperty Tautology: true');
  const report=await runExperiment(markdown,{mode:'search',maxAdditionalNodes:2,maxModels:100,palette:[null]});
  assert.equal(report.status,'holds');assert.equal(report.complete,true);
  assert.equal(report.stats.histories,8);
  assert.equal(report.stats.modelsSatisfyingAssumptions,8);
});

test('a history candidate cap leaves unsettled claims incomplete rather than proved',async()=>{
  const data=model({signature:{events:['E'],predicates:['flag']}});
  const markdown=source(data,'axiom Empty: true\nproperty Tautology: true');
  const report=await runExperiment(markdown,{mode:'search',maxAdditionalNodes:3,maxModels:1,palette:[null,'E']});
  assert.equal(report.status,'incomplete');assert.equal(report.complete,false);
  assert.equal(report.consistency.consistent,true);
  assert.equal(report.properties[0].status,'incomplete');
});

test('bounded DAG synthesis can find nonsequential histories and save their full experiment',async()=>{
  const data=model({signature:{events:['E'],predicates:['flag']}});
  const markdown=source(data,'axiom Empty: true\nproperty Sequence: seq');
  const report=await runExperiment(markdown,{mode:'search',maxAdditionalNodes:2,maxModels:100,palette:[null,'E']});
  assert.equal(report.status,'counterexample');
  const evidence=report.properties[0].evidence;
  assert.equal(evidence.mode,'search');assert.equal(evidence.bounds.maxAdditionalNodes,2);
  assert.equal(compileModel(evidence.model).nodes.length,2);
  assert.equal(replayExperiment(evidence).verified,true);
});

test('replay rejects a changed witness that no longer falsifies its recorded claim',async()=>{
  const report=await runExperiment(chosenSource());
  const evidence=structuredClone(report.properties[0].evidence);
  evidence.model.facts=[];
  const replayed=replayExperiment(evidence);
  assert.equal(replayed.verified,false);assert.equal(replayed.status,'invalid');
  assert.match(replayed.reason,/not false|does not fail/);
});

test('replay checks exact retained assumptions, source claim and scope declarations',async()=>{
  const report=await runExperiment(chosenSource());
  const evidence=report.properties[0].evidence;
  const theory=structuredClone(evidence);theory.theory.axioms=[];
  assert.throws(()=>replayExperiment(theory),/retained theory/);
  const property=structuredClone(evidence);property.property.formula='false';
  assert.throws(()=>replayExperiment(property),/property does not match/);
  const scope=structuredClone(evidence);scope.model.values.push('green');scope.model.quorums.green=[['p']];
  assert.throws(()=>replayExperiment(scope),/declared values/);
});

test('pinned positive facts constrain synthesis; unpinning frees them while evaluate preserves the supplied interpretation',async()=>{
  const data=model({facts:[{place:'p',at:'*',atom:'flag'}]});
  const markdown=source(data,'axiom NoFlag: not flag\nproperty Goal: true');
  const pinned=await runExperiment(markdown,{mode:'synthesize',pinFacts:true});
  assert.equal(pinned.status,'no-model');
  const unpinned=await runExperiment(markdown,{mode:'synthesize',pinFacts:false});
  assert.equal(unpinned.status,'holds');
  assert.equal(replayExperiment(unpinned.consistency.evidence).verified,true);
  const evaluated=await runExperiment(markdown,{mode:'evaluate',pinFacts:false});
  assert.equal(evaluated.status,'no-model');assert.equal(evaluated.properties[0].status,'not-tested');
});

test('replay enforces pinned facts even when the omitted fact is not mentioned by any formula',async()=>{
  const data=model({facts:[{place:'p',at:'*',atom:'flag'}]});
  const report=await runExperiment(source(data,'axiom Empty: true\nproperty Failure: false'),{mode:'synthesize'});
  const evidence=structuredClone(report.properties[0].evidence);evidence.model.facts=[];
  assert.throws(()=>replayExperiment(evidence),/pinned predicate fact/);
});

test('all-world claim scope is retained and independently replayed',async()=>{
  const data=model({signature:{events:['E'],predicates:['flag']},nodes:[{id:'e',place:'p',event:'E',past:[]}]});
  const markdown=source(data,'axiom Empty: true\nproperty AtEnd: not E\nproperty Everywhere [all]: not E');
  const report=await runExperiment(markdown,{mode:'synthesize'});
  assert.equal(report.properties.find(p=>p.name==='AtEnd').status,'holds');
  const row=report.properties.find(p=>p.name==='Everywhere');
  assert.equal(row.status,'counterexample');assert.equal(row.evidence.property.scope,'all');
  assert.equal(replayExperiment(row.evidence).verified,true);
});

test('replay rejects malformed recorded bounds, retained labels and expected judgement metadata',async()=>{
  const report=await runExperiment(chosenSource());
  for(const change of [
    e=>{e.bounds.maxAdditionalNodes='oops';},
    e=>{e.retainedAxioms=['Bogus'];},
    e=>{e.expected='model';},
  ]) {
    const evidence=structuredClone(report.properties[0].evidence);change(evidence);
    assert.throws(()=>replayExperiment(evidence));
  }
  assert.throws(()=>replayExperiment(report.properties[0].evidence,{maxMilliseconds:0}),/positive/);
});

test('recorded all-world failure is checked at that exact current-event context',async()=>{
  const data=model({signature:{events:['E'],predicates:[]},nodes:[{id:'e',place:'p',event:'E',past:[]}]});
  const report=await runExperiment(source(data,'axiom Empty: true\nproperty Claim [all]: not E'));
  const evidence=structuredClone(report.properties[0].evidence);
  assert.equal(evidence.failure.event.symbol,'E');
  evidence.failure.event=null;
  const replayed=replayExperiment(evidence);
  assert.equal(replayed.verified,false);assert.equal(replayed.status,'invalid');
});

test('preparation that consumes the evaluate-mode deadline cannot be followed by a renewed check budget',async()=>{
  const markdown=chosenSource(),originalNow=Date.now;
  let clock=1000;
  Date.now=()=>clock;
  try {
    const input={get source(){clock=2000;return markdown;}};
    const report=await runExperiment(input,{mode:'evaluate',maxMilliseconds:10,selectedProperties:[]});
    assert.equal(report.status,'incomplete');assert.equal(report.complete,false);
  } finally {Date.now=originalNow;}
});

test('preparation that consumes a replay deadline cannot produce a verified certificate',async()=>{
  const report=await runExperiment(chosenSource());
  const evidence=structuredClone(report.properties[0].evidence),sourceMarkdown=evidence.sourceMarkdown;
  const originalNow=Date.now;let clock=1000;Date.now=()=>clock;
  try {
    Object.defineProperty(evidence,'sourceMarkdown',{get(){clock=2000;return sourceMarkdown;}});
    const replayed=replayExperiment(evidence,{maxMilliseconds:10});
    assert.equal(replayed.verified,false);assert.equal(replayed.status,'incomplete');
  } finally {Date.now=originalNow;}
});

test('evaluate property checks do not renew the experiment deadline after a slow progress observer',async()=>{
  const markdown=source(model(),'axiom Empty: true\nproperty Goal: true');
  const originalNow=Date.now;let clock=1000;Date.now=()=>clock;
  try {
    const report=await runExperiment(markdown,{mode:'evaluate',maxMilliseconds:10},event=>{if(event.phase==='evaluate')clock=2000;});
    assert.equal(report.status,'incomplete');assert.equal(report.properties[0].status,'incomplete');
  } finally {Date.now=originalNow;}
});

test('SAT consistency calls honor the absolute experiment deadline after a slow progress observer',async()=>{
  const markdown=chosenSource(),originalNow=Date.now;let clock=1000;Date.now=()=>clock;
  try {
    const report=await runExperiment(markdown,{mode:'synthesize',maxMilliseconds:10,selectedProperties:[]},event=>{if(event.phase==='consistency')clock=2000;});
    assert.equal(report.status,'incomplete');assert.equal(report.consistency.consistent,null);
  } finally {Date.now=originalNow;}
});

test('CLI lists named rules, weakens a theory, saves evidence and independently replays it',async()=>{
  const root=dirname(dirname(fileURLToPath(import.meta.url)));
  const dir=await mkdtemp(join(root,'.experiment-cli-'));
  const file=join(dir,'echo.md'),evidenceDirectory=join(dir,'evidence');
  const run=(...args)=>{
    const child=spawnSync(process.execPath,[join(root,'src/cli.mjs'),...args],{cwd:root,encoding:'utf8',timeout:15000,maxBuffer:10000000});
    assert.ifError(child.error);return child;
  };
  try {
    await writeFile(file,echoSource());
    const listed=run('list',file);assert.equal(listed.status,0);
    assert.deepEqual(JSON.parse(listed.stdout).axioms.map(a=>a.name),['Echo?','EchoNE']);
    const inconsistent=run('run',file);assert.equal(inconsistent.status,3);
    assert.equal(JSON.parse(inconsistent.stdout).status,'no-model');
    const weakened=run('run',file,'--drop','EchoNE','--property','EchoAgreement','--evidence',evidenceDirectory);
    assert.equal(weakened.status,1);
    const saved=JSON.parse(weakened.stdout).savedEvidence;
    assert.equal(saved.length,1);
    assert.equal(JSON.parse(await readFile(saved[0],'utf8')).expected,'counterexample');
    const replayed=run('replay',saved[0]);assert.equal(replayed.status,0);
    assert.equal(JSON.parse(replayed.stdout).verified,true);
    const modelOnly=run('run',file,'--drop','EchoNE','--properties','none');assert.equal(modelOnly.status,0);
    assert.equal(JSON.parse(modelOnly.stdout).status,'model');
    const typo=run('run',file,'--drop','Typo');assert.equal(typo.status,2);
  } finally {await rm(dir,{recursive:true,force:true});}
});
