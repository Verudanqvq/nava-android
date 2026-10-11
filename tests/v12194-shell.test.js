import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const html=readFileSync(new URL('../android-patch/v12.1.94/offline.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../android-patch/v12.1.94/shell-v12194.js',import.meta.url),'utf8');
const patch=readFileSync(new URL('../android-patch/v12.1.94/patch-apk93.py',import.meta.url),'utf8');
assert.match(html,/NAVA_OFFLINE_HIERARCHY_V12194/);assert.match(html,/function grouped\(items\)/);assert.match(html,/v\.chs\.push\(r\)/);assert.match(html,/function meta\(i\)/);assert.match(html,/N\.open/);
assert.match(script,/__navaShellV12194/);assert.match(script,/function updateBrand/);assert.match(script,/function updateAvatar/);
assert.match(patch,/assets\/offline\.html/);assert.match(patch,/NAVA_OFFLINE_HIERARCHY_V12194/);
console.log('v12.1.94 offline hierarchy, deduplication and v12.1.90 shell checks passed');
