#!/usr/bin/env bash
set -euo pipefail
sed \
  -e 's#android-patch/v12.1.84#android-patch/v12.1.86#g' \
  -e 's#tests/v12184-shell.test.js#tests/v12186-shell.test.js#g' \
  -e 's#v12184#v12186#g' \
  -e 's#TARGET_TAG=v12.1.85#TARGET_TAG=v12.1.86#g' \
  -e "s/versionCode='101'.*versionName='12.1.85'/versionCode='102'.*versionName='12.1.86'/" \
  -e "s/versionName='12.1.85'/versionName='12.1.86'/" \
  -e "s/Nava 12.1.85/Nava 12.1.86/g" \
  -e 's#source84-cert#source86-cert#g' \
  -e 's#manifest84#manifest86#g' \
  -e 's#app84#app86#g' \
  -e 's#verify84#verify86#g' \
  -e 's#base84-#base86-#g' \
  -e 's#final84-#final86-#g' \
  .github/scripts/nava-12.1.84-final.sh > /tmp/nava-12.1.86-final.sh
bash /tmp/nava-12.1.86-final.sh
