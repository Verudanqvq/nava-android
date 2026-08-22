#!/usr/bin/env bash
set -euo pipefail
EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe
SOURCE_TAG=v12.1.69
TARGET_TAG=v12.1.70
DRY_RUN="${DRY_RUN:-0}"

python -m py_compile \
  android-patch/v12.1.59/patch-offline-runtime.py \
  android-patch/v12.1.59/fix-jadx-compile.py \
  android-patch/v12.1.63/patch-offline-runtime63.py \
  android-patch/v12.1.69/patch-offline-runtime69.py \
  android-patch/v12.1.70/patch-offline-runtime70.py \
  android-patch/v12.1.70/patch-manifest70.py \
  android-patch/v12.1.70/patch-apk.py

grep -q 'START_REDELIVER_INTENT' android-patch/v12.1.70/native-source/NavaDownloadService70.java.txt
grep -q 'startForegroundService' android-patch/v12.1.70/native-source/NavaDownloadService70.java.txt
grep -q 'stopWithTask' android-patch/v12.1.70/patch-manifest70.py

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

mkdir -p /tmp/current70
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/current70
SOURCE=/tmp/current70/Nava.apk
ANDROID_JAR="$(find "$ANDROID_HOME/platforms" -name android.jar | sort -V | tail -1)"
BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
"$BUILD_TOOLS/aapt" dump badging "$SOURCE" | grep -q "versionCode='85'.*versionName='12.1.69'"
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs "$SOURCE" > /tmp/source70-cert.txt
SRC_CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/source70-cert.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$SRC_CERT" = "$EXPECTED_CERT_SHA256"

unzip -p "$SOURCE" classes.dex > /tmp/c1-70-base.dex
unzip -p "$SOURCE" classes2.dex > /tmp/c2-70-base.dex
if unzip -l "$SOURCE" | grep -q ' classes3.dex$'; then unzip -p "$SOURCE" classes3.dex > /tmp/c3-70-base.dex; fi
unzip -p "$SOURCE" resources.arsc > /tmp/res-70-base.arsc
unzip -p "$SOURCE" assets/nava_app_v11.js > /tmp/js-70-base
unzip -p "$SOURCE" assets/nava_app_v11.css > /tmp/css-70-base
unzip -p "$SOURCE" assets/offline.html > /tmp/off-70-base

python android-patch/v12.1.59/patch-offline-runtime.py android-patch/v12.1.59/native-source/OfflineRuntime.java.txt /tmp/OfflineRuntime59.java
python android-patch/v12.1.59/fix-jadx-compile.py /tmp/OfflineRuntime59.java
python android-patch/v12.1.63/patch-offline-runtime63.py /tmp/OfflineRuntime59.java /tmp/OfflineRuntime63.java
python android-patch/v12.1.69/patch-offline-runtime69.py /tmp/OfflineRuntime63.java /tmp/OfflineRuntime69.java
python android-patch/v12.1.70/patch-offline-runtime70.py /tmp/OfflineRuntime69.java /tmp/OfflineRuntime.java
cp android-patch/v12.1.70/native-source/NavaDownloadService70.java.txt /tmp/NavaDownloadService70.java

grep -q 'NavaDownloadService70.enqueue' /tmp/OfflineRuntime.java
grep -q 'submitBatch63' /tmp/OfflineRuntime.java

rm -rf /tmp/javac70 /tmp/newdex70 /tmp/mini70 /tmp/mini70-dec /tmp/base70-dec
mkdir -p /tmp/javac70 /tmp/newdex70 /tmp/mini70
javac -encoding UTF-8 -source 8 -target 8 -cp "$ANDROID_JAR" -d /tmp/javac70 /tmp/OfflineRuntime.java /tmp/NavaDownloadService70.java
mapfile -t CLASSES < <(find /tmp/javac70/com/verudanava/nava \( -name 'OfflineRuntime*.class' -o -name 'NavaDownloadService70*.class' \) -type f | sort)
test "${#CLASSES[@]}" -ge 7
"$BUILD_TOOLS/d8" --lib "$ANDROID_JAR" --min-api 26 --output /tmp/newdex70 "${CLASSES[@]}"

unzip -p "$SOURCE" AndroidManifest.xml > /tmp/mini70/AndroidManifest.xml
cp /tmp/newdex70/classes.dex /tmp/mini70/classes.dex
(cd /tmp/mini70 && zip -q /tmp/mini70.apk AndroidManifest.xml classes.dex)
curl -fsSL -o /tmp/apktool.jar https://github.com/iBotPeaches/Apktool/releases/download/v2.11.1/apktool_2.11.1.jar
java -jar /tmp/apktool.jar d -f -r /tmp/mini70.apk -o /tmp/mini70-dec >/tmp/apktool-mini70.log
java -jar /tmp/apktool.jar d -f "$SOURCE" -o /tmp/base70-dec >/tmp/apktool-base70.log
rm -f /tmp/base70-dec/smali_classes2/com/verudanava/nava/OfflineRuntime*.smali
rm -f /tmp/base70-dec/smali_classes2/com/verudanava/nava/NavaDownloadService70*.smali
cp /tmp/mini70-dec/smali/com/verudanava/nava/OfflineRuntime*.smali /tmp/base70-dec/smali_classes2/com/verudanava/nava/
cp /tmp/mini70-dec/smali/com/verudanava/nava/NavaDownloadService70*.smali /tmp/base70-dec/smali_classes2/com/verudanava/nava/
python android-patch/v12.1.70/patch-manifest70.py /tmp/base70-dec/AndroidManifest.xml

