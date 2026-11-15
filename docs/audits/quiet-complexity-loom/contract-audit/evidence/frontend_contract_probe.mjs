// Executes the current handler, extracted without editing production source.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';

const source = fs.readFileSync('src/main.ts', 'utf8');
const start = source.indexOf('function handleStreamEvent(');
const end = source.indexOf('\nfunction renderToolLine', start);
assert(start >= 0 && end > start);
const st = { text: '', finished: false, clarifications: new Set(), bubble: {} };
const finished = [];
const context = vm.createContext({
  activeStreams: new Map([['audit', st]]), loomVerified: false,
  setLoomReachable() {}, scrollChat() {}, renderToolLine() {}, renderHitlCard() {},
  finishStream(...args) { finished.push(args); },
});
vm.runInContext(stripTypeScriptTypes(source.slice(start, end)), context);
context.payload = {requestId: 'audit', kind: 'progress', event: {
  error: 'query cannot be empty', stage: 'EXECUTION_STAGE_FAILED', progress: 0,
}};
vm.runInContext('handleStreamEvent(payload)', context);
assert.equal(context.loomVerified, true);
assert.equal(finished.length, 0);
context.payload = {requestId: 'audit', kind: 'done'};
vm.runInContext('handleStreamEvent(payload)', context);
assert.equal(finished[0][2], 'done');
console.log('CONFIRMED: live-shaped failed progress marks Loom verified; EOF follows the done path');

const ws = source.indexOf('function handleWorkflowStreamEvent(');
const we = source.indexOf('\nasync function runWorkflowUnary', ws);
const calls = [];
const wc = vm.createContext({
  workflowStreamActive: 'audit-wf', workflowStreamState: {executionId:'audit-execution'},
  currentRunSeq: 1, selectedWorkId: 'work-selected-after-start', renderWorkDetail() {},
  finishWorkflowRun(...args) { calls.push(args); },
});
vm.runInContext(stripTypeScriptTypes(source.slice(ws, we)), wc);
vm.runInContext('handleWorkflowStreamEvent({requestId:"audit-wf",kind:"done"})', wc);
assert.equal(calls[0][1], 'work-selected-after-start');
console.log('CONFIRMED: workflow completion associates execution with work selected at completion');

const as = source.indexOf('async function searchArtifactsView(');
const ae = source.indexOf('/** Reload the global artifact list', as);
const pending = new Map();
const ac = vm.createContext({
  document: {querySelector() { return null; }}, artifacts: [],
  searchArtifacts(query) { return new Promise(resolve => pending.set(query, resolve)); },
  setLoomReachable() {}, renderArtifacts() {}, isLoomConnectionError() { return false; },
});
vm.runInContext(stripTypeScriptTypes(source.slice(as, ae)), ac);
const older = vm.runInContext('searchArtifactsView("older-query")', ac);
const newer = vm.runInContext('searchArtifactsView("newer-query")', ac);
pending.get('newer-query')([{id:'newer-result'}]);
await newer;
pending.get('older-query')([{id:'older-result'}]);
await older;
assert.equal(ac.artifacts[0].id, 'older-result');
console.log('CONFIRMED: a slow old artifact search overwrites the newer query results');
