/** Theory-first experiments, preserving 3muQL's consistency-before-validity
 * workflow with hbb-disc's two-valued histories. The same entry points serve
 * the browser worker and CLI. Results carry replayable, self-contained evidence. */
import {compileModel,eventKey,normalizeEvent} from './model.mjs';
import {Evaluator,EvaluationLimitError} from './evaluator.mjs';
import {checkCustomTheory} from './custom.mjs';
import {parseFormula} from './parser.mjs';
import {parseDocument,serializeDocument,selectTheory} from './document.mjs';
import {synthesize} from './synthesis.mjs';
import {historyFingerprint,ideals,generators,makePalette} from './search.mjs';
import {createRunSnapshot,verifyRunSnapshot,SEMANTICS_PROFILE} from './run-identity.mjs';

const clone = value => structuredClone(value);
function positive(value,fallback,label,allowZero=false,max=100000000) {
  value ??= fallback;
  if (!Number.isSafeInteger(value) || value<(allowZero?0:1) || value>max) throw new Error(`${label} must be an integer between ${allowZero?0:1} and ${max}.`);
  return value;
}
function documentInput(input) {
  // Reparse source rather than trusting an imported AST or stale choices.
  if (typeof input==='string') return parseDocument(input);
  const source=input?.source;
  if (typeof source==='string') return parseDocument(source);
  return parseDocument(serializeDocument(input));
}
function optionsInput(options={}) {
  const mode=options.mode??'synthesize';
  if (!['synthesize','search','evaluate'].includes(mode)) throw new Error(`Unknown experiment mode ${mode}.`);
  const maxMilliseconds=options.maxMilliseconds??10000;
  if (!Number.isFinite(maxMilliseconds)||maxMilliseconds<=0) throw new Error('maxMilliseconds must be positive and finite.');
  if (options.pinFacts!==undefined && typeof options.pinFacts!=='boolean') throw new Error('pinFacts must be true or false.');
  if (options.maxSteps!==undefined&&(!Number.isSafeInteger(options.maxSteps)||options.maxSteps<1)) throw new Error('maxSteps must be a positive safe integer.');
  return {...options,mode,maxMilliseconds,
    maxAdditionalNodes:positive(options.maxAdditionalNodes,2,'maxAdditionalNodes',true,8),
    maxModels:positive(options.maxModels,1000,'maxModels',false,1000000),
    maxDecisions:positive(options.maxDecisions,100000,'maxDecisions',true),
    maxCompilationNodes:positive(options.maxCompilationNodes,500000,'maxCompilationNodes'),
    maxKnowledgeFamilies:positive(options.maxKnowledgeFamilies,256,'maxKnowledgeFamilies'),
    pinFacts:options.pinFacts??true};
}

/** Every finite history extension can be added in a topological order.
 * Every new tuple may have any ideal as its past, including a concurrent past.
 * Generation caps retain queued candidates for checking before returning unknown. */
async function* historyCandidates(data,options,deadline,onProgress) {
  const base=compileModel(data);
  if (base.nodes.length+options.maxAdditionalNodes>16) throw new Error('History synthesis supports at most sixteen total tuples. Fixed-history synthesis/checking has no sixteen-tuple search bound.');
  for (const fact of data.facts??[]) for (const selector of Array.isArray(fact.at)?fact.at:[fact.at]) {
    if (typeof selector==='string'&&selector.startsWith('@')) throw new Error('History search needs stable fact selectors: use *, end, empty, or a base tuple ID instead of @tN.');
  }
  const palette=makePalette(data,options.palette),anchors=[...base.aliases.keys()];
  let frontier=[{data:{...clone(data),nodes:clone(data.nodes??[])},model:base}],serial=0,generationLimited=false;
  const seen=new Set([historyFingerprint(base,anchors)]);
  const stats={examined:0,generated:1,duplicates:0,maxDepth:0};
  for (let depth=0;depth<=options.maxAdditionalNodes;depth++) {
    const next=[];
    for (const candidate of frontier) {
      if (Date.now()>=deadline) return {complete:false,reason:'History search time budget reached.',stats};
      stats.examined++;stats.maxDepth=depth;
      yield {...candidate,depth,stats:{...stats}};
      if (depth<options.maxAdditionalNodes&&!generationLimited) {
        extensions:
        for (const past of ideals(candidate.model)) for (const place of base.participants) for (const event of palette) {
          if (Date.now()>=deadline) return {complete:false,reason:'Time budget reached while generating histories.',stats};
          if (candidate.model.nodes.some(n=>n.place===place&&n.past===past&&eventKey(n.event)===eventKey(event))) continue;
          let id;do{id=`__hs_synthesis_${serial++}`;}while(candidate.data.nodes.some(n=>n.id===id));
          const child={...candidate.data,nodes:[...candidate.data.nodes,{id,place,event,past:generators(candidate.model,past)}]};
          const model=compileModel(child),key=historyFingerprint(model,anchors);
          if (seen.has(key)){stats.duplicates++;continue;}
          if (seen.size>=options.maxModels){generationLimited=true;break extensions;}
          seen.add(key);stats.generated++;next.push({data:child,model});
        }
      }
      if (stats.examined%8===0) {onProgress({...stats,phase:'histories'});await new Promise(resolve=>setTimeout(resolve,0));}
    }
    frontier=next;
  }
  return {complete:!generationLimited,reason:generationLimited?'History candidate budget reached; further histories remain.':'All histories within the explicit extension bounds were examined.',stats};
}

