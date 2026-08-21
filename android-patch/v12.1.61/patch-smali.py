from pathlib import Path
import sys

MAIN_CALL='invoke-static {p0}, Lcom/verudanava/nava/StartupOverlay61;->install(Landroid/app/Activity;)V'
GX_CALL='invoke-static {v0}, Lcom/verudanava/nava/StartupOverlay61;->hide(Landroid/app/Activity;)V'


def patch_main(path: Path):
    s=path.read_text(encoding='utf-8')
    if MAIN_CALL in s:
        return
    needle='invoke-virtual {p0, v0}, Lz2;->setContentView(I)V'
    if needle not in s:
        raise ValueError('MainActivity setContentView call missing')
    s=s.replace(needle, needle+'\n\n    '+MAIN_CALL, 1)
    path.write_text(s, encoding='utf-8')


def patch_gx(path: Path):
    s=path.read_text(encoding='utf-8')
    if GX_CALL in s:
        return
    method='.method public final onPageFinished(Landroid/webkit/WebView;Ljava/lang/String;)V'
    start=s.find(method)
    if start < 0:
        raise ValueError('gx onPageFinished missing')
    end=s.find('.end method', start)
    if end < 0:
        raise ValueError('gx onPageFinished end missing')
    block=s[start:end]
    needle='invoke-super {p0, p1, p2}, Landroid/webkit/WebViewClient;->onPageFinished(Landroid/webkit/WebView;Ljava/lang/String;)V'
    if needle not in block:
        raise ValueError('gx onPageFinished super call missing')
    inject=(needle+'\n\n'
            '    iget-object v0, p0, Lgx;->a:Lcom/verudanava/nava/MainActivity;\n\n'
            '    '+GX_CALL)
    block=block.replace(needle, inject, 1)
    s=s[:start]+block+s[end:]
    path.write_text(s, encoding='utf-8')


def main():
    if len(sys.argv)!=2:
        raise SystemExit('usage: patch-smali.py DECODED')
    root=Path(sys.argv[1])
    mainp=next(iter(root.glob('smali*/com/verudanava/nava/MainActivity.smali')), None)
    gxp=next(iter(root.glob('smali*/gx.smali')), None)
    if mainp is None or gxp is None:
        raise ValueError('MainActivity/gx smali missing')
    patch_main(mainp)
    patch_gx(gxp)
    sm=mainp.read_text(encoding='utf-8'); sg=gxp.read_text(encoding='utf-8')
    if MAIN_CALL not in sm or GX_CALL not in sg:
        raise ValueError('startup calls missing after patch')
    print('SMALI_PATCH_OK startup=StartupOverlay61 install+hide resources=untouched')

if __name__=='__main__': main()
