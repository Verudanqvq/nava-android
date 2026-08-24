from pathlib import Path
import sys
if len(sys.argv)!=3: raise SystemExit('usage: patch-language-variants73.py INPUT.js OUTPUT.js')
s=Path(sys.argv[1]).read_text(encoding='utf-8')
old="""function chapterAnchors(root){root=root||d;var seen=new Set(),out=[];[].slice.call(root.querySelectorAll('#clwd a[href],#chapters a[href],[data-nava-chapter-list] a[href],.eplister a[href],#nava-reader-chapters-v9 a[href]')).forEach(function(a){var u=canon(a.href),row=rowFor(a),text=clean((row||a).textContent,900),n=chapterNo(clean(a.textContent,250)+' '+text),v=volumeNo(text);if(!u||!n||seen.has(u))return;seen.add(u);out.push({a:a,row:row,url:u,no:n,volume:v,lang:map[u]||''})});return out}"""
new=r'''function chapterAnchors(root){
 root=root||d;var seen=new Set(),out=[];
 var anchors=[].slice.call(root.querySelectorAll('a[href]'));
 anchors.forEach(function(a){
  var u=canon(a.href);if(!u||seen.has(u))return;
  var row=rowFor(a),label=clean(a.textContent,300),aria=clean(a.getAttribute('aria-label'),300),title=clean(a.getAttribute('title'),300),rowText=clean((row||a).textContent,1200);
  var probe=[label,aria,title,rowText,u].join(' '),n=chapterNo(probe),v=volumeNo(probe);
  if(!n)return;
  if(!/^https:\/\/(?:www\.)?verudanava\.com\//i.test(u))return;
  if(!/(?:bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*[0-9]+(?:\.[0-9]+)?/i.test(probe))return;
  seen.add(u);out.push({a:a,row:row||a,url:u,no:n,volume:v,lang:map[u]||''});
 });
 out.sort(function(a,b){
  var av=a.volume!==''&&isFinite(Number(a.volume))?Number(a.volume):999999,bv=b.volume!==''&&isFinite(Number(b.volume))?Number(b.volume):999999;
  if(av!==bv)return av-bv;
  var ac=a.no!==''&&isFinite(Number(a.no))?Number(a.no):999999,bc=b.no!==''&&isFinite(Number(b.no))?Number(b.no):999999;
  return ac-bc;
 });
 return out;
}'''
if s.count(old)!=1: raise ValueError('chapterAnchors patch point count='+str(s.count(old)))
s=s.replace(old,new,1)
Path(sys.argv[2]).write_text(s,encoding='utf-8')
print('LANGUAGE_VARIANTS_73_PATCH_OK generic-anchor-scan=numeric-sort=all-chapters-preserved')
