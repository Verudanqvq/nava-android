#!/usr/bin/env bash
set -euo pipefail
STATUS=/tmp/status59.txt
: > "$STATUS"
printf 'status=running\nstarted=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap 'rc=$?; if [ "$rc" -ne 0 ] && ! grep -q "^status=success$" "$STATUS"; then printf "status=failed\nfinished=%s\n" "$(date -u +%FT%TZ)" >> "$STATUS"; fi; exit "$rc"' EXIT

EXPECTED_SOURCE_SHA256=31d319c1af95e822931881d672a3dd1177a9467561f6c62c5125f61d5c68ec59
EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe
SOURCE_TAG=v12.1.58
TARGET_TAG=v12.1.59

python -m py_compile \
  android-patch/v12.1.59/patch-offline-runtime.py \
  android-patch/v12.1.59/fix-jadx-compile.py \
  android-patch/v12.1.59/patch-apk.py
node --check android-patch/v12.1.59/queue-cancel-v12159.js
grep -q 'public void cancel(String str)' android-patch/v12.1.59/patch-offline-runtime.py
grep -q 'data-cancel-all-v12159' android-patch/v12.1.59/queue-cancel-v12159.js
grep -q 'Tekrar dene' android-patch/v12.1.59/offline.html
test -f android-patch/v12.1.59/native-source/OfflineRuntime.java.txt
printf 'source_validation=ok\nbase=12.1.58\nnative_ua=12.1.47-preserved\nclasses1=preserved\nnative_cancel=classes2\nqueue_cancel=grouped-volume\noffline_retry=manual-plus-auto-online\nwrong_download_refresh=removed\n' >> "$STATUS"

# Signing material
set +x
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
mkdir -p /tmp/nava-signing
unzip -q /tmp/signing.zip -d /tmp/nava-signing
rm -f /tmp/nava-private.pem /tmp/key-material.bin /tmp/aes-key /tmp/aes-iv /tmp/signing.zip
printf 'signing_material=ok\n' >> "$STATUS"

# Base APK
mkdir -p /tmp/current
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/current
GOT="$(sha256sum /tmp/current/Nava.apk | cut -d' ' -f1)"
test "$GOT" = "$EXPECTED_SOURCE_SHA256"
unzip -p /tmp/current/Nava.apk classes.dex > /tmp/classes1-base.dex
printf 'source_apk=ok\nsource_sha256=%s\nclasses1_sha256=%s\n' "$GOT" "$(sha256sum /tmp/classes1-base.dex | cut -d' ' -f1)" >> "$STATUS"

# Rebuild only OfflineRuntime in classes2.dex
python android-patch/v12.1.59/patch-offline-runtime.py \
  android-patch/v12.1.59/native-source/OfflineRuntime.java.txt \
  /tmp/OfflineRuntime.java
python android-patch/v12.1.59/fix-jadx-compile.py /tmp/OfflineRuntime.java
ANDROID_JAR="$(find "$ANDROID_HOME/platforms" -name android.jar | sort -V | tail -1)"
BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
mkdir -p /tmp/javac /tmp/newdex /tmp/mini
javac -encoding UTF-8 -source 8 -target 8 -cp "$ANDROID_JAR" -d /tmp/javac /tmp/OfflineRuntime.java
mapfile -t CLASSES < <(find /tmp/javac/com/verudanava/nava -name 'OfflineRuntime*.class' -type f | sort)
test "${#CLASSES[@]}" -ge 5
"$BUILD_TOOLS/d8" --lib "$ANDROID_JAR" --min-api 26 --output /tmp/newdex "${CLASSES[@]}"
unzip -p /tmp/current/Nava.apk AndroidManifest.xml > /tmp/mini/AndroidManifest.xml
cp /tmp/newdex/classes.dex /tmp/mini/classes.dex
(cd /tmp/mini && zip -q /tmp/mini.apk AndroidManifest.xml classes.dex)
curl -fsSL -o /tmp/apktool.jar https://github.com/iBotPeaches/Apktool/releases/download/v2.11.1/apktool_2.11.1.jar
java -jar /tmp/apktool.jar d -f -r /tmp/mini.apk -o /tmp/mini-dec >/tmp/apktool-mini.log
java -jar /tmp/apktool.jar d -f -r /tmp/current/Nava.apk -o /tmp/base-dec >/tmp/apktool-base.log
test -d /tmp/base-dec/smali_classes2/com/verudanava/nava
rm -f /tmp/base-dec/smali_classes2/com/verudanava/nava/OfflineRuntime*.smali
cp /tmp/mini-dec/smali/com/verudanava/nava/OfflineRuntime*.smali /tmp/base-dec/smali_classes2/com/verudanava/nava/
java -jar /tmp/apktool.jar b /tmp/base-dec -o /tmp/rebuilt.apk >/tmp/apktool-build.log
unzip -p /tmp/rebuilt.apk classes2.dex > /tmp/classes2-59.dex
grep -aq 'cancelled' /tmp/classes2-59.dex
grep -aq 'cancel' /tmp/classes2-59.dex
printf 'native_source_compile=ok\nnative_cancel_bridge=ok\n' >> "$STATUS"

