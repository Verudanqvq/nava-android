import hashlib,struct,sys,zipfile
from pathlib import Path
RES_STRING_POOL_TYPE=0x0001;RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.64';NEW_VERSION='12.1.65';NEW_CODE=81
SOURCE_SHA='148c92d8fe93625fad3f4ef2b74cd9456d6a26bf23989010bfcf49fd0f2243ca'
BAD64='/* Nava Android 12.1.64 — downloaded overlay visibility + scroll fail-safe. */'
OLD_LANG='/* Nava Android 12.1.49 — per-series chapter language variants. */'
NEW_LANG='/* Nava Android 12.1.65 — restored per-series TR/EN/JP/KR/CN reader language engine. */'
END='})(document,window);'
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
def replace_iife(js,marker,new):
 start=js.find(marker)
 if start<0:raise ValueError('marker missing '+marker)
 end=js.find(END,start)
 if end<0:raise ValueError('iife end missing '+marker)
 return js[:start]+(new.rstrip()+'\n' if new else '')+js[end+len(END):]
def oldsig(name):
 u=name.upper();leaf=u.rsplit('/',1)[-1];return u.startswith('META-INF/') and(leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))
def main():
 if len(sys.argv)!=4:raise SystemExit('usage: patch-apk.py SRC LANG65 OUT')
 src,langf,out=sys.argv[1:];srcp=Path(src);got=hashlib.sha256(srcp.read_bytes()).hexdigest()
 if got.lower()!=SOURCE_SHA:raise ValueError('source must be signed Nava 12.1.64; sha256='+got)
 lang=Path(langf).read_text(encoding='utf-8')
 if NEW_LANG not in lang:raise ValueError('65 language marker missing')
 with zipfile.ZipFile(srcp) as zin:
  req={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html','resources.arsc'}
  if not req.issubset(set(zin.namelist())):raise ValueError('base entries missing')
  c1=zin.read('classes.dex');c2=zin.read('classes2.dex');c3=zin.read('classes3.dex') if 'classes3.dex' in zin.namelist() else None;res=zin.read('resources.arsc');css=zin.read('assets/nava_app_v11.css');off=zin.read('assets/offline.html')
  js=zin.read('assets/nava_app_v11.js').decode('utf-8')
  if '/* Nava Android 12.1.63 — relation-aware downloaded library: one Eser > Cilt > Bölüm tree. */' not in js:raise ValueError('63 library missing')
  js=replace_iife(js,BAD64,'')
  js=replace_iife(js,OLD_LANG,lang)
  manifest=patch_manifest(zin.read('AndroidManifest.xml'))
  with zipfile.ZipFile(out,'w') as zout:
   for info in zin.infolist():
    if oldsig(info.filename):continue
    data=zin.read(info.filename)
    if info.filename=='AndroidManifest.xml':data=manifest
    elif info.filename=='assets/nava_app_v11.js':data=js.encode('utf-8')
    zout.writestr(info,data)
 with zipfile.ZipFile(out) as z:
  if z.read('classes.dex')!=c1 or z.read('classes2.dex')!=c2:raise ValueError('native dex changed')
  if c3 is not None and z.read('classes3.dex')!=c3:raise ValueError('classes3 changed')
  if z.read('resources.arsc')!=res or z.read('assets/nava_app_v11.css')!=css or z.read('assets/offline.html')!=off:raise ValueError('preserved asset changed')
  fj=z.read('assets/nava_app_v11.js').decode('utf-8')
  if BAD64 in fj or '__navaLibraryOverlayFixV12164' in fj:raise ValueError('64 capture interceptor still present')
  for t in (NEW_LANG,'nava-reader-language-v12165','NavaSeriesLanguageV12149','filterDownloadItems','w.navaOpenDownloads=show','nava-offline-browser-v12163','nava-download-hub-v12149'):
   if t not in fj:raise ValueError('required token missing '+t)
 print('PATCH_OK versionName=12.1.65 versionCode=81 base=12.1.64 capture64=removed language65=restored library63=preserved native=byte-preserved')
if __name__=='__main__':main()
