import hashlib,struct,sys,zipfile
from pathlib import Path
RES_STRING_POOL_TYPE=0x0001;RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.63';NEW_VERSION='12.1.64';NEW_CODE=80
SOURCE_SHA='042029c2a68ac77169292d9ad20d7ad168e131367c90986505de6b894f9b23a4'
JS_MARK='/* Nava Android 12.1.64 — downloaded overlay visibility + scroll fail-safe. */'
CSS_MARK='/* Nava Android 12.1.64 — make v12163 downloaded library a real fullscreen overlay. */'

def u16(d,o):return struct.unpack_from('<H',d,o)[0]
def u32(d,o):return struct.unpack_from('<I',d,o)[0]
def p32(d,o,v):struct.pack_into('<I',d,o,v)
def len8(d,p):
 f=d[p];p+=1;return ((((f&0x7f)<<8)|d[p],p+1) if f&0x80 else (f,p))
def len16(d,p):
 f=u16(d,p);p+=2;return ((((f&0x7fff)<<16)|u16(d,p),p+2) if f&0x8000 else (f,p))
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
   ext=off+hs;idx=u32(d,ext+4);elem=strings[idx] if idx<len(strings) else ''
   if elem=='manifest':
    ast=u16(d,ext+8);asz=u16(d,ext+10);ac=u16(d,ext+12);base=ext+ast
    for i in range(ac):
     a=base+i*asz;ni=u32(d,a+4);name=strings[ni] if ni<len(strings) else ''
     if name=='versionCode':p32(d,a+16,NEW_CODE);done=True
    break
  off+=size
 if not done:raise ValueError('versionCode missing')
 return bytes(d)
def oldsig(name):
 u=name.upper();leaf=u.rsplit('/',1)[-1];return u.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))
def main():
 if len(sys.argv)!=5:raise SystemExit('usage: patch-apk.py SRC FIXJS CSS OUT')
 src,jsf,cssf,out=sys.argv[1:];srcp=Path(src);got=hashlib.sha256(srcp.read_bytes()).hexdigest()
 if got.lower()!=SOURCE_SHA:raise ValueError('source must be signed Nava 12.1.63; sha256='+got)
 addjs=Path(jsf).read_text(encoding='utf-8').strip();addcss=Path(cssf).read_text(encoding='utf-8').strip()
 if JS_MARK not in addjs or CSS_MARK not in addcss:raise ValueError('64 marker missing')
 with zipfile.ZipFile(srcp) as zin:
  names=set(zin.namelist());req={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html','resources.arsc'}
  if not req.issubset(names):raise ValueError('required entries missing '+str(req-names))
  manifest=patch_manifest(zin.read('AndroidManifest.xml'));c1=zin.read('classes.dex');c2=zin.read('classes2.dex');c3=zin.read('classes3.dex') if 'classes3.dex' in names else None;res=zin.read('resources.arsc');off=zin.read('assets/offline.html')
  if b'StartupOverlay61' not in c1 or b'Nava-Android/12.1.60' not in c1 or b'NavaAndroidApp/12.1.47' not in c1:raise ValueError('stable classes.dex markers missing')
  if b'seriesRelations63' not in c2 or b'PowerManager' not in c2:raise ValueError('63 runtime markers missing')
  js=zin.read('assets/nava_app_v11.js').decode('utf-8').rstrip()+'\n\n'+addjs+'\n';css=zin.read('assets/nava_app_v11.css').decode('utf-8').rstrip()+'\n\n'+addcss+'\n'
  with zipfile.ZipFile(out,'w') as zout:
   for info in zin.infolist():
    if oldsig(info.filename):continue
    data=zin.read(info.filename)
    if info.filename=='AndroidManifest.xml':data=manifest
    elif info.filename=='assets/nava_app_v11.js':data=js.encode('utf-8')
    elif info.filename=='assets/nava_app_v11.css':data=css.encode('utf-8')
    zout.writestr(info,data)
 with zipfile.ZipFile(out) as z:
  if z.read('classes.dex')!=c1 or z.read('classes2.dex')!=c2:raise ValueError('native dex changed')
  if c3 is not None and z.read('classes3.dex')!=c3:raise ValueError('classes3 changed')
  if z.read('resources.arsc')!=res:raise ValueError('resources changed')
  if z.read('assets/offline.html')!=off:raise ValueError('offline asset changed')
  fj=z.read('assets/nava_app_v11.js').decode('utf-8');fc=z.read('assets/nava_app_v11.css').decode('utf-8')
  for t in (JS_MARK,'__navaLibraryOverlayFixV12164','nava-offline-browser-v12163','verifyOpen'):
   if t not in fj:raise ValueError('JS token missing '+t)
  for t in (CSS_MARK,'#nava-offline-browser-v12163[hidden]','#nava-offline-browser-v12163{position:fixed'):
   if t not in fc:raise ValueError('CSS token missing '+t)
 print('PATCH_OK versionName=12.1.64 versionCode=80 base=12.1.63 overlay=v12163 scrollFailSafe=yes native=byte-preserved')
if __name__=='__main__':main()
