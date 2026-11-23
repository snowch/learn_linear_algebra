"""Bundle pinned upstream theme resources before publishing. Learners use this site only."""
from pathlib import Path
import hashlib,io,json,re,sys,tarfile,urllib.request
root=Path(__file__).resolve().parent.parent
out=Path(sys.argv[1]);base=sys.argv[2].rstrip('/')
manifest=json.loads((root/'scripts/browser-assets.json').read_text())
cache=root/'.cache/browser-assets';cache.mkdir(parents=True,exist_ok=True)
for item in manifest:
 p=cache/(item['name']+'-'+item['version']+'.tgz')
 if not p.exists():p.write_bytes(urllib.request.urlopen(item['url'],timeout=120).read())
 if hashlib.sha256(p.read_bytes()).hexdigest()!=item['sha256']:raise ValueError('Checksum mismatch: '+p.name)
 target=out/'vendor'/item['name'];target.mkdir(parents=True,exist_ok=True)
 with tarfile.open(p) as archive:
  for member in archive.getmembers():
   if not member.name.startswith('package/'):continue
   member.name=member.name[len('package/'):]
   if not member.name:continue
   archive.extract(member,target,filter='data')
replacements={
 'https://cdn.jsdelivr.net/npm/jupyter-matplotlib@0.11.3/css/mpl_widget.css':base+'/vendor/jupyter-matplotlib/css/mpl_widget.css',
 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.css':base+'/vendor/font-awesome/css/font-awesome.css',
 'https://cdn.jsdelivr.net/npm/katex@0.15.2/dist/katex.min.css':base+'/vendor/katex/dist/katex.min.css',
 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js':base+'/vendor/requirejs/require.js',
 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/MathJax.js':base+'/vendor/mathjax/MathJax.js',
 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js':base+'/vendor/mathjax/es5/tex-mml-chtml.js',
 'https://unpkg.com/thebe@0.8.2/lib/index.js':base+'/vendor/thebe/lib/index.js',
 # The book has no executable widget cells. Keep the theme's unused module loader
 # local too, so later additions cannot silently fall back to a third-party CDN.
 'https://cdn.jsdelivr.net/npm/':base+'/vendor/npm/',
}
count=0
for path in out.rglob('*'):
 if not path.is_file() or 'vendor' in path.relative_to(out).parts or path.suffix not in {'','.html','.js','.css','.json'}:continue
 s=path.read_text();original=s
 if path.suffix in {'','.html'}:
  seen=set()
  def unique_thebe(match):
   block=match.group(0)
   if 'THEBE_JS_URL' not in block:return block
   if block in seen:return ''
   seen.add(block);return block
  s=re.sub(r'<script\b[^>]*>.*?</script>', unique_thebe, s, flags=re.S)
 if path.suffix in {'','.html'}:
  s=re.sub(r'<img\b[^>]*src=["\']https://mirrors\.creativecommons\.org/presskit/buttons/88x31/png/by-nc-sa\.png["\'][^>]*>', "<span>CC BY-NC-SA 4.0</span>", s)
 for before,after in replacements.items():s=s.replace(before,after)
 # Byte-identical third-party CSS keeps its original integrity attribute.
 if s!=original:path.write_text(s);count+=1
print('Self-hosted theme assets; updated',count,'generated files')
