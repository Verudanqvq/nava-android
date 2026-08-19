import struct
import sys
import zipfile
from pathlib import Path

RES_STRING_POOL_TYPE = 0x0001
RES_XML_START_ELEMENT_TYPE = 0x0102
OLD_VERSION = "12.1.24"
NEW_VERSION = "12.1.25"
NEW_CODE = 41


def u16(data, off):
    return struct.unpack_from("<H", data, off)[0]


def u32(data, off):
    return struct.unpack_from("<I", data, off)[0]


def p32(data, off, value):
    struct.pack_into("<I", data, off, value)


def decode_len8(data, pos):
    first = data[pos]
    pos += 1
    if first & 0x80:
        return ((first & 0x7F) << 8) | data[pos], pos + 1
    return first, pos


def decode_len16(data, pos):
    first = u16(data, pos)
    pos += 2
    if first & 0x8000:
        return ((first & 0x7FFF) << 16) | u16(data, pos), pos + 2
    return first, pos


def read_string_pool(data, off):
    header_size = u16(data, off + 2)
    size = u32(data, off + 4)
    count = u32(data, off + 8)
    flags = u32(data, off + 16)
    strings_start = u32(data, off + 20)
    utf8 = bool(flags & 0x100)
    offsets = [u32(data, off + header_size + i * 4) for i in range(count)]
    strings = []
    for string_off in offsets:
        pos = off + strings_start + string_off
        if utf8:
            _, pos = decode_len8(data, pos)
            byte_len, pos = decode_len8(data, pos)
            strings.append(bytes(data[pos:pos + byte_len]).decode("utf-8", "replace"))
        else:
            length, pos = decode_len16(data, pos)
            strings.append(bytes(data[pos:pos + length * 2]).decode("utf-16le", "replace"))
    return strings, size


def manifest_version_code(raw):
    data = bytearray(raw)
    root_header = u16(data, 2)
    total = u32(data, 4)
    off = root_header
    strings = None
    while off + 8 <= min(total, len(data)):
        chunk_type = u16(data, off)
        header_size = u16(data, off + 2)
        size = u32(data, off + 4)
        if size < 8:
            raise ValueError("Bad AndroidManifest chunk")
        if chunk_type == RES_STRING_POOL_TYPE and strings is None:
            strings, _ = read_string_pool(data, off)
        elif chunk_type == RES_XML_START_ELEMENT_TYPE and strings:
            ext = off + header_size
            elem_idx = u32(data, ext + 4)
            elem = strings[elem_idx] if elem_idx < len(strings) else ""
            if elem == "manifest":
                attr_start = u16(data, ext + 8)
                attr_size = u16(data, ext + 10)
                attr_count = u16(data, ext + 12)
                base = ext + attr_start
                for i in range(attr_count):
                    attr = base + i * attr_size
                    name_idx = u32(data, attr + 4)
                    name = strings[name_idx] if name_idx < len(strings) else ""
                    if name == "versionCode":
                        return u32(data, attr + 16)
        off += size
    raise ValueError("versionCode not found")


def patch_manifest(raw, old_name=OLD_VERSION, new_name=NEW_VERSION, new_code=NEW_CODE):
    if len(old_name.encode("utf-8")) != len(new_name.encode("utf-8")):
        raise ValueError("Version names must have equal encoded length for safe binary patching")

    data = bytearray(raw)
    root_header = u16(data, 2)
    total = u32(data, 4)
    off = root_header
    strings = None
    version_name_replaced = False

    while off + 8 <= min(total, len(data)):
        chunk_type = u16(data, off)
        header_size = u16(data, off + 2)
        size = u32(data, off + 4)
        if size < 8:
            raise ValueError("Bad AndroidManifest chunk")

        if chunk_type == RES_STRING_POOL_TYPE and strings is None:
            strings, _ = read_string_pool(data, off)
            utf8_old = old_name.encode("utf-8")
            utf8_new = new_name.encode("utf-8")
            utf16_old = old_name.encode("utf-16le")
            utf16_new = new_name.encode("utf-16le")
            before = bytes(data)
            data[:] = data.replace(utf8_old, utf8_new)
            data[:] = data.replace(utf16_old, utf16_new)
            version_name_replaced = bytes(data) != before
            strings, _ = read_string_pool(data, off)

        elif chunk_type == RES_XML_START_ELEMENT_TYPE and strings:
            ext = off + header_size
            elem_idx = u32(data, ext + 4)
            elem = strings[elem_idx] if elem_idx < len(strings) else ""
            if elem == "manifest":
                attr_start = u16(data, ext + 8)
                attr_size = u16(data, ext + 10)
                attr_count = u16(data, ext + 12)
                base = ext + attr_start
                found_code = False
                for i in range(attr_count):
                    attr = base + i * attr_size
                    name_idx = u32(data, attr + 4)
                    name = strings[name_idx] if name_idx < len(strings) else ""
                    if name == "versionCode":
                        p32(data, attr + 16, new_code)
                        found_code = True
                if not found_code:
                    raise ValueError("versionCode attribute not found")
                if not version_name_replaced:
                    raise ValueError(f"{old_name} versionName string not found in manifest")
                if manifest_version_code(bytes(data)) != new_code:
                    raise ValueError("versionCode verification failed")
                return bytes(data)
        off += size
    raise ValueError("manifest element not found")


