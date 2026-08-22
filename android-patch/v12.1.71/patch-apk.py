import sys,zipfile
from pathlib import Path

def oldsig(name):
    u=name.upper(); leaf=u.rsplit('/',1)[-1]
    return u.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))

def main():
    if len(sys.argv)!=5: raise SystemExit('usage: patch-apk.py SRC CLASSES2 MANIFEST OUT')
    src,c2f,mf,out=map(Path,sys.argv[1:]); newc2=c2f.read_bytes(); newmf=mf.read_bytes()
    for token in (b'NavaDownloadService70',b'downloadOne71',b'submitBatch63',b'seriesRelations63'):
        if token not in newc2: raise ValueError('classes2 token missing '+token.decode())
    if b'12.1.71' not in newmf and '12.1.71'.encode('utf-16le') not in newmf: raise ValueError('manifest 12.1.71 marker missing')
    with zipfile.ZipFile(src) as zin:
        names=set(zin.namelist()); req={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html','resources.arsc'}
        if not req.issubset(names): raise ValueError('base entries missing')
        keep={n:zin.read(n) for n in ('classes.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html','resources.arsc')}; c3=zin.read('classes3.dex') if 'classes3.dex' in names else None
        with zipfile.ZipFile(out,'w') as zout:
            for info in zin.infolist():
                if oldsig(info.filename): continue
                data=zin.read(info.filename)
                if info.filename=='AndroidManifest.xml': data=newmf
                elif info.filename=='classes2.dex': data=newc2
                zout.writestr(info,data)
    with zipfile.ZipFile(out) as z:
        for n,v in keep.items():
            if z.read(n)!=v: raise ValueError('preserved entry changed '+n)
        if c3 is not None and z.read('classes3.dex')!=c3: raise ValueError('classes3 changed')
    print('PATCH_71_OK base=12.1.70 retries=3 service=foreground versionName=12.1.71 versionCode=87 preserved-assets=ok')
if __name__=='__main__': main()
