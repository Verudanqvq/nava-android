#!/usr/bin/env bash
set -euo pipefail
STATUS=/tmp/status226.txt
: > "$STATUS"
printf 'status=running\nstarted=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap 'rc=$?; if [ "$rc" -ne 0 ] && ! grep -q "^status=success$" "$STATUS"; then printf "status=failed\nfinished=%s\n" "$(date -u +%FT%TZ)" >> "$STATUS"; fi; exit "$rc"' EXIT

SOURCE_TAG=v12.2.25
TARGET_TAG=v12.2.26
EXPECTED_SOURCE_SHA256=56e0cd69ce96917f3c03ffa847213c7fad22e435ee521aae2087574605afe9e8
EXPECTED_CERT_SHA256=acde7cf216852448a8a8277fe4bf11eac183394e6b34a862b124e693d51d09fe

mkdir -p /tmp/current
gh release download "$SOURCE_TAG" --repo "$GITHUB_REPOSITORY" --pattern Nava.apk --dir /tmp/current
GOT="$(sha256sum /tmp/current/Nava.apk | cut -d' ' -f1)"
test "$GOT" = "$EXPECTED_SOURCE_SHA256"
printf 'source_apk=ok\nsource_sha256=%s\n' "$GOT" >> "$STATUS"

BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
BADGING="$("$BUILD_TOOLS/aapt" dump badging /tmp/current/Nava.apk)"
printf '%s\n' "$BADGING" | grep -q "versionName='12.2.25'"
SOURCE_CODE="$(printf '%s\n' "$BADGING" | sed -n "s/.*versionCode='\([0-9][0-9]*\)'.*/\1/p" | head -1)"
test -n "$SOURCE_CODE"
TARGET_CODE="$((SOURCE_CODE + 5))"
printf 'source_version_code=%s\ntarget_version_code=%s\n' "$SOURCE_CODE" "$TARGET_CODE" >> "$STATUS"

# Recover the existing production signing key exactly as prior Nava release builds do.
set +x
export NAVA_KDF_SECRET="$(printf '%s' "$FIREBASE_SERVICE_ACCOUNT" | sha256sum | cut -d' ' -f1)"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -in .github/nava-signing/private.pem.enc -out /tmp/nava-private.pem -pass env:NAVA_KDF_SECRET
unset NAVA_KDF_SECRET
openssl pkeyutl -decrypt -inkey /tmp/nava-private.pem -in android-signing/key-material.enc -out /tmp/key-material.bin -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256
python - <<'PY'
from pathlib import Path
d=Path('/tmp/key-material.bin').read_bytes()
assert len(d)==48
Path('/tmp/aes-key').write_text(d[:32].hex())
Path('/tmp/aes-iv').write_text(d[32:].hex())
PY
openssl enc -d -aes-256-cbc -K "$(cat /tmp/aes-key)" -iv "$(cat /tmp/aes-iv)" -in android-signing/signing-payload.enc -out /tmp/signing.zip
mkdir -p /tmp/nava-signing
unzip -q /tmp/signing.zip -d /tmp/nava-signing
rm -f /tmp/nava-private.pem /tmp/key-material.bin /tmp/aes-key /tmp/aes-iv /tmp/signing.zip
printf 'signing_material=ok\n' >> "$STATUS"

# Use the existing native source and add one persistent, shared download-limit preference.
git show "$SOURCE_TAG:android-patch/v12.1.59/native-source/OfflineRuntime.java.txt" > /tmp/OfflineRuntime.java
python - <<'PY'
from pathlib import Path
p=Path('/tmp/OfflineRuntime.java')
s=p.read_text(encoding='utf-8')
old='webView.loadDataWithBaseURL("https://www.verudanava.com/__nava_offline_downloads__/#settings", html, "text/html", "UTF-8", null);'
new='webView.loadDataWithBaseURL("https://www.verudanava.com/__nava_offline_downloads__/", html, "text/html", "UTF-8", null);'
assert s.count(old)==1, 'expected exactly one Downloads route'
s=s.replace(old,new,1)
bridge='''        @JavascriptInterface
        public long getStorageLimitBytes() {
            long value = OfflineRuntime.prefs(this.context).getLong("storageLimitBytes", 2147483648L);
            return Math.max(1073741824L, Math.min(214748364800L, value));
        }

        @JavascriptInterface
        public void setStorageLimitBytes(long bytes) {
            long value = Math.max(1073741824L, Math.min(214748364800L, bytes));
            OfflineRuntime.prefs(this.context).edit().putLong("storageLimitBytes", value).apply();
        }

'''
anchor='''        @JavascriptInterface
        public boolean isDownloaded(String str) {'''
