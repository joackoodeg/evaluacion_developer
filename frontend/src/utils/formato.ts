const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

// El precio llega como string ("25000.00"); se convierte a número solo para mostrarlo.
export function formatearPrecio(precio: string): string {
  return pesos.format(Number(precio));
}
