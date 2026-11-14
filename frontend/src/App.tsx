import { useState } from 'react';
import { FiltroCategoria } from './components/FiltroCategoria';
import { TablaProductos } from './components/TablaProductos';
import { useCategorias } from './hooks/useCategorias';
import { useProductos } from './hooks/useProductos';

function App() {
  // '' = todas las categorías; el filtro se aplica en el backend con ?categoria=
  const [categoria, setCategoria] = useState('');
  const categorias = useCategorias();
  const { productos, cargando, error } = useProductos(categoria || undefined);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Inventario</h1>
        <FiltroCategoria
          categorias={categorias}
          valor={categoria}
          onChange={setCategoria}
        />
      </header>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 p-4 text-red-800">
          No se pudieron cargar los productos: {error}
        </p>
      ) : cargando && productos.length === 0 ? (
        <p className="py-8 text-center text-gray-500">Cargando productos…</p>
      ) : (
        // Al cambiar de categoría se mantiene la tabla anterior atenuada
        // en lugar de vaciarla, para que la pantalla no "salte".
        <div
          aria-busy={cargando}
          className={
            cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'
          }
        >
          <TablaProductos productos={productos} />
        </div>
      )}
    </main>
  );
}

export default App;
