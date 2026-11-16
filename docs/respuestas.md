# Respuestas a preguntas de la consigna

_Diseño de la base de datos: restricciones y justificación_

## 1.1 Diseño del modelo

Modelo las tres tablas con Drizzle y pongo cada regla de negocio como constraint en la base, no solo en el código.

```ts
import {
  pgTable,
  pgEnum,
  serial,
  bigserial,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const tipoMovimiento = pgEnum('tipo_movimiento', ['entrada', 'salida']);

export const categorias = pgTable('categorias', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  descripcion: text('descripcion'),
});

export const productos = pgTable(
  'productos',
  {
    id: serial('id').primaryKey(),
    nombre: varchar('nombre', { length: 255 }).notNull(),
    categoriaId: integer('categoria_id')
      .notNull()
      .references(() => categorias.id, { onDelete: 'restrict' }),
    precioUnitario: numeric('precio_unitario', {
      precision: 12,
      scale: 2,
    }).notNull(),
    stockActual: integer('stock_actual').notNull().default(0),
  },
  (t) => [
    check('stock_no_negativo', sql`${t.stockActual} >= 0`),
    check('precio_no_negativo', sql`${t.precioUnitario} >= 0`),
    index('idx_productos_categoria').on(t.categoriaId),
  ],
);

export const movimientos = pgTable(
  'movimientos',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    productoId: integer('producto_id')
      .notNull()
      .references(() => productos.id, { onDelete: 'restrict' }),
    tipo: tipoMovimiento('tipo').notNull(),
    cantidad: integer('cantidad').notNull(),
    fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow(),
    motivo: text('motivo'),
    usuario: varchar('usuario', { length: 100 }).notNull(),
  },
  (t) => [
    check('cantidad_positiva', sql`${t.cantidad} > 0`),
    index('idx_movimientos_producto_fecha').on(t.productoId, t.fecha),
  ],
);
```

### Tabla de decisiones de modelado

| Decisión                                                | Regla que cubre                                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `categoria_id` NOT NULL + FK con `onDelete: 'restrict'` | Todo producto tiene una sola categoría; no se puede borrar una categoría con productos.                                                        |
| `precio_unitario` NOT NULL, tipo `numeric(12,2)`        | El precio siempre está definido. Uso `numeric` y no `float` porque el punto flotante redondea mal los montos.                                  |
| `CHECK (stock_actual >= 0)`                             | El stock nunca queda negativo, aunque falle la validación de la API.                                                                           |
| `tipo` como ENUM + `CHECK (cantidad > 0)`               | El signo lo da el tipo: no puede existir una "entrada de -5".                                                                                  |
| `fecha` con default `now()` y `usuario` NOT NULL        | Cada movimiento queda registrado con fecha, tipo y quién lo hizo.                                                                              |
| FK de movimientos con `onDelete: 'restrict'`            | No se pierde historial. Para dar de baja un producto usaría borrado lógico (`activo`).                                                         |
| `slug` único en `categorias`                            | Permite filtrar con `?categoria=electronica` sin depender del nombre visible. Lo agregué en una segunda migración, al implementar el endpoint. |

> **Nota:** `stock_actual` es un dato desnormalizado: se podría calcular sumando los movimientos. Lo guardo para leerlo rápido y lo mantengo consistente actualizándolo en la misma transacción que inserta el movimiento.

### ¿Qué tipo de base de datos elegirías y por qué?

Elijo una base de datos relacional, PostgreSQL, porque el problema es relacional y necesita de esa consistencia.

- **Los datos tienen relaciones claras:** Categoría -> producto -> movimiento. Las FK garantizan que no haya productos sin categoría ni movimientos de productos inexistentes.
- **Transacciones ACID:** descontar stock y registrar el movimiento tiene que pasar entero o no pasar, si falla a la mitad se revierte todo.
- **Constraints en la base, como por ejemplo `CHECK`, `NOT NULL`:** las reglas de negocio se cumplen aunque se escriba en la base por fuera de la API.
- **Ecosistema actual:** buen soporte de ORMs, escala bien y tiene opciones gestionadas para no administrar el servidor (Railway, Neon (serverless)).

Una base de datos no relacional - NoSQL (ej. MongoDB) no aporta ventajas para este caso y haría perder la integridad referencial que se exige.

### ¿Usarías un ORM? ¿Qué ventajas y desventajas ves en este caso?

Sí, usaría Drizzle ORM. Lo elijo sobre Prisma porque reduce la principal desventaja de un ORM: perder de vista el SQL que se ejecuta.

**Ventajas:**

- **Tipado de punta a punta:** el schema define los tipos de TypeScript, así que un error en el nombre de una columna o en un tipo aparece al compilar, no en producción.
- Las tablas se trabajan como objetos y las consultas son más legibles y fáciles de mantener que SQL armado a mano.
- **Consultas parametrizadas:** previene la inyección SQL sin tener que acordarse de escapar valores.
- **Migraciones versionadas** con drizzle-kit, generadas a partir del schema.
- **Constraints declarados en el schema:** Drizzle soporta `check()`, así que la regla del stock vive junto al modelo. En Prisma habría que agregarla a mano en el SQL de la migración.
- **API cercana a SQL:** el `UPDATE` condicional con `RETURNING`, que es la clave del control de stock, se escribe tal cual.

