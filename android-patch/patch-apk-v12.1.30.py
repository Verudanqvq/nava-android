import hashlib
import struct
import sys
import zipfile
import zlib
from pathlib import Path

RES_STRING_POOL_TYPE=0x0001
RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.29'
NEW_VERSION='12.1.30'
NEW_CODE=46
OLD_UA=b'NavaAndroidApp/12.1.23'
NEW_UA=b'NavaAndroidApp/12.1.30'
PERMISSION_PREF=b'nava_notif_permission_v12129'
JS_MARKER='/* Nava Android v12.1.30 — UI/reader/runtime polish. */'
CSS_MARKER='/* Nava Android v12.1.30 — safe-area, overlays, reader and small-screen polish. */'


def u16(d,o): return struct.unpack_from('<H',d,o)[0]
def u32(d,o): return struct.unpack_from('<I',d,o)[0]
def p32(d,o,v): struct.pack_into('<I',d,o,v)

def decode_len8(d,p):
    f=d[p]; p+=1
    if f&0x80: return ((f&0x7f)<<8)|d[p],p+1
    return f,p

def decode_len16(d,p):
    f=u16(d,p); p+=2
    if f&0x8000: return ((f&0x7fff)<<16)|u16(d,p),p+2
    return f,p

def read_string_pool(d,off):
    hs=u16(d,off+2); count=u32(d,off+8); flags=u32(d,off+16); ss=u32(d,off+20); utf8=bool(flags&0x100)
    offsets=[u32(d,off+hs+i*4) for i in range(count)]; out=[]
    for so in offsets:
        p=off+ss+so
        if utf8:
            _,p=decode_len8(d,p); bl,p=decode_len8(d,p); out.append(bytes(d[p:p+bl]).decode('utf-8','replace'))
        else:
            ln,p=decode_len16(d,p); out.append(bytes(d[p:p+ln*2]).decode('utf-16le','replace'))
    return out

def manifest_version_code(raw):
    d=bytearray(raw); off=u16(d,2); total=u32(d,4); strings=None
    while off+8<=min(total,len(d)):
        typ=u16(d,off); hs=u16(d,off+2); size=u32(d,off+4)
        if size<8: raise ValueError('bad manifest chunk')
        if typ==RES_STRING_POOL_TYPE and strings is None: strings=read_string_pool(d,off)
        elif typ==RES_XML_START_ELEMENT_TYPE and strings:
            ext=off+hs; idx=u32(d,ext+4); elem=strings[idx] if idx<len(strings) else ''
            if elem=='manifest':
                ast=u16(d,ext+8); asz=u16(d,ext+10); ac=u16(d,ext+12); base=ext+ast
                for i in range(ac):
                    a=base+i*asz; ni=u32(d,a+4); name=strings[ni] if ni<len(strings) else ''
                    if name=='versionCode': return u32(d,a+16)
        off+=size
    raise ValueError('versionCode missing')

def patch_manifest(raw):
    if len(OLD_VERSION.encode())!=len(NEW_VERSION.encode()): raise ValueError('version length mismatch')
    d=bytearray(raw); off=u16(d,2); total=u32(d,4); strings=None; replaced=False
    while off+8<=min(total,len(d)):
        typ=u16(d,off); hs=u16(d,off+2); size=u32(d,off+4)
        if size<8: raise ValueError('bad manifest chunk')
        if typ==RES_STRING_POOL_TYPE and strings is None:
            strings=read_string_pool(d,off); before=bytes(d)
            d[:]=d.replace(OLD_VERSION.encode(),NEW_VERSION.encode())
            d[:]=d.replace(OLD_VERSION.encode('utf-16le'),NEW_VERSION.encode('utf-16le'))
            replaced=bytes(d)!=before; strings=read_string_pool(d,off)
        elif typ==RES_XML_START_ELEMENT_TYPE and strings:
            ext=off+hs; idx=u32(d,ext+4); elem=strings[idx] if idx<len(strings) else ''
            if elem=='manifest':
                ast=u16(d,ext+8); asz=u16(d,ext+10); ac=u16(d,ext+12); base=ext+ast; found=False
                for i in range(ac):
                    a=base+i*asz; ni=u32(d,a+4); name=strings[ni] if ni<len(strings) else ''
                    if name=='versionCode': p32(d,a+16,NEW_CODE); found=True
                if not found or not replaced: raise ValueError('manifest version patch failed')
                if manifest_version_code(bytes(d))!=NEW_CODE: raise ValueError('versionCode verify failed')
                return bytes(d)
        off+=size
    raise ValueError('manifest element missing')

