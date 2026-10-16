import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('current release metadata and retired release automation stay consistent', () => {
  const readme = read('README.md');
  const legacyWorkflow = read('.github/workflows/nava-android-12-1-91.yml');

  assert.match(readme, /Current stable Android release: \*\*12\.2\.31\*\* \(`versionCode 174`\)/);
  assert.match(readme, /45768a3b6672c9307657fd6d38466c40855229ef89203e57adc35af23a741a41/);
  assert.match(legacyWorkflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(legacyWorkflow, /^\s+push:/m);
});
