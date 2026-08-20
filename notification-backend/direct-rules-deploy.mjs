import fs from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const PROJECT_ID = 'nava-01';
const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
if (!raw.trim()) throw new Error('FIREBASE_SERVICE_ACCOUNT missing');
const sa = JSON.parse(raw);
if (sa.project_id !== PROJECT_ID) throw new Error('Wrong Firebase project');

initializeApp({ credential: cert(sa), projectId: PROJECT_ID });
const source = fs.readFileSync('firestore.rules', 'utf8');
const rules = getSecurityRules();

const released = await rules.releaseFirestoreRulesetFromSource(source);
const active = await rules.getFirestoreRuleset();

console.log(JSON.stringify({
  ok: true,
  createdRuleset: released.name,
  activeRuleset: active.name,
  projectId: PROJECT_ID
}));

if (!released?.name || !active?.name || released.name !== active.name) {
  throw new Error('Firestore rules release verification mismatch');
}
console.log('FIRESTORE_RULES_DIRECT_DEPLOY_OK');
