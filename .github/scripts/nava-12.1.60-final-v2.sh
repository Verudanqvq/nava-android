#!/usr/bin/env bash
set -euo pipefail
TMP=/tmp/nava-12.1.60-final-fixed.sh
cp .github/scripts/nava-12.1.60-final.sh "$TMP"
python - "$TMP" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')
old="grep -aq 'NavaAndroidApp/12.1.47' /tmp/Nava.apk"
new="unzip -p /tmp/Nava.apk classes.dex | grep -aq 'NavaAndroidApp/12.1.47'"
if old not in s:
    raise SystemExit('expected final UA gate not found')
s=s.replace(old,new,1)
s=s.replace("# Final semantic check: z5/MainActivity stay the same, e00 is now direct HTTPS.\n", "printf 'pre_final_semantic=ok\\n' >> \"$STATUS\"\n# Final semantic check: z5/MainActivity stay the same, e00 is now direct HTTPS.\n",1)
p.write_text(s,encoding='utf-8')
PY
chmod +x "$TMP"
exec bash "$TMP"
