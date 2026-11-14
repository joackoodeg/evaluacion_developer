import type { Categoria } from '../api/productos';

interface Props {
  categorias: Categoria[];
  valor: string;
  onChange: (slug: string) => void;
}

export function FiltroCategoria({ categorias, valor, onChange }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-gray-600">Categoría</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5"
      >
        <option value="">Todas</option>
        {categorias.map((categoria) => (
          <option key={categoria.slug} value={categoria.slug}>
            {categoria.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
