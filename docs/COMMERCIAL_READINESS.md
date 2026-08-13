# Central GO — preparación comercial

## Estado

Central GO usa autenticación y persistencia reales en Supabase. La aplicación oficial no monta el provider de demostración.

Actualmente están implementados:

- Separación multiempresa mediante RLS.
- Roles Superadmin, socio regional, socio comercial, administrador, operador y conductor.
- Registro con correo o Google.
- Onboarding público para central, conductor y socio comercial.
- Prueba Enterprise completa de 5 días para centrales.
- Solicitud y aprobación de conductores sin acceso automático por código.
- Despacho atómico, reservas, reasignación y protección contra carreras activas duplicadas.
- GPS, presencia, SOS, radio y notificaciones.
- Suscripciones, catálogo de planes, pagos y comisiones.
- CI con TypeScript, build y pruebas PostgreSQL.

## Controles obligatorios para cada publicación

- npm test termina sin errores.
- Las migraciones se aplican desde cero en PostgreSQL de CI.
- Las pruebas de aislamiento entre centrales y anti-escalación terminan correctamente.
- El frontend nunca expone una clave privada o service_role.
- Las funciones SECURITY DEFINER revocan PUBLIC y validan auth.uid() y el rol correspondiente.
- Los recorridos de acceso con correo, Google, recuperación y activación de conductor se prueban en staging.
- Los cambios de esquema se publican antes que el frontend que los necesita.
- Existe un camino de rollback para frontend y funciones de servidor.

## Validación antes de incorporar una central

Realizar un piloto supervisado y comprobar:

1. Alta de central y vencimiento correcto de la prueba.
2. Creación de operador y conductor.
3. Aprobación del conductor por el administrador.
4. Registro, asignación, aceptación y cierre de una carrera.
5. Reasignación de una oferta no respondida.
6. GPS y SOS en Android y iOS instalados como PWA.
7. Cobro, webhook, activación y registro contable.
8. Restauración de backup y procedimiento de incidentes.

## Pendientes de madurez

- Pruebas E2E de navegador dentro de CI.
- Observabilidad centralizada y alertas de errores.
- Verificación periódica de backups y restauraciones.
- Revisión trimestral de RLS, privilegios y asesores de Supabase.
- Pruebas móviles con pérdida de red, suspensión y recuperación.
- Internacionalización completa de moneda, zona horaria, país y medios de pago.

## Variables

Usar .env.example como referencia y almacenar los valores reales únicamente en el entorno de despliegue. Las claves administrativas pertenecen exclusivamente a Edge Functions o infraestructura de servidor.
