import { Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';

// Valida lo que llega por la URL: los tipos de TypeScript no existen en ejecución,
// así que sin esto ?categoria=a&categoria=b llegaría como array.
export class ListarProductosQuery {
  @IsOptional()
  // normaliza: "Electronica " se busca como "electronica"
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^[a-z0-9-]+$/, {
    message: 'categoria debe ser un slug: minúsculas, números y guiones',
  })
  categoria?: string;
}
