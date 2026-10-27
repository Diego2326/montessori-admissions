# Montessori Admissions

## Seguimiento vigente

El estado, las prioridades y la evidencia de validación se mantienen en
[Avance de Admin, inscripciones y CMS](../montessori-backend/docs/estado-admin-inscripciones-cms.md)
(enlace entre repositorios del workspace local). El contexto general está en
`montessori-backend/AGENTS.md`. No considerar terminado un flujo solo porque compile.

Aplicación de mostrador para el ciclo escolar 2027. Atiende cuatro estaciones: Inscripciones, Libros, Uniformes y Caja.

## Flujo de trabajo del personal

Admisiones es una consola interna para el personal del colegio. Las familias
pueden completar la preinscripción en casa, pero sus respuestas entran a la
bandeja **Desde casa** para que recepción o inscripción revise el expediente y
continúe el proceso dentro del colegio.

El panel separa **Alumnos nuevos**, **Reinscripción**, **Desde casa**,
**Familias** y **Contratos**. El expediente familiar permite corregir datos,
relacionar alumnos, generar enlaces de preinscripción y abrir la inscripción
individual de cada alumno. El contrato y la firma se manejan por alumno.

El flujo de referencia es:

- **Alumno nuevo:** contacto e información → formulario en el colegio o desde
  casa → visita y atención → inscripción → revisión de documentos → firma →
  pago → libros y uniformes → inscrito.
- **Alumno antiguo:** recepción → verificación del alumno y solvencia →
  actualización de datos → reinscripción → firma → pago → libros y uniformes.

El dashboard refleja estados que ya conoce la API (firma, pago e inscripción)
y deja el resto del flujo como guía operativa; no registra visitas o revisión de
documentos como estados nuevos.

## Acceso del personal

El menú y las acciones se muestran según los permisos devueltos por `/users/me`:

- **Inscripciones:** `ADMISSIONS_MANAGE` y `ENROLLMENTS_MANAGE`.
- **Ventas:** `ADMISSIONS_MANAGE` sin `ENROLLMENTS_MANAGE` (el API LMS actual
  protege Libros y Uniformes con `ADMISSIONS_MANAGE`).
- **Contabilidad:** `FINANCE_MANAGE`.
- **Administración:** administrador, con acceso a todas las áreas.

La API sigue validando los permisos en cada operación. Si un usuario no cuenta
con un área habilitada, la aplicación lo dirige a una de las áreas que sí tiene
asignadas.

## Flujo entre estaciones

1. Inscripciones guarda el expediente, el contrato y el estado del alumno. No crea pedidos de productos.
2. Libros y Uniformes registran ventas por separado para alumnos inscritos. Los pedidos se vinculan al alumno y la familia registrada; las estaciones preparan artículos disponibles y anotan faltantes.
3. Caja reúne los cargos pendientes. Puede cobrar hermanos de una familia juntos en un recibo o por separado. Cada cobro liquida las cuentas seleccionadas completas.
4. Tras el pago, las estaciones entregan artículos preparados. Los faltantes siguen pendientes hasta su entrega.

Al terminar una inscripción, la pantalla ofrece accesos a las estaciones de Libros y Uniformes. Para iniciar una venta se selecciona un alumno inscrito; Caja puede agrupar los cargos de hermanos de la misma familia.

El recibo guarda una copia inmutable de los conceptos cobrados. La estructura de datos distingue el tipo de documento para incorporar facturas más adelante. El catálogo, precios, paquetes, stock y reportes generales corresponden a `montessori-admin`.

Las estaciones se actualizan por WebSocket; un refresco de respaldo ocurre cada 45 segundos. La interfaz usa un tema oscuro fijo inspirado en Montessori Student y controles grandes para pantallas táctiles.

## Desarrollo

Toda la operación del mostrador usa `ADMISSIONS_API_URL`, conectado al LMS que
ya contiene las familias y los alumnos importados. La ruta antigua de
inscripción limpia redirige al flujo vigente y la API nueva no forma parte de
este panel.

1. Copia `.env.example` a `.env.local` y configura la URL de la API.
2. Ejecuta `npm install` y `npm run dev`.
3. Verifica las migraciones del worktree/entorno utilizado. En `montessori-backend-admissions` el flujo de estaciones está en `V83__admissions_station_sales.sql` y `V85__admission_staff_workflow.sql`. La numeración V75/V76 de documentos anteriores es histórica; contrastar siempre con el esquema real antes de integrar.

El inicio de sesión guarda el token en una cookie HTTP-only. Las operaciones pasan por rutas del servidor; el navegador solo recibe un ticket temporal para WebSocket.
