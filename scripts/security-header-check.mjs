import fs from 'node:fs';

const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const globalHeaders = vercel.headers?.find((item) => item.source === '/(.*)')?.headers ?? [];
const permissions = globalHeaders.find((header) => header.key.toLowerCase() === 'permissions-policy')?.value ?? '';

if (!permissions.includes('microphone=(self)')) {
  console.error('SECURITY HEADER CHECK FAILED: el PTT necesita microphone=(self) en Permissions-Policy.');
  process.exit(1);
}

if (permissions.includes('microphone=()')) {
  console.error('SECURITY HEADER CHECK FAILED: microphone=() bloquearía el PTT de la operadora y el conductor.');
  process.exit(1);
}

console.log('Central GO Permissions-Policy PTT check: OK');
