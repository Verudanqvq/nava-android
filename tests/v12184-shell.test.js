import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../android-patch/v12.1.84/shell-v12184.js', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../android-patch/v12.1.84/shell-v12184.css', import.meta.url), 'utf8');

assert.match(script, /window\.fetch\(url, \{ credentials: 'same-origin', cache: 'force-cache' \}\)/);
assert.match(script, /link\.addEventListener\('pointerdown', function\(\) \{ warm\(link\); \}/);
assert.doesNotMatch(script, /attributeFilter/);
assert.match(script, /nava-nav-profile-image-v12184/);
assert.match(stylesheet, /--nava-bg:#f4f7fb/);
assert.match(stylesheet, /--nava-accent:#456f9d/);
assert.doesNotMatch(stylesheet, /#ef233c/);
assert.match(stylesheet, /overflow-x:clip/);
console.log('v12.1.84 shell checks passed');
