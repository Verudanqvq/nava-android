import hashlib,struct,sys,zipfile
from pathlib import Path

RES_STRING_POOL_TYPE=0x0001
RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.55';NEW_VERSION='12.1.57';NEW_CODE=73
SOURCE_SHA='265f9b4ec7757848cb4a9f5056a2d4ffe0c7c44935235abd88243230e90c5b2e'
BASE_MARK='/* Nava Android 12.1.55 — persistent delegated series-download interceptor + live feed join. */'
NEW_MARK='/* Nava Android 12.1.57 — integrated picker footer + strict duplicate blocking. */'
CSS_MARK='/* Nava Android 12.1.57 — stable mobile picker footer without observer overlay. */'
OLD_DOWNLOADED="function downloaded(){var m={};try{var j=JSON.parse(w.NavaOffline.listDownloads()||'{}');(j.items||[]).forEach(function(x){var u=canon(x&&x.url);if(u)m[u]=1})}catch(_){}return m}"
NEW_DOWNLOADED="function downloaded(){var m={};try{var j=JSON.parse(w.NavaOffline.listDownloads()||'{}');(j.items||[]).forEach(function(x){var u=canon(x&&x.url);if(u)m[u]=1})}catch(_){}try{var q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');if(Array.isArray(q))q.forEach(function(x){var u=canon(x&&x.url),s=clean(x&&x.status,30).toLowerCase();if(u&&s!=='error')m[u]=1})}catch(_){}return m}"

def u16(d,o): return struct.unpack_from('<H',d,o)[0]
def u32(d,o): return struct.unpack_from('<I',d,o)[0]
def p32(d,o,v): struct.pack_into('<I',d,o,v)
def len8(d,p):
    f=d[p];p+=1
    return ((((f&0x7f)<<8)|d[p],p+1) if f&0x80 else (f,p))
def len16(d,p):
    f=u16(d,p);p+=2
    return ((((f&0x7fff)<<16)|u16(d,p),p+2) if f&0x8000 else (f,p))
def pool(d,off):
    hs=u16(d,off+2);n=u32(d,off+8);flags=u32(d,off+16);ss=u32(d,off+20);utf8=bool(flags&0x100);out=[]
    for i in range(n):
        p=off+ss+u32(d,off+hs+i*4)
        if utf8:
            _,p=len8(d,p);bl,p=len8(d,p);out.append(bytes(d[p:p+bl]).decode('utf-8','replace'))
        else:
            ln,p=len16(d,p);out.append(bytes(d[p:p+ln*2]).decode('utf-16le','replace'))
    return out

def patch_manifest(raw):
    d=bytearray(raw);before=bytes(d)
    d[:]=d.replace(OLD_VERSION.encode(),NEW_VERSION.encode())
    d[:]=d.replace(OLD_VERSION.encode('utf-16le'),NEW_VERSION.encode('utf-16le'))
    if bytes(d)==before: raise ValueError('versionName marker missing')
    off=u16(d,2);total=u32(d,4);strings=None;done=False
    while off+8<=min(total,len(d)):
        typ=u16(d,off);hs=u16(d,off+2);size=u32(d,off+4)
        if size<8: raise ValueError('bad manifest chunk')
        if typ==RES_STRING_POOL_TYPE and strings is None: strings=pool(d,off)
        elif typ==RES_XML_START_ELEMENT_TYPE and strings:
            ext=off+hs;idx=u32(d,ext+4);elem=strings[idx] if idx<len(strings) else ''
            if elem=='manifest':
                ast=u16(d,ext+8);asz=u16(d,ext+10);ac=u16(d,ext+12);base=ext+ast
                for i in range(ac):
                    a=base+i*asz;ni=u32(d,a+4);name=strings[ni] if ni<len(strings) else ''
                    if name=='versionCode': p32(d,a+16,NEW_CODE);done=True
                break
        off+=size
    if not done: raise ValueError('versionCode missing')
    return bytes(d)

def oldsig(name):
    u=name.upper();leaf=u.rsplit('/',1)[-1]
    return u.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))

def once(s,a,b,label):
    if a not in s: raise ValueError('missing JS patch point: '+label)
    return s.replace(a,b,1)

