from pathlib import Path
import re,sys

NEW_UA='NavaAndroidApp/12.1.36'
OLD_CHANNEL='nava_follower_releases_v2'
NEW_CHANNEL='nava_follower_releases_v3'
OLD_PREF='nava_notif_permission_v12129'
NEW_PREF='nava_notif_permission_v12136'

def one(text,old,new,label):
    n=text.count(old)
    if n!=1: raise ValueError(f'{label} count={n}')
    return text.replace(old,new,1)

def main():
    if len(sys.argv)!=2: raise SystemExit('usage: patch-smali.py DECODED_DIR')
    root=Path(sys.argv[1]); smali=root/'smali'
    main=smali/'com/verudanava/nava/MainActivity.smali'
    repair=smali/'com/verudanava/nava/NavaNotificationRepair.smali'
    if not main.is_file(): raise ValueError('MainActivity.smali missing')
    if not repair.is_file(): raise ValueError('NavaNotificationRepair.smali missing')

    rx=re.compile(r'NavaAndroidApp/\d+\.\d+\.\d+')
    ua_total=0; channel_total=0
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
    mt=one(mt,OLD_PREF,NEW_PREF,'notification permission preference')
    anchor='    invoke-static {p0}, Lc00;->a(Landroid/content/ContextWrapper;)V\n'
    hook=anchor+'\n    invoke-static {p0}, Lcom/verudanava/nava/NavaNotificationRepair;->ensure(Landroid/content/Context;)V\n'
    mt=one(mt,anchor,hook,'notification repair startup hook')
    main.write_text(mt)

    rt=repair.read_text(errors='replace')
    if NEW_CHANNEL not in rt or 'APP_NOTIFICATION_SETTINGS' not in rt or 'areNotificationsEnabled' not in rt:
        raise ValueError('repair helper incomplete')
    final=''.join(p.read_text(errors='replace') for p in smali.rglob('*.smali'))
    if OLD_CHANNEL in final or OLD_PREF in final: raise ValueError('stale notification marker remains')
    if NEW_CHANNEL not in final or NEW_PREF not in final or NEW_UA not in final: raise ValueError('final notification markers missing')
    if 'NavaNotificationRepair;->ensure' not in main.read_text(errors='replace'): raise ValueError('repair hook missing')
    print(f'SMALI_PATCH_OK ua=12.1.36 channel=v3 channel_replacements={channel_total} permission_key=12.1.36 repair=settings-fallback')

if __name__=='__main__': main()
