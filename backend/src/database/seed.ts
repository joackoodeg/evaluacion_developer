import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { categorias, productos, movimientos } from './schema';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  // Vacia las tablas y reinicia los ids en 1, así el seed se puede correr las veces que haga falta con el mismo resultado
  await db.execute(
    sql`TRUNCATE movimientos, productos, categorias RESTART IDENTITY CASCADE`,
  );

  const [electronica, ropa, alimentos] = await db
    .insert(categorias)
    .values([
      {
        nombre: 'Electrónica',
        descripcion: 'Dispositivos y accesorios electrónicos',
      },
      { nombre: 'Ropa', descripcion: 'Indumentaria y calzado' },
      {
        nombre: 'Alimentos',
        descripcion: 'Productos alimenticios no perecederos',
      },
    ])
    .returning();

  // Incluye productos con stock bajo y uno sin stock: (Cargador USB-C) para probar la alerta y los indicadores visuales.
  // precioUnitario va como string: Drizzle mapea numeric a string para no perder precision
  const productosCreados = await db
    .insert(productos)
    .values([
      {
        nombre: 'Auriculares inalámbricos',
        categoriaId: electronica.id,
        precioUnitario: '25000.00',
        stockActual: 15,
      },
      {
        nombre: 'Mouse óptico',
        categoriaId: electronica.id,
        precioUnitario: '8500.00',
        stockActual: 40,
      },
      {
        nombre: 'Teclado mecánico',
        categoriaId: electronica.id,
        precioUnitario: '45000.00',
        stockActual: 3,
      },
      {
        nombre: 'Cargador USB-C',
        categoriaId: electronica.id,
        precioUnitario: '12000.00',
        stockActual: 0,
      },
      {
        nombre: 'Remera de algodón',
        categoriaId: ropa.id,
        precioUnitario: '9000.00',
        stockActual: 60,
      },
      {
        nombre: 'Jean clásico',
        categoriaId: ropa.id,
        precioUnitario: '32000.00',
        stockActual: 4,
      },
      {
        nombre: 'Zapatillas urbanas',
        categoriaId: ropa.id,
        precioUnitario: '68000.00',
        stockActual: 12,
      },
      {
        nombre: 'Arroz 1 kg',
        categoriaId: alimentos.id,
        precioUnitario: '1800.00',
        stockActual: 120,
      },
      {
        nombre: 'Aceite de girasol 900 ml',
        categoriaId: alimentos.id,
        precioUnitario: '2600.00',
        stockActual: 2,
      },
      {
        nombre: 'Yerba mate 1 kg',
        categoriaId: alimentos.id,
        precioUnitario: '4500.00',
        stockActual: 35,
      },
    ])
    .returning();

  // Cada unidad en stock tiene que tener un movimiento que la justifique -> si no: stock_actual y el historial no coinciden
  // Los productos con stock 0 se saltean porque el CHECK exige cantidad > 0.
  await db.insert(movimientos).values(
    productosCreados
      .filter((p) => p.stockActual > 0)
      .map((p) => ({
        productoId: p.id,
        // as const: el valor literal del ENUM, no cualquier string
        tipo: 'entrada' as const,
        cantidad: p.stockActual,
        motivo: 'Carga inicial de inventario',
        usuario: 'seed',
      })),
  );

  console.log(
    `Seed completo: 3 categorías, ${productosCreados.length} productos`,
  );
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
