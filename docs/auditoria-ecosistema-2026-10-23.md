# Auditoría técnica del ecosistema Montessori — 23 de octubre de 2026

## Alcance y método

Revisión de los repositorios de Admin, Admissions, LMS, Enrollment, Finance,
Web API, WebMontessori y clientes Teacher, Student y Parents; configuración
de los servicios Cloud Run, triggers de Cloud Build, respuestas de salud y
conteos de las bases Neon. Se hicieron solo consultas de lectura. No se
confirmaron pagos, se enviaron correos ni se modificaron datos de producción.

Los cuatro servicios principales respondieron `200` en `/health` o
`/actuator/health`. Enrollment y Finance tardaron aproximadamente 12 y 10
segundos, respectivamente, en las consultas de salud observadas. Las bases
nuevas contienen 0 inscripciones, 0 alumnos, 0 cargos y 0 pagos; la base LMS
contiene 0 incidentes de seguridad. Esta auditoría no sustituye una prueba
transaccional de extremo a extremo con datos de prueba.

## Hallazgos prioritarios

| Prioridad | Hallazgo | Evidencia | Acción recomendada |
| --- | --- | --- | --- |
| P0 | `notas-api` mantiene la URL de PostgreSQL con credenciales y `JWT_SECRET` como variables de entorno en texto. Otros servicios también guardan sus URL JDBC como valores planos; no se confirmó contraseña en esas URL. | Configuración de Cloud Run inspeccionada sin copiar secretos. | Pasar secretos a Secret Manager y rotar la contraseña de base y el secreto JWT de `notas-api` con un plan de transición de sesiones. Limitar quién puede leer la configuración de Cloud Run. |
| P1 | Un pago confirmado en Finance puede quedar sin activar la inscripción o el alumno en LMS si falla la llamada siguiente. Las rutas UUID permiten conciliación manual, pero no hay un procesador programado de reintentos. | `OwnedEnrollmentController.confirmManual()` confirma en Finance y después llama `reconcile()`; `reconcile()` escribe en Enrollment y llama dos veces a LMS. Solo el flujo heredado tiene `IdentitySyncProcessor`. | Crear una cola persistente de conciliación UUID con reintentos, estados y alertas; añadir comprobación periódica Finance ↔ Enrollment ↔ LMS. |
| P1 | Un reverso de pago cambia el estado de Enrollment, pero no desactiva automáticamente el acceso o la matrícula académica ya creada en LMS. | `OwnedFinanceController.reverse()` llama Finance y luego `enrollments.reconcile()`; la ruta de conciliación no ejecuta una baja en LMS. | Definir la política escolar de reversos y una acción idempotente de suspensión o revisión académica, con auditoría y manejo de fallos. |
| P1 | El envío de correos de bienvenida depende de `@Scheduled` dentro de Enrollment en Cloud Run. El servicio no tiene instancia mínima ni CPU permanente configuradas; puede escalar a cero. | `WelcomeEmailService.dispatch()` es un temporizador interno; configuración Cloud Run con `minScale` sin definir y CPU por petición. | Disparar el despacho mediante Cloud Scheduler/Cloud Tasks o un Worker dedicado. Conservar el reclamo `FOR UPDATE SKIP LOCKED`, que sí protege contra dos instancias activas. |
| P1 | `notas-api` y `montessori-lms-api` escriben sobre la misma base escolar. Teacher, Student y Parents siguen apuntando a `notas-api`; Enrollment valida sesiones y aprovisiona alumnos mediante `montessori-lms-api`. Solo LMS nuevo aplica migraciones. | Configuración Cloud Run y URL base de los tres clientes; `DB_RUN_MIGRATIONS=false` en `notas-api`, `true` en LMS. | Definir un único backend LMS de producción y migrar clientes por fases. Probar compatibilidad de esquema antes de cada migración mientras ambos escritores sigan vivos. |
| P1 | La rama `feature/admin-cms-shared-auth` se despliega automáticamente a LMS, pero su Cloud Build empaqueta `shadowJar` sin ejecutar las pruebas. La CI que corre `test` escucha `main`, no esta rama. Enrollment y Finance también despliegan `bootJar` sin prueba previa en su Cloud Build. | Triggers de Cloud Build, `cloudbuild.yaml`, Dockerfiles y workflows. | Poner JUnit y pruebas de contratos como paso obligatorio previo al despliegue, o exigir un estado CI exitoso sobre el mismo commit. Añadir smoke tests posdespliegue. |
| P2 | Admin no controla todavía todo el contenido principal de WebMontessori: las rutas conocidas usan componentes estáticos antes de consultar el CMS. | `WebMontessori/src/App.tsx`: `levelPageContent` y `pageContent` preceden a `CmsPage`. | Migrar las páginas principales al CMS o marcar explícitamente cuáles son contenido fijo. Probar publicación y consumo público. |
| P2 | Finanzas están divididas entre Finance nuevo (inscripción UUID) y las mensualidades, tarifas, planes y conciliación BI del LMS anterior. Admin expone ambos módulos. | Clientes `ownedFinance` y `finance` en Admin; README de Finance documenta que falta importar y cortar los flujos heredados. | Definir mapa revisado de IDs y saldos, importar historial con conciliación, luego pasar mensualidades a Finance. No activar pagos en línea. |
| P2 | Admin, Admissions y WebMontessori no tienen workflow GitHub de despliegue en sus repositorios; el despliegue de Admin observado fue manual con Wrangler. | Repositorios `.github/workflows` y triggers Cloud Build inspeccionados. | Conectar cada frontend a un pipeline que compile, pruebe y publique el commit trazable; usar un ambiente de prueba antes de producción. |
| P2 | El panel de incidentes históricos ya consulta LMS, pero la rama publicada no genera alertas nuevas. La tabla tiene 0 filas. | `SecurityIncidentsRoutes.kt` y conteo Neon. | Separar claramente “auditoría histórica” de “monitor activo”; implementar y probar el productor de alertas antes de prometer vigilancia. |
| P2 | Los servicios nuevos escalan a cero y mostraron arranques de aproximadamente 10–12 segundos. | Configuración `minScale` sin definir y consultas de salud realizadas en esta auditoría. | Medir p95/p99 y errores del navegador; optimizar arranque o mantener una instancia mínima solo en los servicios donde el tiempo de espera afecte operaciones. |

## Orden sugerido

1. Mover y rotar credenciales expuestas como variables planas, con verificación de sesiones.
2. Cerrar el circuito pago → inscripción → LMS con reintentos y reconciliación; decidir el efecto de reversos.
3. Sacar el envío de correos del temporizador interno de Cloud Run.
4. Poner pruebas obligatorias antes de cada despliegue automático y ejecutar un caso transaccional completo en un ambiente aislado.
5. Unificar el backend LMS que consumen Teacher, Student, Parents y los microservicios.
6. Completar la migración de mensualidades, CMS público y pipelines frontend.

## Límites

No se verificó una restauración de copia de seguridad, el navegador con una
sesión real ni la entrega SMTP. Tampoco se probaron escrituras con alumnos o
pagos de prueba porque las bases nuevas están limpias. Las observaciones de
Cloud Run son una fotografía del 23/10/2026.

Sobre el temporizador en Cloud Run: Google documenta que con la facturación
predeterminada la CPU solo se asigna durante peticiones, y que la cantidad
mínima de instancias predeterminada es cero:
[facturación y CPU](https://docs.cloud.google.com/run/docs/configuring/billing-settings),
[instancias mínimas](https://docs.cloud.google.com/run/docs/configuring/min-instances).
