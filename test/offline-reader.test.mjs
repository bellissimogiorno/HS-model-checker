import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, cp, mkdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {EXAMPLES, EXAMPLE_GROUPS} from '../src/example-catalog.mjs';
import {parseDocument} from '../src/document.mjs';
import {createReaderPage, readerRuntime} from '../src/reader-page.mjs';
import {loadReaderData, buildReader} from '../tools/build-reader.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const data=await loadReaderData(ROOT);
const readPayload=html=>JSON.parse(html.match(/<script id="reader-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

test('the offline reader derives every exact declaration and source from the executable catalog',async()=>{
  const html=await readFile(join(ROOT,'theories.html'),'utf8'),payload=readPayload(html);
  assert.equal(html,createReaderPage(data),'distributed reader must agree with current builder and sources');
  assert.equal(payload.theories.length,EXAMPLES.length);
  assert.deepEqual(data.groups,EXAMPLE_GROUPS);
  assert.deepEqual(payload.theories.map(row=>row.file),EXAMPLES.map(row=>row.file));
  for(const row of payload.theories){
    const source=await readFile(join(ROOT,'examples/theories',row.file),'utf8'),doc=parseDocument(source);
    assert.equal(row.source,source,row.file+': exact download source');
    assert.equal(row.title,doc.name);
    assert.equal(row.sourceSha256,createHash('sha256').update(source).digest('hex'));
    assert.equal(row.includeLive,doc.includeLive);
    assert.equal(row.axiomCount,doc.axioms.length);assert.equal(row.propertyCount,doc.properties.length);
    assert.deepEqual(row.declarations,[
      ...doc.axioms.map(p=>({type:'axiom',name:p.name,kind:p.kind,formula:p.formula,line:p.line})),
      ...doc.properties.map(p=>({type:'property',name:p.name,scope:p.scope,formula:p.formula,line:p.line}))
    ].sort((a,b)=>a.line-b.line));
  }
  assert.match(html,/src:url\(data:font\/woff;base64,/);
  assert.doesNotMatch(html,/<script\b[^>]*\bsrc=|<link\b[^>]*rel="stylesheet"|fetch\(|XMLHttpRequest|import\(/);
  assert.equal((html.match(/<script\b/g)??[]).length,2,'only the safe data block and static reader runtime execute');
  assert.equal((html.match(/<details class="theory-model-block"/g)??[]).length,EXAMPLES.length);
  assert.doesNotMatch(html,/<details class="theory-model-block"[^>]*\bopen\b/);
  assert.match(html,/does not run a model-checking query/);
  assert.match(html,/python3 serve\.py --open/);
});

test('reader building is deterministic and --check detects stale sources without mutating output',async()=>{
  const root=await mkdtemp(join(ROOT,'.offline-reader-test-'));
  try{
    await mkdir(join(root,'assets'));await mkdir(join(root,'examples'));
    await cp(join(ROOT,'VERSION'),join(root,'VERSION'));
    await cp(join(ROOT,'assets/history-mono.woff'),join(root,'assets/history-mono.woff'));
    await cp(join(ROOT,'examples/theories'),join(root,'examples/theories'),{recursive:true});
    const built=await buildReader({root});assert.equal(built.theories,EXAMPLES.length);
    const original=await readFile(join(root,'theories.html'),'utf8');
    await buildReader({root,check:true});
    await buildReader({root});assert.equal(await readFile(join(root,'theories.html'),'utf8'),original);
    const path=join(root,'examples/theories',EXAMPLES[0].file);
    await writeFile(path,(await readFile(path,'utf8'))+'\nAn additional explanatory sentence.\n');
    await assert.rejects(buildReader({root,check:true}),/stale/);
    assert.equal(await readFile(join(root,'theories.html'),'utf8'),original,'check must not rewrite the delivered reader');
    await buildReader({root});await buildReader({root,check:true});
    assert.notEqual(await readFile(join(root,'theories.html'),'utf8'),original);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('authored Markdown, labels and payloads cannot terminate the reader data or inject HTML',()=>{
  const row=structuredClone(data.theories[0]);
  row.source=row.source.replace('axiom SomeChoice [other]:','axiom "Vote\'!!??: [other]" [other]:')+'\n</script><img src=x onerror=alert(1)>\n[bad](javascript:alert(1))\n';
  const doc=parseDocument(row.source);row.title='A <script>alert(1)</script> title';row.label='Label "><img src=x>';row.description='</style><script>alert(2)</script>';
  row.declarations=[...doc.axioms.map(p=>({type:'axiom',name:p.name,kind:p.kind,formula:p.formula,line:p.line})),...doc.properties.map(p=>({type:'property',name:p.name,scope:p.scope,formula:p.formula,line:p.line}))];
  const html=createReaderPage({...data,theories:[row]});
  assert.equal((html.match(/<script\b/g)??[]).length,2);
  assert.doesNotMatch(html,/<img\b|href="javascript:/i);
  assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.ok(html.includes('Vote&#39;!!??: [other]'),'labels follow the canonical loader, including repeated marks');
  assert.equal(readPayload(html).theories[0].source,row.source,'data escaping must preserve exact downloadable source');
});

class Element{
  constructor(){this.hidden=false;this.value='';this.textContent='';this.disabled=false;this.dataset={};this.attributes={};this.listeners=new Map();this.parentElement=null;this.children=[];this.scrolls=0;}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  fire(name){this.listeners.get(name)?.({target:this});}
  setAttribute(name,value){this.attributes[name]=String(value);}removeAttribute(name){delete this.attributes[name];}
  append(node){this.children.push(node);node.parentElement=this;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}
  click(){this.fire('click');}focus(){this.focused=true;}scrollIntoView(){this.scrolls++;}
}
function fixture(payload){
  const ids=new Map(),links=new Map(),groups=[],downloads=[],events=new Map(),saved=[],revoked=[];
  for(const id of ['reader-data','readerSearch','readerCount','readerEmpty','readerPrevious','readerNext','readerClear','readerControls','readerSearchTools'])ids.set(id,new Element());
  ids.get('reader-data').textContent=JSON.stringify(payload);
  for(const group of EXAMPLE_GROUPS){const node=new Element();node.dataset.readerGroup=group;groups.push(node);}
  for(const row of payload.theories){
    ids.set(row.id,new Element());const link=new Element(),parent=new Element();parent.append(link);links.set(row.id,link);
    const button=new Element();button.dataset.sourceDownload=row.id;downloads.push(button);
    const sourceHtml=createReaderPage({...data,theories:[row]});
    for(const match of sourceHtml.matchAll(/id="(theory-\d+-line-\d+)"/g))ids.set(match[1],new Element());
  }
  const body=new Element();
  const document={
    body,getElementById:id=>ids.get(id),
    querySelector:selector=>links.get(selector.match(/data-theory-link="([^"]+)"/)?.[1]),
    querySelectorAll:selector=>selector==='[data-reader-group]'?groups:selector==='[data-source-download]'?downloads:[],
    createElement:()=>{const node=new Element();node.click=()=>saved.push({href:node.href,file:node.download});return node;}
  };
  let hash='';const location={};Object.defineProperty(location,'hash',{get:()=>hash,set:value=>{hash=value.startsWith('#')?value:'#'+value;events.get('hashchange')?.();}});
  let blob;const URL={createObjectURL:value=>{blob=value;return 'blob:reader-test';},revokeObjectURL:value=>revoked.push(value)};
  const window={addEventListener:(name,fn)=>events.set(name,fn)};
  vm.runInNewContext('('+readerRuntime.toString()+')();',{document,window,location,URL,Blob,requestAnimationFrame:fn=>fn(),setTimeout:fn=>fn()});
  return{ids,links,groups,downloads,location,saved,revoked,getBlob:()=>blob};
}

test('offline reader runtime navigates, searches both notations, and downloads exact source without network',async()=>{
  const f=fixture(data),$=id=>f.ids.get(id),visible=()=>data.theories.filter(row=>!$(row.id).hidden);
  assert.equal(visible().length,1);assert.equal(visible()[0].file,EXAMPLES[0].file);
  assert.equal($('readerPrevious').disabled,true);assert.equal($('readerControls').hidden,false);
  $('readerNext').click();assert.equal(visible()[0].file,EXAMPLES[1].file);assert.equal(f.links.get(visible()[0].id).attributes['aria-current'],'page');
  const wanted=data.theories.find(row=>row.file==='heterogeneous.md');
  $('readerSearch').value=wanted.file;$('readerSearch').fire('input');
  assert.equal($('readerCount').textContent,'1 of '+EXAMPLES.length+' theories');assert.equal(visible()[0].id,wanted.id);
  assert.equal($('readerPrevious').disabled,true);assert.equal($('readerNext').disabled,true);
  $('readerSearch').value='exists01';$('readerSearch').fire('input');
  assert.ok(visible().length===1);assert.ok(visible()[0].source.includes('∃⁰¹'),'ASCII query finds Unicode formulas');
  $('readerSearch').value='no-theory-has-this-unique-phrase';$('readerSearch').fire('input');
  assert.equal(visible().length,0);assert.equal($('readerEmpty').hidden,false);
  $('readerClear').click();assert.equal($('readerCount').textContent,EXAMPLES.length+' of '+EXAMPLES.length+' theories');assert.equal(visible().length,1);
  f.location.hash=wanted.id;assert.equal(visible()[0].id,wanted.id);
  const block=[...f.ids.keys()].find(id=>id.startsWith(wanted.id+'-line-'));
  f.location.hash=block;assert.equal($(block).scrolls,1);
  f.downloads.find(button=>button.dataset.sourceDownload===wanted.id).click();
  assert.deepEqual(f.saved,[{href:'blob:reader-test',file:wanted.file}]);
  assert.equal(await f.getBlob().text(),wanted.source);assert.deepEqual(f.revoked,['blob:reader-test']);
});
