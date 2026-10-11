#!/usr/bin/env bash
set -euo pipefail
sed \
  -e 's#android-patch/v12.1.84#android-patch/v12.1.89#g' \
  -e 's#patch-manifest84.py#patch-manifest89.py#g' \
  -e 's#patch-apk84.py#patch-apk89.py#g' \
  -e 's#tests/v12184-shell.test.js#tests/v12189-shell.test.js#g' \
  -e 's#v12184#v12189#g' \
  -e 's#__navaShellV12184#__navaShellV12189#g' \
  -e 's#TARGET_TAG=v12.1.85#TARGET_TAG=v12.1.89#g' \
  -e "s/versionCode='101'.*versionName='12.1.85'/versionCode='105'/" \
  -e "s/versionName='12.1.85'/versionName='12.1.89'/" \
  -e 's#Nava 12.1.85#Nava 12.1.89#g' \
  -e 's#source84-cert#source89-cert#g' \
  -e 's#manifest84#manifest89#g' \
  -e 's#app84#app89#g' \
  -e 's#verify84#verify89#g' \
  -e 's#base84-#base89-#g' \
  -e 's#final84-#final89-#g' \
  .github/scripts/nava-12.1.84-final.sh > /tmp/nava-12.1.89-final.sh
bash /tmp/nava-12.1.89-final.sh
