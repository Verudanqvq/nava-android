import hashlib, struct, sys, zipfile
from pathlib import Path

RES_STRING_POOL_TYPE=0x0001
RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.60'
NEW_VERSION='12.1.61'
NEW_CODE=77
SOURCE_SHA='cfde38c53d89b3215baa9fbeb49944bfdc114a487747910e47bfd0e13e66cae8'
STARTUP_MARK=b'StartupOverlay61'
UPDATER_MARK=b'Nava-Android/12.1.60'
KNOWN_UA=b'NavaAndroidApp/12.1.47'
JS_MARK='/* Nava Android 12.1.61 — visible v9 notification clear/delete controls. */'
CSS_MARK='/* Nava Android 12.1.61 — startup and v9 notification UI. */'

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
def sha(b): return hashlib.sha256(b).hexdigest()

def main():
    if len(sys.argv)!=7: raise SystemExit('usage: patch-apk.py SRC NEW_CLASSES1 JS CSS OFFLINE OUT')
    src,classes1f,jsf,cssf,offlinef,out=sys.argv[1:]
    srcp=Path(src);got=hashlib.sha256(srcp.read_bytes()).hexdigest()
    if got.lower()!=SOURCE_SHA: raise ValueError('source must be signed Nava 12.1.60; sha256='+got)
    new_classes1=Path(classes1f).read_bytes()
    if STARTUP_MARK not in new_classes1: raise ValueError('StartupOverlay61 missing from classes.dex')
    if UPDATER_MARK not in new_classes1: raise ValueError('12.1.60 direct updater marker missing')
    if KNOWN_UA not in new_classes1: raise ValueError('known-good 12.1.47 WebView UA missing')
    addjs=Path(jsf).read_text(encoding='utf-8').strip(); addcss=Path(cssf).read_text(encoding='utf-8').strip(); offline=Path(offlinef).read_bytes()
    if JS_MARK not in addjs or CSS_MARK not in addcss: raise ValueError('61 asset marker missing')
    with zipfile.ZipFile(srcp) as zin:
        names=set(zin.namelist())
        req={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html','resources.arsc'}
        if not req.issubset(names): raise ValueError('required APK entries missing: '+str(req-names))
        manifest=patch_manifest(zin.read('AndroidManifest.xml'))
        base_classes1=zin.read('classes.dex');base_classes2=zin.read('classes2.dex');base_classes3=zin.read('classes3.dex') if 'classes3.dex' in names else None
        resources=zin.read('resources.arsc')
        js=zin.read('assets/nava_app_v11.js').decode('utf-8').rstrip()+'\n\n'+addjs+'\n'
        css=zin.read('assets/nava_app_v11.css').decode('utf-8').rstrip()+'\n\n'+addcss+'\n'
        with zipfile.ZipFile(out,'w') as zout:
            for info in zin.infolist():
                if oldsig(info.filename): continue
                data=zin.read(info.filename)
                if info.filename=='AndroidManifest.xml': data=manifest
                elif info.filename=='classes.dex': data=new_classes1
                elif info.filename=='assets/nava_app_v11.js': data=js.encode('utf-8')
                elif info.filename=='assets/nava_app_v11.css': data=css.encode('utf-8')
                elif info.filename=='assets/offline.html': data=offline
                zout.writestr(info,data)
    with zipfile.ZipFile(out) as z:
        f1=z.read('classes.dex');f2=z.read('classes2.dex')
        if STARTUP_MARK not in f1 or UPDATER_MARK not in f1 or KNOWN_UA not in f1: raise ValueError('final classes.dex semantic validation failed')
        if sha(f1)==sha(base_classes1): raise ValueError('classes.dex unchanged')
        if sha(f2)!=sha(base_classes2): raise ValueError('classes2.dex changed unexpectedly')
        if base_classes3 is not None and sha(z.read('classes3.dex'))!=sha(base_classes3): raise ValueError('classes3.dex changed unexpectedly')
        if z.read('resources.arsc')!=resources: raise ValueError('resources.arsc changed unexpectedly')
        fj=z.read('assets/nava_app_v11.js').decode('utf-8');fc=z.read('assets/nava_app_v11.css').decode('utf-8');fo=z.read('assets/offline.html').decode('utf-8')
        if JS_MARK not in fj or 'nava-notification-clear-all-v12161' not in fj or 'nava-notification-delete-v12161' not in fj: raise ValueError('notification asset missing')
        if CSS_MARK not in fc: raise ValueError('61 CSS missing')
        if 'setInterval(probe,2500)' not in fo or 'Tekrar dene' not in fo: raise ValueError('offline probe missing')
    print('PATCH_OK versionName=12.1.61 versionCode=77 base=12.1.60 resources=byte-preserved startup=native-overlay notifications=v9 offline=probe updater=60-preserved')

if __name__=='__main__': main()
