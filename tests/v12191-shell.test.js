import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const script=readFileSync(new URL('../android-patch/v12.1.91/shell-v12191.js',import.meta.url),'utf8');
const patch=readFileSync(new URL('../android-patch/v12.1.91/patch-apk91.py',import.meta.url),'utf8');
assert.match(script,/nava-offline-hierarchy-v12191/);assert.match(script,/NavaOffline\.listDownloads/);assert.match(script,/nava-offline-series-v12191/);assert.match(script,/nava-offline-volume-v12191/);assert.match(script,/nava-offline-chapter-v12191/);assert.match(script,/preserve/);assert.match(patch,/native\/resource entry changed/);console.log('v12.1.91 offline hierarchy and APK preservation checks passed');
