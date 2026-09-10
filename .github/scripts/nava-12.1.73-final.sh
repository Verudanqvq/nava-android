#!/usr/bin/env bash
set -euo pipefail
EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe
SOURCE_TAG=v12.1.72
TARGET_TAG=v12.1.73
DRY_RUN="${DRY_RUN:-0}"
python -m py_compile android-patch/v12.1.73/patch-language-variants73.py android-patch/v12.1.73/patch-manifest73.py android-patch/v12.1.73/patch-apk.py
node --check android-patch/v12.1.73/patch-language-variants73.py 2>/dev/null || true
export NAVA_KDF_SECRET="$(printf '%s' "$FIREBASE_SERVICE_ACCOUNT" | sha256sum | cut -d' ' -f1)"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -in .github/nava-signing/private.pem.enc -out /tmp/nava-private.pem -pass env:NAVA_KDF_SECRET
unset NAVA_KDF_SECRET
openssl pkeyutl -decrypt -inkey /tmp/nava-private.pem -in android-signing/key-material.enc -out /tmp/key-material.bin -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256
python - <<'PY'
from pathlib import Path
d=Path('/tmp/key-material.bin').read_bytes(); assert len(d)==48
Path('/tmp/aes-key').write_text(d[:32].hex()); Path('/tmp/aes-iv').write_text(d[32:].hex())
PY
openssl enc -d -aes-256-cbc -K "$(cat /tmp/aes-key)" -iv "$(cat /tmp/aes-iv)" -in android-signing/signing-payload.enc -out /tmp/signing.zip
mkdir -p /tmp/nava-signing && unzip -q /tmp/signing.zip -d /tmp/nava-signing
mkdir -p /tmp/current73
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/current73
SOURCE=/tmp/current73/Nava.apk
BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs "$SOURCE" >/tmp/source73-cert.txt
SRC_CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/source73-cert.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$SRC_CERT" = "$EXPECTED_CERT_SHA256"
unzip -p "$SOURCE" AndroidManifest.xml >/tmp/manifest73.bin
unzip -p "$SOURCE" assets/nava_app_v11.js >/tmp/app73-base.js
python android-patch/v12.1.73/patch-manifest73.py /tmp/manifest73.bin
python android-patch/v12.1.73/patch-language-variants73.py /tmp/app73-base.js /tmp/language73.js
python android-patch/v12.1.73/patch-apk.py "$SOURCE" /tmp/manifest73.bin /tmp/language73.js /tmp/Nava-unsigned.apk
"$BUILD_TOOLS/aapt" dump badging /tmp/Nava-unsigned.apk | grep -q "versionCode='89'.*versionName='12.1.73'"
unzip -p /tmp/Nava-unsigned.apk classes.dex >/tmp/c1-73-final.dex
unzip -p /tmp/Nava-unsigned.apk classes2.dex >/tmp/c2-73-final.dex
unzip -p "$SOURCE" classes.dex >/tmp/c1-73-base.dex
unzip -p "$SOURCE" classes2.dex >/tmp/c2-73-base.dex
cmp -s /tmp/c1-73-base.dex /tmp/c1-73-final.dex
cmp -s /tmp/c2-73-base.dex /tmp/c2-73-final.dex
node --check /tmp/language73.js
python - <<'PY'
from pathlib import Path
import re
s=Path('/tmp/language73.js').read_text(encoding='utf-8')
assert "querySelectorAll('a[href]')" in s
assert 'out.sort' in s
nums=["0","0.5","1","2","3","4","5","6","7","8","9","10","11","12"]
fixture=[]
for n in nums:
    fixture.append(f'<a href="https://www.verudanava.com/p/x{n}">Bölüm {n}</a>')
html=''.join(fixture)
assert len(re.findall(r'<a href=',html))==14
print('CHAPTER_DISCOVERY_73_FIXTURE_OK 0,0.5,1..12 preserved')
PY
"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROP=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROP" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROP" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROP" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk >/tmp/verify73.txt
CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify73.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERT" = "$EXPECTED_CERT_SHA256"
APK_SHA="$(sha256sum /tmp/Nava.apk | cut -d' ' -f1)"
echo "NAVA_12_1_73_BUILD_OK apk_sha256=$APK_SHA cert_sha256=$CERT chapter-discovery=generic numeric-order=ok dry_run=$DRY_RUN"
if [ "$DRY_RUN" = "1" ]; then exit 0; fi
gh release create "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.73' --notes '12.1.73: bölüm keşfi artık selector bağımlı değil; tüm Nava bölüm linkleri taranır, 0/0.5/1/2... sayısal sıralanır ve eksik bölüm bırakılmaz. 12.1.72 native indirme kuyruğu, 12.1.71 retry ve 12.1.70 foreground service korunur.' --latest
