#!/usr/bin/env bash
set -euo pipefail

SOURCE_TAG=v12.2.27
TARGET_TAG=v12.2.28
EXPECTED_SOURCE_SHA256=6e31137314bcefd3459259ee106e83bc44a9fa486d95944410faab8556435bb8
EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe
STATUS=/tmp/status228.txt
: > "$STATUS"
trap 'rc=$?; if [ "$rc" -ne 0 ]; then printf "status=failed\n" >> "$STATUS"; fi; exit "$rc"' EXIT

mkdir -p /tmp/nava-source
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/nava-source
SOURCE_APK=/tmp/nava-source/Nava.apk
test "$(sha256sum "$SOURCE_APK" | cut -d' ' -f1)" = "$EXPECTED_SOURCE_SHA256"

BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
SOURCE_BADGING="$("$BUILD_TOOLS/aapt" dump badging "$SOURCE_APK")"
printf '%s\n' "$SOURCE_BADGING" | grep -q "package: name='com.verudanava.nava' versionCode='158' versionName='12.2.27'"

set +x
export NAVA_KDF_SECRET="$(printf '%s' "$FIREBASE_SERVICE_ACCOUNT" | sha256sum | cut -d' ' -f1)"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -in .github/nava-signing/private.pem.enc -out /tmp/nava-private.pem -pass env:NAVA_KDF_SECRET
unset NAVA_KDF_SECRET
openssl pkeyutl -decrypt -inkey /tmp/nava-private.pem -in android-signing/key-material.enc -out /tmp/key-material.bin -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256
python - <<'PY'
from pathlib import Path
payload = Path('/tmp/key-material.bin').read_bytes()
assert len(payload) == 48
Path('/tmp/aes-key').write_text(payload[:32].hex())
Path('/tmp/aes-iv').write_text(payload[32:].hex())
PY
openssl enc -d -aes-256-cbc -K "$(cat /tmp/aes-key)" -iv "$(cat /tmp/aes-iv)" -in android-signing/signing-payload.enc -out /tmp/signing.zip
mkdir -p /tmp/nava-signing
unzip -q /tmp/signing.zip -d /tmp/nava-signing
rm -f /tmp/nava-private.pem /tmp/key-material.bin /tmp/aes-key /tmp/aes-iv /tmp/signing.zip

python - "$SOURCE_APK" /tmp/Nava-unsigned.apk <<'PY'
import hashlib, struct, sys, zipfile, zlib
from pathlib import Path

source, output = map(Path, sys.argv[1:])
old_version, new_version = b'12.2.27', b'12.2.28'
old_agent, new_agent = b'Nava-Android/12.1.23', b'Nava-Android/12.2.28'

def u16(data, offset): return struct.unpack_from('<H', data, offset)[0]
def u32(data, offset): return struct.unpack_from('<I', data, offset)[0]
def p32(data, offset, value): struct.pack_into('<I', data, offset, value)

def utf8_length(data, offset):
    first = data[offset]
    return ((first & 0x7f, 1) if not first & 0x80 else (((first & 0x7f) << 8) | data[offset + 1], 2))

def strings(data, offset):
    header_size, count, flags, start = u16(data, offset + 2), u32(data, offset + 8), u32(data, offset + 16), u32(data, offset + 20)
    assert flags & 0x100
    result = []
    for index in range(count):
        cursor = offset + start + u32(data, offset + header_size + index * 4)
        _, size = utf8_length(data, cursor); cursor += size
        length, size = utf8_length(data, cursor); cursor += size
        result.append((bytes(data[cursor:cursor + length]).decode('utf-8'), cursor, length))
    return result

def patch_manifest(payload):
    data = bytearray(payload)
    offset, pool_offset = u16(data, 2), None
    while offset + 8 <= len(data):
        chunk_size = u32(data, offset + 4)
        assert chunk_size >= 8 and offset + chunk_size <= len(data)
        if u16(data, offset) == 1:
            pool_offset = offset
            break
        offset += chunk_size
    assert pool_offset is not None
    pool = strings(data, pool_offset)
    versions = [item for item in pool if item[0] == old_version.decode()]
    assert len(versions) == 1
    _, position, length = versions[0]
    assert len(new_version) == length
    data[position:position + length] = new_version
    changed = 0
    offset = u16(data, 2)
    while offset + 8 <= len(data):
        chunk_type, header_size, chunk_size = u16(data, offset), u16(data, offset + 2), u32(data, offset + 4)
        assert chunk_size >= 8 and offset + chunk_size <= len(data)
        if chunk_type == 0x0102:
            extension = offset + header_size
            attribute_start, attribute_size, attribute_count = u16(data, extension + 8), u16(data, extension + 10), u16(data, extension + 12)
            for index in range(attribute_count):
                attribute = extension + attribute_start + index * attribute_size
                name_index = u32(data, attribute + 4)
                if pool[name_index][0] == 'versionCode':
                    assert data[attribute + 15] == 0x10 and u32(data, attribute + 16) == 158
                    p32(data, attribute + 16, 159)
                    changed += 1
        offset += chunk_size
    assert changed == 1
    return bytes(data)

def patch_dex(payload):
    data = bytearray(payload)
    assert data.count(old_agent) == 1
    data[:] = data.replace(old_agent, new_agent, 1)
    data[12:32] = hashlib.sha1(data[32:]).digest()
    p32(data, 8, zlib.adler32(data[12:]) & 0xffffffff)
    return bytes(data)

with zipfile.ZipFile(source) as input_zip:
    manifest = patch_manifest(input_zip.read('AndroidManifest.xml'))
    classes = patch_dex(input_zip.read('classes.dex'))
    with zipfile.ZipFile(output, 'w') as output_zip:
        for info in input_zip.infolist():
            upper = info.filename.upper()
            leaf = upper.rsplit('/', 1)[-1]
            if upper.startswith('META-INF/') and (leaf == 'MANIFEST.MF' or leaf.endswith(('.SF', '.RSA', '.DSA', '.EC'))):
                continue
            payload = manifest if info.filename == 'AndroidManifest.xml' else classes if info.filename == 'classes.dex' else input_zip.read(info.filename)
            output_zip.writestr(info, payload)

with zipfile.ZipFile(output) as result, zipfile.ZipFile(source) as original:
    assert new_agent in result.read('classes.dex')
    assert result.read('classes2.dex') == original.read('classes2.dex')
    assert result.read('assets/nava_app_v11.js') == original.read('assets/nava_app_v11.js')
print('APK_PATCH_OK versionName=12.2.28 versionCode=159 updater-agent=12.2.28')
PY

"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROP=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROP" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROP" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROP" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk > /tmp/verify228.txt
CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify228.txt | sed -E 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERT" = "$EXPECTED_CERT_SHA256"
"$BUILD_TOOLS/aapt" dump badging /tmp/Nava.apk | grep -q "package: name='com.verudanava.nava' versionCode='159' versionName='12.2.28'"
sha256sum /tmp/Nava.apk | tee /tmp/nava228.sha256
printf 'status=success\n' >> "$STATUS"
