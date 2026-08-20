import hashlib,struct,sys,zipfile
from pathlib import Path

RES_STRING_POOL_TYPE=0x0001
RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.36'
NEW_VERSION='12.1.37'
NEW_CODE=53
OLD_PUSH='/* Nava v12.1.36 — notification repair push registration. */'
NEW_PUSH='/* Nava v12.1.37 — direct native FCM registration. */'

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

def replace_push(js,push):
    start=js.find(OLD_PUSH)
    if start<0: raise ValueError('old push marker missing')
    end_marker='})(document,window);'
    end=js.find(end_marker,start)
    if end<0: raise ValueError('old push end missing')
    end+=len(end_marker)
    out=js[:start]+push.rstrip()+js[end:]
    if NEW_PUSH not in out or "appVersion:'12.1.37'" not in out or 'nava_follower_releases_v4' not in out:
        raise ValueError('new push verify failed')
    if OLD_PUSH in out or '__navaAndroidPushV12136' in out: raise ValueError('stale push remains')
    return out

def oldsig(name):
    u=name.upper();leaf=u.rsplit('/',1)[-1]
    return u.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))

def main():
    if len(sys.argv)!=7: raise SystemExit('usage: patch-apk.py SRC PATCHED_CLASSES1 CLASSES3 PUSH OUT EXPECTED_SHA')
    src,dex1f,dex3f,pushf,out,expected=sys.argv[1:]
    srcp=Path(src);got=hashlib.sha256(srcp.read_bytes()).hexdigest()
    if got.lower()!=expected.lower(): raise ValueError('source sha mismatch '+got)
    dex1=Path(dex1f).read_bytes();dex3=Path(dex3f).read_bytes();push=Path(pushf).read_text()
    if not dex1.startswith(b'dex\n') or not dex3.startswith(b'dex\n'): raise ValueError('invalid dex')
    for marker in (b'NavaAndroidApp/12.1.37',b'nava_follower_releases_v4',b'NavaDirectNotification'):
        if marker not in dex1: raise ValueError('classes.dex marker missing '+repr(marker))
    if b'NavaDirectNotification' not in dex3 or b'nava_follower_releases_v4' not in dex3:
        raise ValueError('classes3 helper markers missing')
    if NEW_PUSH not in push: raise ValueError('push source invalid')
    with zipfile.ZipFile(srcp) as zin:
        if 'classes3.dex' in zin.namelist(): raise ValueError('source already has classes3.dex')
        manifest=patch_manifest(zin.read('AndroidManifest.xml'))
        js=replace_push(zin.read('assets/nava_app_v11.js').decode('utf-8'),push)
        with zipfile.ZipFile(out,'w') as zout:
            for info in zin.infolist():
                if oldsig(info.filename): continue
                data=zin.read(info.filename)
                if info.filename=='AndroidManifest.xml': data=manifest
                elif info.filename=='classes.dex': data=dex1
                elif info.filename=='assets/nava_app_v11.js': data=js.encode()
                zout.writestr(info,data)
            zout.writestr('classes3.dex',dex3)
    allowed={'AndroidManifest.xml','classes.dex','classes3.dex','assets/nava_app_v11.js'}
    with zipfile.ZipFile(srcp) as a,zipfile.ZipFile(out) as b:
        fj=b.read('assets/nava_app_v11.js').decode();fd=b.read('classes.dex');f3=b.read('classes3.dex')
        if NEW_PUSH not in fj or "appVersion:'12.1.37'" not in fj: raise ValueError('final JS push missing')
        if b'NavaDirectNotification;->handle' not in fd or b'NavaDirectNotification;->ensure' not in fd: raise ValueError('native hooks missing')
        if b'nava_follower_releases_v4' not in f3: raise ValueError('v4 helper channel missing')
        for name in a.namelist():
            if oldsig(name) or name in allowed: continue
            if name not in b.namelist() or a.read(name)!=b.read(name): raise ValueError('unexpected changed entry '+name)
    print('PATCH_OK versionCode=53 versionName=12.1.37 directNativeFCM=1 selfTest=1 classes3=ok scoped=ok')

if __name__=='__main__': main()
