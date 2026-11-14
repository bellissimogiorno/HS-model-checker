#!/usr/bin/env node
/** Reproducible HBB1/2/3 experiments. Histories are fixed, predicate valuations
 * are synthesized, and every returned model/counterexample is replayed. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseDocument,selectTheory} from './src/document.mjs';
import {runExperiment,replayExperiment} from './src/experiment.mjs';
import {correctnessProperties} from './src/theories.mjs';
import {compileModel} from './src/model.mjs';
import {checkCustomTheory} from './src/custom.mjs';
import {Evaluator} from './src/evaluator.mjs';
import {parseFormula} from './src/parser.mjs';

const ROOT=dirname(fileURLToPath(import.meta.url));
const SCOPE='Each exact declared finite history, value domain and quorum basis; all predicate interpretations with supplied positive facts pinned. No history extensions. These results are not unbounded proofs.';
const PROPERTY_NAMES=['Liveness 1','Liveness 2','Agreement'];
function requireResult(condition,message){if(!condition)throw new Error(message);}
function same(actual,expected,label){requireResult(JSON.stringify(actual)===JSON.stringify(expected),`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);}
const json=value=>JSON.stringify(value,null,2)+'\n';
const slug=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function falsifyingBinding(evaluator,ast,world,values){
  let body=ast;
  const variables=[];
  while(body.type==='forall'){variables.push(body.variable);body=body.body;}
  let bindings;
  const visit=(index,environment)=>{
    if(index===variables.length){if(!evaluator.evaluate(body,world,environment)){bindings={...environment};return true;}return false;}
    return values.some(value=>visit(index+1,{...environment,[variables[index]]:value}));
  };
  requireResult(visit(0,{}),'No falsifying value assignment was found at the recorded failure world.');
  return {body,bindings};
}

/** A false canonical conditional must exercise the premise and trigger at the
 * same world and value assignment. An unrelated existential scenario is not enough. */
function failureDetails(model,property,failure){
  const evaluator=new Evaluator(model),world=model.world(failure);
  const {body,bindings}=falsifyingBinding(evaluator,property.ast,world,model.values);
  requireResult(body.type==='implies'&&body.right.type==='implies',`${property.name}: canonical conditional shape changed.`);
  const premiseHolds=evaluator.evaluate(body.left,world,bindings);
  const triggerHolds=evaluator.evaluate(body.right.left,world,bindings);
  const conclusionHolds=evaluator.evaluate(body.right.right,world,bindings);
  same([premiseHolds,triggerHolds,conclusionHolds],[true,true,false],`${property.name}: nonvacuous failure`);
  const details={world:failure,bindings,premiseHolds,triggerHolds,conclusionHolds};
  if(property.name.startsWith('Liveness')){
    details.participantIsLive=evaluator.evaluate(parseFormula('live'),world);
    requireResult(details.participantIsLive,`${property.name}: failed participant is not live.`);
  }
  details.explanation=evaluator.explain(property.ast,world,{maxNodes:500,maxDepth:32});
  requireResult(details.explanation.holds===false,`${property.name}: explanation does not reproduce failure.`);
  return details;
}

/** Candidate-axiom probes are separate from the paper's correctness claims.
 * An overstrong incorrect axiom may reject valid behavior without refuting a theorem. */
function diagnosticDetails(model,property,failure){
  const evaluator=new Evaluator(model),world=model.world(failure);
  const {body,bindings}=falsifyingBinding(evaluator,property.ast,world,model.values);
  const detail={world:failure,bindings,holds:false};
  if(['implies','iff'].includes(body.type)){
    detail.connective=body.type;
    detail.leftHolds=evaluator.evaluate(body.left,world,bindings);
    detail.rightHolds=evaluator.evaluate(body.right,world,bindings);
  }
  detail.explanation=evaluator.explain(property.ast,world,{maxNodes:250,maxDepth:24});
  return detail;
}