assert s.count(anchor)==1
s=s.replace(anchor,bridge+anchor,1)
guard='''        if (prefs(context).getBoolean("wifiOnly", true) && !onWifi(context)) {
            throw new Exception("Yalnız Wi‑Fi indirmesi açık.");
        }
'''
guard2=guard+'''        long storageLimit = Math.max(1073741824L, Math.min(214748364800L, prefs(context).getLong("storageLimitBytes", 2147483648L)));
        if (folderSize(root(context)) >= storageLimit) {
            throw new Exception("İndirme sınırına ulaşıldı. Profildeki indirme sınırını artır.");
        }
'''
assert s.count(guard)==1
s=s.replace(guard,guard2,1)
p.write_text(s,encoding='utf-8')
print('SHARED_NATIVE_DOWNLOAD_LIMIT_OK default=2GB min=1GB max=200GB')
PY
python android-patch/v12.1.59/fix-jadx-compile.py /tmp/OfflineRuntime.java
printf 'source_patch=shared_native_download_limit\n' >> "$STATUS"

# Patch both UIs to use the same native preference and remove the false 0.1 GB fallback.
unzip -p /tmp/current/Nava.apk assets/offline.html > /tmp/offline.html
unzip -p /tmp/current/Nava.apk assets/nava_app_v11.js > /tmp/nava_app_v11.js
python - <<'PY'
from pathlib import Path
p=Path('/tmp/offline.html')
s=p.read_text(encoding='utf-8')
repls=[]
for old,new in repls:
 if s.count(old)!=1: raise SystemExit('offline.html expected exactly one occurrence: '+old+' found '+str(s.count(old)))
 s=s.replace(old,new,1)
if s.count('maxGb=200')!=2: raise SystemExit('expected both offline maxGb caps')
s=s.replace('maxGb=200','maxGb=Math.max(1,Math.min(200,Math.floor(freeBytes/1073741824)))',1)
s=s.replace('maxGb=200','maxGb=Math.max(1,Math.min(200,Math.floor(free/1073741824)))',1)
p.write_text(s,encoding='utf-8')
p=Path('/tmp/nava_app_v11.js')
s=p.read_text(encoding='utf-8')
old="var n=Math.max(1,Math.min(200,Math.floor(Number(cap.value)||gb())))"
new="var s=state(),max=Math.max(1,Math.min(200,Math.floor(s.free/1073741824))),n=Math.max(1,Math.min(max,Math.floor(Number(cap.value)||gb())))"
assert s.count(old)==1
s=s.replace(old,new,1)
import re
s, changed = re.subn(r"cap\\.max\\s*=\\s*(['\\\"]?)200\\1", "cap.max=String(Math.max(1,Math.min(200,Math.floor(state().free/1073741824))))", s, count=1)
assert changed==1, 'expected one cap.max=200 assignment, changed '+str(changed)
p.write_text(s,encoding='utf-8')
print('OFFLINE_SETTINGS_FIX_OK shared native value; whole-GB cap bounded by free storage')
PY

