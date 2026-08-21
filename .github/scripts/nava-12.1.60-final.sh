#!/usr/bin/env bash
set -euo pipefail
STATUS=/tmp/status60.txt
: > "$STATUS"
printf 'status=running\nstarted=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap 'rc=$?; if [ "$rc" -ne 0 ] && ! grep -q "^status=success$" "$STATUS"; then printf "status=failed\nfinished=%s\n" "$(date -u +%FT%TZ)" >> "$STATUS"; fi; exit "$rc"' EXIT

EXPECTED_SOURCE_SHA256=e3d1c78bab4face9f0d479169560b8e9bf0d099bcc4f076eec6e1bcbea47241f
EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe
SOURCE_TAG=v12.1.59
TARGET_TAG=v12.1.60

python -m py_compile android-patch/v12.1.60/patch-apk.py
grep -q 'Nava Android 12.1.60 — direct HTTPS updater click listener' android-patch/v12.1.60/e00.java
grep -q 'HttpURLConnection' android-patch/v12.1.60/e00.java
grep -q 'manager.g(target' android-patch/v12.1.60/e00.java
printf 'source_validation=ok\nbase=12.1.59\nupdater=direct-https\nlistener=e00\nnative_ua=12.1.47-preserved\n' >> "$STATUS"

# Recover signing material.
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

# Download the signed 12.1.59 base.
mkdir -p /tmp/current
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/current
GOT="$(sha256sum /tmp/current/Nava.apk | cut -d' ' -f1)"
test "$GOT" = "$EXPECTED_SOURCE_SHA256"
unzip -p /tmp/current/Nava.apk classes.dex > /tmp/classes1-base.dex
unzip -p /tmp/current/Nava.apk classes2.dex > /tmp/classes2-base.dex
if unzip -l /tmp/current/Nava.apk | grep -q ' classes3.dex$'; then unzip -p /tmp/current/Nava.apk classes3.dex > /tmp/classes3-base.dex; fi
printf 'source_apk=ok\nsource_sha256=%s\n' "$GOT" >> "$STATUS"

ANDROID_JAR="$(find "$ANDROID_HOME/platforms" -name android.jar | sort -V | tail -1)"
BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
curl -fsSL -o /tmp/apktool.jar https://github.com/iBotPeaches/Apktool/releases/download/v2.11.1/apktool_2.11.1.jar

# Decode the base and prove the old listener is the DownloadManager implementation.
java -jar /tmp/apktool.jar d -f -r /tmp/current/Nava.apk -o /tmp/base-dec >/tmp/apktool-base.log
E00="$(find /tmp/base-dec -type f -name 'e00.smali' | head -1)"
Z5="$(find /tmp/base-dec -type f -name 'z5.smali' | head -1)"
MAIN="$(find /tmp/base-dec -type f -path '*/com/verudanava/nava/MainActivity.smali' | head -1)"
test -n "$E00" && test -f "$E00"
test -n "$Z5" && test -f "$Z5"
test -n "$MAIN" && test -f "$MAIN"
grep -q 'Landroid/app/DownloadManager$Request;' "$E00"
grep -q 'Le00;' "$Z5"
cp "$Z5" /tmp/z5-before.smali
cp "$MAIN" /tmp/MainActivity-before.smali
printf 'old_download_manager_listener=confirmed\n' >> "$STATUS"

# Compile a replacement default-package e00 listener against exact-shape stubs.
mkdir -p /tmp/stubsrc/com/verudanava/nava /tmp/stubclasses /tmp/helperclasses /tmp/helperdex
cat >/tmp/stubsrc/com/verudanava/nava/MainActivity.java <<'JAVA'
package com.verudanava.nava;
public class MainActivity extends android.app.Activity {}
JAVA
cat >/tmp/stubsrc/h00.java <<'JAVA'
import com.verudanava.nava.MainActivity;
import java.io.File;
import java.util.concurrent.ExecutorService;
public class h00 {
  public MainActivity a;
  public ExecutorService b;
  public volatile boolean j;
  public volatile boolean k;
  public void a() {}
  public File f() { return null; }
  public void g(File file, String digest) {}
}
JAVA
cat >/tmp/stubsrc/g00.java <<'JAVA'
public class g00 {
  public String a;
  public String b;
  public String c;
  public String d;
}
JAVA
javac -encoding UTF-8 -source 8 -target 8 -cp "$ANDROID_JAR" -d /tmp/stubclasses \
  /tmp/stubsrc/com/verudanava/nava/MainActivity.java /tmp/stubsrc/h00.java /tmp/stubsrc/g00.java
jar cf /tmp/stubs.jar -C /tmp/stubclasses .
javac -encoding UTF-8 -source 8 -target 8 -cp "$ANDROID_JAR:/tmp/stubs.jar" -d /tmp/helperclasses android-patch/v12.1.60/e00.java
mapfile -t HELPER_CLASSES < <(find /tmp/helperclasses -type f -name 'e00*.class' | sort)
test "${#HELPER_CLASSES[@]}" -ge 2
"$BUILD_TOOLS/d8" --lib "$ANDROID_JAR" --classpath /tmp/stubs.jar --min-api 26 --output /tmp/helperdex "${HELPER_CLASSES[@]}"

