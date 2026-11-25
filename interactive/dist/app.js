import {combine,scale,det,rank,transform,fmt,vec,validState,presets} from './math.js';
import {lessons} from './lessons.js';
import {experiments} from './experiments.js';
import {advancedControls,validateAdvanced,performAction,advancedPresets,systemPresets,missions} from './labs.js';
import {renderScene,colors} from './scenes.js';
import {pythonFor} from './python-examples.js';
import {quickReference} from './reference.js';
const $ = selector => document.querySelector(selector);
const ids = Object.keys(lessons);
const STORAGE_KEY='basis-lab-v1';
let saved={}, lastSaved;
try {
  lastSaved=localStorage.getItem(STORAGE_KEY);
  const record=JSON.parse(lastSaved||'{}');
  if(record && typeof record==='object' && !Array.isArray(record)) saved=record;
} catch { /* The export still works if local storage is unavailable. */ }
const pilotIds=['vectors','span','transformations'];
const validFor=(id,state)=>pilotIds.includes(id)?validState(id,state):validateAdvanced(lessons[id],state);
const states=Object.fromEntries(ids.map(id=>[id,validFor(id,saved.states?.[id]) ? structuredClone(saved.states[id]) : structuredClone(lessons[id].initial)]));
const progress=Object.fromEntries(ids.map(id=>[id,Array.isArray(saved.progress?.[id]) ? [0,1].filter(n=>saved.progress[id].includes(n)) : []]));
const codes=Object.fromEntries(ids.map(id=>[id,typeof saved.codes?.[id]==='string' ? saved.codes[id].slice(0,100000) : null]));
const missionProgress=Object.fromEntries(ids.map(id=>[id,saved.missions?.[id]===true||(!saved.missions&&pilotIds.includes(id)&&progress[id].length===2)]));
const completed=id=>progress[id].length===2&&missionProgress[id];
// Keep the active draft and its recovery copy in one write. A refused write
// leaves the last durable snapshot intact, even if the starter is smaller.
const settingBackups=Object.fromEntries(ids.map(id=>[id,validFor(id,saved.settingBackups?.[id])?structuredClone(saved.settingBackups[id]):null]));
const codeBackups=Object.fromEntries(ids.map(id=>{
  const backup=saved.codeBackups?.[id];
  return [id,backup&&(backup.code===null||typeof backup.code==='string')?{code:backup.code?.slice(0,100000)??null}:null];
}));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
let current='vectors', worker=null, pythonReady=false, pythonBusy=false, workerTimer=null;
const pythonResults=new Map();
let pythonRun=null;
function snapshot(){
  return {schemaVersion:2,states,progress,missions:missionProgress,codes,settingBackups,codeBackups,current};
}
function persist(){
  const status=$('#save-state');
  try {
    const latest=localStorage.getItem(STORAGE_KEY);
    if(lastSaved!==undefined && latest!==lastSaved){
      status.textContent='Another tab saved newer progress. Export this tab’s changes to keep a copy.';
      return;
    }
    const next=JSON.stringify(snapshot());
    if(latest!==next)localStorage.setItem(STORAGE_KEY,next);
    lastSaved=next;
    status.textContent='';
  } catch {
    status.textContent='Changes are available in this tab. Use Export progress before reloading or closing it.';
  }
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
  $('#practice-status').textContent=completed(current) ? 'Lesson complete. All three checks passed.' : `${progress[current].length+(missionProgress[current]?1:0)} of 3 lesson checks passed.`;
  $('#course-complete').hidden=done!==ids.length;
  $('#lesson-select').value=current;
  $('#previous-lesson').disabled=ids.indexOf(current)===0;
  $('#next-bottom').textContent=ids.indexOf(current)===ids.length-1?'Review course':'Next lesson →';
}
const vectorPairs={independent:[[1,0],[0,1]],parallel:[[1,1],[2,2]],zero:[[0,0],[0,0]]};
const numInput=(label,field,value,index)=>`<input type="number" min="-3" max="3" step="0.5" value="${value}" data-field="${field}" data-index="${index}" aria-label="${label}">`;
function vectorControl(name,field,v,color){return `<div class="vector-row"><div class="vector-label"><span style="color:${color}">${name}</span><span class="vector-pair">[ ${numInput(name+' x coordinate',field,v[0],0)} ${numInput(name+' y coordinate',field,v[1],1)} ]</span></div></div>`;}
function slider(name,label,value){return `<div class="coefficient"><label for="coefficient-${name}">${label}<output id="value-${name}" for="coefficient-${name}">${fmt(value)}</output></label><input id="coefficient-${name}" type="range" min="-3" max="3" step="0.5" value="${value}" data-scalar="${name}"><div class="range-ticks"><span>−3</span><span>0</span><span>3</span></div></div>`;}
function renderControls(retain=false){
  const body=$('#controls-body'), active=document.activeElement;
  const query=active?.id ? '#'+active.id : active && ['key','labAction','field'].find(key=>active.dataset?.[key]);
  const focus=retain&&body.contains(active)&&query ? query.startsWith('#') ? query :
    Object.entries(active.dataset).map(([key,value])=>`[data-${key.replace(/[A-Z]/g,l=>'-'+l.toLowerCase())}="${value}"]`).join('') : null;
  const rowFields=['[data-key="rowOp"]','[data-key="rowSource"]','[data-key="rowTarget"]','#row-factor'];
  const rowValues=retain&&current==='elimination'?rowFields.map(selector=>$(selector)?.value):[];
  drawControls();
  $('#input-message').hidden=true;
  rowValues.forEach((value,i)=>{if(value!==undefined)$(rowFields[i]).value=value;});
  updateRowFields();
  if(focus)body.querySelector(focus)?.focus({preventScroll:true});
}
function updateRowFields(){
  if(current!=='elimination')return;
  const op=$('[data-key="rowOp"]').value;
  $('[data-key="rowSource"]').closest('label').hidden=op!=='add';
  $('[data-key="rowTarget"]').closest('label').hidden=op==='swap';
  $('#row-factor').closest('label').hidden=op==='swap';
}
function drawControls(){
  const s=states[current];
  $('#controls-body').classList.toggle('advanced-controls',!pilotIds.includes(current));
  if(!pilotIds.includes(current)){
    $('#controls-title').textContent=current==='elimination'?'Row operation':'Settings';
    $('#controls-body').innerHTML=advancedControls(lessons[current],s);return;
  }
  $('#controls-title').textContent=current==='elimination'?'Row operation':'Settings';
  if(current==='transformations'){
    $('#controls-body').innerHTML=`<div><span class="matrix-label">Matrix A</span><div class="matrix-grid">${s.m.map((value,i)=>`<input class="matrix-input" type="number" min="-3" max="3" step="0.5" value="${value}" data-field="m" data-index="${i}" aria-label="Matrix row ${Math.floor(i/2)+1} column ${i%2+1}">`).join('')}</div></div><div>${vectorControl('Input v','u',s.u,'#7a8473')}<label class="preset-label" for="preset">Transformation preset</label><select class="preset-select" id="preset"><option value="custom">Custom matrix</option><option value="identity">Identity</option><option value="stretch">Horizontal stretch</option><option value="shear">Shear</option><option value="rotate">90° counterclockwise</option><option value="reflect">Reflect across y-axis</option><option value="collapse">Collapse to a line</option></select></div>`;
    $('#preset').value=Object.keys(presets).find(key=>presets[key].every((v,i)=>v===s.m[i]))||'custom';
  }else{
    $('#controls-body').innerHTML=vectorControl('Vector v₁','u',s.u,'#348a83')+vectorControl('Vector v₂','v',s.v,'#9270ba')+slider('a','Coefficient a · first vector',s.a)+slider('b','Coefficient b · second vector',s.b)+(current==='span'?`<div style="grid-column:1/-1"><label class="preset-label" for="preset">Vector pair</label><select class="preset-select" id="preset"><option value="custom">Custom pair</option><option value="independent">Independent pair</option><option value="parallel">Parallel pair</option><option value="zero">Two zero vectors</option></select></div>`:'');
    if(current==='span') $('#preset').value=s.u.join()==='1,1'&&s.v.join()==='2,2' ? 'parallel' : s.u.join()==='1,0'&&s.v.join()==='0,1' ? 'independent' : s.u.every(v=>v===0)&&s.v.every(v=>v===0) ? 'zero' : 'custom';
  }
}
function svgLine(x1,y1,x2,y2,color,width=1,extra=''){return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${extra}/>`;}
function draw(){
  if(!pilotIds.includes(current)){
    const scene=renderScene(current,lessons[current],states[current],$('#show-grid').checked);
    $('#graph').innerHTML=scene.svg;$('#graph-text').textContent=scene.description;
    $('#result-label').textContent=current==='elimination'||current==='solutions'?'Solution':'Result';$('#result-equation').textContent=scene.equation;$('#result-caption').textContent=scene.caption;
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
  $('#result-label').textContent=matrixMode ? 'Transformed vector' : 'Combination';
  $('#result-equation').textContent=matrixMode ? `Av = ${vec(result)}` : `${fmt(s.a)} v₁ + ${fmt(s.b)} v₂ = ${vec(result)}`;
  $('#result-caption').textContent=matrixMode ? `det(A) = ${fmt(det(s.m))} · Area scale ${fmt(Math.abs(det(s.m)))} · ${r===2?'Invertible':r===1?'Plane collapses to a line':'Everything maps to the origin'}` : current==='span' ? `Span dimension: ${r} · ${r===2?'Independent pair · the whole plane':r===1?'Dependent pair · one line':'Dependent pair · just the origin'}` : 'Scale each vector, then add the coordinates. Dashed arrows show how the steps connect.';
  const legend=matrixMode ? [['teal','First column'],['purple','Second column'],['orange','Transformed v']] : [['teal','a × first vector'],['purple','b × second vector'],['orange','Your combination']];
  $('#legend').innerHTML=legend.map(([color,label])=>`<span class="legend-item"><span class="legend-line" style="color:${{teal:'#348a83',purple:'#9270ba',orange:'#ba6b3a'}[color]}"></span>${label}</span>`).join('');
}
function renderQuestions(){
  $('#questions').innerHTML=lessons[current].questions.map((q,i)=>{
    const order=i===0 ? [1,0,2] : [2,1,0];
    return `<form class="question${progress[current].includes(i)?' question-correct':''}" data-question="${i}"><h3>${q.title}</h3><p class="context">${q.context}</p><fieldset style="border:0;padding:0;margin:0"><legend class="sr-only">${q.title} ${q.context}</legend><div class="answer-options">${order.map(j=>`<label><input type="radio" name="question-${i}" value="${j}" ${progress[current].includes(i)&&j===q.correct?'checked':''}>${q.options[j]}</label>`).join('')}</div></fieldset><div class="question-actions"><button type="submit" class="primary-button">Check answer</button><button type="button" class="text-button" data-hint="${i}">Show hint</button></div><div class="feedback" role="status" ${progress[current].includes(i)?'':'hidden'}>${progress[current].includes(i)?q.feedback[q.correct]:''}</div></form>`;
  }).join('');
}
function loadLesson(id,scroll=false){
  if(pythonBusy)stopPython('Run stopped on lesson change.');
  current=id;
  const lesson=lessons[id], activity=experiments[id];
  const number=ids.indexOf(id)+1;
  $('#lesson-index').textContent=`Lesson ${number} of ${ids.length}`;
  $('#title').textContent=lesson.name;
  $('#intro').textContent=activity.purpose;
  $('#experiment-title').textContent=activity.question;
  $('#prepared').textContent=activity.prepared;
  $('#action').textContent=activity.action;
  $('#comparison').textContent=activity.compare;
  $('#notes-title').textContent=activity.notes;
  $('#notes-body').innerHTML=lesson.notes;
  $('#graph-type').textContent=id==='transformations'?'Transformed plane':pilotIds.includes(id)?'Coordinate diagram':'Experiment diagram';
  $('#lesson-path').innerHTML=lesson.prereq?.length?'Builds on '+lesson.prereq.map(key=>`<a href="#${key}">${lessons[key].name}</a>`).join(' · '):'No prior linear algebra needed. The course introduces coordinates, vectors and matrices here.';
  $('#grid-option').hidden=['arithmetic','elimination','matrixspace','decomposition'].includes(lesson.lab);
  $('#mission-text').textContent=missions[id].prompt;
  $('#mission-feedback').hidden=!missionProgress[id];
  $('#mission-feedback').classList.remove('incorrect');
  $('#mission-feedback').textContent=missionProgress[id]?'You passed this experiment check earlier.':'';
  $('#input-message').hidden=true;
  $('#resume-settings').hidden=same(states[id],lesson.initial);
  $('#undo-settings').hidden=!settingBackups[id];
  renderControls();draw();renderQuestions();updateProgress();persist();
  if(!$('#python-panel').hidden){
    syncPythonEditor();
    showPythonResult();
    showPythonStatus();
  }
  document.title=`${lesson.name} — Learn Linear Algebra`;
  if(scroll){$('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
}
function codeForExploration(){
  return pythonFor(current,lessons[current],states[current]);
}
function syncPythonEditor(){
  $('#python-code').value=codes[current]??codeForExploration();
  $('#undo-python').hidden=codeBackups[current]===null;
}
function showPythonResult(){
  const result=pythonResults.get(current);
  const message=result?.error??'';
  const previous=Boolean(result && result.source!==$('#python-code').value);
  $('#python-result').hidden=!result || !result.output;
  $('#python-output').textContent=result?.output??'';
  $('#python-output-context').hidden=!previous;
  $('#python-output-context').textContent='Output from the previous source. Run Python to update it.';
  $('#python-error').hidden=!message || previous;
  $('#python-error').textContent=message;
  if(pythonBusy && result?.source===pythonRun?.source)$('#python-output-context').hidden=true;
}
function showPythonStatus(){
  if(pythonBusy)return;
  const result=pythonResults.get(current);
  $('#python-status').textContent=result?.status??(pythonReady?'Choose Run Python to calculate.':'Python loads from this course. Save the offline copy before disconnecting.');
}
function finishPython(message){
  clearTimeout(workerTimer);
  const result=pythonResults.get(pythonRun?.id);
  if(result)result.status=message;
  pythonBusy=false;
  pythonRun=null;
  $('#run-python').disabled=false;
  $('#stop-python').hidden=true;
  $('#python-code').readOnly=false;
  for(const id of ['restore-python','undo-python'])$('#'+id).disabled=false;
  $('#python-status').textContent=message;
  if(codes[current]===null)syncPythonEditor();
  showPythonResult();
}
function stopPython(message='Run stopped. Choose Run Python to start again.'){
  worker?.terminate();
  worker=null;
  pythonReady=false;
  const focus=$('#stop-python')===document.activeElement;
  finishPython(message);
  if(focus)$('#run-python').focus({preventScroll:true});
}
function executePython(){
  const {id,source}=pythonRun;
  pythonResults.set(id,{source,output:'',error:''});
  showPythonResult();
  $('#python-status').textContent='Running Python in this browser…';
  worker.postMessage({type:'run',code:source});
  clearTimeout(workerTimer);
  workerTimer=setTimeout(()=>stopPython('Execution stopped after 60 seconds. Choose Run Python to start again.'),60000);
}
function startPython(){
  $('#python-status').textContent='Downloading or loading Python…';
  try {
    const runtime=new Worker(new URL('./python-worker.js',import.meta.url));
    worker=runtime;
    runtime.onmessage=({data})=>{
      if(worker!==runtime || !pythonRun)return;
      if(data.type==='ready'){pythonReady=true;executePython();return;}
      if(data.type==='init-error'){stopPython('Python could not load.');window.courseOffline?.experimentFilesUnavailable('Run Python');return;}
      const result=pythonResults.get(pythonRun.id);
      if(data.type==='stdout'&&result.output.length<50000){result.output+=data.text+'\n';showPythonResult();}
      if(data.type==='status')$('#python-status').textContent=data.text;
      if(data.type==='done'){
        if(!result.output)result.output='The code finished without printing a value.';
        finishPython('Python run finished.');
      }
      if(data.type==='error'){result.error=data.text;finishPython('Python run ended with an error.');if(data.category==='asset')window.courseOffline?.experimentFilesUnavailable('Run Python');}
    };
    runtime.onerror=()=>{stopPython('Python could not start.');window.courseOffline?.experimentFilesUnavailable('Run Python');};
    runtime.postMessage({type:'init'});
    workerTimer=setTimeout(()=>stopPython('Python took too long to load. Choose Run Python to try again.'),90000);
  } catch {
    stopPython('Python is unavailable in this browser. The visual experiments remain available.');
  }
}
function updateExperiment(){
  draw();
  if(!$('#python-panel').hidden && !pythonBusy){
    if(codes[current]===null)syncPythonEditor();
    showPythonResult();
  }
  persist();
}
function explainInput(input,message){
  input.setCustomValidity(message);
  input.setAttribute('aria-invalid',String(Boolean(message)));
  const status=$('#input-message');
  const invalid=$('#controls-body [aria-invalid="true"]');
  status.hidden=!invalid;
  status.textContent=invalid ? invalid.validationMessage+' The result uses the last accepted settings.' : '';
}
$('#controls-body').addEventListener('input',event=>{
  const input=event.target,s=states[current];
  if(input.dataset.key&&input.type!=='select-one'&&(input.type==='number'||input.type==='range')){
    const key=input.dataset.key;if(!(key in s))return;
    const value=input.valueAsNumber,min=Number(input.getAttribute('min')),max=Number(input.getAttribute('max')),step=Number(input.getAttribute('step'));
    if(!Number.isFinite(value)||value<min||value>max||(step&&Math.abs((value-min)/step-Math.round((value-min)/step))>1e-6)){explainInput(input,`Use a value from ${min} to ${max}${step?` in steps of ${step}`:""}.`);return;}
    explainInput(input,'');
    if(input.dataset.arrayIndex!==undefined)s[key][Number(input.dataset.arrayIndex)]=value;else s[key]=value;
    if(key==='m'||key==='b'){
      const field=key==='m'&&$('[data-key="matrixPreset"]')?'matrixPreset':'systemPreset';
      const preset=$(`[data-key="${field}"]`);
      if(preset){
        const choices=field==='matrixPreset'?advancedPresets:systemPresets;
        preset.value=Object.keys(choices).find(id=>field==='matrixPreset'?same(choices[id],s.m):
          same(choices[id].m,s.m)&&same(choices[id].b,s.b))||'custom';
      }
    }
    const valueLabel=$(`#lab-value-${key}`);if(valueLabel)valueLabel.textContent=fmt(value);updateExperiment();return;
  }
  if(input.dataset.scalar){s[input.dataset.scalar]=Number(input.value);$(`#value-${input.dataset.scalar}`).textContent=fmt(Number(input.value));updateExperiment();}
  if(input.dataset.field){
    const value=input.valueAsNumber;
    if(!Number.isFinite(value)||Math.abs(value)>3||!Number.isInteger(value*2)){explainInput(input,'Use a number from −3 to 3 in steps of 0.5.');return;}
    explainInput(input,'');s[input.dataset.field][Number(input.dataset.index)]=value;
    if($('#preset')){
      const choices=current==='transformations'?presets:vectorPairs;
      const values=current==='transformations'?s.m:[s.u,s.v];
      $('#preset').value=Object.keys(choices).find(key=>same(choices[key],values))||'custom';
    }
    updateExperiment();
  }
});
$('#controls-body').addEventListener('change',event=>{
  const key=event.target.dataset.key,s=states[current];
  if(key&&!pilotIds.includes(current)){
    if(event.target.tagName!=='SELECT'){if(key==='m'&&lessons[current].lab==='homogeneous'&&event.target.checkValidity())renderControls(true);return;}
    const value=event.target.value;
    if(key==='rowOp'){updateRowFields();return;}
    if(key==='matrixPreset'){if(value==='custom')return;s.m=[...advancedPresets[value]];}
    else if(key==='systemPreset'){if(value==='custom')return;Object.assign(s,structuredClone(systemPresets[value]));}
    else if(key in s)s[key]=typeof s[key]==='number'?Number(value):value;
    else return;
    renderControls(true);updateExperiment();return;
  }
  if(event.target.id!=='preset'||event.target.value==='custom')return;
  const preset=event.target.value;
  if(current==='transformations')states[current].m=[...presets[preset]];
  else {
    [states[current].u,states[current].v]=structuredClone(vectorPairs[preset]);
    states[current].a=1;states[current].b=0;
  }
  renderControls(true);updateExperiment();
});
$('#reset').addEventListener('click',()=>{
  if(!same(states[current],lessons[current].initial))settingBackups[current]=structuredClone(states[current]);
  states[current]=structuredClone(lessons[current].initial);
  $('#resume-settings').hidden=true;
  $('#undo-settings').hidden=!settingBackups[current];
  $('#input-message').hidden=true;
  renderControls();updateExperiment();
});
$('#undo-settings').addEventListener('click',()=>{
  if(!settingBackups[current])return;
  states[current]=settingBackups[current];
  settingBackups[current]=null;
  $('#undo-settings').hidden=true;
  $('#input-message').hidden=true;
  $('#reset').focus({preventScroll:true});
  renderControls();updateExperiment();
});
$('#show-grid').addEventListener('change',draw);
$('#questions').addEventListener('submit',event=>{
  event.preventDefault();const form=event.target,index=Number(form.dataset.question),q=lessons[current].questions[index];
  const selected=form.querySelector('input:checked'),feedback=form.querySelector('.feedback');feedback.hidden=false;
  if(!selected){feedback.textContent='Choose an answer before checking.';feedback.classList.add('incorrect');return;}
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
$('#next-bottom').addEventListener('click',goNext);
$('#previous-lesson').addEventListener('click',()=>{const index=ids.indexOf(current);if(index>0)location.hash=ids[index-1];});
$('#python-toggle').addEventListener('click',()=>{
  const opening=$('#python-panel').hidden;
  $('#python-panel').hidden=!opening;
  $('#python-toggle').setAttribute('aria-expanded',String(opening));
  $('#python-chevron').textContent=opening?'−':'＋';
  if(opening){if(!pythonBusy)syncPythonEditor();showPythonResult();showPythonStatus();}
});
$('#restore-python').addEventListener('click',()=>{
  if(codes[current]!==null)codeBackups[current]={code:codes[current]};
  codes[current]=null;
  syncPythonEditor();showPythonResult();persist();
  $('#python-status').textContent='Code restored from the current settings. Choose Run Python to calculate.';
});
$('#undo-python').addEventListener('click',()=>{
  if(!codeBackups[current])return;
  codes[current]=codeBackups[current].code;
  codeBackups[current]=null;
  syncPythonEditor();showPythonResult();persist();
  $('#python-code').focus({preventScroll:true});
  $('#python-status').textContent='Previous Python draft restored.';
});
$('#python-code').addEventListener('input',()=>{
  codes[current]=$('#python-code').value;
  showPythonResult();persist();
});
$('#python-code').addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();$('#run-python').click();}
});
$('#run-python').addEventListener('click',()=>{
  if(pythonBusy)return;
  pythonRun={id:current,source:$('#python-code').value};
  pythonBusy=true;
  $('#run-python').disabled=true;
  $('#stop-python').hidden=false;
  $('#python-code').readOnly=true;
  for(const id of ['restore-python','undo-python'])$('#'+id).disabled=true;
  if(pythonReady)executePython();else startPython();
});
$('#stop-python').addEventListener('click',()=>stopPython());
document.querySelectorAll('[data-export]').forEach(button=>button.addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({format:STORAGE_KEY,exportedAt:new Date().toISOString(),...snapshot()},null,2)],{type:'application/json'});
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
    renderControls(true);updateExperiment();
    if($('#row-operation-status')&&message)$('#row-operation-status').textContent=message;
  }catch(error){if($('#row-operation-status'))$('#row-operation-status').textContent=error.message;}
});
$('#check-mission').addEventListener('click',()=>{
  const feedback=$('#mission-feedback');feedback.hidden=false;
  const invalid=[...$('#controls-body').querySelectorAll('input[type="number"]')].find(input=>!Number.isFinite(input.valueAsNumber)||(input.checkValidity&&!input.checkValidity()));
  if(invalid){feedback.textContent='Correct the highlighted input before checking the experiment.';feedback.classList.add('incorrect');invalid.reportValidity();return;}
  const success=missions[current].check(states[current]);
  feedback.classList.toggle('incorrect',!success);
  feedback.textContent=success?'Your settings satisfy this challenge.':'The result above describes the current settings. To satisfy this challenge, try the hint. '+missions[current].hint;
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
    let kept=0;
    for(const id of ids){
      if(validFor(id,imported.states?.[id])){
        if(same(states[id],lessons[id].initial))states[id]=structuredClone(imported.states[id]);
        else if(!same(states[id],imported.states[id]))kept++;
      }
      if(!settingBackups[id]&&validFor(id,imported.settingBackups?.[id]))settingBackups[id]=structuredClone(imported.settingBackups[id]);
      if(Array.isArray(imported.progress?.[id]))progress[id]=[...new Set([...progress[id],...imported.progress[id].filter(n=>n===0||n===1)])];
      if(imported.missions?.[id]===true||(!imported.missions&&pilotIds.includes(id)&&[0,1].every(index=>imported.progress?.[id]?.includes(index))))missionProgress[id]=true;
      if(typeof imported.codes?.[id]==='string'){
        const code=imported.codes[id].slice(0,100000);
        if(codes[id]===null)codes[id]=code;
        else if(codes[id]!==code)kept++;
      }
      const backup=imported.codeBackups?.[id];
      if(!codeBackups[id]&&backup&&(backup.code===null||typeof backup.code==='string'))codeBackups[id]={code:backup.code?.slice(0,100000)??null};
    }
    loadLesson(current);
    $('#import-status').textContent='Progress imported and merged.'+(kept?` Kept ${kept} current ${kept===1?'edit':'edits'} where this file contains a different version.`:'');
  }catch(error){$('#import-status').textContent='Import failed: '+error.message;}
  importInput.value='';
});
window.courseOffline?.registerReading('linear-algebra',{
 isBusy:()=>pythonBusy,
 save:()=>{persist();if(worker&&!pythonBusy){worker.terminate();worker=null;pythonReady=false;}return {state:structuredClone(snapshot()),lastSaved,pythonOpen:!$('#python-panel').hidden,results:[...pythonResults]};},
 restore:value=>{lastSaved=value.lastSaved;const data=value.state;for(const [target,key]of [[states,'states'],[progress,'progress'],[missionProgress,'missions'],[codes,'codes'],[settingBackups,'settingBackups'],[codeBackups,'codeBackups']])Object.assign(target,data[key]);pythonResults.clear();for(const [id,result]of value.results||[])pythonResults.set(id,result);$('#python-panel').hidden=!value.pythonOpen;$('#python-toggle').setAttribute('aria-expanded',String(!!value.pythonOpen));loadLesson(data.current);if(!$('#python-panel').hidden){syncPythonEditor();showPythonResult();showPythonStatus();}}
});
renderNavigation();
window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(ids.includes(id))loadLesson(id,true);});
const initialId=location.hash.slice(1);
loadLesson(ids.includes(initialId)?initialId:ids.includes(saved.current)?saved.current:'vectors');

await window.courseOffline?.completeReadingSetup();
