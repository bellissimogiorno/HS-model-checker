/** History workflow adapted from 3muQL Explorer (MIT).
 * The semantic engine and model format are specific to hbb-disc. */
import {
  compileModel,
  normalizeEvent,
  eventKey
} from './model.mjs';
import {
  parseFormula
} from './parser.mjs';
import {
  parseDocument,
  serializeDocument,
  replaceModelBlock,
  selectTheory
} from './document.mjs';
import {EXAMPLES, EXAMPLE_GROUPS, exampleOptions} from './example-catalog.mjs';
import {highlightSource, renderTheoryMarkdown} from './theory-presentation.mjs';
import {unicodeFormula, unicodeTheorySource, asciiTheorySource} from './notation.mjs';
import {sourceOffset} from './source-location.mjs';
import {artifactFilename} from './filenames.mjs';
const $ = id => document.getElementById(id);
const DRAFT_KEY = 'history-structure-model-checker/custom-draft/v0.2';
const state = {
  doc: null,
  sourceCurrent: false,
  modelDirty: false,
  custom: false,
  curatedExample: null,
  runCuratedExample: null,
  example: 'first-steps.md',
  revision: 0,
  worker: null,
  job: null,
  serial: 0,
  timer: null,
  run: null,
  runOptions: null,
  inspectedData: null,
  inspected: null,
  selectedNode: null,
  theoryView: 'read',
  theoryBasePath: 'examples/theories/',
  importedEvidence: null,
  importedEvidenceStatus: null,
  inspectedEvidence: null
};
let saveTimer, pendingDraft, loadSerial = 0;
const json = value => JSON.stringify(value,(_k, v) => typeof v === 'bigint' ? v.toString(): v, 2);
const counted = (n, singular, plural = singular + 's') => n + ' ' + (n === 1 ? singular : plural);
const el =(tag, cls = '', text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = String(text);
  return n;
};
// The textarea owns editing, selection, undo, IME and accessibility. The
// highlighted layer is a noninteractive, identically spaced visual mirror.
function syncTheoryScroll() {
  const editor = $('theoryEditor'), mirror = $('theoryHighlight');
  // Native scrollbars consume viewport space. Match the textarea's *client*
  // box, otherwise the mirror can clamp before the caret reaches the last row.
  if (editor.clientWidth > 0) mirror.style.width = editor.clientWidth + 'px';
  if (editor.clientHeight > 0) mirror.style.height = editor.clientHeight + 'px';
  mirror.scrollTop = editor.scrollTop;
  mirror.scrollLeft = editor.scrollLeft;
}
function refreshTheoryEditor() {
  const source = $('theoryEditor').value;
  const enabled = $('highlightTheory').checked && source.length <= 250000;
  $('theoryEditorFrame').classList.toggle('has-highlighting', enabled);
  $('theoryHighlight').hidden = !enabled;
  $('syntaxStatus').textContent = source.length > 250000 ? 'Large source: native text editing; highlighting paused.' : '';
  if (enabled) $('theoryHighlight').innerHTML = highlightSource(source, 'markdown') + '\n';
  syncTheoryScroll();
}
function renderTheoryReader() {
  const source = $('theoryEditor').value;
  if (source.length > 1000000) {
    $('theoryReader').textContent = 'This document is too large for the reading view. Use Edit Markdown to inspect the complete source.';
  } else {
    let display = source;
    try { display = unicodeTheorySource(source); } catch { /* An unfinished edit still has a readable preview. */ }
    const basePath = state.theoryBasePath;
    $('theoryReader').innerHTML = renderTheoryMarkdown(display, {basePath});
  }
  $('theoryPreviewStatus').hidden = state.sourceCurrent;
}
function setTheoryView(view, {focus = false} = {}) {
  state.theoryView = view === 'edit' ? 'edit' : 'read';
  const editing = state.theoryView === 'edit';
  $('sourceDetails').hidden = !editing;
  $('theoryReader').hidden = editing;
  $('theoryPreviewStatus').hidden = editing || state.sourceCurrent;
  $('readTheory').setAttribute('aria-pressed', String(!editing));
  $('editTheory').setAttribute('aria-pressed', String(editing));
  if (editing) { refreshTheoryEditor(); if (focus) $('theoryEditor').focus(); }
  else renderTheoryReader();
}
const parseJSON =(source, label) => {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(label + ': ' + error.message);
  }
};
function notice(message, kind = '') {
  const box = $('notice');
  box.textContent = message;
  box.className = 'notice ' + kind;
  box.hidden = !message;
}
function jump(id) {
  const target = $(id);
  target.scrollIntoView( {
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto': 'smooth',
    block: 'start'
  });
  target.querySelector('h2')?.focus( {
    preventScroll: true
  });
}
function returnToExampleChooser() {
  const chooser = $('exampleSelect');
  // The old navigation button has been replaced. Move keyboard focus without
  // letting focus scrolling compete with our final destination.
  chooser.focus({preventScroll: true});
  const label = chooser.closest('label') ?? chooser;
  const navigation = document.querySelector('.workflow-nav');
  // Measuring after the reading view renders flushes its changed layout. Use
  // the actual sticky bar height, including wrapping at narrow/zoomed widths.
  const labelTop = label.getBoundingClientRect().top;
  const navigationHeight = navigation?.getBoundingClientRect().height ?? 0;
  // Read the scroll offset after layout: a shorter example can clamp it.
  const top = window.scrollY + labelTop - navigationHeight - 16;
  // A smooth scroll aimed at a section whose contents just changed can finish
  // below the picker. Land once, immediately, at the visible chooser label.
  window.scrollTo({top: Math.max(0, top), behavior: 'instant'});
}
function download(filename, value, mime = 'application/json') {
  const blob = new Blob([typeof value === 'string' ? value: json(value)], {
    type: mime + ';charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = el('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function inputs() {
  return Object.fromEntries([...document.querySelectorAll('#propertyOptions input,#axiomOptions input')].map(n => [n.name + ':' + n.value,
  n.checked]));
}
function selected() {
  return [...$('propertyOptions').querySelectorAll('input:checked')].map(n => n.value);
}
function dropped() {
  return [...$('axiomOptions').querySelectorAll('input:not(:checked)')].map(n => n.value);
}
function mode() {
  return document.querySelector('input[name="mode"]:checked')?.value ?? 'synthesize';
}
function positive(id, {
  integer = false,
  zero = false,
  max = Number.MAX_SAFE_INTEGER
} = {}) {
  const value = Number($(id).value);
  if (!Number.isFinite(value) ||(integer && !Number.isSafeInteger(value)) || value <(zero ? 0: Number.MIN_VALUE) || value > max) throw new Error(($(id).closest('label')?.firstChild?.textContent ?? id).trim() + ' must be ' +(zero ? 'nonnegative': 'positive') +(integer ? ' and integral': '') + '.');
  return value;
}
function settings() {
  const currentMode = mode();
  return {
    mode: currentMode,
    droppedAxioms: dropped(),
    selectedProperties: selected(),
    pinFacts: $('pinFacts').checked,
    maxMilliseconds: positive('timeBudget') * 1000,
    maxAdditionalNodes: currentMode === 'search' ? positive('maxAdditionalNodes', {
      integer: true,
      zero: true,
      max: 8
    }): 0,
    maxModels: currentMode === 'search' ? positive('maxModels', {
      integer: true,
      max: 100000
    }): 1000,
    palette: currentMode === 'search' ? parseJSON($('eventPalette').value, 'Event palette'): undefined,
    maxKnowledgeFamilies: positive('knowledgeBudget', {
      integer: true
    }),
    maxCompilationNodes: positive('compilationBudget', {
      integer: true
    }),
    maxDecisions: positive('decisionBudget', {
      integer: true,
      zero: true
    }),
    maxSteps: positive('stepBudget', {
      integer: true
    })
  };
}
function project() {
  let options;
  try {
    options = settings();
  } catch {
    options = {};
  }
  return {
    format: 'history-structure-project/v2',
    version: '0.6.9',
    sourceMarkdown: $('theoryEditor').value,
    theoryBasePath: state.theoryBasePath,
    unappliedModelSource: state.modelDirty ? $('modelEditor').value: undefined,
    options,
    example: state.example,
    model: state.doc?.model ?? null
  };
}
function flushDraft() {
  clearTimeout(saveTimer);
  if (!pendingDraft) return;
  const snapshot = pendingDraft;
  pendingDraft = null;
  try {
    localStorage.setItem(DRAFT_KEY, json(snapshot));
    $('storageState').textContent = 'Custom draft saved in this browser.';
    $('restoreDraft').hidden = false;
  } catch {
    $('storageState').textContent = 'Browser storage unavailable. Save a project file to keep your work.';
  }
}
function preserveDraft() {
  if (!state.custom) return;
  clearTimeout(saveTimer);
  pendingDraft = project();
  saveTimer = setTimeout(flushDraft, 200);
}
globalThis.addEventListener?.('pagehide', flushDraft);
function stopJob(message) {
  if (state.worker) state.worker.terminate();
  state.worker = null;
  state.job = null;
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  $('activityBar').hidden = true;
  $('runProgress').hidden = true;
  $('stopButton').hidden = true;
  $('evidence').setAttribute('aria-busy', 'false');
  syncRunContext();
  if (message) notice(message, 'warning');
}
function changed( {
  source = false,
  custom = true
} = {}) {
  state.revision++;
  hideExampleContinuation();
  if (state.job) stopJob('Inputs changed. The unfinished operation was stopped.');
  if (custom) state.custom = true;
  if (source) {
    ++loadSerial;
    state.sourceCurrent = false;
    $('sourceStatus').textContent = 'Source edited · update choices';
    $('choicesStatus').textContent = 'The source has changed. Update choices before running.';
    $('choicesStatus').hidden = false;
    $('claimsControls').hidden = true;
    refreshTheoryEditor();
    $('theoryPreviewStatus').hidden = state.theoryView === 'edit';
  }
  $('staleResults').hidden = !state.run;
  syncRunContext();
  preserveDraft();
}
function setChecked(container, names) {
  const set = new Set(names);
  for (const n of $(container).querySelectorAll('input')) n.checked = set.has(n.value);
}
function optionsIntoForm(options = {}) {
  selectTheory(state.doc, options);
  if (['search',
  'synthesize',
  'evaluate'].includes(options.mode)) document.querySelector('input[name="mode"][value="' + options.mode + '"]').checked = true;
  if (typeof options.pinFacts === 'boolean') $('pinFacts').checked = options.pinFacts;
  const mapping = {
    maxAdditionalNodes: 'maxAdditionalNodes',
    maxModels: 'maxModels',
    maxKnowledgeFamilies: 'knowledgeBudget',
    maxCompilationNodes: 'compilationBudget',
    maxDecisions: 'decisionBudget',
    maxSteps: 'stepBudget'
  };
  for (const[key,
  id] of Object.entries(mapping)) if (Number.isFinite(options[key])) $(id).value = String(options[key]);
  if (Number.isFinite(options.maxMilliseconds)) $('timeBudget').value = String(options.maxMilliseconds / 1000);
  if (Array.isArray(options.palette)) $('eventPalette').value = json(options.palette);
  if (Array.isArray(options.selectedProperties)) setChecked('propertyOptions', options.selectedProperties);
  if (Array.isArray(options.droppedAxioms)) {
    const omitted = new Set(options.droppedAxioms);
    for (const n of $('axiomOptions').querySelectorAll('input')) n.checked = !omitted.has(n.value);
  }
  syncRunContext();
}
function optionRow(entry, kind, checked = true) {
  const row = el('label', 'option-row');
  const input = el('input');
  input.type = 'checkbox';
  input.name = kind;
  input.value = entry.name;
  input.checked = checked;
  const text = el('span');
  text.append(el('strong', '', entry.name), el('span', 'small-text', entry.kind ??(kind === 'property' ? entry.scope ?? 'end': 'axiom')));
  if (entry.formula) {
    const formula = el('code', 'formula');
    let display = entry.formula;
    try { display = unicodeFormula(display); } catch { /* ThyLive's descriptive summary is prose. */ }
    formula.innerHTML = highlightSource(display, 'hsm');
    text.append(formula);
  }
  row.append(input, text);
  input.addEventListener('change',() => changed());
  return row;
}
function renderChoices(previous = {}) {
  $('propertyOptions').replaceChildren(el('legend', 'sr-only', 'Properties to test'));
  for (const property of state.doc.properties) $('propertyOptions').append(optionRow(property, 'property', previous['property:' + property.name] ?? true));
  if (!state.doc.properties.length) $('propertyOptions').append(el('p', 'small-text', 'No properties declared. The run will look for a model of the assumptions.'));
  $('axiomOptions').replaceChildren(el('legend', 'sr-only', 'Retained assumptions'));
  if (state.doc.includeLive) $('axiomOptions').append(optionRow( {
    name: 'ThyLive',
    kind: 'complete dynamic axiom schemes',
    formula: 'LiveAlways, LiveSeq and all Knowledge instances'
  }, 'axiom', previous['axiom:ThyLive'] ?? true));
  for (const axiom of state.doc.axioms) $('axiomOptions').append(optionRow(axiom, 'axiom', previous['axiom:' + axiom.name] ?? true));
  if (!state.doc.includeLive && !state.doc.axioms.length) $('axiomOptions').append(el('p', 'small-text', 'No assumptions declared.'));
  $('claimsControls').hidden = false;
  $('choicesStatus').hidden = true;
}
function suggestPalette(model) {
  const events = new Map([['null',
  null]]);
  for (const node of model.nodes ??[]) events.set(json(node.event), node.event);
  return [...events.values()];
}
function updateChoices( {
  preserve = true,
  showNotice = true,
  allowModelDraft = false
} = {}) {
  if (state.modelDirty && preserve && !allowModelDraft) {
    notice('Model JSON has unapplied edits. Apply them to the theory or discard the JSON edits before updating choices.', 'warning');
    return false;
  }
  try {
    const prior = preserve ? inputs(): {};
    const doc = parseDocument($('theoryEditor').value);
    compileModel(doc.model);
    state.doc = doc;
    state.sourceCurrent = true;
    state.modelDirty = false;
    refreshTheoryEditor();
    renderTheoryReader();
    $('loadedTheory').textContent = doc.name;
    $('sourceStatus').textContent = state.custom ? 'Custom theory · choices current': 'Curated theory · choices current';
    $('signatureSummary').textContent = [counted(doc.model.participants.length, 'participant'),
      counted(doc.model.values.length, 'value / learner', 'values / learners'),
      counted((doc.model.nodes ??[]).length, 'declared tuple'), counted(doc.axioms.length, 'protocol axiom')].join(' · ') +
      (doc.includeLive ? ' + full ThyLive' : '');
    $('modelEditor').value = json(doc.model);
    renderChoices(prior);
    setOptions($('nodePlace'), doc.model.participants.map(p => [p,
    p]));
    suggestNodeId();
    if (!state.inspectedData) inspectModel(doc.model, 'Supplied model from the theory source at inspection time.');
    syncRunContext();
    if (showNotice) notice('Theory loaded. Choose claims and retained assumptions.', 'success');
    return true;
  } catch (error) {
    state.sourceCurrent = false;
    $('choicesStatus').textContent = error.message;
    $('choicesStatus').hidden = false;
    $('claimsControls').hidden = true;
    $('sourceStatus').textContent = 'Source needs correction';
    syncRunContext();
    if (showNotice) {
      notice(error.message, 'error');
      setTheoryView('edit');
      focusSourceError(error);
    }
    return false;
  }
}
function focusSourceError(error) {
  if (!Number.isInteger(error.line)) return;
  const editor = $('theoryEditor');
  const start = sourceOffset(editor.value, {line: Math.max(1, error.line), column: Math.max(1, error.column ?? 1)});
  editor.focus();
  editor.setSelectionRange(start, start + (Array.from(editor.value.slice(start))[0]?.length ?? 0));
  syncTheoryScroll();
}
function syncRunContext() {
  const isReady = state.doc && state.sourceCurrent && !state.modelDirty,
  busy = !!state.job;
  const props = selected(),
  omissions = dropped();
  $('runButton').disabled = !isReady || busy;
  $('discardModelChanges').hidden = !state.modelDirty;
  $('continueClaims').disabled = busy;
  $('continueRun').disabled = !isReady || busy;
  $('propertyCount').textContent = props.length + ' selected';
  const total =(state.doc?.axioms.length ?? 0) +(state.doc?.includeLive ? 1: 0);
  $('axiomCount').textContent =(total - omissions.length) + ' of ' + total + ' kept';
  $('runTheory').textContent = state.doc?.name ?? 'Choose a theory';
  $('runSummary').textContent = state.modelDirty ? 'Apply the edited model JSON to the theory before running.': props.length ? 'Test ' + props.length + ' selected propert' +(props.length === 1 ? 'y': 'ies') + ' against the retained assumptions.': 'No properties selected: find a model of the retained assumptions.';
  $('runProperties').textContent = props.length ? 'Properties: ' + props.join(', '): '';
  $('runOmissions').textContent = omissions.length ? 'Removed for this run: ' + omissions.join(', ') + '.': 'All declared axioms are included.';
  $('runOmissions').classList.toggle('has-omissions', omissions.length > 0);
  $('runButton').textContent =(mode() === 'evaluate' ? 'Evaluate this model': props.length ? 'Find a counterexample': 'Find a model') + ' →';
  $('searchControls').hidden = mode() !== 'search';
  $('synthesisControls').hidden = mode() === 'evaluate';
  $('stopButton').hidden = !busy;
  const navigating = $('exampleContinuation').getAttribute('aria-busy') === 'true';
  for (const button of $('exampleContinuation').querySelectorAll('button')) {
    button.disabled = busy || navigating || !button.dataset.destination;
  }
  syncExamplePreset();
}
function syncExamplePreset() {
  const origin = state.curatedExample, panel = $('examplePreset');
  const entry = origin && EXAMPLES.find(example => example.file === origin.file);
  const defaults = entry && exampleOptions(entry.file);
  const eligible = entry && state.sourceCurrent && !state.modelDirty && $('theoryEditor').value === origin.source;
  panel.hidden = !eligible || !(defaults.droppedAxioms.length || defaults.selectedProperties || entry.initialNoModel);
  if (panel.hidden) return;
  const omitted = dropped();
  let text = 'Current omitted assumptions: ' + (omitted.join(', ') || 'none') + '. ';
  if (defaults.droppedAxioms.length) {
    text += 'This example starts with ' + defaults.droppedAxioms.join(', ') + ' unchecked. ';
    text += !omitted.length && mode() === 'synthesize'
      ? 'With all axioms kept, this fixed history has no model, so properties are Not tested. '
      : 'Run the starting selection to explore the omission. ';
    text += 'Keep all axioms selects the full-theory comparison; Use example defaults restores the omission. Both restore the initial fixed-history settings and limits.';
  } else if (entry.initialNoModel) {
    text += 'This is a deliberate full-theory control. Its initial fixed history has no model satisfying the assumptions; the properties are therefore Not tested.';
  } else {
    text += 'The three protocol correctness claims are selected initially. The additional bad-axiom diagnostic is available separately under Properties.';
  }
  $('examplePresetText').textContent = text;
  $('presetDefaults').disabled = !!state.job;
  $('presetFullTheory').disabled = !!state.job;
}
function applyExamplePreset(fullTheory = false) {
  const origin = state.curatedExample;
  if (!origin || !state.sourceCurrent || state.modelDirty || state.job || $('theoryEditor').value !== origin.source) return;
  const options = exampleOptions(origin.file);
  options.selectedProperties ??= state.doc.properties.map(property => property.name);
  if (fullTheory) options.droppedAxioms = [];
  $('eventPalette').value = json(suggestPalette(state.doc.model));
  optionsIntoForm(options);
  changed();
  notice(fullTheory ? 'All declared axioms selected. Run to check the full-theory comparison.' : 'Example starting choices restored. Run to check this selection.', 'success');
}
function setOptions(select, choices, preferred) {
  select.replaceChildren();
  for (const[value,
  label] of choices) {
    const n = el('option', '', label);
    n.value = value;
    select.append(n);
  }
  if (choices.some(([value]) => value === preferred)) select.value = preferred;
}
function resetExampleResults() {
  state.run = null;
  state.runOptions = null;
  state.runProject = null;
  state.runCuratedExample = null;
  state.importedEvidence = null;
  state.importedEvidenceStatus = null;
  state.inspectedEvidence = null;
  state.inspectedFailure = null;
  state.inspected = null;
  state.inspectedData = null;
  state.selectedNode = null;
  state.valuationAtoms = null;
  $('staleResults').hidden = true;
  const empty = el('div', 'empty-state');
  empty.append(el('h3', '', 'This example has not been run.'),
    el('p', '', 'Choose the claims and settings, then run the checker to see results for this example.'));
  $('results').replaceChildren(empty);
  $('formulaEditor').value = 'seq';
  $('scopeSelect').value = 'end';
  $('worldControls').hidden = true;
  $('formulaResult').replaceChildren();
  $('failureContext').replaceChildren();
  $('failureContext').hidden = true;
  $('inspectTupleId').value = '';
  $('progressPhase').textContent = 'Working…';
  $('progressCounts').textContent = '';
  $('progressElapsed').textContent = '';
}
async function loadExample(file, {expectedRevision = state.revision} = {}) {
  const token = ++loadSerial;
  preserveDraft();
  try {
    const response = await fetch(new URL('../examples/theories/' + file, import.meta.url));
    if (!response.ok) throw new Error('Cannot load example (HTTP ' + response.status + ').');
    const source = await response.text();
    if (token !== loadSerial || state.revision !== expectedRevision) return false;
    // A failed download or invalid document leaves the current example and
    // its results intact. Clear the old context only after validating the new one.
    compileModel(parseDocument(source).model);
    stopJob();
    hideExampleContinuation();
    resetExampleResults();
    state.curatedExample = null;
    state.custom = false;
    state.theoryBasePath = 'examples/theories/';
    state.example = file;
    state.revision++;
    $('theoryEditor').value = source;
    $('exampleSelect').value = file;
    $('exampleDescription').textContent = EXAMPLES.find(example => example.file === file)?.description ?? '';
    if (updateChoices({preserve: false, showNotice: false})) {
      $('eventPalette').value = json(suggestPalette(state.doc.model));
      optionsIntoForm(exampleOptions(file));
      state.curatedExample = {file, source};
      syncExamplePreset();
      $('formulaResult').replaceChildren();
      $('inspectorContext').textContent = 'Supplied model for this example. No check has been run.';
      renderExampleContinuation();
      notice('Loaded ' + state.doc.name + '. Run this example to see its results.', 'success');
      return true;
    }
  } catch (error) {
    if (token !== loadSerial || state.revision !== expectedRevision) return false;
    $('exampleSelect').value = state.example;
    const hint = location.protocol === 'file:' ? ' Start the included local server instead of opening index.html directly.' : '';
    notice(error.message + hint, 'error');
  }
  return false;
}
function modelDocument(model) {
  return {
    format: 'history-structure-theory/v1',
    name: model.name ?? 'Imported history',
    model,
    includeLive: model.signature.predicates.includes('live'),
    axioms: [],
    properties: [ {
      name: 'Sequential',
      scope: 'end',
      formula: 'seq'
    }]
  };
}
function loadSource(source, options = {}, custom = true, modelDraft, basePath = '') {
  ++loadSerial;
  if (typeof source !== 'string') throw new Error('The imported project needs sourceMarkdown text.');
  stopJob();
  hideExampleContinuation();
  state.curatedExample = null;
  state.revision++;
  state.custom = custom;
  state.theoryBasePath = basePath === 'examples/theories/' ? basePath : '';
  $('staleResults').hidden = !state.run;
  state.inspected = null;
  state.inspectedData = null;
  $('theoryEditor').value = source;
  if (updateChoices( {
    preserve: false,
    showNotice: false
  })) {
    optionsIntoForm(options);
    if (typeof modelDraft === 'string') {
      $('modelEditor').value = modelDraft;
      state.modelDirty = true;
      syncRunContext();
    }
    if (!Array.isArray(options.palette)) $('eventPalette').value = json(suggestPalette(state.doc.model));
    $('staleResults').hidden = !state.run;
    preserveDraft();
    return true;
  }
  return false;
}
function beginJob(action, payload, label, onDone) {
  // A newer computation is a newer user action too: a pending preset load
  // must not arrive later and terminate it or replace its source.
  ++loadSerial;
  stopJob();
  const worker = new Worker(new URL('./worker.mjs', import.meta.url), {
    type: 'module'
  });
  const job = {
    id:++ state.serial,
    revision: state.revision,
    action,
    started: performance.now(),
    phase: label
  };
  state.worker = worker;
  state.job = job;
  $('activityBar').hidden = false;
  $('activityText').textContent = label;
  $('activityDetail').textContent = '';
  $('runProgress').hidden = false;
  $('progressPhase').textContent = label;
  $('progressCounts').textContent = '';
  $('evidence').setAttribute('aria-busy', 'true');
  syncRunContext();
  state.timer = setInterval(() => {
    if (state.job !== job) return;
    const elapsed =((performance.now() - job.started) / 1000).toFixed(1) + ' s elapsed';
    $('activityDetail').textContent = elapsed;
    $('progressElapsed').textContent = elapsed;
  }, 200);
  worker.onmessage =( {
    data
  }) => {
    if (state.job !== job || data.id !== job.id || job.revision !== state.revision) return;
    if (data.type === 'progress') {
      const p = data.progress ?? data.stats ?? {};
      $('progressPhase').textContent = p.phase ?? label;
      $('activityText').textContent = p.phase ?? label;
      $('progressCounts').textContent = [p.property ? 'Property: ' + p.property: null,
      p.examined !== undefined ? p.examined + ' histories checked': null,
      p.modelsSatisfyingAssumptions !== undefined ? p.modelsSatisfyingAssumptions + ' satisfy assumptions': null,
      p.decisions !== undefined ? p.decisions + ' solver decisions': null].filter(Boolean).join(' · ');
      return;
    }
    const elapsed = performance.now() - job.started;
    stopJob();
    if (data.type === 'error') {
      notice(data.error.message, data.error.incomplete ? 'warning': 'error');
      if (action === 'formula') renderBanner($('formulaResult'), data.error.incomplete ? 'warning': 'error', data.error.incomplete ? 'Incomplete': 'Cannot evaluate', data.error.message);
      else if (action === 'experiment') {
        renderBanner($('results'), data.error.incomplete ? 'warning': 'error', data.error.incomplete ? 'Incomplete': 'Cannot run', data.error.message);
        if (Number.isInteger(data.error.line)) { setTheoryView('edit'); focusSourceError(data.error); }
      }
      return;
    }
    onDone(data.result, elapsed);
  };
  worker.onerror = event => {
    if (state.job !== job) return;
    stopJob();
    notice(event.message || 'The module worker could not start. Serve this package through the included local server.', 'error');
  };
  worker.postMessage( {
    id: job.id,
    action,
    ...payload
  });
}
function renderBanner(target, kind, title, message) {
  const box = el('div', 'notice ' + kind);
  box.append(el('h3', '', title));
  if (message) box.append(el('p', '', message));
  target.replaceChildren(box);
}
function statusKind(status) {
  return status === 'counterexample' ? 'error': status === 'model' || status === 'holds' ? 'success': 'warning';
}
function statusTitle(status) {
  return {
    'counterexample': 'Counterexample found',
    'model': 'A model of the retained axioms',
    'no-model': 'No model in the selected scope',
    'holds': 'Holds within the selected scope',
    'incomplete': 'Incomplete',
    'not-tested': 'Not tested'
  }
  [status] ?? 'Result';
}
function witnessedModel(row) {
  return row?.evidence?.model ?? row?.witness?.model ??(row?.witness?.format === 'history-structure-model/v1' ? row.witness: null);
}
function evidenceButtons(row, propertyName = '') {
  const actions = el('div', 'download-actions');
  const model = witnessedModel(row);
  if (model) {
    const inspect = el('button', 'button secondary', 'Inspect this model');
    inspect.type = 'button';
    inspect.addEventListener('click',() => {
      inspectModel(model, 'Recorded ' +(propertyName ? 'witness for ' + propertyName: 'model of the retained assumptions') + '.', {
        formula: row.formula,
        source: row.evidence?.sourceMarkdown,
        failure: row.evidence?.failure ?? row.witness?.result?.failures?.[0]
      });
      $('modelView').open = true;
      $('modelView').scrollIntoView( {
        block: 'start',
        behavior: 'smooth'
      });
    });
    actions.append(inspect);
    const save = el('button', 'button quiet', 'Download model JSON');
    save.type = 'button';
    save.addEventListener('click',() => download(artifactFilename('model', {label: propertyName || 'axioms', identity: row.evidence?.snapshot?.id ?? json(model)}), model));
    actions.append(save);
  }
  if (row.evidence) {
    const save = el('button', 'button quiet', 'Download replayable evidence');
    save.type = 'button';
    save.addEventListener('click',() => download(artifactFilename('evidence', {label: propertyName || 'axioms', identity: row.evidence.snapshot?.id ?? row.evidence.sourceMarkdown}), row.evidence));
    const replay = el('button', 'button quiet', 'Replay evidence');
    replay.type = 'button';
    replay.addEventListener('click',() => replayEvidence(row.evidence));
    actions.append(save, replay);
  }
  return actions;
}
function worldInfo(row) {
  const failures = row?.witness?.result?.failures ?? row?.result?.failures ?? row?.failures ??[];
  if (!failures.length) return null;
  const detail = el('details', 'witness');
  detail.append(el('summary', '', 'Recorded failing world'), el('pre', 'compact-json', json(failures[0])));
  return detail;
}
function renderRun(result, elapsed) {
  const recordedProject = structuredClone(state.runProject);
  state.run = result;
  $('staleResults').hidden = false;
  const area = $('results');
  const message = result.reason ??(result.status === 'no-model' ? 'The retained assumptions have no model within this scope. This does not establish any selected property.': result.status === 'holds' ? 'No counterexample exists within the exact scope completed by this run.': '');
  renderBanner(area, statusKind(result.status), statusTitle(result.status), message);
  $('staleResults').hidden = false;
  const seconds =(elapsed / 1000).toFixed(2);
  area.append(el('p', 'small-text', seconds + ' seconds · mode: ' + result.mode +(result.complete === false ? ' · other search questions may remain incomplete': '')));
  const scope = el('div', 'scope-box');
  scope.append(el('p', '', 'Theory: ' + result.name), el('p', '', 'Retained assumptions: ' +(result.retainedAxioms?.join(', ') || 'none')), el('p', '', 'Removed assumptions: ' +(result.droppedAxioms?.join(', ') || 'none')), el('p', '', 'Selected properties: ' +(result.selectedProperties?.join(', ') || 'none')));
  if (result.snapshot) {
    scope.append(el('p', 'run-identity', 'Run identity: ' + result.snapshot.id),
      el('p', 'small-text', 'Engine: ' + result.snapshot.engine.name + ' ' + result.snapshot.engine.version + ' · backend: ' + result.snapshot.backend));
  }
  area.append(scope);
  if (result.consistency) {
    const consistency = el('p', 'result-note');
    consistency.textContent = result.consistency.consistent === true ? 'A model satisfying the retained assumptions was found.': result.consistency.consistent === false ? 'No model satisfies the retained assumptions in this scope.': 'Assumption consistency was not fully resolved.';
    area.append(consistency);
    if (result.status === 'no-model') area.append(el('p', 'result-note', 'Properties are Not tested because this run found no model satisfying the retained assumptions. This is a consistency result; it does not establish or refute the selected properties.'));
  }
  if (result.consistency?.evidence) {
    const modelDetail = el('details', 'witness');
    modelDetail.append(el('summary', '', 'Model of the retained assumptions'), evidenceButtons(result.consistency));
    area.append(modelDetail);
  } else if (!result.properties?.length) area.append(evidenceButtons(result));
  for (const row of result.properties ??[]) {
    const card = el('article', 'property-card');
    const formula = el('code', 'formula');
    let display = row.formula;
    try { display = unicodeFormula(display); } catch { /* Preserve a diagnostic if its input is not a closed formula. */ }
    formula.innerHTML = highlightSource(display ?? '', 'hsm');
    card.append(el('h3', '', row.name), el('p', 'status-pill ' + statusKind(row.status) + ' ' + row.status, statusTitle(row.status)), formula);
    if (row.reason) card.append(el('p', 'small-text', row.reason));
    card.append(evidenceButtons(row, row.name));
    const context = worldInfo(row);
    if (context) card.append(context);
    if (row.explanation) {
      const detail = el('details', 'witness');
      detail.append(el('summary', '', 'Explanation' +(row.explanation.partial ? ' (partial)': '')), el('pre', 'compact-json', json(row.explanation)));
      card.append(detail);
    }
    area.append(card);
  }
  const controls = el('div', 'download-actions');
  const report = el('button', 'button secondary', 'Download report JSON');
  report.type = 'button';
  report.addEventListener('click',() => download(artifactFilename('report', {label: result.name, identity: result.snapshot?.id ?? result.sourceMarkdown ?? ''}), result));
  const snapshot = el('button', 'button quiet', 'Download run project');
  snapshot.type = 'button';
  snapshot.addEventListener('click',() => download(artifactFilename('run-project', {label: result.name, identity: result.snapshot?.id ?? recordedProject.sourceMarkdown}), recordedProject));
  controls.append(report, snapshot);
  if (typeof result.sourceMarkdown === 'string') {
    const source = el('button', 'button quiet', 'Download run Markdown');
    source.type = 'button';
    source.addEventListener('click', () => download(artifactFilename('theory', {label: result.name, identity: result.snapshot?.id ?? result.sourceMarkdown, extension: 'md'}), result.sourceMarkdown, 'text/markdown'));
    controls.append(source);
  }
  area.append(controls);
  const detail = el('details', 'witness');
  detail.append(el('summary', '', 'Bounds and counters'), el('pre', 'compact-json', json( {
    bounds: result.bounds,
    stats: result.stats,
    complete: result.complete
  })));
  area.append(detail);
  const first = witnessedModel(result) ??(result.properties ??[]).map(witnessedModel).find(Boolean) ?? witnessedModel(result.consistency);
  if (first) {
    const recorded =(result.properties ??[]).find(row => witnessedModel(row)) ?? result.consistency ?? {};
    inspectModel(first, 'Recorded model from this experiment.', {
      formula: recorded.formula,
      source: recorded.evidence?.sourceMarkdown,
      failure: recorded.evidence?.failure ?? recorded.witness?.result?.failures?.[0]
    });
  }
  $('staleResults').hidden = false;
  // caller clears only if the source revision is still identical
  renderExampleContinuation(result, state.runCuratedExample);
}
function hideExampleContinuation() {
  $('exampleContinuation').hidden = true;
  $('exampleContinuation').setAttribute('aria-busy', 'false');
  $('exampleContinuation').replaceChildren();
}
function renderExampleContinuation(result = null, context = null) {
  hideExampleContinuation();
  const origin = state.curatedExample;
  if (!origin || !state.sourceCurrent || state.modelDirty) return;
  const source = context?.source ?? origin.source;
  if (source !== $('theoryEditor').value || (context &&
      (origin !== context.origin || state.runCuratedExample !== context || (result && result.sourceMarkdown !== source)))) return;
  const index = EXAMPLES.findIndex(example => example.file === origin.file);
  if (index < 0) return;
  const previous = EXAMPLES[index - 1], next = EXAMPLES[index + 1], target = next ?? EXAMPLES[0];
  const card = $('exampleContinuation'), revision = state.revision;
  const runContext = state.runCuratedExample;
  card.append(el('p', 'small-text', 'Example ' + (index + 1) + ' of ' + EXAMPLES.length + ' · chooser order'),
    el('h3', '', next ? 'Explore the curated examples' : 'You reached the last curated example.'));
  if (context?.variant) card.append(el('p', '', 'This run uses your edited variant of ' + EXAMPLES[index].label + '.'));
  if (result && (result.complete === false || result.status === 'incomplete')) {
    card.append(el('p', '', 'This run is incomplete. You can adjust its limits and run again, or explore another example.'));
  }
  card.append(el('p', 'next-example-title', (next ? 'Next: ' : 'Start again: ') + target.group + ' · ' + target.label),
    el('p', '', target.description));
  const actions = el('div', 'example-navigation');
  const makeButton = (label, arrow, direction, primary) => {
    const button = el('button', 'button ' + (primary ? 'primary' : 'secondary'));
    const hint = el('span', 'example-navigation-arrow', arrow);
    hint.setAttribute('aria-hidden', 'true');
    button.type = 'button';
    button.dataset.direction = direction;
    button.setAttribute('aria-label', label);
    if (direction === 'previous') button.append(hint, el('span', '', label));
    else button.append(el('span', '', label), hint);
    return button;
  };
  const back = makeButton('Return to previous example', '⬅︎', 'previous', false);
  const forward = makeButton(next ? 'Continue to next example' : 'Start again with First steps', '➡︎', 'next', true);
  back.dataset.destination = previous?.file ?? '';
  forward.dataset.destination = target.file;
  back.disabled = !previous;
  forward.disabled = false;
  actions.append(back, forward);
  card.append(actions);
  let loading = false;
  const sameContext = () => state.revision === revision && state.curatedExample === origin && state.runCuratedExample === runContext &&
    $('theoryEditor').value === source && state.sourceCurrent && !state.modelDirty;
  const current = () => sameContext() && !state.job;
  const navigate = async destination => {
    if (!destination || loading || !current()) return;
    loading = true; back.disabled = true; forward.disabled = true;
    card.setAttribute('aria-busy', 'true');
    try {
      if (await loadExample(destination.file, {expectedRevision: revision})) {
        setTheoryView('read'); returnToExampleChooser();
      }
    } finally {
      if (sameContext()) {
        loading = false;
        card.setAttribute('aria-busy', 'false');
        syncRunContext();
      }
    }
  };
  back.addEventListener('click', () => navigate(previous));
  forward.addEventListener('click', () => navigate(target));
  card.hidden = false;
}
function replayEvidence(evidence) {
  try {
    beginJob('replay', {
      evidence,
      options: {
        maxMilliseconds: positive('timeBudget') * 1000
      }
    }, 'Replaying the exact saved experiment…', result => {
      const detail = el('details', 'replaybox');
      detail.open = true;
      detail.append(el('summary', '', 'Replay result'), el('pre', 'compact-json', json(result)));
      $('results').append(detail);
      if (state.importedEvidence === evidence && state.importedEvidenceStatus) state.importedEvidenceStatus.textContent = result.verified === true ? 'Imported evidence replay verified.' : 'Imported evidence remains unverified. Inspect the replay result below.';
      if (result.verified === true && state.inspectedEvidence === evidence) $('inspectorContext').textContent = 'Imported saved evidence. Replay verified its recorded assumptions and claim.';
      notice(result.verified === true ? 'Saved evidence replay verified.': 'Replay finished; inspect the validation result below.', result.verified === true ? 'success': 'warning');
    });
  } catch (error) {
    notice(error.message, 'error');
  }
}
function collectValuationAtoms(data, recorded = {}) {
  const model = state.inspected;
  const atoms = new Map();
  let truncated = false,
  operations = 0;
  const add = atom => {
    if (!model.predicateSymbols.has(atom.symbol)) return;
    if (atoms.size >= 400 && !atoms.has(eventKey(atom))) {
      truncated = true;
      return;
    }
    atoms.set(eventKey(atom), atom);
  };
  for (const fact of data.facts ??[]) add(normalizeEvent(fact.atom, {
    allowNull: false
  }));
  let doc = state.doc;
  if (recorded.source) {
    try {
      doc = parseDocument(recorded.source);
    } catch {
      doc = null;
    }
  }
  const visit = ast => {
    if (!ast ||++ operations > 5000) {
      truncated = true;
      return;
    }
    if (ast.type === 'atom' && model.predicateSymbols.has(ast.symbol)) {
      const variables = [...new Set(ast.args.filter(t => t.type === 'var').map(t => t.name))];
      const instantiate =(i, env) => {
        if (++ operations > 5000 || atoms.size >= 400) {
          truncated = true;
          return;
        }
        if (i === variables.length) {
          add( {
            symbol: ast.symbol,
            args: ast.args.map(t => t.type === 'value' ? t.value: env.get(t.name))
          });
          return;
        }
        for (const value of model.values) {
          const next = new Map(env);
          next.set(variables[i], value);
          instantiate(i + 1, next);
          if (operations > 5000 || atoms.size >= 400) break;
        }
      };
      instantiate(0, new Map());
    }
    if (ast.body) visit(ast.body);
    if (ast.left && ast.type !== 'eq') visit(ast.left);
    if (ast.right && ast.type !== 'eq') visit(ast.right);
  };
  for (const row of[...(doc?.axioms ??[]),
  ...(doc?.properties ??[])]) visit(row.ast ?? parseFormula(row.formula));
  if (recorded.formula) {
    try {
      visit(parseFormula(recorded.formula));
    } catch {
      /* A display index never validates a result. */
    }
  }
  return {
    atoms: [...atoms.values()].sort((a, b) => eventKey(a).localeCompare(eventKey(b))),
    truncated
  };
}
function renderValuation() {
  const model = state.inspected,
  area = $('valuationTable');
  area.replaceChildren();
  if (!model) return;
  const place = $('valuationPlace').value,
  time = model.resolveTime($('valuationTime').value);
  const index = state.valuationAtoms ?? {
    atoms: [],
    truncated: false
  };
  const table = el('table', 'valuation');
  const caption = el('caption', '', 'Predicate interpretation at ' + place + ', ' + time.id +(time.index === model.fullTime.index ? ' (end)': '') + '. ' + index.atoms.length + ' ground predicate atoms shown' +(index.truncated ? ' (display index truncated)': '') + '. Facts absent from the full interpretation are false.');
  table.append(caption);
  const head = el('thead'),
  headers = el('tr');
  headers.append(el('th', '', 'Ground predicate'), el('th', '', 'Truth'));
  head.append(headers);
  table.append(head);
  const body = el('tbody');
  for (const atom of index.atoms) {
    const holds = model.hasFact(place, time.index, atom);
    const row = el('tr');
    row.append(el('td', '', eventText(atom)), el('td', holds ? 'truth truth-t': 'truth truth-f', holds ? 'true': 'false'));
    body.append(row);
  }
  if (!index.atoms.length) {
    const row = el('tr'),
    cell = el('td', '', 'No listed ground predicate atoms. The supplied interpretation makes unlisted predicates false.');
    cell.colSpan = 2;
    row.append(cell);
    body.append(row);
  }
  table.append(body);
  area.append(table);
}
function returnToFailure() {
  const failure = state.inspectedFailure,
  model = state.inspected;
  if (!failure || !model) return;
  invalidateFormula('Returned to the recorded failing world. Evaluate again for this context.');
  $('valuationPlace').value = failure.place;
  $('worldPlace').value = failure.place;
  try {
    const time = model.resolveTime(failure.time).id;
    $('valuationTime').value = time;
    $('worldTime').value = time;
  } catch {
    /* Imported stale selectors are shown as recorded data. */
  }
  $('worldEvent').value = json(failure.event ?? null);
  $('scopeSelect').value = 'world';
  $('worldControls').hidden = false;
  renderValuation();
  if (failure.node) renderNodeInspector(failure.node);
}
function renderFailureContext(recorded = {}) {
  const area = $('failureContext');
  area.replaceChildren();
  area.hidden = !state.inspectedFailure;
  if (!state.inspectedFailure) return;
  area.append(el('p', '', 'Recorded failing world: ' + state.inspectedFailure.place + ', ' + state.inspectedFailure.time + ', ' + eventText(state.inspectedFailure.event ?? null)));
  const button = el('button', 'text-button', 'Return to failing context');
  button.type = 'button';
  button.addEventListener('click', returnToFailure);
  area.append(button);
  if (recorded.formula) $('formulaEditor').value = recorded.formula;
  returnToFailure();
}
// The inspector evaluates exactly the displayed model, independent of current run inputs.
function eventText(event) {
  if (event === null) return '†';
  if (typeof event === 'string') return event;
  return event.symbol + '(' +(event.args ??[]).map(v => JSON.stringify(v)).join(', ') + ')';
}
function maskCount(mask) {
  return mask.toString(2).replaceAll('0', '').length;
}
function limitedHistory(model, mask, limit = 30) {
  const ids = [];
  for (const node of model.nodes) {
    if (mask & node.bit) ids.push(node.id);
    if (ids.length >= limit) break;
  }
  return ids;
}
function invalidateFormula(message = '') {
  if (state.job?.action === 'formula') stopJob();
  $('formulaResult').replaceChildren();
  if (message) $('formulaResult').append(el('p', 'small-text', message));
}
function inspectModel(data, context, recorded = {}) {
  try {
    const model = compileModel(data);
    invalidateFormula('The inspected model changed. Evaluate the formula again for this model.');
    state.inspectedData = structuredClone(data);
    state.inspected = model;
    state.inspectedFailure = recorded.failure ?? null;
    state.inspectedEvidence = recorded.evidence ?? null;
    state.valuationAtoms = collectValuationAtoms(data, recorded);
    $('fullModelJson').textContent = json(data);
    $('inspectorContext').textContent = context;
    $('modelSummary').replaceChildren();
    for (const[n,
    label, plural] of[[model.participants.length,
    'participant'],
    [model.nodes.length,
    'canonical tuple'],
    [model.times.length,
    'represented time'],
    [model.values.length,
    'value / learner', 'values / learners']]) {
      $('modelSummary').append(el('span', '', counted(n, label, plural)));
    }
    setOptions($('worldPlace'), model.participants.map(p => [p,
    p]));
    setOptions($('worldTime'), model.times.map(t => [t.id,
    t.id +(t.index === model.fullTime.index ? ' · end': t.mask === 0n ? ' · empty': '')]), model.fullTime.id);
    $('worldEvent').value = 'null';
    setOptions($('valuationPlace'), model.participants.map(p => [p,
    p]));
    setOptions($('valuationTime'), model.times.map(t => [t.id,
    t.id +(t.index === model.fullTime.index ? ' · end': t.mask === 0n ? ' · empty': '')]), model.fullTime.id);
    renderValuation();
    renderDAG(model);
    state.selectedNode = model.nodes.at(- 1)?.id ?? null;
    renderNodeInspector(state.selectedNode);
    // Restore the recorded failing tuple after the initial DAG selection.
    renderFailureContext(recorded);
    $('modelDetails').replaceChildren();
    const list = el('ul');
    for (const value of model.values.slice(0, 100)) {
      const bases = model.quorums.get(value);
      const labels = bases.slice(0, 20).map(mask => '{' + model.participants.filter((_, i) => mask &(1n << BigInt(i))).join(', ') + '}');
      list.append(el('li', '', value + ': ' + labels.join(', ') +(bases.length > 20 ? ' … ' + bases.length + ' bases total': '')));
    }
    $('modelDetails').append(el('h3', '', 'Generating quorum sets'), list, el('h3', '', 'Represented times'));
    const times = el('ul');
    for (const time of model.times.slice(0, 100)) {
      const ids = limitedHistory(model, time.mask);
      const count = maskCount(time.mask);
      times.append(el('li', '', time.id +(time.index === model.fullTime.index ? ' (end)': '') + ': {' + ids.join(', ') +(count > ids.length ? ', …': '') + '} · ' + count + ' tuples'));
    }
    if (model.times.length > 100) times.append(el('li', '', model.times.length + ' times total; first 100 listed. All remain available in the world selector.'));
    $('modelDetails').append(times);
    if (state.inspectedFailure) returnToFailure();
  } catch (error) {
    notice(error.message, 'error');
  }
}
function svg(tag, attributes = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const[key,
  value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
function renderDAG(model) {
  const container = $('dagContainer');
  container.replaceChildren();
  if (!model.nodes.length) {
    container.append(el('p', 'small-text', 'The history is empty. Its end-of-time worlds still exist.'));
    return;
  }
  const displayed = model.nodes.slice(0, 250),
  levels = new Map(),
  rows = new Map();
  for (const node of displayed) {
    let level = 0;
    for (const parent of displayed) if (node.past & parent.bit) level = Math.max(level,(levels.get(parent.index) ?? 0) + 1);
    levels.set(node.index, level);
    if (!rows.has(level)) rows.set(level, []);
    rows.get(level).push(node);
  }
  const width = Math.max(600, Math.max(...[...rows.values()].map(row => row.length)) * 180 + 40),
  height = Math.max(220,(Math.max(...rows.keys()) + 1) * 105 + 40);
  const positions = new Map();
  for (const[level,
  row] of rows) row.forEach((node, i) => positions.set(node.index, {
    x: width / 2 +(i -(row.length - 1) / 2) * 180,
    y: 45 + level * 105
  }));
  const picture = svg('svg', {
    width,
    height,
    viewBox: '0 0 ' + width + ' ' + height,
    role: 'group',
    'aria-label': 'Shared-history DAG'
  });
  picture.append(svg('style', {}, '.dag-node rect{fill:#fff;stroke:#8594a9}.dag-node.selected rect{fill:#edf3ff;stroke:#2457d6;stroke-width:2}.dag-node text{font-family:system-ui,sans-serif;fill:#192435;text-anchor:middle}.dag-node .place{font-size:12px;font-weight:600}.dag-node .event{font-size:14px}.dag-node .id{font-size:11px;fill:#536278}.dag-edge{fill:none;stroke:#9caec1;stroke-width:1.4}'));
  const defs = svg('defs');
  const marker = svg('marker', {
    id: 'historyArrow',
    markerWidth: 7,
    markerHeight: 7,
    refX: 6,
    refY: 3.5,
    orient: 'auto'
  });
  marker.append(svg('path', {
    d: 'M0,0 L7,3.5 L0,7 Z',
    fill: '#9caec1'
  }));
  defs.append(marker);
  picture.append(defs);
  for (const node of displayed) {
    let direct = node.past;
    for (const parent of displayed) if (node.past & parent.bit) direct &= ~parent.past;
    for (const parent of displayed) if (direct & parent.bit) {
      const from = positions.get(parent.index),
      to = positions.get(node.index);
      picture.append(svg('path', {
        class: 'dag-edge',
        d: 'M' + from.x + ',' +(from.y + 27) + ' C' + from.x + ',' +(from.y + 58) + ' ' + to.x + ',' +(to.y - 58) + ' ' + to.x + ',' +(to.y - 29),
        'marker-end': 'url(#historyArrow)'
      }));
    }
  }
  for (const node of displayed) {
    const p = positions.get(node.index),
    group = svg('g', {
      class: 'dag-node',
      transform: 'translate(' + p.x + ',' + p.y + ')',
      tabindex: 0,
      role: 'button',
      'aria-label': node.id + ', ' + node.place + ', ' + eventText(node.event)
    });
    group.dataset.nodeIndex = String(node.index);
    group.append(svg('title', {}, node.id + ': (' + node.place + ', ' + eventText(node.event) + ', ' + model.times[node.timeIndex].id + ')'), svg('rect', {
      x: - 77,
      y: - 27,
      width: 154,
      height: 54,
      rx: 6
    }), svg('text', {
      class: 'place',
      y: - 10
    }, node.place));
    const label = eventText(node.event);
    group.append(svg('text', {
      class: 'event',
      y: 6
    }, label.length > 24 ? label.slice(0, 21) + '…': label), svg('text', {
      class: 'id',
      y: 20
    }, node.id));
    const select =() => renderNodeInspector(node.id);
    group.addEventListener('click', select);
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
    picture.append(group);
  }
  container.append(picture, el('p', 'model-caption', displayed.length < model.nodes.length ? 'Showing the first ' + displayed.length + ' of ' + model.nodes.length + ' tuples. Use the ID lookup to inspect any tuple. Checks use the complete history.': 'Only immediate dependencies are drawn. A tuple knows every ancestor.'));
}
function renderNodeInspector(id) {
  const model = state.inspected;
  if (!model) return;
  const area = $('nodeInspector');
  area.replaceChildren();
  const node = model.aliases.get(id);
  if (!node) {
    area.append(el('p', 'small-text', 'There are no tuples to inspect.'));
    return;
  }
  state.selectedNode = node.id;
  for (const group of $('dagContainer').querySelectorAll('.dag-node')) group.classList.toggle('selected', Number(group.dataset.nodeIndex) === node.index);
  area.append(el('h3', '', 'Tuple ' + node.id));
  const dl = el('dl');
  for (const[label,
  value] of[['Place',
  node.place],
  ['Maybe-event',
  eventText(node.event)],
  ['Time',
  model.times[node.timeIndex].id],
  ['Aliases',
  node.aliases.join(', ')]]) dl.append(el('dt', '', label), el('dd', '', value));
  const past = el('dd', 'complete-past');
  let count = 0;
  for (const ancestor of model.nodes) if (node.past & ancestor.bit) {
    count++;
    if (count <= 100) {
      const chip = el('button', 'tuple-chip', ancestor.id);
      chip.type = 'button';
      chip.addEventListener('click',() => renderNodeInspector(ancestor.id));
      past.append(chip);
    }
  }
  if (!count) past.textContent = '∅';
  if (count > 100) past.append(el('span', 'small-text',(count - 100) + ' more tuples; inspect any by ID.'));
  dl.append(el('dt', '', 'Complete past'), past);
  area.append(dl);
}
function suggestNodeId() {
  let model;
  try {
    model = parseJSON($('modelEditor').value, 'Model JSON');
  } catch {
    return;
  }
  const ids = new Set((model.nodes ??[]).map(n => n.id));
  let n = 0;
  while (ids.has('e' + n)) n++;
  $('nodeId').value = 'e' + n;
}
function applyModel() {
  try {
    const model = parseJSON($('modelEditor').value, 'Model JSON');
    if (!state.sourceCurrent && !updateChoices( {
      showNotice: false,
      allowModelDraft: true
    })) throw new Error('Correct and update the theory source first.');
    compileModel(model);
    $('theoryEditor').value = replaceModelBlock($('theoryEditor').value, model);
    changed( {
      source: true
    });
    if (updateChoices( {
      showNotice: false,
      allowModelDraft: true
    })) {
      preserveDraft();
      inspectModel(model, 'Supplied model from the theory source at inspection time.');
      notice('Model applied to the theory source.', 'success');
    }
  } catch (error) {
    notice(error.message, 'error');
  }
}
for (const name of EXAMPLE_GROUPS) {
  const group = el('optgroup');
  group.label = name;
  for (const example of EXAMPLES.filter(example => example.group === name)) {
    const option = el('option', '', example.label);
    option.value = example.file;
    group.append(option);
  }
  $('exampleSelect').append(group);
}
$('exampleSelect').value = state.example;
$('exampleSelect').addEventListener('change',() => {
  if ($('exampleSelect').value) loadExample($('exampleSelect').value);
});
$('resetExample').addEventListener('click',() => loadExample(state.example));
$('presetDefaults').addEventListener('click', () => applyExamplePreset());
$('presetFullTheory').addEventListener('click', () => applyExamplePreset(true));
$('readTheory').addEventListener('click', () => setTheoryView('read'));
$('editTheory').addEventListener('click', () => setTheoryView('edit', {focus: true}));
$('highlightTheory').addEventListener('change', refreshTheoryEditor);
$('theoryEditor').addEventListener('scroll', syncTheoryScroll);
if (typeof ResizeObserver === 'function') new ResizeObserver(syncTheoryScroll).observe($('theoryEditor'));
window.addEventListener('resize', syncTheoryScroll);
window.addEventListener('beforeprint', renderTheoryReader);
if (document.fonts?.ready) document.fonts.ready.then(syncTheoryScroll);
for (const [id, convert] of [['unicodeTheory', unicodeTheorySource], ['asciiTheory', asciiTheorySource]]) {
  $(id).addEventListener('click', () => {
    try {
      const editor = $('theoryEditor'), converted = convert(editor.value);
      if (converted === editor.value) return;
      const start = editor.selectionStart, end = editor.selectionEnd;
      editor.setRangeText(converted, 0, editor.value.length, 'preserve');
      editor.setSelectionRange(Math.min(start, converted.length), Math.min(end, converted.length));
      changed({source: true});
      notice('Formula notation changed. Update choices to validate the edited source.', 'success');
    } catch (error) { notice(error.message, 'error'); }
  });
}
$('theoryEditor').addEventListener('input',() => changed( {
  source: true
}));
let escapeEditorTab = false;
$('theoryEditor').addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault(); updateChoices(); return;
  }
  if (event.key === 'Escape') { escapeEditorTab = true; return; }
  if (event.key === 'Tab') {
    if (escapeEditorTab || event.shiftKey) { escapeEditorTab = false; return; }
    event.preventDefault();
    const editor = event.target;
    const start = editor.selectionStart, end = editor.selectionEnd;
    if (start === end) editor.setRangeText('  ', start, end, 'end');
    else {
      const source = editor.value, lineStart = start === 0 ? 0 : source.lastIndexOf('\n', start - 1) + 1;
      const blockEnd = source[end - 1] === '\n' ? end - 1 : end;
      const block = source.slice(lineStart, blockEnd), indented = block.replace(/^/gm, '  ');
      editor.setRangeText(indented, lineStart, blockEnd, 'select');
      editor.setSelectionRange(start + 2, end + indented.length - block.length);
    }
    changed( {
      source: true
    });
  } else {
    escapeEditorTab = false;
  }
});
$('updateChoices').addEventListener('click',() => updateChoices());
$('continueClaims').addEventListener('click',() => {
  if (state.sourceCurrent || updateChoices()) jump('claims');
});
$('continueRun').addEventListener('click',() => jump('configure'));
for (const[index,
button] of[...$('symbolToolbar').querySelectorAll('button')].entries()) button.tabIndex = index === 0 ? 0: - 1;
for (const button of $('symbolToolbar').querySelectorAll('[data-symbol]')) button.addEventListener('click',() => {
  const editor = $('theoryEditor');
  editor.focus();
  editor.setRangeText(button.dataset.symbol, editor.selectionStart, editor.selectionEnd, 'end');
  changed( {
    source: true
  });
});
for (const button of $('symbolToolbar').querySelectorAll('button')) button.addEventListener('keydown', event => {
  if (!['ArrowLeft',
  'ArrowRight',
  'Home',
  'End'].includes(event.key)) return;
  event.preventDefault();
  const buttons = [...$('symbolToolbar').querySelectorAll('button')];
  let index = buttons.indexOf(button);
  index = event.key === 'Home' ? 0: event.key === 'End' ? buttons.length - 1:(index +(event.key === 'ArrowRight' ? 1: - 1) + buttons.length) % buttons.length;
  for (const item of buttons) item.tabIndex = item === buttons[index] ? 0: - 1;
  buttons[index].focus();
});
$('propertiesAll').addEventListener('click',() => {
  for (const n of $('propertyOptions').querySelectorAll('input')) n.checked = true;
  changed();
});
$('propertiesNone').addEventListener('click',() => {
  for (const n of $('propertyOptions').querySelectorAll('input')) n.checked = false;
  changed();
});
$('axiomsAll').addEventListener('click',() => {
  for (const n of $('axiomOptions').querySelectorAll('input')) n.checked = true;
  changed();
});
for (const input of document.querySelectorAll('input[name="mode"]')) input.addEventListener('change',() => changed());
for (const id of['pinFacts',
'maxAdditionalNodes',
'maxModels',
'eventPalette',
'timeBudget',
'knowledgeBudget',
'compilationBudget',
'decisionBudget',
'stepBudget']) $(id).addEventListener('input',() => changed());
$('runForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!state.sourceCurrent || state.modelDirty) {
    notice(state.modelDirty ? 'Apply the edited model JSON to the theory before running.': 'Update choices before running.', 'warning');
    return;
  }
  try {
    const options = settings();
    hideExampleContinuation();
    const origin = state.curatedExample, runSource = $('theoryEditor').value;
    state.runCuratedExample = origin ? {origin, file: origin.file, source: runSource, variant: runSource !== origin.source} : null;
    state.runOptions = structuredClone(options);
    state.runProject = structuredClone(project());
    // Keep navigation present while running, but bind it to this new run so
    // detached actions cannot revive an earlier context. Busy controls are
    // disabled by syncRunContext and become usable after stop/error too.
    renderExampleContinuation(null, state.runCuratedExample);
    const source = runSource;
    beginJob('experiment', {
      sourceMarkdown: source,
      options
    }, 'Running the selected experiment…',(result, elapsed) => {
      renderRun(result, elapsed);
      $('staleResults').hidden = false;
      $('staleResults').hidden = source === $('theoryEditor').value;
      jump('evidence');
    });
  } catch (error) {
    notice(error.message, 'error');
  }
});
for (const id of['stopButton',
'floatingStop']) $(id).addEventListener('click',() => stopJob('Stopped. The unfinished questions remain open.'));
$('applyModel').addEventListener('click', applyModel);
$('discardModelChanges').addEventListener('click',() => {
  if (updateChoices({allowModelDraft: true})) {
    preserveDraft();
    notice('Unapplied JSON edits discarded; the model now matches the theory source.', 'success');
  }
});
$('addNode').addEventListener('click',() => {
  try {
    const model = parseJSON($('modelEditor').value, 'Model JSON');
    const id = $('nodeId').value.trim();
    if (!id) throw new Error('Enter a tuple ID.');
    model.nodes ??=[];
    model.nodes.push( {
      id,
      place: $('nodePlace').value,
      event: parseJSON($('nodeEvent').value, 'Event JSON'),
      past: $('nodePast').value.split(',').map(v => v.trim()).filter(Boolean)
    });
    compileModel(model);
    $('modelEditor').value = json(model);
    applyModel();
    $('nodePast').value = '';
    suggestNodeId();
  } catch (error) {
    notice(error.message, 'error');
  }
});
$('modelEditor').addEventListener('input',() => {
  state.modelDirty = true;
  changed();
  notice('Model JSON has unapplied edits. Apply model to theory before running those changes.', 'warning');
});
$('saveModel').addEventListener('click',() => {
  try {
    const model = parseJSON($('modelEditor').value, 'Model JSON');
    compileModel(model);
    download('history-model-v0.6.9.json', model);
  } catch (error) {
    notice(error.message, 'error');
  }
});
$('inspectSourceModel').addEventListener('click',() => {
  if (state.doc) inspectModel(state.doc.model, 'Supplied model from the theory source at inspection time.');
});
$('saveInspectedModel').addEventListener('click',() => {
  if (state.inspectedData) download('history-model-v0.6.9.json', state.inspectedData);
});
$('saveDagSvg').addEventListener('click',() => {
  const picture = $('dagContainer').querySelector('svg');
  if (picture) download('history-dag-v0.6.9.svg', new XMLSerializer().serializeToString(picture), 'image/svg+xml');
  else notice('An empty history has no tuple diagram to save.');
});
$('inspectTuple').addEventListener('click',() => {
  const id = $('inspectTupleId').value.trim();
  if (!state.inspected?.aliases.has(id)) {
    notice('Unknown tuple ID ' + JSON.stringify(id) + '.', 'error');
    return;
  }
  renderNodeInspector(id);
});
$('inspectTupleId').addEventListener('keydown', event => {
  if (event.key === 'Enter') $('inspectTuple').click();
});
for (const id of['valuationPlace',
'valuationTime']) $(id).addEventListener('change', renderValuation);
for (const id of ['formulaEditor', 'worldPlace', 'worldTime', 'worldEvent']) $(id).addEventListener(id === 'worldPlace' || id === 'worldTime' ? 'change' : 'input',() => invalidateFormula('Formula or world selection changed. Evaluate again.'));
$('scopeSelect').addEventListener('change',() => {
  invalidateFormula('Validity selection changed. Evaluate again.');
  $('worldControls').hidden = $('scopeSelect').value !== 'world';
});
$('checkFormula').addEventListener('click',() => {
  if (!state.inspectedData) return;
  invalidateFormula();
  try {
    const options = {
      maxMilliseconds: positive('timeBudget') * 1000,
      maxSteps: positive('stepBudget', {
        integer: true
      }),
      scope: $('scopeSelect').value
    };
    if (options.scope === 'world') options.world = {
      place: $('worldPlace').value,
      time: $('worldTime').value,
      event: parseJSON($('worldEvent').value, 'Maybe-event JSON')
    };
    beginJob('formula', {
      model: state.inspectedData,
      formula: $('formulaEditor').value,
      options
    }, 'Evaluating the inspected model…', result => {
      renderBanner($('formulaResult'), result.holds ? 'success': 'error', result.holds ? 'Formula holds': 'Formula fails', 'For this inspected model and the selected validity judgement.');
      for (const failure of result.failures ??[]) {
        const detail = el('details', 'witness');
        detail.open = true;
        detail.append(el('summary', '', 'Counterexample world'), el('pre', 'compact-json', json(failure)));
        $('formulaResult').append(detail);
      }
      if (result.explanation) {
        const detail = el('details', 'witness');
        detail.append(el('summary', '', 'Explanation' +(result.explanation.partial ? ' (partial)': '')), el('pre', 'compact-json', json(result.explanation)));
        $('formulaResult').append(detail);
      }
    });
  } catch (error) {
    notice(error.message, 'error');
  }
});
$('saveTheory').addEventListener('click',() => download('history-theory-v0.6.9.md', $('theoryEditor').value, 'text/markdown'));
$('saveProject').addEventListener('click',() => download('history-project-v0.6.9.json', project()));
for (const id of['openFile',
'loadCustom']) $(id).addEventListener('click',() => $('importFile').click());
$('editCurrent').addEventListener('click',() => {
  setTheoryView('edit');
  jump('choose');
  $('theoryEditor').focus();
});
$('importFile').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('The browser importer accepts files up to 10 MiB. Use the CLI for larger files.');
    const text = await file.text();
    preserveDraft();
    if (/\.json$/i.test(file.name) || text.trim().startsWith('{')) {
      const data = parseJSON(text, 'Imported JSON');
      if (data.format === 'history-structure-evidence/v1') {
        state.importedEvidence = data;
        if (typeof data.sourceMarkdown !== 'string') throw new Error('Saved evidence needs its recorded sourceMarkdown.');
        const recordedOptions = {...data.bounds, mode: data.mode ?? data.bounds?.mode ?? 'synthesize', droppedAxioms: data.droppedAxioms ?? [], selectedProperties: data.property ? [data.property.name] : []};
        if (!loadSource(data.sourceMarkdown, recordedOptions, true)) throw new Error('The saved evidence source could not be loaded. Correct it before replaying.');
        if (data.model) inspectModel(data.model, 'Imported saved evidence (unverified). Replay checks its exact recorded assumptions and property.', {
          formula: data.property?.formula,
          source: data.sourceMarkdown,
          failure: data.failure,
          evidence: data
        });
        const box = el('div', 'scope-box');
        state.importedEvidenceStatus = el('p', '', 'Loaded saved evidence (unverified). Replay it to verify the recorded claim.');
        box.append(state.importedEvidenceStatus);
        const replay = el('button', 'button secondary', 'Replay imported evidence');
        replay.type = 'button';
        replay.addEventListener('click',() => replayEvidence(data));
        box.append(replay);
        $('results').replaceChildren(box);
        jump('evidence');
      } else if (data.format === 'history-structure-project/v2') loadSource(data.sourceMarkdown, data.options ?? {}, true, data.unappliedModelSource, data.theoryBasePath);
      else if (data.format === 'history-structure-model/v1') loadSource(serializeDocument(modelDocument(data)), {}, true);
      else if (data.format === 'history-structure-project/v1') {
        const model = typeof data.modelSource === 'string' ? parseJSON(data.modelSource, 'Project model source'): data.model;
        loadSource(serializeDocument(modelDocument(model)), {}, true);
        notice('Imported the previous model format. Its old custom-theory fields were not silently converted.', 'warning');
      } else throw new Error('Unsupported project, evidence or model format.');
    } else loadSource(text, {}, true);
    setTheoryView(state.sourceCurrent ? 'read' : 'edit');
    if (state.sourceCurrent) notice('Loaded ' + file.name + '.', 'success');
  } catch (error) {
    notice(error.message, 'error');
  }
  event.target.value = '';
});
$('restoreDraft').addEventListener('click',() => {
  try {
    const draft = parseJSON(localStorage.getItem(DRAFT_KEY) ?? 'null', 'Saved draft');
    if (!draft || typeof draft.sourceMarkdown !== 'string') throw new Error('No recoverable custom draft is available.');
    if (loadSource(draft.sourceMarkdown, draft.options ?? {}, true, draft.unappliedModelSource, draft.theoryBasePath)) {
      notice('Custom draft restored.', 'success');
      jump('choose');
    }
  } catch (error) {
    notice(error.message, 'error');
  }
});
$('forgetDraft').addEventListener('click',() => {
  clearTimeout(saveTimer);
  pendingDraft = null;
  try {
    localStorage.removeItem(DRAFT_KEY);
    $('restoreDraft').hidden = true;
    $('storageState').textContent = 'Saved custom draft removed. The open source remains available.';
  } catch {
    notice('Browser storage is unavailable.', 'warning');
  }
});
for (const link of document.querySelectorAll('.workflow-nav a')) link.addEventListener('click',() => {
  for (const n of document.querySelectorAll('.workflow-nav a')) n.removeAttribute('aria-current');
  link.setAttribute('aria-current', 'step');
});
if (typeof IntersectionObserver === 'function') {
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    for (const link of document.querySelectorAll('.workflow-nav a')) {
      if (link.getAttribute('href') === '#' + visible.target.id) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    }
  }, {
    rootMargin: '-100px 0px -55% 0px',
    threshold: 0
  });
  for (const section of document.querySelectorAll('.workflow-step')) observer.observe(section);
}
try {
  $('restoreDraft').hidden = !localStorage.getItem(DRAFT_KEY);
  $('storageState').textContent = 'Curated examples do not overwrite your custom draft.';
} catch {
  $('storageState').textContent = 'Browser storage unavailable. Save a project to keep your work.';
}
if (location.protocol === 'file:') notice('Start the included local server. Browsers block module workers when index.html is opened as a file.', 'error');
loadExample('first-steps.md');
