import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const html=readFileSync(new URL('../android-patch/v12.1.92/offline.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../android-patch/v12.1.92/shell-v12192.js',import.meta.url),'utf8');
const patch=readFileSync(new URL('../android-patch/v12.1.92/patch-apk92.py',import.meta.url),'utf8');
assert.match(html,/NAVA_OFFLINE_HIERARCHY_V12192/);assert.match(html,/function grouped\(items\)/);assert.match(html,/v\.chs\.push\(r\)/);assert.match(html,/getSeriesRelations/);assert.match(html,/N\.open/);
assert.match(script,/data-nava-custom-avatar/);assert.doesNotMatch(script,/function updateBrand/);assert.doesNotMatch(script,/updateBrand\(\)/);
assert.match(patch,/assets\/offline\.html/);assert.match(patch,/actual offline screen replaced/);
console.log('v12.1.92 actual offline hierarchy and image preservation checks passed');
