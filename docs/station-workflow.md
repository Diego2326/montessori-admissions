# Flujo operativo de inscripciones 2027

Estado: especificación acordada para rediseñar `montessori-admissions`. El frontend de la PR #1 es un prototipo administrativo y debe sustituirse antes de integrarlo. Este documento no activa despliegues.

## Propósito y límites

`montessori-admissions` es la herramienta del personal que atiende a las familias, inscribe alumnos, prepara libros y uniformes, cobra y entrega. Las cuatro estaciones comparten el mismo expediente del alumno y el mismo ciclo escolar. La configuración de catálogos, paquetes por grado, precios, recepción y ajustes de inventario, permisos, conciliación y reportes generales pertenecen a `montessori-admin`.

La inscripción debe quedar registrada antes de generar cualquier pedido. Luego, Inscripciones puede originar pedidos de Libros y Uniformes. Cada estación también puede crear y editar pedidos de alumnos ya inscritos. Caja cobra la totalidad de los cargos pendientes en una operación: no hay abonos. La preparación puede empezar antes del pago; la entrega requiere que el pedido esté pagado. Un artículo pagado puede continuar pendiente de entrega.

## Recorrido de una familia

1. Inscripciones busca al alumno y su familia; reutiliza el expediente si existe y evita duplicados. Si es nuevo, crea el expediente.
2. Completa los datos del alumno, grado, padres, representante, emergencia, cuotas y contrato. Guarda avances y marca lo que falte. Confirma la inscripción.
3. En la misma atención puede añadir el paquete de libros sugerido para el grado y seleccionar prendas, tallas y cantidades de uniformes. Se crean órdenes y cargos asociados al alumno.
4. Libros y Uniformes reciben las órdenes automáticamente. Sus operadores pueden crear otras órdenes o editar productos, tallas y cantidades de sus propios pedidos antes del cobro. Preparan lo disponible y marcan faltantes por renglón.
5. Caja ve todos los cargos pendientes de la atención, su origen y el total vigente. Confirma un pago completo y genera un recibo. Si una estación cambió una orden durante el cobro, Caja debe revisar el total nuevo antes de confirmar.
6. Las estaciones reciben la confirmación de pago y registran la entrega por artículo y cantidad. Los faltantes continúan visibles como deuda de entrega hasta resolverse.
7. Las compras posteriores de un alumno inscrito empiezan en Libros o Uniformes y generan un nuevo cargo pendiente para Caja.

## Pantallas de trabajo

- **Buscar / Inscribir**: búsqueda rápida por alumno, familia o código; expedientes recientes; formulario por pasos; revisión final; contrato y firmas según el flujo existente. Tras confirmar inscripción, selección opcional de libros y uniformes.
- **Libros**: cola de pedidos nuevos, en preparación, listos y con faltantes. Al abrir un pedido: alumno, grado, paquete sugerido, artículos y cantidades, existencias, notas, preparación y entrega. Acción para crear pedido adicional de alumno inscrito.
- **Uniformes**: cola equivalente; selección libre de prendas y tallas, sin paquete obligatorio. Acción para crear pedido adicional de alumno inscrito.
- **Caja**: cola de cuentas pendientes; desglose de inscripción, libros y uniformes; total vigente; método y referencia de pago; confirmación única; recibo, consulta y reimpresión. No contiene configuración financiera.
- **Pendientes de entrega**: vista filtrable de pedidos pagados con artículos aún no entregados, accesible desde las estaciones correspondientes.

La navegación debe estar organizada por la tarea del operador, no por tablas administrativas. Cada pantalla tendrá acciones primarias visibles y estados legibles sin abrir otras páginas.

## Estados y reglas

La inscripción, el cobro, la preparación y la entrega son dimensiones separadas. No se modelan como una sola cadena de estados.

