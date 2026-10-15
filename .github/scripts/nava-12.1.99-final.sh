#!/usr/bin/env bash
set -euo pipefail
STATUS=/tmp/status99.txt
: > "$STATUS"
printf 'status=running\nstarted=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap 'rc=$?; if [ "$rc" -ne 0 ] && ! grep -q "^status=success$" "$STATUS"; then printf "status=failed\nfinished=%s\n" "$(date -u +%FT%TZ)" >> "$STATUS"; fi; exit "$rc"' EXIT
EXPECTED_SOURCE_SHA256=57fdb5e5f9be19eae2d2bad1f382ea2e326f0a7f428d665a059346ac34efa8c3
EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe
SOURCE_TAG=v12.1.98
TARGET_TAG=v12.2.13

python -m py_compile android-patch/v12.1.59/patch-offline-runtime.py android-patch/v12.1.59/fix-jadx-compile.py android-patch/v12.1.63/patch-offline-runtime63.py android-patch/v12.1.99/patch-apk99.py android-patch/v12.1.99/patch-offline-storage100.py
node --check android-patch/v12.1.99/shell-v12199.js
node tests/v12199-shell.test.js
grep -q 'PowerManager.PARTIAL_WAKE_LOCK' android-patch/v12.1.63/patch-offline-runtime63.py
grep -q 'Bitmap.CompressFormat.WEBP' android-patch/v12.1.99/patch-offline-runtime99.py
grep -q 'MAX_RESOURCES = 220' android-patch/v12.1.63/patch-offline-runtime63.py
grep -q 'NAVA_OFFLINE_STORAGE_COMPRESSED_V12199' android-patch/v12.1.99/offline.html
grep -q '__navaDownloadsSettingsRoute12213' android-patch/v12.1.99/shell-v12199.js
echo SOURCE_PATCH_VALIDATION_OK
printf 'source_validation=ok\nbase=12.1.98\nimage_compression=WebP-quality-80-max-2400px\ncompression_option=removed
storage_capacity=real-filesystem-free-and-total\nlibrary=relation-aware\nhierarchy=series-volume-chapter\nlegacy_volume_classification=title-url\nbackground=wakelock-native-executor\nspeed=resource-cap-220-plus-skip\n' >> "$STATUS"

# Production signing material.
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
echo SIGNING_MATERIAL_OK

# Exact 12.1.98 base.
mkdir -p /tmp/current
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/current
GOT="$(sha256sum /tmp/current/Nava.apk | cut -d' ' -f1)"
echo "SOURCE_APK_SHA256=$GOT"
test "$GOT" = "$EXPECTED_SOURCE_SHA256"
echo SOURCE_APK_OK
unzip -p /tmp/current/Nava.apk classes.dex > /tmp/c1-base.dex
unzip -p /tmp/current/Nava.apk classes2.dex > /tmp/c2-base.dex
if unzip -l /tmp/current/Nava.apk | grep -q ' classes3.dex$'; then unzip -p /tmp/current/Nava.apk classes3.dex > /tmp/c3-base.dex; fi
unzip -p /tmp/current/Nava.apk resources.arsc > /tmp/res-base.arsc
printf 'source_apk=ok\nsource_sha256=%s\n' "$GOT" >> "$STATUS"

# Verify live alias relation for legacy Tensura metadata.
curl -fsSL 'https://www.verudanava.com/feeds/posts/summary/-/Cilt?alt=json&max-results=500' -o /tmp/cilt-feed.json
python - <<'PY'
import json
j=json.load(open('/tmp/cilt-feed.json',encoding='utf-8'))
entries=j.get('feed',{}).get('entry',[])
match=[]
for e in entries:
    title=e.get('title',{}).get('$t','')
    labels=[x.get('term','') for x in e.get('category',[])]
    if title.lower()=='tensura cilt 11': match.append((title,labels))
assert match, 'Tensura Cilt 11 missing from live Cilt feed'
assert any('Tensei Shitara Slime Datta Ken (Light Novel)' in labels for _,labels in match), match
print('LIVE_RELATION_OK')
PY
printf 'live_relation_contract=ok\n' >> "$STATUS"

