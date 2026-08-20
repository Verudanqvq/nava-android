import hashlib,struct,sys,zipfile
from pathlib import Path

RES_STRING_POOL_TYPE=0x0001
RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.37'
NEW_VERSION='12.1.38'
NEW_CODE=54
OLD_PUSH='/* Nava v12.1.37 — direct native FCM registration. */'
NEW_PUSH='/* Nava v12.1.38 — direct native FCM registration. */'
OLD_DOWNLOAD='/* Nava Android 12.1.34 — download action sheet + loader killer. */'
NEW_DOWNLOAD='/* Nava Android 12.1.38 — clearer download center + all volumes. */'
NEW_CSS='/* Nava Android 12.1.38 — clearer download center styles. */'

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

def replace_iife(js,start_marker,new_text):
    start=js.find(start_marker)
    if start<0: raise ValueError('block marker missing: '+start_marker)
    end_marker='})(document,window);'
    end=js.find(end_marker,start)
    if end<0: raise ValueError('block end missing: '+start_marker)
    end+=len(end_marker)
    return js[:start]+new_text.rstrip()+js[end:]

def oldsig(name):
    u=name.upper();leaf=u.rsplit('/',1)[-1]
    return u.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))

def main():
    if len(sys.argv)!=9: raise SystemExit('usage: patch-apk.py SRC PATCHED_CLASSES1 CLASSES3 PUSH DOWNLOAD_JS DOWNLOAD_CSS OUT EXPECTED_SHA')
    src,dex1f,dex3f,pushf,dljf,dlcf,out,expected=sys.argv[1:]
    srcp=Path(src);got=hashlib.sha256(srcp.read_bytes()).hexdigest()
    if got.lower()!=expected.lower(): raise ValueError('source sha mismatch '+got)
    dex1=Path(dex1f).read_bytes();dex3=Path(dex3f).read_bytes();push=Path(pushf).read_text();dlj=Path(dljf).read_text();dlc=Path(dlcf).read_text()
    if not dex1.startswith(b'dex\n') or not dex3.startswith(b'dex\n'): raise ValueError('invalid dex')
    if b'NavaAndroidApp/12.1.38' not in dex1 or b'NavaDirectNotification' not in dex1: raise ValueError('classes.dex markers missing')
    for marker in (b'NavaDirectNotification',b'nava_follower_releases_v4',b'Yeni cilt geldi',b'Yeni b'):
        if marker not in dex3: raise ValueError('classes3 marker missing '+repr(marker))
    if NEW_PUSH not in push or "appVersion:'12.1.38'" not in push: raise ValueError('push source invalid')
    if NEW_DOWNLOAD not in dlj or 'Tüm ciltleri indir' not in dlj: raise ValueError('download JS invalid')
    if NEW_CSS not in dlc: raise ValueError('download CSS invalid')
    with zipfile.ZipFile(srcp) as zin:
        if 'classes3.dex' not in zin.namelist(): raise ValueError('12.1.37 classes3.dex missing')
        manifest=patch_manifest(zin.read('AndroidManifest.xml'))
        js=zin.read('assets/nava_app_v11.js').decode('utf-8')
        js=replace_iife(js,OLD_PUSH,push)
        js=replace_iife(js,OLD_DOWNLOAD,dlj)
        if OLD_PUSH in js or OLD_DOWNLOAD in js: raise ValueError('stale JS blocks remain')
        css=zin.read('assets/nava_app_v11.css').decode('utf-8')
        if NEW_CSS in css: raise ValueError('download CSS already patched')
        css=css.rstrip()+'\n\n'+dlc.strip()+'\n'
        with zipfile.ZipFile(out,'w') as zout:
            for info in zin.infolist():
                if oldsig(info.filename): continue
                data=zin.read(info.filename)
                if info.filename=='AndroidManifest.xml': data=manifest
                elif info.filename=='classes.dex': data=dex1
                elif info.filename=='classes3.dex': data=dex3
                elif info.filename=='assets/nava_app_v11.js': data=js.encode()
                elif info.filename=='assets/nava_app_v11.css': data=css.encode()
                zout.writestr(info,data)
    allowed={'AndroidManifest.xml','classes.dex','classes3.dex','assets/nava_app_v11.js','assets/nava_app_v11.css'}
    with zipfile.ZipFile(srcp) as a,zipfile.ZipFile(out) as b:
        fj=b.read('assets/nava_app_v11.js').decode();fc=b.read('assets/nava_app_v11.css').decode();fd=b.read('classes.dex');f3=b.read('classes3.dex')
        if NEW_PUSH not in fj or NEW_DOWNLOAD not in fj or "appVersion:'12.1.38'" not in fj: raise ValueError('final JS verify failed')
        if 'Tüm ciltleri indir' not in fj or NEW_CSS not in fc: raise ValueError('download center verify failed')
        if b'NavaAndroidApp/12.1.38' not in fd or b'NavaDirectNotification' not in fd: raise ValueError('final classes.dex verify failed')
        if b'Yeni cilt geldi' not in f3 or b'nava_follower_releases_v4' not in f3: raise ValueError('final classes3 verify failed')
        for name in a.namelist():
            if oldsig(name) or name in allowed: continue
            if name not in b.namelist() or a.read(name)!=b.read(name): raise ValueError('unexpected changed entry '+name)
    print('PATCH_OK versionCode=54 versionName=12.1.38 notification=text+app-icon download=center+all-volumes scoped=ok')

if __name__=='__main__': main()
