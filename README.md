# Montessori Admissions

## Seguimiento vigente

El estado, las prioridades y la evidencia de validación se mantienen en
[Avance de Admin, inscripciones y CMS](../montessori-backend/docs/estado-admin-inscripciones-cms.md)
(enlace entre repositorios del workspace local). El contexto general está en
`montessori-backend/AGENTS.md`. No considerar terminado un flujo solo porque compile.

Aplicación de mostrador para el ciclo escolar 2027. Atiende cuatro estaciones: Inscripciones, Libros, Uniformes y Caja.

## Flujo

1. Inscripciones confirma el expediente del alumno. Después puede enviar el paquete de libros del grado y las prendas elegidas por la familia.
2. Libros y Uniformes reciben las órdenes en vivo, crean órdenes adicionales para alumnos inscritos, preparan artículos disponibles y anotan faltantes.
3. Caja reúne todos los cargos pendientes de cada alumno. Puede cobrar hermanos juntos en un recibo o por separado. Cada cobro liquida la cuenta seleccionada completa.
4. Tras el pago, las estaciones entregan artículos preparados. Los faltantes siguen pendientes hasta su entrega.

El recibo guarda una copia inmutable de los conceptos cobrados. La estructura de datos distingue el tipo de documento para incorporar facturas más adelante. El catálogo, precios, paquetes, stock y reportes generales corresponden a `montessori-admin`.

Las estaciones se actualizan por WebSocket; un refresco de respaldo ocurre cada 45 segundos. La interfaz usa un tema oscuro fijo inspirado en Montessori Student y controles grandes para pantallas táctiles.

## Desarrollo

Para conectar el servicio de inscripciones en modo limpio, configurar
`ENROLLMENT_API_URL` y `ENROLLMENT_API_MODE=clean`. Así `/v2/**` llega al
servicio nuevo y las rutas del mostrador que aún usan el esquema anterior
permanecen en `ADMISSIONS_API_URL`. El modo limpio no traslada por sí mismo
familias, contratos ni caja.

1. Copia `.env.example` a `.env.local` y configura la URL de la API.
2. Ejecuta `npm install` y `npm run dev`.
3. Verifica las migraciones del worktree/entorno utilizado. En `montessori-backend-admissions` el flujo de estaciones está en `V83__admissions_station_sales.sql` y `V85__admission_staff_workflow.sql`. La numeración V75/V76 de documentos anteriores es histórica; contrastar siempre con el esquema real antes de integrar.

El inicio de sesión guarda el token en una cookie HTTP-only. Las operaciones pasan por rutas del servidor; el navegador solo recibe un ticket temporal para WebSocket.