ANDROID_JAR="$(find "$ANDROID_HOME/platforms" -name android.jar | sort -V | tail -1)"
mkdir -p /tmp/javac223 /tmp/newdex223 /tmp/mini223
javac -encoding UTF-8 -source 8 -target 8 -cp "$ANDROID_JAR" -d /tmp/javac223 /tmp/OfflineRuntime.java
mapfile -t CLASSES < <(find /tmp/javac223/com/verudanava/nava -name 'OfflineRuntime*.class' -type f | sort)
test "${#CLASSES[@]}" -ge 5
"$BUILD_TOOLS/d8" --lib "$ANDROID_JAR" --min-api 26 --output /tmp/newdex223 "${CLASSES[@]}"
unzip -p /tmp/current/Nava.apk AndroidManifest.xml > /tmp/mini223/AndroidManifest.xml
cp /tmp/newdex223/classes.dex /tmp/mini223/classes.dex
(cd /tmp/mini223 && zip -q /tmp/mini223.apk AndroidManifest.xml classes.dex)
curl -fsSL -o /tmp/apktool.jar https://github.com/iBotPeaches/Apktool/releases/download/v2.11.1/apktool_2.11.1.jar
java -jar /tmp/apktool.jar d -f -r /tmp/mini223.apk -o /tmp/mini223-dec >/tmp/apktool-mini223.log
java -jar /tmp/apktool.jar d -f -r /tmp/current/Nava.apk -o /tmp/base223-dec >/tmp/apktool-base223.log
test -d /tmp/base223-dec/smali_classes2/com/verudanava/nava
rm -f /tmp/base223-dec/smali_classes2/com/verudanava/nava/OfflineRuntime*.smali
cp /tmp/mini223-dec/smali/com/verudanava/nava/OfflineRuntime*.smali /tmp/base223-dec/smali_classes2/com/verudanava/nava/
java -jar /tmp/apktool.jar b /tmp/base223-dec -o /tmp/rebuilt223.apk >/tmp/apktool-build223.log
unzip -p /tmp/rebuilt223.apk classes2.dex > /tmp/classes2-223.dex
printf 'native_source_compile=ok\nclasses2_rebuild=ok\n' >> "$STATUS"

# Patch only AndroidManifest.xml and classes2.dex into the original APK; preserve every other payload.
python - /tmp/current/Nava.apk /tmp/classes2-223.dex /tmp/Nava-unsigned.apk "$SOURCE_CODE" "$TARGET_CODE" <<'PY'
import struct, sys, zipfile
from pathlib import Path
src, dex, out = map(Path, sys.argv[1:4])
old_code, new_code = int(sys.argv[4]), int(sys.argv[5])
def u16(d,o): return struct.unpack_from('<H',d,o)[0]
def u32(d,o): return struct.unpack_from('<I',d,o)[0]
def p32(d,o,v): struct.pack_into('<I',d,o,v)
def length8(d,o):
    x=d[o]; return ((x&127,1) if not x&128 else (((x&127)<<8)|d[o+1],2))
def length16(d,o):
    x=u16(d,o); return ((x&32767,2) if not x&32768 else (((x&32767)<<16)|u16(d,o+2),4))
def pool(d,off):
    hs=u16(d,off+2); n=u32(d,off+8); flags=u32(d,off+16); ss=u32(d,off+20); utf8=bool(flags&256); items=[]
    for i in range(n):
        p=off+ss+u32(d,off+hs+i*4)
        if utf8:
            _,a=length8(d,p); bl,b=length8(d,p+a); start=p+a+b; val=bytes(d[start:start+bl]).decode('utf-8')
            items.append((val,start,bl,True))
        else:
            ln,a=length16(d,p); start=p+a; val=bytes(d[start:start+ln*2]).decode('utf-16le')
            items.append((val,start,ln*2,False))
    return items
with zipfile.ZipFile(src) as zin:
    data=bytearray(zin.read('AndroidManifest.xml'))
    if u16(data,0)!=3: raise ValueError('manifest is not binary AXML')
    off=u16(data,2); string_pool=None
    while off+8<=len(data):
        size=u32(data,off+4)
        if size<8 or off+size>len(data): raise ValueError('invalid AXML chunk')
        if u16(data,off)==1: string_pool=off; break
        off+=size
    if string_pool is None: raise ValueError('string pool missing')
    strings=pool(data,string_pool); versions=[x for x in strings if x[0]=='12.2.25']
    if len(versions)!=1: raise ValueError('expected one versionName 12.2.18')
    _,start,nbytes,utf8=versions[0]; replacement='12.2.26'.encode('utf-8' if utf8 else 'utf-16le')
    if len(replacement)!=nbytes: raise ValueError('versionName byte length changed')
    data[start:start+nbytes]=replacement
    count=0; off=u16(data,2)
    while off+8<=len(data):
        typ,size=u16(data,off),u32(data,off+4)
        if size<8 or off+size>len(data): raise ValueError('invalid AXML chunk')
        if typ==0x0102:
            ext=off+16; ast=u16(data,ext+8); asz=u16(data,ext+10); total=u16(data,ext+12); begin=ext+ast
            for i in range(total):
                a=begin+i*asz; ni=u32(data,a+4)
                if ni<len(strings) and strings[ni][0]=='versionCode':
                    if data[a+15]!=0x10 or u32(data,a+16)!=old_code: raise ValueError('unexpected source versionCode')
                    p32(data,a+16,new_code); count+=1
        off+=size
    if count!=1: raise ValueError('expected exactly one versionCode')
    with zipfile.ZipFile(out,'w') as zout:
        for info in zin.infolist():
            up=info.filename.upper(); leaf=up.rsplit('/',1)[-1]
            if up.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC'))): continue
            if info.filename=='AndroidManifest.xml': payload=bytes(data)
            elif info.filename=='classes2.dex': payload=dex.read_bytes()
            elif info.filename=='assets/offline.html': payload=Path('/tmp/offline.html').read_bytes()
            elif info.filename=='assets/nava_app_v11.js': payload=Path('/tmp/nava_app_v11.js').read_bytes()
            else: payload=zin.read(info.filename)
            zout.writestr(info,payload)
