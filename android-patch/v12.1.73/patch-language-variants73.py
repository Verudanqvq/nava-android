from pathlib import Path
import sys

if len(sys.argv) != 3:
    raise SystemExit('usage: patch-language-variants73.py INPUT.js OUTPUT.js')

source = Path(sys.argv[1]).read_text(encoding='utf-8')
old = """function listAnchors(){var seen={},out=[];[].slice.call(d.querySelectorAll('#clwd a[href],#chapters a[href],[data-nava-chapter-list] a[href],.eplister a[href],#nava-reader-chapters-v9 a[href]')).forEach(function(a){var u=canon(a.href),rec=state.index.byUrl[u];if(!u||!rec||seen[u])return;seen[u]=1;out.push({a:a,row:rowFor(a),rec:rec})});return out}"""
new = """function listAnchors(){var seen={},out=[];[].slice.call(d.querySelectorAll('a[href]')).forEach(function(a){var u=canon(a.href),rec=state.index.byUrl[u];if(!u||!rec||seen[u])return;seen[u]=1;out.push({a:a,row:rowFor(a),rec:rec})});out.sort(function(a,b){var av=Number(a.rec.volumeNo),bv=Number(b.rec.volumeNo),ac=Number(a.rec.chapterNo),bc=Number(b.rec.chapterNo);if(isFinite(av)&&isFinite(bv)&&av!==bv)return av-bv;if(isFinite(ac)&&isFinite(bc)&&ac!==bc)return ac-bc;return 0});return out}"""

if 'NavaLanguageCoreV12168' not in source:
    raise ValueError('expected 12.1.68 language core missing')
if source.count(old) != 1:
    raise ValueError('listAnchors patch point count=' + str(source.count(old)))

Path(sys.argv[2]).write_text(
    source.replace(old, new, 1) + '\n/* LANGUAGE_VARIANTS_73_PATCH_OK */\n',
    encoding='utf-8',
)
print('LANGUAGE_VARIANTS_73_PATCH_OK generic-anchor-scan=numeric-sort=all-chapters-preserved')
