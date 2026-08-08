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

## Ejecutar localmente

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev
```

La aplicación estará disponible normalmente en `http://localhost:3000`.

## Compilar

```bash
npm run build
```

El resultado se genera en la carpeta `dist`.

## Despliegue

El proyecto está preparado para desplegarse en Vercel. No requiere claves de API para ejecutar esta demostración.


## Seguridad comercial

La rama principal ejecuta TypeScript, chequeos de preparación comercial y build de producción en cada cambio. El modo comercial permanece bloqueado hasta conectar autenticación y persistencia reales. Ver `docs/COMMERCIAL_READINESS.md`.
