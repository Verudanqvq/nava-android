from pathlib import Path
import struct
import sys
if len(sys.argv)!=2: raise SystemExit('usage: patch-manifest83.py AndroidManifest.xml')
path=Path(sys.argv[1]); data=bytearray(path.read_bytes())
if len(data)<8 or struct.unpack_from('<H',data,0)[0]!=0x0003: raise ValueError('manifest is not binary AXML')
def u16(o): return struct.unpack_from('<H',data,o)[0]
def u32(o): return struct.unpack_from('<I',data,o)[0]
pool=None; pos=u16(2)
while pos+8<=len(data):
 size=u32(pos+4)
 if size<8 or pos+size>len(data): raise ValueError('invalid AXML chunk')
 if u16(pos)==0x0001: pool=pos; break
 pos+=size
if pool is None: raise ValueError('string pool missing')
count,flags,strings_start=u32(pool+8),u32(pool+16),u32(pool+20); offsets=pool+28; utf8=bool(flags&0x100)
def l8(o):
 v=data[o]; return (v&0x7f,1) if not v&0x80 else (((v&0x7f)<<8)|data[o+1],2)
def l16(o):
 v=u16(o); return (v&0x7fff,2) if not v&0x8000 else (((v&0x7fff)<<16)|u16(o+2),4)
def entry(i):
 o=pool+strings_start+u32(offsets+i*4)
 if utf8:
  _,a=l8(o); n,b=l8(o+a); s=o+a+b; return bytes(data[s:s+n]).decode('utf-8'),s,n
 n,a=l16(o); s=o+a; return bytes(data[s:s+n*2]).decode('utf-16le'),s,n*2
strings=[entry(i) for i in range(count)]; names=0
for value,start,length in strings:
 if value=='12.1.73':
  new='12.1.83'.encode('utf-8' if utf8 else 'utf-16le')
  if len(new)!=length: raise ValueError('versionName length mismatch')
  data[start:start+length]=new; names+=1
if names!=1: raise ValueError('expected one versionName')
codes=0; pos=u16(2)
while pos+8<=len(data):
 kind,size=u16(pos),u32(pos+4)
 if size<8 or pos+size>len(data): raise ValueError('invalid XML chunk')
 if kind==0x0102:
  ext=pos+16; start=ext+u16(ext+8); attr_size=u16(ext+10); total=u16(ext+12)
  if attr_size>=20 and start+total*attr_size<=pos+size:
   for i in range(total):
    a=start+i*attr_size; name=u32(a+4)
    if name<count and strings[name][0]=='versionCode':
     if data[a+15]!=0x10 or u32(a+16)!=89: raise ValueError('unexpected versionCode')
     struct.pack_into('<I',data,a+16,99); codes+=1
 pos+=size
if codes!=1: raise ValueError('expected one versionCode')
path.write_bytes(data)
print('MANIFEST_83_OK versionName=12.1.83 versionCode=99')
