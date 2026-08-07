import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const directory = '.operator-layout';
const archive = '/tmp/central-go-operator-layout.tar.xz';
const expectedHash = '079d5cb89f92a9f39f85647bbc7228053755662756635664b71fda1c84902a8b';

if (!existsSync(directory)) {
  console.error('No se encontró el nuevo diseño operativo.');
  process.exit(1);
}

const parts = readdirSync(directory)
  .filter((name) => /^part-\d+$/.test(name))
  .sort();

if (parts.length !== 2) {
  console.error(`Se esperaban 2 partes del diseño operativo y se encontraron ${parts.length}.`);
  process.exit(1);
}

const encoded = parts.map((name) => readFileSync(`${directory}/${name}`, 'utf8')).join('');
const buffer = Buffer.from(encoded, 'base64');
const actualHash = createHash('sha256').update(buffer).digest('hex');

if (actualHash !== expectedHash) {
  console.error('La verificación del diseño operativo no coincide.');
  process.exit(1);
}

writeFileSync(archive, buffer);
const result = spawnSync('tar', ['-xJf', archive], { stdio: 'inherit' });
if (result.status !== 0) {
  console.error('No se pudo aplicar el nuevo diseño operativo.');
  process.exit(result.status ?? 1);
}

const serviceWorkerPath = 'public/sw.js';
if (existsSync(serviceWorkerPath)) {
  const serviceWorker = readFileSync(serviceWorkerPath, 'utf8').replace(
    /const CACHE_NAME = '[^']+';/,
    "const CACHE_NAME = 'centralgo-operator-workspace-v1';"
  );
  writeFileSync(serviceWorkerPath, serviceWorker);
}

console.log('Nuevo espacio operativo de Central GO aplicado correctamente.');
