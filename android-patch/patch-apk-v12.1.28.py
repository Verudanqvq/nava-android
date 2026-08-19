import struct
import sys
import zipfile
from pathlib import Path

RES_STRING_POOL_TYPE = 0x0001
RES_XML_START_ELEMENT_TYPE = 0x0102
OLD_VERSION = "12.1.27"
NEW_VERSION = "12.1.28"
NEW_CODE = 44
OLD_PUSH_MARKER = "/* Nava v12.1.27 — Firestore-safe Android push token registration."
NEW_PUSH_MARKER = "/* Nava v12.1.28 — Firestore-safe Android push token registration."
OLD_CSS_MARKER = "/* Nava Android v12.1.27 — profile/editor mobile layout fix. */"
NEW_CSS_MARKER = "/* Nava Android v12.1.28 — profile/admin/search/small-screen polish. */"
NEW_JS_MARKER = "/* Nava Android v12.1.28 — profile/search live polish. */"


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
    if len(old_name.encode()) != len(new_name.encode()):
        raise ValueError("Version names must have equal encoded length")
    data = bytearray(raw)
    root_header = u16(data, 2)
    total = u32(data, 4)
    off = root_header
    strings = None
    replaced = False
    while off + 8 <= min(total, len(data)):
        chunk_type = u16(data, off)
        header_size = u16(data, off + 2)
        size = u32(data, off + 4)
        if size < 8:
            raise ValueError("Bad AndroidManifest chunk")
        if chunk_type == RES_STRING_POOL_TYPE and strings is None:
            strings, _ = read_string_pool(data, off)
            before = bytes(data)
            data[:] = data.replace(old_name.encode("utf-8"), new_name.encode("utf-8"))
            data[:] = data.replace(old_name.encode("utf-16le"), new_name.encode("utf-16le"))
            replaced = bytes(data) != before
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
                found = False
                for i in range(attr_count):
                    attr = base + i * attr_size
                    name_idx = u32(data, attr + 4)
                    name = strings[name_idx] if name_idx < len(strings) else ""
                    if name == "versionCode":
                        p32(data, attr + 16, new_code)
                        found = True
                if not replaced or not found:
                    raise ValueError("Manifest version patch failed")
                if manifest_version_code(bytes(data)) != new_code:
                    raise ValueError("Manifest versionCode verification failed")
                return bytes(data)
        off += size
    raise ValueError("manifest element not found")


def replace_push_block(original, push_block):
    start = original.find(OLD_PUSH_MARKER)
    if start < 0:
        raise ValueError("12.1.27 push marker not found")
    end_marker = "})(document,window);"
    end = original.find(end_marker, start)
    if end < 0:
        raise ValueError("push bridge end marker not found")
    end += len(end_marker)
    patched = original[:start] + push_block.rstrip() + original[end:]
    if NEW_PUSH_MARKER not in patched or "appVersion:'12.1.28'" not in patched:
        raise ValueError("12.1.28 push block verification failed")
    if OLD_PUSH_MARKER in patched:
        raise ValueError("old push block still present")
    return patched


def patch_js(original, push_block, profile_block):
    if NEW_JS_MARKER in original:
        raise ValueError("12.1.28 profile JS already present")
    critical = ["readerSaveTimer", "nava-reader", "markRead", "markUnread", "navaAndroidOpenNotifications", "volumeReadSet"]
    before = {m: original.count(m) for m in critical}
    patched = replace_push_block(original, push_block)
    patched = patched.rstrip() + "\n\n" + profile_block.strip() + "\n"
    if NEW_JS_MARKER not in patched:
        raise ValueError("profile JS marker missing")
    after = {m: patched.count(m) for m in critical}
    if before != after:
        raise ValueError(f"critical Android JS marker counts changed: {before} -> {after}")
    return patched


