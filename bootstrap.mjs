import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const dir = '.bootstrap';
const archive = `${dir}/project.tar.xz`;

if (!existsSync(archive)) {
  const parts = readdirSync(dir)
    .filter((name) => /^part-\d+$/.test(name))
    .sort();

  if (parts.length !== 10) {
    console.error(`Se esperaban 10 partes del proyecto y se encontraron ${parts.length}.`);
    process.exit(1);
  }

  const encoded = parts.map((name) => readFileSync(`${dir}/${name}`, 'utf8')).join('');
  writeFileSync(archive, Buffer.from(encoded, 'base64'));
}

const result = spawnSync('tar', ['-xJf', archive], { stdio: 'inherit' });
if (result.status !== 0) {
  console.error('No se pudo preparar el código fuente de Central GO.');
  process.exit(result.status ?? 1);
}
