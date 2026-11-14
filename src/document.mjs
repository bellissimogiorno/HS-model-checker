/** Literate, executable history theories.
 *
 * This carries over 3μQL Explorer's Markdown-theory principle while using the
 * history-structure language. Only explicitly tagged hsm/hsm-model fences are
 * interpreted. Prose, quoted examples and other code fences never execute.
 */
import {compileModel} from './model.mjs';
import {parseFormula} from './parser.mjs';
import {Evaluator} from './evaluator.mjs';
import {sourcePosition} from './source-location.mjs';

const FORMAT='history-structure-theory/v1';
const MAX_DOCUMENT_LENGTH=10*1024*1024;
const KINDS=new Set(['backward','forward','other']);
const SCOPES=new Set(['end','all']);

export class TheoryDocumentError extends SyntaxError {
  constructor(message,line=1,column=1) {
    super(`${message} (line ${line}, column ${column})`);
    this.name='TheoryDocumentError';this.line=line;this.column=column;
  }
}

function failure(message,line,column=1) { throw new TheoryDocumentError(message,line,column); }
function plainMessage(error) { return error.message.replace(/\s+\(line \d+, column \d+\)$/,''); }

function codeBlocks(lines) {
  const blocks=[];
  let open=null,title;
  for(let index=0;index<lines.length;index++) {
    const line=lines[index];
    if(open) {
      const closing=line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if(closing&&closing[1][0]===open.marker&&closing[1].length>=open.length) {
        if(open.tag==='hsm'||open.tag==='hsm-model') blocks.push({...open,endLine:index+1});
        open=null;
      } else open.lines.push({text:line,line:index+1});
      continue;
    }
    const opening=line.match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/);
    if(opening) {
      const info=opening[2].trim();
      const tag=info.split(/\s+/)[0];
      if((tag==='hsm'||tag==='hsm-model')&&info!==tag) failure(`The ${tag} fence does not accept extra parameters`,index+1);
      open={marker:opening[1][0],length:opening[1].length,tag,line:index+1,lines:[]};
    } else if(title===undefined) {
      const heading=line.match(/^ {0,3}#\s+(.+?)\s*#*\s*$/);
      if(heading) title=heading[1];
    }
  }
  if(open&&(open.tag==='hsm'||open.tag==='hsm-model')) failure(`Unclosed ${open.tag} code fence`,open.line);
  return {blocks,title};
}

function declaration(text,line) {
  const matched=text.match(/^\s*(axiom|property)\s+/);
  if(!matched) return null;
  let colon=-1,inString=false,escaped=false;
  const start=matched[0].length;
  for(let i=start;i<text.length;i++) {
    const c=text[i];
    if(inString) {
      if(escaped) escaped=false;
      else if(c==='\\') escaped=true;
      else if(c==='"') inString=false;
    } else if(c==='"') inString=true;
    else if(c===':') {colon=i;break;}
  }
  if(colon<0) failure(`A ${matched[1]} declaration needs a name followed by :`,line,start+1);
  let label=text.slice(start,colon).trim();
  const metadata=label.match(/\s+\[([^\]]*)\]$/);
  const option=metadata?.[1];
  if(metadata) label=label.slice(0,metadata.index).trim();
  if(label.startsWith('"')) {
    try {label=JSON.parse(label);} catch {failure('Invalid quoted declaration name',line,start+1);}
  }
  if(typeof label!=='string'||!label.trim()||/[\r\n]/.test(label)) failure('Declaration name must be a nonempty single-line string',line,start+1);
  if(label==='ThyLive') failure('ThyLive is reserved for the dynamic include; choose another declaration name',line,start+1);
  const type=matched[1];
  if(type==='axiom'&&option!==undefined&&!KINDS.has(option)) failure('Axiom direction must be backward, forward or other',line,start+1);
  if(type==='property'&&option!==undefined&&!SCOPES.has(option)) failure('Property scope must be end or all',line,start+1);
  const remainder=text.slice(colon+1);
  const leading=remainder.match(/^\s*/)[0].length;
  return {type,name:label,...(type==='axiom'?{kind:option??'other'}:{scope:option??'end'}),line,
    formulaColumn:sourcePosition(text,colon+1+leading).column,parts:[remainder.slice(leading)]};
}

/** Parse and validate one self-contained Markdown theory. Returned ASTs are
 * convenient in-process data; source formula strings remain the export format. */
