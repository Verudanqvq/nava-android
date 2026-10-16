#!/usr/bin/env bash
set -euo pipefail
mkdir -p /tmp/diag
gh release download v12.2.24 --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/diag
unzip -p /tmp/diag/Nava.apk assets/offline.html > /tmp/offline.html
unzip -p /tmp/diag/Nava.apk assets/nava_app_v11.js > /tmp/app.js
python - <<'PY' > /tmp/nava-limit-diag.txt
from pathlib import Path
import re
for name in ('/tmp/offline.html','/tmp/app.js'):
 s=Path(name).read_text(errors='replace')
 print('===== FILE',name,'BYTES',len(s),'=====')
 for pat in (r'.{0,180}(?:0\.1|storageLimit|downloadLimit|limitGb|limitGB|storage limit|İndirme sınırı|GB).{0,350}',):
  matches=list(re.finditer(pat,s,re.I|re.S))
  print('MATCHES',len(matches))
  for m in matches[:100]: print(re.sub(r'\s+',' ',m.group(0))[:650])
PY
cat /tmp/nava-limit-diag.txt
cp /tmp/nava-limit-diag.txt nava-limit-diagnostic.txt
git config user.name 'Nava Diagnosis Bot'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add nava-limit-diagnostic.txt
git commit -m 'Record offline download limit inspection [skip ci]' || true
git push || true
