#!/usr/bin/env bash
set -euo pipefail
STATUS=/tmp/status68.txt
: > "$STATUS"
printf 'status=running\nstarted=%s\ntest_gate=passed\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap 'rc=$?; if [ "$rc" -ne 0 ] && ! grep -q "^status=success$" "$STATUS"; then printf "status=failed\nfinished=%s\n" "$(date -u +%FT%TZ)" >> "$STATUS"; fi; exit "$rc"' EXIT
EXPECTED_SOURCE_SHA256=8848a647ca1dc33743d1b0fcee08d03bb2a6c9646d8b4c98d023c2d810f010e5
EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe
SOURCE_TAG=v12.1.67
TARGET_TAG=v12.1.68
python -m py_compile android-patch/v12.1.68/patch-apk.py
for f in library-core-v12168.js downloaded-library-v12168.js language-core-v12168.js language-v12168.js; do node --check "android-patch/v12.1.68/$f"; done
printf 'source_validation=ok\nbase=12.1.67\noffline_title=object-safe\nlanguage=explicit-label-aware\nnative=byte-preserved\n' >> "$STATUS"
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
unzip -p /tmp/current/Nava.apk classes.dex > /tmp/c1-base.dex
unzip -p /tmp/current/Nava.apk classes2.dex > /tmp/c2-base.dex
if unzip -l /tmp/current/Nava.apk | grep -q ' classes3.dex$'; then unzip -p /tmp/current/Nava.apk classes3.dex > /tmp/c3-base.dex; fi
unzip -p /tmp/current/Nava.apk resources.arsc > /tmp/res-base.arsc
unzip -p /tmp/current/Nava.apk assets/nava_app_v11.css > /tmp/css-base
unzip -p /tmp/current/Nava.apk assets/offline.html > /tmp/off-base
printf 'source_apk=ok\nsource_sha256=%s\n' "$GOT" >> "$STATUS"
python android-patch/v12.1.68/patch-apk.py \
  /tmp/current/Nava.apk \
  android-patch/v12.1.68/library-core-v12168.js \
  android-patch/v12.1.68/downloaded-library-v12168.js \
  android-patch/v12.1.68/language-core-v12168.js \
  android-patch/v12.1.68/language-v12168.js \
  /tmp/Nava-unsigned.apk | tee /tmp/patch68.txt
grep -q 'PATCH_OK versionName=12.1.68 versionCode=84' /tmp/patch68.txt
unzip -p /tmp/Nava-unsigned.apk classes.dex > /tmp/c1-final.dex
unzip -p /tmp/Nava-unsigned.apk classes2.dex > /tmp/c2-final.dex
cmp -s /tmp/c1-base.dex /tmp/c1-final.dex
cmp -s /tmp/c2-base.dex /tmp/c2-final.dex
if [ -f /tmp/c3-base.dex ]; then unzip -p /tmp/Nava-unsigned.apk classes3.dex > /tmp/c3-final.dex; cmp -s /tmp/c3-base.dex /tmp/c3-final.dex; fi
unzip -p /tmp/Nava-unsigned.apk resources.arsc > /tmp/res-final.arsc
cmp -s /tmp/res-base.arsc /tmp/res-final.arsc
unzip -p /tmp/Nava-unsigned.apk assets/nava_app_v11.css > /tmp/css-final
cmp -s /tmp/css-base /tmp/css-final
unzip -p /tmp/Nava-unsigned.apk assets/offline.html > /tmp/off-final
cmp -s /tmp/off-base /tmp/off-final
unzip -p /tmp/Nava-unsigned.apk assets/nava_app_v11.js > /tmp/app68.js
node --check /tmp/app68.js
test "$(grep -o 'w\.navaOpenDownloads=show' /tmp/app68.js | wc -l)" -eq 1
grep -q 'Nava Android 12.1.68 TEST-FIRST — object-safe downloaded-library core' /tmp/app68.js
grep -q 'Nava Android 12.1.68 TEST-FIRST — object-safe single downloaded-library renderer' /tmp/app68.js
grep -q 'Nava Android 12.1.68 TEST-FIRST — explicit-label aware current-chapter language core' /tmp/app68.js
grep -q 'Nava Android 12.1.68 TEST-FIRST — explicit-label aware reader language selector' /tmp/app68.js
grep -q 'seriesValue' /tmp/app68.js
grep -q 'languages.length>1||!!cur.explicitLang' /tmp/app68.js
grep -q 'pageLabels' /tmp/app68.js
grep -q 'touch-action:pan-x' /tmp/app68.js
BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
"$BUILD_TOOLS/aapt" dump badging /tmp/Nava-unsigned.apk | grep -q "versionCode='84'.*versionName='12.1.68'"
printf 'patch=ok\nversionName=12.1.68\nversionCode=84\nobject_safe_title=ok\nexplicit_tr_selector=ok\nsingle_renderer=ok\nclasses1_preserved=ok\nclasses2_preserved=ok\nclasses3_preserved=ok\nresources_preserved=ok\ncss_preserved=ok\noffline_preserved=ok\n' >> "$STATUS"
"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROP=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROP" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROP" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROP" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk > /tmp/verify68.txt
CERT="$(grep -i -m1 'certificate SHA-256 digest:' /tmp/verify68.txt | sed 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
test "$CERT" = "$EXPECTED_CERT_SHA256"
APK_SHA="$(sha256sum /tmp/Nava.apk | cut -d' ' -f1)"
printf 'zipalign=ok\nsigning=ok\ncert_sha256=%s\napk_sha256=%s\n' "$CERT" "$APK_SHA" >> "$STATUS"
unzip -p /tmp/Nava.apk classes.dex > /tmp/signed-c1.dex
unzip -p /tmp/Nava.apk classes2.dex > /tmp/signed-c2.dex
cmp -s /tmp/c1-base.dex /tmp/signed-c1.dex
cmp -s /tmp/c2-base.dex /tmp/signed-c2.dex
grep -aq 'StartupOverlay61' /tmp/signed-c1.dex
grep -aq 'Nava-Android/12.1.60' /tmp/signed-c1.dex
grep -aq 'NavaAndroidApp/12.1.47' /tmp/signed-c1.dex
grep -aq 'seriesRelations63' /tmp/signed-c2.dex
grep -aq 'PowerManager' /tmp/signed-c2.dex
printf 'final_semantic_check=ok\nstartup_61_preserved=ok\nupdater_60_preserved=ok\nwebview_ua_47_preserved=ok\nbackground_63_preserved=ok\n' >> "$STATUS"
if gh release view "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
 gh release upload "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --clobber
 gh release edit "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.68' --latest
 printf 'release=v12.1.68\nasset=Nava.apk\nrelease_existing=yes\n' >> "$STATUS"
else
 NOTES='12.1.68 fixes two device-reported regressions with a test-first gate. Offline downloaded-library titles now tolerate legacy object-shaped relation/alias metadata and never render [object Object]. Reader language controls now treat an explicit TR label as intentional: explicit TR is shown even if it is the only language, while an unlabelled/default TR-only chapter remains hidden. The current page tag is also used as a fallback if the Blogger feed has not caught up yet. Fixture, headless DOM, live Blogger feed and real 12.1.67 APK dry-run tests pass before signing.'
 gh release create "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --title 'Nava 12.1.68' --notes "$NOTES" --latest
 printf 'release=v12.1.68\nasset=Nava.apk\nrelease_existing=no\n' >> "$STATUS"
fi
printf 'status=success\nfinished=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap - EXIT