# Convert only the helper dex to smali, then replace only e00 in the decoded base.
mkdir -p /tmp/helper-mini
unzip -p /tmp/current/Nava.apk AndroidManifest.xml > /tmp/helper-mini/AndroidManifest.xml
cp /tmp/helperdex/classes.dex /tmp/helper-mini/classes.dex
(cd /tmp/helper-mini && zip -q /tmp/helper-mini.apk AndroidManifest.xml classes.dex)
java -jar /tmp/apktool.jar d -f -r /tmp/helper-mini.apk -o /tmp/helper-dec >/tmp/apktool-helper.log
HELPER_E00="$(find /tmp/helper-dec -type f -name 'e00.smali' | head -1)"
test -n "$HELPER_E00" && test -f "$HELPER_E00"
grep -q '.method public constructor <init>(Lh00;Lg00;)V' "$HELPER_E00"
grep -q 'Ljava/net/HttpURLConnection;' "$HELPER_E00"
! grep -q 'Landroid/app/DownloadManager$Request;' "$HELPER_E00"
E_DIR="$(dirname "$E00")"
find "$E_DIR" -maxdepth 1 -type f -name 'e00*.smali' -delete
while IFS= read -r helper; do cp "$helper" "$E_DIR/$(basename "$helper")"; done < <(find "$(dirname "$HELPER_E00")" -maxdepth 1 -type f -name 'e00*.smali' | sort)
grep -q 'Ljava/net/HttpURLConnection;' "$E_DIR/e00.smali"
grep -q 'Le00;' "$Z5"
cmp -s /tmp/z5-before.smali "$Z5"
cmp -s /tmp/MainActivity-before.smali "$MAIN"
printf 'helper_compile=ok\nlistener_replaced=ok\nz5_untouched=ok\nmainactivity_smali_untouched=ok\n' >> "$STATUS"

# Rebuild to obtain the new classes.dex, but the final assembler keeps every other APK entry from 12.1.59.
java -jar /tmp/apktool.jar b /tmp/base-dec -o /tmp/rebuilt60.apk >/tmp/apktool-build.log
unzip -p /tmp/rebuilt60.apk classes.dex > /tmp/classes1-60.dex
grep -aq 'Nava-Android/12.1.60' /tmp/classes1-60.dex
grep -aq 'NavaAndroidApp/12.1.47' /tmp/classes1-60.dex
printf 'classes1_rebuild=ok\n' >> "$STATUS"

python android-patch/v12.1.60/patch-apk.py /tmp/current/Nava.apk /tmp/classes1-60.dex /tmp/Nava-unsigned.apk | tee /tmp/patch60.txt
grep -q 'PATCH_OK versionName=12.1.60 versionCode=76 base=12.1.59 updater=direct-https listener=e00 nativeUA=12.1.47-preserved' /tmp/patch60.txt
unzip -p /tmp/Nava-unsigned.apk classes.dex > /tmp/classes1-final.dex
unzip -p /tmp/Nava-unsigned.apk classes2.dex > /tmp/classes2-final.dex
cmp -s /tmp/classes2-base.dex /tmp/classes2-final.dex
if [ -f /tmp/classes3-base.dex ]; then unzip -p /tmp/Nava-unsigned.apk classes3.dex > /tmp/classes3-final.dex; cmp -s /tmp/classes3-base.dex /tmp/classes3-final.dex; fi
printf 'patch=ok\nversionName=12.1.60\nversionCode=76\nclasses2_preserved=ok\nclasses3_preserved=ok\n' >> "$STATUS"

# Align and sign with the existing production certificate.
"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROP=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROP" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROP" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROP" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk > /tmp/verify60.txt
CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify60.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERT" = "$EXPECTED_CERT_SHA256"
APK_SHA="$(sha256sum /tmp/Nava.apk | cut -d' ' -f1)"
printf 'zipalign=ok\nsigning=ok\ncert_sha256=%s\napk_sha256=%s\n' "$CERT" "$APK_SHA" >> "$STATUS"

# Final semantic check: z5/MainActivity stay the same, e00 is now direct HTTPS.
java -jar /tmp/apktool.jar d -f -r /tmp/Nava.apk -o /tmp/final-dec >/tmp/apktool-final.log
FINAL_E00="$(find /tmp/final-dec -type f -name 'e00.smali' | head -1)"
FINAL_Z5="$(find /tmp/final-dec -type f -name 'z5.smali' | head -1)"
FINAL_MAIN="$(find /tmp/final-dec -type f -path '*/com/verudanava/nava/MainActivity.smali' | head -1)"
grep -q 'Ljava/net/HttpURLConnection;' "$FINAL_E00"
! grep -q 'Landroid/app/DownloadManager$Request;' "$FINAL_E00"
grep -q 'Le00;' "$FINAL_Z5"
cmp -s /tmp/z5-before.smali "$FINAL_Z5"
cmp -s /tmp/MainActivity-before.smali "$FINAL_MAIN"
grep -aq 'NavaAndroidApp/12.1.47' /tmp/Nava.apk
printf 'final_semantic_check=ok\n' >> "$STATUS"

# Publish as Latest. Re-runs remain idempotent.
if gh release view "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  printf 'release=v12.1.60\nasset=Nava.apk\nrelease_existing=yes\n' >> "$STATUS"
else
  NOTES='12.1.60 güncelleme indirme düzeltmesi. Güncelle butonu artık Android DownloadManager yerine Nava içinde doğrudan HTTPS ile Nava.apk dosyasını indirir. İndirme tamamlanınca mevcut GitHub SHA-256 doğrulaması ve Android paket yükleyicisi akışı aynen kullanılır. Eski download_id/pending_install durumu yeni indirme öncesinde temizlenir ve hata olursa kullanıcıya gerçek hata mesajı gösterilir. 12.1.59 çevrimdışı kurtarma, cilt bazlı indirme sırası ve gerçek iptal sistemi korunur. MainActivity/WebView mantığı ve NavaAndroidApp/12.1.47 UA korunmuştur.'
  gh release create "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.60' --notes "$NOTES" --latest
  printf 'release=v12.1.60\nasset=Nava.apk\nrelease_existing=no\n' >> "$STATUS"
fi
printf 'status=success\nfinished=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap - EXIT
