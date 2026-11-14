import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createReaderPage} from '../src/reader-page.mjs';
import {loadReaderData} from '../tools/build-reader.mjs';

test('checker and offline reader show the same complete wordmark before JavaScript runs',async()=>{
  const application=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const reader=createReaderPage(await loadReaderData());
  for(const html of [application,reader]){
    const marks=[...html.matchAll(/<span\b[^>]*\bclass="brand-mark"[^>]*>([^<]*)<\/span>/g)];
    assert.equal(marks.length,1,'each application surface has one visible brand mark');
    assert.equal(marks[0][1],'HSmc','the full wordmark is static text, including offline and without JavaScript');
    assert.match(marks[0][0],/aria-hidden="true"/,'the adjacent full application name provides its accessible label');
    assert.match(html,/aria-label="History Structure Model-checker home"|<h1\b[^>]*>History Structure Model-checker/);
    assert.doesNotMatch(html,/<span\b[^>]*\bclass="brand-mark"[^>]*>H<\/span>/);
  }
});
