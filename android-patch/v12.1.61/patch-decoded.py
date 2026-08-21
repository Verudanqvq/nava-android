from pathlib import Path
import re, shutil, sys

MARK_JS='/* Nava Android 12.1.61 — visible v9 notification clear/delete controls. */'
MARK_CSS='/* Nava Android 12.1.61 — startup and v9 notification UI. */'


def patch_style(path: Path):
    s=path.read_text(encoding='utf-8')
    m=re.search(r'(<style\s+name="Base\.Theme\.Nava"[^>]*>)(.*?)(</style>)',s,re.S)
    if not m:
        raise ValueError('Base.Theme.Nava not found')
    body=m.group(2)
    item='        <item name="android:windowBackground">#ffc6dafc</item>'
    if 'name="android:windowBackground"' in body:
        body=re.sub(r'<item\s+name="android:windowBackground">.*?</item>',item.strip(),body,count=1,flags=re.S)
    else:
        body='\n'+item+body
    s=s[:m.start()]+m.group(1)+body+m.group(3)+s[m.end():]
    path.write_text(s,encoding='utf-8')


def patch_v31(path: Path):
    if not path.exists():
        return
    s=path.read_text(encoding='utf-8')
    s=re.sub(r'(<item\s+name="android:windowSplashScreenBackground">).*?(</item>)',r'\1#ffc6dafc\2',s)
    s=re.sub(r'(<item\s+name="android:windowSplashScreenIconBackgroundColor">).*?(</item>)',r'\1#ffc6dafc\2',s)
    path.write_text(s,encoding='utf-8')


def patch_gx(path: Path):
    s=path.read_text(encoding='utf-8')
    marker=':nava61_reveal_done'
    if marker in s:
        return
    start=s.find('.method public final onPageFinished(Landroid/webkit/WebView;Ljava/lang/String;)V')
    if start<0:
        raise ValueError('gx onPageFinished missing')
    end=s.find('.end method',start)
    if end<0:
        raise ValueError('gx onPageFinished end missing')
    method=s[start:end]
    needle='invoke-super {p0, p1, p2}, Landroid/webkit/WebViewClient;->onPageFinished(Landroid/webkit/WebView;Ljava/lang/String;)V'
    pos=method.find(needle)
    if pos<0:
        raise ValueError('gx onPageFinished super call missing')
    insert=(needle+'\n\n'
            '    if-eqz p1, :nava61_reveal_done\n\n'
            '    const/4 v0, 0x0\n\n'
            '    invoke-virtual {p1, v0}, Landroid/webkit/WebView;->setVisibility(I)V\n\n'
            '    :nava61_reveal_done')
    method=method.replace(needle,insert,1)
    s=s[:start]+method+s[end:]
    path.write_text(s,encoding='utf-8')


def append_asset(path: Path, extra: Path, marker: str):
    base=path.read_text(encoding='utf-8')
    add=extra.read_text(encoding='utf-8').strip()
    if marker not in add:
        raise ValueError('source marker missing '+marker)
    if marker not in base:
        base=base.rstrip()+'\n\n'+add+'\n'
    path.write_text(base,encoding='utf-8')


def patch_apktool(path: Path):
    s=path.read_text(encoding='utf-8')
    s2=re.sub(r'(?m)^(\s*versionCode:\s*)["\']?76["\']?\s*$',r'\g<1>77',s,count=1)
    s2=re.sub(r'(?m)^(\s*versionName:\s*)["\']?12\.1\.60["\']?\s*$',r'\g<1>12.1.61',s2,count=1)
    if s2==s:
        # Some apktool builds quote/store these values differently; replace conservatively.
        s2=s.replace('versionCode: 76','versionCode: 77').replace("versionCode: '76'","versionCode: '77'")
        s2=s2.replace('versionName: 12.1.60','versionName: 12.1.61').replace("versionName: '12.1.60'","versionName: '12.1.61'")
    if '12.1.61' not in s2 or re.search(r'(?m)^\s*versionCode:\s*["\']?77["\']?',s2) is None:
        raise ValueError('apktool version patch failed')
    path.write_text(s2,encoding='utf-8')


def main():
    if len(sys.argv)!=6:
        raise SystemExit('usage: patch-decoded.py DECODED JS CSS OFFLINE LAYOUT')
    root=Path(sys.argv[1]); js=Path(sys.argv[2]); css=Path(sys.argv[3]); offline=Path(sys.argv[4]); layout=Path(sys.argv[5])
    patch_apktool(root/'apktool.yml')
    shutil.copyfile(layout,root/'res/layout/activity_main.xml')
    patch_style(root/'res/values/styles.xml')
    patch_v31(root/'res/values-v31/styles.xml')
    gx=next(iter(root.glob('smali*/gx.smali')),None)
    if gx is None: raise ValueError('gx.smali missing')
    patch_gx(gx)
    append_asset(root/'assets/nava_app_v11.js',js,MARK_JS)
    append_asset(root/'assets/nava_app_v11.css',css,MARK_CSS)
    shutil.copyfile(offline,root/'assets/offline.html')
    # Assertions before rebuild.
    finaljs=(root/'assets/nava_app_v11.js').read_text(encoding='utf-8')
    finalcss=(root/'assets/nava_app_v11.css').read_text(encoding='utf-8')
    finaloff=(root/'assets/offline.html').read_text(encoding='utf-8')
    finalgx=gx.read_text(encoding='utf-8')
    finallayout=(root/'res/layout/activity_main.xml').read_text(encoding='utf-8')
    if MARK_JS not in finaljs or 'nava-notification-clear-all-v12161' not in finaljs or 'nava-notification-delete-v12161' not in finaljs: raise ValueError('notification patch missing')
    if MARK_CSS not in finalcss: raise ValueError('61 css missing')
    if 'setInterval(probe,2500)' not in finaloff or 'Tekrar dene' not in finaloff: raise ValueError('offline probe missing')
    if ':nava61_reveal_done' not in finalgx or 'WebView;->setVisibility(I)V' not in finalgx: raise ValueError('gx reveal patch missing')
    if 'android:visibility="invisible"' not in finallayout or 'Yükleniyor…' not in finallayout: raise ValueError('startup layout missing')
    print('DECODED_PATCH_OK versionName=12.1.61 versionCode=77 startup=splash-until-page-finished offline=probe notification=v9-clear-delete')

if __name__=='__main__': main()
