#!/usr/bin/env bash
set -euo pipefail
STATUS=/tmp/status61.txt
: > "$STATUS"
printf 'status=running\nstarted=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap 'rc=$?; if [ "$rc" -ne 0 ] && ! grep -q "^status=success$" "$STATUS"; then printf "status=failed\nfinished=%s\n" "$(date -u +%FT%TZ)" >> "$STATUS"; fi; exit "$rc"' EXIT

EXPECTED_SOURCE_SHA256=cfde38c53d89b3215baa9fbeb49944bfdc114a487747910e47bfd0e13e66cae8
EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe
SOURCE_TAG=v12.1.60
TARGET_TAG=v12.1.61

python -m py_compile android-patch/v12.1.61/patch-smali.py android-patch/v12.1.61/patch-apk.py
node --check android-patch/v12.1.61/notification-v12161.js
grep -q 'native startup overlay without resource-table changes' android-patch/v12.1.61/StartupOverlay61.java
grep -q 'setInterval(probe,2500)' android-patch/v12.1.61/offline.html
printf 'source_validation=ok\nbase=12.1.60\nstartup=native-overlay-until-page-finished\noffline_retry=manual-online-probe\nnotifications=v9-clear-delete\nupdater=direct-https-preserved\nresources=byte-preserved\n' >> "$STATUS"

# Recover production signing material.
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

# Download exact signed 12.1.60 base and capture immutable payload hashes.
rm -rf /tmp/current /tmp/base61-dec /tmp/helperclasses /tmp/helperdex /tmp/helper-mini /tmp/helper-dec /tmp/final61-dec
mkdir -p /tmp/current /tmp/helperclasses /tmp/helperdex /tmp/helper-mini

gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/current
GOT="$(sha256sum /tmp/current/Nava.apk | cut -d' ' -f1)"
test "$GOT" = "$EXPECTED_SOURCE_SHA256"
unzip -p /tmp/current/Nava.apk resources.arsc > /tmp/resources-base.arsc
unzip -p /tmp/current/Nava.apk classes2.dex > /tmp/classes2-base.dex
if unzip -l /tmp/current/Nava.apk | grep -q ' classes3.dex$'; then unzip -p /tmp/current/Nava.apk classes3.dex > /tmp/classes3-base.dex; fi
printf 'source_apk=ok\nsource_sha256=%s\nresources_sha256=%s\n' "$GOT" "$(sha256sum /tmp/resources-base.arsc | cut -d' ' -f1)" >> "$STATUS"

ANDROID_JAR="$(find "$ANDROID_HOME/platforms" -name android.jar | sort -V | tail -1)"
BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
curl -fsSL -o /tmp/apktool.jar https://github.com/iBotPeaches/Apktool/releases/download/v2.11.1/apktool_2.11.1.jar

# Compile only the native startup overlay helper.
javac -encoding UTF-8 -source 8 -target 8 -cp "$ANDROID_JAR" -d /tmp/helperclasses android-patch/v12.1.61/StartupOverlay61.java
mapfile -t HELPER_CLASSES < <(find /tmp/helperclasses/com/verudanava/nava -name 'StartupOverlay61*.class' -type f | sort)
test "${#HELPER_CLASSES[@]}" -ge 1
"$BUILD_TOOLS/d8" --lib "$ANDROID_JAR" --min-api 26 --output /tmp/helperdex "${HELPER_CLASSES[@]}"

# Turn the helper dex into smali using a tiny APK shell; do not decode resources.
unzip -p /tmp/current/Nava.apk AndroidManifest.xml > /tmp/helper-mini/AndroidManifest.xml
cp /tmp/helperdex/classes.dex /tmp/helper-mini/classes.dex
(cd /tmp/helper-mini && zip -q /tmp/helper-mini.apk AndroidManifest.xml classes.dex)
java -jar /tmp/apktool.jar d -f -r /tmp/helper-mini.apk -o /tmp/helper-dec >/tmp/apktool61-helper.log
HELPER_SMALI="$(find /tmp/helper-dec -type f -path '*/com/verudanava/nava/StartupOverlay61.smali' | head -1)"
test -n "$HELPER_SMALI" && test -f "$HELPER_SMALI"
grep -q 'nava-startup-v12161' "$HELPER_SMALI"
printf 'startup_helper_compile=ok\n' >> "$STATUS"

