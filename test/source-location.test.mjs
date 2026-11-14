import test from 'node:test';
import assert from 'node:assert/strict';
import {sourcePosition, sourceOffset} from '../src/source-location.mjs';

test('source coordinates round-trip code points across every supported newline', () => {
  for (const newline of ['\n', '\r\n', '\r']) {
    const lines = ['# α😀', 'axiom "😀?" [other]: ∀ v. chosen(v)', 'last'];
    const source = lines.join(newline);
    let start = 0;
    for (const [index, line] of lines.entries()) {
      let offset = start;
      for (let column = 1; column <= Array.from(line).length + 1; column++) {
        assert.deepEqual(sourcePosition(source, offset), {line: index + 1, column});
        assert.equal(sourceOffset(source, {line: index + 1, column}), offset);
        offset += Array.from(line)[column - 1]?.length ?? 0;
      }
      start += line.length + newline.length;
    }
  }
});

test('source navigation clamps to the selected line and rejects malformed coordinates', () => {
  assert.equal(sourceOffset('a😀\r\nb', {line: 1, column: 99}), 3);
  assert.equal(sourceOffset('a😀\r\nb', {line: 99, column: 1}), 6);
  assert.deepEqual(sourcePosition('x', -2), {line: 1, column: 1});
  assert.deepEqual(sourcePosition('x', 99), {line: 1, column: 2});
  assert.throws(() => sourceOffset('x', {line: 0, column: 1}), /positive safe/);
  assert.throws(() => sourcePosition('x', 0.5), /safe integer/);
});
