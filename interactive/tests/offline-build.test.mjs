import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {verifyOfflineBuild} from '../scripts/verify-offline-build.mjs';
test('every promised offline byte is present; HTML pins the local control and all runtime loaders stay local',async()=>{
 const root=".build/site",release=await verifyOfflineBuild(root);
 assert(release.bytes>5000000);assert(!release.files.some(f=>f.path==='.nojekyll'));
 for(const file of release.files.filter(f=>f.path.endsWith('.html'))){const html=await readFile(root+'/'+file.path,'utf8');assert.match(html,/id="app-status-open"/);assert.match(html,/aria-label="App status and offline access"/);assert.match(html,new RegExp('releases/'+release.id+'/offline.mjs'));}
 for(const file of release.files.filter(f=>/\/pyodide\.(?:js|mjs)$/.test(f.path))){const code=await readFile(root+'/releases/'+release.id+'/'+file.path,'utf8');assert(code.includes('n.setCdnUrl(r.indexURL)'));assert(!code.includes('n.setCdnUrl(`https://cdn.jsdelivr.net/'));}
});
