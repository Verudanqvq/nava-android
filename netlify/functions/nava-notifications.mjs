import { spawn } from 'node:child_process';
import path from 'node:path';

function runNode(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: process.env,
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
  const script = path.join(process.cwd(), 'notification-backend', 'scan.mjs');
  await runNode(script);
  return new Response('ok', { status: 200 });
};

export const config = {
  schedule: '* * * * *'
};
