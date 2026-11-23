"""Reject third-party resource tags and CSS loads in a generated course."""
from html.parser import HTMLParser
from pathlib import Path
import re,sys
errors=[]
class Assets(HTMLParser):
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);key={'script':'src','img':'src','iframe':'src','source':'src','audio':'src','video':'src','object':'data','embed':'src'}.get(tag)
  if tag=='link' and any(x in a.get('rel','').split() for x in ['stylesheet','preload','modulepreload','icon','manifest']):key='href'
  if key and a.get(key,'').startswith(('https:','http:','//')):errors.append(f'{page}: external {tag} {a[key]}')
  if a.get('srcset') and re.search(r'(?:https?:)?//',a['srcset']):errors.append(f'{page}: external srcset')
root=Path(sys.argv[1]);pages=[p for p in root.rglob('*') if p.is_file() and (p.suffix=='.html' or not p.suffix and p.read_bytes()[:40].lower().startswith((b'<!doctype html',b'<html')))]
if not pages:raise SystemExit('No generated HTML to check')
for page in pages:
 if 'vendor' in page.relative_to(root).parts:continue
 Assets().feed(page.read_text())
for page in root.rglob('*.css'):
 for url in re.findall(r'(?:url\(\s*[\"\']?|@import\s*[\"\'])([^\s\"\')]+)',page.read_text()):
  if url.startswith(('http:','https:','//')):errors.append(f'{page}: external CSS resource {url}')
if errors:raise SystemExit('\n'.join(errors))
print(f'Self-hosted resource tags and stylesheets checked in {len(pages)} HTML files')
