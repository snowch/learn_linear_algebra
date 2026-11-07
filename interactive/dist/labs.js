import {det,rank,transform,combine,fmt,vec} from './math.js';
import {Fraction,rref,rowOperation,kernel,coordinates,norm,dot,sub,projection,fitLine,datasets,pca,eigen2,truncatedSVD,cholesky,multiply} from './algebra.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(key,label,value,index=null,min=-6,max=6,step=.5)=>`<label class="lab-field">${label}<input type="number" value="${value}" min="${min}" max="${max}" step="${step}" data-key="${key}" ${index===null?'':`data-array-index="${index}"`}></label>`;
const vector=(key,label,v)=>`<fieldset class="lab-fieldset"><legend>${label}</legend><div class="lab-vector">${v.map((x,i)=>field(key,i?'y':'x',x,i)).join('')}</div></fieldset>`;
const matrix=(key,label,m)=>`<fieldset class="lab-fieldset"><legend>${label}</legend><div class="lab-matrix">${m.map((x,i)=>field(key,`r${Math.floor(i/2)+1} c${i%2+1}`,x,i)).join('')}</div></fieldset>`;
const select=(key,label,options,value)=>`<label class="lab-select">${label}<select data-key="${key}">${Object.entries(options).map(([v,name])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${name}</option>`).join('')}</select></label>`;
const range=(key,label,value,min,max,step=.5)=>`<div class="coefficient"><label for="lab-${key}">${label}<output id="lab-value-${key}">${fmt(value)}</output></label><input id="lab-${key}" type="range" value="${value}" min="${min}" max="${max}" step="${step}" data-key="${key}"><div class="range-ticks"><span>${min}</span><span>${max}</span></div></div>`;
const action=(key,label)=>`<button type="button" class="subtle-button lab-action" data-lab-action="${key}">${label}</button>`;
const matrixPresets={custom:'Custom matrix',identity:'Identity',singular:'Rank one',zero:'Zero matrix',symmetric:'Symmetric positive definite',rotation:'90° rotation',reflection:'Reflection',defective:'Repeated eigenvalue',nonsymmetric:'Nonsymmetric eigenbasis',pivot:'Needs a row swap'};
export const advancedPresets={identity:[1,0,0,1],singular:[1,2,1,2],zero:[0,0,0,0],symmetric:[2,1,1,2],rotation:[0,-1,1,0],reflection:[-1,0,0,1],defective:[1,1,0,1],nonsymmetric:[3,1,2,2],pivot:[0,1,2,3]};
const matrixChooser=s=>select('matrixPreset','TRY A MATRIX',matrixPresets,Object.keys(advancedPresets).find(k=>advancedPresets[k].every((v,i)=>v===s.m[i]))||'custom');
export function advancedControls(lesson,s){
 const mode=lesson.lab;
 if(mode==='arithmetic')return matrix('m','Matrix A',s.m)+matrix('n','Matrix B',s.n)+select('operation','OPERATION',{ab:'A × B',ba:'B × A',add:'A + B',transpose:'Transpose A'},s.operation);
 if(mode==='elimination')return `<p class="control-help">Choose a legal move. Integers, decimals, and fractions such as −1/2 are accepted.</p>${select('rowOp','OPERATION',{add:'Add a multiple of a row',scale:'Scale a row',swap:'Swap the two rows'},'add')}${select('rowSource','SOURCE ROW',{0:'Row 1',1:'Row 2'},0)}${select('rowTarget','TARGET ROW',{0:'Row 1',1:'Row 2'},1)}<label class="lab-select">MULTIPLIER<input id="row-factor" type="text" value="-2" maxlength="30" inputmode="text" aria-label="Row operation multiplier"></label><div class="lab-actions">${action('apply-row','Apply operation')}${action('undo-row','↶ Undo')}${action('next-row','Suggest next step')}</div><p class="control-help" id="row-operation-status" role="status">${s.history.length?esc(s.history.at(-1).label):'Your first move is yours.'}</p><p class="control-help">${s.history.length} operation${s.history.length===1?'':'s'} · up to 50 undo steps</p>`;
 if(mode==='systems')return select('systemPreset','COMPARE SOLUTION SETS',{custom:'Custom system',unique:'One solution',infinite:'Infinitely many',none:'No solution',free:'No constraints'},'custom')+matrix('m','Coefficient matrix A',s.m)+vector('b','Right-hand side b',s.b);
 if(mode==='closure')return select('family','CANDIDATE SET',{line:'y = x · through zero',offset:'y = x + 1 · offset line',parabola:'y = x² · a curve'},s.family)+range('a','x coordinate of u',s.a,-3,3)+range('b','x coordinate of v',s.b,-3,3)+range('c','Scale u by c',s.c,-3,3);
 if(mode==='coordinates')return vector('u','First vector u',s.u)+vector('v','Second vector v',s.v)+vector('w','Target w',s.w);
 if(mode==='matrixspace')return select('family','MATRIX SPACE',{symmetric:'Symmetric',skew:'Skew-symmetric',traceless:'Trace zero'},s.family)+range('a','Coefficient a',s.a,-3,3)+(s.family==='skew'?'':range('b','Coefficient b',s.b,-3,3)+range('c','Coefficient c',s.c,-3,3));
 if(mode==='homogeneous')return matrix('m','Coefficient matrix A',s.m)+matrixChooser(s)+range('t','First solution parameter',s.t,-3,3)+(kernel(s.m).length===2?range('z','Second solution parameter',s.z,-3,3):'');
 if(mode==='nullspace')return matrix('m','Matrix A',s.m)+vector('u','Input x',s.u)+matrixChooser(s);
 if(mode==='orthogonal'||mode==='projection')return vector('u','Input u',s.u)+vector('v',mode==='projection'?'Line direction v':'Vector v',s.v);
 if(mode==='determinant')return matrix('m','Matrix A',s.m)+matrixChooser(s);
 if(mode==='eigen')return matrix('m','Matrix A',s.m)+matrixChooser(s)+range('angle','Candidate angle (degrees)',s.angle,0,180,1);
 if(mode==='decomposition')return select('method','FACTORIZATION',{qr:'QR · orthogonal × triangular',lu:'Pivoted LU · PA = LU',cholesky:'Cholesky · A = LLᵀ',eigen:'Eigen · A = PDP⁻¹'},s.method)+matrix('m','Matrix A',s.m)+matrixChooser(s);
 if(mode==='svd')return matrix('m','Matrix A',s.m)+range('k','Singular values to retain',s.k,0,2,1)+select('stage','FOLLOW THE TRANSFORMATION',{0:'0 · Original circle',1:'1 · Apply Vᵀ',2:'2 · Apply Σₖ',3:'3 · Apply U'},s.stage);
 if(mode==='regression')return `<fieldset class="lab-fieldset"><legend>Observed y (x = −2, −1, 0, 1, 2)</legend><div class="observation-fields">${s.ys.map((y,i)=>field('ys',`x = ${i-2}`,y,i)).join('')}</div></fieldset>`+range('slope','Your slope',s.slope,-4,4,.05)+range('intercept','Your intercept',s.intercept,-6,6,.1)+action('best-fit','Compare the optimal line');
 if(mode==='pca')return select('dataset','DATASET',{tilted:'A tilted point cloud',offset:'A cloud far from the origin',isotropic:'Equal spread in every direction'},s.dataset)+select('center','PREPROCESSING',{1:'Center features · PCA',0:'Raw values · uncentered energy'},s.center)+range('angle','Candidate direction (degrees)',s.angle,0,180,'any')+range('k','Components to retain',s.k,1,2,1)+action('best-pca','Find a principal direction');
 throw new Error('Unknown controls: '+mode);
}
const rationalRows=rows=>Array.isArray(rows)&&rows.length===2&&rows.every(row=>Array.isArray(row)&&row.length===3&&row.every(x=>{try{return typeof x==='string'&&x.length<=90&&Number.isFinite(Number(Fraction.from(x)));}catch{return false;}}));
export function validateAdvanced(lesson,s){
 if(!s||typeof s!=='object'||Array.isArray(s))return false;
 if(lesson.lab==='elimination')return rationalRows(s.rows)&&Array.isArray(s.history)&&s.history.length<=50&&s.history.every(h=>h&&typeof h.label==='string'&&h.label.length<=160&&rationalRows(h.rows));
 const enums={family:lesson.lab==='closure'?['line','offset','parabola']:['symmetric','skew','traceless'],operation:['ab','ba','add','transpose'],method:['qr','lu','cholesky','eigen'],dataset:Object.keys(datasets)};
 for(const [key,initial] of Object.entries(lesson.initial)){
  const value=s[key];
  if(Array.isArray(initial)){if(!Array.isArray(value)||value.length!==initial.length||!value.every(n=>Number.isFinite(n)&&Math.abs(n)<=6&&Math.abs(n*2-Math.round(n*2))<1e-8))return false;}
  else if(typeof initial==='string'){if(!enums[key]?.includes(value))return false;}
  else {if(!Number.isFinite(value))return false;const bounds=key==='angle'?[0,180]:key==='k'?[lesson.lab==='pca'?1:0,2]:key==='stage'?[0,3]:key==='center'?[0,1]:key==='slope'?[-4,4]:key==='intercept'?[-6,6]:[-3,3];if(value<bounds[0]||value>bounds[1])return false;if(['k','stage','center'].includes(key)&&!Number.isInteger(value))return false;}
 }
 return true;
}
export function performAction(action,lesson,s,context={}){
 if(action==='undo-row'){if(!s.history.length)return 'Nothing to undo yet.';s.rows=s.history.pop().rows;return 'Undid the last operation.';}
 if(action==='next-row'||action==='apply-row'){
  if(s.history.length>=50)throw new Error('You reached 50 saved steps. Undo a step or reset before continuing.');
  let next,label;
  if(action==='next-row'){const step=rref(s.rows).steps[0];if(!step)return 'Already in reduced row echelon form.';next=step.rows;label=step.label;}
  else {const {op,source,target,factor}=context;next=rowOperation(s.rows,op,source,target,factor);label=op==='swap'?'Swap R₁ and R₂':op==='scale'?`R${target+1} ← (${factor})R${target+1}`:`R${target+1} ← R${target+1} + (${factor})R${source+1}`;}
  s.history.push({rows:structuredClone(s.rows),label});s.rows=next;return label;
 }
 if(action==='best-fit'){const fit=fitLine(s.ys);s.slope=fit.slope;s.intercept=fit.intercept;return;}
 if(action==='best-pca'){const analysis=pca(datasets[s.dataset],Boolean(s.center)),v=analysis.vectors[0];let angle=Math.atan2(v[1],v[0])*180/Math.PI;angle=(angle+180)%180;s.angle=angle;return;}
}
const near=(a,b)=>norm(sub(a,b))<1e-7;
export const missions={
 vectors:{prompt:'Make a linear combination that ends at (2, 3). Any valid vectors and weights count.',check:s=>near(combine(s.a,s.u,s.b,s.v),[2,3]),hint:'For example, use the standard basis vectors and weights 2 and 3.'},
 matrices:{prompt:'Choose matrices that do not commute, then display B × A.',check:s=>s.operation==='ba'&&!near(multiply(s.m,s.n),multiply(s.n,s.m)),hint:'Keep the stretch and shear example, and switch the product order.'},
 transformations:{prompt:'Create a transformation with area scale 1 that reverses orientation.',check:s=>Math.abs(det(s.m)+1)<1e-9,hint:'Try a reflection. Its determinant is −1.'},
 span:{prompt:'Reach the target (2, 1). Your pair must span the entire plane.',check:s=>near(combine(s.a,s.u,s.b,s.v),[2,1])&&rank([s.u[0],s.v[0],s.u[1],s.v[1]])===2,hint:'Choose the independent pair, then set a = 2 and b = 1.'},
 dependence:{prompt:'Keep u and v independent. Make w = 2u − v.',check:s=>rank([s.u[0],s.v[0],s.u[1],s.v[1]])===2&&near(s.w,combine(2,s.u,-1,s.v)),hint:'With the standard basis, set w to (2, −1).'},
 elimination:{prompt:'Reach RREF using valid row operations. Any correct path counts.',check:s=>s.rows.every((r,i)=>r.every((v,j)=>Fraction.from(v).toString()===rref(s.rows).rows[i][j])),hint:'Clear below the first pivot, normalize the second pivot, then clear above it. Suggestions can help one step at a time.'},
 solutions:{prompt:'Build a system with no solutions.',check:s=>{const r=rref([[s.m[0],s.m[1],s.b[0]],[s.m[2],s.m[3],s.b[1]]]).rows;return r.some(row=>Fraction.from(row[0]).zero&&Fraction.from(row[1]).zero&&!Fraction.from(row[2]).zero);},hint:'Try parallel coefficient rows with right-hand sides that are not in the same ratio.'},
 'vector-spaces':{prompt:'Use the offset line to exhibit a pair whose sum is outside the set.',check:s=>s.family==='offset',hint:'Every point has y = x + 1. Adding two such equations produces a right-hand offset of 2.'},
 basis:{prompt:'Keep w = (2, 1). Find a nonstandard basis in which its coordinates are (1, 1).',check:s=>near(s.w,[2,1])&&rank([s.u[0],s.v[0],s.u[1],s.v[1]])===2&&near(combine(1,s.u,1,s.v),s.w)&&!near([...s.u,...s.v],[1,0,0,1]),hint:'Try u = (1, 0), v = (1, 1). Their sum is the target.'},
 subspaces:{prompt:'Use a nonzero point on the parabola to show that doubling can leave the set.',check:s=>s.family==='parabola'&&s.a!==0&&s.c===2,hint:'Choose the parabola, set the first x-coordinate to 1, and scale that point by 2.'},
 homogeneous:{prompt:'Choose a rank-one matrix and display a nonzero homogeneous solution.',check:s=>rank(s.m)===1&&Math.abs(s.t)>1e-8,hint:'The rank-one preset has a one-dimensional kernel. Move its solution parameter away from zero.'},
 'matrix-spaces':{prompt:'Build a nonzero symmetric matrix with trace zero.',check:s=>s.family==='symmetric'&&Math.abs(s.a+s.c)<1e-9&&Math.abs(s.a)+Math.abs(s.b)+Math.abs(s.c)>0,hint:'Set a = 1, c = −1; b can be any allowed value.'},
 nullspace:{prompt:'Find a nonzero input x that A sends to zero.',check:s=>norm(s.u)>1e-8&&norm(transform(s.m,s.u))<1e-8,hint:'For the rank-one preset [[1, 2], [1, 2]], try x = (−2, 1).'},
 orthogonality:{prompt:'Make two nonzero vectors orthogonal.',check:s=>norm(s.u)>1e-8&&norm(s.v)>1e-8&&Math.abs(dot(s.u,s.v))<1e-8,hint:'For u = (2, 1), try v = (−1, 2).'},
 projections:{prompt:'Make the projection zero while keeping u and v nonzero.',check:s=>norm(s.u)>1e-8&&norm(s.v)>1e-8&&norm(projection(s.u,s.v))<1e-8,hint:'The projection vanishes when u is perpendicular to v.'},
 'least-squares':{prompt:'Find the line with minimum squared error for the current observations.',check:s=>{const fit=fitLine(s.ys);return Math.abs(fit.slope-s.slope)<1e-6&&Math.abs(fit.intercept-s.intercept)<1e-6;},hint:'Try adjusting both sliders, then compare with the optimal line. The intercept is the mean of the five observations.'},
 determinants:{prompt:'Build a matrix with determinant −2.',check:s=>Math.abs(det(s.m)+2)<1e-8,hint:'A horizontal reflection and stretch by 2 can be represented by diag(−2, 1).'},
 eigenvalues:{prompt:'Find a nonzero candidate on an eigenline of the current matrix.',check:s=>{const a=s.angle*Math.PI/180,v=[Math.cos(a),Math.sin(a)],out=transform(s.m,v);return Math.abs(v[0]*out[1]-v[1]*out[0])<1e-7;},hint:'For [[2, 1], [1, 2]], try 45°. A real rotation preset has no solution to this challenge.'},
 decompositions:{prompt:'Select Cholesky and give it a symmetric positive-definite matrix.',check:s=>s.method==='cholesky'&&Boolean(cholesky(s.m)),hint:'The symmetric positive-definite preset satisfies the required conditions.'},
 svd:{prompt:'Discard a positive singular value by keeping only one. Show the final transformed circle.',check:s=>s.k===1&&s.stage===3&&truncatedSVD(s.m,1).s[1]>1e-8,hint:'Use diag(3, 1), keep one value, and select stage 3. The discarded value 1 equals the reconstruction error.'},
 applications:{prompt:'Center the data, keep one component, and find a direction capturing the maximum variance.',check:s=>{const a=pca(datasets[s.dataset],true),w=[Math.cos(s.angle*Math.PI/180),Math.sin(s.angle*Math.PI/180)];return s.center===1&&s.k===1&&Math.abs(dot(w,transform(a.covariance,w))-a.values[0])<1e-7;},hint:'Compare your direction with the computed principal direction. On isotropic data, all unit directions tie.'}
};
