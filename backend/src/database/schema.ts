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
  // identificador para URLs (?categoria=electronica): estable aunque cambie el nombre
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
      // restrict: no se puede borrar una categoría con productos asociados
      .references(() => categorias.id, { onDelete: 'restrict' }),
    // numeric y no float: los montos no deben tener errores de redondeo
    precioUnitario: numeric('precio_unitario', {
      precision: 12,
      scale: 2,
    }).notNull(),
    stockActual: integer('stock_actual').notNull().default(0),
  },
  (t) => [
    // garantía final de la regla de negocio, aunque falle la validación de la API
    check('stock_no_negativo', sql`${t.stockActual} >= 0`),
    check('precio_no_negativo', sql`${t.precioUnitario} >= 0`),
    index('idx_productos_categoria').on(t.categoriaId),
  ],
);

export const movimientos = pgTable(
  'movimientos',
  {
    // bigint: es la tabla que más crece
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    productoId: integer('producto_id')
      .notNull()
      // restrict: los movimientos son el historial del producto y no se pierden
      .references(() => productos.id, { onDelete: 'restrict' }),
    // el tipo define el signo; por eso la cantidad siempre es positiva
    tipo: tipoMovimiento('tipo').notNull(),
    cantidad: integer('cantidad').notNull(),
    // con zona horaria: evita desfasajes entre el servidor y los usuarios
    fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow(),
    motivo: text('motivo'),
    usuario: varchar('usuario', { length: 100 }).notNull(),
  },
  (t) => [
    check('cantidad_positiva', sql`${t.cantidad} > 0`),
    index('idx_movimientos_producto_fecha').on(t.productoId, t.fecha),
  ],
);