# Decode 12.1.60 smali-only: resource table/layout/theme stay raw and are never linked.
java -jar /tmp/apktool.jar d -f -r /tmp/current/Nava.apk -o /tmp/base61-dec >/tmp/apktool61-decode.log
MAIN_SMALI="$(find /tmp/base61-dec -type f -path '*/com/verudanava/nava/MainActivity.smali' | head -1)"
GX_SMALI="$(find /tmp/base61-dec -type f -name 'gx.smali' | head -1)"
E00_SMALI="$(find /tmp/base61-dec -type f -name 'e00.smali' | head -1)"
test -n "$MAIN_SMALI" && test -n "$GX_SMALI" && test -n "$E00_SMALI"
grep -q 'Ljava/net/HttpURLConnection;' "$E00_SMALI"
! grep -q 'Landroid/app/DownloadManager$Request;' "$E00_SMALI"
python android-patch/v12.1.61/patch-smali.py /tmp/base61-dec | tee /tmp/patch61-smali.txt
grep -q 'SMALI_PATCH_OK startup=StartupOverlay61 install+hide resources=untouched' /tmp/patch61-smali.txt
HELPER_DEST="$(dirname "$MAIN_SMALI")/StartupOverlay61.smali"
cp "$HELPER_SMALI" "$HELPER_DEST"
grep -q 'StartupOverlay61;->install' "$MAIN_SMALI"
grep -q 'StartupOverlay61;->hide' "$GX_SMALI"
grep -q 'nava-startup-v12161' "$HELPER_DEST"
printf 'smali_patch=ok\nresource_rebuild=disabled\n' >> "$STATUS"

# Smali-only rebuild. With -r decoded base, apktool does not relink Material resources.
java -jar /tmp/apktool.jar b /tmp/base61-dec -o /tmp/rebuilt61.apk >/tmp/apktool61-build.log
unzip -p /tmp/rebuilt61.apk classes.dex > /tmp/classes1-61.dex
grep -aq 'StartupOverlay61' /tmp/classes1-61.dex
grep -aq 'NavaAndroidApp/12.1.47' /tmp/classes1-61.dex
grep -aq 'Nava-Android/12.1.60' /tmp/classes1-61.dex
printf 'classes1_rebuild=ok\n' >> "$STATUS"

# Assemble final APK from the signed 12.1.60 container, changing only manifest/classes1/assets.
python android-patch/v12.1.61/patch-apk.py \
  /tmp/current/Nava.apk /tmp/classes1-61.dex \
  android-patch/v12.1.61/notification-v12161.js \
  android-patch/v12.1.61/ui-v12161.css \
  android-patch/v12.1.61/offline.html \
  /tmp/Nava-unsigned.apk | tee /tmp/patch61.txt
grep -q 'PATCH_OK versionName=12.1.61 versionCode=77 base=12.1.60 resources=byte-preserved startup=native-overlay notifications=v9 offline=probe updater=60-preserved' /tmp/patch61.txt

unzip -p /tmp/Nava-unsigned.apk resources.arsc > /tmp/resources-final.arsc
unzip -p /tmp/Nava-unsigned.apk classes2.dex > /tmp/classes2-final.dex
cmp -s /tmp/resources-base.arsc /tmp/resources-final.arsc
cmp -s /tmp/classes2-base.dex /tmp/classes2-final.dex
if [ -f /tmp/classes3-base.dex ]; then unzip -p /tmp/Nava-unsigned.apk classes3.dex > /tmp/classes3-final.dex; cmp -s /tmp/classes3-base.dex /tmp/classes3-final.dex; fi
unzip -p /tmp/Nava-unsigned.apk assets/nava_app_v11.js > /tmp/final61.js
unzip -p /tmp/Nava-unsigned.apk assets/nava_app_v11.css > /tmp/final61.css
unzip -p /tmp/Nava-unsigned.apk assets/offline.html > /tmp/final61-offline.html
node --check /tmp/final61.js
grep -q 'nava-notification-clear-all-v12161' /tmp/final61.js
grep -q 'nava-notification-delete-v12161' /tmp/final61.js
grep -q 'Nava Android 12.1.61 — startup and v9 notification UI' /tmp/final61.css
grep -q 'setInterval(probe,2500)' /tmp/final61-offline.html
"$BUILD_TOOLS/aapt" dump badging /tmp/Nava-unsigned.apk | grep -q "versionCode='77'.*versionName='12.1.61'"
printf 'assemble=ok\nversionName=12.1.61\nversionCode=77\nresources_preserved=ok\nclasses2_preserved=ok\nclasses3_preserved=ok\n' >> "$STATUS"

