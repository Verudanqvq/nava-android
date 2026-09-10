#!/usr/bin/env bash
set -euo pipefail

EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe
SOURCE_TAG=v12.1.74
TARGET_TAG=v12.1.75
DRY_RUN="${DRY_RUN:-0}"

python -m py_compile android-patch/v12.1.75/patch-manifest75.py android-patch/v12.1.75/patch-apk.py

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
mkdir -p /tmp/nava-signing /tmp/current75
unzip -q /tmp/signing.zip -d /tmp/nava-signing
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/current75

SOURCE=/tmp/current75/Nava.apk
BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs "$SOURCE" >/tmp/source75-cert.txt
SOURCE_CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/source75-cert.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$SOURCE_CERT" = "$EXPECTED_CERT_SHA256"

unzip -p "$SOURCE" AndroidManifest.xml >/tmp/manifest75.bin
python android-patch/v12.1.75/patch-manifest75.py /tmp/manifest75.bin
python android-patch/v12.1.75/patch-apk.py "$SOURCE" /tmp/manifest75.bin android-patch/v12.1.75/ui-correction-v12175.css /tmp/Nava-unsigned.apk
"$BUILD_TOOLS/aapt" dump badging /tmp/Nava-unsigned.apk | grep -q "versionCode='91'.*versionName='12.1.75'"
unzip -p /tmp/Nava-unsigned.apk assets/nava_app_v11.css >/tmp/app75.css
grep -q -- '--nava-bg:#f5f7fb' /tmp/app75.css
grep -q 'nava-nav-profile-image-v12174' /tmp/app75.css

"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROPERTIES=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROPERTIES" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROPERTIES" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROPERTIES" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk >/tmp/verify75.txt
CERTIFICATE="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify75.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERTIFICATE" = "$EXPECTED_CERT_SHA256"
APK_SHA="$(sha256sum /tmp/Nava.apk | cut -d' ' -f1)"
echo "NAVA_12_1_75_BUILD_OK apk_sha256=$APK_SHA cert_sha256=$CERTIFICATE shell=light profile-avatar=preserved dry_run=$DRY_RUN"

if [ "$DRY_RUN" = "1" ]; then
  exit 0
fi

gh release create "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.75' --notes '12.1.75: 12.1.74ün koyu görünümü geri alındı. Uygulama açık ve sade tasarımına döndü; profil fotoğrafı ve anlık sekme geri bildirimi korunuyor.' --latest
