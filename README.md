# Montessori Admissions

Aplicación operativa del ciclo 2027. Incluye inscripciones, contabilidad, libros y uniformes.

- **Inscripciones:** alumnos de promoción y altas nuevas, datos familiares, grado, cuotas y contrato.
- **Contabilidad:** cargos, pagos, saldos y recibos imprimibles.
- **Libros y uniformes:** catálogo, stock, pedidos vinculados a cargos y entregas tras el pago.
- **Actualizaciones:** WebSocket entre estaciones; una actualización periódica cada 45 segundos cubre desconexiones y varias instancias del backend.

La interfaz usa un tema oscuro fijo, con componentes y navegación inspirados en Montessori Teacher y Student. El código se divide entre rutas (`app/`), pantallas (`features/`), componentes compartidos y acceso a la API (`lib/`).

## Desarrollo

1. Copiar `.env.example` a `.env.local`. La dirección incluida apunta a la API de Google Cloud; cámbiala si necesitas un backend local.
2. Ejecutar `npm install` y `npm run dev`.

El backend de Cloud Run aplica la migración `V75` al iniciar la nueva revisión.

El inicio de sesión guarda el token en una cookie HTTP-only. Las operaciones se envían a la API mediante rutas del servidor; el navegador solo recibe un ticket temporal para WebSocket.
