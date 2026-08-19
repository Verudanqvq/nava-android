import struct
import sys
import zipfile
from pathlib import Path

RES_STRING_POOL_TYPE = 0x0001
RES_XML_START_ELEMENT_TYPE = 0x0102
OLD_VERSION = "12.1.26"
NEW_VERSION = "12.1.27"
NEW_CODE = 43

PROFILE_ACTION_OLD = ".nava-profile-hero-actions{position:absolute!important;top:9px!important;right:9px!important;margin:0!important}"
PROFILE_ACTION_NEW = "html.nava-app-v9 body.nava-app-profile .nava-profile-hero-actions{position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;inset:auto!important;align-self:stretch!important;width:100%!important;margin:4px 0 0!important;display:flex!important}"
CSS_PATCH_MARKER = "/* Nava Android v12.1.27 — profile/editor mobile layout fix. */"
CSS_PATCH = r'''
/* Nava Android v12.1.27 — profile/editor mobile layout fix. */
html.nava-app-v9 body.nava-app-profile .nava-profile-hero{min-height:0!important}
html.nava-app-v9 body.nava-app-profile .nava-profile-hero-inner{min-height:0!important;justify-content:flex-start!important;height:auto!important}
html.nava-app-v9 body.nava-app-profile .nava-profile-hero .nava-profile-hero-actions{position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;inset:auto!important;align-self:stretch!important;width:100%!important;margin:4px 0 0!important;display:flex!important}
html.nava-app-v9 body.nava-app-profile .nava-profile-hero .nava-profile-edit{width:100%!important;min-height:38px!important;padding:8px 10px!important;justify-content:center!important;font-size:10.5px!important}

html.nava-app-v9 .nava-profile-edit-modal{width:100%!important;max-width:none!important;height:min(94dvh,760px)!important;max-height:94dvh!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;border-radius:12px 12px 0 0!important;padding-bottom:0!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-modal-head{position:relative!important;top:auto!important;z-index:2!important;flex:0 0 auto!important;padding:10px 12px!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-modal-body{flex:1 1 auto!important;min-height:0!important;overflow-x:hidden!important;overflow-y:auto!important;padding:10px!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-modal-actions{position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;z-index:2!important;flex:0 0 auto!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important;padding:8px 10px max(8px,env(safe-area-inset-bottom))!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-modal-actions .nava-btn{width:100%!important;min-width:0!important;margin:0!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-profile-edit-form{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-profile-edit-form *{box-sizing:border-box!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-field,html.nava-app-v9 .nava-profile-edit-modal .nava-profile-banner-settings,html.nava-app-v9 .nava-profile-edit-modal .nava-admin-profile-settings,html.nava-app-v9 .nava-profile-edit-modal .nava-admin-upload-grid,html.nava-app-v9 .nava-profile-edit-modal .nava-upload-card{min-width:0!important;max-width:100%!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-input,html.nava-app-v9 .nava-profile-edit-modal .nava-textarea,html.nava-app-v9 .nava-profile-edit-modal .nava-file-input{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-file-input{overflow:hidden!important;white-space:nowrap!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-avatar-picker{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-banner-picker{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-admin-upload-grid{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:9px!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-upload-preview{display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;align-items:center!important;gap:8px!important;min-width:0!important;max-width:100%!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-upload-preview span,html.nava-app-v9 .nava-profile-edit-modal .nava-toggle-copy{min-width:0!important;overflow-wrap:anywhere!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-upload-remove{width:100%!important;max-width:100%!important;white-space:normal!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-toggle-row{align-items:center!important;gap:9px!important;min-width:0!important}
html.nava-app-v9 .nava-profile-edit-modal .nava-switch{flex:0 0 44px!important}
@media(max-width:380px){html.nava-app-v9 .nava-profile-edit-modal .nava-modal-actions{grid-template-columns:1fr!important}html.nava-app-v9 .nava-profile-edit-modal .nava-file-input::file-selector-button{width:100%!important;max-width:100%!important;margin:0 0 5px!important}}
'''.strip()


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
        "/* Nava v12.1.26 — Firestore-safe Android push token registration.",
        "/* Nava v12.1.25 — Firestore-safe Android push token registration.",
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
    if "appVersion:'12.1.27'" not in patched:
        raise ValueError("12.1.27 token registration marker missing after patch")
    if ".get().then(function(snapshot)" in replacement or "ref.get()" in replacement:
        raise ValueError("Forbidden pre-read exists in 12.1.27 registration block")
    return patched


def patch_css(original):
    if CSS_PATCH_MARKER in original:
        raise ValueError("12.1.27 CSS patch already present in source APK")
    if PROFILE_ACTION_OLD not in original:
        raise ValueError("Expected absolute profile action rule not found in Android CSS")
    patched = original.replace(PROFILE_ACTION_OLD, PROFILE_ACTION_NEW, 1)
    patched = patched.rstrip() + "\n\n" + CSS_PATCH + "\n"
    if PROFILE_ACTION_OLD in patched:
        raise ValueError("Old absolute profile action rule still present")
    if CSS_PATCH_MARKER not in patched:
        raise ValueError("Profile editor CSS patch marker missing")
    if ".nava-profile-edit-modal" not in patched:
        raise ValueError("Profile editor modal patch missing")
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
        required = {"assets/nava_app_v11.js", "assets/nava_app_v11.css", "AndroidManifest.xml"}
        if not required.issubset(names):
            raise ValueError("Expected Nava APK files are missing")
        original_js = zin.read("assets/nava_app_v11.js").decode("utf-8")
        original_css = zin.read("assets/nava_app_v11.css").decode("utf-8")
        patched_js = patch_js(original_js, push_block).encode("utf-8")
        patched_css = patch_css(original_css).encode("utf-8")
        patched_manifest = patch_manifest(zin.read("AndroidManifest.xml"), new_code=new_code)

        with zipfile.ZipFile(target, "w") as zout:
            for info in zin.infolist():
                if is_old_signature_entry(info.filename):
                    continue
                if info.filename == "assets/nava_app_v11.js":
                    zout.writestr(info, patched_js)
                elif info.filename == "assets/nava_app_v11.css":
                    zout.writestr(info, patched_css)
                elif info.filename == "AndroidManifest.xml":
                    zout.writestr(info, patched_manifest)
                else:
                    zout.writestr(info, zin.read(info.filename))

    allowed_changes = {"assets/nava_app_v11.js", "assets/nava_app_v11.css", "AndroidManifest.xml"}
    with zipfile.ZipFile(source, "r") as src_check, zipfile.ZipFile(target, "r") as check:
        js = check.read("assets/nava_app_v11.js").decode("utf-8")
        css = check.read("assets/nava_app_v11.css").decode("utf-8")
        manifest = check.read("AndroidManifest.xml")
        if "appVersion:'12.1.27'" not in js:
            raise ValueError("Final APK JS verification failed")
        if CSS_PATCH_MARKER not in css or PROFILE_ACTION_OLD in css:
            raise ValueError("Final APK CSS verification failed")
        if manifest_version_code(manifest) != new_code:
            raise ValueError("Final APK manifest verification failed")
        for name in src_check.namelist():
            if is_old_signature_entry(name) or name in allowed_changes:
                continue
            if name not in check.namelist():
                raise ValueError(f"Unexpected missing APK entry: {name}")
            if src_check.read(name) != check.read(name):
                raise ValueError(f"Unexpected changed APK entry: {name}")

    print(f"PATCH_OK versionCode={new_code} js=12.1.27 css=profile-editor-v12127 unchanged_entries=ok")


if __name__ == "__main__":
    main()
