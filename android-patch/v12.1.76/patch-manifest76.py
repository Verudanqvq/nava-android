from pathlib import Path
import struct
import sys

if len(sys.argv) != 2:
    raise SystemExit('usage: patch-manifest76.py AndroidManifest.xml')

path = Path(sys.argv[1])
data = bytearray(path.read_bytes())
if len(data) < 8 or struct.unpack_from('<H', data, 0)[0] != 0x0003:
    raise ValueError('manifest is not binary AXML')

def u16(offset): return struct.unpack_from('<H', data, offset)[0]
def u32(offset): return struct.unpack_from('<I', data, offset)[0]

pool = None
position = u16(2)
while position + 8 <= len(data):
    chunk_size = u32(position + 4)
    if chunk_size < 8 or position + chunk_size > len(data):
        raise ValueError('invalid AXML chunk')
    if u16(position) == 0x0001:
        pool = position
        break
    position += chunk_size
if pool is None:
    raise ValueError('string pool missing')

count, flags, strings_start = u32(pool + 8), u32(pool + 16), u32(pool + 20)
offsets = pool + 28
utf8 = bool(flags & 0x00000100)

def read_length8(offset):
    value = data[offset]
    return (value & 0x7F, 1) if not value & 0x80 else (((value & 0x7F) << 8) | data[offset + 1], 2)

def read_length16(offset):
    value = u16(offset)
    return (value & 0x7FFF, 2) if not value & 0x8000 else (((value & 0x7FFF) << 16) | u16(offset + 2), 4)

def entry(index):
    offset = pool + strings_start + u32(offsets + index * 4)
    if utf8:
        _, first = read_length8(offset)
        chars, second = read_length8(offset + first)
        start = offset + first + second
        return bytes(data[start:start + chars]).decode('utf-8'), start, chars
    chars, prefix = read_length16(offset)
    start = offset + prefix
    return bytes(data[start:start + chars * 2]).decode('utf-16le'), start, chars * 2

strings = [entry(index) for index in range(count)]
name_changes = 0
for value, start, length in strings:
    if value == '12.1.73':
        replacement = '12.1.76'.encode('utf-8' if utf8 else 'utf-16le')
        if len(replacement) != length:
            raise ValueError('versionName length mismatch')
        data[start:start + length] = replacement
        name_changes += 1
if name_changes != 1:
    raise ValueError('expected one versionName')

code_changes = 0
position = u16(2)
while position + 8 <= len(data):
    chunk_type, chunk_size = u16(position), u32(position + 4)
    if chunk_size < 8 or position + chunk_size > len(data):
        raise ValueError('invalid XML chunk')
    if chunk_type == 0x0102:
        extension = position + 16
        start, size, total = extension + u16(extension + 8), u16(extension + 10), u16(extension + 12)
        if size >= 20 and start + total * size <= position + chunk_size:
            for index in range(total):
                attribute = start + index * size
                name = u32(attribute + 4)
                if name < count and strings[name][0] == 'versionCode':
                    if data[attribute + 15] != 0x10 or u32(attribute + 16) != 89:
                        raise ValueError('unexpected versionCode')
                    struct.pack_into('<I', data, attribute + 16, 92)
                    code_changes += 1
    position += chunk_size
if code_changes != 1:
    raise ValueError('expected one versionCode')

path.write_bytes(data)
print('MANIFEST_76_OK binary-axml versionName=12.1.76 versionCode=92')
