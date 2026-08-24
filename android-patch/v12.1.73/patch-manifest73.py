from pathlib import Path
import struct, sys

if len(sys.argv) != 2:
    raise SystemExit('usage: patch-manifest73.py AndroidManifest.xml')

p = Path(sys.argv[1])
b = bytearray(p.read_bytes())

# AndroidManifest.xml inside an APK is binary AXML, not UTF-8 XML.
if len(b) < 8 or struct.unpack_from('<H', b, 0)[0] != 0x0003:
    raise ValueError('manifest is not binary AXML')

def u16(off): return struct.unpack_from('<H', b, off)[0]
def u32(off): return struct.unpack_from('<I', b, off)[0]

# Decode the string pool just enough to resolve attribute names and replace
# versionName without changing any string-pool lengths or chunk sizes.
sp = None
pos = u16(2)
limit = len(b)
while pos + 8 <= limit:
    typ = u16(pos)
    size = u32(pos + 4)
    if size < 8 or pos + size > limit:
        raise ValueError('invalid AXML chunk')
    if typ == 0x001C:
        sp = pos
        break
    pos += size
if sp is None:
    raise ValueError('string pool missing')

string_count = u32(sp + 8)
flags = u32(sp + 16)
strings_start = u32(sp + 20)
offsets_base = sp + 28
utf8 = bool(flags & 0x00000100)

def read_len8(off):
    x = b[off]
    return (x & 0x7F, 1) if not (x & 0x80) else (((x & 0x7F) << 8) | b[off+1], 2)

def read_len16(off):
    x = u16(off)
    return (x & 0x7FFF, 2) if not (x & 0x8000) else (((x & 0x7FFF) << 16) | u16(off+2), 4)

def string_entry(idx):
    if idx < 0 or idx >= string_count:
        return '', None, None
    local = u32(offsets_base + idx * 4)
    start = sp + strings_start + local
    if utf8:
        _, a = read_len8(start)
        chars, c = read_len8(start + a)
        data_start = start + a + c
        raw = bytes(b[data_start:data_start + chars])
        return raw.decode('utf-8'), data_start, chars
    chars, a = read_len16(start)
    data_start = start + a
    raw = bytes(b[data_start:data_start + chars * 2])
    return raw.decode('utf-16le'), data_start, chars * 2

strings = {}
for i in range(string_count):
    s, ds, ln = string_entry(i)
    strings[i] = (s, ds, ln)

# Replace versionName in-place. Same byte length is mandatory.
replaced_name = 0
for i, (s, ds, ln) in strings.items():
    if s == '12.1.72':
        new = '12.1.73'
        enc = new.encode('utf-8' if utf8 else 'utf-16le')
        old = s.encode('utf-8' if utf8 else 'utf-16le')
        if len(enc) != len(old) or len(enc) != ln:
            raise ValueError('versionName replacement length mismatch')
        b[ds:ds + len(enc)] = enc
        replaced_name += 1
if replaced_name != 1:
    raise ValueError('expected exactly one versionName string, found '+str(replaced_name))

# Walk XML chunks and patch the versionCode typed integer by resolving the
# attribute name through the same string pool.
pos = u16(2)
patched_code = 0
while pos + 8 <= limit:
    typ = u16(pos)
    size = u32(pos + 4)
    if size < 8 or pos + size > limit:
        raise ValueError('invalid AXML chunk while walking')
    if typ == 0x0102:  # RES_XML_START_ELEMENT_TYPE
        ext = pos + 16
        if ext + 20 <= pos + size:
            attr_start = u16(ext + 8)
            attr_size = u16(ext + 10)
            attr_count = u16(ext + 12)
            attrs = ext + attr_start
            if attr_size >= 20 and attrs + attr_count * attr_size <= pos + size:
                for j in range(attr_count):
                    a = attrs + j * attr_size
                    name_idx = u32(a + 4)
                    name, _, _ = string_entry(name_idx)
                    if name != 'versionCode':
                        continue
                    data_type = b[a + 15]
                    if data_type != 0x10:  # TYPE_INT_DEC
                        raise ValueError('versionCode is not integer typed')
                    old_code = u32(a + 16)
                    if old_code != 88:
                        raise ValueError('expected versionCode=88, found '+str(old_code))
                    struct.pack_into('<I', b, a + 16, 89)
                    patched_code += 1
    pos += size

if patched_code != 1:
    raise ValueError('expected exactly one versionCode attribute, found '+str(patched_code))

p.write_bytes(b)
print('MANIFEST_73_OK binary-axml versionName=12.1.73 versionCode=89')
