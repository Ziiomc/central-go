# Central GO

Central GO es una plataforma web de gestión y despacho para centrales de radiotaxi. Está diseñada para reducir la carga operativa de la central y permitir que la operadora registre solicitudes, asigne móviles y supervise carreras desde una interfaz clara, rápida y fácil de aprender.

## Funciones de la demostración

- Registro rápido de nuevas carreras.
- Asignación y seguimiento de móviles.
- Vista operativa de carreras pendientes, asignadas y en curso.
- Mapa de flota y estados de conductores.
- Gestión demostrativa de clientes, vehículos, empresas y operadores.
- Alertas, notificaciones y simulación de comunicaciones.
- Diseño adaptable a computador y teléfono.
- Soporte PWA para instalar la demo como aplicación.

> Esta versión utiliza datos simulados y está pensada para demostración comercial. No almacena información real ni reemplaza todavía un backend de producción.

## Despliegue en Vercel

El repositorio está preparado para importarse directamente en Vercel. La compilación ejecuta `npm run build`, reconstruye el código fuente incluido en el repositorio y genera la carpeta `dist`.

Configuración esperada:

- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js: 20 o superior
