#!/usr/bin/env bash
set -euo pipefail

STATUS=/tmp/status237.txt
: > "$STATUS"
printf 'status=running\nstarted=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap 'rc=$?; if [ "$rc" -ne 0 ]; then printf "status=failed\nfinished=%s\n" "$(date -u +%FT%TZ)" >> "$STATUS"; fi; exit "$rc"' EXIT

SOURCE_TAG=v12.2.32
TARGET_TAG=v12.2.37
TARGET_CODE=188
EXPECTED_SOURCE_SHA256=1afbd4b5bc3d19963f99e0d1af18c986853069b9e1575b31c5370b0246f7cefd
EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe

mkdir -p /tmp/nava-source
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/nava-source
SOURCE_APK=/tmp/nava-source/Nava.apk
test "$(sha256sum "$SOURCE_APK" | cut -d' ' -f1)" = "$EXPECTED_SOURCE_SHA256"

BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
SOURCE_BADGING="$("$BUILD_TOOLS/aapt" dump badging "$SOURCE_APK")"
printf '%s\n' "$SOURCE_BADGING" | grep -q "package: name='com.verudanava.nava' versionCode='179' versionName='12.2.32'"

# Keep the verified DEX unchanged; only the web profile asset and version metadata change.
unzip -p "$SOURCE_APK" classes.dex > /tmp/classes237.dex
test -s /tmp/classes237.dex
printf 'dex_preserved=ok\n' >> "$STATUS"

# Decode production signing material.
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

# Patch only manifest metadata and the correctly reassembled classes.dex; retain app assets and other DEX files.
python - "$SOURCE_APK" /tmp/classes237.dex /tmp/Nava-unsigned.apk "$TARGET_CODE" android-patch/profile-redesign-v12.2.37.js <<'PY'
import hashlib, struct, sys, zipfile
from pathlib import Path
src,dex,out=Path(sys.argv[1]),Path(sys.argv[2]),Path(sys.argv[3])
target_code=int(sys.argv[4]); patch=Path(sys.argv[5])
asset=Path('/tmp/nava_app_v11-redesigned.js')
def u16(d,o): return struct.unpack_from('<H',d,o)[0]
def u32(d,o): return struct.unpack_from('<I',d,o)[0]
def p32(d,o,v): struct.pack_into('<I',d,o,v)
def l8(d,o):
 x=d[o]; return ((x&127,1) if not x&128 else (((x&127)<<8)|d[o+1],2))
def l16(d,o):
 x=u16(d,o); return ((x&32767,2) if not x&32768 else (((x&32767)<<16)|u16(d,o+2),4))
def pool(d,off):
 hs=u16(d,off+2); n=u32(d,off+8); flags=u32(d,off+16); ss=u32(d,off+20); utf8=bool(flags&256); out=[]
 for i in range(n):
  p=off+ss+u32(d,off+hs+i*4)
  if utf8:
   _,a=l8(d,p); bl,b=l8(d,p+a); st=p+a+b; v=bytes(d[st:st+bl]).decode('utf-8'); out.append((v,st,bl,True))
  else:
   ln,a=l16(d,p); st=p+a; v=bytes(d[st:st+ln*2]).decode('utf-16le'); out.append((v,st,ln*2,False))
 return out
with zipfile.ZipFile(src) as zin:
 asset.write_bytes(zin.read('assets/nava_app_v11.js') + b'\n;\n' + patch.read_bytes())
 data=bytearray(zin.read('AndroidManifest.xml'))
 assert u16(data,0)==3
 off=u16(data,2); po=None
 while off+8<=len(data):
  size=u32(data,off+4)
  assert size>=8 and off+size<=len(data)
  if u16(data,off)==1: po=off; break
  off+=size
 assert po is not None
 strings=pool(data,po)
 versions=[x for x in strings if x[0]=='12.2.32']
 assert len(versions)==1
 _,st,n,utf8=versions[0]; replacement=b'12.2.37' if utf8 else '12.2.37'.encode('utf-16le')
 assert len(replacement)==n
 data[st:st+n]=replacement
 changed=0; off=u16(data,2)
 while off+8<=len(data):
  typ,hs,size=u16(data,off),u16(data,off+2),u32(data,off+4)
  assert size>=8 and off+size<=len(data)
  if typ==0x0102:
   ext=off+hs; ast,asz,total=u16(data,ext+8),u16(data,ext+10),u16(data,ext+12); begin=ext+ast
   for i in range(total):
    a=begin+i*asz; ni=u32(data,a+4)
    if ni<len(strings) and strings[ni][0]=='versionCode':
     assert data[a+15]==0x10 and u32(data,a+16)==179
     p32(data,a+16,target_code); changed+=1
  off+=size
 assert changed==1
 with zipfile.ZipFile(out,'w') as zout:
  for info in zin.infolist():
   upper=info.filename.upper(); leaf=upper.rsplit('/',1)[-1]
   if upper.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC'))): continue
   if info.filename=='AndroidManifest.xml': payload=bytes(data)
   elif info.filename=='classes.dex': payload=dex.read_bytes()
   elif info.filename=='assets/nava_app_v11.js': payload=asset.read_bytes()
   else: payload=zin.read(info.filename)
   zout.writestr(info,payload)
with zipfile.ZipFile(out) as z, zipfile.ZipFile(src) as original:
 assert z.read('classes.dex')==dex.read_bytes()
 assert z.read('classes2.dex')==original.read('classes2.dex')
 assert b'nava-profile-redesign-12237' in z.read('assets/nava_app_v11.js')
print('APK_PATCH_OK versionName=12.2.37 versionCode=%d; classes.dex reassembled' % target_code)
PY

"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROP=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROP" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROP" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROP" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk > /tmp/verify237.txt
CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify237.txt | sed -E 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERT" = "$EXPECTED_CERT_SHA256"
"$BUILD_TOOLS/aapt" dump badging /tmp/Nava.apk > /tmp/badging237.txt
grep -q "package: name='com.verudanava.nava'" /tmp/badging237.txt
grep -q "versionCode='187'.*versionName='12.2.37'" /tmp/badging237.txt
sha256sum /tmp/Nava.apk | tee /tmp/nava237.sha256
printf 'status=success\nversion=12.2.37\nversion_code=187\ncert_sha256=%s\napk_sha256=%s\nfinished=%s\n' "$CERT" "$(sha256sum /tmp/Nava.apk | cut -d' ' -f1)" "$(date -u +%FT%TZ)" >> "$STATUS"
echo NAVA_12_2_32_CANDIDATE_READY
trap - EXIT