# Rebuild only OfflineRuntime in classes2.dex. No manifest/resource rebuild.
python android-patch/v12.1.59/patch-offline-runtime.py android-patch/v12.1.59/native-source/OfflineRuntime.java.txt /tmp/OfflineRuntime59.java
python android-patch/v12.1.59/fix-jadx-compile.py /tmp/OfflineRuntime59.java
python android-patch/v12.1.63/patch-offline-runtime63.py /tmp/OfflineRuntime59.java /tmp/OfflineRuntime63.java
python android-patch/v12.1.69/patch-offline-runtime69.py /tmp/OfflineRuntime63.java /tmp/OfflineRuntime69.java
python android-patch/v12.1.70/patch-offline-runtime70.py /tmp/OfflineRuntime69.java /tmp/OfflineRuntime70.java
python android-patch/v12.1.71/patch-offline-runtime71.py /tmp/OfflineRuntime70.java /tmp/OfflineRuntime71.java
python android-patch/v12.1.72/patch-offline-runtime72.py /tmp/OfflineRuntime71.java /tmp/OfflineRuntime72.java
python android-patch/v12.1.99/patch-offline-runtime99.py /tmp/OfflineRuntime72.java /tmp/OfflineRuntime99.java
python android-patch/v12.1.99/patch-offline-storage100.py /tmp/OfflineRuntime99.java /tmp/OfflineRuntime.java
ANDROID_JAR="$(find "$ANDROID_HOME/platforms" -name android.jar | sort -V | tail -1)"
BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
cp android-patch/v12.1.70/native-source/NavaDownloadService70.java.txt /tmp/NavaDownloadService70.java
rm -rf /tmp/javac99 /tmp/newdex99 /tmp/mini99 /tmp/mini99-dec /tmp/base99-dec
mkdir -p /tmp/javac99 /tmp/newdex99 /tmp/mini99
javac -encoding UTF-8 -source 8 -target 8 -cp "$ANDROID_JAR" -d /tmp/javac99 /tmp/OfflineRuntime.java /tmp/NavaDownloadService70.java
mapfile -t CLASSES < <(find /tmp/javac99/com/verudanava/nava \( -name 'OfflineRuntime*.class' -o -name 'NavaDownloadService70*.class' \) -type f | sort)
test "${#CLASSES[@]}" -ge 5
"$BUILD_TOOLS/d8" --lib "$ANDROID_JAR" --min-api 26 --output /tmp/newdex99 "${CLASSES[@]}"
unzip -p /tmp/current/Nava.apk AndroidManifest.xml > /tmp/mini99/AndroidManifest.xml
cp /tmp/newdex99/classes.dex /tmp/mini99/classes.dex
(cd /tmp/mini99 && zip -q /tmp/mini99.apk AndroidManifest.xml classes.dex)
curl -fsSL -o /tmp/apktool.jar https://github.com/iBotPeaches/Apktool/releases/download/v2.11.1/apktool_2.11.1.jar
java -jar /tmp/apktool.jar d -f -r /tmp/mini99.apk -o /tmp/mini99-dec >/tmp/apktool-mini99.log
java -jar /tmp/apktool.jar d -f -r /tmp/current/Nava.apk -o /tmp/base99-dec >/tmp/apktool-base99.log
rm -f /tmp/base99-dec/smali_classes2/com/verudanava/nava/OfflineRuntime*.smali /tmp/base99-dec/smali_classes2/com/verudanava/nava/NavaDownloadService70*.smali
cp /tmp/mini99-dec/smali/com/verudanava/nava/OfflineRuntime*.smali /tmp/base99-dec/smali_classes2/com/verudanava/nava/
cp /tmp/mini99-dec/smali/com/verudanava/nava/NavaDownloadService70*.smali /tmp/base99-dec/smali_classes2/com/verudanava/nava/
java -jar /tmp/apktool.jar b /tmp/base99-dec -o /tmp/rebuilt99.apk >/tmp/apktool-build63.log
unzip -p /tmp/rebuilt99.apk classes2.dex > /tmp/classes2-99.dex
grep -aq 'submitBatch63' /tmp/classes2-99.dex
grep -aq 'seriesRelations63' /tmp/classes2-99.dex
grep -aq 'Nava:OfflineDownload63' /tmp/classes2-99.dex
grep -aq 'NavaDownloadService70' /tmp/classes2-99.dex
! grep -aq 'NavaDownloadService63' /tmp/classes2-99.dex
printf 'native_source_compile=ok\nlegacy_compression_runtime_preserved\nduplicate_download_prevention=always_on\nwakelock_runtime=ok\nrelation_bridge=ok\n' >> "$STATUS"

