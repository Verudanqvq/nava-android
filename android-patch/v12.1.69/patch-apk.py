import hashlib,struct,sys,zipfile
from pathlib import Path

RES_STRING_POOL_TYPE=0x0001;RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.68';NEW_VERSION='12.1.69';NEW_CODE=85
SOURCE_SHA='c7e4b6c9c11d1bb2e5782b7641101a236a2c2bc9bb3fe34cac89e6565a2fb194'
MARK='/* Nava Android 12.1.69 — zero-safe order + all-language download batch + storage trim. */'

OLD_VOL_TREE="Array.from(series.volumes.values()).sort(function(a,b){return(Number(a.no)||99999)-(Number(b.no)||99999)})"
NEW_VOL_TREE="Array.from(series.volumes.values()).sort(function(a,b){return((String(a.no==null?'':a.no).trim()!==''&&isFinite(Number(a.no)))?Number(a.no):99999)-((String(b.no==null?'':b.no).trim()!==''&&isFinite(Number(b.no)))?Number(b.no):99999)})"
OLD_CH_TREE="v.chapters.sort(function(a,b){return(Number(a.chapterNo)||999999)-(Number(b.chapterNo)||999999)})"
NEW_CH_TREE="v.chapters.sort(function(a,b){return((String(a.chapterNo==null?'':a.chapterNo).trim()!==''&&isFinite(Number(a.chapterNo)))?Number(a.chapterNo):999999)-((String(b.chapterNo==null?'':b.chapterNo).trim()!==''&&isFinite(Number(b.chapterNo)))?Number(b.chapterNo):999999)})"
OLD_PICKER="out.sort(function(a,b){return(Number(a.volumeNo)||9999)-(Number(b.volumeNo)||9999)})"
NEW_PICKER="out.sort(function(a,b){return((String(a.volumeNo==null?'':a.volumeNo).trim()!==''&&isFinite(Number(a.volumeNo)))?Number(a.volumeNo):9999)-((String(b.volumeNo==null?'':b.volumeNo).trim()!==''&&isFinite(Number(b.volumeNo)))?Number(b.volumeNo):9999)})"
OLD_COUNT="v.chapters.length+' bölüm'"
NEW_COUNT="(new Set(v.chapters.map(function(r){return String(r.chapterNo||r.item&&r.item.url||'')}))).size+' bölüm'"
OLD_FILTER="""function filterDownloadItems(items,name){items=Array.isArray(items)?items.slice():[];var chapters=items.filter(function(x){return x&&x.kind==='chapter'}),other=items.filter(function(x){return !x||x.kind!=='chapter'});if(!chapters.length)return items;var groups=new Map(),selected=getSelected(name,LANGS);chapters.forEach(function(x){var rec=state.index.byUrl[canon(x.url)],k=rec?((rec.volumeKey||'novol')+'|'+rec.chapterNo):('url|'+canon(x.url));if(!groups.has(k))groups.set(k,[]);groups.get(k).push({item:x,rec:rec})});groups.forEach(function(g){var exact=g.find(function(x){return x.rec&&x.rec.lang===selected}),tr=g.find(function(x){return x.rec&&x.rec.lang==='TR'}),chosen=exact||tr||g[0];other.push(chosen.item)});return other}"""
NEW_FILTER="""function filterDownloadItems(items,name){items=Array.isArray(items)?items.slice():[];var out=[],seen=Object.create(null);function add(x){var u=canon(x&&x.url);if(!u||seen[u])return;seen[u]=1;out.push(x)}items.forEach(function(x){if(!x||x.kind!=='chapter'){add(x);return}var rec=state.index.byUrl[canon(x.url)];if(!rec){add(x);return}var key=(rec.volumeKey||'novol')+'|'+rec.chapterNo,rows=(state.index.groups&&state.index.groups[key]||[rec]).slice(),langs=LANGS.filter(function(l){return rows.some(function(r){return r.lang===l})}),multi=langs.length>1;langs.forEach(function(lang){rows.forEach(function(r){if(r.lang===lang)add({url:r.url,title:(r.title||x.title)+(multi?' • '+lang:''),seriesTitle:x.seriesTitle,kind:'chapter',chapterNo:r.chapterNo})})})});return out}"""

def u16(d,o):return struct.unpack_from('<H',d,o)[0]
def u32(d,o):return struct.unpack_from('<I',d,o)[0]
def p32(d,o,v):struct.pack_into('<I',d,o,v)
def len8(d,p):
 f=d[p];p+=1;return((((f&0x7f)<<8)|d[p],p+1)if f&0x80 else(f,p))
def len16(d,p):
 f=u16(d,p);p+=2;return((((f&0x7fff)<<16)|u16(d,p),p+2)if f&0x8000 else(f,p))
def pool(d,off):
 hs=u16(d,off+2);n=u32(d,off+8);flags=u32(d,off+16);ss=u32(d,off+20);utf8=bool(flags&0x100);out=[]
 for i in range(n):
  p=off+ss+u32(d,off+hs+i*4)
  if utf8:_,p=len8(d,p);bl,p=len8(d,p);out.append(bytes(d[p:p+bl]).decode('utf-8','replace'))
  else:ln,p=len16(d,p);out.append(bytes(d[p:p+ln*2]).decode('utf-16le','replace'))
 return out