export function parseDocument(markdown) {
  if(typeof markdown!=='string') throw new TypeError('Theory source must be a Markdown string.');
  if(markdown.length>MAX_DOCUMENT_LENGTH||new TextEncoder().encode(markdown).byteLength>MAX_DOCUMENT_LENGTH) failure('Theory document exceeds the 10 MiB source limit',1);
  const lines=markdown.split(/\r\n?|\n/);
  const {blocks,title}=codeBlocks(lines);
  const modelBlocks=blocks.filter(block=>block.tag==='hsm-model');
  if(modelBlocks.length!==1) failure('A theory needs exactly one hsm-model JSON code fence',modelBlocks[1]?.line??1);
  const modelBlock=modelBlocks[0],modelSource=modelBlock.lines.map(row=>row.text).join('\n');
  let model;
  try {model=JSON.parse(modelSource);} catch(error) {
    const location=error.message.match(/line (\d+)[ ,]+column (\d+)/i);
    const position=error.message.match(/position (\d+)/i);
    let line=1,column=1;
    if(position) ({line,column}=sourcePosition(modelSource,Number(position[1])));
    else if(location) {
      // JSON engine columns count UTF-16 code units. Our public source
      // coordinates count Unicode code points, as FormulaSyntaxError does.
      const lines=modelSource.split('\n'),number=Number(location[1]);
      const prefix=lines.slice(0,number-1).reduce((size,text)=>size+text.length+1,0);
      ({line,column}=sourcePosition(modelSource,prefix+Number(location[2])-1));
    } else if(/Unexpected end|end of JSON/i.test(error.message)) ({line,column}=sourcePosition(modelSource,modelSource.length));
    failure(`Invalid model JSON: ${error.message}`,modelBlock.line+line,column);
  }
  let compiled;
  try {compiled=compileModel(model);} catch(error) {failure(`Invalid history model: ${error.message}`,modelBlock.line+1);}
  const formulaBlocks=blocks.filter(block=>block.tag==='hsm');
  if(!formulaBlocks.length) failure('A theory needs at least one hsm declaration code fence',1);
  const axioms=[],properties=[],names=new Set();
  let includeLive=false;
  const validator=new Evaluator(compiled);
  function finish(current) {
    if(!current) return;
    if(names.has(current.name)) failure(`Duplicate declaration name ${JSON.stringify(current.name)}`,current.line);
    names.add(current.name);
    const formula=current.parts.join('\n').trimEnd();
    if(!formula.trim()) failure(`Declaration ${JSON.stringify(current.name)} needs a formula`,current.line,current.formulaColumn);
    let ast;
    try {ast=parseFormula(formula);validator.validate(ast);} catch(error) {
      const relativeLine=error.line??1,relativeColumn=error.column??1;
      failure(`${current.name}: ${plainMessage(error)}`,current.line+relativeLine-1,relativeLine===1?current.formulaColumn+relativeColumn-1:relativeColumn);
    }
    const row={name:current.name,formula,ast,line:current.line};
    if(current.type==='axiom') axioms.push({...row,kind:current.kind});
    else properties.push({...row,scope:current.scope});
  }
  for(const block of formulaBlocks) {
    let current=null;
    for(const row of block.lines) {
      const trimmed=row.text.trim();
      if(/^include\b/.test(trimmed)) {
        finish(current);current=null;
        if(trimmed!=='include ThyLive') failure('Only include ThyLive is supported; protocol axioms remain editable declarations',row.line);
        if(includeLive) failure('Duplicate include ThyLive',row.line);
        if(!compiled.predicateSymbols.has('live')) failure('include ThyLive requires predicate live in the model signature',row.line);
        includeLive=true;
        continue;
      }
      const next=declaration(row.text,row.line);
      if(next) {finish(current);current=next;continue;}
      if(!trimmed||trimmed.startsWith('#')||trimmed.startsWith('//')) {if(current)current.parts.push(row.text);continue;}
      if(!current) failure('Expected include, axiom or property declaration inside hsm fence',row.line,row.text.search(/\S/)+1);
      current.parts.push(row.text);
    }
    finish(current);
  }
  return {format:FORMAT,name:title??model.name??'Untitled history theory',model,includeLive,axioms,properties,source:markdown};
}

