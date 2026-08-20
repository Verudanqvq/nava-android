from pathlib import Path
import re,sys

NEW_UA='NavaAndroidApp/12.1.37'
OLD_CHANNEL='nava_follower_releases_v3'
NEW_CHANNEL='nava_follower_releases_v4'

def main():
    if len(sys.argv)!=2: raise SystemExit('usage: patch-smali.py DECODED_DIR')
    root=Path(sys.argv[1]); smali=root/'smali'
    main=smali/'com/verudanava/nava/MainActivity.smali'
    service=smali/'com/verudanava/nava/NavaFirebaseMessagingService.smali'
    for f in (main,service):
        if not f.is_file(): raise ValueError('missing '+str(f))

    ua_total=0; channel_total=0
    rx=re.compile(r'NavaAndroidApp/\d+\.\d+\.\d+')
    for f in smali.rglob('*.smali'):
        t=f.read_text(errors='replace')
        t,n=rx.subn(NEW_UA,t); ua_total+=n
        n2=t.count(OLD_CHANNEL)
        if n2:
            t=t.replace(OLD_CHANNEL,NEW_CHANNEL); channel_total+=n2
        f.write_text(t)
    if ua_total<1: raise ValueError('UA marker missing')
    if channel_total<2: raise ValueError(f'channel replacements too low: {channel_total}')

    mt=main.read_text(errors='replace')
    anchor='    invoke-static {p0}, Lcom/verudanava/nava/NavaNotificationRepair;->ensure(Landroid/content/Context;)V\n'
    if mt.count(anchor)!=1: raise ValueError(f'startup repair anchor count={mt.count(anchor)}')
    hook=anchor+'\n    invoke-static {p0}, Lcom/verudanava/nava/NavaDirectNotification;->ensure(Landroid/content/Context;)V\n'
    mt=mt.replace(anchor,hook,1)
    main.write_text(mt)

    st=service.read_text(errors='replace')
    pat=re.compile(r'(\.method public final c\(Lp50;\)V\s+\.(?:locals|registers)\s+\d+\s*)')
    direct='''\n    invoke-static {p0, p1}, Lcom/verudanava/nava/NavaDirectNotification;->handle(Landroid/content/Context;Ljava/lang/Object;)V\n\n    return-void\n\n'''
    st,n=pat.subn(lambda m:m.group(1)+direct,st,count=1)
    if n!=1: raise ValueError(f'FCM receive c(Lp50;) hook count={n}')
    service.write_text(st)

    final_main=main.read_text(errors='replace'); final_service=service.read_text(errors='replace')
    if 'NavaDirectNotification;->ensure' not in final_main: raise ValueError('startup ensure missing')
    if 'NavaDirectNotification;->handle' not in final_service: raise ValueError('FCM direct handle missing')
    # The direct handler must be the first executable action in the receive method.
    p=final_service.find('.method public final c(Lp50;)V')
    q=final_service.find('.end method',p)
    head=final_service[p:q]
    if head.find('NavaDirectNotification;->handle')<0 or head.find('return-void',head.find('NavaDirectNotification;->handle'))<0:
        raise ValueError('direct receive return missing')
    alltext=''.join(p.read_text(errors='replace') for p in smali.rglob('*.smali'))
    if OLD_CHANNEL in alltext: raise ValueError('old channel remains')
    if NEW_UA not in alltext or NEW_CHANNEL not in alltext: raise ValueError('new markers missing')
    print(f'SMALI_PATCH_OK ua=12.1.37 channel=v4 replacements={channel_total} direct_fcm=cLp50 startup_self_test=1')

if __name__=='__main__': main()
