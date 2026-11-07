const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const runtimeRoot=process.argv[2];
if(!runtimeRoot)throw new Error('Usage: node scripts/verify-python.cjs /absolute/path/to/pyodide-runtime');
const {loadPyodide}=require(path.join(runtimeRoot,'pyodide.js'));
const messages=[];
let initialized;
const readyEvent=new Promise((resolve,reject)=>initialized={resolve,reject});
const sandbox={self:{},console,postMessage:message=>{messages.push(message);if(message.type==='ready')initialized.resolve();if(message.type==='init-error')initialized.reject(new Error(message.text));}};
sandbox.importScripts=()=>{sandbox.loadPyodide=options=>loadPyodide({...options,indexURL:runtimeRoot+'/'});};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/python-worker.js'),'utf8'),sandbox);
(async()=>{
  await sandbox.self.onmessage({data:{type:'init'}});
  await readyEvent;
  assert.ok(messages.some(m=>m.type==='ready'),'Wasm runtime should start');
  const code=`from sympy import Matrix, Rational
v1 = Matrix([1, 2])
v2 = Matrix([2, 0])
a, b = -2, Rational('0.5')
assert a*v1 + b*v2 == Matrix([-1, -4])
A = Matrix.hstack(Matrix([1, 1]), Matrix([2, 2]))
assert A.rank() == 1
assert A*A.nullspace()[0] == Matrix([0, 0])
A = Matrix([[1, 1], [0, 1]])
assert A*Matrix([0, 1]) == Matrix([1, 1])
assert A.det() == 1
print('PASS: exact fractions, vector combinations, span rank, nullspace coefficients, and matrix transformations in Python WebAssembly.')`;
  await sandbox.self.onmessage({data:{type:'run',code}});
  const errors=messages.filter(m=>m.type.endsWith('error'));
  assert.deepEqual(errors,[]);
  assert.ok(messages.some(m=>m.type==='done'));
  for(const m of messages)if(m.type==='stdout'&&m.text.startsWith('PASS:'))console.log(m.text);
  console.log('PASS: actual app worker initialization, package loading, output forwarding and completion.');
})().catch(error=>{console.error(error);process.exitCode=1});
