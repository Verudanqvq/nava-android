import hashlib,struct,sys,zipfile
from pathlib import Path

RES_STRING_POOL_TYPE=0x0001
RES_XML_START_ELEMENT_TYPE=0x0102
OLD_VERSION='12.1.57';NEW_VERSION='12.1.58';NEW_CODE=74
SOURCE_SHA='f99a7e9449fa7ac0875ab9b9bcd319d10a20108f7837e22f169708f5c059d4eb'
BASE_MARK='/* Nava Android 12.1.57 — integrated picker footer + strict duplicate blocking. */'
NEW_MARK='/* Nava Android 12.1.58 — logical duplicate blocking + grouped queue controls. */'
UX_MARK='/* Nava Android 12.1.58 — grouped volume queue + notification clear + offline refresh. */'
CSS_MARK='/* Nava Android 12.1.58 — grouped queue, clear-notification, offline refresh UI. */'

OLD_DOWNLOADED="function downloaded(){var m={};try{var j=JSON.parse(w.NavaOffline.listDownloads()||'{}');(j.items||[]).forEach(function(x){var u=canon(x&&x.url);if(u)m[u]=1})}catch(_){}try{var q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');if(Array.isArray(q))q.forEach(function(x){var u=canon(x&&x.url),s=clean(x&&x.status,30).toLowerCase();if(u&&s!=='error')m[u]=1})}catch(_){}return m}"
NEW_DOWNLOADED="""function logicalKey(x){x=x||{};var kind=clean(x.kind,30).toLowerCase(),st=clean(x.seriesTitle,500),tt=clean(x.title,500),vn=volumeNo(st+' '+tt),cn=chapterNo(tt+' '+st),base=norm(st.replace(/\\s+(?:cilt|volume|vol\\.?)\\s*\\d+(?:\\.\\d+)?(?:\\s.*)?$/i,''));if(!base)return'';if(kind==='volume'&&vn)return'v|'+base+'|'+vn;if(kind==='chapter'&&vn&&cn)return'c|'+base+'|'+vn+'|'+cn;return''}function downloaded(){var m={};try{var j=JSON.parse(w.NavaOffline.listDownloads()||'{}');(j.items||[]).forEach(function(x){var u=canon(x&&x.url),k=logicalKey(x);if(u)m[u]=1;if(k)m['k:'+k]=1})}catch(_){}try{var q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');if(Array.isArray(q))q.forEach(function(x){var u=canon(x&&x.url),k=logicalKey(x),s=clean(x&&x.status,30).toLowerCase();if(s!=='error'){if(u)m[u]=1;if(k)m['k:'+k]=1}})}catch(_){}return m}"""
OLD_VOLUME="var v=picked[i],vu=canon(v.postUrl);if(vu&&!seen[vu]){seen[vu]=1;all.push({url:vu,title:'Cilt '+v.volumeNo,seriesTitle:info.title+' Cilt '+v.volumeNo,kind:'volume'});volumeCount++}"
NEW_VOLUME="var v=picked[i],vu=canon(v.postUrl),vi={url:vu,title:'Cilt '+v.volumeNo,seriesTitle:info.title+' Cilt '+v.volumeNo,kind:'volume'},vk=logicalKey(vi);if(vu&&!seen[vu]&&(!vk||!seen['k:'+vk])){seen[vu]=1;if(vk)seen['k:'+vk]=1;all.push(vi);volumeCount++}"
OLD_CHAPTER="got.forEach(function(x){var u=canon(x.url);if(u&&!seen[u]){seen[u]=1;all.push(x);chapterCount++}})"
NEW_CHAPTER="got.forEach(function(x){var u=canon(x.url),k=logicalKey(x);if(u&&!seen[u]&&(!k||!seen['k:'+k])){seen[u]=1;if(k)seen['k:'+k]=1;all.push(x);chapterCount++}})"

def u16(d,o): return struct.unpack_from('<H',d,o)[0]
def u32(d,o): return struct.unpack_from('<I',d,o)[0]
def p32(d,o,v): struct.pack_into('<I',d,o,v)
def len8(d,p):
    f=d[p];p+=1
    return ((((f&0x7f)<<8)|d[p],p+1) if f&0x80 else (f,p))
def len16(d,p):
    f=u16(d,p);p+=2
    return ((((f&0x7fff)<<16)|u16(d,p),p+2) if f&0x8000 else (f,p))
def pool(d,off):
    hs=u16(d,off+2);n=u32(d,off+8);flags=u32(d,off+16);ss=u32(d,off+20);utf8=bool(flags&0x100);out=[]
    for i in range(n):
        p=off+ss+u32(d,off+hs+i*4)
        if utf8:
            _,p=len8(d,p);bl,p=len8(d,p);out.append(bytes(d[p:p+bl]).decode('utf-8','replace'))
        else:
            ln,p=len16(d,p);out.append(bytes(d[p:p+ln*2]).decode('utf-16le','replace'))
    return out

