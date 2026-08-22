#!/usr/bin/env bash
set -euo pipefail
EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe
SOURCE_TAG=v12.1.71
TARGET_TAG=v12.1.72
DRY_RUN="${DRY_RUN:-0}"

python -m py_compile \
  android-patch/v12.1.59/patch-offline-runtime.py \
  android-patch/v12.1.59/fix-jadx-compile.py \
  android-patch/v12.1.63/patch-offline-runtime63.py \
  android-patch/v12.1.69/patch-offline-runtime69.py \
  android-patch/v12.1.70/patch-offline-runtime70.py \
  android-patch/v12.1.71/patch-offline-runtime71.py \
  android-patch/v12.1.72/patch-offline-runtime72.py \
  android-patch/v12.1.72/patch-manifest72.py \
  android-patch/v12.1.72/patch-apk.py
node --check android-patch/v12.1.72/ui-state-v12172.js
node tests/v12172-state.test.js

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
mkdir -p /tmp/nava-signing && unzip -q /tmp/signing.zip -d /tmp/nava-signing

mkdir -p /tmp/current72
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/current72
SOURCE=/tmp/current72/Nava.apk
ANDROID_JAR="$(find "$ANDROID_HOME/platforms" -name android.jar | sort -V | tail -1)"
BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
"$BUILD_TOOLS/aapt" dump badging "$SOURCE" | grep -q "versionCode='87'.*versionName='12.1.71'"
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs "$SOURCE" > /tmp/source72-cert.txt
SRC_CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/source72-cert.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$SRC_CERT" = "$EXPECTED_CERT_SHA256"

unzip -p "$SOURCE" classes.dex > /tmp/c1-72-base.dex
unzip -p "$SOURCE" classes2.dex > /tmp/c2-72-base.dex
if unzip -l "$SOURCE" | grep -q ' classes3.dex$'; then unzip -p "$SOURCE" classes3.dex > /tmp/c3-72-base.dex; fi
unzip -p "$SOURCE" resources.arsc > /tmp/res-72-base.arsc
unzip -p "$SOURCE" assets/nava_app_v11.js > /tmp/js-72-base
unzip -p "$SOURCE" assets/nava_app_v11.css > /tmp/css-72-base
unzip -p "$SOURCE" assets/offline.html > /tmp/off-72-base

python android-patch/v12.1.59/patch-offline-runtime.py android-patch/v12.1.59/native-source/OfflineRuntime.java.txt /tmp/OfflineRuntime59.java
python android-patch/v12.1.59/fix-jadx-compile.py /tmp/OfflineRuntime59.java
python android-patch/v12.1.63/patch-offline-runtime63.py /tmp/OfflineRuntime59.java /tmp/OfflineRuntime63.java
python android-patch/v12.1.69/patch-offline-runtime69.py /tmp/OfflineRuntime63.java /tmp/OfflineRuntime69.java
python android-patch/v12.1.70/patch-offline-runtime70.py /tmp/OfflineRuntime69.java /tmp/OfflineRuntime70.java
python android-patch/v12.1.71/patch-offline-runtime71.py /tmp/OfflineRuntime70.java /tmp/OfflineRuntime71.java
python android-patch/v12.1.72/patch-offline-runtime72.py /tmp/OfflineRuntime71.java /tmp/OfflineRuntime.java
cp android-patch/v12.1.70/native-source/NavaDownloadService70.java.txt /tmp/NavaDownloadService70.java

grep -q 'getDownloadQueue72' /tmp/OfflineRuntime.java
grep -q 'mergeQueue72' /tmp/OfflineRuntime.java
grep -q 'applyMetadata72' /tmp/OfflineRuntime.java
grep -q 'downloadOne71' /tmp/OfflineRuntime.java
grep -q 'NavaDownloadService70.enqueue' /tmp/OfflineRuntime.java

rm -rf /tmp/javac72 /tmp/newdex72 /tmp/mini72 /tmp/mini72-dec /tmp/base72-dec
mkdir -p /tmp/javac72 /tmp/newdex72 /tmp/mini72
javac -encoding UTF-8 -source 8 -target 8 -cp "$ANDROID_JAR" -d /tmp/javac72 /tmp/OfflineRuntime.java /tmp/NavaDownloadService70.java
mapfile -t CLASSES < <(find /tmp/javac72/com/verudanava/nava \( -name 'OfflineRuntime*.class' -o -name 'NavaDownloadService70*.class' \) -type f | sort)
test "${#CLASSES[@]}" -ge 7
"$BUILD_TOOLS/d8" --lib "$ANDROID_JAR" --min-api 26 --output /tmp/newdex72 "${CLASSES[@]}"