def patch_dex(raw):
    if len(OLD_UA)!=len(NEW_UA): raise ValueError('UA replacement length mismatch')
    if raw.count(OLD_UA)!=1: raise ValueError(f'old UA marker count={raw.count(OLD_UA)}')
    if raw.count(PERMISSION_PREF)!=1: raise ValueError('12.1.29 notification permission marker missing')
    d=bytearray(raw.replace(OLD_UA,NEW_UA,1))
    d[12:32]=hashlib.sha1(d[32:]).digest()
    struct.pack_into('<I',d,8,zlib.adler32(d[12:])&0xffffffff)
    if bytes(d).count(NEW_UA)!=1 or bytes(d).count(OLD_UA): raise ValueError('UA patch verify failed')
    return bytes(d)

def patch_js(original,push,polish):
    marker='/* Nava v12.1.29 — Firestore-safe Android push token registration.'
    start=original.find(marker)
    if start<0: raise ValueError('12.1.29 push marker missing')
    end_marker='})(document,window);'; end=original.find(end_marker,start)
    if end<0: raise ValueError('push block end missing')
    end+=len(end_marker)
    out=original[:start]+push.rstrip()+original[end:]
    if JS_MARKER in out: raise ValueError('12.1.30 JS polish already present')
    out=out.rstrip()+'\n\n'+polish.strip()+'\n'
    if "appVersion:'12.1.30'" not in out or JS_MARKER not in out: raise ValueError('final JS markers missing')
    if '.get().then(function(snapshot)' in push or 'ref.get()' in push: raise ValueError('forbidden token pre-read')
    return out

def patch_css(original,polish):
    if CSS_MARKER in original: raise ValueError('12.1.30 CSS polish already present')
    out=original.rstrip()+'\n\n'+polish.strip()+'\n'
    if CSS_MARKER not in out: raise ValueError('final CSS marker missing')
    return out

def old_signature(name):
    up=name.upper()
    if not up.startswith('META-INF/'): return False
    leaf=up.rsplit('/',1)[-1]
    return leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC'))

def main():
    if len(sys.argv)!=7: raise SystemExit('usage: patch INPUT.apk PUSH.js POLISH.js POLISH.css OUTPUT.apk CODE')
    source=Path(sys.argv[1]); push=Path(sys.argv[2]).read_text(encoding='utf-8'); polish_js=Path(sys.argv[3]).read_text(encoding='utf-8'); polish_css=Path(sys.argv[4]).read_text(encoding='utf-8'); target=Path(sys.argv[5]); code=int(sys.argv[6])
    if code!=NEW_CODE: raise ValueError(f'expected code {NEW_CODE}')
    with zipfile.ZipFile(source,'r') as zin:
        required={'AndroidManifest.xml','classes.dex','assets/nava_app_v11.js','assets/nava_app_v11.css'}
        if not required.issubset(set(zin.namelist())): raise ValueError('required APK entries missing')
        manifest=patch_manifest(zin.read('AndroidManifest.xml'))
        dex=patch_dex(zin.read('classes.dex'))
        js=patch_js(zin.read('assets/nava_app_v11.js').decode('utf-8'),push,polish_js).encode('utf-8')
        css=patch_css(zin.read('assets/nava_app_v11.css').decode('utf-8'),polish_css).encode('utf-8')
        with zipfile.ZipFile(target,'w') as zout:
            for info in zin.infolist():
                if old_signature(info.filename): continue
                if info.filename=='AndroidManifest.xml': zout.writestr(info,manifest)
                elif info.filename=='classes.dex': zout.writestr(info,dex)
                elif info.filename=='assets/nava_app_v11.js': zout.writestr(info,js)
                elif info.filename=='assets/nava_app_v11.css': zout.writestr(info,css)
                else: zout.writestr(info,zin.read(info.filename))
    allowed={'AndroidManifest.xml','classes.dex','assets/nava_app_v11.js','assets/nava_app_v11.css'}
    with zipfile.ZipFile(source,'r') as a, zipfile.ZipFile(target,'r') as b:
        if manifest_version_code(b.read('AndroidManifest.xml'))!=NEW_CODE: raise ValueError('final manifest failed')
        fd=b.read('classes.dex'); fj=b.read('assets/nava_app_v11.js').decode('utf-8'); fc=b.read('assets/nava_app_v11.css').decode('utf-8')
        if fd.count(NEW_UA)!=1 or fd.count(PERMISSION_PREF)!=1: raise ValueError('final dex markers failed')
        if "appVersion:'12.1.30'" not in fj or JS_MARKER not in fj or CSS_MARKER not in fc: raise ValueError('final asset markers failed')
        for name in a.namelist():
            if old_signature(name) or name in allowed: continue
            if name not in b.namelist() or a.read(name)!=b.read(name): raise ValueError('unexpected changed APK entry: '+name)
    print('PATCH_OK versionCode=46 js=12.1.30 css=ui-reader dex=ua-12.1.30 unchanged_entries=ok')

if __name__=='__main__': main()
