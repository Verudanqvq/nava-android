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

old='''        if (strNormalizeMime.startsWith("image/") || strNormalizeMime.equals("text/css") || strNormalizeMime.startsWith("font/") || strNormalizeMime.contains("font-woff") || strNormalizeMime.contains("font-ttf")) {
            return true;
        }
        return str2.toLowerCase(Locale.ROOT).matches(".*\\.(?:png|jpe?g|gif|webp|svg|avif|css|woff2?|ttf|otf)(?:\\?.*)?$");'''
new='''        if (strNormalizeMime.startsWith("image/") || strNormalizeMime.equals("text/css")) {
            return true;
        }
        return str2.toLowerCase(Locale.ROOT).matches(".*\\.(?:png|jpe?g|gif|webp|svg|avif|css)(?:\\?.*)?$");'''
if s.count(old)!=1:
    raise ValueError('69 allowedResource patch point count='+str(s.count(old)))
s=s.replace(old,new,1)

for token in ('MAX_RESOURCES = 220','skipResource63','submitBatch63','seriesRelations63','clearQuery()'):
    if token not in s:
        raise ValueError('69 inherited runtime token missing '+token)
if '(?:stylesheet|icon)' in s or 'woff2?' in s or '|ttf|otf' in s or 'startsWith("font/")' in s:
    raise ValueError('69 storage trim incomplete')

Path(sys.argv[2]).write_text(s,encoding='utf-8')
print('OFFLINE_RUNTIME_69_SOURCE_PATCH_OK icons=skip fonts=skip css=keep images=keep cap=220')