grep -q 'android.permission.FOREGROUND_SERVICE' /tmp/base70-dec/AndroidManifest.xml
grep -q 'android.permission.FOREGROUND_SERVICE_DATA_SYNC' /tmp/base70-dec/AndroidManifest.xml
grep -q 'NavaDownloadService70' /tmp/base70-dec/AndroidManifest.xml
grep -q 'foregroundServiceType="dataSync"' /tmp/base70-dec/AndroidManifest.xml
grep -q 'stopWithTask="false"' /tmp/base70-dec/AndroidManifest.xml

java -jar /tmp/apktool.jar b /tmp/base70-dec -o /tmp/rebuilt70.apk >/tmp/apktool-build70.log
unzip -p /tmp/rebuilt70.apk classes2.dex > /tmp/classes2-70.dex
unzip -p /tmp/rebuilt70.apk AndroidManifest.xml > /tmp/manifest-70.bin
grep -aq 'NavaDownloadService70' /tmp/classes2-70.dex

python android-patch/v12.1.70/patch-apk.py "$SOURCE" /tmp/classes2-70.dex /tmp/manifest-70.bin /tmp/Nava-unsigned.apk
"$BUILD_TOOLS/aapt" dump badging /tmp/Nava-unsigned.apk | grep -q "versionCode='86'.*versionName='12.1.70'"
"$BUILD_TOOLS/aapt" dump xmltree /tmp/Nava-unsigned.apk AndroidManifest.xml > /tmp/manifest70-tree.txt
grep -q 'NavaDownloadService70' /tmp/manifest70-tree.txt
grep -q 'FOREGROUND_SERVICE' /tmp/manifest70-tree.txt

unzip -p /tmp/Nava-unsigned.apk classes.dex > /tmp/c1-70-final.dex
unzip -p /tmp/Nava-unsigned.apk classes2.dex > /tmp/c2-70-final.dex
cmp -s /tmp/c1-70-base.dex /tmp/c1-70-final.dex
! cmp -s /tmp/c2-70-base.dex /tmp/c2-70-final.dex
if [ -f /tmp/c3-70-base.dex ]; then unzip -p /tmp/Nava-unsigned.apk classes3.dex > /tmp/c3-70-final.dex; cmp -s /tmp/c3-70-base.dex /tmp/c3-70-final.dex; fi
unzip -p /tmp/Nava-unsigned.apk resources.arsc > /tmp/res-70-final.arsc
unzip -p /tmp/Nava-unsigned.apk assets/nava_app_v11.js > /tmp/js-70-final
unzip -p /tmp/Nava-unsigned.apk assets/nava_app_v11.css > /tmp/css-70-final
unzip -p /tmp/Nava-unsigned.apk assets/offline.html > /tmp/off-70-final
cmp -s /tmp/res-70-base.arsc /tmp/res-70-final.arsc
cmp -s /tmp/js-70-base /tmp/js-70-final
cmp -s /tmp/css-70-base /tmp/css-70-final
cmp -s /tmp/off-70-base /tmp/off-70-final

"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROP=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROP" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROP" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROP" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk > /tmp/verify70.txt
CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify70.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERT" = "$EXPECTED_CERT_SHA256"
APK_SHA="$(sha256sum /tmp/Nava.apk | cut -d' ' -f1)"
echo "NAVA_12_1_70_BUILD_OK apk_sha256=$APK_SHA cert_sha256=$CERT dry_run=$DRY_RUN"

if [ "$DRY_RUN" = "1" ]; then exit 0; fi
NOTES='12.1.70 arka plan indirme düzeltmesi. Bölüm/cilt indirmeleri artık Activity/WebView içindeki executor yerine Android foreground dataSync service üzerinden yürür. Uygulama görevden çıkarıldığında service stopWithTask=false ile devam eder; Android processi sistem tarafından öldürürse START_REDELIVER_INTENT aktif batchi yeniden teslim eder. 12.1.69 sıralama, çoklu dil ve depolama iyileştirmeleri korunur.'
if gh release view "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  gh release upload "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --clobber
  gh release edit "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.70' --notes "$NOTES" --latest
else
  gh release create "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.70' --notes "$NOTES" --latest
fi
