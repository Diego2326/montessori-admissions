# Montessori Admissions

Frontend separado para el proceso de inscripciones 2027 del Colegio Bilingüe Montessori.
El código se organiza por estaciones (`app/`), componentes (`components/`),
funciones de negocio (`lib/admissions/`) y pantallas (`features/`).

La pantalla inicial lee los alumnos activos, sus grados 2026 y las familias
migradas mediante la API del backend del colegio. Propone el grado 2027 sin modificar los registros. Los
alumnos de 5.º Bachillerato quedan identificados como egresados. Caja, libros y
uniformes tienen rutas propias para el desarrollo de sus flujos.

## Desarrollo local

1. Copiar `.env.example` a `.env.local` para usar el backend local. Sin esa
   variable, el servidor del frontend usa la API del colegio en Cloud Run:
   `https://notas-api-625997821641.northamerica-south1.run.app`.
2. Ejecutar el backend del colegio con la migración V70 aplicada.
3. Ejecutar `npm install` y `npm run dev`.

El frontend usa el inicio de sesión del backend y guarda el token en una cookie
HTTP-only. Nunca se conecta directamente a Neon. Las estaciones restantes aún
requieren permisos y flujos propios antes de publicarse.