- Inscripción: borrador, completa, cancelada o corregida.
- Orden: activa o anulada; revisión de importe si cambia antes del pago.
- Cobro: pendiente o pagado. Caja no registra pagos parciales.
- Preparación por artículo: sin iniciar, preparando, preparado o faltante.
- Entrega por artículo: cantidad entregada y cantidad pendiente. El pedido puede quedar parcialmente entregado después de pagarse.

Los libros parten del paquete configurado para el grado; la estación puede ajustar la orden. Uniformes se eligen por prenda y talla. Crear o editar una orden reserva las unidades disponibles de forma transaccional. Si faltan unidades, el pedido conserva la cantidad prometida y registra el faltante; no se borra la obligación de entrega. El precio y la configuración del producto vienen de Admin.

Antes de pagar, una estación puede cambiar renglones, cantidades, tallas y notas, y el total se recalcula para Caja. Después de pagar, puede cambiar preparación y entrega. Una corrección de productos o importes después del pago requiere una operación de corrección visible en Caja y un nuevo comprobante o ajuste; el recibo anterior queda inmutable. Agregar productos más tarde puede generar una orden nueva pendiente de cobro.

La anulación de una orden sin pago libera reservas. Una orden pagada requiere un flujo de corrección autorizado y trazable. Todos los cambios registran operador, fecha y motivo cuando corresponda.

## Recibo y futura factura

El primer alcance emite únicamente un recibo interno con número, fecha, alumno/familia, renglones, total, método y referencia de pago. Se guarda una copia inmutable de los importes y conceptos al cobrar para que la reimpresión no cambie si luego se editan catálogos. La emisión de factura queda preparada mediante un tipo de documento y referencia al pago, sin crear todavía integración fiscal ni mostrar controles de facturación al staff.

## Uso táctil

Diseño para tablet, monitor táctil y escritorio. Objetivos mínimos: controles de 48 px o más, separación suficiente entre acciones, tarjetas de pedido en vez de tablas densas, acciones principales fijas al pie en formularios largos y paneles de detalle a pantalla completa en tamaños pequeños. No depender de hover. Búsqueda con teclado en pantalla, filtros grandes y confirmaciones claras para cobro, anulación y entrega. El tema oscuro es fijo y no muestra selector.

## Actualización entre estaciones

Cambios de inscripción, orden, importe, pago, preparación y entrega deben llegar en tiempo real a otras estaciones mediante WebSocket. El evento avisa qué expediente u orden cambió y cada pantalla recarga los datos de ese registro. Se mantiene un mecanismo de sincronización al reconectar y un respaldo periódico. En Cloud Run, el envío de eventos debe funcionar entre distintas instancias; un broadcaster solo en memoria no cumple este requisito.

## Casos de aceptación

1. Un alumno existente se reinscribe; Inscripciones añade libros del grado y dos prendas de uniforme; ambas estaciones preparan mientras Caja cobra el total; al pagar pueden entregar.
2. Un alumno nuevo se inscribe sin comprar productos; semanas después Uniformes crea una orden y Caja la cobra.
3. Falta un libro del paquete; la familia paga el paquete completo y recibe lo disponible; el libro faltante sigue pendiente hasta su entrega posterior.
4. Uniformes cambia la talla antes del cobro; Caja recibe el total actualizado y no cobra un importe anterior.
5. Dos operadores modifican el mismo pedido; el sistema detecta la versión anterior y evita sobrescribir cambios o vender las mismas existencias dos veces.
6. Se reimprime un recibo después de cambiar el precio de un producto en Admin; el recibo conserva el importe cobrado.

## Trabajo técnico pendiente

El backend V75 ya incorporó productos, stock y órdenes vinculadas a cargos, pero no representa preparación, faltantes prometidos, modificaciones completas de órdenes, recibos inmutables ni eventos WebSocket entre instancias. El frontend actual usa pantallas administrativas. Ambos deben adaptarse a este flujo; la PR del frontend permanece sin integrar. Antes de implementar se debe revisar el estado real del despliegue de Cloud Run, que no estaba confirmado en la última comprobación.
