# Central GO

Central GO es una plataforma SaaS de gestión y despacho para centrales de taxi. Conecta la operación de la central, la aplicación de conductores y una red de socios comerciales en un entorno multiempresa protegido por roles.

## Acceso y participación

Una persona puede crear su cuenta con correo y contraseña o continuar con Google. Durante el onboarding elige cómo participar:

- **Central:** crea su espacio de trabajo y recibe 5 días del plan Enterprise completo, sin tarjeta.
- **Conductor:** solicita acceso mediante el código de una central. La administración debe aprobar la solicitud antes de habilitar viajes, GPS o radio.
- **Socio comercial:** obtiene un panel gratuito para atención, registro de centrales y seguimiento de una comisión comercial base de 20%.

Las cuentas existentes conservan sus permisos. Los roles operativos se asignan en PostgreSQL mediante funciones autenticadas; los metadatos editables del usuario nunca se usan como autorización.

## Funciones principales

- Despacho manual, automático y predictivo.
- Reservas, ofertas temporizadas y reasignación segura.
- Aplicación PWA independiente para conductores.
- GPS en tiempo real, presencia, SOS, notificaciones push y radio.
- Gestión de centrales, usuarios, conductores, vehículos, clientes y tarifas.
- Suscripciones, pruebas de 5 días, planes, pagos y comisiones.
- Paneles para Superadmin y socios comerciales.
- Auditoría, reportes e historial operativo.
- Tema claro y oscuro.

## Arquitectura

- React 19, TypeScript, Vite y Tailwind CSS.
- Supabase Auth, PostgreSQL, Row Level Security, Realtime y Edge Functions.
- Vercel para el frontend y los encabezados de seguridad.
- PWA con entrada independiente en /driver.

No existe un modo demo con datos simulados en la aplicación oficial. Si el backend comercial no está disponible, la interfaz se bloquea para evitar operaciones sin persistencia.

## Desarrollo local

Requisitos: Node.js 20 o superior.

    npm ci
    npm run dev

La aplicación queda disponible normalmente en http://localhost:3000.

Las variables admitidas están documentadas en .env.example. Nunca se deben versionar claves privadas ni una clave service_role.

## Validación

    npm test

Este comando ejecuta:

1. TypeScript sin emisión.
2. Reglas estáticas de preparación comercial.
3. Build de producción.

GitHub Actions agrega validaciones PostgreSQL desde cero para aislamiento entre centrales, límites de planes, anti-escalación, onboarding por roles y aprobación de conductores.

## Despliegue

El frontend está preparado para Vercel. Las migraciones SQL viven en supabase/migrations y las funciones de servidor en supabase/functions.

Antes de publicar:

1. Exigir que todas las verificaciones de CI estén verdes.
2. Aplicar migraciones antes del frontend que las consume.
3. Verificar Auth, Google OAuth, correo y webhooks en staging.
4. Probar el recorrido central → conductor → viaje → cierre.

Consulta docs/COMMERCIAL_READINESS.md para la lista operativa.
