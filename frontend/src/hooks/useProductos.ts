import { useEffect, useState } from 'react';
import { listarProductos, type Producto } from '../api/productos';

interface Resultado {
  categoria?: string;
  productos: Producto[];
  error: string | null;
}

// Carga los productos de la API y los vuelve a pedir cuando cambia la categoría.
export function useProductos(categoria?: string) {
  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    // Si la categoría cambia antes de que llegue la respuesta, la respuesta
    // vieja se descarta para que no pise a la nueva.
    let ignorar = false;

    listarProductos(categoria)
      .then((productos) => {
        if (!ignorar) setResultado({ categoria, productos, error: null });
      })
      .catch((e: unknown) => {
        if (ignorar) return;
        const error = e instanceof Error ? e.message : 'Error desconocido';
        setResultado({ categoria, productos: [], error });
      });

    return () => {
      ignorar = true;
    };
  }, [categoria]);

  // "Cargando" se deriva en lugar de guardarse en el estado: si el último
  // resultado no corresponde a la categoría pedida, la respuesta todavía no llegó.
  const cargando = resultado === null || resultado.categoria !== categoria;

  return {
    productos: resultado?.productos ?? [],
    error: resultado?.error ?? null,
    cargando,
  };
}
