import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const overlayDirectory = '.road-routes';
const overlayArchive = '/tmp/central-go-road-routes.tar.xz';
const expectedHash = 'c6171374d28580c2c7536ea075b3295e4b85cc3afeca348e14a215cf223f61fa';

if (!existsSync(overlayDirectory)) {
  console.error('No se encontró la capa de rutas callejeras de Central GO.');
  process.exit(1);
}

const parts = readdirSync(overlayDirectory)
  .filter((name) => /^part-\d+$/.test(name))
  .sort();

if (parts.length !== 4) {
  console.error(`Se esperaban 4 partes de rutas callejeras y se encontraron ${parts.length}.`);
  process.exit(1);
}

const encodedOverlay = parts
  .map((name) => readFileSync(`${overlayDirectory}/${name}`, 'utf8'))
  .join('');
const overlayBuffer = Buffer.from(encodedOverlay, 'base64');
const actualHash = createHash('sha256').update(overlayBuffer).digest('hex');

if (actualHash !== expectedHash) {
  console.error('La verificación de la capa de rutas callejeras no coincide.');
  process.exit(1);
}

writeFileSync(overlayArchive, overlayBuffer);
const result = spawnSync('tar', ['-xJf', overlayArchive], { stdio: 'inherit' });

if (result.status !== 0) {
  console.error('No se pudo aplicar la simulación de rutas callejeras.');
  process.exit(result.status ?? 1);
}

console.log('Rutas callejeras y movimiento GPS suave aplicados correctamente.');
