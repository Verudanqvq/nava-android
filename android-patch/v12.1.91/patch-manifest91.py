from pathlib import Path
import struct,sys
if len(sys.argv)!=2:raise SystemExit('usage: patch-manifest91.py AndroidManifest.xml')
p=Path(sys.argv[1]);d=bytearray(p.read_bytes())
if len(d)<8 or struct.unpack_from('<H',d,0)[0]!=3:raise ValueError('manifest is not binary AXML')
def u16(o):return struct.unpack_from('<H',d,o)[0]
def u32(o):return struct.unpack_from('<I',d,o)[0]
pos=u16(2);pool=None
while pos+8<=len(d):
 size=u32(pos+4)
 if size<8 or pos+size>len(d):raise ValueError('invalid chunk')
 if u16(pos)==1:pool=pos;break
 pos+=size
if pool is None:raise ValueError('string pool missing')
count,flags,ss=u32(pool+8),u32(pool+16),u32(pool+20);offs=pool+28;utf8=bool(flags&256)
def l8(o):
 x=d[o];return (x&127,1) if x<128 else (((x&127)<<8)|d[o+1],2)
def l16(o):
 x=u16(o);return (x&32767,2) if x<32768 else (((x&32767)<<16)|u16(o+2),4)
def ent(i):
 o=pool+ss+u32(offs+i*4)
 if utf8:
  _,a=l8(o);n,b=l8(o+a);s=o+a+b;return bytes(d[s:s+n]).decode(),s,n
 n,a=l16(o);s=o+a;return bytes(d[s:s+n*2]).decode('utf-16le'),s,n*2
strings=[ent(i) for i in range(count)];names=0
for val,s,n in strings:
 if val=='12.1.73':
  repl='12.1.91'.encode('utf-8' if utf8 else 'utf-16le')
  if len(repl)!=n:raise ValueError('versionName length mismatch')
  d[s:s+n]=repl;names+=1
if names!=1:raise ValueError('expected one versionName')
codes=0;pos=u16(2)
while pos+8<=len(d):
 kind,size=u16(pos),u32(pos+4)
 if size<8 or pos+size>len(d):raise ValueError('invalid chunk')
 if kind==0x102:
  ex=pos+16;start=ex+u16(ex+8);asz=u16(ex+10);total=u16(ex+12)
  if asz>=20 and start+total*asz<=pos+size:
   for i in range(total):
    a=start+i*asz;name=u32(a+4)
    if name<count and strings[name][0]=='versionCode':
     if d[a+15]!=16 or u32(a+16)!=106:raise ValueError('unexpected source versionCode')
     struct.pack_into('<I',d,a+16,107);codes+=1
 pos+=size
if codes!=1:raise ValueError('expected one versionCode')
p.write_bytes(d);print('MANIFEST_91_OK versionName=12.1.91 versionCode=107')