function nameText(name) {
  if(typeof name!=='string'||!name.trim()||/[\r\n]/.test(name)) throw new TypeError('Declaration names must be nonempty single-line strings.');
  return name!==name.trim()||/[:"\[\]]/.test(name)?JSON.stringify(name):name;
}

/** Serialize the mathematical content, rather than relying on stale source.
 * For an exact prose-preserving save, save the editor source or parsed.source. */
export function serializeDocument(doc) {
  if(!doc||typeof doc!=='object'||!doc.model||!Array.isArray(doc.axioms)||!Array.isArray(doc.properties)) throw new TypeError('Expected a parsed theory document.');
  if(doc.includeLive!==undefined&&typeof doc.includeLive!=='boolean') throw new TypeError('includeLive must be true or false.');
  const title=String(doc.name??'History structure theory').replace(/[\r\n]/g,' ');
  const declarations=[];
  if(doc.includeLive) declarations.push('include ThyLive');
  for(const axiom of doc.axioms) {
    if(!axiom||typeof axiom!=='object'||Array.isArray(axiom)||!KINDS.has(axiom.kind??'other')||typeof axiom.formula!=='string') throw new TypeError('Invalid axiom data.');
    declarations.push(`axiom ${nameText(axiom.name)} [${axiom.kind??'other'}]: ${axiom.formula}`);
  }
  for(const property of doc.properties) {
    if(!property||typeof property!=='object'||Array.isArray(property)||!SCOPES.has(property.scope??'end')||typeof property.formula!=='string') throw new TypeError('Invalid property data.');
    declarations.push(`property ${nameText(property.name)} [${property.scope??'end'}]: ${property.formula}`);
  }
  const output=`# ${title}\n\n\`\`\`hsm-model\n${JSON.stringify(doc.model,null,2)}\n\`\`\`\n\n\`\`\`hsm\n${declarations.join('\n\n')}\n\`\`\`\n`;
  parseDocument(output);
  return output;
}

/** Replace only the executable model JSON. All prose, declarations, fence
 * markers, indentation and line endings outside that JSON remain byte-for-byte. */
export function replaceModelBlock(markdown,model) {
  parseDocument(markdown);
  const {blocks}=codeBlocks(markdown.split(/\r\n?|\n/));
  const block=blocks.find(row=>row.tag==='hsm-model');
  const starts=[0];
  for(const match of markdown.matchAll(/\r\n?|\n/g)) starts.push(match.index+match[0].length);
  const start=starts[block.line],end=starts[block.endLine-1];
  const newline=markdown.slice(starts[block.line-1],start).match(/\r\n?|\n/)?.[0]??'\n';
  const replacement=JSON.stringify(model,null,2).replaceAll('\n',newline)+newline;
  const output=markdown.slice(0,start)+replacement+markdown.slice(end);
  parseDocument(output);
  return output;
}

function selectedNames(value,allowed,label,defaultValue) {
  const names=value===undefined?defaultValue:value;
  if(!Array.isArray(names)||names.some(name=>typeof name!=='string')) throw new TypeError(`${label} must be an array of names.`);
  if(new Set(names).size!==names.length) throw new Error(`${label} contains duplicate names.`);
  for(const name of names) if(!allowed.has(name)) throw new Error(`Unknown ${label} name ${JSON.stringify(name)}.`);
  return [...names];
}

/** Build exactly the retained theory. A group called ThyLive is selectable as
 * one assumption; its schemes are instantiated dynamically for each history. */
export function selectTheory(doc,{droppedAxioms,selectedProperties}={}) {
  if(!doc||Array.isArray(doc)||doc.format!==FORMAT||!Array.isArray(doc.axioms)||!Array.isArray(doc.properties)) throw new TypeError('Expected a parsed history theory document.');
  if(doc.includeLive!==undefined&&typeof doc.includeLive!=='boolean') throw new TypeError('includeLive must be true or false.');
  // Parsed documents are mutable public objects. Validate their current
  // declarations and rebuild ASTs from formula strings instead of trusting a
  // stale or forged tree supplied by a programming-API caller.
  const model=compileModel(doc.model),validator=new Evaluator(model),names=new Set();
  if(doc.includeLive&&!model.predicateSymbols.has('live')) throw new Error('include ThyLive requires predicate live in the model signature.');
  const rows=(input,type)=>input.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row)) throw new TypeError(`Invalid ${type} data.`);
    nameText(row.name);
    if(row.name==='ThyLive') throw new Error('ThyLive is reserved for the dynamic include; choose another declaration name.');
    if(names.has(row.name)) throw new Error(`Duplicate declaration name ${JSON.stringify(row.name)}.`);
    names.add(row.name);
    if(typeof row.formula!=='string') throw new TypeError(`Invalid ${type} formula.`);
    const metadata=type==='axiom'?row.kind??'other':row.scope??'end';
    if(!(type==='axiom'?KINDS:SCOPES).has(metadata)) throw new TypeError(`Invalid ${type} ${type==='axiom'?'direction':'scope'}.`);
    const ast=parseFormula(row.formula);validator.validate(ast);
    return {...row,ast,...(type==='axiom'?{kind:metadata}:{scope:metadata})};
  });
  const axioms=rows(doc.axioms,'axiom'),properties=rows(doc.properties,'property');
  const axiomNames=new Set(axioms.map(a=>a.name));
  if(doc.includeLive) axiomNames.add('ThyLive');
  const dropped=selectedNames(droppedAxioms,axiomNames,'droppedAxioms',[]);
  const selected=selectedNames(selectedProperties,new Set(properties.map(p=>p.name)),'selectedProperties',properties.map(p=>p.name));
  const omitted=new Set(dropped),chosen=new Set(selected);
  return {theory:{includeLive:!!doc.includeLive&&!omitted.has('ThyLive'),axioms:axioms.filter(a=>!omitted.has(a.name)).map(({name,kind,formula})=>({name,kind,formula}))},
    properties:properties.filter(p=>chosen.has(p.name)),droppedAxioms:dropped,selectedProperties:selected};
}
