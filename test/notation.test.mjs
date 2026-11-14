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
  assert.equal(unicodeFormula('forall true. true=true'), '∀ true. true=true');
  assert.equal(unicodeFormula('forall v. (v = forall) and not live'), '∀ v. (v = forall) ∧ ¬ live');
});

test('document conversion changes only executable formula spans, including CRLF and quoted names',()=>{
  const source='# An ASCII draft\r\n\r\nProse: forall v. remains prose.\r\n\r\n```hsm-model\r\n'+JSON.stringify({format:'history-structure-model/v1',participants:['p'],values:['forall'],signature:{events:['echo'],predicates:['live']},nodes:[],quorums:{forall:[['p']]},facts:[]})+'\r\n```\r\n\r\n```hsm\r\n# forall is a comment\r\naxiom "past: keep this name!" [forward]: forall v.\r\n  live -> sometime echo(v)\r\n\r\nproperty test [end]: exists1 v. echo(v)\r\n```\r\n';
  const unicode=unicodeTheorySource(source),ascii=asciiTheorySource(unicode);
  assert.match(unicode,/axiom "past: keep this name!" \[forward\]: ∀ v\.\r\n  live ⇒ ↕ echo\(v\)/);
  assert.match(unicode,/property test \[end\]: ∃¹ v\. echo\(v\)/);
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

const BASELINE_SEMANTIC_DIGESTS = {
  "deliver-progress.md": "f34a9b121b4e204fbd1c5e3dbecdd4fbee8fa57667d1641ac39248fc2de48aee",
  "echo-ne-live-only.md": "63cff03502473a19ad806522854118d2e2fa933db605203f8cffe33386f8c28c",
  "echo-ne.md": "21d7b04c89983b17a8709e5969f8a9c505af9ed90a031f674ff688b3e6b309a4",
  "echo-progress.md": "9f73686843f285edc9f63ee9a5ace36d1b520814707ec137ae17130d6c91a5b8",
  "first-steps.md": "8bb6a1b6df4d36df2192171cd845067ed1fa064af53429e32302fc6f9c0b4ba9",
  "hbb1-deliver-progress.md": "fb5113e3cb7e50da726699b2386a579eb92559abd7edab3ea18079dea07904e7",
  "hbb1-echo-choice-wrong.md": "06bde5eaa4ce04908765b54e749bfd07c7b391934f72e59302090928888bf8d1",
  "hbb1-echo-choice.md": "7eb1bf0c5c492dba144cf8053dd33808df6b7aace2957507135ab1f743c6e74f",
  "hbb1-echo-progress.md": "8a21cb4dcbb0d7de518bbf2b6010397c720e3b04a126019ee68b11a1370ea710",
  "hbb1-safe-removed.md": "1f9c9d0df05ea35e4845dcdce36185004be2c3201124e40c234a00b5e6706e6e",
  "hbb1-vote-progress.md": "89da71986893cac18b3f688bf5d55a252549192c36ce2d31e662248847475bf5",
  "hbb1-vote-safe-omitted.md": "df3943bd6b3161d3af378e429baaa455e1234c8dad17292d2447fb5994aac35e",
  "hbb1-vote-safe.md": "dc5863555f519c943a372229051dc9a89369e2ea453c456837119a6da2cc92ed",
  "hbb1.md": "9acd393fda257e7368ad5d542241734f63ed7c121b7ab9d3d1b2cd317bc682c3",
  "hbb2.md": "31ce04c2acce7ed4cb5fb005af62d809d6a3d2fa0c6d69e626ecee1118a4c1b9",
  "hbb3-corr-definition-wrong.md": "651ea46ab0f735f71c5addc71805a56cce7dc3e7afe1bf435690c07397caca09",
  "hbb3-corr-definition.md": "c3550fdf5641be299be79e4e1ebda558ccde9b35395e416d57f94051f52d8e61",
  "hbb3-corr-past.md": "4ab7a1d0ece7e5e708159d513b99e5e61e43ddf98a32782ce23fcbf2e8e5290f",
  "hbb3-corr-seq.md": "b86735bbf0777c53ab08dcb4926e9b717c84b9acb22ef45a7e79ee6553f649c7",
  "hbb3-deliver-progress.md": "148eb7d3d8e0245502d4b7074dbfff53a41bed1f39b8873d35f6f682456c767b",
  "hbb3-echo-progress.md": "f54022650745b081ce0a59bf03988281bec5522650e6b726cba62fcb156c5ea4",
  "hbb3-three-twined.md": "9c1253978bf4fcad5a9347936a955bd1edf82ba0b269af70ec6c781f5b195956",
  "hbb3-vote-ne.md": "6d5187a37d8af5be8bc1422488da740e289771a2f9909c1c6d1ef48fc3c61e56",
  "hbb3-vote-prime-progress.md": "0173b038ebbd9e228ec97f62bd5b7fafe4ae401773d9069938f2842550744bbe",
  "hbb3-vote-progress.md": "6acb46a9efb465fade971d389924ffcff61527d8d8554d2641b64aef44ce90e6",
  "hbb3.md": "1b3cc5735d880aa46bc3154231a6a0ad371f4aa938bfc9687d10806bccbfb216",
  "heterogeneous.md": "fb6424ca4fc1f06b61a532b699358914a86216a5326a3d1d238622db311835c1",
  "majority.md": "3fa991a24e93b0ae052f6c36226f004f0172c7539ac3c47f72b64b1f9c62bc2b",
  "vote-progress.md": "70ad697a38968daa8ab2f8dfb7e852af9a35e4abee68cdc2f828d93f630e99fb"
};

test('the 29 literate examples retain the v0.4 mathematical content exactly',async()=>{
  const directory=new URL('../examples/theories/',import.meta.url);
  const semantic=doc=>({name:doc.name,model:doc.model,includeLive:doc.includeLive,axioms:doc.axioms.map(({name,kind,ast})=>({name,kind,ast})),properties:doc.properties.map(({name,scope,ast})=>({name,scope,ast}))});
  const names=(await readdir(directory)).filter(file=>file.endsWith('.md')).sort();
  assert.deepEqual(names,Object.keys(BASELINE_SEMANTIC_DIGESTS).sort());
  for(const file of names){
    const source=await readFile(new URL(file,directory),'utf8'),doc=parseDocument(source);
    const digest=createHash('sha256').update(JSON.stringify(semantic(doc))).digest('hex');
    assert.equal(digest,BASELINE_SEMANTIC_DIGESTS[file],file);
    assert.ok(source.indexOf('```hsm-model')>source.lastIndexOf('```hsm\n'),file+': model appendix follows every executable formula');
    for(const row of [...doc.axioms,...doc.properties])assert.equal(unicodeFormula(row.formula),row.formula,file+': '+row.name+' uses Unicode operators');
  }
});
