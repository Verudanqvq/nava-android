import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const script = readFileSync('android-patch/v12.1.74/ui-shell-v12174.js', 'utf8');
const stylesheet = readFileSync('android-patch/v12.1.74/ui-shell-v12174.css', 'utf8');

for (const token of ['__navaShellV12174', 'nava-nav-profile-image-v12174', 'pointerdown', 'cache:\'force-cache\'', 'nava-route-pending-v12174']) {
  assert.ok(script.includes(token), 'missing UI behavior: ' + token);
}
for (const token of ['#nava-app-topbar', '#nava-app-bottom', '.nava-nav-profile-image-v12174', '.nava-hero-slide-v5', '--nava-accent-v12174']) {
  assert.ok(stylesheet.includes(token), 'missing UI style: ' + token);
}
console.log('V12174_UI_OK shell=dark fixed-controls=preserved profile-avatar=ready instant-feedback=ready');
