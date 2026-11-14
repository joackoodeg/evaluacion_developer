import type { Producto } from '../api/productos';
import { formatearPrecio } from '../utils/formato';
import { EstadoStockBadge } from './EstadoStockBadge';

interface Props {
  productos: Producto[];
}

export function TablaProductos({ productos }: Props) {
  if (productos.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500">
        No hay productos para mostrar.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-600">
          <tr>
            <th className="px-4 py-3 font-medium">Producto</th>
            <th className="px-4 py-3 font-medium">Categoría</th>
            <th className="px-4 py-3 text-right font-medium">
              Precio unitario
            </th>
            <th className="px-4 py-3 text-right font-medium">Stock</th>
            <th className="px-4 py-3 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {productos.map((producto) => (
            <tr key={producto.id}>
              <td className="px-4 py-3 font-medium">{producto.nombre}</td>
              <td className="px-4 py-3 text-gray-600">
                {producto.categoria.nombre}
              </td>
              {/* números a la derecha y con ancho fijo para poder compararlos */}
              <td className="px-4 py-3 text-right tabular-nums">
                {formatearPrecio(producto.precioUnitario)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {producto.stockActual}
              </td>
              <td className="px-4 py-3">
                <EstadoStockBadge stock={producto.stockActual} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
