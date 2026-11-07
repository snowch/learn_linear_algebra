import {fmt,vec,scale,transform,det,rank} from './math.js';
import {norm,dot,sub,inverse,multiply,transpose,projection,kernel,eigen2,qr,lu,cholesky,truncatedSVD,I,datasets,pca,fitLine,classify,rref,Fraction} from './algebra.js';
export const colors={teal:'#348a83',purple:'#9270ba',orange:'#ba6b3a',gray:'#9ba78f',green:'#76975a'};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const text=(x,y,s,color='#687c59',size=13,extra='')=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-family="system-ui,sans-serif" ${extra}>${escape(s)}</text>`;
const line=(a,b,color='#d7e1cd',width=1,extra='')=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
export function plot({extent=5,cx=320,cy=240,unit=205/extent,left=20,top=20,width=600,height=430,grid=true,id='main'}={}){
 let svg=`<defs><clipPath id="clip-${id}"><rect x="${left}" y="${top}" width="${width}" height="${height}"/></clipPath></defs><g clip-path="url(#clip-${id})">`;
 const point=v=>[cx+v[0]*unit,cy-v[1]*unit];
 if(grid)for(let i=-Math.ceil(extent*1.7);i<=extent*1.7;i++)svg+=line([cx+i*unit,top],[cx+i*unit,top+height],'#e8eddf',.8)+line([left,cy-i*unit],[left+width,cy-i*unit],'#e8eddf',.8);
 svg+=line([left,cy],[left+width,cy],'#b7c2a9')+line([cx,top],[cx,top+height],'#b7c2a9');
 const step=Math.max(1,Math.ceil(extent/5));
 for(let i=-Math.floor(extent);i<=extent;i++)if(i&&i%step===0){svg+=text(cx+i*unit,cy+15,i,'#99a68d',9,'text-anchor="middle"')+text(cx-8,cy-i*unit+3,i,'#99a68d',9,'text-anchor="end"');}
 svg+=text(cx-8,cy+14,'0','#99a68d',9,'text-anchor="end"');
 return {
  point,unit,
  add:s=>{svg+=s;},
  segment:(a,b,color='gray',dash=false,width=1.5)=>{svg+=line(point(a),point(b),colors[color]||color,width,dash?'stroke-dasharray="5 4"':'');},
  dot:(v,color='orange',label='',radius=4)=>{const [x,y]=point(v);svg+=`<circle cx="${x}" cy="${y}" r="${radius}" fill="${colors[color]||color}"/>`+(label?text(x+9,y-9,label,colors[color]||color,12):'');},
  arrow:(v,color='teal',label='',from=[0,0],dash=false)=>{
   const start=point(from),end=point([from[0]+v[0],from[1]+v[1]]),dx=end[0]-start[0],dy=end[1]-start[1],length=Math.hypot(dx,dy),c=colors[color]||color;
   if(length<.01){svg+=`<circle cx="${end[0]}" cy="${end[1]}" r="3" fill="${c}"/>`;return;}
   const ux=dx/length,uy=dy/length;
   svg+=line(start,end,c,dash?1.5:2.4,dash?'stroke-dasharray="5 4" opacity="0.8"':'')+`<path d="M${end[0]-ux*9-uy*4} ${end[1]-uy*9+ux*4} L${end[0]} ${end[1]} L${end[0]-ux*9+uy*4} ${end[1]-uy*9-ux*4}" fill="none" stroke="${c}" stroke-width="2"/>`+(label?text(end[0]+10,end[1]-10,label,c,12):'');
  },
  polygon:(vertices,color='#dfeccc')=>{svg+=`<polygon points="${vertices.map(v=>point(v).join(',')).join(' ')}" fill="${color}" fill-opacity="0.7" stroke="#85a46c" stroke-width="1.5"/>`;},
  fullLine:(normal,rhs,color='teal',dash=false)=>{
   const length=norm(normal);if(length<1e-10)return;
   const base=scale(rhs/(length*length),normal),direction=scale(extent*4/length,[-normal[1],normal[0]]);
   svg+=line(point(sub(base,direction)),point([base[0]+direction[0],base[1]+direction[1]]),colors[color]||color,2,dash?'stroke-dasharray="5 4"':'');
  },
  finish:()=>svg+'</g>'
 };
}
const extentFor=(points,min=5)=>Math.max(min,...points.flat().filter(Number.isFinite).map(x=>Math.abs(x)*1.3));
const matrixText=m=>`[[${m.slice(0,2).map(fmt).join(', ')}], [${m.slice(2).map(fmt).join(', ')}]]`;
function matrixAt(m,x,y,label,width=150){
 const vals=Array.isArray(m[0])?m:[m.slice(0,2),m.slice(2)],cols=vals[0].length;
 let s=text(x+width/2,y-22,label,'#5c7550',14,'text-anchor="middle"');
 s+=`<path d="M${x+8} ${y-3}h-8v89h8 M${x+width-8} ${y-3}h8v89h-8" fill="none" stroke="#90a77a" stroke-width="1.5"/>`;
 vals.forEach((row,i)=>row.forEach((value,j)=>{s+=text(x+(j+.5)*width/cols,y+24+i*43,typeof value==='number'?fmt(value):value,'#435d37',cols===3?16:19,'text-anchor="middle"');}));
 if(cols===3)s+=line([x+width*2/3,y+2],[x+width*2/3,y+80],'#c4d0b7');
 return s;
}
const result=(svg,description,equation,caption,legend=[])=>({svg:`<title id="graph-title">Interactive mathematical experiment</title><desc id="graph-description">${escape(description)}</desc>${svg}`,description,equation,caption,legend});
export function renderScene(id,lesson,s,grid=true){
 const mode=lesson.lab;
 if(mode==='arithmetic'){
  const products={ab:multiply(s.m,s.n),ba:multiply(s.n,s.m),add:s.m.map((v,i)=>v+s.n[i]),transpose:transpose(s.m)};
  const names={ab:'A × B',ba:'B × A',add:'A + B',transpose:'Aᵀ'},out=products[s.operation];
  let svg=matrixAt(s.m,80,80,'A',150)+matrixAt(s.n,400,80,'B',150)+text(320,120,s.operation==='add'?'+':s.operation==='transpose'?'→':'×','#8a9d77',26,'text-anchor="middle"');
  svg+=text(320,235,`${names[s.operation]} =`,'#8a9d77',15,'text-anchor="middle"')+matrixAt(out,220,290,'Result',200);
  const mismatch=norm(sub(products.ab,products.ba));
  return result(svg,`${names[s.operation]} = ${matrixText(out)}. Difference between AB and BA has Frobenius norm ${fmt(mismatch)}.`,names[s.operation]+' = '+matrixText(out),mismatch>1e-9?'For this pair, A × B ≠ B × A.':'These particular matrices commute; that does not hold for every pair.');
 }
 if(mode==='elimination'){
  const c=classify(s.rows),svg=matrixAt(s.rows,130,160,'Your current augmented matrix',380)+text(320,330,c.type==='unique'?`Solution: ${c.solution.join(', ')}`:c.type==='none'?'No solution: an inconsistent row':'Infinitely many solutions','#637c51',17,'text-anchor="middle"');
  const history=s.history.length?s.history.at(-1).label:'Start with a pivot in column 1.';
  return result(svg,`Rows: ${s.rows.map(r=>r.join(', ')).join('; ')}. ${history}`,c.type==='unique'?`(x, y) = (${c.solution.join(', ')})`:c.type==='none'?'No solution':'Infinitely many solutions',`${history} Exact fractions are preserved.`);
 }
 if(mode==='systems'){
  const rows=[[s.m[0],s.m[1],s.b[0]],[s.m[2],s.m[3],s.b[1]]],c=classify(rows),solution=c.solution?.map(x=>Number(Fraction.from(x)));
  const p=plot({extent:extentFor(solution?[solution]:[],5),grid});
  for(let i=0;i<2;i++)p.fullLine(s.m.slice(i*2,i*2+2),s.b[i],i?'purple':'teal');
  if(solution)p.dot(solution,'orange','solution');
  const degenerate=rows.map((row,i)=>row[0]===0&&row[1]===0?`Equation ${i+1}: ${row[2]===0?'no constraint':'impossible constraint'}.`:'').filter(Boolean).join(' ');
  const caption=(c.type==='unique'?'Both constraints meet at one point.':c.type==='none'?'No input satisfies every equation.':'Every point in the common solution set works.')+' '+degenerate;
  return result(p.finish(),`${c.type} solution set. ${caption}`,solution?`(x, y) = (${c.solution.join(', ')})`:c.type==='none'?'No solution':'Infinitely many solutions',caption,[['teal','Equation 1'],['purple','Equation 2'],['orange','Common solution']]);
 }
 if(mode==='closure'){
  const y=x=>s.family==='line'?x:s.family==='offset'?x+1:x*x;
  const u=[s.a,y(s.a)],v=[s.b,y(s.b)],sum=[u[0]+v[0],u[1]+v[1]],scaled=scale(s.c,u),contains=w=>Math.abs(w[1]-y(w[0]))<1e-8;
  const p=plot({extent:extentFor([u,v,sum,scaled],5),grid});
  let points=[];for(let x=-8;x<=8;x+=.05)points.push(p.point([x,y(x)]).join(','));p.add(`<polyline points="${points.join(' ')}" fill="none" stroke="#c5d8b0" stroke-width="6"/>`);
  p.dot(u,'teal','u');p.dot(v,'purple','v');p.dot(sum,'orange','u + v',5);p.arrow(scaled,'gray','c u',[0,0],true);
  const tests=`Zero: ${contains([0,0])?'inside':'outside'}. u + v: ${contains(sum)?'inside':'outside'}. c u: ${contains(scaled)?'inside':'outside'}.`;
  return result(p.finish(),`${tests} u = ${vec(u)}, v = ${vec(v)}, c = ${s.c}.`,s.family==='line'?'This set is a subspace':'This set is not a subspace',tests+' Sample successes alone do not prove closure.',[['teal','u'],['purple','v'],['orange','u + v'],['gray','c u']]);
 }
 if(mode==='coordinates'){
  const B=[s.u[0],s.v[0],s.u[1],s.v[1]],inv=inverse(B),c=inv?transform(inv,s.w):null,p=plot({extent:extentFor([s.u,s.v,s.w]),grid});
  p.arrow(s.u,'teal','u');p.arrow(s.v,'purple','v');p.arrow(s.w,'orange','w');
  if(c){const a=scale(c[0],s.u);p.arrow(a,'teal','',[0,0],true);p.arrow(scale(c[1],s.v),'purple','',a,true);}
  const cExact=classify([[B[0],B[1],s.w[0]],[B[2],B[3],s.w[1]]]);
  return result(p.finish(),c?`w has coordinates ${vec(c)} in the ordered basis (u, v).`:`Candidate pair has rank ${rank(B)}. The representation is ${cExact.type==='none'?'impossible':'nonunique'}.`,c?`w = ${fmt(c[0])} u + ${fmt(c[1])} v`:cExact.type==='none'?'Target is unreachable':'Coefficients are not unique',c?`${id==='dependence'?'The three-vector set is dependent.':'The pair is a basis of ℝ².'} Coordinates are unique in this pair.`:'The pair is dependent. It cannot serve as a basis of ℝ².',[['teal','First basis candidate'],['purple','Second basis candidate'],['orange','Target']]);
 }
 if(mode==='matrixspace'){
  const m=s.family==='symmetric'?[s.a,s.b,s.b,s.c]:s.family==='skew'?[0,-s.a,s.a,0]:[s.a,s.b,s.c,-s.a];
  const basis=s.family==='symmetric'?[[1,0,0,0],[0,1,1,0],[0,0,0,1]]:s.family==='skew'?[[0,-1,1,0]]:[[1,0,0,-1],[0,1,0,0],[0,0,1,0]];
  let svg=matrixAt(m,230,90,'Your matrix',180)+text(320,238,`${basis.length} independent parameter${basis.length===1?'':'s'}`,'#7c906a',14,'text-anchor="middle"');
  basis.forEach((b,i)=>svg+=matrixAt(b,basis.length===1?245:50+i*190,310,`Basis ${i+1}`,basis.length===1?150:140));
  return result(svg,`${s.family} matrix ${matrixText(m)}. Vector-space dimension ${basis.length}. Trace ${fmt(m[0]+m[3])}.`,`Dimension = ${basis.length}`,`Trace = ${fmt(m[0]+m[3])}. Matrix shape is 2 × 2; vector-space dimension is ${basis.length}.`);
 }
 if(mode==='homogeneous'){
  const basis=kernel(s.m),x=basis.length?scale(s.t,basis[0]):[0,0],second=basis[1]?scale(s.z,basis[1]):[0,0],input=[x[0]+second[0],x[1]+second[1]],p=plot({extent:extentFor([input]),grid});
  if(basis.length===2)p.add('<rect x="20" y="20" width="600" height="430" fill="#e6f0db" opacity="0.5"/>');
  if(basis.length===1)p.fullLine([basis[0][1],-basis[0][0]],0,'green');
  if(!basis.length)p.dot([0,0],'green','only solution');
  p.arrow(input,'orange','x');
  return result(p.finish(),`Rank ${rank(s.m)}, nullity ${basis.length}. Displayed solution x = ${vec(input)}, Ax = ${vec(transform(s.m,input))}.`,`x = ${vec(input)}`,`Rank ${rank(s.m)} + nullity ${basis.length} = 2 input dimensions.`,[['green','Homogeneous solution set'],['orange','One solution']]);
 }
 if(mode==='nullspace'){
  const basis=kernel(s.m),out=transform(s.m,s.u),extent=extentFor([s.u,out,[s.m[0],s.m[2]],[s.m[1],s.m[3]]],4),unit=110/extent;
  const left=plot({extent,cx:160,cy:260,unit,left:20,top:70,width:280,height:350,grid,id:'domain'}),right=plot({extent,cx:480,cy:260,unit,left:340,top:70,width:280,height:350,grid,id:'codomain'});
  if(basis.length===2)left.add('<rect x="20" y="70" width="280" height="350" fill="#e6f0db" opacity="0.5"/>');
  if(basis.length===1)left.fullLine([basis[0][1],-basis[0][0]],0,'green');
  const r=rank(s.m);
  if(r===2)right.add('<rect x="340" y="70" width="280" height="350" fill="#e6f0db" opacity="0.5"/>');
  else if(r===1){const c=norm([s.m[0],s.m[2]])>1e-9?[s.m[0],s.m[2]]:[s.m[1],s.m[3]];right.fullLine([c[1],-c[0]],0,'green');}
  left.arrow(s.u,'orange','x');right.arrow(out,'orange','Ax');right.arrow([s.m[0],s.m[2]],'teal','a₁');right.arrow([s.m[1],s.m[3]],'purple','a₂');
  return result(text(160,38,'INPUT · domain','#7e936c',12,'text-anchor="middle"')+text(480,38,'OUTPUT · codomain','#7e936c',12,'text-anchor="middle"')+left.finish()+right.finish(),`Input x = ${vec(s.u)}, output Ax = ${vec(out)}. Nullity ${basis.length}. Column-space dimension ${r}.`,`Ax = ${vec(out)}`,`Rank ${r} · Nullity ${basis.length}. Green shows the null space (left) and column space (right).`,[['orange','Input and output'],['teal','Column 1'],['purple','Column 2']]);
 }
 if(mode==='orthogonal'||mode==='projection'){
  const proj=projection(s.u,s.v),residual=sub(s.u,proj),p=plot({extent:extentFor([s.u,s.v,proj,residual]),grid});
  if(norm(s.v)>1e-9)p.fullLine([s.v[1],-s.v[0]],0,'#c5d8b0');
  p.arrow(s.u,'teal','u');p.arrow(s.v,'purple','v');
  if(mode==='projection'){p.arrow(proj,'orange','p');p.arrow(residual,'gray','r',proj,true);}
  const product=dot(s.u,s.v),angle=norm(s.u)*norm(s.v)>1e-9?Math.acos(Math.max(-1,Math.min(1,product/(norm(s.u)*norm(s.v)))))*180/Math.PI:null;
  return result(p.finish(),`Dot product ${fmt(product)}. ${angle===null?'Angle undefined for a zero vector.':`Angle ${fmt(angle)} degrees.`} Projection ${vec(proj)}; residual ${vec(residual)}.`,mode==='orthogonal'?`u · v = ${fmt(product)}`:`projᵥ(u) = ${vec(proj)}`,mode==='orthogonal'?(angle===null?'The angle is undefined for a zero vector.':`Angle ${fmt(angle)}° · Lengths ${fmt(norm(s.u))} and ${fmt(norm(s.v))}`):`Residual ${vec(residual)} · Distance ${fmt(norm(residual))}${norm(s.v)<1e-9?' · Target is the zero subspace':''}`,mode==='orthogonal'?[['teal','u'],['purple','v']]:[['teal','Input u'],['purple','Line direction'],['orange','Projection'],['gray','Residual']]);
 }
 if(mode==='determinant'){
  const a=[s.m[0],s.m[2]],b=[s.m[1],s.m[3]],sum=[a[0]+b[0],a[1]+b[1]],p=plot({extent:extentFor([a,b,sum]),grid});
  p.polygon([[0,0],[1,0],[1,1],[0,1]],'#edf0e7');p.polygon([[0,0],a,sum,b]);p.arrow(a,'teal','column 1');p.arrow(b,'purple','column 2');
  const d=det(s.m);
  return result(p.finish(),`Determinant ${fmt(d)}. Transformed unit square has area ${fmt(Math.abs(d))}.`,`det(A) = ${fmt(d)}`,`Area scale ${fmt(Math.abs(d))} · ${Math.abs(d)<1e-9?'Singular: zero area':d<0?'Orientation reversed':'Orientation preserved'}`,[['teal','First edge'],['purple','Second edge'],['green','Transformed square']]);
 }
 if(mode==='eigen'){
  const e=eigen2(s.m),angle=s.angle*Math.PI/180,v=[2*Math.cos(angle),2*Math.sin(angle)],out=transform(s.m,v),p=plot({extent:extentFor([v,out]),grid});
  if(!e.complex)e.vectors.forEach((direction,i)=>p.fullLine([direction[1],-direction[0]],0,i?'purple':'green'));
  p.arrow(v,'teal','v');p.arrow(out,'orange','Av');
  const cross=v[0]*out[1]-v[1]*out[0],aligned=Math.abs(cross)<1e-7,lambda=dot(v,out)/dot(v,v);
  const values=e.complex?`${fmt(e.real)} ± ${fmt(e.imag)}i`:e.values.map(fmt).join(', ');
  return result(p.finish(),`Eigenvalues ${values}. Candidate v = ${vec(v)}; Av = ${vec(out)}. ${aligned?'Candidate is an eigenvector.':'Candidate is not an eigenvector.'}`,`λ = ${values}`,`${e.complex?'No real eigenvectors':e.scalar?'Every nonzero real vector is an eigenvector':e.vectors.length===1?'Only one independent real eigenvector':'Two independent real eigenvectors'} · ${aligned?`Candidate: Av = ${fmt(lambda)}v`:'Turn the candidate arrow to find a line.'}`,[['teal','Candidate v'],['orange','Av'],['green','Real eigenline']]);
 }
 if(mode==='decomposition'){
  let factors=[],equation='',reconstructed=null,warning='';
  if(s.method==='qr'){const {Q,R}=qr(s.m);factors=[['Q',Q],['R',R]];equation='A = Q R';reconstructed=multiply(Q,R);}
  if(s.method==='lu'){const {P,L,U}=lu(s.m);factors=[['P',P],['L',L],['U',U]];equation='P A = L U';reconstructed=multiply(transpose(P),multiply(L,U));}
  if(s.method==='cholesky'){const L=cholesky(s.m);if(L){factors=[['L',L],['Lᵀ',transpose(L)]];equation='A = L Lᵀ';reconstructed=multiply(L,transpose(L));}else warning='Cholesky requires a symmetric positive-definite matrix.';}
  if(s.method==='eigen'){
   const e=eigen2(s.m);
   if(e.complex||e.vectors.length<2)warning='No real eigenbasis: this real eigendecomposition is unavailable.';
   else {const P=[e.vectors[0][0],e.vectors[1][0],e.vectors[0][1],e.vectors[1][1]],D=[e.values[0],0,0,e.values[1]],inv=inverse(P);if(inv){factors=[['P',P],['D',D],['P⁻¹',inv]];equation='A = P D P⁻¹';reconstructed=multiply(multiply(P,D),inv);}else warning='The eigenvectors do not form a basis.';}
  }
  let svg=matrixAt(s.m,240,60,'Original A',160)+text(320,230,warning||equation,'#728b5d',warning?12:20,'text-anchor="middle"');
  factors.forEach(([label,m],i)=>svg+=matrixAt(m,factors.length===3?45+i*195:120+i*270,315,label,factors.length===3?140:150));
  const error=reconstructed?norm(sub(reconstructed,s.m)):null;
  return result(svg,warning||`${equation}. Reconstruction Frobenius error ${error.toExponential(2)}.`,warning?'Conditions not met':equation,warning||`Reconstruction error ${error.toExponential(2)} · Factors displayed to 3 decimals.`);
 }
 if(mode==='svd'){
  const d=truncatedSVD(s.m,s.k),S=[s.k>0?d.s[0]:0,0,0,s.k>1?d.s[1]:0];
  const stageMatrix=s.stage===0?I:s.stage===1?d.Vt:s.stage===2?multiply(S,d.Vt):d.approx;
  const vectors=[transform(stageMatrix,[2,0]),transform(stageMatrix,[0,2])],p=plot({extent:extentFor(vectors,5),grid});
  let pts=[];for(let i=0;i<=180;i++){const angle=i*Math.PI/90;pts.push(p.point(transform(stageMatrix,[2*Math.cos(angle),2*Math.sin(angle)])).join(','));}
  p.add(`<polyline points="${pts.join(' ')}" fill="#e4efd8" fill-opacity="0.6" stroke="#88a96e" stroke-width="2"/>`);
  p.arrow(vectors[0],'teal','first input axis');p.arrow(vectors[1],'purple','second input axis');
  const stageNames=['Input circle','After Vᵀ','After ΣₖVᵀ','After UΣₖVᵀ'];
  return result(p.finish(),`${stageNames[s.stage]}. Singular values ${d.s.map(fmt).join(', ')}. Retain ${s.k}; error ${fmt(d.error)}.`,`σ = (${d.s.map(fmt).join(', ')})`,`Rank limit ${s.k} · Frobenius error ${fmt(d.error)} · ${stageNames[s.stage]}`,[['teal','Image of (2, 0)'],['purple','Image of (0, 2)'],['green','Transformed circle']]);
 }
 if(mode==='regression'){
  const xs=[-2,-1,0,1,2],fit=xs.map(x=>s.slope*x+s.intercept),best=fitLine(s.ys),error=s.ys.reduce((sum,y,i)=>sum+(y-fit[i])**2,0),bestError=s.ys.reduce((sum,y,i)=>sum+(y-best.slope*xs[i]-best.intercept)**2,0),p=plot({extent:extentFor([...s.ys,...fit].map(y=>[0,y]),5),grid});
  p.fullLine([-s.slope,1],s.intercept,'green');
  xs.forEach((x,i)=>{p.segment([x,s.ys[i]],[x,fit[i]],'orange',true);p.dot([x,s.ys[i]],'teal',`y${i+1}`);});
  return result(p.finish(),`Fit y = ${fmt(s.slope)}x + ${fmt(s.intercept)}. Squared error ${fmt(error)}; minimum ${fmt(bestError)}.`,`SSE = ${fmt(error)}`,`Minimum SSE ${fmt(bestError)} · Best slope ${fmt(best.slope)}, intercept ${fmt(best.intercept)}`,[['teal','Observed points'],['green','Your fitted line'],['orange','Vertical residuals']]);
 }
 if(mode==='pca'){
  const analysis=pca(datasets[s.dataset],Boolean(s.center)),angle=s.angle*Math.PI/180,w=[Math.cos(angle),Math.sin(angle)],projected=analysis.data.map(v=>s.k===2?v:projection(v,w)),p=plot({extent:extentFor(analysis.data,4),grid});
  if(s.k===1)p.fullLine([-w[1],w[0]],0,'green');
  analysis.data.forEach((point,i)=>{if(s.k===1)p.segment(point,projected[i],'gray',true);p.dot(point,'teal','',4);p.dot(projected[i],'orange','',3);});
  const total=analysis.covariance[0]+analysis.covariance[3],captured=s.k===2?total:dot(w,transform(analysis.covariance,w)),ratio=total>1e-9?captured/total:null,best=total>1e-9?analysis.values[0]/total:null;
  return result(p.finish(),`${s.center?'Centered PCA':'Uncentered energy analysis'}. ${s.k} component(s). Retained ${ratio===null?'undefined':fmt(ratio*100)+' percent'}.`,`${s.center?'Variance':'Energy'} kept: ${ratio===null?'undefined':fmt(ratio*100)+'%'}`,`${s.center?'Centered on the feature means':'Not centered: this is not covariance PCA'} · Best 1D share ${best===null?'undefined':fmt(best*100)+'%'}${Math.abs(analysis.values[0]-analysis.values[1])<1e-8?' · All directions tie':''}`,[['teal','Data points'],['orange','Reconstruction'],['green','Candidate component']]);
 }
 throw new Error(`Unknown lab: ${mode}`);
}
