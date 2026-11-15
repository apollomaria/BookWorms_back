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

// Maior valor que cabe em uma coluna integer do PostgreSQL (limite TÉCNICO, não
// regra de negócio).
const INT_MAX = 2147483647;

/**
 * Corpo de POST /reading-logs (UC002 / RF 010).
 * Cada decorator abaixo vira uma mensagem 400 se o dado for inválido; as regras que
 * dependem do banco (livro/total de páginas) ficam no service.
 */
export class CreateReadingLogDto {
  // Quem está registrando. Sem token nesta versão: o frontend envia o id que
  // recebeu no login (ver docs: limitação conhecida).
  @IsInt({ message: 'O usuário informado é inválido.' })
  @Min(1, { message: 'O usuário informado é inválido.' })
  @Max(INT_MAX, { message: 'O usuário informado é inválido.' })
  usuarioId: number;

  @IsString({ message: 'O título do livro deve ser um texto.' })
  @IsNotEmpty({ message: 'O título do livro é obrigatório.' })
  @MaxLength(200, { message: 'O título do livro deve ter no máximo 200 caracteres.' })
  tituloLivro: string;

  @IsInt({ message: 'As páginas lidas devem ser um número inteiro.' })
  @Min(1, { message: 'As páginas lidas devem ser pelo menos 1.' })
  @Max(INT_MAX, { message: 'Quantidade de páginas lidas inválida.' })
  paginasLidas: number;

  // Opcional: o catálogo mínimo só conhece o total se alguém já o informou.
  @IsOptional()
  @IsInt({ message: 'O total de páginas deve ser um número inteiro.' })
  @Min(1, { message: 'O total de páginas deve ser pelo menos 1.' })
  @Max(INT_MAX, { message: 'Total de páginas inválido.' })
  totalPaginas?: number;

  @IsString({ message: 'A data da leitura deve ser um texto no formato AAAA-MM-DD.' })
  @IsNotEmpty({ message: 'A data da leitura é obrigatória.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'A data da leitura deve estar no formato AAAA-MM-DD.',
  })
  dataLeitura: string;

  @IsOptional()
  @IsInt({ message: 'Os minutos lidos devem ser um número inteiro.' })
  @Min(0, { message: 'Os minutos lidos não podem ser negativos.' })
  @Max(INT_MAX, { message: 'Quantidade de minutos inválida.' })
  minutosLidos?: number;

  @IsOptional()
  @IsString({ message: 'As anotações devem ser um texto.' })
  anotacoes?: string;
}
