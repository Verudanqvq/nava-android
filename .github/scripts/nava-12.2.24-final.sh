#!/usr/bin/env bash
set -euo pipefail
STATUS=/tmp/status224.txt
: > "$STATUS"
printf 'status=running\nstarted=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap 'rc=$?; if [ "$rc" -ne 0 ] && ! grep -q "^status=success$" "$STATUS"; then printf "status=failed\nfinished=%s\n" "$(date -u +%FT%TZ)" >> "$STATUS"; fi; exit "$rc"' EXIT

SOURCE_TAG=v12.2.23
TARGET_TAG=v12.2.24
EXPECTED_SOURCE_SHA256=2ed913a7c881c9828cb2f491b94537f00be054cf51225b1cce852306e0f2a1af
EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe
BASE_COMMIT=253b2ebd07053153d5b155ff834f50f055daa44a

mkdir -p /tmp/source224
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/source224
GOT="$(sha256sum /tmp/source224/Nava.apk | cut -d' ' -f1)"
test "$GOT" = "$EXPECTED_SOURCE_SHA256"
printf 'source_apk=ok\nsource_sha256=%s\n' "$GOT" >> "$STATUS"

BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
BADGING="$("$BUILD_TOOLS/aapt" dump badging /tmp/source224/Nava.apk)"
printf '%s\n' "$BADGING" | grep -q "versionName='12.2.23'"
SOURCE_CODE="$(printf '%s\n' "$BADGING" | sed -n "s/.*versionCode='\([0-9][0-9]*\)'.*/\1/p" | head -1)"
test "$SOURCE_CODE" = 138
TARGET_CODE="$((SOURCE_CODE + 5))"
printf 'source_version_code=%s\ntarget_version_code=%s\n' "$SOURCE_CODE" "$TARGET_CODE" >> "$STATUS"

# Recover the same production signing material used by prior verified releases.
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
printf 'signing_material=ok\n' >> "$STATUS"

# Fix the cap clamp: storageAvailableBytes is not returned by listDownloads(),
# so the old calculation forced the maximum to 1 GB on most devices.
unzip -p /tmp/source224/Nava.apk assets/nava_app_v11.js > /tmp/nava_app_v11.js
python - <<'PY'
from pathlib import Path
p=Path('/tmp/nava_app_v11.js')
s=p.read_text(encoding='utf-8')
old1="var s=state(),max=Math.max(1,Math.floor((s.used+s.free-268435456)/1073741824)),n=Math.max(1,Math.min(max,Math.floor(Number(cap.value)||gb())))"
new1="var n=Math.max(1,Math.min(200,Math.floor(Number(cap.value)||gb())))"
old2="cap.max=String(Math.max(1,Math.floor((s.used+s.free-268435456)/1073741824)))"
new2="cap.max='200'"
assert s.count(old1)==1, 'expected exactly one broken limit clamp'
assert s.count(old2)==1, 'expected exactly one broken input max calculation'
s=s.replace(old1,new1,1).replace(old2,new2,1)
assert "Math.min(200,Math.floor(Number(cap.value)||gb()))" in s
assert "cap.max='200'" in s
p.write_text(s,encoding='utf-8')
print('DOWNLOAD_LIMIT_FIX_OK min=1GB max=200GB integer-only; stale storageAvailableBytes clamp removed')
PY

# Patch only the app JavaScript asset and binary AndroidManifest.xml; preserve all other APK payloads.
python - /tmp/source224/Nava.apk /tmp/nava_app_v11.js /tmp/Nava-unsigned.apk "$SOURCE_CODE" "$TARGET_CODE" <<'PY'
import struct, sys, zipfile
from pathlib import Path
src, js, out = map(Path, sys.argv[1:4])
old_code, new_code = int(sys.argv[4]), int(sys.argv[5])
def u16(d,o): return struct.unpack_from('<H',d,o)[0]
def u32(d,o): return struct.unpack_from('<I',d,o)[0]
def p32(d,o,v): struct.pack_into('<I',d,o,v)
def length8(d,o):
    x=d[o]; return ((x&127,1) if not x&128 else (((x&127)<<8)|d[o+1],2))
def length16(d,o):
    x=u16(d,o); return ((x&32767,2) if not x&32768 else (((x&32767)<<16)|u16(d,o+2),4))
