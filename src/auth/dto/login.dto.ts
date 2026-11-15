import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Corpo de POST /auth/login (UC001 / RF 006).
 * `login` aceita e-mail OU nome de usuário, como pede o fluxo do documento.
 */
export class LoginDto {
  @IsString({ message: 'O e-mail ou nome de usuário deve ser um texto.' })
  @IsNotEmpty({ message: 'Informe o e-mail ou o nome de usuário.' })
  @MaxLength(254, { message: 'O e-mail ou nome de usuário é longo demais.' })
  login: string;

  @IsString({ message: 'A senha deve ser um texto.' })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  senha: string;
}
