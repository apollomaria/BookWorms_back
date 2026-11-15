import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarApp } from './../src/app.setup';
import { DatabaseService } from './../src/database/database.service';

/**
 * UC002 e UC001 (login/consulta) pelo caminho HTTP completo, com um banco em memória
 * que imita as consultas do service. Não substitui o teste no PostgreSQL real
 * (feito via Postman/Newman e pelo navegador), mas cobre status e regras.
 */
class BancoFalso {
  usuarios = [
    { id: 1, ativo: true },
    { id: 2, ativo: true },
    { id: 3, ativo: false },
  ];
  livros: { id: number; titulo: string; total_paginas: number | null }[] = [];
  registros: any[] = [];
  private seqRegistro = 1;

  private visao(r: any) {
    const l = this.livros.find((x) => x.id === r.livro_id)!;
    return { ...r, titulo_livro: l.titulo, total_paginas: l.total_paginas };
  }

  async query(sql: string, p: any[] = []) {
    const s = sql.replace(/\s+/g, ' ');
    if (s.includes('FROM usuarios WHERE id = $1 AND ativo = true')) {
      return { rows: this.usuarios.filter((u) => u.id === p[0] && u.ativo).map((u) => ({ id: u.id })) };
    }
    if (s.includes('INSERT INTO livros')) {
      if (!this.livros.some((l) => l.titulo.toLowerCase() === p[0].toLowerCase())) {
        this.livros.push({ id: this.livros.length + 1, titulo: p[0], total_paginas: p[1] });
      }
      return { rows: [] };
    }
    if (s.includes('UPDATE livros SET total_paginas')) {
      const l = this.livros.find((x) => x.titulo.toLowerCase() === p[0].toLowerCase());
      if (l && l.total_paginas === null) l.total_paginas = p[1];
      return { rows: [] };
    }
    if (s.includes('FROM livros WHERE lower(titulo)')) {
      return { rows: this.livros.filter((l) => l.titulo.toLowerCase() === p[0].toLowerCase()) };
    }
    if (s.includes('INSERT INTO registros_leitura')) {
      const r = { id: this.seqRegistro++, usuario_id: p[0], livro_id: p[1], paginas_lidas: p[2], data_leitura: p[3], minutos_lidos: p[4], anotacoes: p[5], criado_em: 'x', atualizado_em: 'x' };
      this.registros.push(r);
      return { rows: [{ id: r.id }] };
    }
    if (s.includes('WHERE r.id = $1')) {
      return { rows: this.registros.filter((r) => r.id === p[0]).map((r) => this.visao(r)) };
    }
    if (s.includes('WHERE r.usuario_id = $1')) {
      return { rows: this.registros.filter((r) => r.usuario_id === p[0]).map((r) => this.visao(r)) };
    }
    if (s.includes('UPDATE registros_leitura')) {
      const r = this.registros.find((x) => x.id === p[5] && x.usuario_id === p[6])!;
      Object.assign(r, { livro_id: p[0], paginas_lidas: p[1], data_leitura: p[2], minutos_lidos: p[3], anotacoes: p[4] });
      return { rows: [] };
    }
    if (s.includes('DELETE FROM registros_leitura')) {
      this.registros = this.registros.filter((r) => !(r.id === p[0] && r.usuario_id === p[1]));
      return { rows: [] };
    }
    throw new Error('Consulta não prevista no BancoFalso: ' + s);
  }
}

