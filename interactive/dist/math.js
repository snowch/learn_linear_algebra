export const add = (u, v) => u.map((x, i) => x + v[i]);
export const scale = (a, v) => v.map(x => a * x);
export const combine = (a, u, b, v) => add(scale(a, u), scale(b, v));
export const det = m => m[0] * m[3] - m[1] * m[2];
export const transform = (m, v) => [m[0] * v[0] + m[1] * v[1], m[2] * v[0] + m[3] * v[1]];
export const rank = m => Math.abs(det(m)) > 1e-9 ? 2 : m.some(x => Math.abs(x) > 1e-9) ? 1 : 0;
export const fmt = n => String(Number(n.toFixed(3)));
export const vec = v => `(${v.map(fmt).join(', ')})`;
export const presets = {identity:[1,0,0,1],stretch:[2,0,0,1],shear:[1,1,0,1],rotate:[0,-1,1,0],reflect:[-1,0,0,1],collapse:[1,2,0,0]};
export const defaults = {vectors:{u:[1,2],v:[2,0],a:1,b:1},span:{u:[1,1],v:[2,2],a:1,b:0},transformations:{u:[1,1],m:[1,1,0,1]}};
export function validState(id, s) {
  const bounded = (v, n, limit) => Array.isArray(v) && v.length === n && v.every(x=>Number.isFinite(x) && Math.abs(x)<=limit && Number.isInteger(x*2));
  if(!s || !bounded(s.u,2,3)) return false;
  if(id==='transformations') return bounded(s.m,4,3);
  return bounded(s.v,2,3) && Number.isFinite(s.a) && Number.isFinite(s.b) && Math.abs(s.a)<=3 && Math.abs(s.b)<=3 && Number.isInteger(s.a*2) && Number.isInteger(s.b*2);
}
