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
| Base de datos / carreras | Lógica / Microfallo | Reconciliados campos de snapshot de vehículo en `trips` para evitar drift entre producción y reconstrucciones limpias. | VERIFICADO: migración limpia + stress SQL |
| Despacho / concurrencia | Lógica | Acciones ocupadas pasan de bloqueo global a bloqueo por carrera; permite operar varias carreras simultáneamente sin perder clics. | VERIFICADO: build + concurrencia |
| Redispatch | Lógica | Se permite reintento seguro después de rechazo sin duplicar asignaciones activas. | VERIFICADO: stress + concurrencia |
| Operadora / tiempo real | Microfallo | Resincronización reforzada ante eventos realtime/red inestable. | VERIFICADO: pruebas comerciales y build |
| Conductores sin app | UX / Lógica | Sincronización de disponibilidad tradicional y reincorporación a fila desde consola. | VERIFICADO: stress y flujo operador |
| Seguridad interna | Seguridad | Revocado acceso cliente a función interna de notificación de trigger. | VERIFICADO: auditoría de permisos |
| Rendimiento DB | Rendimiento | Índices añadidos para relaciones de operadoras, terminales y cola de despacho automático. | VERIFICADO: migración limpia |
| PTT | Microfallo / Seguridad | `Permissions-Policy` actualizado para permitir micrófono al mismo origen. | VERIFICADO: chequeo de cabeceras en QA |
| Tema claro operadora/admin | Diseño UX | Añadida capa de legibilidad específica para superficies claras sin alterar la app del conductor. | VERIFICADO: build + capturas QA |
| Consola de operadores | Diseño UX | Validado flujo de creación de acceso, autorización de terminal e inicio de turno. | VERIFICADO: desktop E2E |
| Responsive | Diseño UX | Validado dashboard y creación de carrera en desktop, tablet y móvil. | VERIFICADO: runner visual |
| QA temporal | Seguridad / Mantenimiento | Eliminados workflows temporales y runner con fixtures antes de liberar a `main`. | VERIFICADO: eliminados de rama de release |

## Hallazgos activos

| Módulo | Tipo | Hallazgo | Estado |
|---|---|---|---|
| Consola móvil de despacho | Diseño UX | En anchos móviles, los contadores de estado compiten con el título y generan solapamiento visual. | EN CORRECCIÓN |
| Acciones táctiles de carrera | Diseño UX | Algunos icon-buttons de detalle/cancelación son de 36 px y deben ampliarse en móvil. | EN CORRECCIÓN |
| App conductor | Diseño UX / Microfallo | Falta una pasada visual específica del flujo conductor completo con foco en botones de aceptación, llegada, inicio y finalización. | EN AUDITORÍA |
| `centralgo_private_settings` | Seguridad defensiva | RLS está deshabilitado, aunque la tabla no tiene grants para `anon`/`authenticated`; requiere validar funciones de pago antes de endurecerlo. | PENDIENTE CONTROLADO |

## Regla anti-bucle

Ningún punto ha alcanzado tres intentos fallidos. Si ocurre, se registrará aquí como **BLOQUEANTE** y se continuará con el siguiente módulo.
