#!/usr/bin/env bash
set -euo pipefail
mkdir -p /tmp/nava-limit-diag
gh release download v12.2.23 --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/nava-limit-diag
unzip -p /tmp/nava-limit-diag/Nava.apk assets/nava_app_v11.js > /tmp/nava-limit-diag/app.js
python - <<'PY' > /tmp/download-limit-diagnostic.txt
from pathlib import Path
import re
s=Path('/tmp/nava-limit-diag/app.js').read_text(errors='replace')
print('ASSET_BYTES',len(s))
patterns=[
 r'.{0,180}(?:download.{0,30}limit|limit.{0,30}download).{0,260}',
 r'.{0,180}(?:storage.{0,30}limit|limit.{0,30}storage).{0,260}',
 r'.{0,180}(?:39\\.2321302|GB|gb|gigabyte).{0,260}',
 r'.{0,180}(?:range|type=["\\']range|step=).{0,220}'
]
for pat in patterns:
 print('--- PATTERN',pat)
 hits=list(re.finditer(pat,s,re.I|re.S))
 print('HITS',len(hits))
 for m in hits[:18]:
  print(re.sub(r'\\s+',' ',m.group(0))[:600])
print('--- NEAR LIMIT TOKENS')
for m in list(re.finditer(r'limit|storage|download.?size|size.?limit|quota',s,re.I))[:120]:
 print(re.sub(r'\\s+',' ',s[max(0,m.start()-100):min(len(s),m.end()+180)])[:360])
PY