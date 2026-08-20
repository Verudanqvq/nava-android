from pathlib import Path
import re,sys

NEW_UA='NavaAndroidApp/12.1.43'

def main():
    if len(sys.argv)!=2: raise SystemExit('usage: patch-smali.py DECODED_DIR')
    root=Path(sys.argv[1]); smali=root/'smali'
    mainf=smali/'com/verudanava/nava/MainActivity.smali'
    service=smali/'com/verudanava/nava/NavaFirebaseMessagingService.smali'
    for f in (mainf,service):
        if not f.is_file(): raise ValueError('missing '+str(f))
    rx=re.compile(r'NavaAndroidApp/\d+\.\d+\.\d+')
    total=0
    for f in smali.rglob('*.smali'):
        t=f.read_text(errors='replace')
        t,n=rx.subn(NEW_UA,t);total+=n
        f.write_text(t)
    if total<1: raise ValueError('UA marker missing')
    mt=mainf.read_text(errors='replace');st=service.read_text(errors='replace')
    if 'NavaDirectNotification;->ensure' not in mt: raise ValueError('startup notification hook missing')
    if 'NavaDirectNotification;->handle' not in st: raise ValueError('FCM direct hook missing')
    if 'nava_follower_releases_v4' not in st: raise ValueError('v4 channel marker missing')
    print(f'SMALI_PATCH_OK ua=12.1.43 replacements={total} hooks=preserved')

if __name__=='__main__': main()
