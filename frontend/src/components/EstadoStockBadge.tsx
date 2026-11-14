import { estadoStock } from '../utils/stock';

// Texto + color: el estado se entiende aunque no se distingan los colores.
const estilos = {
  'sin-stock': { texto: 'Sin stock', clase: 'bg-red-100 text-red-800' },
  bajo: { texto: 'Stock bajo', clase: 'bg-amber-100 text-amber-800' },
  normal: { texto: 'Normal', clase: 'bg-green-100 text-green-800' },
} as const;

export function EstadoStockBadge({ stock }: { stock: number }) {
  const { texto, clase } = estilos[estadoStock(stock)];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${clase}`}>
      {texto}
    </span>
  );
}