# Patch the original signed APK while replacing the native offline runtime and UI assets.
unzip -p /tmp/current/Nava.apk AndroidManifest.xml > /tmp/manifest99.bin
python android-patch/v12.1.99/patch-manifest99.py /tmp/manifest99.bin
grep -q 'optimizeImage99' /tmp/OfflineRuntime.java
grep -q 'storageAvailableBytes' /tmp/OfflineRuntime.java
grep -q 'cleanupReadChapters' /tmp/OfflineRuntime.java
grep -q 'chapterLanguage' /tmp/OfflineRuntime.java
python android-patch/v12.1.99/patch-apk99.py /tmp/current/Nava.apk /tmp/manifest99.bin /tmp/classes2-99.dex android-patch/v12.1.99/shell-v12199.js android-patch/v12.1.99/shell-v12199.css /tmp/Nava-unsigned.apk | tee /tmp/patch99.txt
grep -q 'PATCH_213_OK online shortcut routes to canonical downloads/settings screen' /tmp/patch99.txt
echo CHECK_PATCH_OK
unzip -p /tmp/Nava-unsigned.apk classes.dex > /tmp/c1-final.dex
unzip -p /tmp/Nava-unsigned.apk classes2.dex > /tmp/c2-final.dex
cmp -s /tmp/c1-base.dex /tmp/c1-final.dex
echo CHECK_CLASSES1_OK
! cmp -s /tmp/c2-base.dex /tmp/c2-final.dex
echo CHECK_CLASSES2_CHANGED
if [ -f /tmp/c3-base.dex ]; then unzip -p /tmp/Nava-unsigned.apk classes3.dex > /tmp/c3-final.dex; cmp -s /tmp/c3-base.dex /tmp/c3-final.dex; fi
unzip -p /tmp/Nava-unsigned.apk resources.arsc > /tmp/res-final.arsc
cmp -s /tmp/res-base.arsc /tmp/res-final.arsc
echo CHECK_RESOURCES_OK
unzip -p /tmp/Nava-unsigned.apk assets/nava_app_v11.js > /tmp/app99.js
node --check /tmp/app99.js
echo CHECK_JS_SYNTAX_OK
grep -q '__navaShellV12199' /tmp/app99.js
grep -q '__navaDownloadsSettingsRoute12213' /tmp/app99.js
echo CHECK_SETTINGS_ROUTE_OK
grep -aq 'storageAvailableBytes' /tmp/c2-final.dex
echo CHECK_NATIVE_STORAGE_OK
grep -aq 'cleanupReadChapters' /tmp/c2-final.dex
grep -aq 'chapterLanguage' /tmp/c2-final.dex
grep -aq 'WEBP' /tmp/c2-final.dex
unzip -p /tmp/Nava-unsigned.apk assets/offline.html > /tmp/off99.html
grep -q 'NAVA_OFFLINE_STORAGE_COMPRESSED_V12199' /tmp/off99.html
echo CHECK_OFFLINE_ASSET_OK
! grep -q 'N.optimizeStorage' /tmp/off99.html
echo CHECK_NO_OPTIMIZE_OPTION
"$BUILD_TOOLS/aapt" dump badging /tmp/Nava-unsigned.apk | grep -q "versionCode='128'.*versionName='12.2.13'"
echo CHECK_MANIFEST_BADGING
"$BUILD_TOOLS/aapt" dump permissions /tmp/Nava-unsigned.apk | grep -q 'android.permission.WAKE_LOCK'
echo CHECK_WAKE_LOCK_PERMISSION
printf 'patch=ok\nversionName=12.2.13\nversionCode=128\nclasses1_preserved=ok\nclasses2_webp_compression=ok\nclasses3_preserved=ok\nresources_preserved=ok\n' >> "$STATUS"

# Sign.
"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROP=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROP" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROP" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROP" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk > /tmp/verify99.txt
CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify99.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERT" = "$EXPECTED_CERT_SHA256"
APK_SHA="$(sha256sum /tmp/Nava.apk | cut -d' ' -f1)"
printf 'zipalign=ok\nsigning=ok\ncert_sha256=%s\napk_sha256=%s\n' "$CERT" "$APK_SHA" >> "$STATUS"