async function casesFor(suite){
  const registry=JSON.parse(await readFile(join(ROOT,'examples/experiment-suites.json'),'utf8'));
  const suites=suite==='all'?registry.suites:registry.suites.filter(row=>row.id===suite);
  requireResult(suites.length>0,`Unknown suite ${JSON.stringify(suite)}. Choose all, hbb1, hbb2 or hbb3.`);
  const cases=[],matrices=[],ids=new Set();
  for(const entry of suites){
    const matrix=JSON.parse(await readFile(join(ROOT,'examples',entry.manifest),'utf8'));
    same(matrix.properties,PROPERTY_NAMES,`${entry.id}: correctness-property order`);
    matrices.push(`examples/${entry.manifest}`);
    for(const row of matrix.cases){
      requireResult(!ids.has(row.id),`Duplicate experiment ID ${row.id}.`);ids.add(row.id);
      cases.push({...row,suite:entry.id,theory:row.theory??matrix.theory});
    }
  }
  return {cases,matrices};
}

function markdownReport(report){
  const lines=['# Reproducible protocol and axiom-variant tour','',`Version ${report.version}; suite ${report.suite}. ${report.scope}`,'',
    '“Holds” means no counterexample in the exact scope above. “Scenario absent” identifies a true conditional whose complete premise and trigger are not jointly exercised. A no-model row establishes inconsistency of that fixed history with the retained assumptions; every correctness claim remains not tested.','',
    '| Theory | Case | Assumptions | Liveness 1 | Liveness 2 | Agreement |','|---|---|---|---|---|---|'];
  for(const row of report.cases){
    const cells=row.properties.map(p=>p.status==='not-tested'?'Not tested':p.status==='counterexample'?'**Fails; scenario present**':`Holds; scenario ${p.scenarioPresent?'present':'absent'}`);
    lines.push(`| ${row.theory} | ${row.label} | ${row.consistent?'Model; all retained axioms pass':'No model on fixed history'} | ${cells.join(' | ')} |`);
  }
  lines.push('',`${report.verifiedEvidenceCount}/${report.evidenceCount} model and counterexample certificates replayed successfully. Every consistent row retains complete dynamic ThyLive. Every failed canonical conditional has its premise and trigger checked at the same failure world and value assignment.`, '',
    'Concrete countermodels establish what the edited theory permits in these histories; they do not show every alternative weakening has the same consequence. Incorrect overstrong axiom candidates are assessed separately: rejecting an otherwise valid behavior is not a counterexample to a baseline correctness theorem.','',
    '## Paper-based diagnostic probes','','| Theory | Case | Probe | Result |','|---|---|---|---|');
  for(const row of report.cases)for(const probe of row.diagnostics){
    lines.push(`| ${row.theory} | ${row.label} | ${probe.name} | ${probe.status==='counterexample'?'Candidate/probe is false in a valid retained-theory model':probe.status} |`);
  }
  if(!report.diagnosticCount)lines.push('| — | — | No diagnostic probes in this suite | — |');
  lines.push('','## Concrete correctness failures','');
  for(const row of report.cases)for(const property of row.properties)if(property.failure){
    const f=property.failure;
    lines.push(`- **${row.label}, ${property.name}:** participant ${f.world.place}, time ${f.world.time}; ${Object.entries(f.bindings).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join(', ')}. Premise=true, trigger=true, conclusion=false${f.participantIsLive===true?'; participant live=true':''}.`);
  }
  lines.push('','## Source references','');
  for(const row of report.cases)lines.push(`- **${row.id}:** ${row.file}${row.paperReferences.length?'; '+row.paperReferences.join('; '):''}.`);
  if(report.outputDirectory){
    lines.push('','## Saved evidence','','Each case has `run.json`; consistent cases have a model certificate and certificates for false correctness properties or diagnostic probes. Replay with:', '',
      '```sh','node src/cli.mjs replay OUTPUT_DIRECTORY/CASE_ID/PROPERTY.evidence.json','```','');
    for(const row of report.cases)for(const file of row.savedEvidence)lines.push(`- [${row.id}: ${file.split('/').at(-1)}](${file})`);
  }
  return lines.join('\n')+'\n';
}

/** Run one suite or all suites. Explicit histories are not extended. Optional
 * output writes complete reports and replayable evidence; otherwise read-only. */
