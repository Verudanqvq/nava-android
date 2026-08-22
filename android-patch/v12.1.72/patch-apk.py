import sys,zipfile
from pathlib import Path

def oldsig(name):
    u=name.upper(); leaf=u.rsplit('/',1)[-1]
    return u.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))

def main():
    if len(sys.argv)!=6: raise SystemExit('usage: patch-apk.py SRC CLASSES2 MANIFEST UIJS OUT')
    src,c2f,mf,uif,out=map(Path,sys.argv[1:]); newc2=c2f.read_bytes(); newmf=mf.read_bytes(); overlay=uif.read_text(encoding='utf-8')
    for token in (b'NavaDownloadService70',b'downloadOne71',b'QUEUE72',b'getDownloadQueue72',b'submitBatch63'):
        if token not in newc2: raise ValueError('classes2 token missing '+token.decode())
    if b'12.1.72' not in newmf and '12.1.72'.encode('utf-16le') not in newmf: raise ValueError('manifest 12.1.72 marker missing')
    with zipfile.ZipFile(src) as zin:
        names=set(zin.namelist()); req={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html','resources.arsc'}
        if not req.issubset(names): raise ValueError('base entries missing')
        c1=zin.read('classes.dex'); c3=zin.read('classes3.dex') if 'classes3.dex' in names else None; res=zin.read('resources.arsc'); css=zin.read('assets/nava_app_v11.css'); off=zin.read('assets/offline.html'); oldjs=zin.read('assets/nava_app_v11.js')
        js=oldjs.decode('utf-8')
        if '__navaDownloadStateV12172' in js: raise ValueError('72 UI already present')
        js=js.rstrip()+'\n'+overlay.rstrip()+'\n'
        with zipfile.ZipFile(out,'w') as zout:
            for info in zin.infolist():
                if oldsig(info.filename): continue
                data=zin.read(info.filename)
                if info.filename=='AndroidManifest.xml': data=newmf
                elif info.filename=='classes2.dex': data=newc2
                elif info.filename=='assets/nava_app_v11.js': data=js.encode('utf-8')
                zout.writestr(info,data)
    with zipfile.ZipFile(out) as z:
        if z.read('classes.dex')!=c1: raise ValueError('classes1 changed')
        if c3 is not None and z.read('classes3.dex')!=c3: raise ValueError('classes3 changed')
        if z.read('resources.arsc')!=res or z.read('assets/nava_app_v11.css')!=css or z.read('assets/offline.html')!=off: raise ValueError('preserved asset changed')
        fj=z.read('assets/nava_app_v11.js').decode('utf-8')
        for token in ('__navaDownloadStateV12172','getDownloadQueue72','groupKey','nativeQueue','collapseSearch','stopImmediatePropagation','filterDownloadItems.__v12172'):
            if token not in fj: raise ValueError('72 JS token missing '+token)
        if not fj.startswith(oldjs.decode('utf-8').rstrip()): raise ValueError('legacy JS changed instead of layered override')
    print('PATCH_72_OK base=12.1.71 native-queue=ok compact-search=layered explicit-metadata=ok versionName=12.1.72 versionCode=88')
if __name__=='__main__': main()