def patch_js(original, replacement):
    markers = [
        "/* Nava v12.1.24 — reliable FREE push token bridge.",
        "/* Nava v12.1.22 — FREE push token bridge."
    ]
    start = -1
    for marker in markers:
        start = original.find(marker)
        if start >= 0:
            break
    if start < 0:
        raise ValueError("Nava push bridge marker not found in APK asset")
    end_marker = "})(document,window);"
    end = original.find(end_marker, start)
    if end < 0:
        raise ValueError("push bridge end marker not found")
    end += len(end_marker)
    patched = original[:start] + replacement.rstrip() + original[end:]
    if "appVersion:'12.1.25'" not in patched:
        raise ValueError("12.1.25 token registration marker missing after patch")
    if ".get().then(function(snapshot)" in replacement or "ref.get()" in replacement:
        raise ValueError("Forbidden pre-read exists in 12.1.25 registration block")
    return patched


def is_old_signature_entry(name):
    upper = name.upper()
    if not upper.startswith("META-INF/"):
        return False
    leaf = upper.rsplit("/", 1)[-1]
    return leaf == "MANIFEST.MF" or leaf.endswith((".SF", ".RSA", ".DSA", ".EC"))


def main():
    if len(sys.argv) != 5:
        raise SystemExit("usage: patch-apk.py INPUT.apk PUSH_BLOCK.js OUTPUT.apk NEW_CODE")
    source = Path(sys.argv[1])
    push_block = Path(sys.argv[2]).read_text(encoding="utf-8")
    target = Path(sys.argv[3])
    new_code = int(sys.argv[4])
    if new_code != NEW_CODE:
        raise ValueError(f"Expected versionCode {NEW_CODE}, got {new_code}")

    with zipfile.ZipFile(source, "r") as zin:
        names = set(zin.namelist())
        if "assets/nava_app_v11.js" not in names or "AndroidManifest.xml" not in names:
            raise ValueError("Expected Nava APK files are missing")
        original_js = zin.read("assets/nava_app_v11.js").decode("utf-8")
        patched_js = patch_js(original_js, push_block).encode("utf-8")
        patched_manifest = patch_manifest(zin.read("AndroidManifest.xml"), new_code=new_code)

        with zipfile.ZipFile(target, "w") as zout:
            for info in zin.infolist():
                if is_old_signature_entry(info.filename):
                    continue
                if info.filename == "assets/nava_app_v11.js":
                    zout.writestr(info, patched_js)
                elif info.filename == "AndroidManifest.xml":
                    zout.writestr(info, patched_manifest)
                else:
                    zout.writestr(info, zin.read(info.filename))

    with zipfile.ZipFile(target, "r") as check:
        js = check.read("assets/nava_app_v11.js").decode("utf-8")
        manifest = check.read("AndroidManifest.xml")
        if "appVersion:'12.1.25'" not in js:
            raise ValueError("Final APK JS verification failed")
        if manifest_version_code(manifest) != new_code:
            raise ValueError("Final APK manifest verification failed")

    print(f"PATCH_OK versionCode={new_code} js=12.1.25")


if __name__ == "__main__":
    main()
