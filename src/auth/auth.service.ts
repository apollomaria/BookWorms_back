import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';

// Mesma mensagem para "usuário não existe" e "senha errada": assim quem tenta
// adivinhar credenciais não descobre quais e-mails/nomes estão cadastrados.
const MSG_CREDENCIAIS_INVALIDAS =
  'E-mail/nome de usuário ou senha incorretos.';

// Hash de uma senha qualquer, usado só para gastar o mesmo tempo de CPU quando o
// usuário não existe (evita revelar a existência da conta pelo tempo de resposta).
const HASH_FALSO = bcrypt.hashSync('senha-que-nunca-sera-usada', 10);

@Injectable()
export class AuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * RF 006 – login. Fluxo principal: valida as credenciais comparando o HASH da
   * senha com o que está no banco (RN-012).
   * A1: credenciais inválidas -> 401.
   * A2: conta desativada (RN-005) -> 403.
   *
   * Observação: esta versão NÃO emite token. O frontend guarda o usuário devolvido
   * e envia o `usuarioId` nas próximas chamadas (decisão do grupo; ver docs).
   */
  async login(dados: LoginDto) {
    const login = dados.login.trim();

    // Procura por e-mail OU nome de usuário, sem diferenciar maiúsculas.
    // O ORDER BY prefere a linha cujo e-mail bate, caso um nome de usuário
    // coincida com o e-mail de outra pessoa.
    const resultado = await this.databaseService.query(
      `SELECT id, nome_usuario, email, senha_hash, ativo,
              to_char(data_nascimento, 'YYYY-MM-DD') AS data_nascimento,
              nivel, exp, criado_em
         FROM usuarios
        WHERE lower(email) = lower($1) OR lower(nome_usuario) = lower($1)
        ORDER BY (lower(email) = lower($1)) DESC
        LIMIT 1`,
      [login],
    );

    const usuario = resultado.rows[0];

    // bcrypt.compare refaz o hash da senha digitada e compara com o guardado.
    const senhaConfere = await bcrypt.compare(
      dados.senha,
      usuario ? usuario.senha_hash : HASH_FALSO,
    );

    if (!usuario || !senhaConfere) {
      throw new UnauthorizedException(MSG_CREDENCIAIS_INVALIDAS);
    }

    // A2: só revelamos que a conta está desativada a quem acertou a senha.
    if (!usuario.ativo) {
      throw new ForbiddenException(
        'Esta conta está desativada e não pode entrar no momento.',
      );
    }

    // Nunca devolvemos senha_hash.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { senha_hash, ativo, ...usuarioPublico } = usuario;
    return { mensagem: 'Login realizado com sucesso!', usuario: usuarioPublico };
  }
}
