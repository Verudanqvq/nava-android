import struct,sys,zipfile,hashlib
from pathlib import Path

RES_STRING_POOL_TYPE=0x0001
RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.30'
NEW_VERSION='12.1.31'
NEW_CODE=47
PUSH_OLD='/* Nava v12.1.30 — Firestore-safe Android push token registration.'
PUSH_NEW='/* Nava v12.1.31 — Firestore-safe Android push token registration.'
OFFLINE_MARKER='/* Nava Android v12.1.31 — native offline downloads UI. */'
CSS_MARKER='/* Nava Android v12.1.31 — offline downloads UI. */'

def u16(d,o): return struct.unpack_from('<H',d,o)[0]
def u32(d,o): return struct.unpack_from('<I',d,o)[0]
def p32(d,o,v): struct.pack_into('<I',d,o,v)
def decode_len8(d,p):
    f=d[p];p+=1
    if f&0x80:return((f&0x7f)<<8)|d[p],p+1
    return f,p
def decode_len16(d,p):
    f=u16(d,p);p+=2
    if f&0x8000:return((f&0x7fff)<<16)|u16(d,p),p+2
    return f,p
def read_string_pool(d,off):
    hs=u16(d,off+2);count=u32(d,off+8);flags=u32(d,off+16);ss=u32(d,off+20);utf8=bool(flags&0x100)
    offsets=[u32(d,off+hs+i*4) for i in range(count)];out=[]
    for so in offsets:
        p=off+ss+so
        if utf8:
            _,p=decode_len8(d,p);bl,p=decode_len8(d,p);out.append(bytes(d[p:p+bl]).decode('utf-8','replace'))
        else:
            ln,p=decode_len16(d,p);out.append(bytes(d[p:p+ln*2]).decode('utf-16le','replace'))
    return out
def manifest_version_code(raw):
    d=bytearray(raw);off=u16(d,2);total=u32(d,4);strings=None
    while off+8<=min(total,len(d)):
        typ=u16(d,off);hs=u16(d,off+2);size=u32(d,off+4)
        if size<8:raise ValueError('bad manifest chunk')
        if typ==RES_STRING_POOL_TYPE and strings is None:strings=read_string_pool(d,off)
        elif typ==RES_XML_START_ELEMENT_TYPE and strings:
            ext=off+hs;idx=u32(d,ext+4);elem=strings[idx] if idx<len(strings) else''
            if elem=='manifest':
                ast=u16(d,ext+8);asz=u16(d,ext+10);ac=u16(d,ext+12);base=ext+ast
                for i in range(ac):
                    a=base+i*asz;ni=u32(d,a+4);name=strings[ni] if ni<len(strings) else''
                    if name=='versionCode':return u32(d,a+16)
        off+=size
    raise ValueError('versionCode missing')
def patch_manifest(raw):
    if len(OLD_VERSION)!=len(NEW_VERSION):raise ValueError('version length')
    d=bytearray(raw);off=u16(d,2);total=u32(d,4);strings=None;replaced=False
    while off+8<=min(total,len(d)):
        typ=u16(d,off);hs=u16(d,off+2);size=u32(d,off+4)
        if size<8:raise ValueError('bad manifest chunk')
        if typ==RES_STRING_POOL_TYPE and strings is None:
            before=bytes(d);d[:]=d.replace(OLD_VERSION.encode(),NEW_VERSION.encode());d[:]=d.replace(OLD_VERSION.encode('utf-16le'),NEW_VERSION.encode('utf-16le'));replaced=bytes(d)!=before;strings=read_string_pool(d,off)
        elif typ==RES_XML_START_ELEMENT_TYPE and strings:
            ext=off+hs;idx=u32(d,ext+4);elem=strings[idx] if idx<len(strings) else''
            if elem=='manifest':
                ast=u16(d,ext+8);asz=u16(d,ext+10);ac=u16(d,ext+12);base=ext+ast;found=False
                for i in range(ac):
                    a=base+i*asz;ni=u32(d,a+4);name=strings[ni] if ni<len(strings) else''
                    if name=='versionCode':p32(d,a+16,NEW_CODE);found=True
                if not(found and replaced):raise ValueError('manifest patch failed')
                if manifest_version_code(bytes(d))!=NEW_CODE:raise ValueError('code verify failed')
                return bytes(d)
        off+=size
    raise ValueError('manifest missing')
