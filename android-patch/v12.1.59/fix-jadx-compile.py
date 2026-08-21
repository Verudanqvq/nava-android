from pathlib import Path
import sys

if len(sys.argv)!=2:
    raise SystemExit('usage: fix-jadx-compile.py FILE.java')
p=Path(sys.argv[1]);s=p.read_text(encoding='utf-8')

def once(a,b,label):
    global s
    if a not in s: raise ValueError('missing JADX compile patch point: '+label)
    s=s.replace(a,b,1)

once('''        String strStripFragment;\n        String strCanonicalNava;\n        String str;\n''','''        String strStripFragment = "";\n        String strCanonicalNava = null;\n        String str = null;\n''','intercept locals')
once('''        JSONArray jSONArrayOptJSONArray;\n        try {\n            jSONArrayOptJSONArray = jSONObject.optJSONArray("items");\n''','''        JSONArray jSONArrayOptJSONArray = null;\n        try {\n            jSONArrayOptJSONArray = jSONObject.optJSONArray("items");\n''','itemFor local')
once('''        Fetch fetch;\n        String strCanonicalNava = canonicalNava(str);\n''','''        Fetch fetch = null;\n        String strCanonicalNava = canonicalNava(str);\n''','resource fetch local')
once('''                    if (!allowedResource(fetch.contentType, str5)) {\n''','''                    if (fetch == null) {\n                        i = i3;\n                        length = j;\n                        continue;\n                    }\n                    if (!allowedResource(fetch.contentType, str5)) {\n''','failed resource fetch continue')

p.write_text(s,encoding='utf-8')
print('JADX_COMPILE_FIX_59_OK')
