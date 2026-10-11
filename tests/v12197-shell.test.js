import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const html=readFileSync(new URL('../android-patch/v12.1.97/offline.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../android-patch/v12.1.97/shell-v12197.js',import.meta.url),'utf8');
const patch=readFileSync(new URL('../android-patch/v12.1.97/patch-apk96.py',import.meta.url),'utf8');
assert.match(html,/NAVA_OFFLINE_HIERARCHY_V12197/);assert.match(html,/function stripAll/);assert.match(html,/storage-used/);assert.match(html,/storage-bar/);assert.match(html,/empty-icon/);assert.match(html,/Eserleri keşfet/);assert.match(html,/Eserleri keşfet/);assert.match(html,/storage-used/);assert.match(html,/storage-bar/);assert.match(html,/empty-icon/);assert.match(html,/Eserleri keşfet/);assert.match(html,/function grouped\(items\)/);assert.match(html,/v\.chs\.push\(r\)/);assert.match(html,/function meta\(i\)/);assert.match(html,/N\.open/);
assert.match(script,/__navaShellV12197/);assert.match(script,/function updateBrand/);assert.match(script,/function updateAvatar/);
assert.match(patch,/assets\/offline\.html/);assert.match(patch,/NAVA_OFFLINE_HIERARCHY_V12197/);
console.log('v12.1.97 downloads screen and hierarchy checks passed');
