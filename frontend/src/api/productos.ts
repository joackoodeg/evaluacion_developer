// Tipos que reflejan la respuesta de GET /productos.
export interface Categoria {
  id: number;
  nombre: string;
  slug: string;
}

export interface Producto {
  id: number;
  nombre: string;
  precioUnitario: string; // string: el backend no lo convierte a number para no perder precisión
  stockActual: number;
  categoria: Categoria;
}

const API_URL = import.meta.env.VITE_API_URL;

export async function listarProductos(
  categoria?: string,
  signal?: AbortSignal, // permite cancelar la petición, por ejemplo si cambiás de categoría antes de que llegue la respuesta anterior
): Promise<Producto[]> {
  const url = new URL('/productos', API_URL);
  if (categoria) url.searchParams.set('categoria', categoria);

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Error ${res.status} al cargar los productos`);
  }
  return res.json() as Promise<Producto[]>;
}
