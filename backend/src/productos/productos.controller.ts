import { Controller, Get, Query } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { ListarProductosQuery } from './dto/listar-productos.query';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  // GET /productos y GET /productos?categoria=electronica
  // El DTO valida y normaliza el query antes de llegar acá (ValidationPipe global).
  @Get()
  listar(@Query() query: ListarProductosQuery) {
    return this.productosService.listar(query.categoria);
  }
}
