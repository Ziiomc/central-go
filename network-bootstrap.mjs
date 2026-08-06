import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const overlayDirectory = '.network';
const overlayArchive = '/tmp/central-go-network-ui.tar.xz';
const expectedHash = '0dafa05c39176fbf1223f1f06ae8795e5f24512efb012f98682822790e2d8797';

if (!existsSync(overlayDirectory)) {
  console.error('No se encontró la interfaz Network de Central GO.');
  process.exit(1);
}

const parts = readdirSync(overlayDirectory)
  .filter((name) => /^part-\d+$/.test(name))
  .sort();

if (parts.length !== 6) {
  console.error(`Se esperaban 6 partes de la interfaz Network y se encontraron ${parts.length}.`);
  process.exit(1);
}

const encodedOverlay = parts
  .map((name) => readFileSync(`${overlayDirectory}/${name}`, 'utf8'))
  .join('');
const overlayBuffer = Buffer.from(encodedOverlay, 'base64');
const actualHash = createHash('sha256').update(overlayBuffer).digest('hex');

if (actualHash !== expectedHash) {
  console.error('La verificación de la interfaz Network no coincide.');
  process.exit(1);
}

writeFileSync(overlayArchive, overlayBuffer);
const result = spawnSync('tar', ['-xJf', overlayArchive], { stdio: 'inherit' });

if (result.status !== 0) {
  console.error('No se pudo aplicar la interfaz Network de Central GO.');
  process.exit(result.status ?? 1);
}

console.log('Interfaz Central GO Network aplicada correctamente.');