# Align and sign with the existing production certificate.
"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROP=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROP" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROP" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROP" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk > /tmp/verify61.txt
CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify61.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERT" = "$EXPECTED_CERT_SHA256"
APK_SHA="$(sha256sum /tmp/Nava.apk | cut -d' ' -f1)"
printf 'zipalign=ok\nsigning=ok\ncert_sha256=%s\napk_sha256=%s\n' "$CERT" "$APK_SHA" >> "$STATUS"

# Final semantic proof from signed APK, again smali-only to avoid resource relinking.
java -jar /tmp/apktool.jar d -f -r /tmp/Nava.apk -o /tmp/final61-dec >/tmp/apktool61-final.log
FINAL_MAIN="$(find /tmp/final61-dec -type f -path '*/com/verudanava/nava/MainActivity.smali' | head -1)"
FINAL_GX="$(find /tmp/final61-dec -type f -name 'gx.smali' | head -1)"
FINAL_E00="$(find /tmp/final61-dec -type f -name 'e00.smali' | head -1)"
FINAL_START="$(find /tmp/final61-dec -type f -path '*/com/verudanava/nava/StartupOverlay61.smali' | head -1)"
test -n "$FINAL_MAIN" && test -n "$FINAL_GX" && test -n "$FINAL_E00" && test -n "$FINAL_START"
grep -q 'StartupOverlay61;->install' "$FINAL_MAIN"
grep -q 'StartupOverlay61;->hide' "$FINAL_GX"
grep -q 'nava-startup-v12161' "$FINAL_START"
grep -q 'Ljava/net/HttpURLConnection;' "$FINAL_E00"
! grep -q 'Landroid/app/DownloadManager$Request;' "$FINAL_E00"
unzip -p /tmp/Nava.apk classes.dex > /tmp/classes1-final61.dex
grep -aq 'NavaAndroidApp/12.1.47' /tmp/classes1-final61.dex
grep -aq 'Nava-Android/12.1.60' /tmp/classes1-final61.dex
unzip -p /tmp/Nava.apk resources.arsc > /tmp/resources-signed.arsc
cmp -s /tmp/resources-base.arsc /tmp/resources-signed.arsc
printf 'final_semantic_check=ok\nwebview_ua=12.1.47-preserved\nupdater_60_direct_https=preserved\nresources_byte_preserved=ok\n' >> "$STATUS"

if gh release view "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  gh release upload "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --clobber
  gh release edit "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.61' --latest
  printf 'release=v12.1.61\nasset=Nava.apk\nrelease_existing=yes\n' >> "$STATUS"
else
  NOTES='12.1.61 açılış, çevrimdışı kurtarma ve bildirim deneyimi. Açılışta sistem splash sonrası beyaz flaş yerine native Nava mavi yükleme katmanı gösterilir; launcher logosu, Nava ve Yükleniyor göstergesi ilk sayfa tamamlandığında kapanır. Çevrimdışı ekranında Tekrar dene, Android online olayı ve 2.5 saniyelik ağ kontrolü birlikte çalışır. Gerçek v9 bildirim paneline Tümünü temizle ve tek bildirim silme kontrolleri eklenmiştir. Android resource tablosu 12.1.60 ile byte-byte aynıdır; 12.1.60 doğrudan HTTPS updater ve 12.1.59 cilt bazlı indirme/iptal sistemi korunur.'
  gh release create "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.61' --notes "$NOTES" --latest
  printf 'release=v12.1.61\nasset=Nava.apk\nrelease_existing=no\n' >> "$STATUS"
fi
printf 'status=success\nfinished=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap - EXIT
