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

python -m py_compile android-patch/v12.1.61/patch-decoded.py
node --check android-patch/v12.1.61/notification-v12161.js
grep -q 'Nava Android 12.1.61 — startup and v9 notification UI' android-patch/v12.1.61/ui-v12161.css
grep -q 'setInterval(probe,2500)' android-patch/v12.1.61/offline.html
grep -q 'android:visibility="invisible"' android-patch/v12.1.61/activity_main.xml
printf 'source_validation=ok\nbase=12.1.60\nstartup=nava-splash-until-page-finished\noffline_retry=manual-online-probe\nnotifications=v9-clear-delete\nupdater=direct-https-preserved\n' >> "$STATUS"

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

# Download exact signed 12.1.60 base.
mkdir -p /tmp/current
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/current
GOT="$(sha256sum /tmp/current/Nava.apk | cut -d' ' -f1)"
test "$GOT" = "$EXPECTED_SOURCE_SHA256"
unzip -p /tmp/current/Nava.apk classes2.dex > /tmp/classes2-base.dex
if unzip -l /tmp/current/Nava.apk | grep -q ' classes3.dex$'; then unzip -p /tmp/current/Nava.apk classes3.dex > /tmp/classes3-base.dex; fi
printf 'source_apk=ok\nsource_sha256=%s\n' "$GOT" >> "$STATUS"

BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
curl -fsSL -o /tmp/apktool.jar https://github.com/iBotPeaches/Apktool/releases/download/v2.11.1/apktool_2.11.1.jar
rm -rf /tmp/base61-dec /tmp/final61-dec
java -jar /tmp/apktool.jar d -f /tmp/current/Nava.apk -o /tmp/base61-dec >/tmp/apktool61-decode.log

python android-patch/v12.1.61/patch-decoded.py \
  /tmp/base61-dec \
  android-patch/v12.1.61/notification-v12161.js \
  android-patch/v12.1.61/ui-v12161.css \
  android-patch/v12.1.61/offline.html \
  android-patch/v12.1.61/activity_main.xml | tee /tmp/patch61.txt
grep -q 'DECODED_PATCH_OK versionName=12.1.61 versionCode=77 startup=splash-until-page-finished offline=probe notification=v9-clear-delete' /tmp/patch61.txt
node --check /tmp/base61-dec/assets/nava_app_v11.js
printf 'decoded_patch=ok\n' >> "$STATUS"

java -jar /tmp/apktool.jar b /tmp/base61-dec -o /tmp/rebuilt61.apk >/tmp/apktool61-build.log

# Keep cancellation/offline runtime dexes from the exact 12.1.60 base byte-for-byte.
python - <<'PY'
import zipfile
from pathlib import Path
base=Path('/tmp/current/Nava.apk'); rebuilt=Path('/tmp/rebuilt61.apk'); out=Path('/tmp/Nava-unsigned.apk')
def oldsig(name):
    u=name.upper(); leaf=u.rsplit('/',1)[-1]
    return u.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))
with zipfile.ZipFile(base) as b, zipfile.ZipFile(rebuilt) as r, zipfile.ZipFile(out,'w') as z:
    bnames=set(b.namelist())
    for info in r.infolist():
        if oldsig(info.filename): continue
        data=r.read(info.filename)
        if info.filename in ('classes2.dex','classes3.dex') and info.filename in bnames:
            data=b.read(info.filename)
        z.writestr(info,data)
PY

unzip -p /tmp/Nava-unsigned.apk classes2.dex > /tmp/classes2-final.dex
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
printf 'assemble=ok\nversionName=12.1.61\nversionCode=77\nclasses2_preserved=ok\nclasses3_preserved=ok\n' >> "$STATUS"

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

# Final semantic proof from the signed APK.
java -jar /tmp/apktool.jar d -f /tmp/Nava.apk -o /tmp/final61-dec >/tmp/apktool61-final.log
GX="$(find /tmp/final61-dec -type f -name 'gx.smali' | head -1)"
E00="$(find /tmp/final61-dec -type f -name 'e00.smali' | head -1)"
test -n "$GX" && test -n "$E00"
grep -q 'Landroid/webkit/WebView;->setVisibility(I)V' "$GX"
grep -q 'Ljava/net/HttpURLConnection;' "$E00"
! grep -q 'Landroid/app/DownloadManager$Request;' "$E00"
grep -q 'android:visibility="invisible"' /tmp/final61-dec/res/layout/activity_main.xml
grep -q 'Yükleniyor…' /tmp/final61-dec/res/layout/activity_main.xml
grep -q 'android:windowBackground">#ffc6dafc' /tmp/final61-dec/res/values/styles.xml
unzip -p /tmp/Nava.apk classes.dex > /tmp/classes1-final61.dex
grep -aq 'NavaAndroidApp/12.1.47' /tmp/classes1-final61.dex
grep -aq 'Nava-Android/12.1.60' /tmp/classes1-final61.dex
printf 'final_semantic_check=ok\nwebview_ua=12.1.47-preserved\nupdater_60_direct_https=preserved\n' >> "$STATUS"

if gh release view "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  gh release upload "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --clobber
  gh release edit "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.61' --latest
  printf 'release=v12.1.61\nasset=Nava.apk\nrelease_existing=yes\n' >> "$STATUS"
else
  NOTES='12.1.61 açılış, çevrimdışı kurtarma ve bildirim deneyimi. Uygulama ilk açılışta beyaz ekran yerine Nava mavisi üzerinde launcher logosu ve Yükleniyor ekranı gösterir; ilk sayfa tamamlandığında WebView görünür olur ve sonraki sayfa geçişlerinde splash tekrar gösterilmez. Çevrimdışı ekranında Tekrar dene, Android online olayı ve 2.5 saniyelik gerçek ağ kontrolü birlikte çalışır. Gerçek v9 bildirim paneline Tümünü temizle ve tek bildirim silme kontrolleri eklenmiştir. 12.1.60 doğrudan HTTPS updater, 12.1.59 cilt bazlı indirme sırası ve gerçek iptal sistemi korunmuştur.'
  gh release create "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.61' --notes "$NOTES" --latest
  printf 'release=v12.1.61\nasset=Nava.apk\nrelease_existing=no\n' >> "$STATUS"
fi
printf 'status=success\nfinished=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap - EXIT
