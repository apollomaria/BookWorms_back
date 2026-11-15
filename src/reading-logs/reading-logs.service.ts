/**
 * UC002 – Gerenciar Registros de Leitura (RF 010 a RF 013).
 *
 * Tabelas: registros_leitura (o registro) e livros (catálogo mínimo: título e,
 * quando conhecido, total de páginas). Ver database/migrations/001_*.sql.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { lerDataCivil } from '../users/idade';
import { CreateReadingLogDto } from './dto/create-reading-log.dto';
import { UpdateReadingLogDto } from './dto/update-reading-log.dto';

// Colunas devolvidas ao cliente. to_char entrega a data como texto AAAA-MM-DD, para
// o JavaScript não aplicar fuso horário e "voltar" um dia.
const SELECT_REGISTRO = `
  SELECT r.id, r.usuario_id, r.livro_id,
         l.titulo AS titulo_livro, l.total_paginas,
         r.paginas_lidas,
         to_char(r.data_leitura, 'YYYY-MM-DD') AS data_leitura,
         r.minutos_lidos, r.anotacoes, r.criado_em, r.atualizado_em
    FROM registros_leitura r
    JOIN livros l ON l.id = r.livro_id`;

@Injectable()
export class ReadingLogsService {
  constructor(private readonly databaseService: DatabaseService) {}

  // ------------------------------------------------------------------ RF 010
  async criar(dados: CreateReadingLogDto) {
    // Pré-condição: usuário autenticado (existe e está ativo).
    await this.exigirUsuarioAtivo(dados.usuarioId);

    const titulo = dados.tituloLivro.trim();
    if (!titulo) {
      throw new BadRequestException('O título do livro é obrigatório.');
    }
    this.exigirDataValida(dados.dataLeitura);

    // Pré-condição: o livro existir no catálogo. No catálogo mínimo, um título novo
    // é cadastrado na hora (find-or-create).
    const livro = await this.obterOuCriarLivro(titulo, dados.totalPaginas);

    // Passo 3 do fluxo e A1: páginas lidas não podem exceder o total do livro.
    this.exigirPaginasDentroDoTotal(dados.paginasLidas, livro.total_paginas);

    const inserido = await this.databaseService.query(
      `INSERT INTO registros_leitura
              (usuario_id, livro_id, paginas_lidas, data_leitura, minutos_lidos, anotacoes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        dados.usuarioId,
        livro.id,
        dados.paginasLidas,
        dados.dataLeitura,
        dados.minutosLidos ?? 0,
        dados.anotacoes?.trim() ?? '',
      ],
    );

    // Passo 4 do fluxo cita "atualizar estatísticas e EXP". Nenhuma regra de EXP
    // existe nos documentos recebidos (UC016 está fora do escopo), então NÃO
    // inventamos cálculo: o EXP do usuário não é alterado. Pendência documentada.
    const registro = await this.buscarDoUsuario(inserido.rows[0].id, dados.usuarioId);
    return { mensagem: 'Registro de leitura salvo com sucesso!', registro };
  }

  // ------------------------------------------------------------------ RF 011
  async listar(usuarioId: number) {
    await this.exigirUsuarioAtivo(usuarioId);

    const resultado = await this.databaseService.query(
      `${SELECT_REGISTRO}
        WHERE r.usuario_id = $1
        ORDER BY r.data_leitura DESC, r.id DESC`,
      [usuarioId],
    );

    // A1: sem registros -> lista vazia (o frontend mostra a mensagem indicativa).
    return { registros: resultado.rows };
  }

  async detalhar(id: number, usuarioId: number) {
    await this.exigirUsuarioAtivo(usuarioId);
    const registro = await this.buscarDoUsuario(id, usuarioId);
    return { registro };
  }

  // ------------------------------------------------------------------ RF 012
  async atualizar(id: number, dados: UpdateReadingLogDto) {
    await this.exigirUsuarioAtivo(dados.usuarioId);
    // Pré-condição: o usuário ser o autor (404 se não existe, 403 se é de outra pessoa).
    const atual = await this.buscarDoUsuario(id, dados.usuarioId);

    // Mistura o que veio na requisição com o que já estava gravado.
    let livroId: number = atual.livro_id;
    let totalPaginas: number | null = atual.total_paginas;

    const tituloNovo = dados.tituloLivro?.trim();
    if (dados.tituloLivro !== undefined && !tituloNovo) {
      throw new BadRequestException('O título do livro não pode ficar vazio.');
    }
    if (tituloNovo && tituloNovo.toLowerCase() !== atual.titulo_livro.toLowerCase()) {
      const livro = await this.obterOuCriarLivro(tituloNovo, dados.totalPaginas);
      livroId = livro.id;
      totalPaginas = livro.total_paginas;
    } else if (dados.totalPaginas !== undefined && totalPaginas === null) {
      // Mesmo livro, e agora o total passou a ser conhecido.
      const livro = await this.obterOuCriarLivro(atual.titulo_livro, dados.totalPaginas);
      totalPaginas = livro.total_paginas;
    }

    const paginasLidas = dados.paginasLidas ?? atual.paginas_lidas;
    const dataLeitura = dados.dataLeitura ?? atual.data_leitura;
    if (dados.dataLeitura !== undefined) this.exigirDataValida(dados.dataLeitura);

    // A1: dados inconsistentes -> 400 e o usuário ajusta.
    this.exigirPaginasDentroDoTotal(paginasLidas, totalPaginas);

    await this.databaseService.query(
      `UPDATE registros_leitura
          SET livro_id = $1, paginas_lidas = $2, data_leitura = $3,
              minutos_lidos = $4, anotacoes = $5, atualizado_em = now()
        WHERE id = $6 AND usuario_id = $7`,
      [
        livroId,
        paginasLidas,
        dataLeitura,
        dados.minutosLidos ?? atual.minutos_lidos,
        dados.anotacoes !== undefined ? dados.anotacoes.trim() : atual.anotacoes,
        id,
        dados.usuarioId,
      ],
    );

    const registro = await this.buscarDoUsuario(id, dados.usuarioId);
    return { mensagem: 'Registro de leitura atualizado com sucesso!', registro };
  }

  // ------------------------------------------------------------------ RF 013
  // A confirmação do usuário (passo 1 e 2 / A1 cancelamento) é feita na tela; a API
  // só recebe o pedido já confirmado.
  async excluir(id: number, usuarioId: number) {
    await this.exigirUsuarioAtivo(usuarioId);
    await this.buscarDoUsuario(id, usuarioId); // 404/403 se não for o autor

    await this.databaseService.query(
      'DELETE FROM registros_leitura WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId],
    );

    // "Recalcula o progresso de leitura": não há progresso persistido nesta versão
    // (nada a recalcular). Pendência documentada.
    return { mensagem: 'Registro de leitura excluído com sucesso!' };
  }

  // ------------------------------------------------------------- auxiliares
  private async exigirUsuarioAtivo(usuarioId: number) {
    const r = await this.databaseService.query(
      'SELECT id FROM usuarios WHERE id = $1 AND ativo = true',
      [usuarioId],
    );
    if (r.rows.length === 0) {
      throw new UnauthorizedException(
        'Usuário não autenticado ou conta inexistente/desativada.',
      );
    }
  }

  private exigirDataValida(data: string) {
    if (!lerDataCivil(data)) {
      throw new BadRequestException('A data da leitura informada é inválida.');
    }
  }

  private exigirPaginasDentroDoTotal(paginasLidas: number, total: number | null) {
    if (total !== null && paginasLidas > total) {
      throw new BadRequestException(
        `As páginas lidas (${paginasLidas}) excedem o total de páginas do livro (${total}).`,
      );
    }
  }

  // Devolve o registro se for do usuário; 404 se não existir; 403 se for de outro.
  private async buscarDoUsuario(id: number, usuarioId: number) {
    const r = await this.databaseService.query(`${SELECT_REGISTRO} WHERE r.id = $1`, [id]);
    const registro = r.rows[0];
    if (!registro) {
      throw new NotFoundException('Registro de leitura não encontrado.');
    }
    if (registro.usuario_id !== usuarioId) {
      throw new ForbiddenException('Você só pode acessar os seus próprios registros.');
    }
    return registro;
  }

  /**
   * Catálogo mínimo (find-or-create por título, sem diferenciar maiúsculas):
   *  - livro existe: devolve; se o total ainda era desconhecido e agora foi
   *    informado, grava o total. Um total já conhecido NÃO é sobrescrito.
   *  - livro não existe: cria. ON CONFLICT cobre duas requisições simultâneas
   *    criando o mesmo título.
   */
  private async obterOuCriarLivro(titulo: string, totalPaginas?: number) {
    await this.databaseService.query(
      `INSERT INTO livros (titulo, total_paginas) VALUES ($1, $2)
       ON CONFLICT ((lower(titulo))) DO NOTHING`,
      [titulo, totalPaginas ?? null],
    );

    if (totalPaginas !== undefined) {
      await this.databaseService.query(
        `UPDATE livros SET total_paginas = $2
          WHERE lower(titulo) = lower($1) AND total_paginas IS NULL`,
        [titulo, totalPaginas],
      );
    }

    const r = await this.databaseService.query(
      'SELECT id, titulo, total_paginas FROM livros WHERE lower(titulo) = lower($1)',
      [titulo],
    );
    return r.rows[0] as { id: number; titulo: string; total_paginas: number | null };
  }
}
