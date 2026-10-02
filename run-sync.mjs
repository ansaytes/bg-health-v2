import fs from 'fs';
import { execSync } from 'child_process';

const env = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
env.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length > 0) {
    envVars[key.trim()] = val.join('=').trim().replace(/(^"|"$)/g, '');
  }
});

envVars.FORCE_FRESH = 'false';
envVars.SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;

try {
  execSync('node scripts/sync-employees.mjs', { env: { ...process.env, ...envVars }, stdio: 'inherit' });
} catch (e) {
  console.error(e);
}
