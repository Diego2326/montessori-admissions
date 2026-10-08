# Montessori Admissions

Aplicación de mostrador para el ciclo escolar 2027. Atiende cuatro estaciones: Inscripciones, Libros, Uniformes y Caja.

## Flujo

1. Inscripciones confirma el expediente del alumno. Después puede enviar el paquete de libros del grado y las prendas elegidas por la familia.
2. Libros y Uniformes reciben las órdenes en vivo, crean órdenes adicionales para alumnos inscritos, preparan artículos disponibles y anotan faltantes.
3. Caja reúne todos los cargos pendientes de cada alumno. Puede cobrar hermanos juntos en un recibo o por separado. Cada cobro liquida la cuenta seleccionada completa.
4. Tras el pago, las estaciones entregan artículos preparados. Los faltantes siguen pendientes hasta su entrega.

El recibo guarda una copia inmutable de los conceptos cobrados. La estructura de datos distingue el tipo de documento para incorporar facturas más adelante. El catálogo, precios, paquetes, stock y reportes generales corresponden a `montessori-admin`.

Las estaciones se actualizan por WebSocket; un refresco de respaldo ocurre cada 45 segundos. La interfaz usa un tema oscuro fijo inspirado en Montessori Student y controles grandes para pantallas táctiles.

## Desarrollo

1. Copia `.env.example` a `.env.local` y configura la URL de la API.
2. Ejecuta `npm install` y `npm run dev`.
3. La API necesita la migración `V76__admission_staff_workflow.sql` de `montessori-backend`.

El inicio de sesión guarda el token en una cookie HTTP-only. Las operaciones pasan por rutas del servidor; el navegador solo recibe un ticket temporal para WebSocket.
