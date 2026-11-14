#!/usr/bin/env node
/** Portable CLI. JSON results go to stdout; diagnostics go to stderr.
 * Exit codes: 0 = passed/exhausted, 1 = failed/counterexample,
 * 2 = error/incomplete, 3 = no axiom model in the requested scope. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import {join} from 'node:path';
import { compileModel } from './model.mjs';
import { parseFormula } from './parser.mjs';
import { Evaluator } from './evaluator.mjs';
import { checkTheory, correctnessProperties, THEORY_NAMES } from './theories.mjs';
import { explore } from './search.mjs';
import {checkCustomTheory} from './custom.mjs';
import {parseDocument,selectTheory} from './document.mjs';
import {runExperiment,replayExperiment} from './experiment.mjs';

const help = `History Structure Model-checker 0.6.9

Theory-first experiments (Markdown):
  node src/cli.mjs list examples/theories/hbb2.md
  node src/cli.mjs run examples/theories/first-steps.md [--mode synthesize|search|evaluate]
                    [--property NAME] [--drop NAME] [--properties all|none]
                    [--nodes 2] [--models 1000] [--palette PALETTE.json]
                    [--milliseconds 10000] [--decisions 100000] [--compile-nodes 500000]
                    [--pin-facts true|false] [--families 256] [--steps N] [--evidence DIRECTORY]
  node src/cli.mjs replay EVIDENCE.json [--milliseconds 15000] [--steps N]
Repeat --drop or --property to select several declarations. Use --drop ThyLive to remove that entire dynamic group.
Modes: synthesize keeps the declared history and chooses predicate facts;
search also explores history extensions within the stated bounds;
evaluate checks the supplied facts, treating unlisted facts as false.
Markdown runs keep every declared axiom unless --drop is supplied; browser example omissions are not applied automatically.
First steps intentionally finds a counterexample: its exit code 1 is expected.

Explicit supplied-model tools (JSON):
  node src/cli.mjs validate MODEL.json
  node src/cli.mjs check MODEL.json --formula 'end past echo("v")' [--scope end|all|world]
  node src/cli.mjs theory MODEL.json --theory ThyHBB1 [--families 256]
  node src/cli.mjs custom MODEL.json --axioms AXIOMS.json
  node src/cli.mjs properties MODEL.json --theory ThyHBB1
  node src/cli.mjs explore MODEL.json --formula 'seq' --nodes 2 [--theory ThyLive]
                       [--palette PALETTE.json] [--models 1000] [--milliseconds 5000]
                       [--witness WITNESS.json]

World selection: --scope world --place p --time end|empty|NODE_ID --event 'null|{"symbol":"echo","args":["v"]}'
All commands accept --output RESULT.json. Current v2 projects are accepted by run/list and model commands.
For project runs, saved options are defaults; explicit flags override only their corresponding options.
Apply any unfinished model JSON edits in the interface before using that project with the CLI.
Theory axioms use all-world validity. Properties default to end-of-time validity.
If the retained assumptions have no model in the selected scope, properties are not tested.
Exit: 0 passed/bounded space exhausted or successful replay; 1 failed/counterexample; 2 error/incomplete; 3 no model of assumptions.
`;

async function json(path) { return JSON.parse(await readFile(path,'utf8')); }
function parseArgs(args) {
  const positional = [], flags = {};
  for (let i=0;i<args.length;i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (!key || i+1>=args.length || args[i+1].startsWith('--')) throw new Error(`Option --${key} needs a value.`);
      if (['drop','property'].includes(key)) (flags[key]??=[]).push(args[++i]);
      else {
        if (Object.hasOwn(flags,key)) throw new Error(`Duplicate option --${key}.`);
        flags[key] = args[++i];
      }
    } else positional.push(args[i]);
  }
  const allowed = new Set(['formula','scope','theory','families','axioms','nodes','palette','models','milliseconds','witness','place','time','event','output','mode','drop','property','properties','decisions','compile-nodes','pin-facts','evidence','steps']);
  for (const key of Object.keys(flags)) if (!allowed.has(key)) throw new Error(`Unknown option --${key}.`);
  return {positional,flags};
}
function number(flags,key,fallback) {
  if (!(key in flags)) return fallback;
  if (!/^\d+$/.test(flags[key])) throw new Error(`--${key} needs a nonnegative integer.`);
  const n = Number(flags[key]);
  if (!Number.isSafeInteger(n)) throw new Error(`--${key} is too large.`);
  return n;
}
async function emit(result,flags) {
  const output=JSON.stringify(result,null,2)+'\n';
  if(flags.output)await writeFile(flags.output,output);
  process.stdout.write(output);
  if(result.verified===true)process.exitCode=0;
  else if(result.verified===false&&result.status!=='incomplete')process.exitCode=1;
  else if(result.status==='no-model')process.exitCode=3;
  else if(result.status==='incomplete'||result.complete===false||result.holds===null)process.exitCode=2;
  else if(result.holds===false||result.status==='counterexample')process.exitCode=1;
}
function projectDocument(data) {
  if (typeof data.sourceMarkdown!=='string') throw new Error('A v2 project needs sourceMarkdown text.');
  if (Object.hasOwn(data,'unappliedModelSource')) throw new Error('This project has unapplied model JSON edits. Apply the model to the theory in the interface, save the project, then run the CLI.');
  if (data.options!==undefined&&(!data.options||typeof data.options!=='object'||Array.isArray(data.options))) throw new Error('Project options must be an object.');
  const doc=parseDocument(data.sourceMarkdown),options=data.options??{};
  selectTheory(doc,options);
  return {doc,options};
}
async function theoryInput(path) {
  const source=await readFile(path,'utf8');
  if(source.trimStart().startsWith('{')) {
    const data=JSON.parse(source);
    if(data.format!=='history-structure-project/v2') throw new Error('Theory run/list accepts Markdown or a history-structure-project/v2 JSON file.');
    return projectDocument(data);
  }
  return {doc:parseDocument(source),options:{}};
}
async function markdownCommand(command,path,flags) {
  if(command==='replay') {
    return replayExperiment(await json(path),{maxMilliseconds:number(flags,'milliseconds',15000),...('steps' in flags?{maxSteps:number(flags,'steps')}:{})});
  }
  const {doc,options:savedOptions}=await theoryInput(path);
  if(command==='list')return {name:doc.name,model:{participants:doc.model.participants,values:doc.model.values,nodes:doc.model.nodes?.length??0},axioms:[...(doc.includeLive?[{name:'ThyLive',kind:'dynamic scheme group'}]:[]),...doc.axioms.map(({name,kind,formula,line})=>({name,kind,formula,line}))],properties:doc.properties.map(({name,scope,formula,line})=>({name,scope,formula,line}))};
  if(flags.properties&&!['all','none'].includes(flags.properties))throw new Error('--properties must be all or none.');
  if(flags.properties&&flags.property)throw new Error('Choose --properties or repeated --property, not both.');
  if(flags['pin-facts']&&!['true','false'].includes(flags['pin-facts']))throw new Error('--pin-facts must be true or false.');
  const options={mode:'synthesize',droppedAxioms:[],selectedProperties:undefined,
    maxMilliseconds:10000,maxAdditionalNodes:2,maxModels:1000,maxDecisions:100000,
    maxCompilationNodes:500000,maxKnowledgeFamilies:256,pinFacts:true,...savedOptions};
  if ('mode' in flags) options.mode=flags.mode;
  if ('drop' in flags) options.droppedAxioms=flags.drop;
  if ('property' in flags) options.selectedProperties=flags.property;
  if ('properties' in flags) options.selectedProperties=flags.properties==='none'?[]:doc.properties.map(row=>row.name);
  if ('pin-facts' in flags) options.pinFacts=flags['pin-facts']==='true';
  const limits={milliseconds:'maxMilliseconds',nodes:'maxAdditionalNodes',models:'maxModels',decisions:'maxDecisions','compile-nodes':'maxCompilationNodes',families:'maxKnowledgeFamilies',steps:'maxSteps'};
  for (const [flag,key] of Object.entries(limits)) if (flag in flags) options[key]=number(flags,flag);
  if ('palette' in flags) options.palette=await json(flags.palette);
  const result=await runExperiment(doc,options);
  if(flags.evidence) {
    await mkdir(flags.evidence,{recursive:true});
    const rows=result.properties.filter(p=>p.evidence);
    if(!rows.length&&result.consistency?.evidence)rows.push({...result.consistency,name:'axiom-model'});
    result.savedEvidence=[];
    for(const [i,row]of rows.entries()) {
      const label=row.name.replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'')||'witness';
      const file=join(flags.evidence,`${String(i+1).padStart(2,'0')}-${label}-v0.6.9.json`);
      await writeFile(file,JSON.stringify(row.evidence,null,2)+'\n');result.savedEvidence.push(file);
    }
  }
  return result;
}
async function main() {
  if (process.argv.length <= 2 || ['help','--help','-h'].includes(process.argv[2])) { process.stdout.write(help); return; }
  const {positional,flags} = parseArgs(process.argv.slice(2));
  const [command,path,...extra] = positional;
  if (!path || extra.length) throw new Error('Supply one command and one input file path. Use --help for examples.');
  const accepted = {
    list:['output'],
    run:['output','mode','drop','property','properties','nodes','models','palette','milliseconds','decisions','compile-nodes','pin-facts','families','evidence','steps'],
    replay:['output','milliseconds','steps'],
    validate:['output'],
    check:['formula','scope','place','time','event','milliseconds','output','steps'],
    theory:['theory','families','milliseconds','output','steps'],
    custom:['axioms','families','milliseconds','output','steps'],
    properties:['theory','milliseconds','output','steps'],
    explore:['formula','scope','theory','axioms','families','nodes','palette','models','milliseconds','witness','output','steps'],
  };
  if (!Object.hasOwn(accepted,command)) throw new Error(`Unknown command ${command}. Use --help.`);
  for (const key of Object.keys(flags)) if (!accepted[command].includes(key)) throw new Error(`Option --${key} is not supported by ${command}.`);
  if (command==='explore' && flags.theory && flags.axioms) throw new Error('Choose either --theory or --axioms for exploration assumptions.');
  if (command==='check' && (flags.scope??'end')!=='world' && ['place','time','event'].some(k=>k in flags)) throw new Error('--place, --time and --event require --scope world.');
  if(['list','run','replay'].includes(command)){await emit(await markdownCommand(command,path,flags),flags);return;}
  const loaded = await json(path);
  const data = loaded.format==='history-structure-project/v2' ? projectDocument(loaded).doc.model : loaded.format==='history-structure-project/v1' ? typeof loaded.modelSource==='string' ? JSON.parse(loaded.modelSource) : loaded.model : loaded;
  const model = compileModel(data);
  const maxMilliseconds = number(flags,'milliseconds',10000);
  const maxKnowledgeFamilies = number(flags,'families',256);
  const stepOptions = 'steps' in flags ? {maxSteps:number(flags,'steps')} : {};
  let result;
  if (command==='validate') result={valid:true,name:data.name??'',tuples:model.nodes.length,inputNodes:model.rawNodeCount,times:model.times.length,participants:model.participants.length,values:model.values.length};
  else if (command==='check') {
    if (!flags.formula) throw new Error('--formula is required.');
    const scope = flags.scope??'end';
    const world = {place:flags.place??model.participants[0],time:flags.time??'end',event:flags.event?JSON.parse(flags.event):null};
    result=new Evaluator(model,{maxMilliseconds,...stepOptions}).check(parseFormula(flags.formula),{scope,world});
  } else if (command==='theory') {
    if (!flags.theory) throw new Error('--theory is required.');
    result=checkTheory(model,flags.theory,{maxKnowledgeFamilies,maxMilliseconds,...stepOptions});
  } else if (command==='custom') {
    if (!flags.axioms) throw new Error('--axioms is required.');
    const axioms=await json(flags.axioms);
    result=checkCustomTheory(model,axioms,{maxMilliseconds,maxKnowledgeFamilies,...stepOptions});
  } else if (command==='properties') {
    if (!flags.theory) throw new Error('--theory is required.');
    if (!THEORY_NAMES.includes(flags.theory) || flags.theory==='ThyLive') throw new Error('Correctness properties require ThyHBB1, ThyHBB2 or ThyHBB3.');
    const rows=correctnessProperties(flags.theory).map(p=>({name:p.name,formula:p.formula,...new Evaluator(model,{maxMilliseconds,...stepOptions}).check(p.ast??parseFormula(p.formula),{scope:'end'})}));
    result={holds:rows.every(r=>r.holds),complete:true,properties:rows,qualification:'These are property checks on this model. Validate the protocol theory separately.'};
  } else if (command==='explore') {
    const palette=flags.palette?await json(flags.palette):undefined;
    const assumptions=flags.axioms?await json(flags.axioms):flags.theory??'none';
    result=await explore(data,{property:flags.formula,scope:flags.scope??'end',palette,assumptions,maxAdditionalNodes:number(flags,'nodes',2),maxModels:number(flags,'models',1000),maxMilliseconds,maxKnowledgeFamilies,...stepOptions});
    if (flags.witness && result.witness) await writeFile(flags.witness,JSON.stringify(result.witness.model,null,2)+'\n');
  } else throw new Error(`Unknown command ${command}. Use --help.`);
  const output=JSON.stringify(result,null,2)+'\n';
  if (flags.output) await writeFile(flags.output,output);
  process.stdout.write(output);
  if (result.holds===false || result.status==='counterexample') process.exitCode=1;
  else if (result.status==='incomplete' || result.complete===false || result.holds===null) process.exitCode=2;
}
main().catch(error=>{process.stderr.write(`${error.name}: ${error.message}\n`);process.exitCode=2;});
