import hashlib,struct,sys,zipfile
from pathlib import Path

RES_STRING_POOL_TYPE=0x0001
RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.47';NEW_VERSION='12.1.53';NEW_CODE=69
SOURCE_SHA='8b4650833446f30eafa6e0fc1ed28dc19564eeee304421b02c7ce05f5433964c'
OLD_MENU='/* Nava Android 12.1.47 — topbar download control, no page-flow blocks. */'
NEW_MENU='/* Nava Android 12.1.49 — 12.1.47-based download queue + series volume picker. */'
OLD_OFFLINE='/* Nava Android 12.1.47 — flat file-browser offline library. */'
NEW_OFFLINE='/* Nava Android 12.1.49 — reliable downloaded library and deletion. */'
OLD_LANG='/* Nava Android 12.1.47 — work language filter TR/EN/JP/KR/CN. */'
NEW_LANG='/* Nava Android 12.1.49 — per-series chapter language variants. */'
NOTIFY='/* Nava Android 12.1.49 — reliable mobile notification deletion. */'
FIX='/* Nava Android 12.1.53 — series label derived from volume label links. */'
CSS_MARK='/* Nava Android 12.1.49 — 12.1.47-based queue, volume picker, language variants, notification deletion. */'

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

def replace_iife(js,marker,new):
    start=js.find(marker)
    if start<0: raise ValueError('marker missing '+marker)
    endm='})(document,window);';end=js.find(endm,start)
    if end<0: raise ValueError('iife end missing '+marker)
    return js[:start]+new.rstrip()+js[end+len(endm):]

def oldsig(name):
    u=name.upper();leaf=u.rsplit('/',1)[-1]
    return u.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))

def main():
    if len(sys.argv)!=9: raise SystemExit('usage: patch-apk.py SRC MENU OFFLINE LANG NOTIFY FIX CSS OUT')
    src,menuf,offf,langf,notifyf,fixf,cssf,out=sys.argv[1:]
    srcp=Path(src);got=hashlib.sha256(srcp.read_bytes()).hexdigest()
    if got.lower()!=SOURCE_SHA: raise ValueError('source must be signed Nava 12.1.47; sha256='+got)
    menu=Path(menuf).read_text(encoding='utf-8');offline=Path(offf).read_text(encoding='utf-8');lang=Path(langf).read_text(encoding='utf-8');notify=Path(notifyf).read_text(encoding='utf-8');fix=Path(fixf).read_text(encoding='utf-8');css=Path(cssf).read_text(encoding='utf-8')
    for text,mark in ((menu,NEW_MENU),(offline,NEW_OFFLINE),(lang,NEW_LANG),(notify,NOTIFY),(fix,FIX),(css,CSS_MARK)):
        if mark not in text: raise ValueError('source marker missing '+mark)
    with zipfile.ZipFile(srcp) as zin:
        req={'AndroidManifest.xml','classes.dex','assets/nava_app_v11.js','assets/nava_app_v11.css'}
        if not req.issubset(set(zin.namelist())): raise ValueError('required apk entries missing')
        manifest=patch_manifest(zin.read('AndroidManifest.xml'))
        dex=zin.read('classes.dex')
        if b'NavaAndroidApp/12.1.47' not in dex: raise ValueError('known-good 12.1.47 UA missing')
        for v in (b'NavaAndroidApp/12.1.48',b'NavaAndroidApp/12.1.49',b'NavaAndroidApp/12.1.50',b'NavaAndroidApp/12.1.51',b'NavaAndroidApp/12.1.52',b'NavaAndroidApp/12.1.53'):
            if v in dex: raise ValueError('unexpected newer UA marker')
        js=zin.read('assets/nava_app_v11.js').decode('utf-8')
        js=replace_iife(js,OLD_MENU,menu);js=replace_iife(js,OLD_OFFLINE,offline);js=replace_iife(js,OLD_LANG,lang)
        if NOTIFY in js or FIX in js: raise ValueError('patch already present')
        js=js.rstrip()+'\n\n'+notify.strip()+'\n\n'+fix.strip()+'\n'
        cssold=zin.read('assets/nava_app_v11.css').decode('utf-8')
        if CSS_MARK in cssold: raise ValueError('css patch already present')
        cssout=cssold.rstrip()+'\n\n'+css.strip()+'\n'
        with zipfile.ZipFile(out,'w') as zout:
            for info in zin.infolist():
                if oldsig(info.filename): continue
                data=zin.read(info.filename)
                if info.filename=='AndroidManifest.xml': data=manifest
                elif info.filename=='classes.dex': data=dex
                elif info.filename=='assets/nava_app_v11.js': data=js.encode('utf-8')
                elif info.filename=='assets/nava_app_v11.css': data=cssout.encode('utf-8')
                zout.writestr(info,data)
    with zipfile.ZipFile(out) as z:
        fj=z.read('assets/nava_app_v11.js').decode('utf-8');fc=z.read('assets/nava_app_v11.css').decode('utf-8');fd=z.read('classes.dex')
        for mark in (NEW_MENU,NEW_OFFLINE,NEW_LANG,NOTIFY,FIX):
            if mark not in fj: raise ValueError('final js marker missing '+mark)
        for token in ('navaSeriesLabelFixV12153','scanVolumeLinks','labelFromHref','feedForLabel','ensurePicker'):
            if token not in fj: raise ValueError('12.1.53 discovery token missing '+token)
        if 'navaSeriesLabelFixV12152' in fj: raise ValueError('12.1.52 discovery must not be bundled')
        if b'NavaAndroidApp/12.1.47' not in fd or b'NavaAndroidApp/12.1.53' in fd: raise ValueError('native UA preservation failed')
        if CSS_MARK not in fc: raise ValueError('css patch missing')
    print('PATCH_OK versionName=12.1.53 versionCode=69 base=12.1.47 nativeUA=12.1.47 discovery=series-label-from-cilt-link')
if __name__=='__main__': main()
