import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { categorias, productos } from '../database/schema';

// Única capa que conoce Drizzle: si cambia la consulta o el ORM, se toca solo este archivo.
@Injectable()
export class ProductosRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // Un solo JOIN trae cada producto con su categoría, sin consultas extra por fila (N+1).
  // Si el slug no existe, el filtro no encuentra filas y devuelve una lista vacía.
  listar(categoriaSlug?: string) {
    // - select: define la forma exacta del JSON de respuesta, con la categoría anidada
    //   (la consigna pide incluir el nombre de la categoría, no solo el id).
    // - innerJoin: todo producto tiene categoría (NOT NULL), así que no se pierden filas.
    // - where: sin filtro, Drizzle omite el WHERE y trae todos los productos.
    return this.db
      .select({
        id: productos.id,
        nombre: productos.nombre,
        precioUnitario: productos.precioUnitario,
        stockActual: productos.stockActual,
        categoria: {
          id: categorias.id,
          nombre: categorias.nombre,
          slug: categorias.slug,
        },
      })
      .from(productos)
      .innerJoin(categorias, eq(productos.categoriaId, categorias.id))
      .where(categoriaSlug ? eq(categorias.slug, categoriaSlug) : undefined)
      .orderBy(productos.nombre);
  }
}
