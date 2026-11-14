import test from 'node:test';
import assert from 'node:assert/strict';
import {compileModel} from '../src/model.mjs';
import {parseFormula} from '../src/parser.mjs';
import {Evaluator} from '../src/evaluator.mjs';

test('empty intersection settles modality without enumerating an expensive body',()=>{
  const values=['l','v1','v2','v3','v4','v5','v6','v7'];
  const model=compileModel({format:'history-structure-model/v1',participants:['a','b','c'],values,signature:{events:[],predicates:[]},nodes:[],quorums:Object.fromEntries(values.map(v=>[v,[['a','b'],['a','c'],['b','c']]]))});
  const formula=parseFormula('box["l","l","l"] (forall a,b,c,d. a=a)');
  const result=new Evaluator(model,{maxSteps:200}).check(formula);
  assert.equal(result.holds,true);
  assert(result.stats.steps<200);
});
