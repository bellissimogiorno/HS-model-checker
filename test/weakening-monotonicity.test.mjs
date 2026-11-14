/** Independent consequences of axiom removal.
 *
 * These checks do not assume that every weakening must break correctness.
 * They preserve existing concrete countermodels and compare a small bounded
 * SAT query with an ordinary Boolean oracle written without the evaluator.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseDocument} from '../src/document.mjs';
import {compileModel} from '../src/model.mjs';
import {Evaluator} from '../src/evaluator.mjs';
import {parseFormula} from '../src/parser.mjs';
import {createEvidence,replayExperiment,runExperiment} from '../src/experiment.mjs';

const root=new URL('../',import.meta.url);
const readJSON=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const canonicalNames=new Set(['Liveness 1','Liveness 2','Agreement']);

function source(model,declarations) {
  return '# Axiom-removal oracle\n\n```hsm-model\n'+JSON.stringify(model,null,2)+'\n```\n\n```hsm\n'+declarations+'\n```\n';
}
function frame(changes={}) {
  return {
    format:'history-structure-model/v1',participants:['p'],values:['red','blue'],
    signature:{events:[],predicates:['chosen','flag']},nodes:[],
    quorums:{red:[['p']],blue:[['p']]},facts:[],...changes,
  };
}

test('every bundled canonical HBB countermodel survives an additional axiom removal on its identical concrete history',async()=>{
  const tour=await readJSON('reports/weakening-tour/report.json');
  let checked=0,additionalLiveRemovals=0;
  const suites=new Set(),liveRemovalSuites=new Set();
  for(const row of tour.cases) {
    for(const path of row.savedEvidence) {
      const evidence=await readJSON('reports/weakening-tour/'+path);
      if(!evidence.property||!canonicalNames.has(evidence.property.name))continue;
      const original=JSON.stringify(evidence);
      assert.equal(replayExperiment(evidence,{maxMilliseconds:60000}).verified,true,path);
      const doc=parseDocument(evidence.sourceMarkdown);
      const model=compileModel(evidence.model),evaluator=new Evaluator(model,{maxMilliseconds:60000});
      assert.equal(evaluator.evaluate(parseFormula(evidence.property.formula),model.world(evidence.failure)),false,path);
      // At least one more literal rule is omitted in every case. This is a
      // restriction of obligations, not a change to the DAG, rho or property.
      const extra=evidence.retainedAxioms.find(name=>name!=='ThyLive');
      assert.ok(extra,`${path}: a retained rule remains available`);
      const removals=[extra];
      if(!liveRemovalSuites.has(row.suite)) {
        assert.ok(evidence.retainedAxioms.includes('ThyLive'));
        removals.push('ThyLive');liveRemovalSuites.add(row.suite);
      }
      for(const removed of removals) {
        const droppedAxioms=[...evidence.droppedAxioms,removed];
        const derived=createEvidence(doc,{
          ...structuredClone(evidence.bounds),mode:evidence.mode,droppedAxioms,
          selectedProperties:[evidence.property.name],
        },{
          ...evidence.property,
          witness:{model:evidence.model,result:{failures:[evidence.failure]}},
        });
        assert.deepEqual(derived.model,evidence.model,'The countermodel interpretation and history must stay exact.');
        assert.deepEqual(derived.property,evidence.property);
        assert.deepEqual(derived.failure,evidence.failure);
        assert.deepEqual(derived.retainedAxioms,evidence.retainedAxioms.filter(name=>name!==removed));
        const replay=replayExperiment(derived,{maxMilliseconds:60000});
        assert.equal(replay.verified,true,`${path}: additionally remove ${removed}`);
        assert.equal(replay.status,'counterexample');
        assert.equal(replay.assumptions.complete,true);
        assert.equal(replay.assumptions.holds,true);
        assert.equal(replay.assumptions.includeLive,removed!=='ThyLive');
        if(removed==='ThyLive')additionalLiveRemovals++;
      }
      assert.equal(JSON.stringify(evidence),original,'Deriving a weaker experiment must not mutate its stronger certificate.');
      suites.add(row.suite);checked++;
    }
  }
  assert.deepEqual([...suites].sort(),['hbb1','hbb2','hbb3']);
  assert.equal(checked,20,'All shipped canonical correctness countermodels are exercised.');
  assert.equal(additionalLiveRemovals,3,'The complete dynamic assumption group is also removable in each protocol.');
});

test('a hand-enumerated interpretation oracle distinguishes an essential removal from an irrelevant one without mutating the baseline',async()=>{
  const markdown=source(frame(),[
    'axiom SomeChoice?: ∃ v. chosen(v)',
    'axiom UniqueChoice!!: ∃¹ v. chosen(v)',
    'axiom Flag!: flag',
    'property Unique [end]: ∃¹ v. chosen(v)',
    'property Red [end]: chosen("red")',
  ].join('\n'));
  const document=parseDocument(markdown),before=JSON.stringify(document);
  // There is one represented time, one place and exactly three relevant
  // predicate atoms. Ordinary truth functions enumerate all eight rho values;
  // this oracle calls neither parseFormula, Evaluator nor the SAT compiler.
  const interpretations=Array.from({length:8},(_,bits)=>({
    red:!!(bits&1),blue:!!(bits&2),flag:!!(bits&4),bits,
  }));
  const assumptions=(rho,dropped)=>
    (dropped.has('SomeChoice?')||rho.red||rho.blue)&&
    (dropped.has('UniqueChoice!!')||rho.red!==rho.blue)&&
    (dropped.has('Flag!')||rho.flag);
  const propertyTruth={Unique:rho=>rho.red!==rho.blue,Red:rho=>rho.red};
  const variants=[[],['UniqueChoice!!'],['Flag!'],[]];
  let strongModels;
  for(const droppedAxioms of variants) {
    const dropped=new Set(droppedAxioms),admitted=interpretations.filter(rho=>assumptions(rho,dropped));
    assert.ok(admitted.length);
    if(!dropped.size)strongModels=admitted;
    else for(const rho of strongModels)assert.ok(admitted.includes(rho),'Removing an axiom enlarges the same finite interpretation class.');
    const report=await runExperiment(document,{
      mode:'synthesize',pinFacts:false,droppedAxioms,selectedProperties:['Unique','Red'],maxMilliseconds:10000,
    });
    assert.equal(report.complete,true);
    assert.equal(report.consistency.consistent,true);
    for(const result of report.properties) {
      const failures=admitted.filter(rho=>!propertyTruth[result.name](rho));
      assert.equal(result.status,failures.length?'counterexample':'holds');
      if(result.status==='counterexample') {
        const model=compileModel(result.witness.model),time=model.fullTime.index;
        const decoded={
          red:model.hasFact('p',time,{symbol:'chosen',args:['red']}),
          blue:model.hasFact('p',time,{symbol:'chosen',args:['blue']}),
          flag:model.hasFact('p',time,{symbol:'flag',args:[]}),
        };
        assert.ok(failures.some(rho=>rho.red===decoded.red&&rho.blue===decoded.blue&&rho.flag===decoded.flag));
        assert.equal(replayExperiment(result.evidence).verified,true);
      }
    }
    const unique=report.properties.find(row=>row.name==='Unique');
    assert.equal(unique.status,dropped.has('UniqueChoice!!')?'counterexample':'holds');
    assert.deepEqual(report.droppedAxioms,droppedAxioms);
    assert.equal(JSON.stringify(document),before,'All repeated runs share an unchanged parsed baseline.');
    assert.equal(document.source,markdown);
  }
});

test('inconsistent histories seen before a generation cap do not establish inconsistency over the requested bounds',async()=>{
  const markdown=source(frame({
    values:['v'],quorums:{v:[['p']]},signature:{events:['E'],predicates:[]},
  }),[
    'axiom Occurs!: ↕ E',
    'property Sequential [end]: seq',
  ].join('\n'));
  const options={mode:'search',palette:['E'],maxMilliseconds:10000};
  const capped=await runExperiment(markdown,{...options,maxAdditionalNodes:1,maxModels:1});
  assert.equal(capped.stats.histories,1);
  assert.equal(capped.status,'incomplete');
  assert.equal(capped.complete,false);
  assert.equal(capped.consistency.consistent,null);
  assert.equal(capped.properties[0].status,'not-tested');
  const emptyScope=await runExperiment(markdown,{...options,maxAdditionalNodes:0,maxModels:1});
  assert.equal(emptyScope.status,'no-model');
  assert.equal(emptyScope.complete,true);
  assert.equal(emptyScope.consistency.consistent,false);
  assert.equal(emptyScope.properties[0].status,'not-tested');
  const completed=await runExperiment(markdown,{...options,maxAdditionalNodes:1,maxModels:2});
  assert.equal(completed.status,'holds');
  assert.equal(completed.complete,true);
  assert.equal(completed.consistency.consistent,true);
  assert.equal(completed.stats.histories,2);
  assert.equal(completed.properties[0].status,'holds');
  assert.equal(replayExperiment(completed.consistency.evidence).verified,true);
});
