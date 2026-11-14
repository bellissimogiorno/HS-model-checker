/** Portable download names retain a readable label and distinguish labels that
 * differ only in punctuation, case or Unicode. Exact labels stay in evidence. */
import {sha256} from './run-identity.mjs';

export function artifactFilename(kind, {label = '', identity = '', extension = 'json'} = {}) {
  if (typeof kind !== 'string' || !/^[a-z][a-z0-9-]*$/.test(kind)) throw new TypeError('Artifact kind must be a lowercase portable name.');
  if (typeof label !== 'string' || typeof identity !== 'string' || !/^[a-z0-9]+$/.test(extension)) throw new TypeError('Invalid artifact filename metadata.');
  const readable = label.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/g, '') || 'result';
  const digest = sha256(JSON.stringify([label, identity])).slice(0, 16);
  return `history-${kind}-${readable}-${digest}-v0.6.9.${extension}`;
}
