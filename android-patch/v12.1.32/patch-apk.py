import hashlib,struct,sys,zipfile,zlib
from pathlib import Path

RES_STRING_POOL_TYPE=0x0001
RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.31'
NEW_VERSION='12.1.32'
NEW_CODE=48
CSS_MARKER='/* Nava Android 12.1.32 — compact shell + site-native visual system. */'

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
    d=bytearray(raw)
    before=bytes(d)
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

def patch_dex(raw):
    d=bytearray(raw)
    old=b'NavaAndroidApp/12.1.30';new=b'NavaAndroidApp/12.1.32'
    c=d.count(old)
    if c<1: raise ValueError('UA marker missing')
    d[:]=d.replace(old,new)
    d[12:32]=hashlib.sha1(d[32:]).digest()
    struct.pack_into('<I',d,8,zlib.adler32(d[12:])&0xffffffff)
    return bytes(d),c

def oldsig(name):
    u=name.upper()
    if not u.startswith('META-INF/'): return False
    leaf=u.rsplit('/',1)[-1]
    return leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC'))

def main():
    if len(sys.argv)!=5: raise SystemExit('usage: patch-apk.py SRC CSS OUT EXPECTED_SHA')
    src,cssf,out,expected=sys.argv[1:]
    srcp=Path(src);got=hashlib.sha256(srcp.read_bytes()).hexdigest()
    if got.lower()!=expected.lower(): raise ValueError('source sha mismatch '+got)
    css=Path(cssf).read_text()
    if CSS_MARKER not in css: raise ValueError('css marker missing')
    with zipfile.ZipFile(srcp) as zin:
        manifest=patch_manifest(zin.read('AndroidManifest.xml'))
        dex,ua_count=patch_dex(zin.read('classes.dex'))
        js=zin.read('assets/nava_app_v11.js').decode('utf-8')
        if "appVersion:'12.1.31'" not in js: raise ValueError('push appVersion marker missing')
        js=js.replace("appVersion:'12.1.31'","appVersion:'12.1.32'",1)
        oldcss=zin.read('assets/nava_app_v11.css').decode('utf-8')
        if CSS_MARKER in oldcss: raise ValueError('css already patched')
        finalcss=oldcss.rstrip()+'\n\n'+css.strip()+'\n'
        with zipfile.ZipFile(out,'w') as zout:
            for info in zin.infolist():
                if oldsig(info.filename): continue
                if info.filename=='AndroidManifest.xml': zout.writestr(info,manifest)
                elif info.filename=='classes.dex': zout.writestr(info,dex)
                elif info.filename=='assets/nava_app_v11.js': zout.writestr(info,js.encode())
                elif info.filename=='assets/nava_app_v11.css': zout.writestr(info,finalcss.encode())
                else: zout.writestr(info,zin.read(info.filename))
    with zipfile.ZipFile(out) as z:
        fd=z.read('classes.dex');fj=z.read('assets/nava_app_v11.js').decode();fc=z.read('assets/nava_app_v11.css').decode()
        assert b'NavaAndroidApp/12.1.32' in fd and b'NavaAndroidApp/12.1.30' not in fd
        assert fd[12:32]==hashlib.sha1(fd[32:]).digest()
        assert struct.unpack_from('<I',fd,8)[0]==(zlib.adler32(fd[12:])&0xffffffff)
        assert "appVersion:'12.1.32'" in fj and CSS_MARKER in fc
    print(f'PATCH_OK versionCode=48 versionName=12.1.32 ua_replacements={ua_count} css=site-native scoped=ok')
if __name__=='__main__': main()
