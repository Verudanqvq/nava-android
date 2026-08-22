import sys,zipfile
from pathlib import Path

def oldsig(name):
    u=name.upper(); leaf=u.rsplit('/',1)[-1]
    return u.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))

def once(s,a,b,label):
    if s.count(a)!=1: raise ValueError(label+' patch point count='+str(s.count(a)))
    return s.replace(a,b,1)

def replace_iife(js,marker,new):
    start=js.find(marker)
    if start<0: raise ValueError('offline iife marker missing')
    endm='})(document,window);'; end=js.find(endm,start)
    if end<0: raise ValueError('offline iife end missing')
    return js[:start]+new.rstrip()+js[end+len(endm):]

def main():
    if len(sys.argv)!=6: raise SystemExit('usage: patch-apk.py SRC CLASSES2 MANIFEST UIJS OUT')
    src,c2f,mf,uif,out=map(Path,sys.argv[1:]); newc2=c2f.read_bytes(); newmf=mf.read_bytes(); overlay=uif.read_text(encoding='utf-8')
    for token in (b'NavaDownloadService70',b'downloadOne71',b'QUEUE72',b'getDownloadQueue72',b'submitBatch63'):
        if token not in newc2: raise ValueError('classes2 token missing '+token.decode())
    if b'12.1.72' not in newmf and '12.1.72'.encode('utf-16le') not in newmf: raise ValueError('manifest 12.1.72 marker missing')

    offline=Path('android-patch/v12.1.49/offline-ui.js').read_text(encoding='utf-8')
    oldmeta="var st=clean(i.seriesTitle,400),tt=clean(i.title,400),sl=slugText(i.url),mix=[st,tt,sl].join(' '),kind=String(i.kind||'').toLowerCase(),vn=no(mix,'volume'),cn=no(mix,'chapter'),series='';"
    newmeta="var st=clean(i.seriesTitle,400),sv=clean(i.seriesName,400),vm=clean(i.volumeNo,40),cm=clean(i.chapterNo,40),tt=clean(i.title,400),sl=slugText(i.url),mix=[st,tt,sl].join(' '),kind=String(i.kind||'').toLowerCase(),vn=vm||no(mix,'volume'),cn=cm||no(mix,'chapter'),series='';"
    offline=once(offline,oldmeta,newmeta,'downloaded metadata fields')
    offline=once(offline,"if(!junk(st))series=strip(st);","if(!junk(sv))series=sv;else if(!junk(st))series=strip(st);",'downloaded explicit series')
    offline=once(offline,"s.querySelector('[data-offline-search]').oninput=render;","s.querySelector('[data-offline-search]').oninput=function(){state.seriesOpen=Object.create(null);state.volumeOpen=Object.create(null);render()};",'compact search reset')
    offline=once(offline,"open=q?true:!!state.seriesOpen[sk]","open=!!state.seriesOpen[sk]",'search series compact')
    offline=once(offline,"openV=q?true:!!state.volumeOpen[vk]","openV=!!state.volumeOpen[vk]",'search volume compact')
    oldsort="Array.from(series.volumes.values()).sort(function(a,b){return(Number(no(a.name,'volume'))||9999)-(Number(no(b.name,'volume'))||9999)})"
    newsort="Array.from(series.volumes.values()).sort(function(a,b){var av=no(a.name,'volume'),bv=no(b.name,'volume'),an=String(av).trim()!==''&&isFinite(Number(av))?Number(av):9999,bn=String(bv).trim()!==''&&isFinite(Number(bv))?Number(bv):9999;return an-bn})"
    offline=once(offline,oldsort,newsort,'downloaded volume zero sort')

    with zipfile.ZipFile(src) as zin:
        names=set(zin.namelist()); req={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html','resources.arsc'}
        if not req.issubset(names): raise ValueError('base entries missing')
        c1=zin.read('classes.dex'); c3=zin.read('classes3.dex') if 'classes3.dex' in names else None; res=zin.read('resources.arsc'); css=zin.read('assets/nava_app_v11.css'); off=zin.read('assets/offline.html')
        js=zin.read('assets/nava_app_v11.js').decode('utf-8')
        js=replace_iife(js,'/* Nava Android 12.1.49 — reliable downloaded library and deletion. */',offline)
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
        for token in ('__navaDownloadStateV12172','getDownloadQueue72','sv=clean(i.seriesName,400)','vm=clean(i.volumeNo,40)','cm=clean(i.chapterNo,40)','open=!!state.seriesOpen[sk]','openV=!!state.volumeOpen[vk]'):
            if token not in fj: raise ValueError('72 JS token missing '+token)
        if 'open=q?true:!!state.seriesOpen[sk]' in fj or 'openV=q?true:!!state.volumeOpen[vk]' in fj: raise ValueError('old auto-open search survived')
    print('PATCH_72_OK base=12.1.71 native-queue=ok compact-search=ok explicit-metadata=ok versionName=12.1.72 versionCode=88')
if __name__=='__main__': main()
