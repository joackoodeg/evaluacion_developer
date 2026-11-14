import { useState } from 'react';
import type { Producto } from '../api/productos';
import { STOCK_BAJO } from '../config';
import { estadoStock } from '../utils/stock';

interface Props {
  productos: Producto[];
}

function plural(cantidad: number, singular: string, plural: string) {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

// Un solo aviso que resume todos los productos afectados, en lugar de una alerta
// por producto: muchas alertas juntas generan ruido y el usuario termina ignorándolas.
export function AlertaStockBajo({ productos }: Props) {
  // Guarda qué lista de productos ocultó el usuario. Si la lista cambia
  // (otro producto baja del umbral), el aviso vuelve a aparecer.
  const [firmaOcultada, setFirmaOcultada] = useState<string | null>(null);

  const sinStock = productos.filter(
    (p) => estadoStock(p.stockActual) === 'sin-stock',
  );
  const bajos = productos.filter((p) => estadoStock(p.stockActual) === 'bajo');
  const afectados = [
    ...sinStock,
    ...bajos.sort((a, b) => a.stockActual - b.stockActual),
  ];

  const firma = afectados.map((p) => `${p.id}:${p.stockActual}`).join(',');

  // Sin productos afectados no se muestra nada: el aviso solo aparece cuando hay algo para hacer.
  if (afectados.length === 0 || firma === firmaOcultada) return null;

  const critico = sinStock.length > 0;
  const resumen = [
    sinStock.length > 0 &&
      plural(sinStock.length, 'producto sin stock', 'productos sin stock'),
    bajos.length > 0 &&
      plural(
        bajos.length,
        'producto con stock bajo',
        'productos con stock bajo',
      ),
  ]
    .filter(Boolean)
    .join(' y ');

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-lg border p-4 ${
        critico
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      {/* Ícono + texto: el aviso no depende solo del color */}
      <span aria-hidden="true" className="text-lg leading-none">
        ⚠
      </span>
      <div className="flex-1 space-y-1">
        <p className="font-semibold">Reponer: {resumen}</p>
        <p className="text-sm">
          {afectados.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ' · '}
              {p.nombre} (
              {p.stockActual === 0 ? 'sin stock' : `${p.stockActual} u.`})
            </span>
          ))}
        </p>
        <p className="text-xs opacity-75">
          Umbral de stock bajo: {STOCK_BAJO} unidades o menos.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setFirmaOcultada(firma)}
        className="rounded px-2 py-1 text-sm font-medium hover:bg-black/5"
      >
        Ocultar
      </button>
    </div>
  );
}
