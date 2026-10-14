import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
let content;
try {
  content = await readFile('.env.local', 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  content = await readFile('.env.example', 'utf8');
}
let changed = false;
for (const [name, bytes] of [
  ['SESSION_SECRET', 32],
  ['APP_PASSWORD', 18],
]) {
  const pattern = new RegExp(`^${name}=(.*)$`, 'm');
  const existing = content.match(pattern)?.[1]?.trim();
  if (existing && existing !== '""' && existing !== "''") continue;
  const line = `${name}=${randomBytes(bytes).toString('hex')}`;
  content = pattern.test(content) ? content.replace(pattern, line) : content + '\n' + line + '\n';
  changed = true;
}
if (changed) {
  await writeFile('.env.local', content, { mode: 0o600 });
  console.log(
    'Created missing local security settings. Existing settings and secrets were preserved.',
  );
} else console.log('Security settings already exist. Nothing changed.');
console.log(
  'Open .env.local to find APP_PASSWORD. Restart Relay and use that password to sign in.',
);
console.log(
  'For Neon Postgres: copy its Connect URL into DATABASE_URL, then run npm run db:migrate. No local database installation is needed.',
);
