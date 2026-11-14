import { STOCK_BAJO } from '../config';

export type EstadoStock = 'sin-stock' | 'bajo' | 'normal';

// Única regla para clasificar el stock: la usan la tabla, la alerta y el gráfico.
export function estadoStock(stock: number): EstadoStock {
  if (stock === 0) return 'sin-stock';
  if (stock <= STOCK_BAJO) return 'bajo';
  return 'normal';
}
