import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {lessons,courseOrder} from '../dist/lessons.js';
if(!process.argv[2])throw new Error('Usage: node scripts/verify-dom.mjs /absolute/path/to/linkedom-worker.mjs');
const {parseHTML,HTMLInputElement,HTMLSelectElement,HTMLElement}=await import(pathToFileURL(process.argv[2]));
Object.defineProperty(HTMLInputElement.prototype,'checked',{get(){return this.hasAttribute('checked')},set(v){if(v){if(this.type==='radio')globalThis.document.querySelectorAll(`input[name="${this.name}"]`).forEach(x=>x.removeAttribute('checked'));this.setAttribute('checked','')}else this.removeAttribute('checked')}});
Object.defineProperty(HTMLInputElement.prototype,'valueAsNumber',{get(){return this.value===''?NaN:Number(this.value)}});
Object.defineProperty(HTMLSelectElement.prototype,'value',{get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||''},set(v){this.querySelectorAll('option').forEach(x=>{if(x.value===String(v))x.setAttribute('selected','');else x.removeAttribute('selected')})}});
HTMLElement.prototype.focus=function(){};
HTMLInputElement.prototype.setCustomValidity=function(s){this.validationMessage=s};
HTMLInputElement.prototype.reportValidity=function(){};
HTMLInputElement.prototype.checkValidity=function(){return !this.validationMessage};
const storage=new Map([['basis-lab-v1',JSON.stringify({states:{vectors:lessons.vectors.initial},progress:{vectors:[0,1]},codes:{vectors:"print('my old code')"},current:'vectors'})]]);
let listeners,domWindow,loc,download;
class FakeWorker {constructor(){FakeWorker.last=this;FakeWorker.count=(FakeWorker.count||0)+1}postMessage(data){this.lastMessage=data;this.messages=(this.messages||[]).concat(data)}terminate(){this.terminated=true}}
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
async function setup(suffix=''){
 const {document,window}=parseHTML(html);domWindow=window;listeners={};let hash='';loc={};Object.defineProperty(loc,'hash',{get:()=>hash,set:value=>{hash=value?String(value).startsWith('#')?String(value):'#'+value:'';}});
 Object.assign(globalThis,{document,window:{addEventListener:(key,fn)=>listeners[key]=fn,scrollTo:()=>{}},location:loc,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},Worker:FakeWorker});
 await import(new URL('../dist/app.js'+suffix,import.meta.url));
}
await setup();
const $=s=>document.querySelector(s),event=name=>new domWindow.Event(name,{bubbles:true,cancelable:true});
const navigate=id=>{loc.hash='#'+id;listeners.hashchange()};
function input(selector,value){const el=$(selector);assert.ok(el,'Missing control '+selector);el.value=String(value);el.dispatchEvent(event('input'));assert.ok(!el.validationMessage,el.validationMessage);}
function select(selector,value){const el=$(selector);assert.ok(el,'Missing selector '+selector);el.value=value;el.dispatchEvent(event('change'));}
const setVector=(field,value)=>value.forEach((n,i)=>input(`[data-field="${field}"][data-index="${i}"]`,n));
const setArray=(key,value)=>value.forEach((n,i)=>input(`[data-key="${key}"][data-array-index="${i}"]`,n));
assert.match($('#progress-text').textContent,/1 \/ 21/,'old pilot completion must migrate');
assert.equal(document.querySelectorAll('[data-lesson]').length,21);
assert.equal(FakeWorker.count||0,0,'No Python download before the panel is opened');
for(const id of courseOrder){
 navigate(id);
 assert.equal($('#breadcrumb').textContent,lessons[id].name);
 assert.ok($('#graph-description').textContent.length>10,id+' diagram lacks description');
 assert.equal(document.querySelectorAll('[data-question]').length,2);
 $('#tab-notes').click();assert.equal($('#panel-notes').hidden,false);assert.ok($('#notes-body').textContent.length>300,id+' lacks notes');
 $('#tab-explore').click();
 if(id==='vectors'){setVector('u',[1,0]);setVector('v',[0,1]);input('#coefficient-a',2);input('#coefficient-b',3);}
 if(id==='matrices')select('[data-key="operation"]','ba');
 if(id==='transformations')select('#preset','reflect');
 if(id==='span'){select('#preset','independent');input('#coefficient-a',2);input('#coefficient-b',1);}
 if(id==='elimination'){
  $('#row-factor').value='0';select('[data-key="rowOp"]','scale');$('[data-lab-action="apply-row"]').click();assert.match($('#row-operation-status').textContent,/zero/);
  $('#reset').click();const before=$('#graph-text').textContent;$('[data-lab-action="apply-row"]').click();assert.notEqual($('#graph-text').textContent,before);
  $('[data-lab-action="undo-row"]').click();assert.equal($('#graph-text').textContent,before);
  for(let i=0;i<8;i++)$('[data-lab-action="next-row"]').click();
 }
 if(id==='solutions')select('[data-key="systemPreset"]','none');
 if(id==='vector-spaces')select('[data-key="family"]','offset');
 if(id==='dependence')setArray('w',[2,-1]);
 if(id==='basis')setArray('v',[1,1]);
 if(id==='subspaces'){select('[data-key="family"]','parabola');input('[data-key="a"]',1);input('[data-key="c"]',2);}
 if(id==='matrix-spaces')input('[data-key="c"]',-1);
 if(id==='nullspace')setArray('u',[-2,1]);
 if(id==='orthogonality')setArray('v',[-1,2]);
 if(id==='projections'){setArray('u',[1,-1]);setArray('v',[1,1]);}
 if(id==='least-squares')$('[data-lab-action="best-fit"]').click();
 if(id==='determinants')setArray('m',[-2,0,0,1]);
 if(id==='eigenvalues')input('[data-key="angle"]',45);
 if(id==='decompositions')select('[data-key="method"]','cholesky');
 if(id==='svd')input('[data-key="k"]',1);
 if(id==='applications')$('[data-lab-action="best-pca"]').click();
 $('#check-mission').click();assert.match($('#mission-feedback').textContent,/^✓/,id+' challenge rejected: '+$('#mission-feedback').textContent);
 $('#go-practice').click();assert.equal($('#panel-practice').hidden,false);
 for(const form of document.querySelectorAll('[data-question]')){
  form.querySelector('[value="1"]').checked=true;form.dispatchEvent(event('submit'));assert.ok(form.querySelector('.feedback').classList.contains('incorrect'),id+' missing diagnostic feedback');
  form.querySelector('[data-hint]').click();assert.ok(form.querySelector('.feedback').textContent.length>10);
  form.querySelector('[value="0"]').checked=true;form.dispatchEvent(event('submit'));
 }
 assert.match($('#practice-status').textContent,/Lesson complete/,id);
}
assert.match($('#progress-text').textContent,/21 \/ 21/);assert.equal($('#course-complete').hidden,false);
assert.equal(FakeWorker.count||0,0,'The entire course can be completed without initializing Python');
$('#lesson-search').value='svd';$('#lesson-search').dispatchEvent(event('input'));assert.equal($('[data-lesson="svd"]').hidden,false);assert.equal($('[data-lesson="vectors"]').hidden,true);
$('#lesson-search').value='nothing matches this';$('#lesson-search').dispatchEvent(event('input'));assert.equal($('#lessons-empty').hidden,false);
$('#lesson-search').value='';$('#lesson-search').dispatchEvent(event('input'));assert.equal($('#lessons-empty').hidden,true);
$('#quick-reference').click();assert.ok($('#reference-dialog').hasAttribute('open'));assert.ok($('#reference-body').textContent.includes('Rank–nullity'));$('#close-reference').click();assert.equal($('#reference-dialog').hasAttribute('open'),false);
select('#lesson-select','elimination');listeners.hashchange();assert.equal($('#breadcrumb').textContent,lessons.elimination.name);
$('#previous-lesson').click();listeners.hashchange();assert.equal($('#breadcrumb').textContent,lessons.span.name);
$('#next-bottom').click();listeners.hashchange();assert.equal($('#breadcrumb').textContent,lessons.elimination.name);
// The code panel follows current values, preserves edits, and never runs on navigation/import.
$('#python-toggle').click();FakeWorker.last.onmessage({data:{type:'ready'}});
for(const id of courseOrder){navigate(id);if(id!=='vectors')assert.equal($('#python-code').value,(await import('../dist/python-examples.js')).pythonFor(id,lessons[id],JSON.parse(storage.get('basis-lab-v1')).states[id]));}
navigate('vectors');assert.equal($('#python-code').value,"print('my old code')");$('#restore-python').click();assert.match($('#python-code').value,/Matrix/);
$('#run-python').click();assert.equal(FakeWorker.last.lastMessage.type,'run');FakeWorker.last.onmessage({data:{type:'stdout',text:'PASS'}});FakeWorker.last.onmessage({data:{type:'done'}});assert.match($('#python-output').textContent,/PASS/);
$('#stop-python').click();assert.equal(FakeWorker.last.terminated,true);
const originalCreate=URL.createObjectURL;URL.createObjectURL=blob=>{download=blob;return 'blob:test'};URL.revokeObjectURL=()=>{};
$('[data-export]').click();const exported=JSON.parse(await download.text());assert.equal(exported.format,'basis-lab-v1');assert.equal(Object.values(exported.missions).filter(Boolean).length,21);URL.createObjectURL=originalCreate;
const importFile=$('#import-file');const fakeFile={size:100,text:async()=>JSON.stringify({format:'basis-lab-v1',states:{svd:{m:[NaN,0,0,1],k:2,stage:3}},codes:{svd:"print('imported code')"}})};
Object.defineProperty(importFile,'files',{configurable:true,value:[fakeFile]});importFile.dispatchEvent(event('change'));await new Promise(setImmediate);assert.match($('#import-status').textContent,/imported and merged/);
assert.equal(FakeWorker.last.lastMessage.type,'run','Import must not dispatch any Python execution');
Object.defineProperty(importFile,'files',{configurable:true,value:[{size:10,text:async()=>'not json'}]});importFile.dispatchEvent(event('change'));await new Promise(setImmediate);assert.match($('#import-status').textContent,/Import failed/);
await setup('?reload-check');assert.match($('#progress-text').textContent,/21 \/ 21/);assert.equal($('#course-complete').hidden,false);
console.log('PASS: all 21 lessons, 21 experiment challenges, 42 diagnostic questions, exact row operations/undo, old-progress migration, search, mobile selection, previous/next navigation, quick reference, code restoration, worker controls, import/export, and reload persistence.');
