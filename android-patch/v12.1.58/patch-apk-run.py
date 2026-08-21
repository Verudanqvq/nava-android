import importlib.util
from pathlib import Path

path=Path(__file__).with_name('patch-apk.py')
spec=importlib.util.spec_from_file_location('nava_patch_12158',path)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
mod.NEW_DOWNLOADED="""function logicalKey(x){x=x||{};var kind=clean(x.kind,30).toLowerCase(),st=clean(x.seriesTitle,500),tt=clean(x.title,500),vn=volumeNo(st+' '+tt),cn=chapterNo(tt+' '+st),base=norm(st.replace(/\s+(?:cilt|volume|vol\.?)\s*\d+(?:\.\d+)?(?:\s.*)?$/i,''));if(!base)return'';if(kind==='volume'&&vn)return'v|'+base+'|'+vn;if(kind==='chapter'&&vn&&cn)return'c|'+base+'|'+vn+'|'+cn;return''}function downloaded(){var m={};try{var j=JSON.parse(w.NavaOffline.listDownloads()||'{}');(j.items||[]).forEach(function(x){var u=canon(x&&x.url),k=logicalKey(x);if(u)m[u]=1;if(k)m['k:'+k]=1})}catch(_){}try{var q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');if(Array.isArray(q))q.forEach(function(x){var u=canon(x&&x.url),k=logicalKey(x),s=clean(x&&x.status,30).toLowerCase();if(s!=='error'){if(u)m[u]=1;if(k)m['k:'+k]=1}})}catch(_){}return m}"""
mod.main()