**Desventajas:**

- **Una capa más de abstracción:** si no se entiende lo que hay debajo, es fácil escribir consultas ineficientes.
- **Problema N+1:** traer una lista y después consultar una relación por cada fila. Se evita con joins o con la API relacional de Drizzle.
- **Menos flexibilidad en consultas complejas** (reportes, agregaciones, stock histórico). Para esos casos uso SQL directo con el helper `sql` de Drizzle.

### ¿Cómo garantizarías que el stock no quede negativo?

La garantía real está en la base de datos: un `UPDATE` atómico dentro de una transacción, con el `CHECK` como última red. Validar solo desde la API no alcanza, por concurrencia: el stock es 5 y llegan dos salidas de 4 al mismo tiempo. Las dos leen 5, las dos validan "5 ≥ 4" y las dos restan. El stock queda en -3.

Implementación con Drizzle (diseño: registrar movimientos no forma parte del endpoint pedido, así que no está en el repo)

```ts
export async function registrarSalida(
  productoId: number,
  cantidad: number,
  motivo: string,
  usuario: string,
) {
  return db.transaction(async (tx) => {
    const [producto] = await tx
      .update(productos)
      .set({ stockActual: sql`${productos.stockActual} - ${cantidad}` })
      .where(
        and(eq(productos.id, productoId), gte(productos.stockActual, cantidad)),
      )
      .returning({ stockActual: productos.stockActual });

    // 0 filas afectadas: no hay stock suficiente (o el producto no existe)
    if (!producto) throw new StockInsuficienteError(productoId, cantidad); // revierte la transacción

    await tx
      .insert(movimientos)
      .values({ productoId, tipo: 'salida', cantidad, motivo, usuario });
    return producto.stockActual;
  });
}
```

Funciona porque el `UPDATE` bloquea la fila: la segunda transacción espera, vuelve a evaluar la condición con el stock ya descontado y no la cumple. La alternativa es `SELECT ... FOR UPDATE`, que bloquea la fila primero y después valida en código.

### ¿Cómo conviven estas herramientas dentro del stack tecnológico de un proyecto? ¿Cuáles usarías y por qué? (Por ejemplo: ¿ORM junto con migraciones? ¿Cliente directo en algún caso? ¿Cómo interactúan con el resto de la arquitectura?)

Cada herramienta tiene un rol: Drizzle para el acceso a datos del día a día, drizzle-kit para los cambios de esquema y SQL directo solo donde el ORM se queda corto.

Las rutas nunca llaman a la base directamente: pasan por los servicios, que manejan las transacciones, y por los repositorios, que son los únicos que usan Drizzle.

- **Drizzle (ORM):** CRUD y lógica del día a día. Al usarlo solo en los repositorios, si cambia una consulta o el ORM se toca una sola capa.
- **drizzle-kit (migraciones):** cada cambio de esquema es un archivo SQL versionado en el repo y revisable en el PR.
- **SQL directo:** para reportes, agregaciones y el stock histórico, donde el SQL generado sería ineficiente o difícil de controlar.
- **La base como última fuente de verdad:** los constraints viven en PostgreSQL aunque la app también valide.
- **Pool de conexiones:** la app usa un pool de `pg` compartido por todo el backend y lo cierra al apagarse. Si se deployara en serverless, donde cada función abre sus propias conexiones, sumaría un pooler como PgBouncer.
- **Seeds:** un script con categorías y productos de prueba para desarrollo local.

## 1.2 Historial de cambios

Guardaría la auditoría en una tabla aparte, `productos_historial`, con una fila por cada campo modificado. La tabla `movimientos` no sirve para esto: registra cambios de stock, no de nombre o precio.

```ts
export const productosHistorial = pgTable(
  'productos_historial',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    productoId: integer('producto_id')
      .notNull()
      .references(() => productos.id),
    campo: varchar('campo', { length: 50 }).notNull(), // 'nombre' | 'precio_unitario'
    valorAnterior: text('valor_anterior'),
    valorNuevo: text('valor_nuevo'),
    usuario: varchar('usuario', { length: 100 }).notNull(),
    fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_historial_producto_fecha').on(t.productoId, t.fecha)],
);
```

- **Cómo se llena:** desde el servicio, en la misma transacción que el `UPDATE` del producto. El servicio compara los valores viejos con los nuevos e inserta una fila por cada campo que cambió. Elijo esta opción porque el servicio conoce al usuario logueado.
- **La alternativa es un trigger en PostgreSQL:** captura cualquier cambio, incluso los hechos a mano en la base, pero no sabe qué usuario de la app hizo el cambio.
- **Por qué no en la misma tabla:** versionar filas dentro de `productos` complica todas las consultas y las FK que apuntan al producto. En una tabla aparte, `productos` queda limpia y el historial es de solo inserción: nunca se edita.
- **Por qué no en otro sistema:** se justifican con mucho volumen o por requisitos de auditoría externos. Para este sistema serían una complejidad innecesaria.