def old_signature(name):
    u=name.upper()
    if not u.startswith('META-INF/'):return False
    leaf=u.rsplit('/',1)[-1]
    return leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC'))
def replace_push(js,push):
    start=js.find(PUSH_OLD)
    if start<0:raise ValueError('old push marker missing')
    end_marker='})(document,window);';end=js.find(end_marker,start)
    if end<0:raise ValueError('old push end missing')
    end+=len(end_marker)
    out=js[:start]+push.rstrip()+js[end:]
    if PUSH_NEW not in out or "appVersion:'12.1.31'" not in out:raise ValueError('new push verify failed')
    return out
def main():
    if len(sys.argv)!=11:raise SystemExit('usage: patch-apk.py SRC classes.dex classes2.dex push.js offline.js offline.css offline.html OUT.apk CODE EXPECTED_SOURCE_SHA')
    src,classes1,classes2,pushf,jsf,cssf,htmlf,out,code,expected=sys.argv[1:]
    if int(code)!=NEW_CODE:raise ValueError('bad code')
    source=Path(src);target=Path(out);got=hashlib.sha256(source.read_bytes()).hexdigest()
    if expected!='-' and got.lower()!=expected.lower():raise ValueError('source APK sha mismatch '+got)
    p1=Path(classes1).read_bytes();p2=Path(classes2).read_bytes();push=Path(pushf).read_text();offlinejs=Path(jsf).read_text();offlinecss=Path(cssf).read_text();offlinehtml=Path(htmlf).read_bytes()
    with zipfile.ZipFile(source,'r') as zin:
        names=set(zin.namelist())
        if 'classes2.dex' in names:raise ValueError('source already has classes2.dex')
        required={'AndroidManifest.xml','classes.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html'}
        if not required.issubset(names):raise ValueError('source entries missing')
        manifest=patch_manifest(zin.read('AndroidManifest.xml'))
        js=replace_push(zin.read('assets/nava_app_v11.js').decode('utf-8'),push)
        if OFFLINE_MARKER in js:raise ValueError('offline JS already present')
        js=js.rstrip()+'\n\n'+offlinejs.strip()+'\n'
        css=zin.read('assets/nava_app_v11.css').decode('utf-8')
        if CSS_MARKER in css:raise ValueError('offline CSS already present')
        css=css.rstrip()+'\n\n'+offlinecss.strip()+'\n'
        with zipfile.ZipFile(target,'w') as zout:
            for info in zin.infolist():
                if old_signature(info.filename):continue
                if info.filename=='AndroidManifest.xml':zout.writestr(info,manifest)
                elif info.filename=='classes.dex':zout.writestr(info,p1)
                elif info.filename=='assets/nava_app_v11.js':zout.writestr(info,js.encode())
                elif info.filename=='assets/nava_app_v11.css':zout.writestr(info,css.encode())
                elif info.filename=='assets/offline.html':zout.writestr(info,offlinehtml)
                else:zout.writestr(info,zin.read(info.filename))
            zout.writestr('classes2.dex',p2)
    allowed={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html'}
    with zipfile.ZipFile(source) as a,zipfile.ZipFile(target) as b:
        if manifest_version_code(b.read('AndroidManifest.xml'))!=NEW_CODE:raise ValueError('final manifest')
        fj=b.read('assets/nava_app_v11.js').decode();fc=b.read('assets/nava_app_v11.css').decode();fh=b.read('assets/offline.html').decode()
        if OFFLINE_MARKER not in fj or CSS_MARKER not in fc or 'Nava • İndirilenler' not in fh:raise ValueError('offline assets missing')
        if not b.read('classes2.dex').startswith(b'dex\n'):raise ValueError('classes2 bad dex')
        for name in a.namelist():
            if old_signature(name) or name in allowed:continue
            if name not in b.namelist() or a.read(name)!=b.read(name):raise ValueError('unexpected changed entry '+name)
    print('PATCH_OK versionCode=47 js=12.1.31 offline=native classes2=ok scoped_entries=ok')
if __name__=='__main__':main()
