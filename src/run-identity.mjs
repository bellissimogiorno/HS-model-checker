/** Portable, synchronous identification of the exact experiment request.
 *
 * Digests identify saved bytes/configuration. They are not signatures, solver
 * proofs, or a substitute for concrete replay. No Node or DOM dependency is
 * used, so CLI and browser workers construct the same identity.
 */
export const ENGINE_IDENTITY = Object.freeze({
  name: 'history-structure-model-checker', version: '0.6.9',
  semantics: 'hbb-disc/2026-11-07',
});

const roundConstants = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
const rotate = (word, count) => (word >>> count) | (word << (32-count));

/** SHA-256 of the UTF-8 encoding, returned as 64 lowercase hex digits. */
export function sha256(text) {
  if (typeof text !== 'string') throw new TypeError('Hashed source must be a string.');
  const bytes = new TextEncoder().encode(text);
  const padded = new Uint8Array(Math.ceil((bytes.length+9)/64)*64);
  padded.set(bytes); padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer), bitLength = bytes.length*8;
  view.setUint32(padded.length-8, Math.floor(bitLength/0x100000000));
  view.setUint32(padded.length-4, bitLength >>> 0);
  const state = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const schedule = new Uint32Array(64);
  for (let offset=0;offset<padded.length;offset+=64) {
    for(let i=0;i<16;i++) schedule[i]=view.getUint32(offset+i*4);
    for(let i=16;i<64;i++) {
      const a=schedule[i-15],b=schedule[i-2];
      const s0=rotate(a,7)^rotate(a,18)^(a>>>3),s1=rotate(b,17)^rotate(b,19)^(b>>>10);
      schedule[i]=(schedule[i-16]+s0+schedule[i-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,h]=state;
    for(let i=0;i<64;i++) {
      const s1=rotate(e,6)^rotate(e,11)^rotate(e,25),choose=(e&f)^(~e&g);
      const first=(h+s1+choose+roundConstants[i]+schedule[i])>>>0;
      const s0=rotate(a,2)^rotate(a,13)^rotate(a,22),majority=(a&b)^(a&c)^(b&c);
      const second=(s0+majority)>>>0;
      h=g;g=f;f=e;e=(d+first)>>>0;d=c;c=b;b=a;a=(first+second)>>>0;
    }
    for(const [i,value]of[a,b,c,d,e,f,g,h].entries()) state[i]=(state[i]+value)>>>0;
  }
  return [...state].map(word=>word.toString(16).padStart(8,'0')).join('');
}

/** Key order is immaterial; array order and JSON values remain significant. */
export function canonicalJSON(value) {
  const active = new Set();
  function visit(item) {
    if(item===null||typeof item==='string'||typeof item==='boolean')return JSON.stringify(item);
    if(typeof item==='number') {
      if(!Number.isFinite(item))throw new TypeError('Run metadata numbers must be finite.');
      return JSON.stringify(item);
    }
    if(!item||typeof item!=='object'||active.has(item))throw new TypeError('Run metadata must be finite JSON data.');
    active.add(item);
    let result;
    if(Array.isArray(item))result='['+Array.from(item,child=>child===undefined?'null':visit(child)).join(',')+']';
    else {
      if(Object.getPrototypeOf(item)!==Object.prototype&&Object.getPrototypeOf(item)!==null)throw new TypeError('Run metadata must contain plain JSON objects.');
      result='{'+Object.keys(item).filter(key=>item[key]!==undefined).sort().map(key=>JSON.stringify(key)+':'+visit(item[key])).join(',')+'}';
    }
    active.delete(item);return result;
  }
  return visit(value);
}

const deepFreeze = value => {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)) {
    for(const child of Object.values(value))deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

/** The source is stored once on the enclosing result/evidence. A snapshot binds
 * it to exact choices, operational bounds, backend and declared engine release.
 * Source JSON is included in the digest so even lone UTF-16 surrogate code
 * units (which UTF-8 replaces) cannot make different JS sources share an ID.
 */
export function createRunSnapshot(sourceMarkdown,{selectedProperties,droppedAxioms,bounds},engine=ENGINE_IDENTITY) {
  if(typeof sourceMarkdown!=='string')throw new TypeError('Run source must be a string.');
  const snapshot={
    format:'history-structure-run-snapshot/v1',
    engine:structuredClone(engine),
    backend:bounds.mode==='evaluate'?'concrete-evaluator':'builtin-cdcl/tseitin',
    sourceSha256:sha256(sourceMarkdown),
    selectedProperties:structuredClone(selectedProperties),
    droppedAxioms:structuredClone(droppedAxioms),
    bounds:structuredClone(bounds),
  };
  const id='sha256:'+sha256(canonicalJSON({sourceMarkdown,...snapshot}));
  return deepFreeze({...snapshot,id});
}

/** Check saved identity metadata, never the logical certificate itself. Old
 * evidence without snapshot metadata is deliberately handled by the caller. */
export function verifyRunSnapshot(snapshot,sourceMarkdown,{bounds,droppedAxioms,selectedProperties}) {
  if(!snapshot||typeof snapshot!=='object'||snapshot.format!=='history-structure-run-snapshot/v1')throw new Error('Malformed run snapshot metadata.');
  const engine=snapshot.engine;
  if(!engine||engine.name!==ENGINE_IDENTITY.name||engine.semantics!==ENGINE_IDENTITY.semantics||typeof engine.version!=='string'||!/^\d+\.\d+\.\d+$/.test(engine.version))throw new Error('Unsupported run snapshot engine identity.');
  const expected=createRunSnapshot(sourceMarkdown,{bounds,droppedAxioms,selectedProperties},engine);
  if(canonicalJSON(snapshot)!==canonicalJSON(expected))throw new Error('Run snapshot identity does not match its source, selections, bounds or engine metadata.');
  return true;
}