## 1.3 Si el sistema crece

Para PostgreSQL ese volumen es manejable sin cambiar la arquitectura: miles de movimientos por día son alrededor de un millón de filas por año. Lo encararía por etapas, sin sobredimensionar desde el principio.

- **Índices en lo que se consulta seguido:** `movimientos(producto_id, fecha)`, `productos(categoria_id)`.
- **Paginación obligatoria** en los listados.
- **Separar el stock actual del historial:** `productos.stock_actual` responde "¿cuánto hay?" sin recorrer los movimientos, y `movimientos` conserva el historial completo.
- **Cuando `movimientos` llegue a cientos de millones de filas:** particionarla por fecha (por ejemplo, mensual).

Si además apareciera el requisito de manejar varios depósitos, el stock pasaría a una tabla `inventario(producto_id, deposito_id, stock)`, con el mismo esquema de actualización atómica.

### Stock histórico en cualquier fecha pasada

Agregaría a cada movimiento el saldo resultante (`stock_resultante`): el stock del producto justo después de ese movimiento. Así, el stock en una fecha es el saldo del último movimiento anterior a esa fecha.

Es una sola búsqueda en el índice `(producto_id, fecha)`, así que el tiempo de respuesta no crece con el historial.

- **Condición:** los movimientos nunca se editan ni se borran. Un error se corrige con un movimiento compensatorio, lo que además mantiene la trazabilidad.
- **Alternativa:** Sumar todos los movimientos hasta la fecha. Funciona, pero se vuelve más lento a medida que crece el historial.

## 2.1 Decisiones de arquitectura

### ¿Qué lenguaje y framework usarías?

Uso TypeScript con NestJS. La consigna prefiere Python, pero TypeScript es el lenguaje con el que trabajo en desarrollo web, y me permite usar el mismo lenguaje en el backend y en el frontend (React).

Para un solo endpoint alcanzaría con Express. Elijo Nest porque el sistema va a crecer (movimientos, roles, auditoría) y su estructura responde directamente a lo que se pregunta en esta parte:

| Necesidad                    | Lo que da Nest                                              |
| ---------------------------- | ----------------------------------------------------------- |
| Organización en capas        | Módulos, controllers, providers e inyección de dependencias |
| Validación de entrada        | Pipes + DTOs con class-validator                            |
| Roles y endpoints protegidos | Guards y decoradores propios (`@Roles()`)                                |
| Configuración por entorno    | `ConfigModule`                                              |

El costo es más código repetitivo y una curva de aprendizaje mayor que la de Express.

### ¿Cómo organizaría el proyecto en carpetas?

Un módulo por dominio del negocio. Dentro de cada uno, las capas de controller, service y repository:

```text
backend/
├── drizzle/
├── src/
│   ├── database/
│   │   ├── schema.ts            # tablas y constraints (modelo de datos)
│   │   ├── database.module.ts   # expone la conexión de Drizzle a Nest
│   │   ├── migrate.ts
│   │   └── seed.ts
│   ├── productos/
│   │   ├── dto/listar-productos.query.ts
│   │   ├── productos.controller.ts
│   │   ├── productos.service.ts
│   │   ├── productos.repository.ts
│   │   └── productos.module.ts
│   ├── health/health.controller.ts
│   ├── app.module.ts
│   └── main.ts
└── Dockerfile
```

Cómo se conectan las capas (es el diagrama de la sección de base de datos):

1. **Controller:** recibe la petición HTTP. El DTO valida y normaliza la entrada antes de que llegue al código. No tiene lógica de negocio.
2. **Service:** aplica las reglas de negocio y maneja las transacciones. No sabe nada de HTTP ni de SQL.
3. **Repository:** es la única capa que usa Drizzle. Arma las consultas y devuelve los datos.
4. **Base de datos:** los constraints son la última garantía de las reglas.

Esta estructura facilita mantener y escalar el sistema porque:

- Cada funcionalidad nueva es un módulo (`movimientos/`, `categorias/`, `auth/`) que no toca los demás.
- Cambiar una consulta o el ORM afecta solo a los repositorios.
- Los services se pueden testear reemplazando el repositorio por uno falso, sin base de datos.
- Cada capa depende de la de abajo por inyección de dependencias, no por imports directos de implementaciones.

### ¿Dónde y cómo configuraría las reglas de negocio?

Depende del tipo de regla. No todas van en el mismo lugar:

