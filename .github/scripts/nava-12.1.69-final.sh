#!/usr/bin/env bash
set -euo pipefail
STATUS=/tmp/status69.txt
: > "$STATUS"
printf 'status=running\nstarted=%s\ntest_gate=passed\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap 'rc=$?; if [ "$rc" -ne 0 ] && ! grep -q "^status=success$" "$STATUS"; then printf "status=failed\nfinished=%s\n" "$(date -u +%FT%TZ)" >> "$STATUS"; fi; exit "$rc"' EXIT

EXPECTED_SOURCE_SHA256=c7e4b6c9c11d1bb2e5782b7641101a236a2c2bc9bb3fe34cac89e6565a2fb194
EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe
SOURCE_TAG=v12.1.68
TARGET_TAG=v12.1.69

python -m py_compile \
  android-patch/v12.1.59/patch-offline-runtime.py \
  android-patch/v12.1.59/fix-jadx-compile.py \
  android-patch/v12.1.63/patch-offline-runtime63.py \
  android-patch/v12.1.69/patch-offline-runtime69.py \
  android-patch/v12.1.69/patch-apk.py
node --check tests/v12169-contract.test.js
node tests/v12169-contract.test.js
printf 'source_validation=ok\nbase=12.1.68\nzero_safe_order=ok\nlanguage_batch=all_variants\nstorage_trim=icons_and_webfonts\nresource_cap=220_preserved\n' >> "$STATUS"

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

mkdir -p /tmp/current
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/current
GOT="$(sha256sum /tmp/current/Nava.apk | cut -d' ' -f1)"
test "$GOT" = "$EXPECTED_SOURCE_SHA256"
printf 'source_apk=ok\nsource_sha256=%s\n' "$GOT" >> "$STATUS"

unzip -p /tmp/current/Nava.apk classes.dex > /tmp/c1-base.dex
unzip -p /tmp/current/Nava.apk classes2.dex > /tmp/c2-base.dex
if unzip -l /tmp/current/Nava.apk | grep -q ' classes3.dex$'; then unzip -p /tmp/current/Nava.apk classes3.dex > /tmp/c3-base.dex; fi
unzip -p /tmp/current/Nava.apk resources.arsc > /tmp/res-base.arsc
unzip -p /tmp/current/Nava.apk assets/nava_app_v11.css > /tmp/css-base
unzip -p /tmp/current/Nava.apk assets/offline.html > /tmp/off-base

python android-patch/v12.1.59/patch-offline-runtime.py \
  android-patch/v12.1.59/native-source/OfflineRuntime.java.txt /tmp/OfflineRuntime59.java
python android-patch/v12.1.59/fix-jadx-compile.py /tmp/OfflineRuntime59.java
python android-patch/v12.1.63/patch-offline-runtime63.py /tmp/OfflineRuntime59.java /tmp/OfflineRuntime63.java
python android-patch/v12.1.69/patch-offline-runtime69.py /tmp/OfflineRuntime63.java /tmp/OfflineRuntime.java

grep -q 'MAX_RESOURCES = 220' /tmp/OfflineRuntime.java
grep -q 'submitBatch63' /tmp/OfflineRuntime.java
grep -q 'seriesRelations63' /tmp/OfflineRuntime.java
! grep -q 'stylesheet|icon' /tmp/OfflineRuntime.java
! grep -q 'woff2?' /tmp/OfflineRuntime.java

ANDROID_JAR="$(find "$ANDROID_HOME/platforms" -name android.jar | sort -V | tail -1)"
BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
rm -rf /tmp/javac69 /tmp/newdex69 /tmp/mini69 /tmp/mini69-dec /tmp/base69-dec
mkdir -p /tmp/javac69 /tmp/newdex69 /tmp/mini69
javac -encoding UTF-8 -source 8 -target 8 -cp "$ANDROID_JAR" -d /tmp/javac69 /tmp/OfflineRuntime.java
mapfile -t CLASSES < <(find /tmp/javac69/com/verudanava/nava -name 'OfflineRuntime*.class' -type f | sort)
test "${#CLASSES[@]}" -ge 5
"$BUILD_TOOLS/d8" --lib "$ANDROID_JAR" --min-api 26 --output /tmp/newdex69 "${CLASSES[@]}"

unzip -p /tmp/current/Nava.apk AndroidManifest.xml > /tmp/mini69/AndroidManifest.xml
cp /tmp/newdex69/classes.dex /tmp/mini69/classes.dex
(cd /tmp/mini69 && zip -q /tmp/mini69.apk AndroidManifest.xml classes.dex)
curl -fsSL -o /tmp/apktool.jar https://github.com/iBotPeaches/Apktool/releases/download/v2.11.1/apktool_2.11.1.jar
java -jar /tmp/apktool.jar d -f -r /tmp/mini69.apk -o /tmp/mini69-dec >/tmp/apktool-mini69.log
java -jar /tmp/apktool.jar d -f -r /tmp/current/Nava.apk -o /tmp/base69-dec >/tmp/apktool-base69.log
rm -f /tmp/base69-dec/smali_classes2/com/verudanava/nava/OfflineRuntime*.smali
cp /tmp/mini69-dec/smali/com/verudanava/nava/OfflineRuntime*.smali /tmp/base69-dec/smali_classes2/com/verudanava/nava/
java -jar /tmp/apktool.jar b /tmp/base69-dec -o /tmp/rebuilt69.apk >/tmp/apktool-build69.log
unzip -p /tmp/rebuilt69.apk classes2.dex > /tmp/classes2-69.dex
grep -aq 'submitBatch63' /tmp/classes2-69.dex
grep -aq 'seriesRelations63' /tmp/classes2-69.dex
grep -aq 'Nava:OfflineDownload63' /tmp/classes2-69.dex
printf 'native_source_compile=ok\nstorage_runtime=trimmed\nbackground_63_preserved=ok\n' >> "$STATUS"

