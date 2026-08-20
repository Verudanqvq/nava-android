import hashlib,struct,sys,zipfile
from pathlib import Path

RES_STRING_POOL_TYPE=0x0001
RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.41'
NEW_VERSION='12.1.42'
NEW_CODE=58
OLD_PUSH='/* Nava v12.1.41 — direct native FCM registration. */'
NEW_PUSH='/* Nava v12.1.42 — direct native FCM registration. */'
OLD_OFFLINE='/* Nava Android 12.1.41 — hierarchical offline library. */'
NEW_OFFLINE='/* Nava Android 12.1.42 — hierarchical offline library + bulk delete. */'
OLD_COMPAT='/* Nava Android 12.1.39 — restore volume navigation + clear all notifications. */'
NEW_COMPAT='/* Nava Android 12.1.42 — volume navigation + reliable mobile notification deletion. */'
MENU_MARKER='/* Nava Android 12.1.41 — download center metadata + content-type neutral hierarchy. */'
CSS_MARKER='/* Nava Android 12.1.42 — offline bulk-delete styles. */'

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

def replace_iife(js,marker,new_text):
    start=js.find(marker)
    if start<0: raise ValueError('marker missing: '+marker)
    end_marker='})(document,window);'
    end=js.find(end_marker,start)
    if end<0: raise ValueError('IIFE end missing: '+marker)
    end+=len(end_marker)
    return js[:start]+new_text.rstrip()+js[end:]

def oldsig(name):
    u=name.upper();leaf=u.rsplit('/',1)[-1]
    return u.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))

def main():
    if len(sys.argv)!=10: raise SystemExit('usage: patch-apk.py SRC DEX PUSH OFFLINE_JS COMPAT_JS OFFLINE_CSS OFFLINE_HTML OUT EXPECTED_SHA')
    src,dexf,pushf,offlinejsf,compatf,cssf,offlinef,out,expected=sys.argv[1:]
    srcp=Path(src);got=hashlib.sha256(srcp.read_bytes()).hexdigest()
    if got.lower()!=expected.lower(): raise ValueError('source sha mismatch '+got)
    dex=Path(dexf).read_bytes();push=Path(pushf).read_text();offlinejs=Path(offlinejsf).read_text();compat=Path(compatf).read_text();newcss=Path(cssf).read_text();offline=Path(offlinef).read_bytes()
    if not dex.startswith(b'dex\n') or b'NavaAndroidApp/12.1.42' not in dex: raise ValueError('patched dex invalid')
    if NEW_PUSH not in push or "appVersion:'12.1.42'" not in push: raise ValueError('push source invalid')
    if NEW_OFFLINE not in offlinejs or 'Eseri sil' not in offlinejs or 'Cildi sil' not in offlinejs or 'queueBulkDelete' not in offlinejs: raise ValueError('offline JS invalid')
    if NEW_COMPAT not in compat or 'data-nava-notification-ids' not in compat or 'Tümünü sil' not in compat: raise ValueError('notification compat invalid')
    if CSS_MARKER not in newcss or 'nava-offline-group-delete-v12142' not in newcss: raise ValueError('offline CSS invalid')
    html=offline.decode('utf-8')
    if '<h1>İndirilenler</h1>' not in html or 'data-delete-series' not in html or 'data-delete-volume' not in html: raise ValueError('offline HTML bulk delete invalid')
    if 'Tekrar bağlan' in html or 'Yalnız Wi' in html: raise ValueError('duplicate offline controls remain')
    with zipfile.ZipFile(srcp) as zin:
        names=set(zin.namelist())
        required={'AndroidManifest.xml','classes.dex','classes2.dex','classes3.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html'}
        if not required.issubset(names): raise ValueError('required APK entries missing')
        manifest=patch_manifest(zin.read('AndroidManifest.xml'))
        js=zin.read('assets/nava_app_v11.js').decode('utf-8')
        if MENU_MARKER not in js: raise ValueError('12.1.41 download menu missing')
        js=replace_iife(js,OLD_PUSH,push)
        js=replace_iife(js,OLD_OFFLINE,offlinejs)
        js=replace_iife(js,OLD_COMPAT,compat)
        css=zin.read('assets/nava_app_v11.css').decode('utf-8')
        if CSS_MARKER in css: raise ValueError('offline CSS already present')
        css=css.rstrip()+'\n\n'+newcss.strip()+'\n'
        with zipfile.ZipFile(out,'w') as zout:
            for info in zin.infolist():
                if oldsig(info.filename): continue
                data=zin.read(info.filename)
                if info.filename=='AndroidManifest.xml': data=manifest
                elif info.filename=='classes.dex': data=dex
                elif info.filename=='assets/nava_app_v11.js': data=js.encode()
                elif info.filename=='assets/nava_app_v11.css': data=css.encode()
                elif info.filename=='assets/offline.html': data=offline
                zout.writestr(info,data)
    allowed={'AndroidManifest.xml','classes.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html'}
    with zipfile.ZipFile(srcp) as a,zipfile.ZipFile(out) as b:
        fj=b.read('assets/nava_app_v11.js').decode();fc=b.read('assets/nava_app_v11.css').decode();fh=b.read('assets/offline.html').decode();fd=b.read('classes.dex')
        if NEW_PUSH not in fj or NEW_OFFLINE not in fj or NEW_COMPAT not in fj or MENU_MARKER not in fj: raise ValueError('final JS replacements missing')
        if OLD_OFFLINE in fj or OLD_COMPAT in fj: raise ValueError('old patched blocks remain')
        if CSS_MARKER not in fc: raise ValueError('final offline CSS missing')
        if 'Eseri sil' not in fj or 'Cildi sil' not in fj or 'Tümünü sil' not in fj: raise ValueError('bulk/delete UI missing')
        if 'data-delete-series' not in fh or 'data-delete-volume' not in fh: raise ValueError('final offline HTML invalid')
        for token in ('#6d28d9','#7c3aed','#8b5cf6','#5b20f3','#4c1d95','#c4b5fd','#ddd6fe','#ede9fe','#f5f3ff'):
            if token.lower() in newcss.lower() or token.lower() in fh.lower(): raise ValueError('purple token in 12.1.42 offline UI '+token)
        if b'NavaAndroidApp/12.1.42' not in fd: raise ValueError('UA missing')
        if b.read('classes2.dex')!=a.read('classes2.dex'): raise ValueError('offline runtime changed unexpectedly')
        if b.read('classes3.dex')!=a.read('classes3.dex'): raise ValueError('notification helper changed unexpectedly')
        for name in a.namelist():
            if oldsig(name) or name in allowed: continue
            if name not in b.namelist() or a.read(name)!=b.read(name): raise ValueError('unexpected changed entry '+name)
    print('PATCH_OK versionCode=58 versionName=12.1.42 offline=bulk-delete notifications=mobile-delete-fix scoped=ok')

if __name__=='__main__': main()
