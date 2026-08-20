from pathlib import Path
import re,sys

NEW_UA='NavaAndroidApp/12.1.38'

def main():
    if len(sys.argv)!=2: raise SystemExit('usage: patch-smali.py DECODED_DIR')
    root=Path(sys.argv[1]); smali=root/'smali'
    main=smali/'com/verudanava/nava/MainActivity.smali'
    service=smali/'com/verudanava/nava/NavaFirebaseMessagingService.smali'
    for f in (main,service):
        if not f.is_file(): raise ValueError('missing '+str(f))
    rx=re.compile(r'NavaAndroidApp/\d+\.\d+\.\d+')
    total=0
    for f in smali.rglob('*.smali'):
        t=f.read_text(errors='replace');t,n=rx.subn(NEW_UA,t);total+=n;f.write_text(t)
    if total<1: raise ValueError('UA marker missing')
    mt=main.read_text(errors='replace');st=service.read_text(errors='replace')
    if 'NavaDirectNotification;->ensure' not in mt: raise ValueError('startup direct notification hook missing')
    if 'NavaDirectNotification;->handle' not in st: raise ValueError('FCM direct notification hook missing')
    if 'nava_follower_releases_v4' not in st: raise ValueError('v4 channel marker missing')
    alltext=''.join(p.read_text(errors='replace') for p in smali.rglob('*.smali'))
    if NEW_UA not in alltext: raise ValueError('new UA missing')
    print(f'SMALI_PATCH_OK ua=12.1.38 replacements={total} direct_fcm=preserved channel=v4')

if __name__=='__main__': main()