python android-patch/v12.1.69/patch-apk.py \
  /tmp/current/Nava.apk /tmp/classes2-69.dex /tmp/Nava-unsigned.apk | tee /tmp/patch69.txt
grep -q 'PATCH_OK versionName=12.1.69 versionCode=85' /tmp/patch69.txt

unzip -p /tmp/Nava-unsigned.apk classes.dex > /tmp/c1-final.dex
unzip -p /tmp/Nava-unsigned.apk classes2.dex > /tmp/c2-final.dex
cmp -s /tmp/c1-base.dex /tmp/c1-final.dex
! cmp -s /tmp/c2-base.dex /tmp/c2-final.dex
if [ -f /tmp/c3-base.dex ]; then unzip -p /tmp/Nava-unsigned.apk classes3.dex > /tmp/c3-final.dex; cmp -s /tmp/c3-base.dex /tmp/c3-final.dex; fi
unzip -p /tmp/Nava-unsigned.apk resources.arsc > /tmp/res-final.arsc
unzip -p /tmp/Nava-unsigned.apk assets/nava_app_v11.css > /tmp/css-final
unzip -p /tmp/Nava-unsigned.apk assets/offline.html > /tmp/off-final
cmp -s /tmp/res-base.arsc /tmp/res-final.arsc
cmp -s /tmp/css-base /tmp/css-final
cmp -s /tmp/off-base /tmp/off-final
unzip -p /tmp/Nava-unsigned.apk assets/nava_app_v11.js > /tmp/app69.js
node --check /tmp/app69.js
grep -q 'Nava Android 12.1.69 — zero-safe order' /tmp/app69.js
grep -q 'isFinite(Number(a.chapterNo))' /tmp/app69.js
grep -q 'state.index.groups' /tmp/app69.js
test "$(grep -o 'w\.navaOpenDownloads=show' /tmp/app69.js | wc -l)" -eq 1
"$BUILD_TOOLS/aapt" dump badging /tmp/Nava-unsigned.apk | grep -q "versionCode='85'.*versionName='12.1.69'"
printf 'patch=ok\nversionName=12.1.69\nversionCode=85\nchapter_zero_sort=ok\nall_language_variants=ok\nclasses1_preserved=ok\nclasses2_storage_runtime=ok\nclasses3_preserved=ok\nresources_preserved=ok\ncss_preserved=ok\noffline_preserved=ok\n' >> "$STATUS"

"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROP=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROP" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROP" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROP" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk > /tmp/verify69.txt
CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify69.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERT" = "$EXPECTED_CERT_SHA256"
APK_SHA="$(sha256sum /tmp/Nava.apk | cut -d' ' -f1)"
printf 'zipalign=ok\nsigning=ok\ncert_sha256=%s\napk_sha256=%s\n' "$CERT" "$APK_SHA" >> "$STATUS"

unzip -p /tmp/Nava.apk classes.dex > /tmp/signed-c1.dex
unzip -p /tmp/Nava.apk classes2.dex > /tmp/signed-c2.dex
cmp -s /tmp/c1-base.dex /tmp/signed-c1.dex
grep -aq 'StartupOverlay61' /tmp/signed-c1.dex
grep -aq 'Nava-Android/12.1.60' /tmp/signed-c1.dex
grep -aq 'NavaAndroidApp/12.1.47' /tmp/signed-c1.dex
grep -aq 'submitBatch63' /tmp/signed-c2.dex
grep -aq 'seriesRelations63' /tmp/signed-c2.dex
printf 'final_semantic_check=ok\nstartup_61_preserved=ok\nupdater_60_preserved=ok\nwebview_ua_47_preserved=ok\nbackground_63_preserved=ok\n' >> "$STATUS"

if gh release view "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  gh release upload "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --clobber
  gh release edit "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.69' --latest
  printf 'release=v12.1.69\nasset=Nava.apk\nrelease_existing=yes\n' >> "$STATUS"
else
  NOTES='12.1.69 indirilenler ve depolama iyileştirmesi. İndirilen bölüm sıralamasında 0 artık falsy fallback yüzünden sona düşmez; 0, 0.5, 1, 2... şeklinde gerçek sayısal sıra korunur. Cilt/eser indirmesinde bir bölümün feed indeksinde TR/EN veya diğer desteklenen dil varyantları varsa aynı bölüm grubundaki tüm dil URLleri indirme batchine eklenir. Offline depolamada okuma için gereksiz favicon/app icon ve webfont dosyaları indirilmez; CSS, bölüm görselleri, mevcut URL dedupe, 220 kaynak güvenlik sınırı, arka plan indirme ve 12.1.68 davranışları korunur.'
  gh release create "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.69' --notes "$NOTES" --latest
  printf 'release=v12.1.69\nasset=Nava.apk\nrelease_existing=no\n' >> "$STATUS"
fi

printf 'status=success\nfinished=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap - EXIT
