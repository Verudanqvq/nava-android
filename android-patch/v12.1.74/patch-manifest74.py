from pathlib import Path
import struct
import sys

if len(sys.argv) != 2:
    raise SystemExit('usage: patch-manifest74.py AndroidManifest.xml')

path = Path(sys.argv[1])
data = bytearray(path.read_bytes())
if len(data) < 8 or struct.unpack_from('<H', data, 0)[0] != 0x0003:
    raise ValueError('manifest is not binary AXML')

def u16(offset): return struct.unpack_from('<H', data, offset)[0]
def u32(offset): return struct.unpack_from('<I', data, offset)[0]

string_pool = None
position = u16(2)
while position + 8 <= len(data):
    chunk_type = u16(position)
    chunk_size = u32(position + 4)
    if chunk_size < 8 or position + chunk_size > len(data):
        raise ValueError('invalid AXML chunk')
    if chunk_type == 0x0001:
        string_pool = position
        break
    position += chunk_size
if string_pool is None:
    raise ValueError('string pool missing')

string_count = u32(string_pool + 8)
flags = u32(string_pool + 16)
strings_start = u32(string_pool + 20)
offsets_base = string_pool + 28
utf8 = bool(flags & 0x00000100)

def read_len8(offset):
    value = data[offset]
    return (value & 0x7F, 1) if not value & 0x80 else (((value & 0x7F) << 8) | data[offset + 1], 2)

def read_len16(offset):
    value = u16(offset)
    return (value & 0x7FFF, 2) if not value & 0x8000 else (((value & 0x7FFF) << 16) | u16(offset + 2), 4)

def string_entry(index):
    offset = string_pool + strings_start + u32(offsets_base + index * 4)
    if utf8:
        _, first_length = read_len8(offset)
        chars, second_length = read_len8(offset + first_length)
        start = offset + first_length + second_length
        return bytes(data[start:start + chars]).decode('utf-8'), start, chars
    chars, length_size = read_len16(offset)
    start = offset + length_size
    return bytes(data[start:start + chars * 2]).decode('utf-16le'), start, chars * 2

strings = [string_entry(index) for index in range(string_count)]
replaced_name = 0
for value, start, length in strings:
    if value != '12.1.73':
        continue
    replacement = '12.1.74'.encode('utf-8' if utf8 else 'utf-16le')
    if len(replacement) != length:
        raise ValueError('versionName replacement length mismatch')
    data[start:start + length] = replacement
    replaced_name += 1
if replaced_name != 1:
    raise ValueError('expected one versionName, found ' + str(replaced_name))

patched_code = 0
position = u16(2)
while position + 8 <= len(data):
    chunk_type = u16(position)
    chunk_size = u32(position + 4)
    if chunk_size < 8 or position + chunk_size > len(data):
        raise ValueError('invalid XML chunk')
    if chunk_type == 0x0102:
        extension = position + 16
        attributes_start = extension + u16(extension + 8)
        attributes_size = u16(extension + 10)
        attributes_count = u16(extension + 12)
        if attributes_size >= 20 and attributes_start + attributes_count * attributes_size <= position + chunk_size:
            for index in range(attributes_count):
                attribute = attributes_start + index * attributes_size
                name_index = u32(attribute + 4)
                if name_index >= string_count or strings[name_index][0] != 'versionCode':
                    continue
                if data[attribute + 15] != 0x10 or u32(attribute + 16) != 89:
                    raise ValueError('unexpected versionCode attribute')
                struct.pack_into('<I', data, attribute + 16, 90)
                patched_code += 1
    position += chunk_size
if patched_code != 1:
    raise ValueError('expected one versionCode, found ' + str(patched_code))

path.write_bytes(data)
print('MANIFEST_74_OK binary-axml versionName=12.1.74 versionCode=90')
