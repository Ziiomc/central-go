import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const overlayDirectory = '.operations-pro';
const overlayArchive = '/tmp/central-go-operations-pro.tar.xz';
const expectedHash = '5e4f37d5dccf2f3afb2fc0694b72f2d9034ea9f8cebc5e7f287a2505ab4b5bb4';

if (!existsSync(overlayDirectory)) {
  console.error('No se encontró la interfaz operativa avanzada de Central GO.');
  process.exit(1);
}

const parts = readdirSync(overlayDirectory)
  .filter((name) => /^part-\d+$/.test(name))
  .sort();

if (parts.length !== 13) {
  console.error(`Se esperaban 13 partes de la interfaz operativa y se encontraron ${parts.length}.`);
  process.exit(1);
}

const encodedOverlay = parts.map((name) => readFileSync(`${overlayDirectory}/${name}`, 'utf8')).join('');
const overlayBuffer = Buffer.from(encodedOverlay, 'base64');
const actualHash = createHash('sha256').update(overlayBuffer).digest('hex');

if (actualHash !== expectedHash) {
  console.error('La verificación de la interfaz operativa no coincide.');
  process.exit(1);
}

writeFileSync(overlayArchive, overlayBuffer);
const result = spawnSync('tar', ['-xJf', overlayArchive], { stdio: 'inherit' });
if (result.status !== 0) {
  console.error('No se pudo aplicar la interfaz operativa avanzada de Central GO.');
  process.exit(result.status ?? 1);
}

console.log('Central GO Operations Pro aplicada correctamente.');
