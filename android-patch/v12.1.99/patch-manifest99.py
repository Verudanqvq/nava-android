from pathlib import Path
import struct
import sys

if len(sys.argv) != 2: raise SystemExit('usage: patch-manifest93.py AndroidManifest.xml')
path = Path(sys.argv[1]); data = bytearray(path.read_bytes())
if len(data) < 8 or struct.unpack_from('<H', data, 0)[0] != 0x0003: raise ValueError('manifest is not binary AXML')
def u16(offset): return struct.unpack_from('<H', data, offset)[0]
def u32(offset): return struct.unpack_from('<I', data, offset)[0]
pool = None; position = u16(2)
while position + 8 <= len(data):
    size = u32(position + 4)
    if size < 8 or position + size > len(data): raise ValueError('invalid AXML chunk')
    if u16(position) == 0x0001: pool = position; break
    position += size
if pool is None: raise ValueError('string pool missing')
count, flags, strings_start = u32(pool + 8), u32(pool + 16), u32(pool + 20)
offsets = pool + 28; utf8 = bool(flags & 0x100)
def length8(offset):
    value = data[offset]
    return (value & 0x7f, 1) if not value & 0x80 else (((value & 0x7f) << 8) | data[offset + 1], 2)
def length16(offset):
    value = u16(offset)
    return (value & 0x7fff, 2) if not value & 0x8000 else (((value & 0x7fff) << 16) | u16(offset + 2), 4)
def entry(index):
    offset = pool + strings_start + u32(offsets + index * 4)
    if utf8:
        _, first = length8(offset); length, second = length8(offset + first); start = offset + first + second
        return bytes(data[start:start + length]).decode(), start, length
    length, prefix = length16(offset); start = offset + prefix
    return bytes(data[start:start + length * 2]).decode('utf-16le'), start, length * 2
strings = [entry(index) for index in range(count)]
names = 0
for value, start, length in strings:
    if value == '12.1.98':
        replacement = '12.2.19'.encode('utf-8' if utf8 else 'utf-16le')
        if len(replacement) != length: raise ValueError('versionName length mismatch')
        data[start:start + length] = replacement; names += 1
if names != 1: raise ValueError('expected one versionName')
codes = 0; position = u16(2)
while position + 8 <= len(data):
    kind, size = u16(position), u32(position + 4)
    if size < 8 or position + size > len(data): raise ValueError('invalid AXML chunk')
    if kind == 0x0102:
        extension = position + 16; start = extension + u16(extension + 8); attribute_size = u16(extension + 10); total = u16(extension + 12)
        if attribute_size >= 20 and start + total * attribute_size <= position + size:
            for index in range(total):
                attribute = start + index * attribute_size; name = u32(attribute + 4)
                if name < count and strings[name][0] == 'versionCode':
                    if data[attribute + 15] != 0x10 or u32(attribute + 16) != 114: raise ValueError('unexpected versionCode')
                    struct.pack_into('<I', data, attribute + 16, 134); codes += 1
    position += size
if codes != 1: raise ValueError('expected one source versionCode')
path.write_bytes(data)
print('MANIFEST_214_OK versionName=12.2.19 versionCode=134')