# Final semantic proof.
unzip -p /tmp/Nava.apk classes.dex > /tmp/signed-c1.dex
unzip -p /tmp/Nava.apk classes2.dex > /tmp/signed-c2.dex
cmp -s /tmp/c1-base.dex /tmp/signed-c1.dex
grep -aq 'StartupOverlay61' /tmp/signed-c1.dex
grep -aq 'Nava-Android/12.1.60' /tmp/signed-c1.dex
grep -aq 'NavaAndroidApp/12.1.47' /tmp/signed-c1.dex
grep -aq 'Nava:OfflineDownload63' /tmp/signed-c2.dex
grep -aq 'NavaDownloadService70' /tmp/signed-c2.dex
grep -aq 'seriesRelations63' /tmp/signed-c2.dex
grep -aq 'storageAvailableBytes' /tmp/signed-c2.dex
grep -aq 'cleanupReadChapters' /tmp/signed-c2.dex
grep -aq 'chapterLanguage' /tmp/signed-c2.dex
grep -aq 'WEBP' /tmp/signed-c2.dex
printf 'final_semantic_check=ok\nstartup_61_preserved=ok\nupdater_60_preserved=ok\nwebview_ua_47_preserved=ok\nbackground_wakelock=ok\n' >> "$STATUS"

if gh release view "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  gh release upload "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --clobber
  gh release edit "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" --title 'Nava 12.2.13' --latest
  printf 'release=v12.2.13\nasset=Nava.apk\nrelease_existing=yes\n' >> "$STATUS"
else
  NOTES='12.2.13: Çevrim içi İndirmeler penceresindeki Ayarlar kısayolu artık ayrı bir panel üretmez; ortak indirme ayarlarının bulunduğu mevcut İndirilenler ekranını açar. Çevrimdışı bölüm sayfalarında okuyucunun satır içi ve harici scriptleri korunur; iframe öğeleri kaldırılır. Bölüm URL adreslerinde sorgu parametreleri korunarak çevrim içi ve çevrim dışı aynı bölüm eşleştirilir. Depolama sınırı hem ayarlanan GB miktarını hem cihazdaki gerçek boş alanı aşamaz. Akıllı İndirme tek ayardır: yalnızca sonraki bölüme geçildiğinde tamamlanma sayar ve üç bölüm ileride eski bölümleri arka planda temizler. Ayrı otomatik temizleme ayarı yoktur. İndirilenler ve çevrimdışı içerikler tek ekranda birleştirildi. Wi-Fi ile indirme tercihi kaydedilir; yeniden indirme seçildiğinde bölüm sayfası ve kaynakları güncellenir. Dil, eser sayfasında seçilen varyanttan alınır. Okuyucu aynı eserde aynı dilde en az üç bölüm ilerlediğinde eski bölümler otomatik temizlenir. Gerçek depolama kullanımı, boş alan ve toplam alan gösterilir. Gereksiz akıllı indirme ve genel dil ayarları kaldırıldı; ana sayfadaki küçük indirme penceresi korunur. Düz, sade alt gezinme stilleri kullanılır. Canlı Cilt ilişkisi cachelenerek Tensura Cilt 11 gibi eski kısa/alias metadata kayıtları gerçek ana esere bağlanır. Eski kind=chapter olsa bile Cilt 11 başlık/URL kaydı cilt sayfası olarak tanınır; Cilt altında ikinci Cilt satırı oluşmaz ve yalnız bölümler listelenir. Native batch indirme partial wake lock ile uygulama arka plana atıldığında ve ekran kapandığında çalışmayı sürdürür. Bölüm sorgu parametreleri korunur, tamamlanmış sayfa yeniden indirilmez. Gereksiz tracker/font/embed kaynakları atlanır, kaynak sınırı 220 ve timeoutlar kısaltılmıştır. 12.1.61 açılışı, 12.1.60 updater ve 12.1.47 WebView UA korunur.'
  gh release create "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --title 'Nava 12.2.13' --notes "$NOTES" --latest
  printf 'release=v12.2.13\nasset=Nava.apk\nrelease_existing=no\n' >> "$STATUS"
fi
printf 'status=success\nfinished=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap - EXIT
