import test from 'node:test';
import assert from 'node:assert/strict';
import {combine,det,rank,transform,presets,validState,defaults} from '../dist/math.js';
import {lessons} from '../dist/lessons.js';
test('negative coefficients reverse both coordinates',()=>assert.deepEqual(combine(-2,[1,2],0,[0,0]),[-2,-4]));
test('the transfer exercise scales before adding',()=>assert.deepEqual(combine(1,[2,1],2,[-1,3]),[0,7]));
test('parallel vectors cannot reach a point with unequal coordinates',()=>{
  for(let a=-3;a<=3;a+=.5)for(let b=-3;b<=3;b+=.5){const v=combine(a,[1,1],b,[2,2]);assert.equal(v[0],v[1]);}
  assert.equal(rank([1,2,1,2]),1);
});
test('independent pair reaches a target; zero pair spans only the origin',()=>{
  assert.deepEqual(combine(2,[1,0],1,[0,1]),[2,1]);
  assert.equal(rank([1,0,0,1]),2);assert.equal(rank([0,0,0,0]),0);
});
test('matrix columns are images of basis vectors',()=>{
  for(const m of Object.values(presets)){
    assert.deepEqual(transform(m,[1,0]),[m[0],m[2]]);
    assert.deepEqual(transform(m,[0,1]),[m[1],m[3]]);
  }
});
test('shear, rotation, reflection and collapse have the intended geometry',()=>{
  assert.deepEqual(transform(presets.shear,[0,1]),[1,1]);
  assert.deepEqual(transform(presets.rotate,[1,0]),[0,1]);
  assert.equal(det(presets.reflect),-1);
  assert.equal(Math.abs(det(presets.reflect)),1);
  assert.equal(rank(presets.collapse),1);
  for(let x=-3;x<=3;x++)for(let y=-3;y<=3;y++)assert.ok(transform(presets.collapse,[x,y])[1] === 0);
});
test('stored state is finite and within supported controls',()=>{
  for(const [id,state] of Object.entries(defaults))assert.ok(validState(id,state));
  assert.equal(validState('vectors',{u:[1,2],v:[1,0],a:NaN,b:1}),false);
  assert.equal(validState('span',{u:[0,0],v:[0,0],a:Infinity,b:0}),false);
  assert.equal(validState('transformations',{u:[0,0],m:[1,0,0,100]}),false);
});
test('every practice question has matching answer feedback',()=>{
  for(const l of Object.values(lessons))for(const q of l.questions){
    assert.equal(q.options.length,q.feedback.length);assert.ok(q.correct>=0&&q.correct<q.options.length);assert.ok(q.hint);
  }
});
