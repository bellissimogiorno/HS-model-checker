/** Runs the actual application module against a small DOM/Worker boundary.
 * These checks cover state transitions; they do not claim browser layout QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runExperiment,replayExperiment} from '../src/experiment.mjs';
import {EXAMPLES,EXAMPLE_GROUPS,exampleOptions} from '../src/example-catalog.mjs';
import {parseDocument,serializeDocument} from '../src/document.mjs';
import {SEMANTICS_PROFILE} from '../src/run-identity.mjs';

// Enough HTML decoding for textContent at the boundary; this fixture never
// executes generated markup or claims to reproduce native browser layout.
const htmlText = source => String(source).replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|#39|#\d+|#x[\da-f]+);/gi,entity=>({
  '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"
})[entity]??String.fromCodePoint(entity[2].toLowerCase()==='x'?parseInt(entity.slice(3,-1),16):Number(entity.slice(2,-1))));

let radios=[],fixtureSerial=0;
class Element {
  constructor(tag='div') {
    this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.listeners={};this.attributes={};this.dataset={};this.style={};this._text='';this._html='';this._value='';this.hidden=false;this._checked=false;this.className='';this.selectionStart=0;this.selectionEnd=0;this.scrollTop=0;this.scrollLeft=0;this.clientWidth=640;this.clientHeight=360;
    this.classList={toggle:(name,yes)=>{const names=new Set(this.className.split(/\s+/).filter(Boolean));if(yes)names.add(name);else names.delete(name);this.className=[...names].join(' ');}};
  }
  set textContent(value){this._text=String(value);this._html='';this.children=[];}
  get textContent(){return this._text+this.children.map(node=>node.textContent).join('');}
  set innerHTML(value){this._html=String(value);this._text=htmlText(value);this.children=[];}
  get innerHTML(){return this._html;}
  set value(value){this._value=String(value);}
  get value(){return this.tagName==='SELECT'&&!this._value?this.children[0]?.value??'':this._value;}
  set checked(value){if(value&&this.name==='mode')for(const n of radios)n._checked=false;this._checked=!!value;}
  get checked(){return this._checked;}
  append(...nodes){for(let node of nodes){if(typeof node==='string'){const text=new Element('#text');text.textContent=node;node=text;}if(node.parentNode){const prior=node.parentNode.children,index=prior.indexOf(node);if(index>=0)prior.splice(index,1);}node.parentNode=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this._text='';this._html='';if(this.tagName==='SELECT')this._value='';this.append(...nodes);}
  addEventListener(type,callback){(this.listeners[type]??=[]).push(callback);}
  async fire(type,extra={}){for(const callback of this.listeners[type]??[])await callback({target:this,preventDefault(){},...extra});}
  click(){return this.fire('click');}
  setAttribute(key,value){this.attributes[key]=String(value);}getAttribute(key){return this.attributes[key];}removeAttribute(key){delete this.attributes[key];}
  querySelectorAll(selector){const descendants=[];const visit=node=>{for(const child of node.children){descendants.push(child);visit(child);}};visit(this);return descendants.filter(node=>matches(node,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
  closest(tag){let node=this;while(node){if(node.tagName.toLowerCase()===tag)return node;node=node.parentNode;}return null;}
  get firstChild(){return this.children[0]??null;}
  focus(options){this.focused=true;this.focusOptions=options;document.activeElement=this;document.viewEvents?.push({type:'focus',target:this,options});}
  scrollIntoView(options){document.viewEvents?.push({type:'scrollIntoView',target:this,options});}
  getBoundingClientRect(){document.viewEvents?.push({type:'measure',target:this});this.beforeMeasure?.();return {top:this.layoutTop===undefined?0:this.layoutTop-window.scrollY,height:this.layoutHeight??this.clientHeight};}
  remove(){}
  setSelectionRange(start,end){this.selectionStart=Math.max(0,Math.min(start,this.value.length));this.selectionEnd=Math.max(this.selectionStart,Math.min(end,this.value.length));}
  setRangeText(replacement,start=this.selectionStart,end=this.selectionEnd,mode='preserve'){
    const priorStart=this.selectionStart,priorEnd=this.selectionEnd,delta=replacement.length-(end-start);
    this.value=this.value.slice(0,start)+replacement+this.value.slice(end);
    if(mode==='end')this.setSelectionRange(start+replacement.length,start+replacement.length);
    else if(mode==='start')this.setSelectionRange(start,start);
    else if(mode==='select')this.setSelectionRange(start,start+replacement.length);
    else this.setSelectionRange(priorStart>end?priorStart+delta:priorStart>start?start:priorStart,priorEnd>end?priorEnd+delta:priorEnd>start?start+replacement.length:priorEnd);
  }
}
function matches(node,selector){
  if(selector.includes(','))return selector.split(',').some(s=>matches(node,s.trim()));
  if(['input','button','svg','h2','code'].includes(selector))return node.tagName===selector.toUpperCase();
  if(selector==='input:checked')return node.tagName==='INPUT'&&node.checked;
  if(selector==='input:not(:checked)')return node.tagName==='INPUT'&&!node.checked;
  if(selector==='[data-symbol]')return node.dataset.symbol!==undefined;
  if(selector.startsWith('.'))return node.className.split(/\s+/).includes(selector.slice(1));
  return false;
}

async function fixture({nativeDialog=true,storageEntries=[]}={}){
  const root=new URL('../',import.meta.url),appURL=new URL('src/app.mjs',root);
  const html=await readFile(new URL('index.html',root),'utf8'),ids=new Map();
  for(const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)){
    const [,tag,attrs,id]=match,node=new Element(tag);node.id=id;node.value=attrs.match(/\bvalue="([^"]*)"/)?.[1]??'';node.checked=/\bchecked\b/.test(attrs);node.hidden=/\bhidden\b/.test(attrs);ids.set(id,node);
    for(const attribute of attrs.matchAll(/([^\s=]+)="([^"]*)"/g))node.setAttribute(attribute[1],attribute[2]);
    if(tag==='textarea')node.value=html.slice(match.index+match[0].length).split('</textarea>')[0];
  }
  for(const id of ['propertyOptions','axiomOptions'])ids.get(id).append(new Element('legend'));
  radios=['search','synthesize','evaluate'].map(value=>{const node=new Element('input');node.type='radio';node.name='mode';node.value=value;node._checked=value==='synthesize';return node;});
  for(const value of ['end','all','world']){const option=new Element('option');option.value=value;ids.get('scopeSelect').append(option);}
  const chooserLabel=new Element('label');chooserLabel.layoutTop=480;chooserLabel.append(ids.get('exampleSelect'));
  const workflowBar=new Element('nav');workflowBar.className='workflow-nav';workflowBar.layoutHeight=72;
  const document={getElementById:id=>{assert(ids.has(id),'HTML contains '+id);return ids.get(id);},createElement:tag=>new Element(tag),createElementNS:(_ns,tag)=>new Element(tag),body:new Element('body'),activeElement:null,viewEvents:[],
    querySelectorAll:selector=>selector==='input[name="mode"]'?radios:selector==='#propertyOptions input,#axiomOptions input'?['propertyOptions','axiomOptions'].flatMap(id=>ids.get(id).querySelectorAll('input')):[],
    querySelector:selector=>{if(selector==='.workflow-nav')return workflowBar;const match=selector.match(/^input\[name="mode"\](?::checked|\[value="([^"]+)"\])$/);return match?radios.find(node=>match[1]?node.value===match[1]:node.checked):null;}};
  const storage=new Map(storageEntries),fetches=[],workers=[],pageEvents=new Map(),resizeObservers=[];
  globalThis.window={addEventListener:(name,callback)=>pageEvents.set(name,callback),scrollY:0,scrollTo:options=>{document.viewEvents.push({type:'scrollTo',options});window.scrollY=options.top;}};
  Object.assign(globalThis,{document,addEventListener:(name,callback)=>pageEvents.set(name,callback),ResizeObserver:class{constructor(callback){this.callback=callback;this.observed=[];resizeObservers.push(this);}observe(node){this.observed.push(node);}disconnect(){this.observed=[];}},matchMedia:()=>({matches:true}),location:{protocol:'http:'},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},fetch:()=>new Promise(resolve=>fetches.push(resolve)),Worker:class{constructor(){workers.push(this);}postMessage(message){this.sent=message;}terminate(){this.terminated=true;}}});
  document.body.append(ids.get('aboutDetails'),ids.get('aboutDialog'));
  if(nativeDialog){
    const dialog=ids.get('aboutDialog');dialog.open=false;dialog.showCount=0;
    dialog.showModal=function(){assert.equal(this.open,false);this.open=true;this.showCount++;};
    dialog.close=function(){if(!this.open)return;this.open=false;return this.fire('close');};
  }
  const source=(await readFile(appURL,'utf8')).replace(/from '\.\/([^']+)'/g,(_all,path)=>'from '+JSON.stringify(new URL(path,appURL).href)).replaceAll('import.meta.url',JSON.stringify(appURL.href))+'\nexport {state,loadSource,loadExample,inspectModel,updateChoices,applyModel,project};\n// fixture '+ ++fixtureSerial;
  const app=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const first=await readFile(new URL('examples/theories/first-steps.md',root),'utf8');
  fetches.shift()({ok:true,text:async()=>first});await new Promise(resolve=>setTimeout(resolve,0));
  return {app,ids,workers,fetches,first,storage,pageEvents,resizeObservers,document,chooserLabel,workflowBar,html};
}

test('application keeps model/source/query results and delayed loads in their exact contexts',async t=>{
  const {app,ids,workers,fetches,first,storage,pageEvents,resizeObservers,document,chooserLabel,workflowBar,html}=await fixture();
  t.after(()=>pageEvents.get('pagehide')?.());
  const $=id=>ids.get(id);
  await t.test('curated picker groups every example and starts on First steps',()=>{
    const groups=$('exampleSelect').children.filter(node=>node.tagName==='OPTGROUP');
    assert.deepEqual(groups.map(group=>group.label),EXAMPLE_GROUPS);
    assert.deepEqual(groups.flatMap(group=>group.children.map(option=>option.value)),EXAMPLES.map(example=>example.file));
    assert.equal($('exampleSelect').value,'first-steps.md');
    assert.equal(app.state.example,'first-steps.md');
    assert.equal($('theoryEditor').value,first);
  });
  await t.test('About provides the required credits and a native dialog with Close, Escape and focus restoration',async()=>{
    assert.match(html,/<nav aria-label="Resources">[^\n]*id="aboutLink"[^\n]*>About<\/a>/);
    assert.match(html,/vibe-coded following prompts by Murdoch J\. Gabbay/);
    assert.match(html,/Heterogeneous trust in reliable broadcast via modal logic and history structures/);
    assert.match(html,/Murdoch J\. Gabbay and Isaac Sheff/);assert.match(html,/18 November 2026/);
    assert.match(html,/0\.7\.1 is a proof-of-concept/);
    const dialog=$('aboutDialog'),link=$('aboutLink'),close=$('closeAbout');
    assert.equal(link.getAttribute('href'),'#aboutDetails');assert.equal(link.getAttribute('aria-haspopup'),'dialog');
    assert.equal(dialog.getAttribute('aria-labelledby'),'aboutHeading');assert.equal(dialog.getAttribute('aria-describedby'),'aboutSummary');
    assert.equal($('aboutDetails').parentNode,dialog);assert.equal(dialog.hidden,false);assert.equal(close.hidden,false);
    document.viewEvents.length=0;let prevented=false;
    await link.fire('click',{preventDefault(){prevented=true;}});assert.equal(prevented,true);
    assert.equal(dialog.open,true);assert.equal(document.activeElement,close);assert.deepEqual(close.focusOptions,{preventScroll:true});
    await link.click();assert.equal(dialog.showCount,1,'an already open dialog is not opened twice');
    await close.click();assert.equal(dialog.open,false);assert.equal(document.activeElement,link);assert.deepEqual(link.focusOptions,{preventScroll:true});
    await link.click();dialog.open=false;await dialog.fire('close'); // Native Escape dispatches this event.
    assert.equal(document.activeElement,link);assert.equal(dialog.showCount,2);
    $('theoryEditor').focus();await dialog.fire('close');
    assert.equal(document.activeElement,$('theoryEditor'),'a stray close event does not move focus');
    assert(document.viewEvents.every(event=>event.type==='focus'),'About never invokes page scrolling');
  });
  await t.test('About leaves the running worker, inputs and recorded counterexample intact',async()=>{
    app.loadSource(first);await $('runForm').fire('submit');
    const worker=workers.at(-1),job=app.state.job,timer=app.state.timer,revision=app.state.revision,doc=app.state.doc;
    const project=JSON.stringify(app.project()),count=workers.length,requests=fetches.length,priorResult=$('results').textContent;
    await $('aboutLink').click();
    assert.equal(app.state.worker,worker);assert.equal(app.state.job,job);assert.equal(app.state.timer,timer);
    assert.notEqual(worker.terminated,true);assert.equal(workers.length,count);assert.equal(fetches.length,requests);
    assert.equal(app.state.revision,revision);assert.equal(app.state.doc,doc);assert.equal(JSON.stringify(app.project()),project);
    assert.equal($('results').textContent,priorResult);assert.equal($('runButton').disabled,true);
    const result=await runExperiment(worker.sent.sourceMarkdown,worker.sent.options);
    assert.equal(result.status,'counterexample');worker.onmessage({data:{id:worker.sent.id,type:'result',result}});
    assert.equal($('aboutDialog').open,true,'a finishing experiment leaves About open');
    const run=app.state.run,inspected=app.state.inspectedData,selected=app.state.selectedNode;
    const savedProject=JSON.stringify(app.project()),rendered=$('results').textContent;
    await $('closeAbout').click();
    assert.equal(app.state.run,run);assert.equal(app.state.inspectedData,inspected);assert.equal(app.state.selectedNode,selected);
    assert.equal(JSON.stringify(app.project()),savedProject);assert.equal($('results').textContent,rendered);
    assert.match(rendered,/Counterexample found/);assert.equal(app.state.job,null);assert.equal(workers.length,count);
    app.loadSource(first);
  });
  const meaning=source=>{
    const doc=parseDocument(source);
    return {model:doc.model,includeLive:doc.includeLive,axioms:doc.axioms.map(({name,kind,ast})=>({name,kind,ast})),properties:doc.properties.map(({name,scope,ast})=>({name,scope,ast}))};
  };
  await t.test('the initial theory is readable Markdown with a folded model and a highlighted editor',async()=>{
    assert.equal($('sourceDetails').hidden,true);assert.equal($('theoryReader').hidden,false);
    assert.equal($('readTheory').getAttribute('aria-pressed'),'true');
    assert.match($('theoryReader').innerHTML,/<h1\b/);
    assert.match($('theoryReader').innerHTML,/<details class="theory-model-block"/);
    assert.doesNotMatch($('theoryReader').innerHTML,/<details class="theory-model-block"[^>]*\bopen\b/);
    await $('editTheory').click();
    assert.equal($('sourceDetails').hidden,false);assert.equal($('theoryReader').hidden,true);
    assert.equal($('editTheory').getAttribute('aria-pressed'),'true');assert.equal($('theoryEditor').focused,true);
    assert.match($('theoryHighlight').innerHTML,/class="tok-(?:operator|keyword)"/);
    assert.equal($('theoryHighlight').textContent,$('theoryEditor').value+'\n');
    $('theoryEditor').clientWidth=520;$('theoryEditor').clientHeight=225;
    $('theoryEditor').scrollTop=210;$('theoryEditor').scrollLeft=75;await $('theoryEditor').fire('scroll');
    assert.equal($('theoryHighlight').style.width,'520px');assert.equal($('theoryHighlight').style.height,'225px');
    assert.equal($('theoryHighlight').scrollTop,210);assert.equal($('theoryHighlight').scrollLeft,75);
    $('highlightTheory').checked=false;await $('highlightTheory').fire('change');
    assert.equal($('theoryHighlight').hidden,true);assert(!$('theoryEditorFrame').className.split(/\s+/).includes('has-highlighting'));
    $('highlightTheory').checked=true;await $('highlightTheory').fire('change');
    assert.equal($('theoryHighlight').hidden,false);assert.equal($('theoryEditor').value,first);
  });
  await t.test('ASCII authoring and Unicode reading preserve meaning while edited choices stay unverified',async()=>{
    const expected=meaning(first);
    await $('unicodeTheory').click();assert.match($('theoryEditor').value,/∃/);
    assert.deepEqual(meaning($('theoryEditor').value),expected);
    await $('asciiTheory').click();
    assert.match($('theoryEditor').value,/axiom SomeChoice \[other\]:\s+exists /);
    assert.deepEqual(meaning($('theoryEditor').value),expected);
    assert.equal(app.state.sourceCurrent,false);assert.equal($('claimsControls').hidden,true);assert.equal($('runButton').disabled,true);
    const ascii=$('theoryEditor').value;
    await $('readTheory').click();
    assert.equal($('sourceDetails').hidden,true);assert.equal($('theoryPreviewStatus').hidden,false);
    assert.match($('theoryReader').textContent,/∃/);assert.equal($('theoryEditor').value,ascii);
    assert.equal(app.state.sourceCurrent,false,'reading a draft must not silently validate it');
    await $('editTheory').click();await $('theoryEditor').fire('keydown',{key:'Enter',ctrlKey:true});
    assert.equal(app.state.sourceCurrent,true);assert.equal($('claimsControls').hidden,false);
    assert.equal($('theoryPreviewStatus').hidden,true);assert.equal($('runButton').disabled,false);
    const selectedFormula=$('propertyOptions').querySelectorAll('code')[0];
    assert(selectedFormula,'the visible claim has a formula');
    assert.match(selectedFormula.textContent,/∃=1/);assert.match(selectedFormula.innerHTML,/tok-operator/);
    await $('unicodeTheory').click();assert.deepEqual(meaning($('theoryEditor').value),expected);
    assert.equal(app.updateChoices(),true);
  });
  await t.test('the reading preview escapes imported markup and never grants an edited theory a verdict',async()=>{
    const text=first+'\n## Untrusted prose\n\n<img src=x onerror="alert(1)">\n\n[unsafe](javascript:alert(1))\n';
    app.loadSource(first);await $('editTheory').click();$('theoryEditor').value=text;await $('theoryEditor').fire('input');
    await $('readTheory').click();
    assert.match($('theoryReader').innerHTML,/&lt;img /);
    assert.doesNotMatch($('theoryReader').innerHTML,/<img\b|href="javascript:/i);
    assert.equal($('theoryPreviewStatus').hidden,false);assert.equal(app.state.sourceCurrent,false);
    assert.equal($('claimsControls').hidden,true);assert.equal($('runButton').disabled,true);
    assert.equal($('theoryEditor').value,text,'rendering never rewrites Markdown source');
    assert.equal(app.updateChoices(),true);assert.deepEqual(meaning($('theoryEditor').value),meaning(first));
  });
  await t.test('invalid notation conversion leaves the draft intact and validation opens the error in the editor',async()=>{
    app.loadSource(first);await $('editTheory').click();
    const invalid=first+'\n```hsm\naxiom Broken [other]: ∀\n```\n';
    $('theoryEditor').value=invalid;await $('theoryEditor').fire('input');
    await $('unicodeTheory').click();assert.equal($('theoryEditor').value,invalid);
    await $('asciiTheory').click();assert.equal($('theoryEditor').value,invalid);
    assert.equal(app.state.sourceCurrent,false);assert.match($('notice').textContent,/Broken/);
    await $('readTheory').click();assert.equal($('theoryPreviewStatus').hidden,false);
    assert.equal(app.updateChoices(),false);assert.equal($('sourceDetails').hidden,false);assert.equal($('theoryReader').hidden,true);
    assert.equal($('theoryEditor').value,invalid);assert.equal($('runButton').disabled,true);
    assert.equal($('theoryEditor').focused,true);assert(Number.isInteger($('theoryEditor').selectionStart));
    app.loadSource(first);await $('readTheory').click();
  });
  await t.test('keyboard indentation has an escape route and validation shortcut',async()=>{
    app.loadSource(first);await $('editTheory').click();
    const editor=$('theoryEditor');editor.setSelectionRange(editor.value.length,editor.value.length);
    let prevented=false;
    await editor.fire('keydown',{key:'Tab',preventDefault(){prevented=true;}});
    assert.equal(prevented,true);assert.equal(editor.value,first+'  ');assert.equal(app.state.sourceCurrent,false);
    await editor.fire('keydown',{key:'Escape'});prevented=false;
    await editor.fire('keydown',{key:'Tab',preventDefault(){prevented=true;}});
    assert.equal(prevented,false,'Escape then Tab keeps native focus navigation');assert.equal(editor.value,first+'  ');
    await editor.fire('keydown',{key:'Tab',shiftKey:true,preventDefault(){prevented=true;}});
    assert.equal(prevented,false,'Shift+Tab keeps native backward focus navigation');
    await editor.fire('keydown',{key:'Enter',metaKey:true});assert.equal(app.state.sourceCurrent,true);
    assert.deepEqual(meaning(editor.value),meaning(first));app.loadSource(first);await $('readTheory').click();
  });
  await t.test('Tab indents a selected declaration and formula without replacing either',async()=>{
    app.loadSource(first);await $('editTheory').click();
    const editor=$('theoryEditor'),start=first.indexOf('axiom SomeChoice'),end=first.indexOf('\n```',start);
    assert(start>=0&&end>start);const selected=first.slice(start,end),lines=selected.split('\n').length;
    assert(lines>1,'the example has a multiline declaration');editor.setSelectionRange(start,end);
    await editor.fire('keydown',{key:'Tab'});
    const indented=selected.replace(/^/gm,'  ');
    assert.equal(editor.value,first.slice(0,start)+indented+first.slice(end));
    assert.equal(editor.selectionStart,start+2);assert.equal(editor.selectionEnd,end+lines*2);
    assert.deepEqual(meaning(editor.value),meaning(first));
    assert.equal(app.state.sourceCurrent,false);assert.equal($('claimsControls').hidden,true);assert.equal($('runButton').disabled,true);
    assert.equal($('theoryHighlight').textContent,editor.value+'\n');
    assert.equal(app.updateChoices(),true);assert.equal($('runButton').disabled,false);
    app.loadSource(first);await $('readTheory').click();
  });
  await t.test('Tab preserves selected prose starting at offset zero with a leading newline',async()=>{
    const prefix='\nalpha\nbeta\n',source=prefix+'\n'+first;
    app.loadSource(source);await $('editTheory').click();const editor=$('theoryEditor');editor.setSelectionRange(0,prefix.length);
    await editor.fire('keydown',{key:'Tab'});
    assert.equal(editor.value,'  \n  alpha\n  beta\n\n'+first);
    assert.equal(editor.selectionStart,2);assert.equal(editor.selectionEnd,prefix.length+6);
    assert.deepEqual(meaning(editor.value),meaning(first));assert.equal(app.state.sourceCurrent,false);
    assert.equal($('runButton').disabled,true);assert.equal(app.updateChoices(),true);
    app.loadSource(first);await $('readTheory').click();
  });
  await t.test('editing, saving and restoring a curated theory preserve its documentation link base',async()=>{
    const linkPath=()=>{
      const href=$('theoryReader').innerHTML.match(/href="([^"]*PAPER_MAP\.md)"/)?.[1];
      assert(href,'source-map link is present');return new URL(href,'http://checker.test/').pathname;
    };
    const pending=app.loadExample('first-steps.md');fetches.shift()({ok:true,text:async()=>first});await pending;
    assert.equal(app.state.theoryBasePath,'examples/theories/');assert.equal(linkPath(),'/docs/PAPER_MAP.md');
    await $('editTheory').click();$('theoryEditor').value+='\nA local edit to the explanation.\n';await $('theoryEditor').fire('input');
    assert.equal(app.state.custom,true);await $('readTheory').click();
    assert.equal(app.state.theoryBasePath,'examples/theories/');assert.equal(linkPath(),'/docs/PAPER_MAP.md');
    const saved=app.project();assert.equal(saved.theoryBasePath,'examples/theories/');
    assert.equal(saved.sourceMarkdown,$('theoryEditor').value);
    app.loadSource(first);assert.equal(app.state.theoryBasePath,'');
    const encoded=JSON.stringify(saved);$('importFile').files=[{name:'curated-project.json',size:Buffer.byteLength(encoded),text:async()=>encoded}];
    await $('importFile').fire('change');
    assert.equal(app.state.theoryBasePath,'examples/theories/');assert.equal(linkPath(),'/docs/PAPER_MAP.md');
    assert.equal($('theoryEditor').value,saved.sourceMarkdown);
    pageEvents.get('pagehide')();
    const key='history-structure-model-checker/custom-draft/v0.3';assert.equal(JSON.parse(storage.get(key)).theoryBasePath,'examples/theories/');
    app.loadSource(first);storage.set(key,JSON.stringify(saved));await $('restoreDraft').click();await $('readTheory').click();
    assert.equal(app.state.theoryBasePath,'examples/theories/');assert.equal(linkPath(),'/docs/PAPER_MAP.md');
    app.loadSource(first,{},true,undefined,'javascript:alert(1)');assert.equal(app.state.theoryBasePath,'');
    assert.doesNotMatch($('theoryReader').innerHTML,/href="javascript:/i);
    app.loadSource(first,{},true,undefined,'https://untrusted.example/');assert.equal(app.state.theoryBasePath,'');
    app.loadSource(first,{},true,undefined,'examples/theories/');assert.equal(app.state.theoryBasePath,'examples/theories/');
  });
  await t.test('source mirror follows viewport and editor resizing before matching scroll positions',async()=>{
    const editor=$('theoryEditor'),mirror=$('theoryHighlight');
    const observed=resizeObservers.find(observer=>observer.observed.includes(editor));assert(observed,'textarea resizing is observed');
    editor.clientWidth=480;editor.clientHeight=312;editor.scrollTop=975;editor.scrollLeft=140;
    observed.callback();assert.equal(mirror.style.width,'480px');assert.equal(mirror.style.height,'312px');
    assert.equal(mirror.scrollTop,975);assert.equal(mirror.scrollLeft,140);
    editor.clientWidth=390;editor.clientHeight=251;assert(pageEvents.has('resize'),'window resize has a fallback sync hook');
    pageEvents.get('resize')();assert.equal(mirror.style.width,'390px');assert.equal(mirror.style.height,'251px');
    app.loadSource(first);await $('readTheory').click();
  });
  await t.test('every curated load restores its declared preset choices, limits and model event palette',async()=>{
    const mapping={maxAdditionalNodes:'maxAdditionalNodes',maxModels:'maxModels',maxKnowledgeFamilies:'knowledgeBudget',maxCompilationNodes:'compilationBudget',maxDecisions:'decisionBudget',maxSteps:'stepBudget'};
    for(const example of EXAMPLES) {
      for(const id of Object.values(mapping))$(id).value='1';
      $('timeBudget').value='3';$('pinFacts').checked=false;radios[0].checked=true;$('eventPalette').value='["old palette"]';
      for(const n of [...$('propertyOptions').querySelectorAll('input'),...$('axiomOptions').querySelectorAll('input')])n.checked=false;
      const source=await readFile(new URL('../examples/theories/'+example.file,import.meta.url),'utf8');
      const pending=app.loadExample(example.file);fetches.shift()({ok:true,text:async()=>source});await pending;
      const options=exampleOptions(example.file);
      assert.equal($('theoryEditor').value,source,example.file);
      assert.equal($('exampleSelect').value,example.file);
      assert.equal($('exampleDescription').textContent,example.description);
      assert.equal(radios.find(n=>n.checked).value,'synthesize');assert.equal($('pinFacts').checked,true);
      assert.equal($('timeBudget').value,String(options.maxMilliseconds/1000));
      for(const [key,id] of Object.entries(mapping))assert.equal($(id).value,String(options[key]),example.file+': '+key);
      assert.deepEqual($('propertyOptions').querySelectorAll('input:checked').map(n=>n.value),options.selectedProperties??app.state.doc.properties.map(p=>p.name));
      assert.deepEqual($('axiomOptions').querySelectorAll('input:not(:checked)').map(n=>n.value),options.droppedAxioms);
      const palette=new Map([['null',null]]);for(const node of app.state.doc.model.nodes)palette.set(JSON.stringify(node.event),node.event);
      assert.deepEqual(JSON.parse($('eventPalette').value),[...palette.values()],example.file+': event palette');
      assert.equal(app.state.custom,false);
    }
  });
  await t.test('source errors select the exact character after Unicode labels and every newline form', async () => {
    const original = 'axiom SomeChoice [other]:\n  ∃ v. chosen(v)';
    assert(first.includes(original));
    for (const newline of ['\n', '\r\n', '\r']) {
      const broken = first.replace(original, 'axiom "😀?" [other]: ∀ v. chosen(v) @').replace(/\n/g, newline);
      assert.equal(app.loadSource(broken), false);
      assert.equal(app.updateChoices(), false);
      assert.equal($('sourceDetails').hidden, false);
      assert.equal($('theoryEditor').selectionStart, broken.indexOf('@'));
      assert.equal($('theoryEditor').selectionEnd, broken.indexOf('@') + 1);
    }
    app.loadSource(first);
  });
  await t.test('a completed result exposes its exact run identity and retains its original source after edits', async () => {
    app.loadSource(first);
    await $('runForm').fire('submit');
    const worker = workers.at(-1), request = worker.sent;
    const result = await runExperiment(request.sourceMarkdown, request.options);
    assert(result.snapshot.id.startsWith('sha256:'));
    worker.onmessage({data: {id: request.id, type: 'result', result}});
    assert($('results').textContent.includes(result.snapshot.id));
    assert($('results').textContent.includes(result.snapshot.engine.version));
    assert.equal(app.state.runProject.format,'history-structure-project/v3');
    assert.equal(app.state.runProject.semantics,SEMANTICS_PROFILE);
    assert($('results').querySelectorAll('button').some(button => button.textContent === 'Download run Markdown'));
    assert.equal(app.state.run.sourceMarkdown, first);
    const id = app.state.run.snapshot.id;
    $('theoryEditor').value = first + '\nA later edit.\n';
    await $('theoryEditor').fire('input');
    assert.equal($('staleResults').hidden, false);
    assert.equal(app.state.run.snapshot.id, id);
    assert.equal(app.state.run.sourceMarkdown, first);
    app.loadSource(first);
  });
  await t.test('applying JSON and adding a tuple preserve the literate source',async()=>{
    const custom=first+'\nA final explanation.\n\n```js\nconst example = 1;\n```\n';app.loadSource(custom);
    const original=JSON.parse($('modelEditor').value);$('modelEditor').value=JSON.stringify({...original,name:'Changed JSON name'});await $('modelEditor').fire('input');app.applyModel();
    assert($('theoryEditor').value.startsWith(custom.split('```hsm-model')[0]));
    assert($('theoryEditor').value.endsWith(custom.split('```hsm-model')[1].split('```').slice(1).join('```')));
    assert($('theoryEditor').value.includes('Changed JSON name'));
    $('nodeId').value='audit-tuple';$('nodePlace').value='p';$('nodeEvent').value='null';$('nodePast').value='';await $('addNode').click();
    assert($('theoryEditor').value.includes('A final explanation.'));assert($('theoryEditor').value.includes('const example = 1;'));assert(app.state.doc.model.nodes.some(n=>n.id==='audit-tuple'));
  });
  await t.test('choice refresh preserves dirty JSON until explicit apply or discard',async()=>{
    $('modelEditor').value=JSON.stringify({...app.state.doc.model,name:'Unapplied edit'});await $('modelEditor').fire('input');
    assert.equal(app.updateChoices(),false);assert($('modelEditor').value.includes('Unapplied edit'));assert.equal(app.state.modelDirty,true);assert.equal($('discardModelChanges').hidden,false);
    await $('discardModelChanges').click();assert.equal(app.state.modelDirty,false);assert(!$('modelEditor').value.includes('Unapplied edit'));
  });
  await t.test('loading another document replaces an unapplied draft without blocking the new import',async()=>{
    $('modelEditor').value=JSON.stringify({...app.state.doc.model,name:'Old unapplied edit'});await $('modelEditor').fire('input');
    assert.equal(app.loadSource(first),true);assert.equal(app.state.modelDirty,false);assert.equal($('theoryEditor').value,first);
  });
  await t.test('project selections preserve exact declared names and reject unknown or duplicate choices',()=>{
    assert.equal(app.loadSource(first,{selectedProperties:[],droppedAxioms:['SomeChoice']}),true);
    assert.equal($('propertyOptions').querySelectorAll('input:checked').length,0);assert.equal($('axiomOptions').querySelectorAll('input:checked').length,0);
    assert.throws(()=>app.loadSource(first,{selectedProperties:['Missing claim']}),/Unknown selectedProperties/);
    assert.throws(()=>app.loadSource(first,{droppedAxioms:['Missing assumption']}),/Unknown droppedAxioms/);
    assert.throws(()=>app.loadSource(first,{selectedProperties:['UniqueChoice','UniqueChoice']}),/duplicate/);
    app.loadSource(first);
  });
  const finish=(worker,holds=true)=>worker.onmessage({data:{id:worker.sent.id,type:'result',result:{holds,failures:[]}}});
  await t.test('formula, validity and exact-world edits clear the old verdict',async()=>{
    for(const [id,event] of [['formulaEditor','input'],['scopeSelect','change'],['worldPlace','change'],['worldTime','change'],['worldEvent','input']]){
      await $('checkFormula').click();finish(workers.at(-1));assert($('formulaResult').textContent.includes('Formula holds'));
      await $(id).fire(event);assert(!$('formulaResult').textContent.includes('Formula holds'),id);
    }
  });
  await t.test('changing the query or inspected model cancels the old formula job and rejects late results',async()=>{
    await $('checkFormula').click();const queryWorker=workers.at(-1);await $('formulaEditor').fire('input');assert(queryWorker.terminated);finish(queryWorker);assert(!$('formulaResult').textContent.includes('Formula holds'));
    await $('checkFormula').click();const modelWorker=workers.at(-1);app.inspectModel({...app.state.doc.model,name:'Other model'},'Other model');assert(modelWorker.terminated);assert.equal(app.state.job,null);finish(modelWorker);assert(!$('formulaResult').textContent.includes('Formula holds'));assert.equal($('inspectorContext').textContent,'Other model');
  });
  await t.test('weakened evidence file import restores the exact recorded assumptions and one claim, unverified until replay',async()=>{
    const source=await readFile(new URL('../examples/theories/echo-ne.md',import.meta.url),'utf8');
    const report=await runExperiment(source,{mode:'synthesize',droppedAxioms:['EchoNE'],selectedProperties:['Agreement'],pinFacts:false,maxMilliseconds:5000});
    assert.equal(report.status,'counterexample');const evidence=report.properties[0].evidence;assert(evidence);
    const text=JSON.stringify(evidence);$('importFile').files=[{name:'weakened-evidence.json',size:Buffer.byteLength(text),text:async()=>text}];await $('importFile').fire('change');
    assert.deepEqual($('axiomOptions').querySelectorAll('input:not(:checked)').map(n=>n.value),['EchoNE']);
    assert.deepEqual($('propertyOptions').querySelectorAll('input:checked').map(n=>n.value),['Agreement']);
    assert.equal(radios.find(n=>n.checked).value,'synthesize');assert.equal($('pinFacts').checked,false);assert.equal($('timeBudget').value,'5');
    assert($('results').textContent.includes('(unverified)'));assert($('inspectorContext').textContent.includes('(unverified)'));
    const replay=$('results').querySelectorAll('button').find(n=>n.textContent==='Replay imported evidence');assert(replay);await replay.click();
    const worker=workers.at(-1);assert.equal(worker.sent.action,'replay');assert.deepEqual(worker.sent.evidence.droppedAxioms,['EchoNE']);
    const replayed=replayExperiment(worker.sent.evidence,{maxMilliseconds:5000});assert.equal(replayed.verified,true);worker.onmessage({data:{id:worker.sent.id,type:'result',result:replayed}});
    assert($('results').textContent.includes('Imported evidence replay verified.'));assert(!$('inspectorContext').textContent.includes('(unverified)'));
  });
  await t.test('pagehide flushes the last pending draft and forgetting cancels a pending save',async()=>{
    app.loadSource(first);$('theoryEditor').value=first+'\nLast edit before closing.\n';await $('theoryEditor').fire('input');pageEvents.get('pagehide')();
    const key='history-structure-model-checker/custom-draft/v0.3';assert(JSON.parse(storage.get(key)).sourceMarkdown.includes('Last edit before closing.'));
    await $('theoryEditor').fire('input');await $('forgetDraft').click();pageEvents.get('pagehide')();assert.equal(storage.has(key),false);
  });
  // These flow checks drive the actual application with small worker messages.
  // The solver and the mathematical outcomes are exercised by separate tests;
  // walking all sources here checks navigation without solving all29 twice.
  const curatedSources=new Map();
  const readCurated=async file=>{
    if(!curatedSources.has(file))curatedSources.set(file,await readFile(new URL('../examples/theories/'+file,import.meta.url),'utf8'));
    return curatedSources.get(file);
  };
  const loadCurated=async file=>{
    const text=await readCurated(file),pending=app.loadExample(file),resolve=fetches.shift();
    assert(resolve,'a curated source is requested');resolve({ok:true,text:async()=>text});await pending;
    return text;
  };
  const finishCurated=async(status='holds')=>{
    await $('runForm').fire('submit');
    const worker=workers.at(-1),request=worker.sent;
    assert.equal(request.action,'experiment');
    const incomplete=status==='incomplete',noModel=status==='no-model';
    const result={name:app.state.doc.name,sourceMarkdown:request.sourceMarkdown,mode:request.options.mode,status,complete:!incomplete,
      reason:incomplete?'A work limit left questions open.':'A completed flow-test response.',
      consistency:{consistent:incomplete?null:!noModel},
      retainedAxioms:[...(app.state.doc.includeLive?['ThyLive']:[]),...app.state.doc.axioms.map(a=>a.name)].filter(name=>!request.options.droppedAxioms.includes(name)),
      droppedAxioms:request.options.droppedAxioms,selectedProperties:request.options.selectedProperties,
      properties:app.state.doc.properties.filter(p=>request.options.selectedProperties.includes(p.name)).map(p=>({...p,status:noModel?'not-tested':incomplete?'incomplete':status})),
      bounds:request.options,stats:{}};
    worker.onmessage({data:{id:request.id,type:'result',result}});
    return {worker,request,result};
  };
  const continuationButton=()=>{
    const buttons=$('exampleContinuation').querySelectorAll('button');
    assert.equal(buttons.length,2,'navigation offers previous and next in reading order');
    assert.equal(buttons[0].dataset.direction,'previous');
    assert.equal(buttons[1].dataset.direction,'next');
    return buttons[1];
  };
  await t.test('HBBSafe Remove Echo! opens the actual weakening, with explicit full-theory and defaults comparisons',async()=>{
    const source=await loadCurated('hbb1-echo-progress.md');
    assert.equal($('examplePreset').hidden,false);
    assert.match($('examplePresetText').textContent,/Echo!/);
    assert.match($('examplePresetText').textContent,/omit|remov|unchecked/i);
    const omitted=()=>$('axiomOptions').querySelectorAll('input:not(:checked)').map(input=>input.value);
    assert.deepEqual(omitted(),['Echo!']);
    const execute=async()=>{
      await $('runForm').fire('submit');const worker=workers.at(-1),request=worker.sent;
      const result=await runExperiment(request.sourceMarkdown,request.options);
      worker.onmessage({data:{id:request.id,type:'result',result}});
      return result;
    };
    let result=await execute();
    assert.equal(result.status,'counterexample');
    assert.deepEqual(result.properties.map(p=>p.status),['counterexample','holds','holds']);
    assert.deepEqual($('results').querySelectorAll('.status-pill').map(pill=>pill.className),
      ['status-pill error counterexample','status-pill success holds','status-pill success holds']);
    assert.equal(replayExperiment(result.properties[0].evidence).verified,true);
    const workersBefore=workers.length;
    await $('presetFullTheory').click();
    assert.equal(workers.length,workersBefore,'selecting a comparison does not run it automatically');
    assert.deepEqual(omitted(),[]);assert.equal($('theoryEditor').value,source);
    result=await execute();
    assert.equal(result.status,'no-model');assert(result.properties.every(p=>p.status==='not-tested'));
    assert.match($('results').textContent,/no model/i);assert.match($('results').textContent,/not tested/i);
    $('eventPalette').value='["not the curated palette"]';
    await $('presetDefaults').click();
    assert.deepEqual(omitted(),['Echo!']);assert.equal($('theoryEditor').value,source);
    const expectedPalette=new Map([['null',null]]);for(const node of app.state.doc.model.nodes)expectedPalette.set(JSON.stringify(node.event),node.event);
    assert.deepEqual(JSON.parse($('eventPalette').value),[...expectedPalette.values()]);
    result=await execute();assert.equal(result.status,'counterexample');
    assert.equal(result.properties.find(p=>p.name==='Happy Termination').status,'counterexample');
    const variant=source+'\nA custom source note.\n';
    $('theoryEditor').value=variant;await $('theoryEditor').fire('input');assert.equal(app.updateChoices(),true);
    assert.equal($('examplePreset').hidden,true,'preset actions do not promise the baseline outcome for an edited source');
    await $('presetFullTheory').click();await $('presetDefaults').click();
    assert.equal($('theoryEditor').value,variant,'stale preset actions cannot replace an edited source');
    assert.deepEqual(omitted(),['Echo!'],'stale preset actions cannot replace the edited source choices either');
  });
  await t.test('the end-only Echo diagnostic is selected explicitly without presenting a protocol correctness failure',async()=>{
    await loadCurated('hbb1-echo-end-only.md');
    assert.deepEqual($('propertyOptions').querySelectorAll('input:checked').map(row=>row.value),
      ['Happy Termination','Cascade Termination','Agreement','Bad end-only Echo!']);
    assert.match($('examplePresetText').textContent,/not a failure of a protocol correctness claim/);
    await $('runForm').fire('submit');const worker=workers.at(-1),request=worker.sent;
    const result=await runExperiment(request.sourceMarkdown,request.options);
    worker.onmessage({data:{id:request.id,type:'result',result}});
    assert.equal(result.status,'counterexample');
    assert.deepEqual(result.properties.map(row=>row.status),['holds','holds','holds','counterexample']);
    assert.equal(result.properties.at(-1).name,'Bad end-only Echo!');
    assert.equal(replayExperiment(result.properties.at(-1).evidence).verified,true);
  });
  await t.test('new curated examples clear the previous counterexample and navigate back without running',async()=>{
    const source=await loadCurated(EXAMPLES[0].file);
    const firstBack=$('exampleContinuation').querySelectorAll('button')[0];
    assert.equal(firstBack.disabled,true);
    assert.equal(firstBack.getAttribute('aria-label'),'Return to previous example');
    assert.equal(firstBack.children[0].textContent,'⬅︎');
    assert.equal(firstBack.children[0].getAttribute('aria-hidden'),'true');
    const requests=fetches.length;await firstBack.click();assert.equal(fetches.length,requests);
    await $('runForm').fire('submit');const worker=workers.at(-1),request=worker.sent;
    const result=await runExperiment(request.sourceMarkdown,request.options);
    assert.equal(result.status,'counterexample');
    worker.onmessage({data:{id:request.id,type:'result',result}});
    assert.match($('results').textContent,/Counterexample found/);
    $('formulaEditor').value='false';$('scopeSelect').value='world';$('worldControls').hidden=false;
    $('formulaResult').textContent='Formula fails for the old example';
    app.state.importedEvidence={old:true};app.state.importedEvidenceStatus={old:true};
    const before=workers.length;
    const next=continuationButton().click();fetches.shift()({ok:true,text:async()=>readCurated(EXAMPLES[1].file)});await next;
    assert.equal(workers.length,before,'loading the next example never runs it');
    assert.equal(app.state.run,null);assert.equal(app.state.runOptions,null);assert.equal(app.state.runProject,null);
    assert.equal(app.state.runCuratedExample,null);assert.equal(app.state.importedEvidence,null);assert.equal(app.state.importedEvidenceStatus,null);
    assert.equal(app.state.inspectedEvidence,null);assert.equal(app.state.inspectedFailure,null);
    assert.match($('results').textContent,/This example has not been run/);
    assert.doesNotMatch($('results').textContent,/Counterexample found|Formula fails|sha256:/);
    assert.equal($('results').querySelectorAll('button').length,0,'old replay/download actions are gone');
    assert.equal($('staleResults').hidden,true);assert.equal($('formulaResult').textContent,'');
    assert.equal($('formulaEditor').value,'seq');assert.equal($('scopeSelect').value,'end');assert.equal($('worldControls').hidden,true);
    assert.equal($('failureContext').hidden,true);assert.equal($('failureContext').textContent,'');
    assert.deepEqual(app.state.inspectedData,parseDocument(await readCurated(EXAMPLES[1].file)).model);
    assert.match($('inspectorContext').textContent,/Supplied model for this example/);
    // A queued reply from the old worker cannot restore its result.
    worker.onmessage({data:{id:request.id,type:'result',result}});
    assert.equal(app.state.run,null);assert.doesNotMatch($('results').textContent,/Counterexample found/);
    const back=$('exampleContinuation').querySelectorAll('button')[0];assert.equal(back.disabled,false);
    const previous=back.click();fetches.shift()({ok:true,text:async()=>source});await previous;
    assert.equal($('exampleSelect').value,EXAMPLES[0].file);assert.equal(app.state.run,null);
    assert.equal($('exampleContinuation').querySelectorAll('button')[0].disabled,true);
    assert.match($('results').textContent,/This example has not been run/);
    assert.equal(workers.length,before,'returning to an example does not silently rerun it');
  });
  await t.test('reset and picker loads clear old results while invalid documents preserve the current context',async()=>{
    const source=await loadCurated(EXAMPLES[0].file);const prior=await finishCurated('counterexample');
    const oldRun=app.state.run,oldModel=app.state.inspectedData,oldText=$('results').textContent;
    const malformed=continuationButton().click();fetches.shift()({ok:true,text:async()=>source+'\n```hsm\nproperty Broken: @\n```\n'});await malformed;
    assert.equal(app.state.run,oldRun);assert.equal(app.state.inspectedData,oldModel);assert.equal($('results').textContent,oldText);
    assert.equal($('exampleSelect').value,EXAMPLES[0].file);assert.equal(continuationButton().disabled,false);
    const reset=$('resetExample').click();fetches.shift()({ok:true,text:async()=>source});await reset;
    assert.equal(app.state.run,null);assert.match($('results').textContent,/has not been run/);
    await finishCurated('counterexample');
    $('exampleSelect').value=EXAMPLES[1].file;await $('exampleSelect').fire('change');
    fetches.shift()({ok:true,text:async()=>readCurated(EXAMPLES[1].file)});await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(app.state.run,null);assert.match($('results').textContent,/has not been run/);
    prior.worker.onmessage({data:{id:prior.request.id,type:'result',result:prior.result}});
    assert.equal(app.state.run,null);
  });
  await t.test('previous and next focus the chooser and land below the measured sticky bar for either motion preference',async()=>{
    const media=globalThis.matchMedia;
    try {
      for(const reducedMotion of [false,true]) {
        globalThis.matchMedia=()=>({matches:reducedMotion});
        // A wrapped mobile/zoomed bar is taller than the desktop bar. Neither
        // its height nor the picker position is a fixed page-wide constant.
        workflowBar.layoutHeight=reducedMotion?148:72;
        chooserLabel.layoutTop=reducedMotion?620:480;
        const initial=await loadCurated(EXAMPLES[0].file);
        for(const direction of ['next','previous']) {
          const button=$('exampleContinuation').querySelectorAll('button')[direction==='next'?1:0];
          button.focus();window.scrollY=3200;document.viewEvents.length=0;
          // A shorter replacement document may clamp scrolling when layout
          // flushes. Its rectangle must use the same, post-layout offset.
          chooserLabel.beforeMeasure=()=>{window.scrollY=Math.min(window.scrollY,900);};
          const before=workers.length,pending=button.click();
          assert.equal(document.activeElement,button,'a pending load does not steal focus');
          assert.equal(window.scrollY,3200,'a pending load does not scroll');
          fetches.shift()({ok:true,text:async()=>direction==='next'?readCurated(EXAMPLES[1].file):initial});
          await pending;
          assert.equal(document.activeElement,$('exampleSelect'));
          assert.deepEqual($('exampleSelect').focusOptions,{preventScroll:true});
          assert.equal($('theoryReader').hidden,false);assert.equal($('sourceDetails').hidden,true);
          assert.equal(workers.length,before,'moving to the chooser never starts a check');
          assert.deepEqual(document.viewEvents.map(event=>event.type),['focus','measure','measure','scrollTo']);
          assert.equal(document.viewEvents[0].target,$('exampleSelect'));
          assert.equal(document.viewEvents[1].target,chooserLabel,'measure the caption and select, not the whole theory section');
          assert.equal(document.viewEvents[2].target,workflowBar);
          assert.deepEqual(document.viewEvents[3].options,{top:chooserLabel.layoutTop-workflowBar.layoutHeight-16,behavior:'instant'});
          assert.equal(chooserLabel.getBoundingClientRect().top,workflowBar.layoutHeight+16);
        }
      }
    } finally {
      globalThis.matchMedia=media;workflowBar.layoutHeight=72;chooserLabel.layoutTop=480;delete chooserLabel.beforeMeasure;
    }
  });
  await t.test('failed and superseded continuation loads do not redirect focus or scroll',async()=>{
    await loadCurated(EXAMPLES[0].file);
    let button=continuationButton();button.focus();window.scrollY=2700;document.viewEvents.length=0;
    let pending=button.click();fetches.shift()({ok:false,status:503});await pending;
    assert.equal(document.activeElement,button);assert.equal(window.scrollY,2700);
    assert.deepEqual(document.viewEvents,[]);
    button=continuationButton();pending=button.click();
    $('theoryEditor').value+='\nA newer edit must keep its place.\n';
    await $('theoryEditor').fire('input');$('theoryEditor').focus();document.viewEvents.length=0;
    fetches.shift()({ok:true,text:async()=>readCurated(EXAMPLES[1].file)});await pending;
    assert.equal(document.activeElement,$('theoryEditor'));assert.equal(window.scrollY,2700);
    assert.deepEqual(document.viewEvents,[]);
    assert.equal($('exampleSelect').value,EXAMPLES[0].file);
  });
  await t.test('curated results invite a click through every example in chooser order and restart after the last',async()=>{
    await loadCurated(EXAMPLES[0].file);
    for(const [index,example]of EXAMPLES.entries()) {
      assert.equal($('exampleSelect').value,example.file);
      assert.equal($('exampleContinuation').hidden,false,'a loaded example can be browsed without running');
      assert.equal($('exampleContinuation').querySelectorAll('button')[0].disabled,index===0);
      const status=['holds','counterexample','no-model','incomplete'][index%4];
      await finishCurated(status);
      const card=$('exampleContinuation');
      assert.equal(card.hidden,false,example.file+': a returned outcome offers a next step');
      assert.equal(card.getAttribute('aria-busy'),'false');
      assert.equal(card.getAttribute('aria-busy'),'false','each new invitation starts idle');
      assert(card.textContent.includes(`${index+1} of ${EXAMPLES.length}`));
      assert.doesNotMatch(card.textContent,/all (?:29 )?(?:examples|theories).*(?:passed|verified|completed)/i);
      const button=continuationButton(),next=EXAMPLES[index+1]??EXAMPLES[0];
      if(index+1<EXAMPLES.length) {
        assert.equal(button.getAttribute('aria-label'),'Continue to next example');
        assert.equal(button.children.at(-1).textContent,'➡︎');
        assert(card.textContent.includes(next.label));assert(card.textContent.includes(next.description));
      } else {
        assert.match(card.textContent,/last curated example/i);
        assert.equal(button.getAttribute('aria-label'),'Start again with First steps');
        assert.equal(button.children.at(-1).textContent,'➡︎');
      }
      document.viewEvents.length=0;
      const before=workers.length,pending=button.click(),resolve=fetches.shift();
      assert.equal(card.getAttribute('aria-busy'),'true','a pending source load is announced');
      assert(resolve,'the next source loads only after the invitation is clicked');
      resolve({ok:true,text:async()=>readCurated(next.file)});await pending;
      assert.equal(workers.length,before,'advancing does not run the next theory automatically');
      assert.equal($('exampleSelect').value,next.file);assert.equal($('theoryEditor').value,await readCurated(next.file));
      assert.equal($('theoryReader').hidden,false);assert.equal($('sourceDetails').hidden,true);
      assert.equal(document.activeElement,$('exampleSelect'),'every next/restart step returns keyboard focus to the chooser');
      assert.equal(document.viewEvents.filter(event=>event.type==='scrollTo').length,1);
      assert.equal(document.viewEvents.find(event=>event.type==='scrollTo').options.behavior,'instant');
      assert.equal(card.getAttribute('aria-busy'),'false','the next source is no longer loading');
      assert.equal($('timeBudget').value,String(exampleOptions(next.file).maxMilliseconds/1000));
      assert.deepEqual($('axiomOptions').querySelectorAll('input:not(:checked)').map(n=>n.value),exampleOptions(next.file).droppedAxioms);
      assert.deepEqual($('propertyOptions').querySelectorAll('input:checked').map(n=>n.value),exampleOptions(next.file).selectedProperties??app.state.doc.properties.map(p=>p.name));
    }
    assert.equal($('exampleSelect').value,EXAMPLES[0].file);
  });
  await t.test('weakening a curated run keeps its next step and preserves that run as a recoverable draft',async()=>{
    const source=await loadCurated(EXAMPLES[0].file),key='history-structure-model-checker/custom-draft/v0.3';
    const axiom=$('axiomOptions').querySelectorAll('input').find(n=>n.value==='SomeChoice');
    axiom.checked=false;await axiom.fire('change');
    $('timeBudget').value='7';await $('timeBudget').fire('input');
    assert.equal(app.state.custom,true,'run-setting edits have historically marked the local draft as custom');
    await finishCurated('counterexample');
    assert.equal($('exampleContinuation').hidden,false,'unchanged curated source remains eligible after assumption edits');
    const pending=continuationButton().click(),resolve=fetches.shift();resolve({ok:true,text:async()=>readCurated(EXAMPLES[1].file)});await pending;
    pageEvents.get('pagehide')();
    const draft=JSON.parse(storage.get(key));assert.equal(draft.sourceMarkdown,source);
    assert.deepEqual(draft.options.droppedAxioms,['SomeChoice']);assert.equal(draft.options.maxMilliseconds,7000);
    assert.equal($('theoryEditor').value,await readCurated(EXAMPLES[1].file));
    assert.equal($('timeBudget').value,String(exampleOptions(EXAMPLES[1].file).maxMilliseconds/1000));
  });
  await t.test('editing source or settings hides the old invitation and detached actions cannot replace the edited context',async()=>{
    const source=await loadCurated(EXAMPLES[0].file);await finishCurated();
    const old=continuationButton();$('theoryEditor').value=source+'\nA local change.\n';await $('theoryEditor').fire('input');
    assert.equal($('exampleContinuation').hidden,true);const requests=fetches.length;await old.click();
    assert.equal(fetches.length,requests);assert.equal($('theoryEditor').value,source+'\nA local change.\n');
    assert.equal(app.updateChoices(),true);await finishCurated();
    assert.equal($('exampleContinuation').hidden,false,'a validated rerun can continue from a labelled edited variant');
    assert.match($('exampleContinuation').textContent,/edited variant/i);
    await loadCurated(EXAMPLES[0].file);await finishCurated();const settingsAction=continuationButton();
    $('timeBudget').value='9';await $('timeBudget').fire('input');
    assert.equal($('exampleContinuation').hidden,true);await settingsAction.click();assert.equal(fetches.length,requests);
  });
  await t.test('the first lesson can edit existence to uniqueness, rerun, then advance while keeping its exact variant draft',async()=>{
    const source=await loadCurated(EXAMPLES[0].file),key='history-structure-model-checker/custom-draft/v0.3';
    const declaration='axiom SomeChoice [other]:\n  ∃ v. chosen(v)';assert(source.includes(declaration));
    const variant=source.replace(declaration,'axiom SomeChoice [other]:\n  ∃¹ v. chosen(v)');
    await $('editTheory').click();$('theoryEditor').value=variant;await $('theoryEditor').fire('input');
    assert.equal(app.updateChoices(),true);
    const edited=parseDocument(variant);
    assert.deepEqual(edited.axioms.find(row=>row.name==='SomeChoice').ast,edited.properties.find(row=>row.name==='UniqueChoice').ast);
    await $('runForm').fire('submit');const worker=workers.at(-1),request=worker.sent;
    const result=await runExperiment(request.sourceMarkdown,request.options);
    assert.equal(result.status,'holds');assert.equal(result.complete,true);
    worker.onmessage({data:{id:request.id,type:'result',result}});
    assert.equal(request.sourceMarkdown,variant);
    assert.equal($('exampleContinuation').hidden,false);assert.match($('exampleContinuation').textContent,/edited variant/i);
    const pending=continuationButton().click(),resolve=fetches.shift();resolve({ok:true,text:async()=>readCurated(EXAMPLES[1].file)});await pending;
    pageEvents.get('pagehide')();const saved=JSON.parse(storage.get(key));
    assert.equal(saved.sourceMarkdown,variant,'the teaching edit is preserved exactly, including its prose');
    assert.equal($('theoryEditor').value,await readCurated(EXAMPLES[1].file));
    assert.equal($('timeBudget').value,String(exampleOptions(EXAMPLES[1].file).maxMilliseconds/1000));
    assert.deepEqual($('axiomOptions').querySelectorAll('input:not(:checked)').map(node=>node.value),[]);
    assert.equal($('theoryReader').hidden,false);assert.equal($('exampleContinuation').getAttribute('aria-busy'),'false');
  });
  await t.test('stopped runs and worker failures retain usable navigation without starting another run',async()=>{
    await loadCurated(EXAMPLES[1].file);
    const old=continuationButton(),requests=fetches.length;
    await $('runForm').fire('submit');const stopped=workers.at(-1);
    assert.equal($('exampleContinuation').hidden,false,'navigation remains present during a run');
    assert($('exampleContinuation').querySelectorAll('button').every(button=>button.disabled));
    await old.click();assert.equal(fetches.length,requests,'a detached pre-run action stays invalid');
    const count=workers.length;
    await $('stopButton').click();
    assert.equal(app.state.job,null);assert.equal(stopped.terminated,true);
    assert($('exampleContinuation').querySelectorAll('button').every(button=>!button.disabled));
    assert.equal(workers.length,count,'stopping does not launch a replacement worker');
    await $('runForm').fire('submit');let worker=workers.at(-1);
    worker.onmessage({data:{id:worker.sent.id,type:'error',error:{message:'A test experiment failure.',incomplete:false}}});
    assert.equal(app.state.job,null);assert.equal($('exampleContinuation').hidden,false);
    assert($('exampleContinuation').querySelectorAll('button').every(button=>!button.disabled));
    await $('runForm').fire('submit');worker=workers.at(-1);
    worker.onerror({message:'A test worker failure.'});
    assert.equal(app.state.job,null);assert.equal($('exampleContinuation').hidden,false);
    assert($('exampleContinuation').querySelectorAll('button').every(button=>!button.disabled));
    const originalWorker=globalThis.Worker,before=workers.length;
    try {
      globalThis.Worker=class {constructor(){throw new Error('A test constructor failure.');}};
      await $('runForm').fire('submit');
    } finally {globalThis.Worker=originalWorker;}
    assert.equal(app.state.job,null);assert.equal($('exampleContinuation').hidden,false);
    assert($('exampleContinuation').querySelectorAll('button').every(button=>!button.disabled));
    assert.match($('notice').textContent,/constructor failure/);
    assert.equal(workers.length,before,'a constructor failure cannot start a hidden worker');
    const next=continuationButton().click();fetches.shift()({ok:true,text:async()=>readCurated(EXAMPLES[2].file)});await next;
    assert.equal($('exampleSelect').value,EXAMPLES[2].file);assert.equal(app.state.run,null);
    assert.equal(workers.length,before,'navigation after a failure loads but does not run the example');
    // A stopped edited variant keeps the same navigation policy too.
    const source=await loadCurated(EXAMPLES[0].file);
    $('theoryEditor').value=source+'\nAn edited lesson.\n';await $('theoryEditor').fire('input');assert.equal(app.updateChoices(),true);
    await $('runForm').fire('submit');await $('stopButton').click();
    assert.equal($('exampleContinuation').hidden,false);assert.match($('exampleContinuation').textContent,/edited variant/i);
    assert.equal(continuationButton().disabled,false);
  });
  await t.test('a detached invitation from an earlier run cannot interrupt a new run of identical source',async()=>{
    const source=await loadCurated(EXAMPLES[0].file),previous=await finishCurated();
    const old=continuationButton();await $('runForm').fire('submit');const current=workers.at(-1);
    const requests=fetches.length;await old.click();
    assert.equal(fetches.length,requests);assert.equal($('theoryEditor').value,source);
    assert.equal(app.state.worker,current);assert.notEqual(current.terminated,true);
    current.onmessage({data:{id:current.sent.id,type:'result',result:previous.result}});
    assert.equal($('exampleContinuation').hidden,false);assert.equal($('exampleContinuation').getAttribute('aria-busy'),'false');
  });
  await t.test('importing even identical Markdown is a custom source and does not inherit a curated next step',async()=>{
    await loadCurated(EXAMPLES[0].file);await finishCurated();const old=continuationButton();
    app.loadSource(await readCurated(EXAMPLES[0].file));await finishCurated();
    assert.equal($('exampleContinuation').hidden,true);const requests=fetches.length;await old.click();assert.equal(fetches.length,requests);
  });
  await t.test('a failed continuation can be retried and an edit during its fetch wins over the late response',async()=>{
    const source=await loadCurated(EXAMPLES[0].file);await finishCurated();
    const pending=continuationButton().click(),resolve=fetches.shift();resolve({ok:false,status:503});await pending;
    assert.equal($('theoryEditor').value,source);assert.equal($('exampleSelect').value,EXAMPLES[0].file);
    assert.equal($('exampleContinuation').hidden,false);assert.match($('notice').textContent,/503/);
    const retry=continuationButton().click(),late=fetches.shift();assert(late,'the source can be retried');
    $('theoryEditor').value=source+'\nAn edit during loading.\n';await $('theoryEditor').fire('input');
    late({ok:true,text:async()=>readCurated(EXAMPLES[1].file)});await retry;
    assert.equal($('theoryEditor').value,source+'\nAn edit during loading.\n');
    assert.equal($('exampleContinuation').hidden,true);assert.equal(app.state.sourceCurrent,false);
  });
  await t.test('continuation ignores repeated clicks and never replaces settings or unapplied JSON edited while loading',async()=>{
    await loadCurated(EXAMPLES[0].file);await finishCurated();
    const button=continuationButton(),firstClick=button.click(),again=button.click();
    assert.equal(fetches.length,1,'a repeated click does not request or skip another example');
    fetches.shift()({ok:true,text:async()=>readCurated(EXAMPLES[1].file)});await Promise.all([firstClick,again]);
    assert.equal($('exampleSelect').value,EXAMPLES[1].file);
    for(const field of ['timeBudget','modelEditor']) {
      const source=await loadCurated(EXAMPLES[0].file);await finishCurated();
      const pending=continuationButton().click(),late=fetches.shift();
      const value=field==='timeBudget'?'13':JSON.stringify({...app.state.doc.model,name:'An unapplied edit during loading'});
      $(field).value=value;await $(field).fire('input');
      late({ok:true,text:async()=>readCurated(EXAMPLES[1].file)});await pending;
      assert.equal($('exampleSelect').value,EXAMPLES[0].file);
      assert.equal($('theoryEditor').value,source);assert.equal($(field).value,value);
      assert.equal($('exampleContinuation').hidden,true);
      if(field==='modelEditor')assert.equal(app.state.modelDirty,true);
    }
  });
  await t.test('a new formula query survives a late continuation response without losing its source or worker',async()=>{
    const source=await loadCurated(EXAMPLES[0].file);await finishCurated();
    const pending=continuationButton().click(),late=fetches.shift();assert(late);
    await $('checkFormula').click();const query=workers.at(-1);
    assert.equal(query.sent.action,'formula');assert.equal(app.state.worker,query);
    assert.equal(app.state.job.action,'formula');assert.notEqual(query.terminated,true);
    late({ok:true,text:async()=>readCurated(EXAMPLES[1].file)});await pending;
    assert.equal($('theoryEditor').value,source);assert.equal($('exampleSelect').value,EXAMPLES[0].file);
    assert.equal(app.state.worker,query);assert.equal(app.state.job.id,query.sent.id);
    assert.notEqual(query.terminated,true,'a late source load cannot stop the newer query worker');
    finish(query);assert($('formulaResult').textContent.includes('Formula holds'));
    assert.equal($('exampleContinuation').getAttribute('aria-busy'),'false','the ignored load does not leave navigation stuck');
    assert.equal(continuationButton().disabled,false,'navigation is usable again after the query');
    const retry=continuationButton().click();fetches.shift()({ok:true,text:async()=>readCurated(EXAMPLES[1].file)});await retry;
    assert.equal($('exampleSelect').value,EXAMPLES[1].file);
    assert.equal($('formulaResult').textContent,'');
  });
  await t.test('a source edit wins over an older pending example request',async()=>{
    const pending=app.loadExample('echo-ne.md'),resolve=fetches.shift();$('theoryEditor').value=first+'\nNewer edit.\n';await $('theoryEditor').fire('input');
    resolve({ok:true,text:async()=>first});await pending;assert($('theoryEditor').value.includes('Newer edit.'));assert.equal(app.state.sourceCurrent,false);
  });
  await t.test('an import wins over an older pending example request',async()=>{
    const pending=app.loadExample('echo-ne.md'),resolve=fetches.shift();app.loadSource(first.replace('First steps — why uniqueness needs an assumption','Imported custom draft'));
    resolve({ok:true,text:async()=>first});await pending;assert($('theoryEditor').value.includes('Imported custom draft'));assert.equal(app.state.custom,true);
  });
});

// Unsupported browsers retain one ordinary, readable section with a real hash link.
test('About remains readable when native dialog support is unavailable',async()=>{
  const {ids,document,html}=await fixture({nativeDialog:false});
  const link=ids.get('aboutLink'),dialog=ids.get('aboutDialog'),section=ids.get('aboutDetails');
  assert.equal(link.getAttribute('href'),'#aboutDetails');assert.equal(link.getAttribute('aria-haspopup'),undefined);
  assert.equal(section.hidden,false);assert.equal(section.parentNode,document.body);
  assert.equal(dialog.hidden,true);assert.equal(ids.get('closeAbout').hidden,true);
  assert.equal(link.listeners.click,undefined,'normal anchor navigation remains available');
  assert.match(html,/<section id="aboutDetails"[^>]*>[\s\S]*?vibe-coded following prompts/);
});

test('saved implicit theories require explicit current-draft review before a new run',async t=>{
  const {app,ids,workers,first,storage,pageEvents}=await fixture(),$=id=>ids.get(id);
  t.after(()=>pageEvents.get('pagehide')?.());
  const doc=parseDocument(first);doc.includeLive=true;doc.model.signature.predicates.push('live');
  const source=serializeDocument(doc),key='history-structure-model-checker/custom-draft/v0.3';
  const importProject=async data=>{
    const text=JSON.stringify(data);
    $('importFile').files=[{name:'saved-project.json',size:Buffer.byteLength(text),text:async()=>text}];
    await $('importFile').fire('change');
  };
  await $('runForm').fire('submit');const worker=workers.at(-1),request=worker.sent;
  const result=await runExperiment(request.sourceMarkdown,request.options);
  worker.onmessage({data:{id:request.id,type:'result',result}});
  assert.match($('results').textContent,/Counterexample found/);
  const legacy={format:'history-structure-project/v2',sourceMarkdown:source,options:{mode:'synthesize'}};
  for(const profile of [undefined,'hbb-disc/2026-11-07']){
    await importProject({...legacy,semantics:profile});
    assert.equal($('theoryEditor').value,source);assert.equal(app.state.sourceCurrent,false);
    assert.equal(app.state.semanticsReview,true);assert.equal($('runButton').disabled,true);
    assert.equal(app.state.run,null);assert.equal($('staleResults').hidden,true);
    assert.doesNotMatch($('results').textContent,/Counterexample found/);
    assert.match($('notice').textContent,/18 November 2026/);
    assert.match($('notice').textContent,/Update choices/);
    assert.equal($('sourceDetails').hidden,false);
    assert.equal(app.project().semantics,undefined,'saving unreviewed source cannot mark it as current');
    assert.equal(app.project().format,'history-structure-project/v3');
    pageEvents.get('pagehide')();assert.equal(JSON.parse(storage.get(key)).semantics,undefined);
    assert.equal(JSON.parse(storage.get(key)).format,'history-structure-project/v3');
    await $('restoreDraft').click();assert.equal(app.state.sourceCurrent,false);
    await $('updateChoices').click();assert.equal(app.state.sourceCurrent,true);
    assert.equal(app.state.semanticsReview,false);assert.equal($('runButton').disabled,false);
    assert.equal(app.project().semantics,SEMANTICS_PROFILE);
    pageEvents.get('pagehide')();assert.equal(JSON.parse(storage.get(key)).semantics,SEMANTICS_PROFILE);
  }
  await importProject({...legacy,semantics:SEMANTICS_PROFILE});
  assert.equal(app.state.sourceCurrent,true);assert.equal(app.state.semanticsReview,false);
  const current=app.project();assert.equal(current.format,'history-structure-project/v3');
  await importProject(current);assert.equal(app.state.sourceCurrent,true,'profiled current projects reload directly');
  await importProject({...current,semantics:undefined});
  assert.equal(app.state.sourceCurrent,false,'unreviewed v3 imports retain the review requirement');
  await $('updateChoices').click();
  await importProject({...legacy,options:{mode:'synthesize',droppedAxioms:['ThyLive']}});
  assert.equal(app.state.sourceCurrent,true,'explicitly dropped ThyLive leaves a literal core theory');
  assert.deepEqual($('axiomOptions').querySelectorAll('input:not(:checked)').map(row=>row.value),['ThyLive']);
  assert.equal(app.state.semanticsReview,false);
});

test('an implicit-theory certificate from another draft stays inspectable but cannot start replay',async t=>{
  const {app,ids,workers,first,pageEvents}=await fixture(),$=id=>ids.get(id);
  t.after(()=>pageEvents.get('pagehide')?.());
  const doc=parseDocument(first);doc.includeLive=true;doc.model.signature.predicates.push('live');
  const source=serializeDocument(doc),result=await runExperiment(source,{mode:'synthesize'});
  assert.equal(result.status,'counterexample');
  const evidence=structuredClone(result.properties.find(row=>row.status==='counterexample').evidence);
  evidence.semantics='hbb-disc/2026-11-07';
  const text=JSON.stringify(evidence),count=workers.length;
  $('importFile').files=[{name:'saved-evidence.json',size:Buffer.byteLength(text),text:async()=>text}];
  await $('importFile').fire('change');
  assert.equal(app.state.importedEvidence.semantics,'hbb-disc/2026-11-07');
  assert.equal(app.state.sourceCurrent,false);assert.equal($('runButton').disabled,true);
  assert.match($('results').textContent,/cannot replay/);
  assert.match($('results').textContent,/new run/);
  assert.doesNotMatch($('results').textContent,/replay verified/i);
  const replay=$('results').querySelectorAll('button').find(row=>row.textContent==='Replay imported evidence');
  assert(replay);assert.equal(replay.disabled,true);await replay.click();
  assert.equal(workers.length,count,'even a detached/programmatic click cannot start incompatible replay');
  assert(app.state.inspectedData,'the recorded model remains inspectable');
});

test('current draft storage is isolated while legacy source remains recoverable with explicit review',async t=>{
  const oldKey='history-structure-model-checker/custom-draft/v0.2',newKey='history-structure-model-checker/custom-draft/v0.3';
  const first=await readFile(new URL('../examples/theories/first-steps.md',import.meta.url),'utf8');
  const doc=parseDocument(first);doc.includeLive=true;doc.model.signature.predicates.push('live');
  const legacy={format:'history-structure-project/v2',sourceMarkdown:serializeDocument(doc),options:{mode:'synthesize'}};
  const oldBytes=JSON.stringify(legacy),{app,ids,storage,pageEvents}=await fixture({storageEntries:[[oldKey,oldBytes]]}),$=id=>ids.get(id);
  t.after(()=>pageEvents.get('pagehide')?.());
  assert.equal($('restoreDraft').hidden,false,'a legacy draft is offered for safe recovery');
  app.loadSource(first+'\nA new current draft.\n');pageEvents.get('pagehide')();
  assert.equal(storage.get(oldKey),oldBytes,'new saves never overwrite the slot read by earlier applications');
  const current=JSON.parse(storage.get(newKey));assert.equal(current.format,'history-structure-project/v3');
  assert.equal(current.semantics,SEMANTICS_PROFILE);
  storage.delete(newKey);await $('restoreDraft').click();
  assert.equal($('theoryEditor').value,legacy.sourceMarkdown);assert.equal(app.state.sourceCurrent,false);
  assert.equal(app.state.semanticsReview,true);assert.equal($('runButton').disabled,true);
  pageEvents.get('pagehide')();assert.equal(storage.get(oldKey),oldBytes);
  const staged=JSON.parse(storage.get(newKey));assert.equal(staged.format,'history-structure-project/v3');
  assert.equal(staged.semantics,undefined,'recovering an old draft does not imply its acceptance');
  await $('updateChoices').click();pageEvents.get('pagehide')();
  assert.equal(JSON.parse(storage.get(newKey)).semantics,SEMANTICS_PROFILE);
  assert.equal(storage.get(oldKey),oldBytes,'explicit review also preserves the original recovery source');
  await $('forgetDraft').click();assert.equal(storage.has(newKey),false);assert.equal(storage.has(oldKey),false);
  assert.equal($('theoryEditor').value,legacy.sourceMarkdown,'forgetting saved drafts leaves the open source intact');
});

function delayedFileImport(ids,name='delayed.md'){
  let resolve,reject;
  const text=new Promise((accept,fail)=>{resolve=accept;reject=fail;});
  const file={name,size:10,text:()=>text},input=ids.get('importFile');
  input.files=[file];input.value=name;
  const pending=input.fire('change');
  return {resolve,reject,pending,input};
}

test('delayed file imports cannot overwrite later edits, settings, loads or checks',async()=>{
  for(const action of ['source','setting','model','example','experiment','formula']){
    const {app,ids,first,workers,fetches,pageEvents}=await fixture(),$=id=>ids.get(id);
    try {
      const old=delayedFileImport(ids);
      let finishExample;
      if(action==='source'){$('theoryEditor').value=first+'\nNewer source edit.\n';await $('theoryEditor').fire('input');}
      if(action==='setting'){$('timeBudget').value='17';await $('timeBudget').fire('input');}
      if(action==='model'){$('modelEditor').value='{"unfinished":"newer model edit"}';await $('modelEditor').fire('input');}
      if(action==='example'){
        finishExample=app.loadExample('echo-ne.md');
        assert(fetches.length,'the newer example request is pending');
      }
      if(action==='experiment')await $('runForm').fire('submit');
      if(action==='formula')await $('checkFormula').click();
      const snapshot={source:$('theoryEditor').value,project:JSON.stringify(app.project()),run:app.state.run,job:app.state.job,worker:app.state.worker,revision:app.state.revision,model:$('modelEditor').value,notice:$('notice').textContent};
      old.resolve(first+'\nObsolete imported source.\n');await old.pending;
      assert.equal($('theoryEditor').value,snapshot.source,action);
      assert.equal(JSON.stringify(app.project()),snapshot.project,action);
      assert.equal(app.state.revision,snapshot.revision,action);
      assert.equal(app.state.run,snapshot.run,action);
      assert.equal(app.state.job,snapshot.job,action);
      assert.equal(app.state.worker,snapshot.worker,action);
      assert.equal($('modelEditor').value,snapshot.model,action);
      assert.equal($('notice').textContent,snapshot.notice,action);
      if(snapshot.worker)assert.notEqual(snapshot.worker.terminated,true,action+': the newer worker stays alive');
      if(finishExample){fetches.shift()({ok:true,text:async()=>readFile(new URL('../examples/theories/echo-ne.md',import.meta.url),'utf8')});await finishExample;assert.equal(app.state.example,'echo-ne.md');}
      if(action==='experiment'||action==='formula')assert(workers.length>0);
    } finally {
      if(app.state.job)await $('stopButton').click();
      pageEvents.get('pagehide')?.();
    }
  }
});

test('the latest file selection wins and obsolete read errors cannot change its result or input',async t=>{
  const {app,ids,first,pageEvents}=await fixture(),$=id=>ids.get(id);
  t.after(()=>pageEvents.get('pagehide')?.());
  const older=delayedFileImport(ids,'older.md'),newer=delayedFileImport(ids,'newer.md');
  const expected=first+'\nThe newer selected file.\n';
  newer.resolve(expected);await newer.pending;
  assert.equal($('theoryEditor').value,expected);assert.equal(newer.input.value,'','the completed current selection can be chosen again');
  const notice=$('notice').textContent,revision=app.state.revision;
  newer.input.value='a later input state';
  older.resolve(first+'\nAn older file finishing last.\n');await older.pending;
  assert.equal($('theoryEditor').value,expected);assert.equal(app.state.revision,revision);
  assert.equal($('notice').textContent,notice);assert.equal(newer.input.value,'a later input state');
  const failing=delayedFileImport(ids,'unreadable.md');
  $('theoryEditor').value=expected+'\nA newer manual edit.\n';await $('theoryEditor').fire('input');
  const edited=$('theoryEditor').value,currentNotice=$('notice').textContent;
  failing.reject(new Error('Obsolete file read failure'));await failing.pending;
  assert.equal($('theoryEditor').value,edited);assert.equal($('notice').textContent,currentNotice);
});

test('invalid structured imports leave the current valid source, result, inspection and recoverable draft intact',async t=>{
  const {app,ids,first,workers,storage,pageEvents}=await fixture(),$=id=>ids.get(id);
  t.after(()=>pageEvents.get('pagehide')?.());
  app.loadSource(first);await $('runForm').fire('submit');
  const worker=workers.at(-1),request=worker.sent,result=await runExperiment(request.sourceMarkdown,request.options);
  worker.onmessage({data:{id:request.id,type:'result',result}});
  pageEvents.get('pagehide')?.();
  assert.equal(result.status,'counterexample');
  const before={source:$('theoryEditor').value,project:JSON.stringify(app.project()),doc:app.state.doc,run:app.state.run,inspected:app.state.inspected,revision:app.state.revision,results:$('results').textContent,storage:[...storage]};
  const invalid=[
    ['syntax.json','{'],['wrong-shape.json','null'],
    ['unknown.json',JSON.stringify({format:'unknown-format'})],
    ['bad-options.json',JSON.stringify({format:'history-structure-project/v3',sourceMarkdown:first,options:[]})],
    ['bad-selection.json',JSON.stringify({format:'history-structure-project/v3',sourceMarkdown:first,options:{selectedProperties:['Unknown']}})],
    ...[
      {mode:'unknown-mode'},{maxMilliseconds:'25000'},{maxMilliseconds:0},{pinFacts:'false'},
      {maxAdditionalNodes:9},{maxAdditionalNodes:0.5},{maxModels:0},{maxModels:100001},
      {maxSteps:0},{maxKnowledgeFamilies:100000001},{maxCompilationNodes:-1},{maxDecisions:-1},
      {palette:'not-an-array'},{palette:[]},{palette:['undeclared-event']},
    ].map(options=>['bad-setting.json',JSON.stringify({format:'history-structure-project/v3',sourceMarkdown:first+'\nDo not replace the workspace.\n',options})]),
    ['bad-model-draft.json',JSON.stringify({format:'history-structure-project/v3',sourceMarkdown:first,unappliedModelSource:{lost:'draft'}})],
    ['bad-model.json',JSON.stringify({format:'history-structure-model/v1',participants:[]})],
    ['bad-evidence.json',JSON.stringify({format:'history-structure-evidence/v1',sourceMarkdown:first,model:{invalid:true}})],
  ];
  for(const [name,text] of invalid){
    $('importFile').files=[{name,size:text.length,text:async()=>text}];await $('importFile').fire('change');
    assert.equal($('theoryEditor').value,before.source,name);assert.equal(JSON.stringify(app.project()),before.project,name);
    assert.equal(app.state.doc,before.doc,name);assert.equal(app.state.run,before.run,name);assert.equal(app.state.inspected,before.inspected,name);
    assert.equal(app.state.revision,before.revision,name);assert.equal($('results').textContent,before.results,name);
    pageEvents.get('pagehide')?.();assert.deepEqual([...storage],before.storage,name);
    assert.equal($('importFile').value,'',name);assert.match($('notice').className,/error/,name);
  }
});

test('valid imported settings retain the requested scope, including false and zero values',async t=>{
  const {app,ids,first,pageEvents}=await fixture(),$=id=>ids.get(id);
  t.after(()=>pageEvents.get('pagehide')?.());
  const options={mode:'search',pinFacts:false,maxMilliseconds:125.5,maxAdditionalNodes:0,maxModels:11,maxKnowledgeFamilies:5,maxCompilationNodes:1234,maxDecisions:0,maxSteps:6789,palette:[null],selectedProperties:[]};
  const data={format:'history-structure-project/v3',semantics:SEMANTICS_PROFILE,sourceMarkdown:first,options},text=JSON.stringify(data);
  $('importFile').files=[{name:'scope.json',size:text.length,text:async()=>text}];await $('importFile').fire('change');
  assert.equal(app.state.sourceCurrent,true);
  const restored=app.project().options;
  for(const [name,value] of Object.entries(options))assert.deepEqual(restored[name],value,name);
});

test('invalid saved-draft settings are rejected before disturbing the current source or worker',async t=>{
  const {app,ids,first,storage,pageEvents}=await fixture(),$=id=>ids.get(id);
  t.after(()=>pageEvents.get('pagehide')?.());
  await $('runForm').fire('submit');const worker=app.state.worker,job=app.state.job,revision=app.state.revision;
  const key='history-structure-model-checker/custom-draft/v0.3',bytes=JSON.stringify({format:'history-structure-project/v3',semantics:SEMANTICS_PROFILE,sourceMarkdown:first+'\nAn invalid saved scope.\n',options:{mode:'unknown-mode'}});
  storage.set(key,bytes);await $('restoreDraft').click();
  assert.equal($('theoryEditor').value,first);assert.equal(app.state.revision,revision);
  assert.equal(app.state.worker,worker);assert.equal(app.state.job,job);assert.notEqual(worker.terminated,true);
  assert.equal(storage.get(key),bytes);assert.match($('notice').textContent,/mode must be/);
  await $('stopButton').click();
});

test('unfinished raw Markdown imports remain editable with no runnable verdict and preserve the prior recovery draft',async t=>{
  const {app,ids,first,storage,pageEvents}=await fixture(),$=id=>ids.get(id);
  t.after(()=>pageEvents.get('pagehide')?.());
  app.loadSource(first);pageEvents.get('pagehide')?.();
  const key='history-structure-model-checker/custom-draft/v0.3',prior=storage.get(key);
  const text=first+'\n```hsm\naxiom Broken [other]: ∀\n```\n';
  $('importFile').files=[{name:'unfinished.md',size:text.length,text:async()=>text}];await $('importFile').fire('change');
  assert.equal($('theoryEditor').value,text);assert.equal(app.state.sourceCurrent,false);
  assert.equal($('runButton').disabled,true);assert.equal($('sourceDetails').hidden,false);
  assert.equal($('claimsControls').hidden,true);assert.match($('notice').textContent,/editable draft/);
  pageEvents.get('pagehide')?.();assert.equal(storage.get(key),prior,'an invalid import does not overwrite the previous recoverable custom source');
});

test('inactive search fields are disabled so their native constraints cannot block another mode',async t=>{
  const {app,ids,pageEvents}=await fixture(),$=id=>ids.get(id);
  t.after(()=>pageEvents.get('pagehide')?.());
  const choose=async value=>{const radio=document.querySelector('input[name="mode"][value="'+value+'"]');radio.checked=true;await radio.fire('change');};
  for(const id of ['maxAdditionalNodes','maxModels','eventPalette'])assert.equal($(id).disabled,true,id);
  await choose('search');
  for(const id of ['maxAdditionalNodes','maxModels','eventPalette'])assert.equal($(id).disabled,false,id);
  $('maxAdditionalNodes').value='9';await $('maxAdditionalNodes').fire('input');
  $('maxModels').value='0';await $('maxModels').fire('input');
  for(const value of ['synthesize','evaluate']){
    await choose(value);
    for(const id of ['maxAdditionalNodes','maxModels','eventPalette'])assert.equal($(id).disabled,true,value+': '+id);
    assert.equal(app.project().options.mode,value);
    assert.equal(app.project().options.maxAdditionalNodes,0);
    assert.equal(app.project().options.maxModels,1000);
  }
  await choose('search');assert.equal($('maxAdditionalNodes').value,'9');assert.equal($('maxModels').value,'0');
});

test('an empty zero-allowed limit is an invalid field rather than an implicit zero scope',async t=>{
  const {app,ids,workers,pageEvents}=await fixture(),$=id=>ids.get(id);
  t.after(()=>pageEvents.get('pagehide')?.());
  const search=document.querySelector('input[name="mode"][value="search"]');search.checked=true;await search.fire('change');
  for(const id of ['maxAdditionalNodes','decisionBudget']){
    const old=$(id).value,count=workers.length;
    $(id).value='';await $(id).fire('input');await $('runForm').fire('submit');
    assert.equal(workers.length,count,id);assert.equal(app.state.job,null,id);
    assert.match($('notice').textContent,/must be nonnegative and integral/,id);
    $(id).value=old;await $(id).fire('input');
  }
  $('maxAdditionalNodes').value='0';$('decisionBudget').value='0';
  assert.equal(app.project().options.maxAdditionalNodes,0);assert.equal(app.project().options.maxDecisions,0);
});

test('unfinished local drafts recover their exact text, settings and model edits without a verdict or implicit semantic review',async()=>{
  const key='history-structure-model-checker/custom-draft/v0.3';
  for(const profile of [undefined,'hbb-disc/2026-11-07',SEMANTICS_PROFILE]){
    let f=await fixture(),$=id=>f.ids.get(id);
    try {
      const doc=parseDocument(f.first);doc.includeLive=true;doc.model.signature.predicates.push('live');
      const repaired=serializeDocument(doc),unfinished=repaired+'\n```hsm\nproperty Unfinished [end]: ∀\n```\n';
      const modelText='{"name":"my unfinished model",\n  "nodes": [\n';
      const options={mode:'search',pinFacts:false,maxMilliseconds:125.5,maxAdditionalNodes:0,maxModels:17,maxKnowledgeFamilies:9,maxCompilationNodes:1234,maxDecisions:0,maxSteps:7654,palette:[null],selectedProperties:['UniqueChoice'],droppedAxioms:['SomeChoice']};
      const saved={format:'history-structure-project/v3',semantics:profile,sourceMarkdown:unfinished,unappliedModelSource:modelText,options};
      await $('runForm').fire('submit');assert(f.app.state.worker);
      f.storage.set(key,JSON.stringify(saved));await $('restoreDraft').click();
      assert.equal(f.app.state.job,null);assert.equal(f.app.state.worker,null);
      assert.equal(f.app.state.run,null);assert.equal(f.app.state.doc,null);assert.equal(f.app.state.inspected,null);
      assert.equal($('theoryEditor').value,unfinished);assert.equal($('modelEditor').value,modelText);
      assert.equal(f.app.state.sourceCurrent,false);assert.equal(f.app.state.modelDirty,true);assert.equal(f.app.state.semanticsReview,true);
      assert.equal($('runButton').disabled,true);assert.equal($('claimsControls').hidden,true);assert.equal($('sourceDetails').hidden,false);
      assert.doesNotMatch($('results').textContent,/Counterexample found|Holds within/);
      assert.equal($('dagContainer').textContent,'');assert.equal($('loadedTheory').textContent,'Unfinished custom draft');assert.equal($('propertyOptions').querySelectorAll('input').length,0);assert.match($('notice').textContent,/Unfinished custom draft restored/);
      assert.deepEqual(f.app.project().options,options);assert.equal(f.app.project().unappliedModelSource,modelText);
      assert.equal(f.app.project().semantics,undefined,'restoration is not acknowledgement of a semantic profile');
      f.pageEvents.get('pagehide')?.();
      const bytes=f.storage.get(key),snapshot=JSON.parse(bytes);
      assert.equal(snapshot.sourceMarkdown,unfinished);assert.equal(snapshot.unappliedModelSource,modelText);assert.deepEqual(snapshot.options,options);assert.equal(snapshot.semantics,undefined);
      f=await fixture({storageEntries:[[key,bytes]]});$=id=>f.ids.get(id);
      await $('restoreDraft').click();
      assert.equal($('theoryEditor').value,unfinished);assert.equal($('modelEditor').value,modelText);assert.deepEqual(f.app.project().options,options);
      assert.equal(f.app.project().semantics,undefined);assert.equal(f.app.state.sourceCurrent,false);
      $('theoryEditor').value=repaired;await $('theoryEditor').fire('input');
      const workerCount=f.workers.length;await $('runForm').fire('submit');
      assert.equal(f.workers.length,workerCount,'repairing text alone cannot run the saved old or unspecified theory');
      assert.equal(f.app.project().semantics,undefined);
      await $('updateChoices').click();
      assert.equal(f.app.state.sourceCurrent,true);assert.equal(f.app.state.semanticsReview,false);assert.equal(f.app.state.pendingDraftRestore,null);
      assert.equal($('modelEditor').value,modelText,'updating repaired Markdown retains separate unfinished model JSON');
      assert.equal(f.app.state.modelDirty,true);assert.equal($('runButton').disabled,true);
      const recovered=f.app.project();
      for(const [name,value] of Object.entries(options))assert.deepEqual(recovered.options[name],value,name);
      assert.equal(recovered.semantics,SEMANTICS_PROFILE);assert.equal(recovered.unappliedModelSource,modelText);
      await $('discardModelChanges').click();
      assert.equal(f.app.state.modelDirty,false);assert.equal($('runButton').disabled,false);
      f.pageEvents.get('pagehide')?.();assert.equal(JSON.parse(f.storage.get(key)).semantics,SEMANTICS_PROFILE);
    } finally {
      if(f.app.state.job)await $('stopButton').click();
      f.pageEvents.get('pagehide')?.();
    }
  }
});

test('editing the settings of an unfinished restored draft retains its saved selections and invalid setting rejection stays transactional',async t=>{
  const {app,ids,first,storage,pageEvents}=await fixture(),$=id=>ids.get(id);
  t.after(()=>pageEvents.get('pagehide')?.());
  const key='history-structure-model-checker/custom-draft/v0.3',unfinished=first+'\n```hsm\nproperty Broken [end]: ∀\n```\n';
  const prior={source:$('theoryEditor').value,revision:app.state.revision,project:JSON.stringify(app.project())};
  storage.set(key,JSON.stringify({sourceMarkdown:unfinished,options:{maxDecisions:'0'}}));
  await $('restoreDraft').click();
  assert.equal($('theoryEditor').value,prior.source);assert.equal(app.state.revision,prior.revision);assert.equal(JSON.stringify(app.project()),prior.project);
  assert.match($('notice').textContent,/maxDecisions must be an integer/);
  const options={mode:'synthesize',selectedProperties:[],droppedAxioms:['SomeChoice'],maxMilliseconds:2000,maxDecisions:0};
  storage.set(key,JSON.stringify({sourceMarkdown:unfinished,options}));await $('restoreDraft').click();
  assert.deepEqual(app.project().options,options);
  $('timeBudget').value='13';await $('timeBudget').fire('input');
  assert.deepEqual(app.project().options,{...options,maxMilliseconds:13000});
  pageEvents.get('pagehide')?.();assert.deepEqual(JSON.parse(storage.get(key)).options,{...options,maxMilliseconds:13000});
  $('theoryEditor').value=first;await $('theoryEditor').fire('input');await $('updateChoices').click();
  assert.equal(app.state.sourceCurrent,true);assert.deepEqual(app.project().options.selectedProperties,[]);assert.deepEqual(app.project().options.droppedAxioms,['SomeChoice']);
  assert.equal(app.project().options.maxMilliseconds,13000);assert.equal(app.project().options.maxDecisions,0);
});

test('repairing a local draft may remove or rename claims without trapping its saved selections',async t=>{
  const {app,ids,first,storage,pageEvents}=await fixture(),$=id=>ids.get(id);
  t.after(()=>pageEvents.get('pagehide')?.());
  const key='history-structure-model-checker/custom-draft/v0.3';
  storage.set(key,JSON.stringify({sourceMarkdown:first+'\n```hsm\nproperty Broken [end]: ∀\n```\n',options:{selectedProperties:['UniqueChoice'],droppedAxioms:['SomeChoice'],maxMilliseconds:3000}}));
  await $('restoreDraft').click();
  const doc=parseDocument(first);doc.properties[0].name='Renamed choice';doc.axioms=[];
  $('theoryEditor').value=serializeDocument(doc);await $('theoryEditor').fire('input');
  await $('updateChoices').click();
  assert.equal(app.state.sourceCurrent,true);assert.equal(app.state.pendingDraftRestore,null);
  assert.equal($('claimsControls').hidden,false);assert.deepEqual(app.project().options.selectedProperties,[]);assert.deepEqual(app.project().options.droppedAxioms,[]);
  assert.equal(app.project().options.maxMilliseconds,3000);
  assert.match($('notice').textContent,/UniqueChoice/);assert.match($('notice').textContent,/SomeChoice/);assert.match($('notice').textContent,/Review the current claims/);
  const property=$('propertyOptions').querySelectorAll('input')[0];property.checked=true;await property.fire('change');
  assert.deepEqual(app.project().options.selectedProperties,['Renamed choice']);assert.equal($('runButton').disabled,false);
});
