import { Injectable } from '@nestjs/common';
import { ProductosRepository } from './productos.repository';

// Capa de lógica de negocio. Hoy solo delega, pero acá irían reglas como por ejemplo:
// calcular el stock bajo o registrar movimientos, sin tocar el controlador ni la consulta.
@Injectable()
export class ProductosService {
  constructor(private readonly productosRepository: ProductosRepository) {}

  listar(categoriaSlug?: string) {
    return this.productosRepository.listar(categoriaSlug);
  }
}