/** Save exact declarations and a concrete total interpretation, never cached
 * success flags as a substitute for a logical certificate. */
export function createEvidence(input,rawOptions,row,runSnapshot) {
  const options=optionsInput(clone(rawOptions??{}));
  const doc=documentInput(input),selection=selectTheory(doc,options);
  const witness=row.witness??row;
  if (!witness?.model) throw new Error('This result has no concrete model to save.');
  const property=row.formula?{name:row.name,formula:row.formula,scope:row.scope??'end'}:null;
  const failure=property?clone(witness.result?.failures?.[0]??null):null;
  if(failure) {
    // A displayed @tN number is local to one compilation order. Certificates
    // use the semantic end/empty history or a tuple alias for the same past.
    const model=compileModel(witness.model),time=model.resolveTime(failure.time);
    failure.time=time.index===model.fullTime.index?'end':time.mask===0n?'empty':model.nodes.find(n=>n.timeIndex===time.index).id;
  }
  const bounds=clone(options);delete bounds.selectedProperties;delete bounds.droppedAxioms;
  const snapshot=runSnapshot??createRunSnapshot(doc.source,{bounds,droppedAxioms:selection.droppedAxioms,selectedProperties:selection.selectedProperties});
  return {format:'history-structure-evidence/v1',version:'0.7.1',semantics:SEMANTICS_PROFILE,name:doc.name,
    sourceMarkdown:doc.source??serializeDocument(doc),model:clone(witness.model),
    theory:selection.theory,retainedAxioms:[...(selection.theory.includeLive?['ThyLive']:[]),...selection.theory.axioms.map(a=>a.name)],
    droppedAxioms:selection.droppedAxioms??options.droppedAxioms??[],property,
    failure,
    mode:options.mode??'synthesize',bounds,snapshot,
    expected:property?'counterexample':'model'};
}

/** Compare the supplied total interpretation, not its selector spelling.
 * A fixed history can be represented with another topological node order;
 * @tN then names a different represented time. Each source node's stable alias
 * still identifies its exact past in the witness. Use those pasts to align the
 * time indices in linear time, without materialising every history as a set.
 * Unlisted atoms are false, so equality of finite true-atom supports is exact.
 */
function sameEvaluationInterpretation(source,base,witness,model) {
  const times=new Map([[base.fullTime.index,model.fullTime.index]]);
  for (const node of base.nodes) {
    const target=model.aliases.get(node.id);
    if (!target) return false;
    const previous=times.get(node.timeIndex);
    if (previous!==undefined&&previous!==target.timeIndex) return false;
    times.set(node.timeIndex,target.timeIndex);
  }
  if (times.size!==base.times.length) return false;
  const support=(data,compiled,mapping)=> {
    const result=new Set();
    for (const fact of data.facts??[]) {
      const atom=eventKey(normalizeEvent(fact.atom,{allowNull:false}));
      for (const selector of Array.isArray(fact.at)?fact.at:[fact.at]) {
        const selected=selector==='*'?compiled.times:[compiled.resolveTime(selector)];
        for (const time of selected) result.add(JSON.stringify([fact.place,mapping?mapping.get(time.index):time.index,atom]));
      }
    }
    return result;
  };
  const supplied=support(source,base,times),recorded=support(witness,model);
  if (supplied.size!==recorded.size) return false;
  for (const fact of supplied) if (!recorded.has(fact)) return false;
  return true;
}

/** Verify source/selection consistency, scope membership and the actual model.
 * A modified model can be a valid certificate too, but must pass every replay. */
