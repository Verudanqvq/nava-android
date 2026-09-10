from pathlib import Path
import struct
import sys
if len(sys.argv)!=2: raise SystemExit('usage: patch-manifest78.py AndroidManifest.xml')
path=Path(sys.argv[1]); data=bytearray(path.read_bytes())
if len(data)<8 or struct.unpack_from('<H',data,0)[0]!=0x0003: raise ValueError('manifest is not binary AXML')
def u16(o): return struct.unpack_from('<H',data,o)[0]
def u32(o): return struct.unpack_from('<I',data,o)[0]
pool=None; position=u16(2)
while position+8<=len(data):
    size=u32(position+4)
    if size<8 or position+size>len(data): raise ValueError('invalid AXML chunk')
    if u16(position)==0x0001: pool=position; break
    position+=size
if pool is None: raise ValueError('string pool missing')
count,flags,strings_start=u32(pool+8),u32(pool+16),u32(pool+20); offsets=pool+28; utf8=bool(flags&0x100)
def l8(o):
    v=data[o]; return (v&0x7f,1) if not v&0x80 else (((v&0x7f)<<8)|data[o+1],2)
def l16(o):
    v=u16(o); return (v&0x7fff,2) if not v&0x8000 else (((v&0x7fff)<<16)|u16(o+2),4)
def entry(i):
    o=pool+strings_start+u32(offsets+i*4)
    if utf8:
        _,a=l8(o); chars,b=l8(o+a); start=o+a+b; return bytes(data[start:start+chars]).decode(),start,chars
    chars,p=l16(o); start=o+p; return bytes(data[start:start+chars*2]).decode('utf-16le'),start,chars*2
strings=[entry(i) for i in range(count)]
changes=0
for value,start,length in strings:
    if value=='12.1.77':
        rep='12.1.78'.encode('utf-8' if utf8 else 'utf-16le')
        if len(rep)!=length: raise ValueError('versionName length mismatch')
        data[start:start+length]=rep; changes+=1
if changes!=1: raise ValueError('expected one versionName')
changes=0; position=u16(2)
while position+8<=len(data):
    typ,size=u16(position),u32(position+4)
    if size<8 or position+size>len(data): raise ValueError('invalid XML chunk')
    if typ==0x0102:
        ext=position+16; start,size_attr,total=ext+u16(ext+8),u16(ext+10),u16(ext+12)
        if size_attr>=20 and start+total*size_attr<=position+size:
            for i in range(total):
                a=start+i*size_attr; name=u32(a+4)
                if name<count and strings[name][0]=='versionCode':
                    if data[a+15]!=0x10 or u32(a+16)!=93: raise ValueError('unexpected versionCode')
                    struct.pack_into('<I',data,a+16,94); changes+=1
    position+=size
if changes!=1: raise ValueError('expected one versionCode')
path.write_bytes(data); print('MANIFEST_78_OK binary-axml versionName=12.1.78 versionCode=94')
