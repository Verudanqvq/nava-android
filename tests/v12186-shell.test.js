import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../android-patch/v12.1.86/shell-v12186.js', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../android-patch/v12.1.86/shell-v12186.css', import.meta.url), 'utf8');

assert.match(script, /hint\\.rel = 'prefetch'/);
assert.match(script, /timeout: 450/);
assert.match(script, /links\(\)\.forEach\(function\(link\) \{ warm\(link\); \}\)/);
assert.doesNotMatch(script, /setTimeout\(next, 300\)/);
assert.match(script, /nava-nav-profile-image-v12186/);
assert.match(stylesheet, /--nava-bg:#f4f7fb/);
assert.match(stylesheet, /--nava-accent:#456f9d/);
assert.doesNotMatch(stylesheet, /#ef233c/);
assert.match(stylesheet, /overflow-x:clip/);
console.log('v12.1.86 shell checks passed');
