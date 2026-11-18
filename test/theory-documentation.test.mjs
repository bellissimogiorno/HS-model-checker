import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseDocument} from '../src/document.mjs';
import {buildTheory,correctnessProperties,THEORY_NAMES} from '../src/theories.mjs';

const directory=new URL('../examples/theories/',import.meta.url);
const root=fileURLToPath(new URL('../',import.meta.url));

async function markdownFiles(directory) {
  const entries=await readdir(directory,{withFileTypes:true});
  const files=[];
  for(const entry of entries) {
    const url=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
    if(entry.isDirectory()) files.push(...await markdownFiles(url));
    else if(entry.name.endsWith('.md')) files.push(url);
  }
  return files.sort((a,b)=>a.href.localeCompare(b.href));
}

const withoutFences=source=>source.replace(/```[^\n]*\n[\s\S]*?\n```/g,'');

test('every shipped theory identifies its draft, example status, and per-declaration source',async()=>{
  const files=await markdownFiles(directory);
  assert.ok(files.length,'the shipped theory directory must not be empty');
  for(const url of files) {
    const source=await readFile(url,'utf8'),prose=withoutFences(source),doc=parseDocument(source);
    const label=fileURLToPath(url).slice(root.length);
    assert.match(prose,/Heterogeneous trust in reliable broadcast via modal logic and history structures/,label);
    assert.match(prose,/Murdoch J\. Gabbay and Isaac Sheff/,label);
    assert.match(prose,/Implementation authorship:.*AI-generated following prompts by Murdoch J\. Gabbay/,label);
    assert.match(prose,/no independent expert audit of this translation is claimed/i,label);
    assert.match(prose,/2026-11-18/,label);
    assert.match(source,/08361854a013fa9ec7928221b9f05896386801b8d6247250a524c27d151199a4/,`${label}: exact revised paper fingerprint`);
    assert.match(prose,/(?:pedagogical|scenario|diagnostic|experiment)/i,label);
    assert.match(prose,/not a literal/i,label);
    assert.match(prose,/PAPER_MAP\.md/,`${label}: source-map navigation`);
    assert.match(prose,/(?:Definition|Lemma|Remark) \d+\.\d+\.\d+/,`${label}: exact numbered source`);
    const lines=source.split(/\r\n?|\n/);
    for(const row of [...doc.axioms,...doc.properties]) {
      const comment=lines[row.line-2]??'';
      assert.match(comment,/^# (?:Paper|Scenario): /,`${label}:${row.line} ${row.name}: source comment must immediately precede declaration`);
      if(comment.startsWith('# Paper:')) {
        assert.match(comment,/(?:Figure|Definition|Remark|Proposition|Theorem|Lemma) \d/,`${label}: ${row.name}`);
        assert.match(comment,/\bp{1,2}\.\s*\d/,`${label}: ${row.name} needs a page`);
      } else assert.match(comment,/not (?:a |an |the )?paper/i,`${label}: ${row.name} must mark scenario additions`);
    }
    if(doc.includeLive) {
      const index=lines.findIndex(line=>line.trim()==='include ThyLive');
      const comment=lines[index-1]??'';
      assert.match(comment,/^# Paper: .*Figure 7.*p\. 43.*Definition 5\.2\.4/,`${label}: exact ThyLive source`);
      assert.match(comment,/Knowledge/,`${label}: dynamic Knowledge schemes must be documented`);
      assert.match(comment,/all[ -](?:possible )?world/i,`${label}: ThyLive uses all-world validity`);
      assert.match(prose,/Figure \d+.*p\. \d+/,`${label}: protocol figure and page`);
      assert.match(prose,/Theorem \d+\.\d+\.\d+/,`${label}: correctness theorem`);
      assert.match(prose,/deliver\(/,`${label}: event argument order`);
      assert.match(prose,/PAPER_VARIANTS\.md/,`${label}: alternative/weakening interpretation`);
      for(const property of correctnessProperties(doc.model.signature.predicates.includes('corr')?'HBBCorr':doc.model.signature.predicates.includes('safe')?'HBBSafe':'HBBSimp')) {
        const row=doc.properties.find(row=>row.name===property.name);
        assert.ok(row,`${label}: full canonical ${property.name} remains present`);
        assert.deepEqual(row.ast,property.ast,`${label}: documentation must not weaken a correctness statement`);
        assert.match(lines[row.line-2],/(?:Proposition|Theorem) \d+\.\d+\.\d+/,`${label}: ${row.name} proof reference`);
      }
    }
  }
});

test('the paper map covers every built-in rule and correctness claim with definitions and notation',async()=>{
  const map=await readFile(new URL('../docs/PAPER_MAP.md',import.meta.url),'utf8');
  const model={
    format:'history-structure-model/v1',participants:['p'],values:['v'],nodes:[],
    signature:{events:['propose','echo','vote','deliver'],predicates:['live','safe','corr']},
    quorums:{v:[['p']]},facts:[],
  };
  for(const name of THEORY_NAMES) {
    assert.ok(map.includes(name),`${name}: theory named in source map`);
    for(const rule of buildTheory(model,name).axioms) {
      // Scheme instances share a source row, rather than listing every ground event.
      const documented=rule.scheme??rule.name;
      assert.ok(map.includes('`'+documented+'`'),`${name}/${documented}: canonical rule missing from map`);
    }
    if(name!=='ThyLive') for(const claim of correctnessProperties(name)) {
      assert.ok(map.includes('`'+claim.name+'`'),`${name}/${claim.name}: correctness claim missing from map`);
    }
  }
  for(const token of ['CorrSeq','CorrPast','CorrSymm','CorrTran','exists1','exists01','allpast','everytime']) {
    assert.ok(map.includes('`'+token),`${token}: ASCII alias missing from map`);
  }
  assert.match(map,/PAPER_VARIANTS\.md/);
  assert.match(map,/Definition 5\.2\.1/);
});

test('theory documentation links resolve within the release',async()=>{
  const urls=[...await markdownFiles(directory),new URL('../docs/PAPER_MAP.md',import.meta.url)];
  for(const url of urls) {
    const prose=withoutFences(await readFile(url,'utf8'));
    for(const match of prose.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target=match[1].split('#')[0];
      if(!target||/^[a-z]+:/i.test(target)) continue;
      const path=resolve(dirname(fileURLToPath(url)),target);
      assert.ok(path.startsWith(root),`${url.pathname}: link escapes release`);
      assert.ok(await stat(path),`${url.pathname}: missing ${target}`);
    }
  }
});