export async function runWeakeningTour({outputDirectory,suite='all',maxMilliseconds=60000,onCase=()=>{}}={}){
  requireResult(Number.isFinite(maxMilliseconds)&&maxMilliseconds>0,'maxMilliseconds must be positive and finite.');
  const selected=await casesFor(suite),output=outputDirectory===undefined?null:resolve(outputDirectory);
  if(output)await mkdir(output,{recursive:true});
  const report={format:'history-structure-weakening-tour/v2',version:'0.6.9',status:'passed',suite,scope:SCOPE,
    expectedMatrices:selected.matrices,outputDirectory:output,propertiesByTheory:{},cases:[],diagnosticCount:0,evidenceCount:0,verifiedEvidenceCount:0};
  for(const spec of selected.cases){
    const canonical=correctnessProperties(spec.theory);
    same(canonical.map(p=>p.name),PROPERTY_NAMES,`${spec.id}: canonical property names`);
    report.propertiesByTheory[spec.theory]??=canonical.map(({name,formula,scope,nonvacuity,source})=>({name,formula,scope,nonvacuity,source}));
    const source=await readFile(join(ROOT,'examples/theories',spec.file),'utf8'),doc=parseDocument(source);
    same(doc.properties.slice(0,3).map(p=>p.name),PROPERTY_NAMES,`${spec.id}: canonical properties must be first`);
    for(const property of canonical){
      const declared=doc.properties.find(p=>p.name===property.name);
      same(declared.ast,property.ast,`${spec.id}: ${property.name} formula`);
      same(declared.scope,property.scope,`${spec.id}: ${property.name} scope`);
    }
    requireResult(doc.includeLive&&!spec.droppedAxioms.includes('ThyLive'),`${spec.id}: full ThyLive must be retained.`);
    const limits={maxMilliseconds,maxCompilationNodes:spec.maxCompilationNodes??500000,maxDecisions:spec.maxDecisions??100000};
    const original=checkCustomTheory(doc.model,selectTheory(doc).theory,{maxMilliseconds});
    requireResult(original.complete,`${spec.id}: literal model audit incomplete.`);
    same(original.axioms.filter(a=>a.holds===false).map(a=>a.name),spec.expectedOriginalFailures,`${spec.id}: original failing rules`);
    const settings={mode:'synthesize',droppedAxioms:spec.droppedAxioms,pinFacts:true,...limits};
    const run=await runExperiment(doc,{...settings,selectedProperties:PROPERTY_NAMES});
    requireResult(run.complete,`${spec.id}: experiment incomplete (${run.reason}).`);
    same(run.status,spec.expectedStatus,`${spec.id}: run status`);
    same(run.properties.map(p=>p.status),spec.expectedProperties,`${spec.id}: correctness outcomes`);
    same(run.droppedAxioms,spec.droppedAxioms,`${spec.id}: omissions`);
    const row={id:spec.id,suite:spec.suite,theory:spec.theory,label:spec.label,category:spec.category??'weakening',
      file:`examples/theories/${spec.file}`,paperReferences:spec.paperReferences??[],limits,droppedAxioms:run.droppedAxioms,retainedAxioms:run.retainedAxioms,
      status:run.status,complete:run.complete,consistent:run.consistency.consistent,originalFailingRules:spec.expectedOriginalFailures,
      properties:[],diagnostics:[],replays:[],savedEvidence:[]};
    const directory=output?join(output,spec.id):null;
    if(directory){await mkdir(directory,{recursive:true});await writeFile(join(directory,'run.json'),json(run));}
    async function replayAndSave(evidence,name){
      requireResult(evidence,`${spec.id}: missing ${name} certificate.`);report.evidenceCount++;
      const replay=replayExperiment(evidence,{maxMilliseconds});
      requireResult(replay.verified===true,`${spec.id}: ${name} replay failed (${replay.reason??replay.status}).`);
      requireResult(replay.assumptions.complete&&replay.assumptions.holds&&replay.assumptions.includeLive,`${spec.id}: incomplete/false retained theory.`);
      requireResult(replay.assumptions.axioms.some(a=>a.name.startsWith('KnowledgeDia:'))&&replay.assumptions.axioms.some(a=>a.name.startsWith('KnowledgeBox:')),`${spec.id}: Knowledge schemes missing.`);
      report.verifiedEvidenceCount++;row.replays.push({name,verified:true,status:replay.status,retainedAxiomCounts:replay.assumptions.counts});
      if(directory){const file=join(directory,`${name}.evidence.json`);await writeFile(file,json(evidence));await writeFile(join(directory,`${name}.replay.json`),json(replay));row.savedEvidence.push(relative(output,file).split('\\').join('/'));}
    }
    if(run.consistency.consistent){
      await replayAndSave(run.consistency.evidence,'model');
      const model=compileModel(run.consistency.witness.model);
      for(let i=0;i<canonical.length;i++){
        const property=canonical[i],result=run.properties[i],evaluator=new Evaluator(model);
        const scenario=evaluator.check(property.nonvacuityAst,{scope:'end'}),checked=evaluator.check(property.ast,{scope:'end'});
        same(checked.holds,result.status==='holds',`${spec.id}: direct model ${property.name}`);
        same(scenario.holds,spec.expectedScenarios[i],`${spec.id}: ${property.name} scenario`);
        const p={name:property.name,status:result.status,scenarioPresent:scenario.holds};
        if(result.status==='counterexample'){
          await replayAndSave(result.evidence,slug(property.name));
          const failureModel=compileModel(result.evidence.model);
          p.failure=failureDetails(failureModel,property,result.evidence.failure);
          requireResult(new Evaluator(failureModel).evaluate(property.nonvacuityAst,failureModel.world(result.evidence.failure)),`${spec.id}: failed scenario absent.`);
          if(spec.expectedFailurePlace)same(p.failure.world.place,spec.expectedFailurePlace,`${spec.id}: failed participant`);
        }
        row.properties.push(p);
      }
    }else{
      same(run.consistency.consistent,false,`${spec.id}: consistency`);
      requireResult(run.witness===null,`${spec.id}: no-model must not present a witness.`);
      row.properties=run.properties.map(p=>({name:p.name,status:p.status,scenarioPresent:null}));
    }
    for(const probeSpec of spec.diagnosticProbes??[]){
      const declared=doc.properties.find(p=>p.name===probeSpec.name);
      requireResult(declared,`${spec.id}: diagnostic ${probeSpec.name} is not declared.`);
      const probeRun=await runExperiment(doc,{...settings,selectedProperties:[probeSpec.name]});
      requireResult(probeRun.complete,`${spec.id}: diagnostic check incomplete.`);
      const checked=probeRun.properties[0];
      same(checked.status,probeSpec.expectedStatus,`${spec.id}: diagnostic ${probeSpec.name}`);
      const diagnostic={name:probeSpec.name,formula:declared.formula,scope:declared.scope,status:checked.status,classification:'candidate-axiom or structural diagnostic; not a canonical correctness claim'};
      if(checked.status==='counterexample'){
        await replayAndSave(checked.evidence,'diagnostic-'+slug(probeSpec.name));
        diagnostic.failure=diagnosticDetails(compileModel(checked.evidence.model),declared,checked.evidence.failure);
      }
      if(directory)await writeFile(join(directory,'diagnostic-'+slug(probeSpec.name)+'.run.json'),json(probeRun));
      row.diagnostics.push(diagnostic);report.diagnosticCount++;
    }
    report.cases.push(row);await onCase(row);
  }
  if(output){await writeFile(join(output,'report.json'),json(report));await writeFile(join(output,'REPORT.md'),markdownReport(report));}
  return report;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2);let outputDirectory,suite='all';
    for(let i=0;i<args.length;i++){
      if(args[i]==='--output'&&args[i+1])outputDirectory=args[++i];
      else if(args[i]==='--suite'&&args[i+1])suite=args[++i];
      else if(args[i]==='--help'||args[i]==='-h'){console.log('Usage: node demo.mjs [--suite all|hbb1|hbb2|hbb3] [--output DIRECTORY]\nChecks canonical properties and separate paper-axiom probes; independently replays every certificate.');process.exit(0);}
      else throw new Error(`Unknown or incomplete option ${args[i]}. Use --help.`);
    }
    console.log(markdownReport(await runWeakeningTour({outputDirectory,suite})));
  }catch(error){console.error(`Weakening tour failed: ${error.message}`);process.exitCode=1;}
}