def pool(d,off):
    hs=u16(d,off+2); n=u32(d,off+8); flags=u32(d,off+16); ss=u32(d,off+20); utf8=bool(flags&256); items=[]
    for i in range(n):
        p=off+ss+u32(d,off+hs+i*4)
        if utf8:
            _,a=length8(d,p); bl,b=length8(d,p+a); start=p+a+b; val=bytes(d[start:start+bl]).decode('utf-8')
            items.append((val,start,bl,True))
        else:
            ln,a=length16(d,p); start=p+a; val=bytes(d[start:start+ln*2]).decode('utf-16le')
            items.append((val,start,ln*2,False))
    return items
with zipfile.ZipFile(src) as zin:
    data=bytearray(zin.read('AndroidManifest.xml'))
    if u16(data,0)!=3: raise ValueError('manifest is not binary AXML')
    off=u16(data,2); string_pool=None
    while off+8<=len(data):
        size=u32(data,off+4)
        if size<8 or off+size>len(data): raise ValueError('invalid AXML chunk')
        if u16(data,off)==1: string_pool=off; break
        off+=size
    if string_pool is None: raise ValueError('string pool missing')
    strings=pool(data,string_pool); versions=[x for x in strings if x[0]=='12.2.23']
    if len(versions)!=1: raise ValueError('expected one versionName 12.2.23')
    _,start,nbytes,utf8=versions[0]; replacement='12.2.24'.encode('utf-8' if utf8 else 'utf-16le')
    if len(replacement)!=nbytes: raise ValueError('versionName byte length changed')
    data[start:start+nbytes]=replacement
    count=0; off=u16(data,2)
    while off+8<=len(data):
        typ,size=u16(data,off),u32(data,off+4)
        if size<8 or off+size>len(data): raise ValueError('invalid AXML chunk')
        if typ==0x0102:
            ext=off+16; ast=u16(data,ext+8); asz=u16(data,ext+10); total=u16(data,ext+12); begin=ext+ast
            for i in range(total):
                a=begin+i*asz; ni=u32(data,a+4)
                if ni<len(strings) and strings[ni][0]=='versionCode':
                    if data[a+15]!=0x10 or u32(data,a+16)!=old_code: raise ValueError('unexpected source versionCode')
                    p32(data,a+16,new_code); count+=1
        off+=size
    if count!=1: raise ValueError('expected exactly one versionCode')
    with zipfile.ZipFile(out,'w') as zout:
        for info in zin.infolist():
            up=info.filename.upper(); leaf=up.rsplit('/',1)[-1]
            if up.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC'))): continue
            if info.filename=='AndroidManifest.xml': payload=bytes(data)
            elif info.filename=='assets/nava_app_v11.js': payload=js.read_bytes()
            else: payload=zin.read(info.filename)
            zout.writestr(info,payload)
with zipfile.ZipFile(out) as z, zipfile.ZipFile(src) as original:
    assert z.read('assets/nava_app_v11.js')==js.read_bytes()
    assert z.read('resources.arsc')==original.read('resources.arsc')
    assert z.read('classes.dex')==original.read('classes.dex')
    assert z.read('classes2.dex')==original.read('classes2.dex')
    assert z.read('assets/nava_app_v11.css')==original.read('assets/nava_app_v11.css')
    assert z.read('assets/offline.html')==original.read('assets/offline.html')
print(f'APK_PATCH_OK versionName=12.2.24 versionCode={new_code}; only manifest and nava_app_v11.js changed')
PY

"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROP=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROP" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROP" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROP" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk > /tmp/verify224.txt
CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify224.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERT" = "$EXPECTED_CERT_SHA256"
"$BUILD_TOOLS/aapt" dump badging /tmp/Nava.apk | grep -q "versionCode='$TARGET_CODE'.*versionName='12.2.24'"
APK_SHA="$(sha256sum /tmp/Nava.apk | cut -d' ' -f1)"
printf 'javascript_fix=ok\nzipalign=ok\nsigning=ok\ncert_sha256=%s\napk_sha256=%s\n' "$CERT" "$APK_SHA" >> "$STATUS"

if gh release view "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  echo "$TARGET_TAG already exists; refusing to overwrite an existing release" >&2
  exit 1
fi
NOTES='12.2.24: İndirme sınırı ayarının cihaz depolama alanı hesabı yüzünden 1 GB değerine kilitlenmesi düzeltildi. Sınır 1–200 GB aralığında tam sayı olarak ayarlanabilir. Diğer APK varlıkları korunmuştur.'
gh release create "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --title 'Nava 12.2.24' --notes "$NOTES" --latest --target "$BASE_COMMIT"
printf 'release=v12.2.24\nasset=Nava.apk\nstatus=success\nfinished=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap - EXIT
