#!/usr/bin/env bash
set -euo pipefail
STATUS=/tmp/status231.txt
: > "$STATUS"
trap 'rc=$?; if [ "$rc" -ne 0 ] && ! grep -q "^status=success$" "$STATUS"; then printf "status=failed\nfinished=%s\n" "$(date -u +%FT%TZ)" >> "$STATUS"; fi; exit "$rc"' EXIT
SOURCE_TAG=v12.2.28
TARGET_TAG=v12.2.31
EXPECTED_SOURCE_SHA256=9306b94e711ab2a084ef1a1151a69124a3e01dd8c29b2635c1b9b85066ab8daa
EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe

mkdir -p /tmp/source
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/source
GOT="$(sha256sum /tmp/source/Nava.apk | cut -d' ' -f1)"
test "$GOT" = "$EXPECTED_SOURCE_SHA256"
BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
BADGING="$("$BUILD_TOOLS/aapt" dump badging /tmp/source/Nava.apk)"
printf '%s\n' "$BADGING" | grep -q "versionName='12.2.28'"
SOURCE_CODE="$(printf '%s\n' "$BADGING" | sed -n "s/.*versionCode='\([0-9][0-9]*\)'.*/\1/p" | head -1)"
test "$SOURCE_CODE" = "159"
TARGET_CODE="$((SOURCE_CODE + 15))"

# Reuse the existing production signing key material used by the verified releases.
set +x
export NAVA_KDF_SECRET="$(printf '%s' "$FIREBASE_SERVICE_ACCOUNT" | sha256sum | cut -d' ' -f1)"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -in .github/nava-signing/private.pem.enc -out /tmp/nava-private.pem -pass env:NAVA_KDF_SECRET
unset NAVA_KDF_SECRET
openssl pkeyutl -decrypt -inkey /tmp/nava-private.pem -in android-signing/key-material.enc -out /tmp/key-material.bin -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256
python - <<'PY'
from pathlib import Path
d=Path('/tmp/key-material.bin').read_bytes()
assert len(d)==48
Path('/tmp/aes-key').write_text(d[:32].hex())
Path('/tmp/aes-iv').write_text(d[32:].hex())
PY
openssl enc -d -aes-256-cbc -K "$(cat /tmp/aes-key)" -iv "$(cat /tmp/aes-iv)" -in android-signing/signing-payload.enc -out /tmp/signing.zip
mkdir -p /tmp/nava-signing
unzip -q /tmp/signing.zip -d /tmp/nava-signing
rm -f /tmp/nava-private.pem /tmp/key-material.bin /tmp/aes-key /tmp/aes-iv /tmp/signing.zip

python - /tmp/source/Nava.apk /tmp/Nava-unsigned.apk "$SOURCE_CODE" "$TARGET_CODE" <<'PY'
import hashlib, struct, sys, zipfile, zlib
from pathlib import Path
src, out = map(Path, sys.argv[1:3])
old_code, new_code = int(sys.argv[3]), int(sys.argv[4])
def u16(d,o): return struct.unpack_from('<H',d,o)[0]
def u32(d,o): return struct.unpack_from('<I',d,o)[0]
def p32(d,o,v): struct.pack_into('<I',d,o,v)
def length8(d,o):
    x=d[o]; return ((x&127,1) if not x&128 else (((x&127)<<8)|d[o+1],2))
def length16(d,o):
    x=u16(d,o); return ((x&32767,2) if not x&32768 else (((x&32767)<<16)|u16(d,o+2),4))
def parse_pool(d,off):
    hs=u16(d,off+2); n=u32(d,off+8); flags=u32(d,off+16); ss=u32(d,off+20); utf8=bool(flags&256); items=[]
    for i in range(n):
        p=off+ss+u32(d,off+hs+i*4)
        if utf8:
            _,a=length8(d,p); bl,b=length8(d,p+a); start=p+a+b
            items.append((bytes(d[start:start+bl]).decode('utf-8'),start,bl))
        else:
            ln,a=length16(d,p); start=p+a
            items.append((bytes(d[start:start+ln*2]).decode('utf-16le'),start,ln*2))
    return items
