import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../android-patch/v12.1.89/shell-v12189.js', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../android-patch/v12.1.89/shell-v12189.css', import.meta.url), 'utf8');
const apkPatch = readFileSync(new URL('../android-patch/v12.1.89/patch-apk89.py', import.meta.url), 'utf8');

assert.match(script, /prefetch/);
assert.match(script, /timeout: 180/);
assert.match(script, /__navaShellV12189/);
assert.match(script, /nava-nav-profile-image-v12189/);
assert.match(script, /nava-dragon-mark-v12189/);
assert.match(stylesheet, /#e8f1fc/);
assert.doesNotMatch(stylesheet, /\.is-pending/);
assert.doesNotMatch(script, /classList\.add\('is-pending'\)/);
assert.match(stylesheet, /border-radius:22px/);
assert.match(stylesheet, /padding-bottom:calc\(100px/);
assert.match(stylesheet, /bottom:calc\(2px \+ env\(safe-area-inset-bottom/);
assert.match(stylesheet, /text-overflow:ellipsis/);
assert.match(stylesheet, /object-fit:cover/);
assert.match(stylesheet, /max-width:25%/);
assert.match(stylesheet, /visibility:visible!important/);
assert.match(apkPatch, /preserve the current profile tab on entry/);
assert.doesNotMatch(stylesheet, /#ef233c|#ff0000/);
console.log('v12.1.89 shell, profile flicker, dragon brand and bottom bar checks passed');
