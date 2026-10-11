import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../android-patch/v12.1.88/shell-v12188.js', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../android-patch/v12.1.88/shell-v12188.css', import.meta.url), 'utf8');

assert.match(script, /prefetch/);
assert.match(script, /timeout: 450/);
assert.match(script, /__navaShellV12187/);
assert.match(script, /nava-nav-profile-image-v12188/);
assert.match(stylesheet, /#e8f1fc/);
assert.doesNotMatch(stylesheet, /\.is-pending/);
assert.match(script, /timeout: 180/);
assert.doesNotMatch(script, /classList\.add\('is-pending'\)/);
assert.match(stylesheet, /border-radius:22px/);
assert.match(stylesheet, /padding-bottom:calc\(100px/);
assert.match(stylesheet, /text-overflow:ellipsis/);
assert.match(stylesheet, /object-fit:cover/);
assert.match(stylesheet, /max-width:25%/);
assert.doesNotMatch(stylesheet, /#ef233c|#ff0000/);
console.log('v12.1.88 bottom bar checks passed');