def patch_css(original, css_block):
    if OLD_CSS_MARKER not in original:
        raise ValueError("12.1.27 profile fix missing from source CSS")
    if NEW_CSS_MARKER in original:
        raise ValueError("12.1.28 CSS already present")
    critical = ["#nava-reader", ".nava-reader-", ".nava-volume-chapter-row-v9", "#nava-app-bottom", "#nava-app-topbar"]
    before = {m: original.count(m) for m in critical}
    patched = original.rstrip() + "\n\n" + css_block.strip() + "\n"
    after = {m: patched.count(m) for m in critical}
    if before != after:
        raise ValueError(f"critical Android CSS marker counts changed: {before} -> {after}")
    if NEW_CSS_MARKER not in patched:
        raise ValueError("12.1.28 CSS marker missing")
    return patched


def old_signature(name):
    upper = name.upper()
    if not upper.startswith("META-INF/"):
        return False
    leaf = upper.rsplit("/", 1)[-1]
    return leaf == "MANIFEST.MF" or leaf.endswith((".SF", ".RSA", ".DSA", ".EC"))


def main():
    if len(sys.argv) != 7:
        raise SystemExit("usage: patch-apk-v12.1.28.py INPUT.apk PUSH.js PROFILE.js PROFILE.css OUTPUT.apk NEW_CODE")
    source = Path(sys.argv[1])
    push_block = Path(sys.argv[2]).read_text(encoding="utf-8")
    profile_block = Path(sys.argv[3]).read_text(encoding="utf-8")
    css_block = Path(sys.argv[4]).read_text(encoding="utf-8")
    target = Path(sys.argv[5])
    new_code = int(sys.argv[6])
    if new_code != NEW_CODE:
        raise ValueError(f"Expected versionCode {NEW_CODE}, got {new_code}")
    if ".get().then(function(snapshot)" in push_block or "ref.get()" in push_block:
        raise ValueError("Forbidden pre-read exists in push registration block")

    with zipfile.ZipFile(source, "r") as zin:
        required = {"assets/nava_app_v11.js", "assets/nava_app_v11.css", "AndroidManifest.xml"}
        if not required.issubset(set(zin.namelist())):
            raise ValueError("Expected Nava APK files are missing")
        original_js = zin.read("assets/nava_app_v11.js").decode("utf-8")
        original_css = zin.read("assets/nava_app_v11.css").decode("utf-8")
        patched_js = patch_js(original_js, push_block, profile_block).encode("utf-8")
        patched_css = patch_css(original_css, css_block).encode("utf-8")
        patched_manifest = patch_manifest(zin.read("AndroidManifest.xml"), new_code=new_code)
        with zipfile.ZipFile(target, "w") as zout:
            for info in zin.infolist():
                if old_signature(info.filename):
                    continue
                if info.filename == "assets/nava_app_v11.js":
                    zout.writestr(info, patched_js)
                elif info.filename == "assets/nava_app_v11.css":
                    zout.writestr(info, patched_css)
                elif info.filename == "AndroidManifest.xml":
                    zout.writestr(info, patched_manifest)
                else:
                    zout.writestr(info, zin.read(info.filename))

    allowed = {"assets/nava_app_v11.js", "assets/nava_app_v11.css", "AndroidManifest.xml"}
    with zipfile.ZipFile(source, "r") as src, zipfile.ZipFile(target, "r") as out:
        js = out.read("assets/nava_app_v11.js").decode("utf-8")
        css = out.read("assets/nava_app_v11.css").decode("utf-8")
        if NEW_JS_MARKER not in js or NEW_PUSH_MARKER not in js:
            raise ValueError("Final JS verification failed")
        if NEW_CSS_MARKER not in css or OLD_CSS_MARKER not in css:
            raise ValueError("Final CSS verification failed")
        if manifest_version_code(out.read("AndroidManifest.xml")) != NEW_CODE:
            raise ValueError("Final manifest verification failed")
        for name in src.namelist():
            if old_signature(name) or name in allowed:
                continue
            if name not in out.namelist() or src.read(name) != out.read(name):
                raise ValueError(f"Unexpected changed APK entry: {name}")
    print("PATCH_OK versionCode=44 js=12.1.28 profile=live-search css=admin-small-screen unchanged_entries=ok")


if __name__ == "__main__":
    main()
