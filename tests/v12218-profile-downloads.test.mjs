import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const patch = readFileSync('android-patch/v12.1.99/patch-apk99.py', 'utf8');
const shell = readFileSync('android-patch/v12.1.99/shell-v12199.js', 'utf8');
const css = readFileSync('android-patch/v12.1.99/shell-v12199.css', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');

test('downloaded-content button preserves the WebView library route', () => {
  assert.match(patch, /Keep the WebView's downloaded-content browser as the destination/);
  assert.match(patch, /open_library_old="function openLibrary\(\)\{hideHub\(\);if\(typeof w\.navaOpenDownloads==='function'\)w\.navaOpenDownloads\(\);else status\('İndirilenler açılamadı\.',true\)\}"/);
  assert.doesNotMatch(patch, /open_library_new=.*NavaOffline\.openDownloads/);
});

test('unified download settings are injected only on the owner profile', () => {
  assert.match(shell, /function root\(\)\{if\(new URLSearchParams\(w\.location\.search\)\.get\('u'\)\)return null;var r=d\.querySelector\('\.nava-profile-app'\)/);
  assert.match(shell, /nava-profile-download-settings-12218/);
});

test('membership card is an admin-controlled visibility flag, not a membership implementation', () => {
  assert.match(shell, /store\.collection\('appConfig'\)\.doc\(CONFIG\)/);
  assert.match(shell, /store\.collection\('staff'\)\.doc\(uid\)/);
  assert.match(shell, /'Üyelik özellikleri hazırlanıyor\.'/);
  assert.match(css, /nava-membership-card-12218/);
  assert.match(rules, /match \/appConfig\/\{configId\}[\s\S]*allow read: if configId == 'membership';[\s\S]*allow create, update, delete: if isAdmin\(\);/);
});
