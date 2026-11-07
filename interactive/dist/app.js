import {combine,scale,det,rank,transform,fmt,vec,validState,presets} from './math.js';
import {lessons} from './lessons.js';
import {advancedControls,validateAdvanced,performAction,advancedPresets,missions} from './labs.js';
import {renderScene,colors} from './scenes.js';
import {pythonFor} from './python-examples.js';
import {quickReference} from './reference.js';
const $ = selector => document.querySelector(selector);
const ids = Object.keys(lessons);
const STORAGE_KEY='basis-lab-v1';
let storageAvailable=true, saved={};
try { saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'); if(!saved || typeof saved!=='object' || Array.isArray(saved)) saved={}; } catch { storageAvailable=false; }
const pilotIds=['vectors','span','transformations'];
const validFor=(id,state)=>pilotIds.includes(id)?validState(id,state):validateAdvanced(lessons[id],state);
const states=Object.fromEntries(ids.map(id=>[id,validFor(id,saved.states?.[id]) ? structuredClone(saved.states[id]) : structuredClone(lessons[id].initial)]));
const progress=Object.fromEntries(ids.map(id=>[id,Array.isArray(saved.progress?.[id]) ? [0,1].filter(n=>saved.progress[id].includes(n)) : []]));
const codes=Object.fromEntries(ids.map(id=>[id,typeof saved.codes?.[id]==='string' ? saved.codes[id].slice(0,100000) : null]));
const missionProgress=Object.fromEntries(ids.map(id=>[id,saved.missions?.[id]===true||(!saved.missions&&pilotIds.includes(id)&&progress[id].length===2)]));
const completed=id=>progress[id].length===2&&missionProgress[id];
let current='vectors',tab='explore',worker=null,pythonReady=false,pythonBusy=false,workerTimer=null;
function persist(){
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify({schemaVersion:2,states,progress,missions:missionProgress,codes,current})); storageAvailable=true; }
  catch { storageAvailable=false; }
  $('#save-state').textContent=storageAvailable ? 'Saved on this device' : 'Storage unavailable · use export';
  $('#code-saved').textContent=storageAvailable ? 'Edits saved on this device' : 'Not saved · use export';
}
function updateProgress(){
  const done=ids.filter(completed).length;
  $('#progress-text').textContent=`${done} / ${ids.length}`;
  $('#progress-bar').style.width=`${done/ids.length*100}%`;
  document.querySelectorAll('[data-lesson]').forEach(link=>{
    const id=link.dataset.lesson;
    link.classList.toggle('active',id===current);
    if(id===current) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    link.querySelector('.completion').textContent=completed(id) ? '✓' : '';
    link.setAttribute('aria-label',`${lessons[id].name}${completed(id) ? ', completed' : ''}`);
  });
  $('#practice-status').textContent=completed(current) ? '✓ Lesson complete. Your understanding is growing.' : `${progress[current].length+(missionProgress[current]?1:0)} of 3 checks completed · 1 experiment + 2 questions`;
  $('#course-complete').hidden=done!==ids.length;
  $('#lesson-select').value=current;
  $('#previous-lesson').disabled=ids.indexOf(current)===0;
  $('#next-bottom').textContent=ids.indexOf(current)===ids.length-1?'Review your course →':'Continue to next lesson →';
  $('#lesson-position').textContent=`${ids.indexOf(current)+1} of ${ids.length}`;
}
const numInput=(label,field,value,index)=>`<input type="number" min="-3" max="3" step="0.5" value="${value}" data-field="${field}" data-index="${index}" aria-label="${label}">`;
function vectorControl(name,field,v,color){return `<div class="vector-row"><div class="vector-label"><span style="color:${color}">${name}</span><span class="vector-pair">[ ${numInput(name+' x coordinate',field,v[0],0)} ${numInput(name+' y coordinate',field,v[1],1)} ]</span></div></div>`;}
function slider(name,label,value){return `<div class="coefficient"><label for="coefficient-${name}">${label}<output id="value-${name}" for="coefficient-${name}">${fmt(value)}</output></label><input id="coefficient-${name}" type="range" min="-3" max="3" step="0.5" value="${value}" data-scalar="${name}"><div class="range-ticks"><span>−3</span><span>0</span><span>3</span></div></div>`;}
function renderControls(){
  const s=states[current];
  $('#controls-body').classList.toggle('advanced-controls',!pilotIds.includes(current));
  if(!pilotIds.includes(current)){
    $('#controls-title').textContent=lessons[current].controls;
    $('#controls-body').innerHTML=advancedControls(lessons[current],s);return;
  }
  $('#controls-title').textContent=lessons[current].controls;
  if(current==='transformations'){
    $('#controls-body').innerHTML=`<div><span class="matrix-label">Matrix A</span><div class="matrix-grid">${s.m.map((value,i)=>`<input class="matrix-input" type="number" min="-3" max="3" step="0.5" value="${value}" data-field="m" data-index="${i}" aria-label="Matrix row ${Math.floor(i/2)+1} column ${i%2+1}">`).join('')}</div></div><div>${vectorControl('Input v','u',s.u,'#7a8473')}<label class="preset-label" for="preset">TRY A TRANSFORMATION</label><select class="preset-select" id="preset"><option value="custom">Custom matrix</option><option value="identity">Identity</option><option value="stretch">Horizontal stretch</option><option value="shear">Shear</option><option value="rotate">90° counterclockwise</option><option value="reflect">Reflect across y-axis</option><option value="collapse">Collapse to a line</option></select></div>`;
    $('#preset').value=Object.keys(presets).find(key=>presets[key].every((v,i)=>v===s.m[i]))||'custom';
  }else{
    $('#controls-body').innerHTML=vectorControl('Vector v₁','u',s.u,'#348a83')+vectorControl('Vector v₂','v',s.v,'#9270ba')+slider('a','Weight a · first vector',s.a)+slider('b','Weight b · second vector',s.b)+(current==='span'?`<div style="grid-column:1/-1"><label class="preset-label" for="preset">COMPARE TWO PAIRS</label><select class="preset-select" id="preset"><option value="custom">Custom pair</option><option value="independent">Independent pair</option><option value="parallel">Parallel pair</option><option value="zero">Two zero vectors</option></select></div>`:'');
    if(current==='span') $('#preset').value=s.u.join()==='1,1'&&s.v.join()==='2,2' ? 'parallel' : s.u.join()==='1,0'&&s.v.join()==='0,1' ? 'independent' : s.u.every(v=>v===0)&&s.v.every(v=>v===0) ? 'zero' : 'custom';
  }
}
function svgLine(x1,y1,x2,y2,color,width=1,extra=''){return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${extra}/>`;}
function draw(){
  if(!pilotIds.includes(current)){
    const scene=renderScene(current,lessons[current],states[current],$('#show-grid').checked);
    $('#graph').innerHTML=scene.svg;$('#graph-text').textContent=scene.description;
    $('#result-label').textContent='LIVE RESULT';$('#result-equation').textContent=scene.equation;$('#result-caption').textContent=scene.caption;
    $('#legend').innerHTML=scene.legend.map(([color,label])=>`<span class="legend-item"><span class="legend-line" style="color:${colors[color]}"></span>${label}</span>`).join('');
    return;
  }
  const s=states[current],matrixMode=current==='transformations';
  const result=matrixMode ? transform(s.m,s.u) : combine(s.a,s.u,s.b,s.v);
  const first=matrixMode ? [s.m[0],s.m[2]] : scale(s.a,s.u);
  const second=matrixMode ? [s.m[1],s.m[3]] : scale(s.b,s.v);
  const extent=Math.max(5,...[result,first,second,s.u].flat().map(v=>Math.abs(v)*1.22));
  const cx=320,cy=240,unit=205/extent;
  const point=v=>[cx+v[0]*unit,cy-v[1]*unit];
  let content=`<title id="graph-title">${matrixMode?'Matrix transformation':'Linear combination'} diagram</title><desc id="graph-description"></desc><defs><clipPath id="plot-clip"><rect x="20" y="10" width="600" height="450"/></clipPath>${[['teal','#348a83'],['purple','#9270ba'],['orange','#ba6b3a'],['gray','#a1aa97']].map(([name,color])=>`<marker id="arrow-${name}" markerWidth="8" markerHeight="8" refX="6.8" refY="3.5" orient="auto" markerUnits="strokeWidth"><path d="M0 0 L7 3.5 L0 7" fill="none" stroke="${color}" stroke-width="1.3"/></marker>`).join('')}</defs><g clip-path="url(#plot-clip)">`;
  const grid=$('#show-grid').checked;
  const columnMatrix=matrixMode?s.m:[s.u[0],s.v[0],s.u[1],s.v[1]];
  const r=rank(columnMatrix);
  if(current==='span') {
    if(r===2) content+='<rect x="20" y="10" width="600" height="450" fill="#edf5e6" opacity="0.7"/>';
    if(r===1){const v=s.u.some(x=>x!==0)?s.u:s.v;const norm=Math.hypot(...v);const end=v.map(x=>x/norm*extent*2);const p1=point(end),p2=point(scale(-1,end));content+=svgLine(...p1,...p2,'#d9e9ca',17,'stroke-linecap="round"');}
    if(r===0) content+='<circle cx="320" cy="240" r="10" fill="#d9e9ca"/>';
  }
  const tickStep=Math.max(1,Math.ceil(extent/6));
  if(grid) for(let i=-Math.ceil(extent*1.6);i<=extent*1.6;i+=1){
    const x=cx+i*unit,y=cy-i*unit;
    content+=svgLine(x,10,x,460,'#e8eddf',0.8)+svgLine(20,y,620,y,'#e8eddf',0.8);
  }
  if(matrixMode&&grid) for(let i=-5;i<=5;i++){
    const p=point(transform(s.m,[-5,i])),q=point(transform(s.m,[5,i]));
    const t=point(transform(s.m,[i,-5])),u=point(transform(s.m,[i,5]));
    content+=svgLine(...p,...q,'#aec49a',1,'opacity="0.65"')+svgLine(...t,...u,'#aec49a',1,'opacity="0.65"');
  }
  content+=svgLine(20,cy,620,cy,'#b7c2a9',1.1)+svgLine(cx,10,cx,460,'#b7c2a9',1.1);
  for(let i=-Math.floor(extent);i<=extent;i++) if(i!==0 && i%tickStep===0){
    const x=cx+i*unit,y=cy-i*unit;
    content+=`<text x="${x}" y="${cy+17}" text-anchor="middle" fill="#a0aa93" font-size="10" font-family="monospace">${i}</text><text x="${cx-12}" y="${y+3}" text-anchor="end" fill="#a0aa93" font-size="10" font-family="monospace">${i}</text>`;
  }
  const arrow=(v,color,label,from=[0,0],dashed=false)=>{
    const start=point(from),end=point([from[0]+v[0],from[1]+v[1]]);
    if(Math.hypot(...v)<1e-10) return `<circle cx="${start[0]}" cy="${start[1]}" r="3" fill="${{teal:'#348a83',purple:'#9270ba',orange:'#ba6b3a',gray:'#a1aa97'}[color]}"/>`;
    const colors={teal:'#348a83',purple:'#9270ba',orange:'#ba6b3a',gray:'#a1aa97'};
    return svgLine(...start,...end,colors[color],dashed?1.5:2.4,`marker-end="url(#arrow-${color})" ${dashed?'stroke-dasharray="5 5" opacity="0.7"':''}`)+(label?`<text x="${end[0]+10}" y="${end[1]-10}" fill="${colors[color]}" font-size="13" font-family="system-ui" font-weight="500">${label}</text>`:'');
  };
  if(matrixMode){
    content+=arrow(s.u,'gray','v',[0,0],true)+arrow(first,'teal','A e₁')+arrow(second,'purple','A e₂')+arrow(result,'orange','Av');
  }else{
    content+=arrow(second,'purple','',first,true)+arrow(first,'teal','',second,true)+arrow(first,'teal','a v₁')+arrow(second,'purple','b v₂')+arrow(result,'orange','result');
    if(current==='span'){
      const [x,y]=point([2,1]);content+=`<circle cx="${x}" cy="${y}" r="6" fill="#fcfdfa" stroke="#5a6c48" stroke-width="1.5"/><path d="M${x-3} ${y}h6M${x} ${y-3}v6" stroke="#5a6c48"/><text x="${x+12}" y="${y+17}" fill="#6b7d55" font-size="11" font-family="system-ui">target (2, 1)</text>`;
    }
  }
  content+=`<circle cx="320" cy="240" r="3" fill="#879775"/><text x="${cx-12}" y="${cy+17}" font-size="10" fill="#9ca68f" font-family="monospace">0</text><text x="610" y="${cy-10}" font-size="12" fill="#9ca68f" font-family="system-ui">x</text><text x="${cx+12}" y="24" font-size="12" fill="#9ca68f" font-family="system-ui">y</text></g>`;
  $('#graph').innerHTML=content;
  const description=matrixMode ? `Input v = ${vec(s.u)}. Transformed vector Av = ${vec(result)}. Determinant ${fmt(det(s.m))}; rank ${r}.` : `a = ${fmt(s.a)}, b = ${fmt(s.b)}. v₁ = ${vec(s.u)}, v₂ = ${vec(s.v)}. Result = ${vec(result)}.${current==='span'?` The span has dimension ${r}.`:''}`;
  $('#graph-description').textContent=description;
  $('#graph-text').textContent=description;
  $('#result-label').textContent=matrixMode ? 'TRANSFORMED VECTOR' : 'THE RESULT · a v₁ + b v₂';
  $('#result-equation').textContent=matrixMode ? `Av = ${vec(result)}` : `${fmt(s.a)} v₁ + ${fmt(s.b)} v₂ = ${vec(result)}`;
  $('#result-caption').textContent=matrixMode ? `det(A) = ${fmt(det(s.m))} · Area scale ${fmt(Math.abs(det(s.m)))} · ${r===2?'Invertible':r===1?'Plane collapses to a line':'Everything maps to the origin'}` : current==='span' ? `Span dimension: ${r} · ${r===2?'Independent pair · the whole plane':r===1?'Dependent pair · one line':'Dependent pair · just the origin'}` : 'Scale each vector, then add the coordinates. Dashed arrows show how the steps connect.';
  const legend=matrixMode ? [['teal','First column'],['purple','Second column'],['orange','Transformed v']] : [['teal','a × first vector'],['purple','b × second vector'],['orange','Your combination']];
  $('#legend').innerHTML=legend.map(([color,label])=>`<span class="legend-item"><span class="legend-line" style="color:${{teal:'#348a83',purple:'#9270ba',orange:'#ba6b3a'}[color]}"></span>${label}</span>`).join('');
}
function renderQuestions(){
  $('#questions').innerHTML=lessons[current].questions.map((q,i)=>{
    const order=i===0 ? [1,0,2] : [2,1,0];
    return `<form class="question${progress[current].includes(i)?' question-correct':''}" data-question="${i}"><span class="eyebrow">QUESTION 0${i+1}</span><h3>${q.title}</h3><p class="context">${q.context}</p><fieldset style="border:0;padding:0;margin:0"><legend class="sr-only">${q.title} ${q.context}</legend><div class="answer-options">${order.map(j=>`<label><input type="radio" name="question-${i}" value="${j}" ${progress[current].includes(i)&&j===q.correct?'checked':''}>${q.options[j]}</label>`).join('')}</div></fieldset><div class="question-actions"><button type="submit" class="primary-button">Check my answer</button><button type="button" class="text-button" data-hint="${i}">Give me a hint</button></div><div class="feedback" role="status" ${progress[current].includes(i)?'':'hidden'}>${progress[current].includes(i)?q.feedback[q.correct]:''}</div></form>`;
  }).join('');
  $('#next-lesson').textContent=ids.indexOf(current)===ids.length-1 ? 'Review your course →' : 'Next lesson →';
}
function setTab(next,focus=false){
  tab=next;
  document.querySelectorAll('[data-tab]').forEach(button=>{const active=button.dataset.tab===next;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
  ['explore','practice','notes'].forEach(name=>{$(`#panel-${name}`).hidden=name!==next;});
  if(focus) $(`#tab-${next}`).focus();
}
function loadLesson(id,scroll=false){
  if(pythonBusy)stopPython('Stopped on lesson change. Your edited code is saved.');
  current=id;const lesson=lessons[id],number=String(ids.indexOf(id)+1).padStart(2,'0');
  $('#breadcrumb').textContent=lesson.name;$('#lesson-index').textContent=`LESSON ${number}`;$('#footer-lesson').textContent=number;
  $('#duration').textContent=lesson.time;$('#title').innerHTML=lesson.title;$('#intro').textContent=lesson.intro;
  $('#experiment-title').textContent=lesson.experiment;$('#discovery-text').textContent=lesson.discovery;$('#prompt').textContent=lesson.prompt;
  $('#notes-title').textContent=lesson.notesTitle;$('#notes-body').innerHTML=lesson.notes;
  $('#graph-type').textContent=id==='transformations'?'THE TRANSFORMED PLANE':pilotIds.includes(id)?'THE COORDINATE PLANE':'YOUR MATHEMATICAL EXPERIMENT';
  $('#lesson-path').innerHTML=lesson.prereq?.length?'Builds on '+lesson.prereq.map(key=>`<a href="#${key}">${lessons[key].name}</a>`).join(' · '):'Start here. No previous linear algebra needed.';
  $('#mission-text').textContent=missions[id].prompt;
  $('#mission-feedback').hidden=!missionProgress[id];
  $('#mission-feedback').classList.remove('incorrect');
  $('#mission-feedback').textContent=missionProgress[id]?'✓ Experiment check completed. Try another variation if you like.':'';
  renderControls();draw();renderQuestions();updateProgress();setTab('explore');persist();
  if(!$('#python-panel').hidden) restoreCode(false);
  document.title=`${lesson.name} — Learn Linear Algebra`;
  if(scroll){$('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
}
function codeForExploration(){
  return pythonFor(current,lessons[current],states[current]);
}
function restoreCode(force){
  const value=force||codes[current]===null?codeForExploration():codes[current];
  $('#python-code').value=value;
  if(force){codes[current]=value;persist();}
}
function output(text,append=true){
  const el=$('#python-output');
  if(el.textContent.length>50000&&append)return;
  el.textContent=append?el.textContent+text+'\n':text;
}
function finishPython(text){
  clearTimeout(workerTimer);pythonBusy=false;
  $('#run-python').disabled=!pythonReady;$('#stop-python').disabled=!worker;
  $('#python-status').textContent=text;
}
function stopPython(message='Stopped. Run Python to start a fresh runtime.'){
  if(worker)worker.terminate();worker=null;pythonReady=false;pythonBusy=false;
  clearTimeout(workerTimer);$('#run-python').disabled=false;$('#stop-python').disabled=true;$('#python-status').textContent=message;
}
function startPython(){
  if(worker)return;
  $('#python-status').textContent='Loading Python locally… first load may take a moment.';
  $('#run-python').disabled=true;$('#stop-python').disabled=false;
  try {
    worker=new Worker(new URL('./python-worker.js',import.meta.url));
    worker.onmessage=({data})=>{
      if(data.type==='ready'){pythonReady=true;finishPython('Python ready · runs locally in your browser');}
      if(data.type==='stdout')output(data.text);
      if(data.type==='status')$('#python-status').textContent=data.text;
      if(data.type==='done'){if(!$('#python-output').textContent)output('Finished. Use print(...) to show a result.');finishPython('Finished · Python stays ready for your next experiment');}
      if(data.type==='error'){output(data.text);finishPython('Your code raised an error. Edit it and try again.');}
      if(data.type==='init-error'){output(data.text,false);stopPython('Could not load Python. Check your connection, then Run Python to retry.');}
    };
    worker.onerror=()=>{output('Python could not start. Check your connection and try again.',false);stopPython('Runtime unavailable. Run Python to retry.');};
    worker.postMessage({type:'init'});
    workerTimer=setTimeout(()=>{stopPython('Loading took too long. Run Python to retry.');},90000);
  }catch(error){output(String(error),false);stopPython('Python is unavailable in this browser. The visual lessons still work.');}
}
$('#controls-body').addEventListener('input',event=>{
  const input=event.target,s=states[current];
  if(input.dataset.key&&input.type!=='select-one'&&(input.type==='number'||input.type==='range')){
    const key=input.dataset.key;if(!(key in s))return;
    const value=input.valueAsNumber,min=Number(input.getAttribute('min')),max=Number(input.getAttribute('max')),step=Number(input.getAttribute('step'));
    if(!Number.isFinite(value)||value<min||value>max||(step&&Math.abs((value-min)/step-Math.round((value-min)/step))>1e-6)){input.setCustomValidity(`Use a value from ${min} to ${max}${step?` in steps of ${step}`:""}.`);input.reportValidity();return;}
    input.setCustomValidity('');
    if(input.dataset.arrayIndex!==undefined)s[key][Number(input.dataset.arrayIndex)]=value;else s[key]=value;
    const valueLabel=$(`#lab-value-${key}`);if(valueLabel)valueLabel.textContent=fmt(value);draw();persist();return;
  }
  if(input.dataset.scalar){s[input.dataset.scalar]=Number(input.value);$(`#value-${input.dataset.scalar}`).textContent=fmt(Number(input.value));draw();persist();}
  if(input.dataset.field){
    const value=input.valueAsNumber;
    if(!Number.isFinite(value)||Math.abs(value)>3||!Number.isInteger(value*2)){input.setCustomValidity('Use a number from −3 to 3 in steps of 0.5.');input.reportValidity();return;}
    input.setCustomValidity('');s[input.dataset.field][Number(input.dataset.index)]=value;
    if($('#preset'))$('#preset').value='custom';draw();persist();
  }
});
$('#controls-body').addEventListener('change',event=>{
  const key=event.target.dataset.key,s=states[current];
  if(key&&!pilotIds.includes(current)){
    if(event.target.tagName!=='SELECT'){if(key==='m'&&lessons[current].lab==='homogeneous')renderControls();return;}
    const value=event.target.value;
    if(key==='matrixPreset'){if(value==='custom')return;s.m=[...advancedPresets[value]];}
    else if(key==='systemPreset'){if(value==='custom')return;const cases={unique:{m:[1,1,1,-1],b:[3,1]},infinite:{m:[1,1,2,2],b:[2,4]},none:{m:[1,1,2,2],b:[2,3]},free:{m:[0,0,0,0],b:[0,0]}};Object.assign(s,structuredClone(cases[value]));}
    else if(key in s)s[key]=typeof s[key]==='number'?Number(value):value;
    else return;
    renderControls();draw();persist();return;
  }
  if(event.target.id!=='preset'||event.target.value==='custom')return;
  const preset=event.target.value;
  if(current==='transformations')states[current].m=[...presets[preset]];
  else {
    const pairs={independent:[[1,0],[0,1]],parallel:[[1,1],[2,2]],zero:[[0,0],[0,0]]};
    [states[current].u,states[current].v]=structuredClone(pairs[preset]);
    states[current].a=1;states[current].b=0;
  }
  renderControls();draw();persist();
});
$('#reset').addEventListener('click',()=>{states[current]=structuredClone(lessons[current].initial);renderControls();draw();persist();});
$('#show-grid').addEventListener('change',draw);
$('.lesson-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-tab]');if(button)setTab(button.dataset.tab);});
$('.lesson-tabs').addEventListener('keydown',event=>{
  const names=['explore','practice','notes'];let index=names.indexOf(tab);
  if(event.key==='ArrowRight')index=(index+1)%3;else if(event.key==='ArrowLeft')index=(index+2)%3;else if(event.key==='Home')index=0;else if(event.key==='End')index=2;else return;
  event.preventDefault();setTab(names[index],true);
});
$('#go-practice').addEventListener('click',()=>setTab('practice',true));
$('#notes-practice').addEventListener('click',()=>setTab('practice',true));
$('#questions').addEventListener('submit',event=>{
  event.preventDefault();const form=event.target,index=Number(form.dataset.question),q=lessons[current].questions[index];
  const selected=form.querySelector('input:checked'),feedback=form.querySelector('.feedback');feedback.hidden=false;
  if(!selected){feedback.textContent='Choose your prediction first. It’s fine to be unsure.';feedback.classList.add('incorrect');return;}
  const correct=Number(selected.value)===q.correct;
  feedback.textContent=q.feedback[Number(selected.value)];feedback.classList.toggle('incorrect',!correct);
  if(correct&&!progress[current].includes(index)){progress[current].push(index);persist();updateProgress();}
  form.classList.toggle('question-correct',correct);
});
$('#questions').addEventListener('click',event=>{
  const hint=event.target.closest('[data-hint]');if(!hint)return;
  const feedback=hint.closest('form').querySelector('.feedback');feedback.hidden=false;feedback.classList.remove('incorrect');feedback.textContent=lessons[current].questions[Number(hint.dataset.hint)].hint;
});
function goNext(){const index=ids.indexOf(current);if(index<ids.length-1)location.hash=ids[index+1];else{const unfinished=ids.find(id=>!completed(id));if(unfinished)location.hash=unfinished;else openReference();}}
$('#next-lesson').addEventListener('click',goNext);
$('#next-bottom').addEventListener('click',goNext);
$('#previous-lesson').addEventListener('click',()=>{const index=ids.indexOf(current);if(index>0)location.hash=ids[index-1];});
$('#python-toggle').addEventListener('click',()=>{
  const opening=$('#python-panel').hidden;
  $('#python-panel').hidden=!opening;$('#python-toggle').setAttribute('aria-expanded',String(opening));$('#python-chevron').textContent=opening?'−':'＋';
  if(opening){restoreCode(false);startPython();}
});
$('#restore-python').addEventListener('click',()=>{restoreCode(true);output('Restored the current exploration values. Run the code to calculate.',false);});
$('#python-code').addEventListener('input',()=>{codes[current]=$('#python-code').value;persist();});
$('#python-code').addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();$('#run-python').click();}
});
$('#run-python').addEventListener('click',()=>{
  if(!worker){startPython();return;}
  if(!pythonReady||pythonBusy)return;
  codes[current]=$('#python-code').value;persist();pythonBusy=true;$('#run-python').disabled=true;$('#stop-python').disabled=false;
  output('',false);$('#python-status').textContent='Running locally…';
  worker.postMessage({type:'run',code:$('#python-code').value});
  workerTimer=setTimeout(()=>{stopPython('Execution exceeded 60 seconds. Run Python to start a fresh runtime.');output('Execution stopped after 60 seconds. Your code is still in the editor.');},60000);
});
$('#stop-python').addEventListener('click',()=>stopPython());
document.querySelectorAll('[data-export]').forEach(button=>button.addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({format:'basis-lab-v1',schemaVersion:2,exportedAt:new Date().toISOString(),states,progress,missions:missionProgress,codes},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='linear-algebra-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}));
function renderNavigation(){
  let group='';
  $('#lessons').innerHTML=ids.map((id,i)=>{const lesson=lessons[id],heading=group!==lesson.group?`<div class="nav-group-title">${lesson.group}</div>`:'';group=lesson.group;return heading+`<a href="#${id}" data-lesson="${id}"><span class="lesson-number">${String(i+1).padStart(2,'0')}</span><span>${lesson.name}</span><span class="completion"></span></a>`;}).join('');
  $('#lesson-select').innerHTML=ids.map((id,i)=>`<option value="${id}">${String(i+1).padStart(2,'0')} · ${lessons[id].name}</option>`).join('');
}
$('#lesson-select').addEventListener('change',event=>location.hash=event.target.value);
$('#lesson-search').addEventListener('input',event=>{
  const query=event.target.value.trim().toLowerCase();
  document.querySelectorAll('[data-lesson]').forEach(link=>link.hidden=!(link.textContent+' '+link.dataset.lesson).toLowerCase().includes(query));
  document.querySelectorAll('.nav-group-title').forEach(heading=>{let next=heading.nextElementSibling,visible=false;while(next&&!next.classList.contains('nav-group-title')){if(next.matches('[data-lesson]')&&!next.hidden)visible=true;next=next.nextElementSibling;}heading.hidden=!visible;});
  $('#lessons-empty').hidden=[...document.querySelectorAll('[data-lesson]')].some(link=>!link.hidden);
});
$('#controls-body').addEventListener('click',event=>{
  const button=event.target.closest('[data-lab-action]');if(!button)return;
  try{
    const context=button.dataset.labAction==='apply-row'?{op:$('[data-key="rowOp"]').value,source:Number($('[data-key="rowSource"]').value),target:Number($('[data-key="rowTarget"]').value),factor:$('#row-factor').value}:{};
    const message=performAction(button.dataset.labAction,lessons[current],states[current],context);
    renderControls();draw();persist();
    if($('#row-operation-status')&&message)$('#row-operation-status').textContent=message;
  }catch(error){if($('#row-operation-status'))$('#row-operation-status').textContent=error.message;}
});
$('#check-mission').addEventListener('click',()=>{
  const feedback=$('#mission-feedback');feedback.hidden=false;
  const invalid=[...$('#controls-body').querySelectorAll('input[type="number"]')].find(input=>!Number.isFinite(input.valueAsNumber)||(input.checkValidity&&!input.checkValidity()));
  if(invalid){feedback.textContent='Correct the highlighted input before checking the experiment.';feedback.classList.add('incorrect');invalid.reportValidity();return;}
  const success=missions[current].check(states[current]);
  feedback.classList.toggle('incorrect',!success);
  feedback.textContent=success?'✓ Your experiment satisfies the challenge. Try explaining why it works.':'Not yet. '+missions[current].hint;
  if(success){missionProgress[current]=true;persist();updateProgress();}
});
$('#mission-hint').addEventListener('click',()=>{const feedback=$('#mission-feedback');feedback.hidden=false;feedback.classList.remove('incorrect');feedback.textContent=missions[current].hint;});
let referenceTrigger;
function openReference(event){referenceTrigger=event?.currentTarget||$('#quick-reference');const dialog=$('#reference-dialog');if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}
function closeReference(){const dialog=$('#reference-dialog');if(dialog.close)dialog.close();else dialog.removeAttribute('open');referenceTrigger?.focus();}
$('#reference-body').innerHTML=quickReference;
document.querySelectorAll('[data-reference]').forEach(button=>button.addEventListener('click',openReference));
$('#close-reference').addEventListener('click',closeReference);
$('#reference-dialog').addEventListener('click',event=>{if(event.target.closest('a[href^="#"]'))closeReference();});
$('#import-button').addEventListener('click',()=>$('#import-file').click());
$('#import-file').addEventListener('change',async event=>{
  const importInput=event.target,file=importInput.files?.[0];if(!file)return;
  try{
    if(file.size>5*1024*1024)throw new Error('Choose a progress file smaller than 5 MB.');
    const imported=JSON.parse(await file.text());
    if(imported?.format!=='basis-lab-v1')throw new Error('This is not a Learn Linear Algebra progress export.');
    for(const id of ids){
      if(validFor(id,imported.states?.[id]))states[id]=structuredClone(imported.states[id]);
      if(Array.isArray(imported.progress?.[id]))progress[id]=[...new Set([...progress[id],...imported.progress[id].filter(n=>n===0||n===1)])];
      if(imported.missions?.[id]===true||(!imported.missions&&pilotIds.includes(id)&&imported.progress?.[id]?.length===2))missionProgress[id]=true;
      if(typeof imported.codes?.[id]==='string')codes[id]=imported.codes[id].slice(0,100000);
    }
    loadLesson(current);$('#import-status').textContent='Progress imported and merged on this device. Python was not executed.';
  }catch(error){$('#import-status').textContent='Import failed: '+error.message;}
  importInput.value='';
});
renderNavigation();
window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(ids.includes(id))loadLesson(id,true);});
const initialId=location.hash.slice(1);
loadLesson(ids.includes(initialId)?initialId:ids.includes(saved.current)?saved.current:'vectors');
