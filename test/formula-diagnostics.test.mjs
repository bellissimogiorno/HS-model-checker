import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFormula,FormulaSyntaxError} from '../src/parser.mjs';

test('standalone formula errors locate LF, CRLF and CR lines consistently',()=>{
  for(const newline of ['\n','\r\n','\r']) {
    const source='"😀"() and'+newline+'true and @';
    assert.throws(()=>parseFormula(source),error=>
      error instanceof FormulaSyntaxError && error.line===2 && error.column===10 && error.index===source.indexOf('@'),
      JSON.stringify(newline));
  }
});

test('mixed line endings and supplementary Unicode retain raw indices and code-point columns',()=>{
  for(const [source,line,column] of [
    ['true\r and\r\n "😀"()\n or @',4,5],
    ['"😀"() and @',1,11],
  ]) assert.throws(()=>parseFormula(source),error=>
    error instanceof FormulaSyntaxError && error.line===line && error.column===column && error.index===source.indexOf('@'));
});
