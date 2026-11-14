import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
} from 'recharts';
import type { Producto } from '../api/productos';
import { STOCK_BAJO } from '../config';
import { estadoStock, type EstadoStock } from '../utils/stock';

// Lo urgente en rojo y ámbar; el resto en un gris neutro para que no compita.
const COLORES: Record<EstadoStock, string> = {
  'sin-stock': '#d03b3b',
  bajo: '#fab219',
  normal: '#64748b',
};

const ETIQUETAS: Record<EstadoStock, string> = {
  'sin-stock': 'Sin stock',
  bajo: `Stock bajo (≤ ${STOCK_BAJO})`,
  normal: 'Normal',
};

const ALTO_FILA = 32;

interface Props {
  productos: Producto[];
}

// Valor al final de cada barra. Se dibuja a mano porque Recharts omite la
// etiqueta de una barra de largo 0, y el "0" es justamente el caso más importante.
function ValorBarra(props: LabelProps) {
  const x = Number(props.x) + Number(props.width) + 6;
  const y = Number(props.y) + Number(props.height) / 2;
  return (
    <text x={x} y={y} dy={4} fontSize={12} fill="#374151">
      {props.value}
    </text>
  );
}

// Barras horizontales: los nombres de productos son largos y así se leen sin rotarlos.
// Orden de menor a mayor stock: lo que hay que reponer queda arriba.
export function GraficoStock({ productos }: Props) {
  if (productos.length === 0) return null;

  const datos = [...productos]
    .sort((a, b) => a.stockActual - b.stockActual)
    .map((p) => ({
      nombre: p.nombre,
      stock: p.stockActual,
      estado: estadoStock(p.stockActual),
    }));

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Stock por producto</h2>
        {/* El color siempre va acompañado de su significado en texto */}
        <ul className="flex gap-4 text-xs text-gray-600">
          {(Object.keys(ETIQUETAS) as EstadoStock[]).map((estado) => (
            <li key={estado} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-sm"
                style={{ backgroundColor: COLORES[estado] }}
              />
              {ETIQUETAS[estado]}
            </li>
          ))}
        </ul>
      </header>

      <ResponsiveContainer width="100%" height={datos.length * ALTO_FILA + 32}>
        <BarChart
          data={datos}
          layout="vertical"
          margin={{ top: 8, right: 32, bottom: 0, left: 8 }}
        >
          <CartesianGrid horizontal={false} stroke="#e5e7eb" />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#d1d5db' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="nombre"
            width={190}
            tick={{ fontSize: 12, fill: '#374151' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: '#f3f4f6' }}
            formatter={(valor, _nombre, item) => [
              `${String(valor)} u. · ${ETIQUETAS[(item.payload as { estado: EstadoStock }).estado]}`,
              'Stock',
            ]}
          />
          {/* Barra fina, punta redondeada y base recta sobre el eje */}
          <Bar
            dataKey="stock"
            barSize={16}
            radius={[0, 4, 4, 0]}
            // Una barra en 0 no se dibuja (y Recharts omite su etiqueta);
            // con un mínimo visible el "Sin stock" se ve en rojo con su valor.
            minPointSize={3}
            label={ValorBarra}
          >
            {datos.map((d) => (
              <Cell key={d.nombre} fill={COLORES[d.estado]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
