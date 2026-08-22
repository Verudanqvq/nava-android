import hashlib,sys,zipfile
from pathlib import Path
SOURCE_SHA='8018f27ddcaf0f23924ab5be2717bdf39dd8faa37e49ae99998d2acbe4ba9484'
JS_MARK='/* Nava Android 12.1.63 — relation-aware downloaded library: one Eser > Cilt > Bölüm tree. */'

def oldsig(name):
    u=name.upper();leaf=u.rsplit('/',1)[-1]
    return u.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))
def sha(b): return hashlib.sha256(b).hexdigest()
def main():
    if len(sys.argv)!=7: raise SystemExit('usage: patch-apk.py SRC MANIFEST CLASSES2 LIBJS OFFLINE OUT')
    src,manifestf,c2f,jsf,offlinef,out=sys.argv[1:]
    srcp=Path(src);got=hashlib.sha256(srcp.read_bytes()).hexdigest()
    if got.lower()!=SOURCE_SHA: raise ValueError('source must be signed Nava 12.1.62; sha256='+got)
    manifest=Path(manifestf).read_bytes();newc2=Path(c2f).read_bytes();addjs=Path(jsf).read_text(encoding='utf-8').strip();offline=Path(offlinef).read_bytes()
    if JS_MARK not in addjs: raise ValueError('63 library marker missing')
    for token in (b'NavaDownloadService63',b'submitBatch63',b'seriesRelations63'):
        if token not in newc2: raise ValueError('classes2 token missing '+token.decode())
    with zipfile.ZipFile(srcp) as zin:
        names=set(zin.namelist());req={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/offline.html','resources.arsc'}
        if not req.issubset(names): raise ValueError('base APK entries missing '+str(req-names))
        c1=zin.read('classes.dex');oldc2=zin.read('classes2.dex');c3=zin.read('classes3.dex') if 'classes3.dex' in names else None;res=zin.read('resources.arsc')
        if b'StartupOverlay61' not in c1 or b'Nava-Android/12.1.60' not in c1 or b'NavaAndroidApp/12.1.47' not in c1: raise ValueError('stable classes.dex markers missing')
        js=zin.read('assets/nava_app_v11.js').decode('utf-8').rstrip()+'\n\n'+addjs+'\n'
        with zipfile.ZipFile(out,'w') as zout:
            for info in zin.infolist():
                if oldsig(info.filename): continue
                data=zin.read(info.filename)
                if info.filename=='AndroidManifest.xml': data=manifest
                elif info.filename=='classes2.dex': data=newc2
                elif info.filename=='assets/nava_app_v11.js': data=js.encode('utf-8')
                elif info.filename=='assets/offline.html': data=offline
                zout.writestr(info,data)
    with zipfile.ZipFile(out) as z:
        if z.read('classes.dex')!=c1: raise ValueError('classes.dex changed unexpectedly')
        if c3 is not None and z.read('classes3.dex')!=c3: raise ValueError('classes3.dex changed unexpectedly')
        if z.read('resources.arsc')!=res: raise ValueError('resources.arsc changed unexpectedly')
        if z.read('classes2.dex')==oldc2: raise ValueError('classes2.dex did not change')
        fj=z.read('assets/nava_app_v11.js').decode('utf-8');fo=z.read('assets/offline.html').decode('utf-8')
        for t in (JS_MARK,'__navaDownloadedLibraryV12163','getSeriesRelations','setSeriesRelations','looksVolume'):
            if t not in fj: raise ValueError('final JS token missing '+t)
        if 'İndirilenler' not in fo or 'getSeriesRelations' not in fo or 'isVol' not in fo: raise ValueError('63 offline library invalid')
    print('PATCH_OK versionName=12.1.63 versionCode=79 base=12.1.62 library=relation-aware background=foreground-service native=classes2 webview=preserved')
if __name__=='__main__': main()