# Assemble final APK while preserving classes.dex byte-for-byte
python android-patch/v12.1.59/patch-apk.py \
  /tmp/current/Nava.apk /tmp/classes2-59.dex \
  android-patch/v12.1.59/queue-cancel-v12159.js \
  android-patch/v12.1.59/ui-v12159.css \
  android-patch/v12.1.59/offline.html \
  /tmp/Nava-unsigned.apk | tee /tmp/patch59.txt
grep -q 'PATCH_OK versionName=12.1.59 versionCode=75 base=12.1.58 classes1=preserved nativeCancel=classes2 offlineRetry=asset queueCancel=grouped' /tmp/patch59.txt
unzip -p /tmp/Nava-unsigned.apk assets/nava_app_v11.js > /tmp/final.js
unzip -p /tmp/Nava-unsigned.apk assets/offline.html > /tmp/final-offline.html
unzip -p /tmp/Nava-unsigned.apk classes.dex > /tmp/classes1-final.dex
unzip -p /tmp/Nava-unsigned.apk classes2.dex > /tmp/classes2-final.dex
node --check /tmp/final.js
cmp -s /tmp/classes1-base.dex /tmp/classes1-final.dex
grep -q 'data-cancel-all-v12159' /tmp/final.js
grep -q 'Tekrar dene' /tmp/final-offline.html
grep -aq 'cancelled' /tmp/classes2-final.dex
grep -aq 'NavaAndroidApp/12.1.47' /tmp/classes1-final.dex
! grep -aq 'NavaAndroidApp/12.1.59' /tmp/classes1-final.dex
printf 'patch=ok\nversionName=12.1.59\nversionCode=75\nclasses1_preserved=ok\noffline_asset=ok\nqueue_cancel_ui=ok\n' >> "$STATUS"

# Align and sign
"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROP=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROP" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROP" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROP" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk > /tmp/verify59.txt
CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify59.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERT" = "$EXPECTED_CERT_SHA256"
APK_SHA="$(sha256sum /tmp/Nava.apk | cut -d' ' -f1)"
printf 'zipalign=ok\nsigning=ok\ncert_sha256=%s\napk_sha256=%s\n' "$CERT" "$APK_SHA" >> "$STATUS"

# Publish idempotently: duplicate final runs do not turn success into failure.
if gh release view "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  printf 'release=v12.1.59\nasset=Nava.apk\nrelease_existing=yes\n' >> "$STATUS"
else
  NOTES='12.1.59 bağlantı kurtarma ve indirme iptali. İnternet hatasında yerel Nava çevrimdışı ekranı açılır; Tekrar dene düğmesi ve bağlantı geri geldiğinde otomatik yeniden deneme vardır. 12.1.58 ile yanlışlıkla İndirilenler ekranına eklenen yenile düğmesi kaldırılmıştır. İndirme sırasında her cilt satırında İptal ve kuyrukta Tümünü iptal et vardır; native OfflineRuntime cancel köprüsü bekleyen URLleri atlar ve aktif HttpURLConnection bağlantısını keser. Gruplu cilt ilerleme görünümü korunur. Bilinen sağlam 12.1.47 WebView/classes.dex byte-for-byte korunur.'
  gh release create "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.59' --notes "$NOTES" --latest
  printf 'release=v12.1.59\nasset=Nava.apk\nrelease_existing=no\n' >> "$STATUS"
fi
printf 'status=success\nfinished=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap - EXIT