with zipfile.ZipFile(out) as z, zipfile.ZipFile(src) as original:
    assert z.read('classes2.dex')==dex.read_bytes()
    assert b'NavaAndroidApp/12.1.47' in z.read('classes.dex')
    assert z.read('resources.arsc')==original.read('resources.arsc')
    assert z.read('assets/nava_app_v11.js')==Path('/tmp/nava_app_v11.js').read_bytes()
    assert z.read('assets/nava_app_v11.css')==original.read('assets/nava_app_v11.css')
    assert z.read('assets/offline.html')==Path('/tmp/offline.html').read_bytes()
print(f'APK_PATCH_OK versionName=12.2.26 versionCode={new_code}; only manifest/classes2 and the two download-limit assets changed')
PY

"$BUILD_TOOLS/zipalign" -f -p 4 /tmp/Nava-unsigned.apk /tmp/Nava-aligned.apk
PROP=/tmp/nava-signing/keystore.properties
export NAVA_STORE_PASS="$(sed -n 's/^storePassword=//p' "$PROP" | tr -d '\r' | head -1)"
export NAVA_KEY_PASS="$(sed -n 's/^keyPassword=//p' "$PROP" | tr -d '\r' | head -1)"
KEY_ALIAS="$(sed -n 's/^keyAlias=//p' "$PROP" | tr -d '\r' | head -1)"
"$BUILD_TOOLS/apksigner" sign --ks /tmp/nava-signing/signing/nava-release.jks --ks-key-alias "$KEY_ALIAS" --ks-pass env:NAVA_STORE_PASS --key-pass env:NAVA_KEY_PASS --out /tmp/Nava.apk /tmp/Nava-aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs /tmp/Nava.apk > /tmp/verify223.txt
CERT=$(grep -i -m1 "certificate SHA-256 digest:" /tmp/verify223.txt | sed -E "s/.*digest:[[:space:]]*//" | tr -d ":[:space:]" | tr "[:upper:]" "[:lower:]")
test "$CERT" = "$EXPECTED_CERT_SHA256"
"$BUILD_TOOLS/aapt" dump badging /tmp/Nava.apk | grep -q "versionCode='${TARGET_CODE}'.*versionName='12.2.26'"
APK_SHA="$(sha256sum /tmp/Nava.apk | cut -d' ' -f1)"
printf 'zipalign=ok\nsigning=ok\ncert_sha256=%s\napk_sha256=%s\n' "$CERT" "$APK_SHA" >> "$STATUS"

if gh release view "$TARGET_TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  echo "$TARGET_TAG already exists; refusing to overwrite an existing release" >&2
  exit 1
fi
NOTES="12.2.26: Cihazın toplam ve boş depolama bilgileri yeniden gösterilir. İndirme sınırı cihazdaki boş alana göre tam GB olarak sınırlandırılır; ondalıklı değer girilemez. Çevrimiçi ve çevrimdışı ekranlar ortak sınırı kullanmaya devam eder."
gh release create "$TARGET_TAG" /tmp/Nava.apk#Nava.apk --repo "$GITHUB_REPOSITORY" --title "Nava 12.2.26" --notes "$NOTES" --latest --target 253b2ebd07053153d5b155ff834f50f055daa44a
printf 'release=v12.2.26\nasset=Nava.apk\nstatus=success\nfinished=%s\n' "$(date -u +%FT%TZ)" >> "$STATUS"
trap - EXIT