| Tipo de regla                | Ejemplo                                                    | Dónde va                                        | Por qué                                                                                   |
| ---------------------------- | ---------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Invariante de los datos      | Stock nunca negativo, precio obligatorio                   | Constraint en la base (`CHECK`, `NOT NULL`, FK) | Se cumple aunque falle la API o alguien escriba en la base por fuera                      |
| Regla de proceso             | Una salida descuenta stock y registra el movimiento juntos | Service, dentro de una transacción              | Es lógica de negocio que coordina varias operaciones                                      |
| Conjunto cerrado de valores  | Tipos de movimiento válidos (entrada / salida)             | ENUM en la base + tipo en TypeScript            | Cambiarlo requiere una migración a propósito: es un cambio de modelo, no de configuración |
| Valor que varía por producto | Stock mínimo                                               | Columna `stock_minimo` en `productos`           | Es un dato que un administrador edita, no una variable de entorno                         |
| Valor global del sistema     | Stock mínimo por defecto                                   | Variable de entorno leída con `ConfigModule`    | Cambia por entorno sin tocar código                                                       |
| Formato de la entrada        | `categoria` tiene que ser un slug                          | DTO con class-validator                         | Se rechaza en el borde, antes de llegar a la lógica                                       |

## 2.2 Deploy

### ¿Cómo deployarías este sistema?

