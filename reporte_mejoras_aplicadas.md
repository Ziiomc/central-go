# Reporte de mejoras aplicadas — Central GO

Fecha de auditoría: 2026-08-26

## Criterio de diseño adoptado

- Interfaz de operación de alta densidad, con jerarquía visual simple y acciones primarias evidentes.
- Controles táctiles con objetivo de al menos 44 px en vistas móviles cuando la densidad lo permite.
- Estados semánticos consistentes: ámbar = pendiente, azul = asignada/activa, verde = disponible/completada, rojo = cancelación/SOS.
- Adopción incremental de patrones actuales de shadcn/ui y primitivas accesibles tipo Radix, evitando una reescritura total que agregue riesgo operacional.
- Prioridad a navegación predecible, foco visible, labels accesibles, feedback inmediato y reducción de decisiones simultáneas.

## Cambios verificados

| Módulo | Tipo de cambio | Solución aplicada | Estado de verificación |
|---|---|---|---|
| Base de datos / carreras | Lógica / Microfallo | Reconciliados campos de snapshot de vehículo en `trips` para evitar drift entre producción y reconstrucciones limpias. | VERIFICADO: migración limpia + stress SQL + migración producción |
| Despacho / concurrencia | Lógica | Acciones ocupadas pasan de bloqueo global a bloqueo por carrera; permite operar varias carreras simultáneamente sin perder clics. | VERIFICADO: build + concurrencia |
| Redispatch | Lógica | Se permite reintento seguro después de rechazo sin duplicar asignaciones activas. | VERIFICADO: stress + concurrencia |
| Operadora / tiempo real | Microfallo | Resincronización reforzada ante eventos realtime/red inestable. | VERIFICADO: pruebas comerciales y build |
| Conductores sin app | UX / Lógica | Sincronización de disponibilidad tradicional y reincorporación a fila desde consola. | VERIFICADO: stress y flujo operador |
| Seguridad interna | Seguridad | Revocado acceso cliente a función interna de notificación de trigger; `anon` y `authenticated` sin EXECUTE, `service_role` conservado. | VERIFICADO EN PRODUCCIÓN |
| Rendimiento DB | Rendimiento | Índices añadidos para relaciones de operadoras, terminales, vehículo de carrera y cola de despacho automático. | VERIFICADO EN PRODUCCIÓN: 6 índices presentes |
| Despachador automático | Rendimiento / Lógica | Conservada ejecución cada 5 segundos; migraciones de índice aplicadas sin alterar la cadencia. | VERIFICADO: cron continúa completando normalmente |
| PTT | Microfallo / Seguridad | `Permissions-Policy` actualizado para permitir micrófono al mismo origen. | VERIFICADO EN PRODUCCIÓN: `microphone=(self)` |
| Tema claro operadora/admin | Diseño UX | Añadida capa de legibilidad específica para superficies claras sin alterar la app del conductor. | VERIFICADO: build + capturas QA |
| Consola de operadores | Diseño UX | Validado flujo de creación de acceso, autorización de terminal e inicio de turno. | VERIFICADO: desktop E2E previo al release |
| Responsive móvil | Diseño UX | Título, métricas, búsqueda y CTA dejan de competir por espacio; controles de carrera aumentados para uso táctil. | VERIFICADO: build completo + captura producción móvil |
| Responsive tablet | Diseño UX | El encabezado permanece apilado hasta `lg`, evitando compresión de “Central GO / Despacho”; desktop amplio conserva alta densidad. | VERIFICADO: `npm test` completo; captura post-refinamiento bloqueada por runner |
| App conductor | Diseño UX / Microfallo | Aumentados objetivos táctiles y jerarquía de aceptación, GPS, llamada, llegada, inicio, finalización, perfil y cierre de errores; oferta marcada como actualización prioritaria accesible. | VERIFICADO: TypeScript/reglas comerciales/build; pendiente E2E visual autenticado específico |
| Vercel producción | Operación | Despliegues posteriores al hardening publicados y chequeados. | VERIFICADO: sitio responde y sin errores/fatales en ventana revisada |
| QA temporal | Seguridad / Mantenimiento | Eliminados de `main` los workflows y scripts de un solo uso empleados para aplicar/verificar la auditoría. | VERIFICADO: limpieza final completada |

## Hallazgos controlados

| Módulo | Tipo | Hallazgo | Estado |
|---|---|---|---|
| `centralgo_private_settings` | Seguridad defensiva | RLS está deshabilitado, aunque la tabla no tiene grants para `anon`/`authenticated` y las lecturas sensibles pasan por funciones `SECURITY DEFINER`; activar RLS exige regresión específica de pagos para no cortar cobros. | PENDIENTE CONTROLADO; no es exposición cliente actual |
| Visual E2E post-release | Automatización QA | El runner temporal intentó reutilizar un fixture diario en el primer intento y los dos siguientes fallaron al reconstruir el spec histórico antes de abrir el navegador. Las pruebas funcionales/build no fallaron; móvil/tablet sí cuentan con evidencia de navegador del primer intento. | **BLOQUEANTE DE AUTOMATIZACIÓN** tras 3 intentos; no se repite por regla anti-bucle |

## Regla anti-bucle

Se alcanzaron tres intentos únicamente en la reconstrucción automática del fixture visual post-release. El punto queda registrado como **BLOQUEANTE DE AUTOMATIZACIÓN** y no se realiza un cuarto intento. Esto no se clasifica como fallo funcional de Central GO porque los intentos 2 y 3 se detuvieron antes de ejecutar el navegador, mientras que el primer intento sí validó móvil y tablet y falló en desktop por reutilización de un usuario QA ya existente.

## Estado de cierre

- Código funcional y mejoras UX aplicados directamente en `main`.
- Migraciones de seguridad/rendimiento aplicadas en Supabase producción.
- PTT habilitado para micrófono del mismo origen.
- Stress, concurrencia, aislamiento GPS/SOS, reglas comerciales, TypeScript y build superados.
- No se detectaron errores/fatales de runtime en Vercel durante la revisión posterior al release.
- Workflows y scripts temporales de esta ejecución eliminados de `main`.
- Único endurecimiento pendiente deliberadamente: evaluar RLS de `centralgo_private_settings` junto con una regresión completa de pagos.
