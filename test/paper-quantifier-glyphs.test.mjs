import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFormula} from '../src/parser.mjs';
test('unique and affine paper glyphs have the same AST as their ASCII input',()=>{
  for(const glyph of ['∃=1','∃¹','∃₁'])assert.deepEqual(parseFormula(`${glyph} v. v=v`),parseFormula('exists1 v. v=v'));
  for(const glyph of ['∃⩽1','∃≤1','∃⁰¹','∃₀₁'])assert.deepEqual(parseFormula(`${glyph} v. v=v`),parseFormula('exists01 v. v=v'));
});