El backend corre como contenedor Docker en Railway, y ya está en producción: [evaluaciondeveloper-production.up.railway.app/productos](https://evaluaciondeveloper-production.up.railway.app/productos).

Docker y Railway no son alternativas, se complementan:

- **Docker** empaqueta la app con su entorno exacto. La imagen se construye en dos etapas: la primera compila con todas las dependencias, y la final solo lleva el código compilado, las migraciones y las dependencias de producción.
- **Railway (PaaS)** ejecuta ese contenedor y aporta Postgres gestionado, HTTPS, red privada entre servicios y deploy automático en cada push a `main`.

Para el inventario de una empresa chica, un PaaS es una elección razonable también en producción. Como la app ya está en un contenedor, migrar a un VPS más adelante es mover la misma imagen.

Qué pasa en cada deploy:

1. Merge a `main` (rama de producción; `develop` es la de integración).
2. Railway construye la imagen desde `backend/Dockerfile`.
3. Pre-deploy: aplica las migraciones pendientes (`npm run db:migrate:prod`). Si fallan, el deploy se corta y la versión anterior sigue funcionando.
4. Arranca la app y Railway espera que `GET /health` responda antes de mandarle tráfico.

Las migraciones corren en cada deploy porque son idempotentes: Drizzle registra cuáles ya aplicó. El seed no corre en el deploy, porque empieza vaciando las tablas y borraría los datos de producción. Lo ejecuté una sola vez, a mano, para tener datos de demo.

### ¿Cómo manejarías las diferencias entre local y producción?

El código y la imagen son los mismos en los dos entornos. Lo único que cambia es la configuración, que se pasa por variables de entorno.

La misma versión mayor de Postgres y de Node en los dos entornos, para que algo que funciona en local no falle en producción.

## 2.3 Seguridad: roles, perfiles y contraseñas

> Esta parte es diseño: no está implementada en el repo, porque la consigna pide un solo endpoint público.

### ¿Cómo manejarías los distintos roles? ¿Dónde definirías los permisos?

Usaría control de acceso basado en roles (RBAC). Cada usuario tiene un rol, y cada rol tiene un conjunto de permisos:

| Acción                                   | Administrador | Operador de depósito | Solo lectura |
| ---------------------------------------- | :-----------: | :------------------: | :----------: |
| Ver productos, stock e historial         |      Sí       |          Sí          |      Sí      |
| Registrar entradas y salidas             |      Sí       |          Sí          |      No      |
| Crear productos, editar nombre o precio  |      Sí       |          No          |      No      |
| Gestionar categorías y umbrales de stock |      Sí       |          No          |      No      |
| Gestionar usuarios y roles               |      Sí       |          No          |      No      |

- El rol de cada usuario se guarda en la base: una tabla `usuarios` con una columna `rol` (ENUM).
- Los permisos de cada rol se definen en el código, en un solo lugar, porque cambian junto con las funcionalidades.
- Si el negocio necesitara crear roles a medida, pasaría los permisos a tablas `roles` y `permisos`. Con tres roles fijos, eso sería complejidad innecesaria.

### ¿Qué consideraciones tendrías para el manejo de contraseñas?

Nunca guardarlas en texto plano ni con cifrado reversible. Las guardaría con un hash lento pensado para contraseñas con un costo de 12 o más.

- **Política mínima:** al menos 12 caracteres. Priorizo el largo sobre exigir símbolos o mayúsculas.
- **Login protegido:** límite de intentos por IP y por usuario (`@nestjs/throttler`) y el mismo mensaje de error para usuario inexistente y contraseña incorrecta ("credenciales inválidas"), para no revelar qué usuarios existen.
- **Recuperación:** un token de un solo uso que vence en poco tiempo, enviado por mail.
- Nunca registrar contraseñas ni tokens en los logs, y usar siempre HTTPS.

### ¿Cómo protegerías los endpoints según el rol?

Con autenticación por JWT y dos guards de Nest:

1. **`JwtAuthGuard` global:** toda ruta exige un token válido, salvo las marcadas con `@Public()` (por ejemplo, `/health`). Protegido por defecto: si alguien olvida marcar una ruta, queda cerrada en lugar de abierta.
2. **`RolesGuard`:** lee el decorador `@Roles()` de cada ruta y lo compara con el rol del token. Si no coincide, responde 403.

```ts
@Post(':id/movimientos')
@Roles('admin', 'operador')
registrarMovimiento(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: RegistrarMovimientoDto,
  @UsuarioActual() usuario: Usuario,
) {
  return this.productosService.registrarMovimiento(id, dto, usuario);
}
```

- El usuario del movimiento se toma del token, no del body. Así se cumple la regla de negocio "cada movimiento registra quién lo hizo" sin que nadie pueda hacerse pasar por otro.
- La autorización se valida siempre en el backend. El frontend oculta los botones que el rol no puede usar, pero eso es solo para la experiencia de uso, no es seguridad.
- Access token de vida corta (unos 15 minutos) con un refresh token, para que un token robado sirva por poco tiempo.

## 2.4 Logs del sistema

### ¿Qué tipo de eventos registrarías?

| Evento | Nivel | Qué incluye |
| --- | --- | --- |
| Errores no controlados | `error` | Mensaje, stack trace, ruta e id de la petición |
| Fallas de dependencias (base caída, timeouts) | `error` | Qué falló y cuánto tardó |
| Cada petición HTTP | `info` | Método, ruta, código de respuesta, duración e id de la petición |
| Eventos de autenticación | `info` / `warn` | Login exitoso o fallido, accesos denegados (403), sin la contraseña |
| Cambios de estado del negocio | `info` | "Movimiento 123 registrado", "precio del producto 9 actualizado" (solo el id, para correlacionar con la auditoría) |
| Arranque de la app | `info` | Versión y entorno, sin valores secretos |
| Detalle para depurar | `debug` | Solo en local |

### ¿Dónde guardarías los logs y con qué herramienta?

Logs estructurados en JSON con pino (`nestjs-pino`), escritos a la salida estándar (stdout).

En producción, los logs serían recolectados por el entorno de ejecución o por un agente de logging instalado en el servidor.

Si el sistema crece, los enviaría a un servicio externo para tener más retención, búsquedas y alertas.

- **No en archivos locales:** el contenedor es efímero y los archivos se pierden en cada deploy.
- **No en la base de datos:** los logs son de alto volumen y competirían con las transacciones del negocio. Además, si la base se cae, se pierde justo el log que explica por qué.

El nivel se configura por entorno con una variable `LOG_LEVEL`: `debug` en local, `info` en producción.

### ¿Cómo diferenciarías los logs de aplicación de la auditoría de negocio?

Responden a preguntas distintas. Los logs dicen qué le pasó al sistema; la auditoría dice quién cambió qué dato y cuándo.

| | Logs de aplicación | Auditoría de negocio |
| --- | --- | --- |
| **Para qué sirve** | Diagnosticar errores y rendimiento | Trazabilidad y responsabilidad sobre los datos |
| **Quién la consulta** | Desarrolladores | Administradores, auditores, el propio sistema (stock histórico) |
| **Dónde vive** | stdout → Railway o un servicio externo | Tablas en la base: `movimientos`, `productos_historial` |
| **Cómo se escribe** | Sin garantías: si se pierde una línea, no pasa nada grave | En la misma transacción que el cambio: no puede perderse |
| **Retención** | Días o semanas | Permanente |

> **Mi criterio:** si perder el registro es un problema de negocio, es auditoría y va a la base dentro de la transacción; si solo ayuda a depurar, es log.

## 2.5 Endpoint implementado

`GET /productos` devuelve el listado de productos con su stock actual y el nombre de su categoría, y permite filtrar por categoría. Está implementado contra la base real (no con datos mockeados) y deployado:

- [/productos](https://evaluaciondeveloper-production.up.railway.app/productos)
- [/productos?categoria=electronica](https://evaluaciondeveloper-production.up.railway.app/productos?categoria=electronica)

```json
{
  "id": 9,
  "nombre": "Aceite de girasol 900 ml",
  "precioUnitario": "2600.00",
  "stockActual": 2,
  "categoria": { "id": 3, "nombre": "Alimentos", "slug": "alimentos" }
}
```

| Petición | Respuesta |
| --- | --- |
| `/productos` | 200, todos los productos ordenados por nombre |
| `?categoria=electronica` | 200, solo los de esa categoría |
| `?categoria=Electronica` | 200, igual que el anterior (se normaliza a minúsculas) |
| `?categoria=juguetes` | 200, `[]` |
| `?categoria=a&categoria=b` o `?categoria=` | 400, "categoria debe ser un slug" |

### Decisiones

- **Filtro por slug, no por nombre ni por id.** Agregué una columna `slug` única a `categorias`, así la URL coincide con el ejemplo de la consigna (`?categoria=electronica`, sin tilde) y no cambia si se renombra la categoría.
- **Categoría inexistente → lista vacía con 200.** Es un filtro sin resultados, no un recurso que no existe.
- **`precioUnitario` como string**, igual que lo devuelve Postgres para `numeric`, para no perder precisión decimal.
- **Una sola consulta con JOIN**, sin una consulta extra por producto (N+1).
- **Validación del query con un DTO.** Los tipos de TypeScript no existen en ejecución: sin validar, `?categoria=a&categoria=b` llegaba como array y la consulta fallaba en silencio.

El código está en `backend/src/productos/`, separado en controller, service y repository como se describe en la sección 2.1.

## 3.1 Elección de tecnología

### ¿Cuál elegirías para este sistema y por qué?

Elijo React (con Vite, TypeScript y Tailwind), y el frontend está implementado y deployado en Railway: [evaluacion-frontend.up.railway.app](https://evaluacion-frontend.up.railway.app/).

- **Es un sistema de gestión con varios usuarios y roles** (administrador, operador, solo lectura). Necesita mostrar u ocultar acciones según el rol y manejar formularios con validación. React da control total sobre eso.
- **Las preguntas de UX de la consigna** (indicadores de stock bajo, alertas sin ruido, validación antes de enviar, ubicación de los botones) requieren control fino de la interfaz, que Streamlit no ofrece.
- **Frontend y API quedan separados.** El backend expone una API que después puede usar otro cliente (una app móvil para el depósito, una integración) sin cambios.
- **Uso TypeScript en los dos lados**, así que los tipos de la respuesta de la API se reflejan directamente en el frontend.

### ¿En qué contexto usarías Streamlit? ¿Y React?

| | Streamlit | React |
| --- | --- | --- |
| **Para qué** | Dashboards internos, análisis de datos, prototipos | Aplicaciones de producto que usan muchas personas |
| **Quién lo usa** | Un equipo chico, a menudo técnico | Usuarios finales con distintos roles |
| **Quién lo construye** | Un equipo de datos que ya trabaja en Python | Desarrolladores frontend |
| **Prioridad** | Tenerlo andando en horas | Experiencia de uso cuidada y mantenible a largo plazo |

Para este sistema usaría Streamlit en un caso puntual: un tablero interno de análisis (rotación de productos, consumo histórico), leyendo la misma base, separado de la aplicación principal.

### ¿Qué sacrificás con cada uno?

- **Con Streamlit:** control sobre la interfaz (layout, componentes y comportamiento propios). Además vuelve a ejecutar todo el script en cada interacción, lo que complica el estado y escala mal con muchos usuarios simultáneos, y la autenticación y los roles son limitados.
- **Con React:** tiempo y código. Hay que armar cada pantalla, tomar más decisiones (estilos, manejo de datos, build) y mantener un backend aparte.

## 3.2 Pantallas

Las tres piezas están implementadas en código (no son mockups) y funcionan contra la API de producción.

### Vista de tabla de productos

| Columna | Por qué |
| --- | --- |
| Producto | Identifica el artículo |
| Categoría | El nombre, no el id: el usuario no conoce los ids |
| Precio unitario | Formateado en pesos (`$ 25.000,00`). Llega como string de la API y se convierte solo para mostrarlo |
| Stock | El dato principal de la pantalla |
| Estado | Resume el stock en una palabra: Normal, Stock bajo o Sin stock |
| Acciones | "Registrar movimiento" en cada fila |

No muestro el id ni el slug: son datos internos. Los números van alineados a la derecha y con cifras de ancho fijo, para poder compararlos entre filas.

#### ¿Cómo indico visualmente que el stock está bajo?

Con una etiqueta en la columna Estado que combina texto y color: rojo "Sin stock", ámbar "Stock bajo" y verde "Normal". El texto hace que se entienda aunque alguien no distinga los colores. La regla está en una sola función (`estadoStock`), que usan la tabla, el gráfico y la alerta, así que los tres siempre coinciden.

#### ¿Qué acciones tiene la vista?

- **Implementadas:** filtrar por categoría (se aplica en el backend con `?categoria=`) y registrar un movimiento desde cada fila.
- **Propuestas, según el rol:** ver el historial de movimientos del producto (todos), editar nombre, precio y categoría (solo administrador) y dar de baja el producto con borrado lógico (solo administrador). El frontend oculta las acciones que el rol no puede usar, pero el permiso se valida en el backend.

### Gráfico de stock por producto

#### ¿Qué tipo elegiría y por qué?

Un gráfico de barras horizontales, ordenado de menor a mayor stock.

- **Barras**, porque la tarea es comparar cantidades entre productos, y el largo de una barra es lo que el ojo compara con más precisión. Descarté la torta: sirve para partes de un todo, y el stock de cada producto no es una parte de nada.
- **Horizontales**, porque los nombres de los productos son largos y así se leen sin rotarlos.
- **De menor a mayor**, para que lo que hay que reponer quede arriba, donde se mira primero.
- **Color según el estado**, con los mismos colores de la tabla y una leyenda en texto. Los productos normales van en gris, para que lo urgente resalte.
- **El valor al final de cada barra.** El caso que más importa, stock 0, no dibuja barra: le fuerzo un mínimo visible para que se vea en rojo con su "0".

### Alerta de productos con stock bajo

Implementé un aviso arriba de la tabla que resume los productos que hay que reponer: "Reponer: 1 producto sin stock y 3 productos con stock bajo", con el nombre y la cantidad de cada uno.

#### ¿Cómo definiría el umbral?

| Opción | A favor | En contra |
| --- | --- | --- |
| Fijo para todo el sistema | Simple, sin cambios en el modelo | 5 jeans no es lo mismo que 5 kilos de arroz: genera falsas alarmas |
| Por categoría | Menos configuración que por producto | Productos distintos dentro de la misma categoría rotan distinto |
| Por producto | Refleja la realidad de cada artículo | Hay que cargarlo para cada producto |

En la implementación usé un umbral fijo, por simplicidad: `STOCK_BAJO = 5`, definido en un solo lugar (`frontend/src/config.ts`).

En un sistema real lo haría configurable por producto, con valores por defecto. Si el producto no tiene umbral propio, se usa el de su categoría, y si tampoco, uno global. Así, el administrador solo carga el dato donde hace falta.

#### ¿Qué cambios necesitaría el modelo de datos?

- Una columna `stock_minimo` en `productos`.
- Opcionalmente, una columna `stock_minimo_default` en `categorias`, y un valor global en la configuración del backend.

El backend calcularía el umbral efectivo y lo devolvería en `GET /productos`, para que el frontend no tenga que conocer la regla. También permitiría filtrar, por ejemplo, `?estado=bajo`.

Solo el administrador podría editar los umbrales.

#### ¿Qué consideraciones de UX tendría para no generar ruido?

- **Un solo aviso con resumen, no una alerta por producto.** Diez alertas apiladas se ignoran; una sola línea que dice cuántos y cuáles, no.
- **Solo aparece si hay algo para hacer.** Si todo está bien, no se muestra nada: un aviso que está siempre visible deja de leerse.
- **La severidad cambia el estilo:** rojo si hay algún producto sin stock, ámbar si solo hay stock bajo. Los productos van ordenados del más urgente al menos urgente, y siempre llevan ícono y texto, no solo color.
- **Se puede ocultar, y vuelve si la situación cambia.** Si otro producto baja del umbral, el aviso reaparece: no molesta con lo que el usuario ya vio, pero tampoco esconde un problema nuevo.
- **No interrumpe:** es un aviso en la página, no un modal ni notificaciones emergentes repetidas.

### Formulario para registrar un movimiento

- Se abre desde el botón "Registrar movimiento" de cada fila, como un modal.
- Es solo frontend: valida, pero no envía datos, porque el endpoint de movimientos no forma parte de lo pedido.

#### ¿Qué campos incluyo?

| Campo | Cómo es | Por qué |
| --- | --- | --- |
| Producto | Ya viene elegido desde la fila, con su stock actual | Evita elegir el producto equivocado en una lista larga |
| Tipo | Entrada o salida, dos botones grandes | Es la decisión principal, tiene que verse clara |
| Cantidad | Número entero | Es el dato que se valida contra el stock |
| Motivo | Texto opcional, con un ejemplo según el tipo | Da contexto al historial sin frenar la carga |

La fecha y el usuario no son campos, aunque el movimiento los registra: la fecha la pone el servidor y el usuario sale de la sesión. Si fueran campos, se podrían cargar con otra fecha o a nombre de otra persona.

#### ¿Cómo valido que no quede stock negativo antes de enviar?

- **Validación en vivo:** la cantidad tiene que ser un entero mayor a 0 y, en una salida, no puede superar el stock. Con una salida de 6 y un stock de 4, el campo muestra "No hay stock suficiente: hay 4 u. disponibles".
- El botón de confirmar queda deshabilitado mientras haya un error, y el mensaje explica por qué.

Esta validación es para la experiencia de uso, no es la garantía. El stock que ve el formulario pudo cambiar desde que se cargó la página, si otro operador registró una salida. La garantía real es el `UPDATE` atómico con `CHECK` en la base (parte 1). Con el endpoint implementado, si el backend responde 409 "stock insuficiente", el formulario mostraría ese mensaje y actualizaría el stock en pantalla.

#### ¿Qué botones pongo y dónde?

Dos botones al pie del formulario, alineados a la derecha: "Cancelar" (secundario, sin fondo) y la acción principal (con fondo oscuro) a su derecha.

- **Abajo a la derecha**, porque es donde termina el recorrido de lectura del formulario: el usuario completa los campos de arriba hacia abajo y el botón está donde llega. Es la convención de la mayoría de los sistemas de diseño web.
- **La acción principal se distingue visualmente de la secundaria**, para que no se confundan.

## 4. Git

Todo el trabajo está en un repositorio público de GitHub, con 18 pull requests y 36 commits. Nada se commiteó directamente en `main` ni en `develop`: todo entró por PR.

### Repositorio

Un solo repositorio (monorepo) con `backend/`, `frontend/` y `docs/`. La consigna pide un link, y así los cambios que tocan las dos partes (por ejemplo, CORS) quedan en el mismo historial.

### Esquema de ramas

Usé una versión simplificada de Gitflow:

| Rama | Para qué | Cómo entra el código |
| --- | --- | --- |
| `main` | Producción. Railway deploya cada merge automáticamente | Solo PRs de release desde `develop` |
| `develop` | Integración | PRs desde las ramas de trabajo |
| `feature/*` | Funcionalidades (`feature/endpoint-productos`, `feature/grafico-stock`) | Salen de `develop`, vuelven por PR |
| `chore/*` | Configuración e infraestructura (`chore/docker`, `chore/deploy-railway`) | Igual que las features |

Hubo dos releases, cada una con su PR de `develop` a `main`:

- **v1.0.0** (PR #10): backend con el endpoint de productos.
- **v1.1.0** (PR #18): frontend completo y CORS.

No agregué ramas de `release/*` ni de `hotfix/*`: para un proyecto de una persona y dos versiones serían pasos de más. Las ramas mergeadas se borran.

### Commits

Formato Conventional Commits con alcance: `tipo(alcance): descripción`, en español y en infinitivo.

- **Tipos:** `feat`, `fix`, `chore`, `refactor`.
- **Alcances:** `db`, `backend`, `frontend`, `productos`, `docker`, `deploy`, `config`.
- Un cambio lógico por commit, ordenados para que cada uno compile por sí solo. Por ejemplo, el endpoint se hizo en cuatro commits: slug en categorías, repositorio, controller y servicio, y validación.
- Cuerpo del commit cuando el porqué no es obvio.
- Los errores se corrigen con commits nuevos, sin reescribir el historial.

### Otras prácticas

- Cada PR tiene descripción, con qué cambia, las decisiones tomadas y cómo probarlo.
- Los `package-lock.json` se commitean, para que el deploy instale las mismas versiones.
- Los `.env` nunca se suben; sí los `.env.example`, con las variables necesarias.

## 5. Uso de IA

### ¿Qué herramienta usaste?

Claude Code, el asistente de Anthropic que corre en la terminal. Lo usé como un compañero con quien discutir decisiones y que revisara mi trabajo. Además, para el momento de escribir código utilicé "code suggestions" a través de una extensión "Bespoke AI" que permite escribir código más rápido, ya que sugiere líneas o bloques completos a partir de lo que voy escribiendo y de los comentarios. Cada sugerencia la revisé y la ajusté antes de aceptarla, y las decisiones de diseño y arquitectura las tomé yo.

### ¿Para qué la usaste puntualmente?

- **Discutir y revisar mis respuestas de diseño.** Las primeras respuestas de base de datos las escribí yo, y le pedí que las verificara y completara.
- **Escribir los mensajes de commit y las descripciones de los PR:** le pasaba los cambios y me ayudaba a redactarlos.
- **Redactar este documento** a partir de un borrador que hice, ayudarme a ordenar las secciones y formateando además el markdown.
- **Escribir código:** código boilerplate y tareas repetitivas, como los archivos de Docker y partes de los componentes visuales del frontend, como estilos y estructura de tablas.
- **Revisar el repo antes de cada commit.** Detectó errores míos: un `exclude` dentro de `compilerOptions`, un `.gitattributes` sin el `*`, `PORT=5433` cambiado por error junto con el puerto de la base, y un PR mergeado sin el commit del health check.

### ¿Hubo algo que te sugirió y decidiste no usar o cambiar? ¿Por qué?

| Sugerencia | Qué hice | Por qué |
| --- | --- | --- |
| Python con SQLAlchemy y Alembic, porque la consigna lo prefiere | TypeScript con NestJS y Drizzle | Es el lenguaje que uso en desarrollo web, y lo justifiqué en la parte 2 |
| Evaluamos Prisma y TypeORM | Me quedé con Drizzle | Declara los `CHECK` en el schema y no esconde el SQL |
| Umbral de stock bajo configurable por producto | Umbral fijo en una constante | Simplicidad; dejé la versión por producto como propuesta en la parte 3 |
| Formulario de movimientos completo, con endpoint en el backend | Solo frontend | La consigna lo permite y prioricé terminar todas las partes |
| `AbortController` para cancelar peticiones al cambiar de categoría | Una bandera en la limpieza del `useEffect` | Resuelve el mismo problema con menos código |

También hubo una idea mía que la IA ayudó a encuadrar: separar el stock actual del historial completo de movimientos, para el escalado. Le agregué múltiples depósitos, y me sugirió presentarlos como una evolución opcional, porque no eran un requisito del enunciado.

La IA también se equivocó. Me dijo que drizzle-kit mostraba un mensaje de éxito al migrar, y en mi versión no muestra nada. Me dijo que formatear con Prettier no iba a cambiar archivos, y cambió dos. Por eso tomé como regla verificar todo: mirar la base después de migrar, correr `git status` antes de cada commit y probar cada cambio en el navegador.
