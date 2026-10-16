#!/usr/bin/env bash
set -euo pipefail
mkdir -p /tmp/diag
gh release download v12.2.26 --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/diag
unzip -p /tmp/diag/Nava.apk assets/offline.html > /tmp/offline.html
unzip -p /tmp/diag/Nava.apk assets/nava_app_v11.js > /tmp/app.js
python - <<'PY' > /tmp/nava-limit-diag.txt
from pathlib import Path
import re
for name in ('/tmp/offline.html','/tmp/app.js'):
 s=Path(name).read_text(errors='replace')
 print('===== FILE',name,'BYTES',len(s),'=====')
 for term in ('setting-cap','storageAvailableBytes','navigator.storage','getStorageInfo','totalBytes','freeBytes','storageLimit','freeSpace','availableBytes','maxGb','function state','function gb','downloadCap'):
  hits=[m.start() for m in re.finditer(re.escape(term),s,re.I)]
  if hits:
   print('\nTERM',term,'COUNT',len(hits))
   for at in hits[:5]:
    print(re.sub(r'\\s+',' ',s[max(0,at-500):min(len(s),at+900)])[:1400])
PY
cat /tmp/nava-limit-diag.txt
cp /tmp/nava-limit-diag.txt nava-limit-diagnostic.txt
git config user.name 'Nava Diagnosis Bot'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add nava-limit-diagnostic.txt
git commit -m 'Record offline download limit inspection [skip ci]' || true
git push || true
