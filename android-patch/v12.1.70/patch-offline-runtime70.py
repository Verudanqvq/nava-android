from pathlib import Path
import sys

if len(sys.argv)!=3:
    raise SystemExit('usage: patch-offline-runtime70.py INPUT.java OUTPUT.java')
s=Path(sys.argv[1]).read_text(encoding='utf-8')
old1='OfflineRuntime.submitBatch63(this.context, arr.toString(), null);'
old2='OfflineRuntime.submitBatch63(this.context, str, null);'
if s.count(old1)!=1:
    raise ValueError('70 single-download service patch point count='+str(s.count(old1)))
if s.count(old2)!=1:
    raise ValueError('70 batch service patch point count='+str(s.count(old2)))
s=s.replace(old1,'NavaDownloadService70.enqueue(this.context, arr.toString());',1)
s=s.replace(old2,'NavaDownloadService70.enqueue(this.context, str);',1)
for token in ('submitBatch63','Nava:OfflineDownload63','seriesRelations63','MAX_RESOURCES = 220','skipResource63'):
    if token not in s:
        raise ValueError('70 inherited runtime token missing '+token)
if s.count('NavaDownloadService70.enqueue(')!=2:
    raise ValueError('70 service routing incomplete')
Path(sys.argv[2]).write_text(s,encoding='utf-8')
print('OFFLINE_RUNTIME_70_SOURCE_PATCH_OK route=foreground-service inherited63=ok')
