import test from 'node:test';
import assert from 'node:assert/strict';
import {lessons,courseOrder} from '../dist/lessons.js';
import {norm,sub,dot,inverse,multiply,transpose,projection,kernel,eigen2,qr,lu,cholesky,svd2,truncatedSVD,I,Fraction,rowOperation,rref,classify,pca,datasets,fitLine} from '../dist/algebra.js';
import {det,rank,transform,validState} from '../dist/math.js';
import {validateAdvanced,missions,performAction} from '../dist/labs.js';
import {renderScene} from '../dist/scenes.js';
import {pythonFor} from '../dist/python-examples.js';
const close=(a,b,tol=1e-8)=>assert.ok(norm(sub(a,b))<tol,`${JSON.stringify(a)} differs from ${JSON.stringify(b)}`);
const valid=(id,s)=>['vectors','span','transformations'].includes(id)?validState(id,s):validateAdvanced(lessons[id],s);
test('the full course has 21 substantive lessons, 42 questions, challenges and ordered prerequisites',()=>{
 assert.equal(courseOrder.length,21);assert.equal(Object.keys(lessons).length,21);
 for(const [i,id] of courseOrder.entries()){
  const l=lessons[id];assert.ok(l.notes.length>700,id+' needs a substantive explanation');assert.equal(l.questions.length,2);
  assert.ok(l.intro&&l.experiment&&l.discovery&&l.prompt&&l.notesTitle&&l.time&&l.group&&missions[id]);
  for(const p of l.prereq)assert.ok(courseOrder.indexOf(p)<i,`${id} requires future lesson ${p}`);
  assert.ok(valid(id,l.initial),'Invalid initial state: '+id);
  const python=pythonFor(id,l,l.initial);assert.ok(python.includes('print(')&&!python.includes('sage.'),id);
 }
});
test('exact row arithmetic preserves thirds, halves, swaps, and reversible operations',()=>{
 assert.equal(String(Fraction.from('1/3').add('1/2')),'5/6');assert.equal(String(Fraction.from('-0.5')),'-1/2');
 assert.throws(()=>Fraction.from('1/0'));assert.throws(()=>rowOperation([['1','2','5'],['2','-1','0']],'scale',0,0,'0'));
 assert.throws(()=>rowOperation([['1','2','5'],['2','-1','0']],'add',0,0,'-1'));
 const input=[['1','2','5'],['2','-1','0']],next=rowOperation(input,'add',0,1,'-2');
 assert.deepEqual(next,[['1','2','5'],['0','-5','-10']]);assert.deepEqual(rowOperation(next,'add',0,1,'2'),input);
 const result=rref(input);assert.deepEqual(result.rows,[['1','0','1'],['0','1','2']]);assert.deepEqual(rref(result.rows).rows,result.rows);
 const thirds=rref([['3','0','1'],['0','2','1']]);assert.deepEqual(thirds.rows,[['1','0','1/3'],['0','1','1/2']]);
});
test('solution classification covers unique, inconsistent, coincident and degenerate constraints',()=>{
 assert.equal(classify([[1,1,3],[1,-1,1]]).type,'unique');
 assert.equal(classify([[1,1,2],[2,2,4]]).type,'infinite');
 assert.equal(classify([[1,1,2],[2,2,3]]).type,'none');
 assert.equal(classify([[0,0,0],[0,0,0]]).rank,0);
 assert.equal(classify([[0,0,1],[0,0,0]]).type,'none');
 assert.deepEqual(classify([[0,2,4],[1,0,3]]).solution,['3','2']);
});
test('QR, pivoted LU, SVD, eigenvectors and kernels satisfy their identities for all small integer matrices',()=>{
 for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++)for(let c=-2;c<=2;c++)for(let d=-2;d<=2;d++){
  const m=[a,b,c,d],q=qr(m),l=lu(m),s=svd2(m);
  close(multiply(q.Q,q.R),m);close(multiply(transpose(q.Q),q.Q),I);
  close(multiply(l.P,m),multiply(l.L,l.U));
  close(multiply(multiply(s.U,[s.s[0],0,0,s.s[1]]),s.Vt),m);
  close(multiply(transpose(s.U),s.U),I,1e-7);close(multiply(s.Vt,s.V),I);
  assert.ok(s.s[0]+1e-8>=s.s[1]&&s.s[1]>=0);
  const truncated=truncatedSVD(m,1);assert.ok(Math.abs(norm(sub(m,truncated.approx))-truncated.error)<1e-7);
  for(const v of kernel(m))close(transform(m,v),[0,0]);
  assert.equal(kernel(m).length+rank(m),2);
  const e=eigen2(m);if(!e.complex)e.vectors.forEach((v,i)=>close(transform(m,v),v.map(x=>x*e.values[i])));
 }
});
test('Cholesky enforces its assumptions and reconstructs a valid matrix',()=>{
 const m=[2,1,1,2],L=cholesky(m);assert.ok(L);close(multiply(L,transpose(L)),m);
 assert.equal(cholesky([1,2,0,1]),null);assert.equal(cholesky([0,1,1,0]),null);assert.equal(cholesky([0,0,0,0]),null);
});
test('orthogonal projection handles zero and gives a perpendicular residual',()=>{
 const u=[3,1],v=[1,1],p=projection(u,v);close(p,[2,2]);assert.equal(dot(sub(u,p),v),0);
 close(projection(u,[0,0]),[0,0]);
 close(projection(p,v),p);
});
test('least squares minimizes the five-point residual and PCA centers the data',()=>{
 const fit=fitLine([-1,0,1,2,2]);assert.equal(fit.slope,.8);assert.equal(fit.intercept,.8);
 const a=pca(datasets.offset,true);close(a.data.reduce((s,p)=>[s[0]+p[0],s[1]+p[1]],[0,0]),[0,0]);
 const tied=pca(datasets.isotropic,true);assert.ok(Math.abs(tied.values[0]-tied.values[1])<1e-9);
 assert.ok(norm(sub(pca(datasets.offset,false).covariance,a.covariance))>1);
});
test('all non-pilot scenes produce finite, accessible results, including degenerate and unsupported cases',()=>{
 for(const [id,l] of Object.entries(lessons)){
  if(['vectors','span','transformations'].includes(id))continue;
  const states=[structuredClone(l.initial)];
  if(l.initial.m)states.push({...structuredClone(l.initial),m:[0,0,0,0]});
  if(l.lab==='decomposition')for(const method of ['qr','lu','cholesky','eigen'])for(const m of [[0,0,0,0],[0,1,1,0],[0,-1,1,0],[1,1,0,1]])states.push({...structuredClone(l.initial),method,m});
  if(l.lab==='coordinates')states.push({...structuredClone(l.initial),u:[0,0],v:[0,0]});
  if(l.lab==='projection'||l.lab==='orthogonal')states.push({u:[0,0],v:[0,0]});
  if(l.lab==='closure')for(const family of ['line','offset','parabola'])states.push({...l.initial,family});
  if(l.lab==='matrixspace')for(const family of ['symmetric','skew','traceless'])states.push({...l.initial,family});
  if(l.lab==='pca')for(const dataset of Object.keys(datasets))for(const center of [0,1])for(const k of [1,2])states.push({...l.initial,dataset,center,k});
  for(const s of states){
   assert.ok(valid(id,s),id);const scene=renderScene(id,l,s);
   assert.ok(scene.svg.includes('graph-description'),id);
   assert.ok(!/NaN|Infinity|="undefined"/.test(scene.svg),id+': nonfinite diagram');
   assert.ok(scene.description.length>10&&scene.equation.length>0,id);
  }
 }
});
test('experiment checks accept valid witnesses for all 21 lessons',()=>{
 const samples=Object.fromEntries(Object.entries(lessons).map(([id,l])=>[id,structuredClone(l.initial)]));
 Object.assign(samples.vectors,{u:[1,0],v:[0,1],a:2,b:3});samples.matrices.operation='ba';samples.transformations.m=[-1,0,0,1];
 Object.assign(samples.span,{u:[1,0],v:[0,1],a:2,b:1});samples.dependence.w=[2,-1];samples.basis.v=[1,1];
 samples.elimination.rows=rref(samples.elimination.rows).rows;Object.assign(samples.solutions,{m:[1,1,2,2],b:[2,3]});
 samples['vector-spaces'].family='offset';Object.assign(samples.subspaces,{family:'parabola',a:1,c:2});
 Object.assign(samples['matrix-spaces'],{a:1,b:1,c:-1});samples.nullspace.u=[-2,1];samples.orthogonality.v=[-1,2];
 Object.assign(samples.projections,{u:[1,-1],v:[1,1]});performAction('best-fit',lessons['least-squares'],samples['least-squares']);
 samples.determinants.m=[-2,0,0,1];samples.eigenvalues.angle=45;samples.decompositions.method='cholesky';samples.svd.k=1;
 performAction('best-pca',lessons.applications,samples.applications);
 for(const [id,s] of Object.entries(samples)){assert.ok(valid(id,s),id+' witness state');assert.equal(missions[id].check(s),true,id+' rejected a correct experiment');}
});
test('saved advanced state rejects invalid enums, nonfinite numbers and corrupt exact rows',()=>{
 assert.equal(validateAdvanced(lessons.svd,{...lessons.svd.initial,k:5}),false);
 assert.equal(validateAdvanced(lessons.applications,{...lessons.applications.initial,dataset:'evil'}),false);
 assert.equal(validateAdvanced(lessons.eigenvalues,{...lessons.eigenvalues.initial,m:[1,0,NaN,1]}),false);
 assert.equal(validateAdvanced(lessons.elimination,{rows:[['1','0','1/0'],['0','1','0']],history:[]}),false);
});
