from pathlib import Path
import sys

if len(sys.argv)!=3:
    raise SystemExit('usage: patch-offline-runtime69.py INPUT.java OUTPUT.java')
s=Path(sys.argv[1]).read_text(encoding='utf-8')

# Favicon/app icons and downloaded webfonts add storage but are not required
# for readable offline chapters. Keep CSS + all image formats unchanged.
if s.count('(?:stylesheet|icon)') != 2:
    raise ValueError('69 link selector patch point count='+str(s.count('(?:stylesheet|icon)')))
s=s.replace('(?:stylesheet|icon)','stylesheet')

font_mime=' || strNormalizeMime.startsWith("font/") || strNormalizeMime.contains("font-woff") || strNormalizeMime.contains("font-ttf")'
if s.count(font_mime)!=1:
    raise ValueError('69 font mime patch point count='+str(s.count(font_mime)))
s=s.replace(font_mime,'',1)

font_ext='|woff2?|ttf|otf'
if s.count(font_ext)!=1:
    raise ValueError('69 font extension patch point count='+str(s.count(font_ext)))
s=s.replace(font_ext,'',1)

for token in ('MAX_RESOURCES = 220','skipResource63','submitBatch63','seriesRelations63','clearQuery()'):
    if token not in s:
        raise ValueError('69 inherited runtime token missing '+token)
if '(?:stylesheet|icon)' in s or 'woff2?' in s or '|ttf|otf' in s or 'startsWith("font/")' in s:
    raise ValueError('69 storage trim incomplete')
if 'strNormalizeMime.startsWith("image/") || strNormalizeMime.equals("text/css")' not in s:
    raise ValueError('69 css/image preservation missing')

Path(sys.argv[2]).write_text(s,encoding='utf-8')
print('OFFLINE_RUNTIME_69_SOURCE_PATCH_OK icons=skip fonts=skip css=keep images=keep cap=220')
