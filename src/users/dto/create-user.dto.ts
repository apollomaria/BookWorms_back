/**
 * DTO = "Data Transfer Object" (objeto de transferência de dados).
 *
 * É uma classe que descreve o FORMATO do JSON que o frontend (ou o Postman)
 * deve enviar no cadastro. Ela não acessa o banco e não tem regras de negócio
 * complexas: só diz "quais campos existem" e "qual o formato aceitável de cada um".
 *
 * Como a validação acontece:
 *  1. O frontend envia um JSON no corpo (body) de POST /users.
 *  2. O ValidationPipe (configurado em src/app.setup.ts) transforma o JSON
 *     em uma instância desta classe e lê os "decorators" (@IsString, @IsEmail...).
 *  3. Se algum decorator reprovar, o Nest responde 400 (Bad Request) ANTES de
 *     chamar o controller/service, com a lista de mensagens abaixo.
 *
 * Decorators são as anotações com "@". Eles não executam nada sozinhos: só
 * deixam "etiquetas" (metadados) que a biblioteca class-validator lê depois.
 *
 * Regras de negócio mais complexas (idade mínima/máxima, duplicidade) NÃO ficam
 * aqui: ficam em users.service.ts, porque dependem de cálculo ou do banco.
 */
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateUserDto {
  // Vira a coluna "nome_usuario" (varchar(20)) no PostgreSQL.
  // O limite de 20 caracteres vem do banco; validar aqui evita deixar o
  // PostgreSQL rejeitar com um erro técnico.
  // Obs.: um nome só com espaços ("   ") é barrado no service, depois do trim().
  @IsString({ message: 'O nome deve ser um texto.' })
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  @MaxLength(20, { message: 'O nome deve ter no máximo 20 caracteres.' })
  nome: string;

  // Vira a coluna "email" (varchar(254)).
  @IsString({ message: 'O e-mail deve ser um texto.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  @IsEmail({}, { message: 'Informe um e-mail em formato válido.' })
  @MaxLength(254, { message: 'O e-mail deve ter no máximo 254 caracteres.' })
  email: string;

  // Vira a coluna "data_nascimento" (tipo date). Formato esperado: AAAA-MM-DD.
  // Aqui só conferimos o FORMATO. Se a data existe de verdade (ex.: 31/02 não
  // existe) e se a idade é permitida (RN-002) é conferido no service.
  @IsString({ message: 'A data de nascimento deve ser um texto no formato AAAA-MM-DD.' })
  @IsNotEmpty({ message: 'A data de nascimento é obrigatória.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'A data de nascimento deve estar no formato AAAA-MM-DD.',
  })
  dataNascimento: string;

  // A senha em texto puro só existe durante esta requisição. Ela NUNCA é gravada:
  // o service a transforma em hash antes do INSERT.
  // O limite de 72 é técnico: o bcrypt só considera os 72 primeiros bytes da
  // senha. Não é uma regra de negócio documentada (ver docs/uc001-cadastro.md).
  @IsString({ message: 'A senha deve ser um texto.' })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  senha: string;

  // Só serve para conferir se a pessoa digitou a mesma senha duas vezes (A4 do
  // UC001). Não existe coluna para ela no banco.
  @IsString({ message: 'A confirmação de senha deve ser um texto.' })
  @IsNotEmpty({ message: 'A confirmação de senha é obrigatória.' })
  confirmarSenha: string;
}
