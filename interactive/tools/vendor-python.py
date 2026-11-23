"""Fetch build-time dependencies from the committed checksum lock. No browser CDN fallback."""
from pathlib import Path
import concurrent.futures, hashlib, json, urllib.request, time
root=Path(__file__).resolve().parent.parent
lock=json.loads((root/'tools/python-assets.json').read_text())
out=root/'dist/vendor/pyodide';out.mkdir(parents=True,exist_ok=True)
def fetch(item):
 p=out/item['path'];expected=item['sha256']
 if p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()==expected:return
 for attempt in range(3):
  try:
   data=urllib.request.urlopen(item['url'],timeout=120).read()
   if hashlib.sha256(data).hexdigest()!=expected:raise ValueError('Checksum mismatch: '+item['path'])
   p.write_bytes(data);return
  except Exception:
   if attempt==2:raise
   time.sleep(attempt+1)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(fetch,lock['files']))
# Keep only the supported, bundled package graph. Unsupported imports fail locally.
index=out/'pyodide-lock.json';data=json.loads(index.read_text());data['packages']={n:v for n,v in data['packages'].items() if n in lock['packages']};index.write_text(json.dumps(data)+'\n')
print('Bundled Python '+lock['version']+' and '+str(len(lock['packages']))+' packages')
