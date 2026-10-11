#!/usr/bin/env bash
set -euo pipefail
sed \
  -e 's#android-patch/v12.1.84#android-patch/v12.1.88#g' \
  -e 's#patch-manifest84.py#patch-manifest88.py#g' \
  -e 's#patch-apk84.py#patch-apk88.py#g' \
  -e 's#tests/v12184-shell.test.js#tests/v12188-shell.test.js#g' \
  -e 's#v12184#v12188#g' \
  -e 's#__navaShellV12184#__navaShellV12187#g' \
  -e 's#TARGET_TAG=v12.1.85#TARGET_TAG=v12.1.88#g' \
  -e "s/versionCode='101'.*versionName='12.1.85'/versionCode='104'/" \
  -e "s/versionName='12.1.85'/versionName='12.1.88'/" \
  -e 's#Nava 12.1.85#Nava 12.1.88#g' \
  -e 's#source84-cert#source88-cert#g' \
  -e 's#manifest84#manifest88#g' \
  -e 's#app84#app88#g' \
  -e 's#verify84#verify88#g' \
  -e 's#base84-#base88-#g' \
  -e 's#final84-#final88-#g' \
  .github/scripts/nava-12.1.84-final.sh > /tmp/nava-12.1.88-final.sh
bash /tmp/nava-12.1.88-final.sh