def patch_dex(payload):
    data=bytearray(payload); old=b'Nava-Android/12.2.28'; new=b'Nava-Android/12.2.31'
    if data.count(old)!=1: raise ValueError('expected exactly one old updater identity')
    data[:]=data.replace(old,new,1)
    data[12:32]=hashlib.sha1(data[32:]).digest()
    struct.pack_into('<I',data,8,zlib.adler32(data[12:]) & 0xffffffff)
    return bytes(data)
with zipfile.ZipFile(src) as zin:
    manifest=bytearray(zin.read('AndroidManifest.xml'))
    if u16(manifest,0)!=3: raise ValueError('manifest is not binary AXML')
    off=u16(manifest,2); pool_off=None
    while off+8<=len(manifest):
        size=u32(manifest,off+4)
        if size<8 or off+size>len(manifest): raise ValueError('invalid manifest chunk')
        if u16(manifest,off)==1: pool_off=off; break
        off+=size
    if pool_off is None: raise ValueError('string pool missing')
    strings=parse_pool(manifest,pool_off)
    version=[x for x in strings if x[0]=='12.2.28']
    if len(version)!=1: raise ValueError('expected exactly one versionName 12.2.28')
    _,start,n=version[0]; new='12.2.31'.encode('utf-8' if n==7 else 'utf-16le')
    if len(new)!=n: raise ValueError('versionName byte length changed')
    manifest[start:start+n]=new
    matches=0; off=u16(manifest,2)
    while off+8<=len(manifest):
        typ,size=u16(manifest,off),u32(manifest,off+4)
        if size<8 or off+size>len(manifest): raise ValueError('invalid manifest chunk')
        if typ==0x0102:
            ext=off+16; ast=u16(manifest,ext+8); asz=u16(manifest,ext+10); total=u16(manifest,ext+12); begin=ext+ast
            for i in range(total):
                a=begin+i*asz; ni=u32(manifest,a+4)
                if ni<len(strings) and strings[ni][0]=='versionCode':
                    if manifest[a+15]!=0x10 or u32(manifest,a+16)!=old_code: raise ValueError('unexpected source versionCode')
                    p32(manifest,a+16,new_code); matches+=1
        off+=size
    if matches!=1: raise ValueError('expected exactly one versionCode')
    with zipfile.ZipFile(out,'w') as zout:
        for info in zin.infolist():
            up=info.filename.upper(); leaf=up.rsplit('/',1)[-1]
            if up.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC'))): continue
            if info.filename=='AndroidManifest.xml': payload=bytes(manifest)
            elif info.filename=='classes.dex': payload=patch_dex(zin.read('classes.dex'))
            else: payload=zin.read(info.filename)
            zout.writestr(info,payload)
with zipfile.ZipFile(out) as z:
    assert b'Nava-Android/12.2.31' in z.read('classes.dex')
    assert b'Nava-Android/12.2.28' not in z.read('classes.dex')
print(f'ROLLBACK_BASE_PATCH_OK versionName=12.2.31 versionCode={new_code}; restored v12.2.28 app payload')
PY

"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROP=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROP" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROP" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROP" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk > /tmp/verify231.txt
CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify231.txt | sed -E 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERT" = "$EXPECTED_CERT_SHA256"
"$BUILD_TOOLS/aapt" dump badging /tmp/Nava.apk > /tmp/badging231.txt
grep -q "package: name='com.verudanava.nava'" /tmp/badging231.txt
grep -q "versionCode='$TARGET_CODE'.*versionName='12.2.31'" /tmp/badging231.txt
"$BUILD_TOOLS/apksigner" verify --verbose /tmp/Nava.apk | grep -q 'Verified'
sha256sum /tmp/Nava.apk
printf 'status=success\nsource=v12.2.28\ntarget=v12.2.31\nversionCode=%s\ncert_sha256=%s\n' "$TARGET_CODE" "$CERT" >> "$STATUS"
