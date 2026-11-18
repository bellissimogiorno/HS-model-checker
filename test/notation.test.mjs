import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {parseFormula} from '../src/parser.mjs';
import {createHash} from 'node:crypto';
import {parseDocument} from '../src/document.mjs';
import {unicodeFormula,asciiFormula,unicodeTheorySource,asciiTheorySource} from '../src/notation.mjs';

const sameFormula=(a,b)=>assert.deepEqual(parseFormula(a),parseFormula(b));

test('Unicode and ASCII conversion preserve operators, comments, literals and reserved term names',()=>{
  const inputs=[
    'forall l,v. (live & box[l] past echo(v)) -> exists w. sometime vote(l,w)',
    'exists01 v. (true or false) <-> not (everytime live and allpast seq)',
    'forall true,past,box,and. true=past -> echo(box,and) and dia[true,past] true',
    'forall ?v. (?v != "forall") and "past"("and") // forall and past remain comments\n',
    'forall v. echo("line\\nforall & past \\"",v) # ∀ remains a comment\n',
    '∃⁰¹v.♢[v]↓echo(v)⇒↕echo(v)',
    '∃! v. □[v](⊤ ∧ ¬⊥)',
    '∃=1v.♢[v]↓echo(v)⇒↕echo(v)',
    '∃⩽1 v. p(v) or ∃≤1 w. q(w)',
    'forall seq. seq=seq',
    'forall v. (v = forall) and not live',
    'forall v. (v = exists) and exists w. echo(w)',
  ];
  for(const source of inputs) {
    const unicode=unicodeFormula(source),ascii=asciiFormula(unicode);
    sameFormula(source,unicode);sameFormula(source,ascii);
    assert.equal(unicodeFormula(unicode),unicode);
    assert.equal(asciiFormula(ascii),ascii);
  }
  assert.equal(unicodeFormula('forall v. echo("past",v) # forall remains'), '∀ v. echo("past",v) # forall remains');
  assert.equal(asciiFormula('∀v.↓echo(v)'), 'forall v.past echo(v)');
  assert.equal(unicodeFormula('exists1 v. p(v)'), '∃=1 v. p(v)');
  assert.equal(unicodeFormula('exists01 v. p(v)'), '∃⩽1 v. p(v)');
  assert.equal(unicodeFormula('∃¹ v. p(v)'), '∃=1 v. p(v)');
  assert.equal(unicodeFormula('∃⁰¹ v. p(v)'), '∃⩽1 v. p(v)');
  assert.equal(unicodeFormula('∃≤1 v. p(v)'), '∃⩽1 v. p(v)');
  assert.equal(asciiFormula('∃=1v.p(v)'), 'exists1 v.p(v)');
  assert.equal(asciiFormula('∃⩽1v.p(v)'), 'exists01 v.p(v)');
  assert.equal(unicodeFormula('forall true. true=true'), '∀ true. true=true');
  assert.equal(unicodeFormula('forall v. (v = forall) and not live'), '∀ v. (v = forall) ∧ ¬ live');
});

test('document conversion changes only executable formula spans, including CRLF and quoted names',()=>{
  const source='# An ASCII draft\r\n\r\nProse: forall v. remains prose.\r\n\r\n```hsm-model\r\n'+JSON.stringify({format:'history-structure-model/v1',participants:['p'],values:['forall'],signature:{events:['echo'],predicates:['live']},nodes:[],quorums:{forall:[['p']]},facts:[]})+'\r\n```\r\n\r\n```hsm\r\n# forall is a comment\r\naxiom "past: keep this name!" [forward]: forall v.\r\n  live -> sometime echo(v)\r\n\r\nproperty test [end]: exists1 v. echo(v)\r\n```\r\n';
  const unicode=unicodeTheorySource(source),ascii=asciiTheorySource(unicode);
  assert.match(unicode,/axiom "past: keep this name!" \[forward\]: ∀ v\.\r\n  live ⇒ ↕ echo\(v\)/);
  assert.match(unicode,/property test \[end\]: ∃=1 v\. echo\(v\)/);
  assert.ok(unicode.includes('Prose: forall v. remains prose.\r\n'));
  assert.ok(unicode.includes('# forall is a comment\r\n'));
  assert.deepEqual(parseDocument(unicode).model,parseDocument(source).model);
  assert.deepEqual(parseDocument(ascii).axioms.map(r=>r.ast),parseDocument(source).axioms.map(r=>r.ast));
  assert.equal(unicode.replace(/\r\n/g,'').includes('\n'),false);
});

test('all shipped Unicode theories round-trip through ASCII without changing their models or logic',async()=>{
  const directory=new URL('../examples/theories/',import.meta.url);
  for(const file of await readdir(directory))if(file.endsWith('.md')) {
    const source=await readFile(new URL(file,directory),'utf8');
    const doc=parseDocument(source),ascii=parseDocument(asciiTheorySource(source)),unicode=parseDocument(unicodeTheorySource(source));
    const semantic=doc=>({model:doc.model,includeLive:doc.includeLive,axioms:doc.axioms.map(({name,kind,ast})=>({name,kind,ast})),properties:doc.properties.map(({name,scope,ast})=>({name,scope,ast}))});
    assert.deepEqual(semantic(ascii),semantic(doc),file);
    assert.deepEqual(semantic(unicode),semantic(doc),file);
  }
});

test('invalid formulas and documents are rejected before conversion',()=>{
  assert.throws(()=>unicodeFormula('forall v echo(v)'),SyntaxError);
  assert.throws(()=>asciiTheorySource('# prose only'),SyntaxError);
});

test('every literate example uses the paper notation and places model JSON after executable rules',async()=>{
  const directory=new URL('../examples/theories/',import.meta.url);
  const names=(await readdir(directory)).filter(file=>file.endsWith('.md'));
  assert.ok(names.length>0);
  for(const file of names){
    const source=await readFile(new URL(file,directory),'utf8'),doc=parseDocument(source);
    assert.ok(source.indexOf('```hsm-model')>source.lastIndexOf('```hsm\n'),file+': model appendix follows every executable formula');
    for(const row of [...doc.axioms,...doc.properties])assert.equal(unicodeFormula(row.formula),row.formula,file+': '+row.name+' uses the preferred paper operators');
  }
});

test('theory mathematics agrees with the reviewed package fingerprint inventory',async()=>{
  const directory=new URL('../examples/theories/',import.meta.url);
  const record=JSON.parse(await readFile(new URL('../docs/THEORY-FINGERPRINTS.json',import.meta.url),'utf8'));
  const fingerprints=Array.isArray(record.files)
    ?new Map(record.files.map(row=>[row.file,row.semanticSha256]))
    :new Map(Object.entries(record.files));
  const names=(await readdir(directory)).filter(file=>file.endsWith('.md')).sort();
  assert.deepEqual([...fingerprints.keys()].sort(),names,'review inventory covers exactly the bundled theories');
  const semantic=doc=>({name:doc.name,model:doc.model,includeLive:doc.includeLive,axioms:doc.axioms.map(({name,kind,ast})=>({name,kind,ast})),properties:doc.properties.map(({name,scope,ast})=>({name,scope,ast}))});
  for(const file of names){
    const doc=parseDocument(await readFile(new URL(file,directory),'utf8'));
    assert.equal(createHash('sha256').update(JSON.stringify(semantic(doc))).digest('hex'),fingerprints.get(file),file);
  }
});
