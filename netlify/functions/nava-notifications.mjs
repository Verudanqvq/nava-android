import { spawn } from 'node:child_process';
import path from 'node:path';

function runNode(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (stdout.trim()) console.log(stdout.trim());
      if (stderr.trim()) console.error(stderr.trim());
      if (code === 0) resolve();
      else reject(new Error(`scanner exited ${code}`));
    });
  });
}

export default async () => {
  const firebaseServiceAccount = Netlify.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!firebaseServiceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT Netlify runtime env eksik.');
  }

  const script = path.join(process.cwd(), 'notification-backend', 'scan.mjs');
  await runNode(script, {
    ...process.env,
    FIREBASE_SERVICE_ACCOUNT: firebaseServiceAccount,
    NAVA_TRIGGER: 'netlify-scheduled'
  });
};

export const config = {
  schedule: '*/5 * * * *'
};
