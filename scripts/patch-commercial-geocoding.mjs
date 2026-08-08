import fs from 'node:fs';

const file = 'src/components/modals/NewTripModal.tsx';
let text = fs.readFileSync(file, 'utf8');

text = text.replace("import { PaymentMethod } from '../../types';", "import { PaymentMethod } from '../../types';\nimport { runtimeConfig } from '../../config/runtime';\nimport { geocodeCommercialAddress } from '../../lib/geocoding';");
text = text.replace('    fareConfig,\n  } = useApp();', '    fareConfig,\n    currentCompany,\n  } = useApp();');

const selected = "    const selectedDriver = availableDrivers.find((driver) => driver.id === selectedDriverId);\n    setSubmitting(true);\n    try {\n      await createTrip({";
if (!text.includes(selected)) throw new Error('No se encontró inicio del submit');
text = text.replace(selected, `    const selectedDriver = availableDrivers.find((driver) => driver.id === selectedDriverId);\n    setSubmitting(true);\n    try {\n      const originPoint = runtimeConfig.isCommercial\n        ? await geocodeCommercialAddress(currentCompany.id, cleanOrigin)\n        : { lat: -35.8454 + (Math.random() - 0.5) * 0.018, lng: -71.5979 + (Math.random() - 0.5) * 0.018 };\n\n      const destinationUnknown = /^a convenir/i.test(cleanDestination);\n      const destinationPoint = runtimeConfig.isCommercial\n        ? (destinationUnknown ? originPoint : await geocodeCommercialAddress(currentCompany.id, cleanDestination))\n        : { lat: -35.849 + (Math.random() - 0.5) * 0.018, lng: -71.603 + (Math.random() - 0.5) * 0.018 };\n\n      await createTrip({`);

text = text.replace(`      origin: {\n        lat: -35.8454 + (Math.random() - 0.5) * 0.018,\n        lng: -71.5979 + (Math.random() - 0.5) * 0.018,\n        address: cleanOrigin,\n      },\n      destination: {\n        lat: -35.849 + (Math.random() - 0.5) * 0.018,\n        lng: -71.603 + (Math.random() - 0.5) * 0.018,\n        address: cleanDestination,\n      },`, `      origin: {\n        lat: originPoint.lat,\n        lng: originPoint.lng,\n        address: cleanOrigin,\n      },\n      destination: {\n        lat: destinationPoint.lat,\n        lng: destinationPoint.lng,\n        address: cleanDestination,\n      },`);

fs.writeFileSync(file, text);
console.log('Geocodificación comercial conectada al alta de carreras.');
