from pathlib import Path
import sys

OLD_UA='NavaAndroidApp/12.1.33'
NEW_UA='NavaAndroidApp/12.1.34'
BLOCK='/blogger-live/'

def replace_once(text, old, new, label):
    n=text.count(old)
    if n!=1:
        raise ValueError(f'{label} count={n}')
    return text.replace(old,new,1)

def main():
    if len(sys.argv)!=2:
        raise SystemExit('usage: patch-smali.py DECODED_DIR')
    root=Path(sys.argv[1]); smali=root/'smali'; gx=smali/'gx.smali'
    if not gx.is_file(): raise ValueError('gx.smali missing')

    ua_total=0
    for f in smali.rglob('*.smali'):
        t=f.read_text(errors='replace')
        n=t.count(f'"{OLD_UA}"')
        if n:
            t=t.replace(f'"{OLD_UA}"',f'"{NEW_UA}"')
            f.write_text(t)
            ua_total+=n
    if ua_total<1: raise ValueError('UA marker missing')

    text=gx.read_text()
    anchor='''    :cond_9\n    if-eqz p2, :cond_16\n'''
    injected='''    :cond_9\n    if-eqz p2, :nava_loader_continue_v12134\n\n    invoke-interface {p2}, Landroid/webkit/WebResourceRequest;->getUrl()Landroid/net/Uri;\n\n    move-result-object v0\n\n    if-eqz v0, :nava_loader_continue_v12134\n\n    invoke-virtual {v0}, Landroid/net/Uri;->toString()Ljava/lang/String;\n\n    move-result-object v1\n\n    const-string v0, "/blogger-live/"\n\n    invoke-virtual {v1, v0}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z\n\n    move-result v0\n\n    if-nez v0, :cond_42\n\n    :nava_loader_continue_v12134\n    if-eqz p2, :cond_16\n'''
    text=replace_once(text,anchor,injected,'gx loader intercept anchor')
    gx.write_text(text)

    verify=gx.read_text()
    if BLOCK not in verify or ':nava_loader_continue_v12134' not in verify:
        raise ValueError('loader blocker verify failed')
    all_text=''.join(p.read_text(errors='replace') for p in smali.rglob('*.smali'))
    if OLD_UA in all_text or NEW_UA not in all_text:
        raise ValueError('UA verify failed')
    print(f'SMALI_PATCH_OK loader_block={BLOCK} ua_replacements={ua_total} ua={NEW_UA}')

if __name__=='__main__': main()