describe('UC002 – /reading-logs', () => {
  let app: INestApplication<App>;
  let banco: BancoFalso;
  const base = { usuarioId: 1, tituloLivro: 'Pessoas Normais', paginasLidas: 45, dataLeitura: '2026-10-22', minutosLidos: 35, anotacoes: 'ótimo' };

  beforeEach(async () => {
    banco = new BancoFalso();
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(banco)
      .compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('RF 010: cria registro (201) e cadastra o livro no catálogo mínimo', async () => {
    const res = await http().post('/reading-logs').send(base).expect(201);
    expect(res.body.registro).toMatchObject({ id: 1, usuario_id: 1, titulo_livro: 'Pessoas Normais', paginas_lidas: 45, minutos_lidos: 35, total_paginas: null });
    expect(banco.livros).toHaveLength(1);
  });

  it('RF 010: reaproveita o livro (sem diferenciar maiúsculas)', async () => {
    await http().post('/reading-logs').send(base).expect(201);
    await http().post('/reading-logs').send({ ...base, tituloLivro: 'PESSOAS NORMAIS' }).expect(201);
    expect(banco.livros).toHaveLength(1);
  });

  it('RF 010 A1: páginas acima do total conhecido -> 400', async () => {
    await http().post('/reading-logs').send({ ...base, totalPaginas: 100 }).expect(201);
    const res = await http().post('/reading-logs').send({ ...base, paginasLidas: 101 }).expect(400);
    expect(res.body.message).toMatch(/excedem o total/);
  });

  it('RF 010: sem total conhecido, qualquer quantidade positiva é aceita (limitação documentada)', async () => {
    await http().post('/reading-logs').send({ ...base, paginasLidas: 9999 }).expect(201);
  });

  it.each([
    ['usuário inexistente', { usuarioId: 99 }, 401],
    ['usuário desativado', { usuarioId: 3 }, 401],
    ['data inexistente', { dataLeitura: '2026-02-31' }, 400],
    ['data em formato errado', { dataLeitura: '22/10/2026' }, 400],
    ['páginas zero', { paginasLidas: 0 }, 400],
    ['páginas decimais', { paginasLidas: 1.5 }, 400],
    ['título vazio', { tituloLivro: '   ' }, 400],
    ['título > 200', { tituloLivro: 'a'.repeat(201) }, 400],
    ['minutos negativos', { minutosLidos: -1 }, 400],
  ])('RF 010: %s -> %i', async (_n, alteracao, status) => {
    await http().post('/reading-logs').send({ ...base, ...alteracao }).expect(status);
  });

  it('RF 011: lista só os registros do próprio usuário; sem registros devolve lista vazia', async () => {
    await http().post('/reading-logs').send(base).expect(201);
    const meus = await http().get('/reading-logs/user/1').expect(200);
    expect(meus.body.registros).toHaveLength(1);
    const deOutro = await http().get('/reading-logs/user/2').expect(200);
    expect(deOutro.body.registros).toEqual([]);
  });

  it('RF 011: detalhe do próprio (200), de outro (403), inexistente (404), sem usuarioId (400)', async () => {
    await http().post('/reading-logs').send(base).expect(201);
    await http().get('/reading-logs/1?usuarioId=1').expect(200);
    await http().get('/reading-logs/1?usuarioId=2').expect(403);
    await http().get('/reading-logs/55?usuarioId=1').expect(404);
    await http().get('/reading-logs/1').expect(400);
  });

  it('RF 012: só o autor edita; excesso de páginas é 400', async () => {
    await http().post('/reading-logs').send({ ...base, totalPaginas: 100 }).expect(201);
    const ok = await http().put('/reading-logs/1').send({ usuarioId: 1, paginasLidas: 60, anotacoes: 'novo' }).expect(200);
    expect(ok.body.registro).toMatchObject({ paginas_lidas: 60, anotacoes: 'novo', minutos_lidos: 35 });
    await http().put('/reading-logs/1').send({ usuarioId: 2, paginasLidas: 5 }).expect(403);
    await http().put('/reading-logs/1').send({ usuarioId: 1, paginasLidas: 101 }).expect(400);
    await http().put('/reading-logs/1').send({ paginasLidas: 5 }).expect(400); // sem usuarioId
  });

  it('RF 012: trocar o título aponta para outro livro', async () => {
    await http().post('/reading-logs').send(base).expect(201);
    const r = await http().put('/reading-logs/1').send({ usuarioId: 1, tituloLivro: 'O Hobbit' }).expect(200);
    expect(r.body.registro.titulo_livro).toBe('O Hobbit');
    expect(banco.livros).toHaveLength(2);
  });

  it('RF 013: só o autor exclui; depois, 404', async () => {
    await http().post('/reading-logs').send(base).expect(201);
    await http().delete('/reading-logs/1?usuarioId=2').expect(403);
    await http().delete('/reading-logs/1?usuarioId=1').expect(200);
    await http().delete('/reading-logs/1?usuarioId=1').expect(404);
    expect(banco.registros).toHaveLength(0);
  });
});
