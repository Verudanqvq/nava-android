#!/usr/bin/env bash
set -euo pipefail
sed \
 -e 's#android-patch/v12.1.84#android-patch/v12.1.96#g' \
 -e 's#patch-manifest84.py#patch-manifest96.py#g' \
 -e 's#patch-apk84.py#patch-apk96.py#g' \
 -e 's#tests/v12184-shell.test.js#tests/v12196-shell.test.js#g' \
 -e 's#v12184#v12196#g' \
 -e 's#__navaShellV12184#__navaShellV12196#g' \
 -e 's#TARGET_TAG=v12.1.85#TARGET_TAG=v12.1.96#g' \
 -e "s/versionCode='101'.*versionName='12.1.85'/versionCode='112'/" \
 -e "s/versionName='12.1.85'/versionName='12.1.96'/" \
 -e 's#Nava 12.1.85#Nava 12.1.96#g' \
 -e 's#source84-cert#source94-cert#g' \
 -e 's#manifest84#manifest96#g' \
 -e 's#app84#app94#g' \
 -e 's#verify84#verify94#g' \
 -e 's#base84-#base94-#g' \
 -e 's#final84-#final94-#g' \
 -e 's#for entry in classes.dex classes2.dex assets/offline.html resources.arsc; do#for entry in classes.dex classes2.dex resources.arsc; do#' \
 .github/scripts/nava-12.1.84-final.sh >/tmp/nava-12.1.96-final.sh
bash /tmp/nava-12.1.96-final.sh
