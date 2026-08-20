from pathlib import Path
import re,sys

NEW_UA='NavaAndroidApp/12.1.35'
CHANNEL='nava_follower_releases_v2'

def one(text,old,new,label):
    n=text.count(old)
    if n!=1: raise ValueError(f'{label} count={n}')
    return text.replace(old,new,1)

def main():
    if len(sys.argv)!=2: raise SystemExit('usage: patch-smali.py DECODED_DIR')
    root=Path(sys.argv[1]); smali=root/'smali'
    main=smali/'com/verudanava/nava/MainActivity.smali'
    c00=smali/'c00.smali'
    service=smali/'com/verudanava/nava/NavaFirebaseMessagingService.smali'
    for f in (main,c00,service):
        if not f.is_file(): raise ValueError(f'missing {f}')

    rx=re.compile(r'NavaAndroidApp/\d+\.\d+\.\d+')
    total=0
    for f in smali.rglob('*.smali'):
        t=f.read_text(errors='replace'); t,n=rx.subn(NEW_UA,t)
        if n: f.write_text(t); total+=n
    if total<1: raise ValueError('UA marker missing')

    mt=main.read_text()
    anchor='    invoke-static {p0, v1}, Lcom/verudanava/nava/OfflineRuntime;->attach(Landroid/content/Context;Landroid/webkit/WebView;)V\n'
    mt=one(mt,anchor,anchor+'\n    invoke-static {p0}, Lc00;->a(Landroid/content/ContextWrapper;)V\n','startup channel hook')
    main.write_text(mt)

    ct=c00.read_text(errors='replace'); st=service.read_text(errors='replace')
    if CHANNEL not in ct or CHANNEL not in st: raise ValueError('channel missing')
    p=ct.find('const-string v1, "Takip edilen eserler"')
    if p<0 or 'const/4 v2, 0x4' not in ct[p:p+500]: raise ValueError('channel importance not high')
    if 'Lc00;->a(Landroid/content/ContextWrapper;)V' not in main.read_text(): raise ValueError('startup channel missing')
    print('SMALI_PATCH_OK startup_channel=1 channel=v2 importance=high ua=12.1.35')

if __name__=='__main__': main()