def main():
    if len(sys.argv)!=4: raise SystemExit('usage: patch-apk.py SRC CSS OUT')
    src,cssf,out=sys.argv[1:]
    srcp=Path(src);got=hashlib.sha256(srcp.read_bytes()).hexdigest()
    if got.lower()!=SOURCE_SHA: raise ValueError('source must be signed Nava 12.1.55; sha256='+got)
    cssfix=Path(cssf).read_text(encoding='utf-8')
    if CSS_MARK not in cssfix: raise ValueError('12.1.57 css marker missing')
    with zipfile.ZipFile(srcp) as zin:
        req={'AndroidManifest.xml','classes.dex','assets/nava_app_v11.js','assets/nava_app_v11.css'}
        if not req.issubset(set(zin.namelist())): raise ValueError('required apk entries missing')
        manifest=patch_manifest(zin.read('AndroidManifest.xml'))
        dex=zin.read('classes.dex')
        if b'NavaAndroidApp/12.1.47' not in dex: raise ValueError('known-good 12.1.47 UA missing')
        if any(v in dex for v in (b'NavaAndroidApp/12.1.55',b'NavaAndroidApp/12.1.56',b'NavaAndroidApp/12.1.57')): raise ValueError('native UA unexpectedly changed')
        js=zin.read('assets/nava_app_v11.js').decode('utf-8')
        css=zin.read('assets/nava_app_v11.css').decode('utf-8')
        if BASE_MARK not in js: raise ValueError('12.1.55 runtime base missing')
        if '__navaPickerPolishV12156' in js: raise ValueError('12.1.56 observer overlay must not be in 12.1.55 source')
        js=once(js,BASE_MARK,NEW_MARK,'runtime marker')
        js=js.replace('__navaPersistentDownloadV12155','__navaPersistentDownloadV12157')
        js=js.replace('nava-series-download-picker-v12155','nava-series-download-picker-v12157')
        js=js.replace('_nava55=','_nava57=')
        js=once(js,'<span>12.1.55 • canlı Blogger feed</span>','<span>Ciltleri seç</span>','picker subtitle')
        js=once(js,'data-picker-status>12.1.55 hazır.</div>','data-picker-status></div>','picker debug status')
        js=once(js,"x.textContent='12.1.55 • '+(t||'');","x.textContent=t||'';",'status prefix')
        js=once(js,OLD_DOWNLOADED,NEW_DOWNLOADED,'downloaded + queue dedupe')
        js=js.replace('Nava 12.1.55 discover','Nava 12.1.57 discover').replace('Nava 12.1.55 download','Nava 12.1.57 download')
        css=css.rstrip()+'\n\n'+cssfix.strip()+'\n'
        with zipfile.ZipFile(out,'w') as zout:
            for info in zin.infolist():
                if oldsig(info.filename): continue
                data=zin.read(info.filename)
                if info.filename=='AndroidManifest.xml': data=manifest
                elif info.filename=='classes.dex': data=dex
                elif info.filename=='assets/nava_app_v11.js': data=js.encode('utf-8')
                elif info.filename=='assets/nava_app_v11.css': data=css.encode('utf-8')
                zout.writestr(info,data)
    with zipfile.ZipFile(out) as z:
        fj=z.read('assets/nava_app_v11.js').decode('utf-8');fc=z.read('assets/nava_app_v11.css').decode('utf-8');fd=z.read('classes.dex')
        for token in (NEW_MARK,'__navaPersistentDownloadV12157','nava-series-download-picker-v12157',"localStorage.getItem(QUEUE_KEY)",'downloadBatch'):
            if token not in fj: raise ValueError('final JS token missing '+token)
        if '12.1.55 • canlı Blogger feed' in fj or '__navaPickerPolishV12156' in fj: raise ValueError('old debug/observer overlay leaked into final JS')
        if CSS_MARK not in fc or '#nava-series-download-picker-v12157' not in fc: raise ValueError('final CSS footer override missing')
        if b'NavaAndroidApp/12.1.47' not in fd or b'NavaAndroidApp/12.1.57' in fd: raise ValueError('native UA preservation failed')
    print('PATCH_OK versionName=12.1.57 versionCode=73 base=12.1.55 nativeUA=12.1.47 footer=integrated dedupe=downloaded-plus-queue observer=none')
if __name__=='__main__': main()
