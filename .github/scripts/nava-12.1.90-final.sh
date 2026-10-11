#!/usr/bin/env bash
set -euo pipefail
sed \
  -e 's#android-patch/v12.1.84#android-patch/v12.1.90#g' \
  -e 's#patch-manifest84.py#patch-manifest90.py#g' \
  -e 's#patch-apk84.py#patch-apk90.py#g' \
  -e 's#tests/v12184-shell.test.js#tests/v12190-shell.test.js#g' \
  -e 's#v12184#v12190#g' \
  -e 's#__navaShellV12184#__navaShellV12190#g' \
  -e 's#TARGET_TAG=v12.1.85#TARGET_TAG=v12.1.90#g' \
  -e "s/versionCode='101'.*versionName='12.1.85'/versionCode='106'/" \
  -e "s/versionName='12.1.85'/versionName='12.1.90'/" \
  -e 's#Nava 12.1.85#Nava 12.1.90#g' \
  -e 's#source84-cert#source90-cert#g' \
  -e 's#manifest84#manifest90#g' \
  -e 's#app84#app90#g' \
  -e 's#verify84#verify90#g' \
  -e 's#base84-#base90-#g' \
  -e 's#final84-#final90-#g' \
  .github/scripts/nava-12.1.84-final.sh > /tmp/nava-12.1.90-final.sh
bash /tmp/nava-12.1.90-final.sh
