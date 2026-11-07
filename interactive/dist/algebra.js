// Small real-matrix routines for the visual lessons; exact fractions for row operations.
import {det,rank,transform,scale,add} from './math.js';
export const EPS=1e-9;
export const dot=(u,v)=>u.reduce((sum,x,i)=>sum+x*v[i],0);
export const norm=v=>Math.hypot(...v);
export const sub=(u,v)=>u.map((x,i)=>x-v[i]);
export const transpose=m=>[m[0],m[2],m[1],m[3]];
export const multiply=(a,b)=>[a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3]];
export const inverse=m=>Math.abs(det(m))<EPS?null:scale(1/det(m),[m[3],-m[1],-m[2],m[0]]);
export const coordinates=(m,w)=>inverse(m)?transform(inverse(m),w):null;
export const projection=(u,v)=>norm(v)<EPS?[0,0]:scale(dot(u,v)/dot(v,v),v);
export const I=[1,0,0,1];
export const frobenius=m=>norm(m);
export function kernel(m){
 const r=rank(m);if(r===2)return [];
 if(r===0)return [[1,0],[0,1]];
 const row=norm(m.slice(0,2))>=norm(m.slice(2))?m.slice(0,2):m.slice(2);
 return [[-row[1],row[0]].map(x=>x/norm(row))];
}
export function eigen2(m){
 const trace=m[0]+m[3],disc=trace*trace-4*det(m);
 if(disc < -EPS)return {complex:true,real:trace/2,imag:Math.sqrt(-disc)/2,values:[],vectors:[]};
 const root=Math.sqrt(Math.max(0,disc));
 const values=root<EPS?[trace/2]:[(trace+root)/2,(trace-root)/2];
 const scalar=Math.abs(m[1])+Math.abs(m[2])+Math.abs(m[0]-m[3])<EPS;
 if(scalar)return {values:[m[0],m[0]],vectors:[[1,0],[0,1]],scalar:true};
 const vectors=values.map(value=>{
  const rows=[[m[0]-value,m[1]],[m[2],m[3]-value]];
  const row=norm(rows[0])>=norm(rows[1])?rows[0]:rows[1];
  let v=[-row[1],row[0]].map(x=>x/norm(row));
  if(v[0]<-EPS||(Math.abs(v[0])<EPS&&v[1]<0))v=scale(-1,v);
  return v;
 });
 return {values,vectors,scalar:false};
}
export function svd2(m){
 const ata=multiply(transpose(m),m),e=eigen2(ata);
 const s=[Math.sqrt(Math.max(0,e.values[0]||0)),Math.sqrt(Math.max(0,e.values[1]??e.values[0]??0))];
 const v1=e.vectors[0]||[1,0],v2=[-v1[1],v1[0]];
 const V=[v1[0],v2[0],v1[1],v2[1]];
 const u1=s[0]>EPS?scale(1/s[0],transform(m,v1)):[1,0];
 const u2=s[1]>EPS?scale(1/s[1],transform(m,v2)):[-u1[1],u1[0]];
 return {U:[u1[0],u2[0],u1[1],u2[1]],s,V,Vt:transpose(V)};
}
export function truncatedSVD(m,k){const d=svd2(m);return {...d,approx:multiply(multiply(d.U,[k>0?d.s[0]:0,0,0,k>1?d.s[1]:0]),d.Vt),error:Math.hypot(...d.s.slice(k))};}
export function qr(m){
 const a=[m[0],m[2]],b=[m[1],m[3]],length=norm(a);
 const q1=length>EPS?scale(1/length,a):[1,0],q2=[-q1[1],q1[0]];
 return {Q:[q1[0],q2[0],q1[1],q2[1]],R:[length,dot(q1,b),0,dot(q2,b)]};
}
export function lu(m){
 let P=[...I],a=[...m];
 if(Math.abs(a[0])<Math.abs(a[2])){P=[0,1,1,0];a=multiply(P,a);}
 const factor=Math.abs(a[0])>EPS?a[2]/a[0]:0;
 return {P,L:[1,0,factor,1],U:[a[0],a[1],0,a[3]-factor*a[1]]};
}
export function cholesky(m){
 if(Math.abs(m[1]-m[2])>EPS||m[0]<=EPS||det(m)<=EPS)return null;
 const l=Math.sqrt(m[0]);return [l,0,m[2]/l,Math.sqrt(m[3]-m[2]*m[2]/m[0])];
}
export function fitLine(ys){
 const xs=ys.map((_,i)=>i-2),mean=ys.reduce((a,b)=>a+b,0)/ys.length;
 const slope=dot(xs,ys)/dot(xs,xs);return {slope,intercept:mean};
}
export const datasets={tilted:[[0,0],[1,1],[2,1],[3,2],[4,4]],offset:[[3,2],[4,2],[5,3],[6,4],[4,3],[5,4]],isotropic:[[1,0],[0,1],[-1,0],[0,-1]]};
export function pca(points,center=true){
 const mean=[0,1].map(j=>points.reduce((s,p)=>s+p[j],0)/points.length);
 const data=points.map(p=>center?sub(p,mean):[...p]);
 const moment=[0,0,0,0];for(const p of data){moment[0]+=p[0]*p[0];moment[1]+=p[0]*p[1];moment[2]+=p[1]*p[0];moment[3]+=p[1]*p[1];}
 const covariance=scale(1/Math.max(1,points.length-1),moment);
 const e=eigen2(covariance);return {data,mean,covariance,...e};
}
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){[a,b]=[b,a%b]}return a||1n;};
export class Fraction{
 constructor(n,d=1n){n=BigInt(n);d=BigInt(d);if(!d)throw new Error('A denominator cannot be zero.');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);this.n=n/g;this.d=d/g;if(this.n.toString().length+this.d.toString().length>80)throw new Error('Values are too large. Undo or reset and try smaller factors.');}
 static from(value){if(value instanceof Fraction)return value;const s=String(value).trim();if(s.length>90||!/^[-+]?\d+(?:\/[-+]?\d+|\.\d+)?$/.test(s))throw new Error('Use an integer, decimal, or fraction such as −1/2 (with a normal minus sign).');if(s.includes('/')){const [n,d]=s.split('/');return new Fraction(n,d);}if(s.includes('.')){const [a,b]=s.split('.');return new Fraction(BigInt(a+b),10n**BigInt(b.length));}return new Fraction(s);}
 add(x){x=Fraction.from(x);return new Fraction(this.n*x.d+x.n*this.d,this.d*x.d)}
 neg(){return new Fraction(-this.n,this.d)}
 mul(x){x=Fraction.from(x);return new Fraction(this.n*x.n,this.d*x.d)}
 div(x){x=Fraction.from(x);return new Fraction(this.n*x.d,this.d*x.n)}
 get zero(){return this.n===0n}
 toString(){return this.d===1n?String(this.n):`${this.n}/${this.d}`}
 valueOf(){return Number(this.n)/Number(this.d)}
}
export function rowOperation(rows,op,source,target,factor='1'){
 const a=rows.map(row=>row.map(Fraction.from));
 if(![0,1].includes(source)||![0,1].includes(target))throw new Error('Choose row 1 or row 2.');
 if(op==='swap'){[a[0],a[1]]=[a[1],a[0]];}
 else if(op==='scale'){
  const f=Fraction.from(factor);if(f.zero)throw new Error('Scaling by zero loses an equation. Use a nonzero factor.');a[target]=a[target].map(x=>x.mul(f));
 }else if(op==='add'){
  if(source===target)throw new Error('Choose two different rows for row addition.');
  const f=Fraction.from(factor);a[target]=a[target].map((x,i)=>x.add(a[source][i].mul(f)));
 }else throw new Error('Choose a valid row operation.');
 return a.map(row=>row.map(String));
}
export function rref(rows){
 let a=rows.map(row=>row.map(x=>Fraction.from(x).toString())),pivotRow=0;const steps=[];
 const apply=(op,s,t,f,label)=>{a=rowOperation(a,op,s,t,f);steps.push({rows:structuredClone(a),label});};
 for(let col=0;col<3&&pivotRow<2;col++){
  const found=[pivotRow,1].find(r=>r>=pivotRow&&!Fraction.from(a[r][col]).zero);
  if(found===undefined)continue;
  if(found!==pivotRow)apply('swap',found,pivotRow,'1','Swap R₁ and R₂');
  const pivot=Fraction.from(a[pivotRow][col]);
  if(String(pivot)!=='1')apply('scale',pivotRow,pivotRow,new Fraction(1n).div(pivot).toString(),`Scale R${pivotRow+1} by ${new Fraction(1n).div(pivot)}`);
  for(let row=0;row<2;row++)if(row!==pivotRow&&!Fraction.from(a[row][col]).zero){const f=Fraction.from(a[row][col]).neg().toString();apply('add',pivotRow,row,f,`R${row+1} ← R${row+1} + (${f})R${pivotRow+1}`);}
  pivotRow++;
 }
 return {rows:a,steps};
}
export function classify(rows){
 const reduced=rref(rows).rows;
 const inconsistent=reduced.some(row=>Fraction.from(row[0]).zero&&Fraction.from(row[1]).zero&&!Fraction.from(row[2]).zero);
 const pivots=reduced.filter(row=>!Fraction.from(row[0]).zero||!Fraction.from(row[1]).zero).length;
 if(inconsistent)return {type:'none',rank:pivots,reduced};
 if(pivots===2)return {type:'unique',rank:2,solution:[reduced[0][2],reduced[1][2]],reduced};
 return {type:'infinite',rank:pivots,reduced};
}
