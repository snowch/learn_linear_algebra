/* Dedicated worker: learner code never blocks the lesson interface. */
let pyodide;
let ready;
self.onmessage = async ({data}) => {
  if(data.type==='init') {
    if(ready) return;
    ready = (async()=>{
      try {
        importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js');
        pyodide = await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'});
        pyodide.setStdout({batched:text=>postMessage({type:'stdout',text})});
        pyodide.setStderr({batched:text=>postMessage({type:'stdout',text})});
        postMessage({type:'ready'});
      } catch(error) { postMessage({type:'init-error',text:String(error)}); throw error; }
    })();
    ready.catch(()=>{});
  }
  if(data.type==='run') {
    try {
      await ready;
      if(!pyodide) throw new Error('Python is not ready. Stop and reopen the panel to retry.');
      postMessage({type:'status',text:'Loading any required packages…'});
      await pyodide.loadPackagesFromImports(data.code);
      postMessage({type:'status',text:'Running locally…'});
      const result = await pyodide.runPythonAsync(data.code);
      if(result!==undefined && result!==null) {
        postMessage({type:'stdout',text:String(result)});
        if(typeof result.destroy==='function') result.destroy();
      }
      postMessage({type:'done'});
    } catch(error) { postMessage({type:'error',text:String(error)}); }
  }
};
