// Real cold Python execution with all network destinations outside this lab denied.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const types={'.js':'application/javascript','.mjs':'application/javascript','.wasm':'application/wasm','.html':'text/html','.css':'text/css','.json':'application/json','.zip':'application/zip'};
(async()=>{
 const root=path.resolve('dist');
 const server=http.createServer(async(req,res)=>{try{const name=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(name!==root&&!name.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const file=name===root?path.join(root,'index.html'):name;res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/';
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const context=await browser.newContext(),blocked=[],failures=[];
  await context.route('**/*',r=>{if(!r.request().url().startsWith(base)){blocked.push(r.request().url());return r.abort();}return r.continue()});
  context.on('response',r=>{if(r.status()>=400)failures.push([r.status(),r.url()])});
  const page=await context.newPage();await page.goto(base,{waitUntil:'domcontentloaded'});
  const runs=await page.evaluate(async(kind)=>{if(kind==='probability'){const {pythonExamples}=await import('./python-examples.js');const w=new Worker('./python-worker.js',{type:'module'}),results=[];for(const [id,example] of Object.entries(pythonExamples)){const result=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Timed out '+id)),120000);w.onerror=e=>{clearTimeout(timeout);reject(Error(e.message))};w.onmessage=({data})=>{if(['result','error'].includes(data.type)){clearTimeout(timeout);resolve({id,type:data.type,message:data.message,figures:data.figures?.length,output:data.output})}};w.postMessage({id,code:example.code,packages:example.packages})});results.push(result);if(result.type==='error')break;}w.terminate();return results;}const w=new Worker('./python-worker.js'),results=[];await new Promise((resolve,reject)=>{w.onmessage=({data})=>{if(data.type==='ready')resolve();if(data.type==='init-error')reject(Error(data.text))};w.postMessage({type:'init'})});for(const code of ['from sympy import Matrix\nprint(Matrix([[1,2],[3,4]]).det())','import numpy as np\nprint(np.linalg.svd(np.eye(2))[1])']){const output=[];const r=await new Promise(resolve=>{w.onmessage=({data})=>{if(data.type==='stdout')output.push(data.text);if(['done','error'].includes(data.type))resolve({type:data.type,text:data.text,output})};w.postMessage({type:'run',code})});results.push(r)}w.terminate();return results;}, "linear");
  assert.deepEqual(blocked,[],'No third-party request may be attempted');assert.deepEqual(failures,[],'Every required local asset must load');
  for(const run of runs)assert.notEqual(run.type,'error',JSON.stringify(run));
  assert.equal(runs.length,2);console.log('Self-hosted Python: '+runs.length+' checks passed; no external or failed requests');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
