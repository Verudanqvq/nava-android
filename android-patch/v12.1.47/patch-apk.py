import hashlib,struct,sys,zipfile
from pathlib import Path
RES_STRING_POOL_TYPE=0x0001;RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.41';NEW_VERSION='12.1.47';NEW_CODE=63
OLD_PUSH='/* Nava v12.1.41 — direct native FCM registration. */';NEW_PUSH='/* Nava v12.1.47 — direct native FCM registration. */'
OLD_OFFLINE='/* Nava Android 12.1.41 — hierarchical offline library. */';NEW_OFFLINE='/* Nava Android 12.1.47 — flat file-browser offline library. */'
OLD_MENU='/* Nava Android 12.1.41 — download center metadata + content-type neutral hierarchy. */';NEW_MENU='/* Nava Android 12.1.47 — topbar download control, no page-flow blocks. */'
OLD_COMPAT='/* Nava Android 12.1.39 — restore volume navigation + clear all notifications. */';NEW_COMPAT='/* Nava Android 12.1.47 — stable volume navigation + notification deletion. */'
LANG_MARK='/* Nava Android 12.1.47 — work language filter TR/EN/JP/KR/CN. */';OLD_CSS='/* Nava Android 12.1.41 — hierarchical offline library styles. */';NEW_CSS='/* Nava Android 12.1.47 — repaired chrome, topbar download, flat offline browser, language filter. */'
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
 endm='})(document,window);';end=js.find(endm,start)
 if end<0:raise ValueError('iife end missing '+marker)
 return js[:start]+new.rstrip()+js[end+len(endm):]
def oldsig(name):
 u=name.upper();leaf=u.rsplit('/',1)[-1];return u.startswith('META-INF/') and(leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))
def main():
 if len(sys.argv)!=12:raise SystemExit('usage: patch-apk.py SRC DEX PUSH OFFLINE MENU COMPAT LANG CSS OFFLINE_HTML OUT EXPECTED_SHA')
 src,dexf,pushf,offjsf,menuf,compatf,langf,cssf,htmlf,out,expected=sys.argv[1:]
 srcp=Path(src);got=hashlib.sha256(srcp.read_bytes()).hexdigest()
 if got.lower()!=expected.lower():raise ValueError('source sha mismatch '+got)
 dex=Path(dexf).read_bytes();push=Path(pushf).read_text();offjs=Path(offjsf).read_text();menu=Path(menuf).read_text();compat=Path(compatf).read_text();lang=Path(langf).read_text();cssnew=Path(cssf).read_text();offline=Path(htmlf).read_bytes()
 if not dex.startswith(b'dex\n') or b'NavaAndroidApp/12.1.47' not in dex:raise ValueError('patched dex invalid')
 checks=[(push,NEW_PUSH),(offjs,NEW_OFFLINE),(menu,NEW_MENU),(compat,NEW_COMPAT),(lang,LANG_MARK),(cssnew,NEW_CSS)]
 for text,mark in checks:
  if mark not in text:raise ValueError('source marker missing '+mark)
 for token in ('nava-download-top-v12147','nava-download-pop-v12147','navaOpenDownloads'):
  if token not in menu+offjs:raise ValueError('download token missing '+token)
 for token in ('Tümü','TR','EN','JP','KR','CN'):
  if token not in lang:raise ValueError('language option missing '+token)
 html=offline.decode('utf-8')
 if '<strong>İndirilenler</strong>' not in html or 'data-series-delete' not in html or 'data-volume-delete' not in html:raise ValueError('offline html invalid')
 with zipfile.ZipFile(srcp) as zin:
  req={'AndroidManifest.xml','classes.dex','classes2.dex','classes3.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html'}
  if not req.issubset(set(zin.namelist())):raise ValueError('required apk entries missing')
  manifest=patch_manifest(zin.read('AndroidManifest.xml'));js=zin.read('assets/nava_app_v11.js').decode('utf-8');js=replace_iife(js,OLD_PUSH,push);js=replace_iife(js,OLD_OFFLINE,offjs);js=replace_iife(js,OLD_MENU,menu);js=replace_iife(js,OLD_COMPAT,compat);js=js.rstrip()+'\n\n'+lang.strip()+'\n';css=zin.read('assets/nava_app_v11.css').decode('utf-8');pos=css.find(OLD_CSS)
  if pos>=0:css=css[:pos].rstrip()
  css=css.rstrip()+'\n\n'+cssnew.strip()+'\n'
  with zipfile.ZipFile(out,'w') as zout:
   for info in zin.infolist():
    if oldsig(info.filename):continue
    data=zin.read(info.filename)
    if info.filename=='AndroidManifest.xml':data=manifest
    elif info.filename=='classes.dex':data=dex
    elif info.filename=='assets/nava_app_v11.js':data=js.encode()
    elif info.filename=='assets/nava_app_v11.css':data=css.encode()
    elif info.filename=='assets/offline.html':data=offline
    zout.writestr(info,data)
 allowed={'AndroidManifest.xml','classes.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html'}
 with zipfile.ZipFile(srcp) as a,zipfile.ZipFile(out) as b:
  fj=b.read('assets/nava_app_v11.js').decode();fc=b.read('assets/nava_app_v11.css').decode();fh=b.read('assets/offline.html').decode();fd=b.read('classes.dex')
  for mark in(NEW_PUSH,NEW_OFFLINE,NEW_MENU,NEW_COMPAT,LANG_MARK):
   if mark not in fj:raise ValueError('final js marker missing '+mark)
  for mark in(OLD_OFFLINE,OLD_MENU,OLD_COMPAT):
   if mark in fj:raise ValueError('old js block remains '+mark)
  if NEW_CSS not in fc or OLD_CSS in fc:raise ValueError('css replacement failed')
  for token in('nava-download-top-v12147','nava-download-pop-v12147','nava-offline-browser-v12147','nava-language-filter-v12147'):
   if token not in fj+fc:raise ValueError('new ui missing '+token)
  if 'İndirme sırası' in fj or 'Bu cildi tamamen indir' in fj or 'Tüm ciltleri indir' in fj:raise ValueError('old download ux remains')
  if 'data-series-delete' not in fh or 'data-volume-delete' not in fh:raise ValueError('offline delete menus missing')
  if b'NavaAndroidApp/12.1.47' not in fd:raise ValueError('ua missing')
  if b.read('classes2.dex')!=a.read('classes2.dex') or b.read('classes3.dex')!=a.read('classes3.dex'):raise ValueError('native helper changed unexpectedly')
  for name in a.namelist():
   if oldsig(name) or name in allowed:continue
   if name not in b.namelist() or a.read(name)!=b.read(name):raise ValueError('unexpected changed entry '+name)
 print('PATCH_OK versionCode=63 versionName=12.1.47 topbar=repaired download=topbar-popover offline=flat-tree language=TR-EN-JP-KR-CN scoped=ok')
if __name__=='__main__':main()
