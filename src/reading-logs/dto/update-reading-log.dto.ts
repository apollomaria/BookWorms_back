import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const INT_MAX = 2147483647;

/**
 * Corpo de PUT /reading-logs/:id (UC002 / RF 012).
 * Só `usuarioId` é obrigatório (para conferir que quem edita é o autor); os demais
 * campos são opcionais e, se enviados, substituem o valor atual.
 */
export class UpdateReadingLogDto {
  @IsInt({ message: 'O usuário informado é inválido.' })
  @Min(1, { message: 'O usuário informado é inválido.' })
  @Max(INT_MAX, { message: 'O usuário informado é inválido.' })
  usuarioId: number;

  @IsOptional()
  @IsString({ message: 'O título do livro deve ser um texto.' })
  @IsNotEmpty({ message: 'O título do livro não pode ficar vazio.' })
  @MaxLength(200, { message: 'O título do livro deve ter no máximo 200 caracteres.' })
  tituloLivro?: string;

  @IsOptional()
  @IsInt({ message: 'As páginas lidas devem ser um número inteiro.' })
  @Min(1, { message: 'As páginas lidas devem ser pelo menos 1.' })
  @Max(INT_MAX, { message: 'Quantidade de páginas lidas inválida.' })
  paginasLidas?: number;

  @IsOptional()
  @IsInt({ message: 'O total de páginas deve ser um número inteiro.' })
  @Min(1, { message: 'O total de páginas deve ser pelo menos 1.' })
  @Max(INT_MAX, { message: 'Total de páginas inválido.' })
  totalPaginas?: number;

  @IsOptional()
  @IsString({ message: 'A data da leitura deve ser um texto no formato AAAA-MM-DD.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'A data da leitura deve estar no formato AAAA-MM-DD.',
  })
  dataLeitura?: string;

  @IsOptional()
  @IsInt({ message: 'Os minutos lidos devem ser um número inteiro.' })
  @Min(0, { message: 'Os minutos lidos não podem ser negativos.' })
  @Max(INT_MAX, { message: 'Quantidade de minutos inválida.' })
  minutosLidos?: number;

  @IsOptional()
  @IsString({ message: 'As anotações devem ser um texto.' })
  anotacoes?: string;
}
