import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'node_modules/world-cities-json/data/cities.json');
const target = resolve(root, 'public/data/world-locations');
const raw = JSON.parse(await readFile(source, 'utf8'));
const grouped = new Map();

for (const row of raw) {
  const code = String(row.iso2 || '').trim().toUpperCase();
  const name = String(row.city || '').trim();
  if (!/^[A-Z]{2}$/.test(code) || !name) continue;
  const country = String(row.country || code).trim();
  const region = String(row.admin_name || '').trim();
  const current = grouped.get(code) ?? { code, name: country, cities: new Map() };
  current.cities.set(`${name}|${region}`, { name, region });
  grouped.set(code, current);
}

await mkdir(target, { recursive: true });
const countries = [];
for (const item of [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
  const cities = [...item.cities.values()].sort((a, b) => a.name.localeCompare(b.name, 'es') || a.region.localeCompare(b.region, 'es'));
  const regions = [...new Set(cities.map((city) => city.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  countries.push({ code: item.code, name: item.name, cityCount: cities.length });
  await writeFile(resolve(target, `${item.code}.json`), JSON.stringify({ code: item.code, name: item.name, regions, cities }));
}
await writeFile(resolve(target, 'countries.json'), JSON.stringify(countries));
await writeFile(resolve(target, 'NOTICE.txt'), [
  'Central GO world location data',
  'Source: SimpleMaps World Cities Database via world-cities-json.',
  'License: Creative Commons Attribution 4.0 International (CC BY 4.0).',
  'https://simplemaps.com/data/world-cities',
  'https://creativecommons.org/licenses/by/4.0/',
  '',
].join('\n'));
console.log(`Generated ${countries.length} country files in ${target}`);
