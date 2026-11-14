import { Controller, Get, Query } from '@nestjs/common';
import { ProductosService } from './productos.service';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  // GET /productos y GET /productos?categoria=electronica
  @Get()
  listar(@Query('categoria') categoria?: string) {
    return this.productosService.listar(categoria);
  }
}