export function replayExperiment(evidence,{maxMilliseconds=15000,maxSteps}={}) {
  const started=Date.now();
  if (evidence?.format!=='history-structure-evidence/v1') throw new Error('Expected history-structure-evidence/v1.');
  const doc=parseDocument(evidence.sourceMarkdown);
  // Local verification budgets can differ from the original run, without
  // rewriting its saved scope, request identity or operational bounds.
  const replayOptions=optionsInput({...evidence.bounds,mode:evidence.mode??'synthesize',maxMilliseconds,...(maxSteps===undefined?{}:{maxSteps})});
  if(evidence.bounds?.mode&&evidence.bounds.mode!==replayOptions.mode)throw new Error('Evidence mode disagrees with its recorded bounds.');
  const selection=selectTheory(doc,{droppedAxioms:evidence.droppedAxioms??[],selectedProperties:evidence.property?[evidence.property.name]:[]});
  // A source containing `include ThyLive` is not a complete formula listing:
  // its meaning depends on the recorded draft. Never silently regenerate a
  // different implicit theory when replaying an older certificate. Literal
  // formulas may use the unchanged core semantics without an implicit profile.
  if (evidence.semantics!==undefined && ![SEMANTICS_PROFILE,'hbb-disc/2026-11-07'].includes(evidence.semantics))
    throw new Error('Unsupported evidence semantics profile. Re-run the source with the current reference draft.');
  if (selection.theory.includeLive && evidence.semantics!==SEMANTICS_PROFILE)
    throw new Error(`Evidence retaining include ThyLive requires semantics profile ${SEMANTICS_PROFILE}. Re-run the source under the current reference draft; its implicit axioms cannot be silently reinterpreted.`);
  if (evidence.semantics!==undefined && evidence.snapshot?.engine?.semantics!==undefined && evidence.semantics!==evidence.snapshot.engine.semantics)
    throw new Error('Evidence semantics profile disagrees with its run snapshot.');
  if(evidence.snapshot!==undefined) {
    // A certificate can concern one property from a multi-property run. Check
    // the original complete selection as well as membership of this claim.
    const savedSelection=selectTheory(doc,{droppedAxioms:evidence.droppedAxioms??[],selectedProperties:evidence.snapshot?.selectedProperties});
    if(evidence.property&&!savedSelection.selectedProperties.includes(evidence.property.name))throw new Error('Evidence property was not selected in its run snapshot.');
    verifyRunSnapshot(evidence.snapshot,evidence.sourceMarkdown,{bounds:evidence.bounds,droppedAxioms:savedSelection.droppedAxioms,selectedProperties:savedSelection.selectedProperties},{allowLegacyCore:!selection.theory.includeLive});
  }
  if (JSON.stringify(selection.theory)!==JSON.stringify(evidence.theory)) throw new Error('Evidence retained theory does not match its source and omissions.');
  const retained=[...(selection.theory.includeLive?['ThyLive']:[]),...selection.theory.axioms.map(a=>a.name)];
  if(JSON.stringify(retained)!==JSON.stringify(evidence.retainedAxioms))throw new Error('Evidence retained axiom names do not match its source.');
  if(evidence.expected!==(evidence.property?'counterexample':'model'))throw new Error('Evidence expected judgement is inconsistent with its property.');
  if(evidence.property) {
    const f=evidence.failure;
    if(!f||Array.isArray(f)||typeof f!=='object'||typeof f.place!=='string'||typeof f.time!=='string'||!Object.hasOwn(f,'event'))throw new Error('Counterexample evidence needs its recorded place, time and current-event failure context.');
  }else if(evidence.failure!==null&&evidence.failure!==undefined)throw new Error('A model-only certificate cannot record a property failure context.');
  if (evidence.property) {
    const p=selection.properties[0];
    if (!p||p.formula!==evidence.property.formula||p.scope!==evidence.property.scope) throw new Error('Evidence property does not match its source.');
  }
  const model=compileModel(evidence.model),base=compileModel(doc.model);
  for (const field of ['participants','values','signature','quorums']) if(JSON.stringify(evidence.model[field])!==JSON.stringify(doc.model[field])) throw new Error(`Evidence changes the declared ${field}.`);
  const mode=replayOptions.mode;
  if (!['synthesize','search','evaluate'].includes(mode)) throw new Error('Evidence has an unknown mode.');
  if (mode==='search') {
    for(const fact of doc.model.facts??[])for(const selector of Array.isArray(fact.at)?fact.at:[fact.at]) {
      if(typeof selector==='string'&&selector.startsWith('@'))throw new Error('History-search evidence cannot use unstable @tN fact selectors.');
    }
    const ids=new Set((doc.model.nodes??[]).map(n=>n.id));
    const oldNodes=(evidence.model.nodes??[]).filter(n=>ids.has(n.id));
    const oldModel=compileModel({...doc.model,nodes:oldNodes,facts:[]});
    if (oldNodes.length!==ids.size||historyFingerprint(oldModel,[...base.aliases.keys()])!==historyFingerprint(base,[...base.aliases.keys()])) throw new Error('Evidence does not preserve the base history.');
    const maxAdditionalNodes=replayOptions.maxAdditionalNodes;
    if(model.nodes.length-base.nodes.length>maxAdditionalNodes)throw new Error('Evidence exceeds its tuple bound.');
    const palette=makePalette(doc.model,evidence.bounds?.palette);
    const allowed=new Set(palette.map(eventKey));
    const baseAliases=new Set((doc.model.nodes??[]).map(n=>n.id));
    for (const n of evidence.model.nodes??[]) if(!baseAliases.has(n.id)&&!allowed.has(eventKey(normalizeEvent(n.event))))throw new Error('Evidence uses a generated event outside its palette.');
  } else if (historyFingerprint(model,[...base.aliases.keys()])!==historyFingerprint(base,[...base.aliases.keys()])) throw new Error('Evidence changes the fixed history.');
  if (mode==='evaluate'&&!sameEvaluationInterpretation(doc.model,base,evidence.model,model)) throw new Error('Evaluation evidence changes the supplied predicate interpretation.');
  if(mode!=='evaluate'&&(evidence.bounds?.pinFacts??true)) {
    for(const fact of doc.model.facts??[]) {
      const atom=normalizeEvent(fact.atom,{allowNull:false});
      for(const selector of Array.isArray(fact.at)?fact.at:[fact.at]) {
        let times;
        if(selector==='*')times=model.times;
        else if(typeof selector==='string'&&selector.startsWith('@')) {
          // Ordinal selectors in a fixed seed refer to that seed's semantic
          // history, even if an isomorphic witness lists its nodes differently.
          const sourceTime=base.resolveTime(selector);
          let mask=0n;
          for(const id of sourceTime.nodeIds)mask|=model.aliases.get(id).bit;
          const mapped=model.timeByMask.get(mask);
          if(!mapped)throw new Error('Evidence lost the history selected by a source fact pin.');
          times=[mapped];
        }else times=[model.resolveTime(selector)];
        if(times.some(t=>!model.hasFact(fact.place,t.index,atom)))throw new Error('Evidence violates a pinned predicate fact.');
      }
    }
  }
  const expired=()=>Date.now()-started>=maxMilliseconds;
  const incomplete=reason=>({verified:false,status:'incomplete',reason});
  if(expired())return incomplete('Replay time budget expired during preparation.');
  const remaining=()=>Math.max(1,maxMilliseconds-(Date.now()-started));
  const assumptions=checkCustomTheory(model,selection.theory,{maxMilliseconds:remaining(),maxSteps:replayOptions.maxSteps,maxKnowledgeFamilies:evidence.bounds?.maxKnowledgeFamilies??256});
  if (assumptions.holds!==true||!assumptions.complete) return {verified:false,status:assumptions.holds===false?'invalid':'incomplete',reason:'Retained axioms did not all replay successfully.',assumptions};
  if(expired())return incomplete('Replay time budget expired after checking the retained axioms.');
  let property=null;
  if(evidence.property) {
    try {
      const ast=parseFormula(evidence.property.formula);
      property=new Evaluator(model,{maxMilliseconds:remaining(),maxSteps:replayOptions.maxSteps}).check(ast,{scope:evidence.property.scope});
      if(evidence.failure) {
        const f=evidence.failure,world=model.world({place:f.place,time:f.time,event:f.event});
        if(f.history!==undefined) {
          if(!Array.isArray(f.history))throw new Error('The recorded failure history must be an array of tuple IDs.');
          let recordedMask=0n;
          for(const id of f.history) {
            const node=model.aliases.get(id);
            if(!node)throw new Error('The recorded failure history contains an unknown tuple ID.');
            recordedMask|=node.bit;
          }
          if(recordedMask!==model.times[world.timeIndex].mask)throw new Error('The recorded failure history disagrees with its time selector.');
        }
        if(evidence.property.scope==='end'&&(world.timeIndex!==model.fullTime.index||world.event!==null))throw new Error('The recorded failure context is outside end-of-time validity.');
        if(new Evaluator(model,{maxMilliseconds:remaining(),maxSteps:replayOptions.maxSteps}).evaluate(ast,world))return {verified:false,status:'invalid',reason:'The property does not fail at the recorded context.',assumptions,property};
      }
    }catch(error){if(error instanceof EvaluationLimitError)return incomplete(error.message);throw error;}
    if(property.holds) return {verified:false,status:'invalid',reason:'The recorded claim is not false in this model.',assumptions,property};
  }
  if(expired())return incomplete('Replay time budget expired before the complete certificate was verified.');
  return {verified:true,status:evidence.property?'counterexample':'model',assumptions,property,stats:{elapsedMs:Date.now()-started}};
}

