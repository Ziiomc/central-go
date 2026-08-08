# Central GO — preparación comercial

## Estado actual

La interfaz, PWA, despacho, mapa, estados y flujos demo están protegidos por CI y compilan con TypeScript. El repositorio ya no reconstruye código desde capas ocultas durante el build.

## Barreras deliberadas antes de producción

Central GO no debe activarse con `VITE_APP_MODE=commercial` hasta conectar una base de datos y autenticación dedicadas. El gate de producción bloqueará la aplicación para impedir que datos demo sean confundidos con datos reales.

Pendiente para producción real:

- Proyecto Supabase dedicado a Central GO.
- Autenticación de operadoras, conductores, administradores y propietario.
- Row Level Security por empresa/central.
- Persistencia de carreras, clientes, vehículos, conductores y auditoría.
- Canal de GPS real del conductor (Realtime/Edge Function o API autenticada).
- Backups, retención, política de privacidad y procedimiento de incidentes.
- Pruebas E2E de carreras críticas antes de incorporar una central real.

## Variables preparadas

Copiar `.env.example` y configurar las variables únicamente en Vercel. Nunca versionar claves privadas.
