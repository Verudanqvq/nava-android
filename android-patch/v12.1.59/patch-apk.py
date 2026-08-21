import hashlib,struct,sys,zipfile
from pathlib import Path

RES_STRING_POOL_TYPE=0x0001
RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.58';NEW_VERSION='12.1.59';NEW_CODE=75
SOURCE_SHA='31d319c1af95e822931881d672a3dd1177a9467561f6c62c5125f61d5c68ec59'
JS_MARK='/* Nava Android 12.1.59 — native volume cancellation + grouped queue controls. */'
CSS_MARK='/* Nava Android 12.1.59 — cancellation controls and offline-refresh cleanup. */'
OFFLINE_MARK='Nava • Bağlantı yok'

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

def main():
    if len(sys.argv)!=7: raise SystemExit('usage: patch-apk.py SRC CLASSES2 JS CSS OFFLINE OUT')
    src,classes2f,jsf,cssf,offlinef,out=sys.argv[1:]
    srcp=Path(src);got=hashlib.sha256(srcp.read_bytes()).hexdigest()
    if got.lower()!=SOURCE_SHA: raise ValueError('source must be signed Nava 12.1.58; sha256='+got)
    new_classes2=Path(classes2f).read_bytes();overlay=Path(jsf).read_text(encoding='utf-8');cssfix=Path(cssf).read_text(encoding='utf-8');offline=Path(offlinef).read_text(encoding='utf-8')
    if JS_MARK not in overlay or CSS_MARK not in cssfix or OFFLINE_MARK not in offline: raise ValueError('12.1.59 source marker missing')
    with zipfile.ZipFile(srcp) as zin:
        req={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html'}
        if not req.issubset(set(zin.namelist())): raise ValueError('required apk entries missing: '+str(req-set(zin.namelist())))
        manifest=patch_manifest(zin.read('AndroidManifest.xml'))
        classes1=zin.read('classes.dex')
        if b'NavaAndroidApp/12.1.47' not in classes1: raise ValueError('known-good 12.1.47 UA missing')
        js=zin.read('assets/nava_app_v11.js').decode('utf-8').rstrip()+'\n\n'+overlay.strip()+'\n'
        css=zin.read('assets/nava_app_v11.css').decode('utf-8').rstrip()+'\n\n'+cssfix.strip()+'\n'
        with zipfile.ZipFile(out,'w') as zout:
            for info in zin.infolist():
                if oldsig(info.filename): continue
                data=zin.read(info.filename)
                if info.filename=='AndroidManifest.xml': data=manifest
                elif info.filename=='classes2.dex': data=new_classes2
                elif info.filename=='assets/nava_app_v11.js': data=js.encode('utf-8')
                elif info.filename=='assets/nava_app_v11.css': data=css.encode('utf-8')
                elif info.filename=='assets/offline.html': data=offline.encode('utf-8')
                zout.writestr(info,data)
    with zipfile.ZipFile(out) as z:
        fj=z.read('assets/nava_app_v11.js').decode('utf-8');fc=z.read('assets/nava_app_v11.css').decode('utf-8');fo=z.read('assets/offline.html').decode('utf-8');fd1=z.read('classes.dex');fd2=z.read('classes2.dex')
        for token in (JS_MARK,'data-cancel-all-v12159','NavaOffline.cancel','cancelGroup','removeWrongRefresh'):
            if token not in fj: raise ValueError('final JS token missing '+token)
        if CSS_MARK not in fc or '.nava-offline-refresh-v12158{display:none!important}' not in fc: raise ValueError('final CSS cleanup missing')
        if OFFLINE_MARK not in fo or 'Tekrar dene' not in fo or "addEventListener('online'" not in fo: raise ValueError('offline retry asset missing')
        if b'NavaAndroidApp/12.1.47' not in fd1 or b'NavaAndroidApp/12.1.59' in fd1: raise ValueError('classes.dex/native UA preservation failed')
        if hashlib.sha256(fd1).hexdigest()!=hashlib.sha256(classes1).hexdigest(): raise ValueError('classes.dex changed unexpectedly')
        if b'cancel' not in fd2 or b'cancelled' not in fd2: raise ValueError('native cancel strings missing from classes2.dex')
    print('PATCH_OK versionName=12.1.59 versionCode=75 base=12.1.58 classes1=preserved nativeCancel=classes2 offlineRetry=asset queueCancel=grouped')
if __name__=='__main__': main()