export async function runExperiment(input,rawOptions={},onProgress=()=>{}) {
  // Capture caller-owned arrays/objects before the first asynchronous yield.
  // Source parsing/serialization independently creates the owned model/ASTs.
  const started=Date.now(),options=optionsInput(clone(rawOptions)),deadline=started+options.maxMilliseconds;
  const doc=documentInput(input),selection=selectTheory(doc,options),theory=selection.theory;
  const properties=selection.properties.map(p=>({name:p.name,formula:p.formula,scope:p.scope??'end',status:'pending',unknownHistories:0}));
  const retainedAxioms=[...(theory.includeLive?['ThyLive']:[]),...theory.axioms.map(a=>a.name)];
  const bounds={...options};delete bounds.droppedAxioms;delete bounds.selectedProperties;
  const snapshot=createRunSnapshot(doc.source,{bounds,droppedAxioms:selection.droppedAxioms,selectedProperties:selection.selectedProperties});
  // Each satisfiable history can have many rho interpretations. Keep these
  // counts separate from SAT decisions and from the number of interpretations.
  const stats={histories:0,historiesWithModels:0,modelsSatisfyingAssumptions:0,synthesisQueries:0,elapsedMs:0};
  let consistency={status:'pending',consistent:null},firstWitness=null,firstCounterexample=null;
  const remaining=()=>Math.max(1,deadline-Date.now());
  const finish=(status,reason,complete=true)=> {
    const ended=Date.now(),expired=ended>=deadline;
    return {format:'history-structure-run/v1',version:'0.7.1',semantics:SEMANTICS_PROFILE,name:doc.name,mode:options.mode,status:expired?'incomplete':status,complete:complete&&!expired,
      reason:expired?'The experiment time budget expired while completing the report. Any independently verified models and counterexamples remain available.':reason,consistency,properties,
      witness:firstWitness,retainedAxioms,droppedAxioms:selection.droppedAxioms??options.droppedAxioms??[],selectedProperties:properties.map(p=>p.name),bounds,sourceMarkdown:doc.source,snapshot,stats:{...stats,elapsedMs:ended-started}};
  };
  const attach=(row,witness)=> {
    row.witness=witness;
    row.evidence=createEvidence(doc,options,row,snapshot);
    firstCounterexample??=witness;firstWitness=firstCounterexample;
  };
  if(options.mode==='evaluate') {
    if(Date.now()>=deadline){consistency={status:'incomplete',consistent:null};for(const p of properties)p.status='not-tested';return finish('incomplete','The experiment time budget expired during preparation.',false);}
    const model=compileModel(doc.model);
    const checked=checkCustomTheory(model,theory,{...options,maxMilliseconds:remaining()});
    consistency={...checked,status:checked.holds===true?'model':checked.holds===false?'no-model':'incomplete',consistent:checked.holds};
    stats.histories=1;
    if(checked.holds!==true) {
      for(const p of properties)p.status='not-tested';
      return finish(checked.holds===false?'no-model':'incomplete',checked.holds===false?'The supplied interpretation violates retained assumptions. No claim is reported as established.':checked.reason,checked.holds===false);
    }
    if(Date.now()>=deadline){consistency={status:'incomplete',consistent:null};for(const p of properties)p.status='not-tested';return finish('incomplete','The experiment time budget expired after checking assumptions.',false);}
    stats.historiesWithModels=stats.modelsSatisfyingAssumptions=1;
    consistency.witness={model:clone(doc.model),assumptions:checked,result:null};
    firstWitness=consistency.witness;consistency.evidence=createEvidence(doc,options,consistency,snapshot);
    for(const p of properties) {
      if(Date.now()>=deadline){p.status='incomplete';p.reason='Time budget reached.';continue;}
      onProgress({phase:'evaluate',property:p.name});
      if(Date.now()>=deadline){p.status='incomplete';p.reason='Time budget reached before evaluating this property.';continue;}
      try {
        const evaluated=new Evaluator(model,{maxMilliseconds:remaining(),maxSteps:options.maxSteps}).check(parseFormula(p.formula),{scope:p.scope});
        if(Date.now()>=deadline){p.status='incomplete';p.reason='The experiment time budget expired while evaluating this property.';continue;}
        p.status=evaluated.holds?'holds':'counterexample';p.result=evaluated;
        if(!evaluated.holds)attach(p,{model:clone(doc.model),assumptions:checked,result:evaluated});
      }catch(error){if(!(error instanceof EvaluationLimitError))throw error;p.status='incomplete';p.reason=error.message;}
    }
    if(properties.some(p=>p.status==='incomplete'))return finish('incomplete','Some requested checks did not finish.',false);
    return finish(properties.some(p=>p.status==='counterexample')?'counterexample':properties.length?'holds':'model','Checked the supplied complete interpretation.');
  }
  const candidates=options.mode==='search'?historyCandidates(doc.model,options,deadline,onProgress):(async function*(){yield{data:doc.model,stats:{examined:1}};return{complete:true,reason:'The fixed history was exhausted.',stats:{examined:1}};})();
  let consistencyUnknown=false,coverage;
  while(true) {
    const next=await candidates.next();
    if(next.done){coverage=next.value;break;}
    if(Date.now()>=deadline){coverage={complete:false,reason:'The experiment time budget expired.'};break;}
    const candidate=next.value;stats.histories++;
    onProgress({phase:'consistency',...candidate.stats,histories:stats.histories});
    const settings={...options,theory,deadline,maxMilliseconds:remaining()};
    const found=synthesize(candidate.data,{...settings,property:null});stats.synthesisQueries++;
    if(found.status==='incomplete'){consistencyUnknown=true;for(const p of properties)if(p.status==='pending')p.unknownHistories++;continue;}
    if(found.status==='no-model')continue;
    if(!found.witness?.model)throw new Error('Synthesis returned no model for a satisfiable history.');
    stats.historiesWithModels++;stats.modelsSatisfyingAssumptions=stats.historiesWithModels;
    if(!consistency.consistent) {
      consistency={...found,status:'model',consistent:true};firstWitness=found.witness;
      consistency.evidence=createEvidence(doc,options,consistency,snapshot);
    }
    if(!properties.length)return finish('model','A model satisfying every retained axiom was found.');
    for(const p of properties) {
      if(p.status==='counterexample')continue;
      if(Date.now()>=deadline){p.unknownHistories++;continue;}
      onProgress({phase:'property',property:p.name,...candidate.stats,histories:stats.histories});
      const result=synthesize(candidate.data,{...settings,maxMilliseconds:remaining(),property:p.formula,scope:p.scope});stats.synthesisQueries++;
      p.stats=result.stats;
      if(result.status==='counterexample'){p.status='counterexample';p.reason=result.reason;attach(p,result.witness);}
      else if(result.status==='incomplete')p.unknownHistories++;
      else if(result.status==='no-model')throw new Error('The same retained theory unexpectedly changed consistency while testing a claim.');
    }
    if(properties.every(p=>p.status==='counterexample'))return finish('counterexample','Each selected claim has a replay-verified counterexample.');
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(!consistency.consistent) {
    const unknown=consistencyUnknown||!coverage?.complete;
    consistency={status:unknown?'incomplete':'no-model',consistent:unknown?null:false,reason:coverage?.reason};
    for(const p of properties){p.status='not-tested';p.reason='No retained-axiom model was established in the searched scope.';}
    return finish(unknown?'incomplete':'no-model',unknown?'The bounds were not fully checked, and no axiom model was established.':'No model of the retained assumptions exists within this explicit scope; no property is reported as proved.',!unknown);
  }
  for(const p of properties)if(p.status!=='counterexample'){p.status=coverage?.complete&&!p.unknownHistories?'holds':'incomplete';p.reason=p.status==='holds'?'No counterexample exists within the explicit history, value, trust and palette bounds.':'A resource limit left some histories or interpretations unresolved.';}
  const incomplete=properties.some(p=>p.status==='incomplete');
  return finish(incomplete?'incomplete':properties.some(p=>p.status==='counterexample')?'counterexample':'holds',coverage?.reason??'The run ended before all requested questions were settled.',!incomplete);
}
