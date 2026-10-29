/**
 * SERVICE = onde ficam as regras de negócio e o acesso ao banco.
 *
 * Caminho dos dados no cadastro (UC001 / RF 001):
 *
 *   Frontend/Postman --JSON--> Controller --DTO validado--> Service --SQL--> PostgreSQL
 *                                                              |
 *   Frontend/Postman <--JSON-- Controller <--resposta----------+
 *
 * O controller só recebe e devolve; quem decide é este arquivo.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import { calcularIdade, idadePermitida, lerDataCivil } from './idade';

// Quantas "rodadas" o bcrypt usa para gerar o hash. Quanto maior, mais lento
// (e mais difícil para um atacante testar senhas). 10 é um valor comum e
// equilibrado.
const RODADAS_BCRYPT = 10;

const MSG_EMAIL_DUPLICADO = 'Este e-mail já está cadastrado.';
const MSG_NOME_DUPLICADO = 'Este nome de usuário já está em uso.';

// Código que o PostgreSQL usa para "violação de índice/constraint UNIQUE".
const PG_UNIQUE_VIOLATION = '23505';

// @Injectable() avisa o Nest: "esta classe pode ser criada e entregue
// automaticamente a quem precisar dela" (injeção de dependência).
@Injectable()
export class UsersService {
  // Injeção de dependência: não fazemos "new DatabaseService()". Declaramos no
  // construtor que PRECISAMOS dele, e o Nest cria e entrega o objeto pronto.
  // Vantagem: nos testes podemos entregar um banco "de mentira".
  constructor(private readonly databaseService: DatabaseService) {}

  // Método de diagnóstico que já existia (GET /users/teste-conexao).
  // Não faz parte do UC001; foi preservado como estava.
  async testarConexao() {
    const resultado = await this.databaseService.query(
      'SELECT current_database() AS banco, current_user AS usuario',
    );

    return resultado.rows[0];
  }

  // "async" + "await": falar com o banco demora. Com await, a função espera a
  // resposta do banco, mas o servidor continua atendendo outras requisições.
  // `hoje` existe só para os testes poderem "congelar" a data; no uso normal
  // fica o valor padrão (a data atual).
  async cadastrar(dados: CreateUserDto, hoje: Date = new Date()) {
    // ---------- 1. Limpeza dos dados ----------
    // trim() remove espaços no começo/fim. O e-mail é guardado em minúsculas
    // para "Maria@x.com" e "maria@x.com" serem tratados como o mesmo e-mail.
    const nomeLimpo = dados.nome.trim();
    const emailNormalizado = dados.email.trim().toLowerCase();

    // ---------- 2. Regras que não precisam do banco ----------
    // A1 do UC001: campos em branco (inclui nome só com espaços).
    // O DTO já barra campos ausentes; aqui cobrimos o "só espaços".
    if (!nomeLimpo || !emailNormalizado) {
      throw new BadRequestException('Todos os campos são obrigatórios.');
    }

    // A4 do UC001: senhas divergentes.
    if (dados.senha !== dados.confirmarSenha) {
      throw new BadRequestException('As senhas não coincidem.');
    }

    // RN-002: faixa etária. Primeiro, a data precisa existir no calendário.
    const nascimento = lerDataCivil(dados.dataNascimento);
    if (!nascimento) {
      throw new BadRequestException('A data de nascimento informada é inválida.');
    }
    const idade = calcularIdade(nascimento, {
      ano: hoje.getFullYear(),
      mes: hoje.getMonth() + 1,
      dia: hoje.getDate(),
    });
    if (!idadePermitida(idade)) {
      throw new BadRequestException(
        'A idade deve ser maior que 13 e menor que 150 anos.',
      );
    }

    // NÃO implementado (sem fonte de regra): RN-003/A2, verificação de nome
    // ofensivo. A documentação não traz a lista de palavras proibidas.
    // Pendência registrada em docs/uc001-cadastro.md.

    // ---------- 3. Duplicidade (A3 do UC001 e e-mail único) ----------
    // $1 e $2 são "parâmetros": o valor vai separado do texto SQL e o driver
    // `pg` se encarrega de enviá-lo com segurança. Isso impede SQL injection
    // (nunca montamos SQL concatenando texto vindo do usuário).
    // lower(...) compara sem diferenciar maiúsculas/minúsculas, igual aos
    // índices únicos do banco.
    const existentes = await this.databaseService.query(
      `SELECT (lower(email) = lower($1)) AS email_repetido,
              (lower(nome_usuario) = lower($2)) AS nome_repetido
         FROM usuarios
        WHERE lower(email) = lower($1)
           OR lower(nome_usuario) = lower($2)`,
      [emailNormalizado, nomeLimpo],
    );
    // `rows` é uma lista com uma posição por linha encontrada (vazia = nada).
    if (existentes.rows.some((linha) => linha.email_repetido)) {
      throw new ConflictException(MSG_EMAIL_DUPLICADO);
    }
    if (existentes.rows.some((linha) => linha.nome_repetido)) {
      throw new ConflictException(MSG_NOME_DUPLICADO);
    }

    // ---------- 4. Proteção da senha (RN-012) ----------
    // Hash é uma transformação de mão única: do hash não se recupera a senha.
    // O bcrypt ainda mistura um "sal" aleatório, então duas pessoas com a mesma
    // senha terminam com hashes diferentes. Só o hash vai para o banco.
    const senhaHash = await bcrypt.hash(dados.senha, RODADAS_BCRYPT);

    // ---------- 5. Gravação ----------
    try {
      // Só informamos as 4 colunas que vêm do formulário. As demais (nivel,
      // exp, tema, verificada, ativo, criado_em...) usam os valores padrão
      // definidos no banco.
      // RETURNING devolve a linha criada, mas escolhemos só colunas seguras:
      // senha_hash NUNCA é devolvido. to_char entrega a data como texto
      // AAAA-MM-DD, evitando que o JavaScript a converta com fuso horário
      // (o que poderia mostrar o dia anterior).
      const resultado = await this.databaseService.query(
        `INSERT INTO usuarios (nome_usuario, email, senha_hash, data_nascimento)
         VALUES ($1, $2, $3, $4)
         RETURNING id,
                   nome_usuario,
                   email,
                   to_char(data_nascimento, 'YYYY-MM-DD') AS data_nascimento,
                   criado_em`,
        [nomeLimpo, emailNormalizado, senhaHash, dados.dataNascimento],
      );

      return {
        mensagem: 'Usuário cadastrado com sucesso!',
        usuario: resultado.rows[0],
      };
    } catch (erro: unknown) {
      // Duas pessoas podem enviar o mesmo e-mail ao mesmo tempo: as duas passam
      // pela checagem do passo 3 e só uma consegue gravar. Nesse caso o banco
      // recusa a segunda com o código 23505 e traduzimos para 409, em vez de
      // deixar vazar um erro 500.
      if (this.ehViolacaoDeUnicidade(erro)) {
        throw new ConflictException(this.mensagemDeDuplicidade(erro));
      }

      // Qualquer outro erro é inesperado: relançamos e o Nest responde 500
      // (Internal Server Error) sem expor detalhes ao cliente.
      throw erro;
    }
  }

  private ehViolacaoDeUnicidade(erro: unknown): boolean {
    return (
      typeof erro === 'object' &&
      erro !== null &&
      'code' in erro &&
      erro.code === PG_UNIQUE_VIOLATION
    );
  }

  // Descobre qual índice único foi violado olhando o nome da constraint e o
  // detalhe do erro do PostgreSQL. Se não der para saber, usa mensagem genérica.
  private mensagemDeDuplicidade(erro: unknown): string {
    const texto = ['constraint', 'detail']
      .map((campo) =>
        typeof erro === 'object' && erro !== null && campo in erro
          ? String((erro as Record<string, unknown>)[campo])
          : '',
      )
      .join(' ')
      .toLowerCase();

    if (texto.includes('email')) return MSG_EMAIL_DUPLICADO;
    if (texto.includes('nome')) return MSG_NOME_DUPLICADO;
    return 'E-mail ou nome de usuário já cadastrado.';
  }
}
