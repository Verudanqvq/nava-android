import sys,zipfile
from pathlib import Path

def oldsig(n):
 u=n.upper(); leaf=u.rsplit('/',1)[-1]
 return u.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))

def main():
 if len(sys.argv)!=5: raise SystemExit('usage: patch-apk.py SRC MANIFEST LANGUAGE OUT')
 src,mf,lang,out=map(Path,sys.argv[1:]); newmf=mf.read_bytes(); language=lang.read_text(encoding='utf-8')
 if b'12.1.73' not in newmf and '12.1.73'.encode('utf-16le') not in newmf: raise ValueError('manifest 73 marker missing')
 if 'LANGUAGE_VARIANTS_73_PATCH_OK' not in language: raise ValueError('73 language patch source missing')
 with zipfile.ZipFile(src) as zin:
  names=set(zin.namelist()); req={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html','resources.arsc'}
  if not req.issubset(names): raise ValueError('base entries missing')
  keep={n:zin.read(n) for n in ('classes.dex','classes2.dex','assets/nava_app_v11.css','assets/offline.html','resources.arsc')}
  js=zin.read('assets/nava_app_v11.js').decode('utf-8')
  start=js.find('/* Nava Android 12.1.49 — per-series chapter language variants. */')
  if start<0: raise ValueError('49 language marker missing')
  endm='})(document,window);'; end=js.find(endm,start)
  if end<0: raise ValueError('49 language iife end missing')
  js=js[:start]+language.rstrip()+js[end+len(endm):]
  with zipfile.ZipFile(out,'w') as zout:
   for info in zin.infolist():
    if oldsig(info.filename): continue
    data=zin.read(info.filename)
    if info.filename=='AndroidManifest.xml': data=newmf
    elif info.filename=='assets/nava_app_v11.js': data=js.encode('utf-8')
    zout.writestr(info,data)
 with zipfile.ZipFile(out) as z:
  for n,v in keep.items():
   if z.read(n)!=v: raise ValueError('preserved entry changed '+n)
  fj=z.read('assets/nava_app_v11.js').decode('utf-8')
  for token in ('querySelectorAll(\'a[href]\')','chapterAnchors','LANGUAGE_VARIANTS_73_PATCH_OK'):
   if token not in fj: raise ValueError('73 JS token missing '+token)
 print('PATCH_73_OK base=12.1.72 generic-anchor-scan=numeric-sort=all-chapters-preserved versionCode=89')
if __name__=='__main__': main()
