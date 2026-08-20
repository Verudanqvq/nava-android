from pathlib import Path
import re
import sys

OLD_CHANNEL='nava_follower_releases'
NEW_CHANNEL='nava_follower_releases_v2'

def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1: raise ValueError(f'{label} count={count}')
    return text.replace(old,new,1)

def main():
    if len(sys.argv)!=2: raise SystemExit('usage: patch-smali.py DECODED_DIR')
    root=Path(sys.argv[1]); smali=root/'smali'
    main=smali/'com/verudanava/nava/MainActivity.smali'; gx=smali/'gx.smali'; c00=smali/'c00.smali'
    for f in (main,gx,c00):
        if not f.is_file(): raise ValueError(f'missing {f}')

    mt=main.read_text()
    hook='    invoke-virtual {v1, v6}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V\n'
    attach=hook+'\n    invoke-static {p0, v1}, Lcom/verudanava/nava/OfflineRuntime;->attach(Landroid/content/Context;Landroid/webkit/WebView;)V\n'
    mt=replace_once(mt,hook,attach,'MainActivity WebViewClient hook')
    main.write_text(mt)

    gt=gx.read_text()
    pat=re.compile(r'(\.method public final shouldInterceptRequest\(Landroid/webkit/WebView;Landroid/webkit/WebResourceRequest;\)Landroid/webkit/WebResourceResponse;\s+\.(?:locals|registers)\s+\d+\s*)')
    bridge='''\n    iget-object v0, p0, Lgx;->a:Lcom/verudanava/nava/MainActivity;\n\n    invoke-static {v0, p2}, Lcom/verudanava/nava/OfflineRuntime;->intercept(Landroid/content/Context;Landroid/webkit/WebResourceRequest;)Landroid/webkit/WebResourceResponse;\n\n    move-result-object v0\n\n    if-eqz v0, :nava_offline_continue_v12131\n\n    return-object v0\n\n    :nava_offline_continue_v12131\n\n'''
    gt,count=pat.subn(lambda m:m.group(1)+bridge,gt,count=1)
    if count!=1: raise ValueError(f'gx intercept method count={count}')
    gx.write_text(gt)

    changed=[]; total=0
    for f in smali.rglob('*.smali'):
        t=f.read_text(errors='replace'); n=t.count(f'"{OLD_CHANNEL}"')
        if n:
            t=t.replace(f'"{OLD_CHANNEL}"',f'"{NEW_CHANNEL}"'); f.write_text(t); total+=n; changed.append(str(f.relative_to(root)))
    if total!=2: raise ValueError(f'notification channel replacements={total}')

    ct=c00.read_text(); marker='const-string v1, "Takip edilen eserler"'; pos=ct.find(marker)
    if pos<0: raise ValueError('channel name marker missing')
    tail=ct[pos:pos+700]; old='const/4 v2, 0x3'
    if old not in tail: raise ValueError('channel importance marker missing')
    tail=tail.replace(old,'const/4 v2, 0x4',1); ct=ct[:pos]+tail+ct[pos+700:]; c00.write_text(ct)

    if 'OfflineRuntime;->attach' not in main.read_text(): raise ValueError('attach missing')
    if 'OfflineRuntime;->intercept' not in gx.read_text(): raise ValueError('intercept missing')
    all_smali=''.join(p.read_text(errors='replace') for p in smali.rglob('*.smali'))
    if f'"{OLD_CHANNEL}"' in all_smali: raise ValueError('exact old channel remains')
    verify=c00.read_text(); p=verify.find(marker)
    if NEW_CHANNEL not in verify or 'const/4 v2, 0x4' not in verify[p:p+700]: raise ValueError('channel v2/high verify failed')
    print('SMALI_PATCH_OK attach=1 intercept=1 channel_replacements=%d channel=high files=%s' % (total,','.join(changed)))

if __name__=='__main__': main()
