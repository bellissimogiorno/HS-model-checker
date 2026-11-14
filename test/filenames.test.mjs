import test from 'node:test';
import assert from 'node:assert/strict';
import {artifactFilename} from '../src/filenames.mjs';

test('portable artifact names distinguish punctuation, Unicode and run identities', () => {
  const names = ['Echo?', 'Echo!', 'Echo!!', 'echo?', '∃¹', 'CON', '../some:claim'].map(label => artifactFilename('evidence', {label, identity: 'run-A'}));
  assert.equal(new Set(names).size, names.length);
  for (const name of names) { assert.match(name, /^[a-zA-Z0-9.-]+$/); assert.ok(name.length < 120); }
  assert.notEqual(artifactFilename('evidence', {label: 'Echo?', identity: 'run-A'}), artifactFilename('evidence', {label: 'Echo?', identity: 'run-B'}));
  assert.equal(artifactFilename('evidence', {label: 'Echo?', identity: 'run-A'}), names[0]);
  assert.throws(() => artifactFilename('../bad'), /portable/);
});
