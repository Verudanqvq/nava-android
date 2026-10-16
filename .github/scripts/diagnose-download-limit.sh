#!/usr/bin/env bash
set -euo pipefail
mkdir -p /tmp/nava-limit-diag
gh release download v12.2.23 --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/nava-limit-diag
unzip -p /tmp/nava-limit-diag/Nava.apk assets/nava_app_v11.js > /tmp/nava-limit-diag/app.js
unzip -p /tmp/nava-limit-diag/Nava.apk classes2.dex > /tmp/nava-limit-diag/classes2.dex
python - <<'PY' > /tmp/download-limit-diagnostic.txt
from pathlib import Path
import re
s=Path('/tmp/nava-limit-diag/app.js').read_text(errors='replace')
for needle in ['function gb()','function state()','function refresh()','function root()','function render()','cap.addEventListener','getStorageLimitBytes','setStorageLimitBytes','storageAvailableBytes','nava-profile-download-settings-12218']:
 print('\\n===== '+needle+' =====')
 starts=[m.start() for m in re.finditer(re.escape(needle),s)]
 print('MATCHES',len(starts))
 for p in starts[:5]: print(s[max(0,p-400):min(len(s),p+2500)])
PY
cat /tmp/download-limit-diagnostic.txt
git config user.name 'Nava Diagnosis Bot'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
cp /tmp/download-limit-diagnostic.txt download-limit-diagnostic.txt
git add download-limit-diagnostic.txt
git commit -m 'Record download limit code diagnosis [skip ci]' || true
git push || true