unzip -p "$SOURCE" AndroidManifest.xml > /tmp/mini72/AndroidManifest.xml
cp /tmp/newdex72/classes.dex /tmp/mini72/classes.dex
(cd /tmp/mini72 && zip -q /tmp/mini72.apk AndroidManifest.xml classes.dex)
curl -fsSL -o /tmp/apktool.jar https://github.com/iBotPeaches/Apktool/releases/download/v2.11.1/apktool_2.11.1.jar
java -jar /tmp/apktool.jar d -f -r /tmp/mini72.apk -o /tmp/mini72-dec >/tmp/apktool-mini72.log
java -jar /tmp/apktool.jar d -f "$SOURCE" -o /tmp/base72-dec >/tmp/apktool-base72.log
rm -f /tmp/base72-dec/smali_classes2/com/verudanava/nava/OfflineRuntime*.smali /tmp/base72-dec/smali_classes2/com/verudanava/nava/NavaDownloadService70*.smali
cp /tmp/mini72-dec/smali/com/verudanava/nava/OfflineRuntime*.smali /tmp/base72-dec/smali_classes2/com/verudanava/nava/
cp /tmp/mini72-dec/smali/com/verudanava/nava/NavaDownloadService70*.smali /tmp/base72-dec/smali_classes2/com/verudanava/nava/
python android-patch/v12.1.72/patch-manifest72.py /tmp/base72-dec/AndroidManifest.xml
java -jar /tmp/apktool.jar b /tmp/base72-dec -o /tmp/rebuilt72.apk >/tmp/apktool-build72.log
unzip -p /tmp/rebuilt72.apk classes2.dex > /tmp/classes2-72.dex
unzip -p /tmp/rebuilt72.apk AndroidManifest.xml > /tmp/manifest-72.bin

grep -aq 'getDownloadQueue72' /tmp/classes2-72.dex
grep -aq 'downloadQueue72' /tmp/classes2-72.dex
grep -aq 'NavaDownloadService70' /tmp/classes2-72.dex
python android-patch/v12.1.72/patch-apk.py "$SOURCE" /tmp/classes2-72.dex /tmp/manifest-72.bin android-patch/v12.1.72/ui-state-v12172.js /tmp/Nava-unsigned.apk
"$BUILD_TOOLS/aapt" dump badging /tmp/Nava-unsigned.apk | grep -q "versionCode='88'.*versionName='12.1.72'"

unzip -p /tmp/Nava-unsigned.apk classes.dex > /tmp/c1-72-final.dex
unzip -p /tmp/Nava-unsigned.apk classes2.dex > /tmp/c2-72-final.dex
cmp -s /tmp/c1-72-base.dex /tmp/c1-72-final.dex
! cmp -s /tmp/c2-72-base.dex /tmp/c2-72-final.dex
if [ -f /tmp/c3-72-base.dex ]; then unzip -p /tmp/Nava-unsigned.apk classes3.dex > /tmp/c3-72-final.dex; cmp -s /tmp/c3-72-base.dex /tmp/c3-72-final.dex; fi
unzip -p /tmp/Nava-unsigned.apk resources.arsc > /tmp/res-72-final.arsc
unzip -p /tmp/Nava-unsigned.apk assets/nava_app_v11.js > /tmp/js-72-final
unzip -p /tmp/Nava-unsigned.apk assets/nava_app_v11.css > /tmp/css-72-final
unzip -p /tmp/Nava-unsigned.apk assets/offline.html > /tmp/off-72-final
cmp -s /tmp/res-72-base.arsc /tmp/res-72-final.arsc
! cmp -s /tmp/js-72-base /tmp/js-72-final
cmp -s /tmp/css-72-base /tmp/css-72-final
cmp -s /tmp/off-72-base /tmp/off-72-final
node --check /tmp/js-72-final
grep -q '__navaDownloadStateV12172' /tmp/js-72-final
grep -q 'getDownloadQueue72' /tmp/js-72-final
grep -q 'collapseSearch' /tmp/js-72-final
grep -q 'stopImmediatePropagation' /tmp/js-72-final
grep -q 'filterDownloadItems.__v12172' /tmp/js-72-final
grep -q 'state.index.groups' /tmp/js-72-final
grep -q 'isFinite(Number(a.chapterNo))' /tmp/js-72-final

"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROP=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROP" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROP" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROP" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk > /tmp/verify72.txt
CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify72.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERT" = "$EXPECTED_CERT_SHA256"
APK_SHA="$(sha256sum /tmp/Nava.apk | cut -d' ' -f1)"
echo "NAVA_12_1_72_BUILD_OK apk_sha256=$APK_SHA cert_sha256=$CERT native_queue=ok metadata=ok search=compact dry_run=$DRY_RUN"

if [ "$DRY_RUN" = "1" ]; then exit 0; fi
NOTES='12.1.72 indirme ekranı doğruluk düzeltmesi. İndirme sırası artık WebView localStorage tahmininden değil Android native batch ledgerinden okunur; tamamlanan öğeler bekliyor olarak kalmaz, sayfa değişiminde state kaybolmaz. Her indirme için seriesName/volumeNo/chapterNo/lang/groupKey metadata kalıcı kaydedilir ve progress bar yanlış cilde bağlanmaz. İndirilenlerde arama artık tüm eser/cilt/bölüm ağacını otomatik açık bırakmaz; arama kompakt başlar ve yalnızca dokunduğun eser/cilt açılır. 12.1.71 retry ve 12.1.70 foreground service korunur.'
if gh release view "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  gh release upload "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --clobber
  gh release edit "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.72' --notes "$NOTES" --latest
else
  gh release create "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.72' --notes "$NOTES" --latest
fi
