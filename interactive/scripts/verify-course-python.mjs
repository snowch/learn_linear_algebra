import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {lessons} from '../dist/lessons.js';
import {pythonFor} from '../dist/python-examples.js';
const runtimeRoot=process.argv[2];
if(!runtimeRoot)throw new Error('Usage: node scripts/verify-course-python.mjs /absolute/path/to/pyodide-runtime');
const require=createRequire(import.meta.url),{loadPyodide}=require(path.join(runtimeRoot,'pyodide.js'));
let messages=[],initialized;
const readyEvent=new Promise((resolve,reject)=>initialized={resolve,reject});
const sandbox={self:{},console,postMessage:message=>{messages.push(message);if(message.type==='ready')initialized.resolve();if(message.type==='init-error')initialized.reject(new Error(message.text));}};
sandbox.importScripts=()=>sandbox.loadPyodide=options=>loadPyodide({...options,indexURL:runtimeRoot+'/'});
vm.createContext(sandbox);vm.runInContext(readFileSync(new URL('../dist/python-worker.js',import.meta.url),'utf8'),sandbox);
await sandbox.self.onmessage({data:{type:'init'}});await readyEvent;
const cases=Object.entries(lessons).map(([id,lesson])=>({id,lesson,state:structuredClone(lesson.initial),name:id+' default'}));
function add(id,changes,label){cases.push({id,lesson:lessons[id],state:{...structuredClone(lessons[id].initial),...changes},name:id+' '+label});}
for(const method of ['qr','lu','cholesky','eigen'])for(const m of [[0,0,0,0],[0,1,2,3],[0,-1,1,0],[1,1,0,1]])add('decompositions',{method,m},method+' '+m);
for(const family of ['skew','traceless'])add('matrix-spaces',{family},family);
for(const family of ['offset','parabola'])add('vector-spaces',{family},family);
for(const m of [[0,0,0,0],[1,0,0,1],[-1,-2,-1,-2]])add('homogeneous',{m},'rank/sign edge '+m);
add('solutions',{m:[1,1,2,2],b:[2,3]},'inconsistent');add('solutions',{m:[0,0,0,0],b:[0,0]},'unconstrained');
add('basis',{u:[0,0],v:[0,0]},'no basis');add('projections',{v:[0,0]},'zero subspace');
for(const k of [0,1,2])for(const m of [[0,0,0,0],[1,2,1,2],[-2,0,0,1]])add('svd',{k,m},'rank '+k+' '+m);
add('eigenvalues',{m:[0,-1,1,0]},'complex eigenvalues');add('applications',{center:0},'uncentered');add('applications',{dataset:'isotropic',k:2},'equal variances');
for(const sample of cases){
 messages=[];
 await sandbox.self.onmessage({data:{type:'run',code:pythonFor(sample.id,sample.lesson,sample.state)}});
 const errors=messages.filter(m=>m.type==='error'||m.type==='init-error');
 assert.deepEqual(errors,[],sample.name);assert.ok(messages.some(m=>m.type==='done'),sample.name+' did not finish');
}
messages=[];
await sandbox.self.onmessage({data:{type:'run',code:`from sympy import Matrix, Rational
import numpy as np
assert Matrix([[3,0],[0,2]]).inv()*Matrix([1,1]) == Matrix([Rational(1,3), Rational(1,2)])
A = np.array([[3., 1.], [0., 1.]])
U, s, Vh = np.linalg.svd(A)
assert np.allclose(A, U @ np.diag(s) @ Vh)
assert np.isclose(np.linalg.norm(A - U[:, :1] @ np.diag(s[:1]) @ Vh[:1]), s[1])
X = np.array([[0.,0.], [1.,1.], [2.,1.], [3.,2.], [4.,4.]])
X -= X.mean(axis=0)
assert np.allclose(X.mean(axis=0), 0)
_, s, Vh = np.linalg.svd(X, full_matrices=False)
C = X.T @ X / (len(X)-1)
assert np.allclose(np.linalg.eigvalsh(C)[::-1], s*s/(len(X)-1))
print('cross-library mathematical assertions passed')`}});
assert.deepEqual(messages.filter(m=>m.type==='error'),[]);
console.log(`PASS: all ${Object.keys(lessons).length} generated lesson examples and ${cases.length-Object.keys(lessons).length} edge cases executed through the real Pyodide worker; SymPy/NumPy reconstruction, exact fractions and PCA variance identities verified.`);
