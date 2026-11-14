import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runWeakeningTour} from '../demo.mjs';
import {parseDocument} from '../src/document.mjs';
import {compileModel} from '../src/model.mjs';
import {Evaluator} from '../src/evaluator.mjs';
import {correctnessProperties} from '../src/theories.mjs';
import {parseFormula} from '../src/parser.mjs';

const ROOT=dirname(dirname(fileURLToPath(import.meta.url)));

test('the reproducible tour checks all three claims, complete retained schemes and every saved certificate',async()=>{
  const output=await mkdtemp(join(ROOT,'.weakening-tour-'));
  try {
    const report=await runWeakeningTour({outputDirectory:output,suite:'hbb2'});
    assert.equal(report.status,'passed');
    assert.equal(report.version,'0.6.9');
    assert.equal(report.cases.length,10);
    assert.equal(report.evidenceCount,12);
    assert.equal(report.verifiedEvidenceCount,report.evidenceCount);
    assert.deepEqual(JSON.parse(await readFile(join(output,'report.json'),'utf8')),report);
    assert.match(await readFile(join(output,'REPORT.md'),'utf8'),/no-model row establishes inconsistency/);
    const weak=report.cases.filter(row=>row.status==='counterexample');
    assert.equal(weak.length,5);
    assert.deepEqual(report.cases[0].properties.map(p=>[p.status,p.scenarioPresent]),[['holds',true],['holds',true],['holds',true]]);
    for(const row of report.cases) {
      assert.equal(row.complete,true);
      assert.ok(row.retainedAxioms.includes('ThyLive'));
      assert.deepEqual(row.properties.map(p=>p.name),['Liveness 1','Liveness 2','Agreement']);
      const saved=JSON.parse(await readFile(join(output,row.id,'run.json'),'utf8'));
      assert.equal(saved.status,row.status);
      if(!row.consistent) {
        assert.equal(row.status,'no-model');
        assert.ok(row.properties.every(p=>p.status==='not-tested'&&p.scenarioPresent===null));
        assert.equal(row.savedEvidence.length,0);
      } else {
        for(const replay of row.replays) {
          assert.equal(replay.verified,true);
          assert.equal(replay.retainedAxiomCounts.failed,0);
          assert.equal(replay.retainedAxiomCounts.inconclusive,0);
          assert.equal(replay.retainedAxiomCounts.passed,replay.retainedAxiomCounts.total);
        }
        for(const p of row.properties.filter(p=>p.status==='counterexample')) {
          assert.equal(p.scenarioPresent,true);
          assert.equal(p.failure.premiseHolds,true);
          assert.equal(p.failure.triggerHolds,true);
          assert.equal(p.failure.conclusionHolds,false);
          assert.equal(p.failure.explanation.holds,false);
          if(p.name.startsWith('Liveness'))assert.equal(p.failure.participantIsLive,true);
        }
        // A separate Node process reparses and rechecks the saved certificate;
        // success flags in report.json cannot make this replay succeed.
        for(const path of row.savedEvidence) {
          const child=spawnSync(process.execPath,[join(ROOT,'src/cli.mjs'),'replay',join(output,path)],{cwd:ROOT,encoding:'utf8',timeout:30000,maxBuffer:10000000});
          assert.ifError(child.error);
          assert.equal(child.status,0,`${path}: ${child.stderr}`);
          assert.equal(JSON.parse(child.stdout).verified,true);
        }
      }
    }
    const delivery=report.cases.find(row=>row.id==='deliver-progress-removed');
    assert.deepEqual(delivery.properties.filter(p=>p.status==='counterexample').map(p=>p.failure.world.place),['q','q']);
    assert.deepEqual(delivery.originalFailingRules,['Deliver!']);
    assert.ok((await readdir(output)).includes('REPORT.md'));
  } finally {await rm(output,{recursive:true,force:true});}
});

test('live-only EchoNE keeps the same NoLive history and only changes the non-equivocation formula',async()=>{
  const read=async name=>parseDocument(await readFile(join(ROOT,'examples/theories',name),'utf8'));
  const full=await read('echo-ne.md'),weak=await read('echo-ne-live-only.md');
  assert.deepEqual(weak.model,full.model);
  assert.deepEqual(weak.axioms.filter(a=>a.name!=='EchoNE').map(({name,kind,formula})=>({name,kind,formula})),full.axioms.filter(a=>a.name!=='EchoNE').map(({name,kind,formula})=>({name,kind,formula})));
  assert.deepEqual(weak.axioms.find(a=>a.name==='EchoNE').ast,parseFormula('forall v,w. live -> echo(v) -> past echo(w) -> v=w'));
  assert.deepEqual(weak.axioms.find(a=>a.name==='NoLive').ast,parseFormula('not live'));
  const model=compileModel(weak.model),properties=correctnessProperties('ThyHBB2');
  assert.equal(new Evaluator(model).check(properties.find(p=>p.name==='Agreement').ast).holds,false);
  assert.equal(new Evaluator(model).check(properties.find(p=>p.name==='Agreement').nonvacuityAst).holds,true);
});

test('tour CLI explains usage and rejects invalid requests with a nonzero status',async()=>{
  const run=(...args)=>spawnSync(process.execPath,[join(ROOT,'demo.mjs'),...args],{cwd:ROOT,encoding:'utf8',timeout:30000});
  assert.equal(run('--help').status,0);
  for(const args of [['--output'],['--typo']]) {
    const child=run(...args);
    assert.equal(child.status,1);
    assert.match(child.stderr,/Unknown or incomplete option/);
  }
  await assert.rejects(runWeakeningTour({maxMilliseconds:0}),/positive and finite/);
  await assert.rejects(runWeakeningTour({suite:'unknown'}),/Unknown suite/);
});

test('all three protocol suites separate canonical counterexamples from incorrect-axiom diagnostics',async()=>{
  const report=await runWeakeningTour();
  assert.equal(report.suite,'all');
  assert.equal(report.cases.length,37);
  assert.equal(report.evidenceCount,45);
  assert.equal(report.verifiedEvidenceCount,45);
  assert.equal(report.diagnosticCount,2);
  assert.deepEqual(Object.keys(report.propertiesByTheory),['ThyHBB1','ThyHBB2','ThyHBB3']);
  for(const row of report.cases){
    assert(row.retainedAxioms.includes('ThyLive'));
    assert.equal(row.complete,true);
    for(const p of row.properties.filter(p=>p.status==='counterexample')){
      assert.equal(p.failure.premiseHolds,true);
      assert.equal(p.failure.triggerHolds,true);
      assert.equal(p.failure.conclusionHolds,false);
    }
    for(const diagnostic of row.diagnostics){
      assert.equal(diagnostic.status,'counterexample');
      assert.equal(diagnostic.failure.holds,false);
      assert(!['Liveness 1','Liveness 2','Agreement'].includes(diagnostic.name));
    }
  }
  const badEcho=report.cases.find(c=>c.id==='hbb1-echo-choice-wrong');
  const badCorrelation=report.cases.find(c=>c.id==='hbb3-corr-definition-wrong');
  for(const row of [badEcho,badCorrelation]){
    assert.equal(row.status,'no-model');
    assert(row.properties.every(p=>p.status==='not-tested'));
  }
  const safety=report.cases.find(c=>c.id==='hbb1-vote-safe-omitted');
  assert.equal(safety.properties.find(p=>p.name==='Agreement').status,'counterexample');
  const relay=report.cases.find(c=>c.id==='hbb3-vote-prime-progress-removed');
  assert.equal(relay.properties.find(p=>p.name==='Liveness 2').status,'counterexample');
});
