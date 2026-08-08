import fs from 'node:fs';

const file = 'src/context/AppContext.tsx';
let source = fs.readFileSync(file, 'utf8');

if (!source.includes("../config/runtime")) {
  source = source.replace(
    "import { soundManager } from '../lib/audio';",
    "import { soundManager } from '../lib/audio';\nimport { runtimeConfig } from '../config/runtime';"
  );
}

if (!source.includes('if (!runtimeConfig.isDemo) return;')) {
  const roadMarker = '// Road-aware simulation:';
  const markerIndex = source.indexOf(roadMarker);
  if (markerIndex < 0) {
    throw new Error('No se encontró el bloque de simulación GPS para protegerlo.');
  }

  const effectIndex = source.indexOf('useEffect(() => {', markerIndex);
  if (effectIndex < 0) {
    throw new Error('No se encontró el useEffect de simulación GPS.');
  }

  const insertionPoint = source.indexOf('\n', effectIndex) + 1;
  source = source.slice(0, insertionPoint) + '    if (!runtimeConfig.isDemo) return;\n\n' + source.slice(insertionPoint);
}

fs.writeFileSync(file, source);
console.log('Simulación GPS limitada exclusivamente al entorno demo.');