def patch_manifest(raw):
 d=bytearray(raw);before=bytes(d);d[:]=d.replace(OLD_VERSION.encode(),NEW_VERSION.encode());d[:]=d.replace(OLD_VERSION.encode('utf-16le'),NEW_VERSION.encode('utf-16le'))
 if bytes(d)==before:raise ValueError('versionName marker missing')
 off=u16(d,2);total=u32(d,4);strings=None;done=False
 while off+8<=min(total,len(d)):
  typ=u16(d,off);hs=u16(d,off+2);size=u32(d,off+4)
  if size<8:raise ValueError('bad manifest chunk')
  if typ==RES_STRING_POOL_TYPE and strings is None:strings=pool(d,off)
  elif typ==RES_XML_START_ELEMENT_TYPE and strings:
   ext=off+hs;idx=u32(d,ext+4);elem=strings[idx] if idx<len(strings) else''
   if elem=='manifest':
    ast=u16(d,ext+8);asz=u16(d,ext+10);ac=u16(d,ext+12);base=ext+ast
    for i in range(ac):
     a=base+i*asz;ni=u32(d,a+4);name=strings[ni] if ni<len(strings) else''
     if name=='versionCode':p32(d,a+16,NEW_CODE);done=True
    break
  off+=size
 if not done:raise ValueError('versionCode missing')
 return bytes(d)
def once(s,a,b,label):
 if s.count(a)!=1:raise ValueError(label+' patch point count='+str(s.count(a)))
 return s.replace(a,b,1)
def oldsig(name):
 u=name.upper();leaf=u.rsplit('/',1)[-1];return u.startswith('META-INF/') and(leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))
def main():
 if len(sys.argv)!=4:raise SystemExit('usage: patch-apk.py SRC CLASSES2 OUT')
 src,c2f,out=sys.argv[1:];srcp=Path(src);got=hashlib.sha256(srcp.read_bytes()).hexdigest()
 if got.lower()!=SOURCE_SHA:raise ValueError('source must be signed Nava 12.1.68; sha256='+got)
 newc2=Path(c2f).read_bytes()
 for t in (b'submitBatch63',b'seriesRelations63',b'Nava:OfflineDownload63'):
  if t not in newc2:raise ValueError('classes2 token missing '+t.decode())
 with zipfile.ZipFile(srcp) as zin:
  req={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html','resources.arsc'}
  if not req.issubset(set(zin.namelist())):raise ValueError('base entries missing')
  c1=zin.read('classes.dex');oldc2=zin.read('classes2.dex');c3=zin.read('classes3.dex') if 'classes3.dex' in zin.namelist() else None
  res=zin.read('resources.arsc');css=zin.read('assets/nava_app_v11.css');off=zin.read('assets/offline.html')
  js=zin.read('assets/nava_app_v11.js').decode('utf-8')
  js=once(js,OLD_VOL_TREE,NEW_VOL_TREE,'volume tree zero-sort')
  js=once(js,OLD_CH_TREE,NEW_CH_TREE,'chapter tree zero-sort')
  js=once(js,OLD_PICKER,NEW_PICKER,'volume picker zero-sort')
  js=once(js,OLD_COUNT,NEW_COUNT,'unique chapter count')
  js=once(js,OLD_FILTER,NEW_FILTER,'all-language batch')
  js=js.rstrip()+'\n'+MARK+'\n'
  manifest=patch_manifest(zin.read('AndroidManifest.xml'))
  with zipfile.ZipFile(out,'w') as zout:
   for info in zin.infolist():
    if oldsig(info.filename):continue
    data=zin.read(info.filename)
    if info.filename=='AndroidManifest.xml':data=manifest
    elif info.filename=='classes2.dex':data=newc2
    elif info.filename=='assets/nava_app_v11.js':data=js.encode('utf-8')
    zout.writestr(info,data)
 with zipfile.ZipFile(out) as z:
  if z.read('classes.dex')!=c1:raise ValueError('classes.dex changed unexpectedly')
  if z.read('classes2.dex')==oldc2:raise ValueError('classes2 did not change')
  if c3 is not None and z.read('classes3.dex')!=c3:raise ValueError('classes3 changed unexpectedly')
  if z.read('resources.arsc')!=res or z.read('assets/nava_app_v11.css')!=css or z.read('assets/offline.html')!=off:raise ValueError('preserved asset changed')
  fj=z.read('assets/nava_app_v11.js').decode('utf-8')
  for old in (OLD_VOL_TREE,OLD_CH_TREE,OLD_PICKER,OLD_COUNT,OLD_FILTER):
   if old in fj:raise ValueError('old 68 contract survived')
  for token in (MARK,'isFinite(Number(a.chapterNo))','isFinite(Number(a.volumeNo))','state.index.groups','seen=Object.create(null)',"multi?' • '+lang",'new Set(v.chapters.map'):
   if token not in fj:raise ValueError('69 JS token missing '+token)
  if fj.count('w.navaOpenDownloads=show')!=1:raise ValueError('download renderer ownership changed')
 print('PATCH_OK versionName=12.1.69 versionCode=85 base=12.1.68 zero-sort=ok all-languages=ok language-labels=ok unique-count=ok storage-trim=ok')
if __name__=='__main__':main()
