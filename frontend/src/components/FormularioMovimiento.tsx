import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Producto } from '../api/productos';

type Tipo = 'entrada' | 'salida';

interface Props {
  producto: Producto;
  onCerrar: () => void;
}

// Devuelve el mensaje de error, o null si la cantidad es válida.
function validarCantidad(texto: string, tipo: Tipo, stock: number) {
  if (texto.trim() === '') return 'Ingresá una cantidad.';
  const cantidad = Number(texto);
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    return 'La cantidad tiene que ser un número entero mayor a 0.';
  }
  if (tipo === 'salida' && cantidad > stock) {
    return `No hay stock suficiente: hay ${stock} u. disponibles.`;
  }
  return null;
}

// La validación del cliente es para la experiencia de uso: evita enviar algo que
// va a fallar. La garantía real de que el stock no quede negativo está en el
// backend (UPDATE atómico + CHECK en la base).
export function FormularioMovimiento({ producto, onCerrar }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tipo, setTipo] = useState<Tipo>('entrada');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviado, setEnviado] = useState(false);

  // <dialog> nativo: bloquea el fondo, maneja el foco y se cierra con Escape.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const error = validarCantidad(cantidad, tipo, producto.stockActual);
  // El error se muestra recién cuando el usuario escribió algo, no al abrir.
  const mostrarError = cantidad !== '' && error !== null;
  const stockResultante =
    error === null
      ? producto.stockActual + (tipo === 'entrada' ? 1 : -1) * Number(cantidad)
      : null;

  function confirmar(e: FormEvent) {
    e.preventDefault();
    if (error) return;
    // Sin endpoint de movimientos: acá iría el POST /productos/:id/movimientos.
    setEnviado(true);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onCerrar}
      aria-labelledby="titulo-movimiento"
      className="m-auto w-full max-w-md rounded-lg p-0 shadow-xl backdrop:bg-black/40"
    >
      {enviado ? (
        <div className="space-y-4 p-6">
          <h2 id="titulo-movimiento" className="text-lg font-semibold">
            Movimiento validado
          </h2>
          <p className="text-sm text-gray-700">
            {tipo === 'entrada' ? 'Entrada' : 'Salida'} de {cantidad} u. de{' '}
            {producto.nombre}. El stock quedaría en {stockResultante}.
          </p>
          <p className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">
            En esta versión el formulario no envía datos al backend.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={confirmar} className="space-y-5 p-6" noValidate>
          <header>
            <h2 id="titulo-movimiento" className="text-lg font-semibold">
              Registrar movimiento
            </h2>
            <p className="text-sm text-gray-600">
              {producto.nombre} · Stock actual: {producto.stockActual} u.
            </p>
          </header>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Tipo</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['entrada', 'salida'] as const).map((opcion) => (
                <label
                  key={opcion}
                  className={`cursor-pointer rounded-md border px-3 py-2 text-center text-sm ${
                    tipo === opcion
                      ? 'border-gray-900 bg-gray-900 font-medium text-white'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo"
                    value={opcion}
                    checked={tipo === opcion}
                    onChange={() => setTipo(opcion)}
                    className="sr-only"
                  />
                  {opcion === 'entrada' ? 'Entrada' : 'Salida'}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="cantidad"
              className="mb-1 block text-sm font-medium"
            >
              Cantidad
            </label>
            <input
              id="cantidad"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              aria-invalid={mostrarError}
              aria-describedby="cantidad-ayuda"
              autoFocus
              className={`w-full rounded-md border px-3 py-2 ${
                mostrarError ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            <p
              id="cantidad-ayuda"
              className={`mt-1 text-sm ${mostrarError ? 'text-red-700' : 'text-gray-500'}`}
            >
              {mostrarError
                ? error
                : stockResultante !== null
                  ? `Stock: ${producto.stockActual} → ${stockResultante}`
                  : 'Unidades enteras.'}
            </p>
          </div>

          <div>
            <label htmlFor="motivo" className="mb-1 block text-sm font-medium">
              Motivo{' '}
              <span className="font-normal text-gray-500">(opcional)</span>
            </label>
            <input
              id="motivo"
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                tipo === 'entrada' ? 'Ej.: compra a proveedor' : 'Ej.: venta'
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          {/* Cancelar a la izquierda, acción principal a la derecha: donde termina la lectura */}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={error !== null}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Registrar {tipo}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