def patch_manifest(raw):
    d=bytearray(raw);before=bytes(d)
    d[:]=d.replace(OLD_VERSION.encode(),NEW_VERSION.encode())
    d[:]=d.replace(OLD_VERSION.encode('utf-16le'),NEW_VERSION.encode('utf-16le'))
    if bytes(d)==before: raise ValueError('versionName marker missing')
    off=u16(d,2);total=u32(d,4);strings=None;done=False
    while off+8<=min(total,len(d)):
        typ=u16(d,off);hs=u16(d,off+2);size=u32(d,off+4)
        if size<8: raise ValueError('bad manifest chunk')
        if typ==RES_STRING_POOL_TYPE and strings is None: strings=pool(d,off)
        elif typ==RES_XML_START_ELEMENT_TYPE and strings:
            ext=off+hs;idx=u32(d,ext+4);elem=strings[idx] if idx<len(strings) else ''
            if elem=='manifest':
                ast=u16(d,ext+8);asz=u16(d,ext+10);ac=u16(d,ext+12);base=ext+ast
                for i in range(ac):
                    a=base+i*asz;ni=u32(d,a+4);name=strings[ni] if ni<len(strings) else ''
                    if name=='versionCode': p32(d,a+16,NEW_CODE);done=True
                break
        off+=size
    if not done: raise ValueError('versionCode missing')
    return bytes(d)

def oldsig(name):
    u=name.upper();leaf=u.rsplit('/',1)[-1]
    return u.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))

def once(s,a,b,label):
    if a not in s: raise ValueError('missing patch point: '+label)
    return s.replace(a,b,1)

def main():
    if len(sys.argv)!=5: raise SystemExit('usage: patch-apk.py SRC UX_JS CSS OUT')
    src,uxf,cssf,out=sys.argv[1:]
    srcp=Path(src);got=hashlib.sha256(srcp.read_bytes()).hexdigest()
    if got.lower()!=SOURCE_SHA: raise ValueError('source must be signed Nava 12.1.57; sha256='+got)
    ux=Path(uxf).read_text(encoding='utf-8');cssfix=Path(cssf).read_text(encoding='utf-8')
    if UX_MARK not in ux or CSS_MARK not in cssfix: raise ValueError('12.1.58 source marker missing')
    with zipfile.ZipFile(srcp) as zin:
        req={'AndroidManifest.xml','classes.dex','assets/nava_app_v11.js','assets/nava_app_v11.css'}
        if not req.issubset(set(zin.namelist())): raise ValueError('required apk entries missing')
        manifest=patch_manifest(zin.read('AndroidManifest.xml'))
        dex=zin.read('classes.dex')
        if b'NavaAndroidApp/12.1.47' not in dex: raise ValueError('known-good 12.1.47 UA missing')
        if any(v in dex for v in (b'NavaAndroidApp/12.1.57',b'NavaAndroidApp/12.1.58')): raise ValueError('native UA unexpectedly changed')
        js=zin.read('assets/nava_app_v11.js').decode('utf-8')
        css=zin.read('assets/nava_app_v11.css').decode('utf-8')
        if BASE_MARK not in js: raise ValueError('12.1.57 runtime base missing')
        js=once(js,BASE_MARK,NEW_MARK,'runtime marker')
        js=js.replace('__navaPersistentDownloadV12157','__navaPersistentDownloadV12158')
        canon_point="u.hash='';u.protocol='https:';"
        canon_count=js.count(canon_point)
        if canon_count<2: raise ValueError('expected canonical URL patch points')
        js=js.replace(canon_point,"u.hash='';u.search='';u.protocol='https:';")
        js=once(js,OLD_DOWNLOADED,NEW_DOWNLOADED,'logical downloaded/queue dedupe')
        js=once(js,OLD_VOLUME,NEW_VOLUME,'logical volume dedupe')
        js=once(js,OLD_CHAPTER,NEW_CHAPTER,'logical chapter dedupe')
        js=js.rstrip()+'\n\n'+ux.strip()+'\n'
        css=css.rstrip()+'\n\n'+cssfix.strip()+'\n'
        with zipfile.ZipFile(out,'w') as zout:
            for info in zin.infolist():
                if oldsig(info.filename): continue
                data=zin.read(info.filename)
                if info.filename=='AndroidManifest.xml': data=manifest
                elif info.filename=='classes.dex': data=dex
                elif info.filename=='assets/nava_app_v11.js': data=js.encode('utf-8')
                elif info.filename=='assets/nava_app_v11.css': data=css.encode('utf-8')
                zout.writestr(info,data)
    with zipfile.ZipFile(out) as z:
        fj=z.read('assets/nava_app_v11.js').decode('utf-8');fc=z.read('assets/nava_app_v11.css').decode('utf-8');fd=z.read('classes.dex')
        for token in (NEW_MARK,'__navaPersistentDownloadV12158','logicalKey','u.search=','__navaUxV12158','renderGroups','ensureNotificationClear','ensureOfflineRefresh'):
            if token not in fj: raise ValueError('final JS token missing '+token)
        if CSS_MARK not in fc or 'nava-download-progress-v12158' not in fc: raise ValueError('final CSS missing')
        if b'NavaAndroidApp/12.1.47' not in fd or b'NavaAndroidApp/12.1.58' in fd: raise ValueError('native UA preservation failed')
    print('PATCH_OK versionName=12.1.58 versionCode=74 base=12.1.57 nativeUA=12.1.47 dedupe=query-plus-logical queue=grouped notification=clear-all offline=refresh')

if __name__=='__main__': main()
