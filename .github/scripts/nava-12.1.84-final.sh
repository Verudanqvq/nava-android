#!/usr/bin/env bash
set -euo pipefail

EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe
SOURCE_TAG=v12.1.73
TARGET_TAG=v12.1.84

python -m py_compile android-patch/v12.1.84/patch-manifest84.py android-patch/v12.1.84/patch-apk84.py
node --check android-patch/v12.1.84/shell-v12184.js
node tests/v12184-shell.test.js

export NAVA_KDF_SECRET="$(printf '%s' "$FIREBASE_SERVICE_ACCOUNT" | sha256sum | cut -d' ' -f1)"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -in .github/nava-signing/private.pem.enc -out /tmp/nava-private.pem -pass env:NAVA_KDF_SECRET
unset NAVA_KDF_SECRET
openssl pkeyutl -decrypt -inkey /tmp/nava-private.pem -in android-signing/key-material.enc -out /tmp/key-material.bin -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256
python - <<'PY'
from pathlib import Path
material = Path('/tmp/key-material.bin').read_bytes()
assert len(material) == 48
Path('/tmp/aes-key').write_text(material[:32].hex())
Path('/tmp/aes-iv').write_text(material[32:].hex())
PY
openssl enc -d -aes-256-cbc -K "$(cat /tmp/aes-key)" -iv "$(cat /tmp/aes-iv)" -in android-signing/signing-payload.enc -out /tmp/signing.zip
mkdir -p /tmp/nava-signing /tmp/current73
unzip -q /tmp/signing.zip -d /tmp/nava-signing
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/current73

SOURCE=/tmp/current73/Nava.apk
BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs "$SOURCE" >/tmp/source84-cert.txt
SOURCE_CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/source84-cert.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$SOURCE_CERT" = "$EXPECTED_CERT_SHA256"
unzip -p "$SOURCE" AndroidManifest.xml >/tmp/manifest84.bin
python android-patch/v12.1.84/patch-manifest84.py /tmp/manifest84.bin
python android-patch/v12.1.84/patch-apk84.py "$SOURCE" /tmp/manifest84.bin android-patch/v12.1.84/shell-v12184.js android-patch/v12.1.84/shell-v12184.css /tmp/Nava-unsigned.apk
"$BUILD_TOOLS/aapt" dump badging /tmp/Nava-unsigned.apk | grep -q "versionCode='100'.*versionName='12.1.84'"
unzip -p /tmp/Nava-unsigned.apk assets/nava_app_v11.js >/tmp/app84.js
node --check /tmp/app84.js
grep -q '__navaShellV12184' /tmp/app84.js
for entry in classes.dex classes2.dex assets/offline.html resources.arsc; do
  unzip -p "$SOURCE" "$entry" >"/tmp/base84-$(echo "$entry" | tr '/.' '__')"
  unzip -p /tmp/Nava-unsigned.apk "$entry" >"/tmp/final84-$(echo "$entry" | tr '/.' '__')"
  cmp -s "/tmp/base84-$(echo "$entry" | tr '/.' '__')" "/tmp/final84-$(echo "$entry" | tr '/.' '__')"
done
"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROPERTIES=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROPERTIES" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROPERTIES" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROPERTIES" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk >/tmp/verify84.txt
CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify84.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERT" = "$EXPECTED_CERT_SHA256"
gh release create "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.84' --notes 'Nava tasarım kimliğine dönüş ve alt menü geçişlerinde daha erken sayfa ısıtması. İndirme sistemi, çevrimdışı kütüphane ve native Android kodu v12.1.73 tabanından korunur.' --latest
