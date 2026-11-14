import { useEffect, useState } from 'react';
import { listarProductos, type Categoria } from '../api/productos';

// No hay un endpoint de categorías (la consigna pide solo /productos), así que
// se obtienen del listado completo, sin repetir. Con más alcance, sería GET /categorias.
export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    listarProductos()
      .then((productos) => {
        const porSlug = new Map(
          productos.map((p) => [p.categoria.slug, p.categoria]),
        );
        setCategorias(
          [...porSlug.values()].sort((a, b) =>
            a.nombre.localeCompare(b.nombre),
          ),
        );
      })
      .catch(() => {
        // Sin categorías el filtro queda solo con "Todas"; el error ya lo muestra la tabla.
      });
  }, []);

  return categorias;
}
