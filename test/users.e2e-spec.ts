import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarApp } from './../src/app.setup';
import { DatabaseService } from './../src/database/database.service';

/**
 * Testa o caminho HTTP completo do UC001 (rota -> validação -> controller ->
 * service) com um banco EM MEMÓRIA no lugar do PostgreSQL. Serve para conferir
 * códigos HTTP e formato das respostas sem tocar em nenhum banco real.
 * A verificação contra o PostgreSQL de verdade é feita pelo Postman.
 */
class BancoFalso {
  linhas: { id: number; nome_usuario: string; email: string; senha_hash: string; data_nascimento: string }[] = [];

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('INSERT INTO usuarios')) {
      const [nome, email, hash, data] = params as string[];
      const linha = { id: this.linhas.length + 1, nome_usuario: nome, email, senha_hash: hash, data_nascimento: data };
      this.linhas.push(linha);
      return { rows: [{ id: linha.id, nome_usuario: nome, email, data_nascimento: data, criado_em: new Date().toISOString() }] };
    }
    const [email, nome] = params as string[];
    return {
      rows: this.linhas
        .filter((l) => l.email.toLowerCase() === email.toLowerCase() || l.nome_usuario.toLowerCase() === nome.toLowerCase())
        .map((l) => ({
          email_repetido: l.email.toLowerCase() === email.toLowerCase(),
          nome_repetido: l.nome_usuario.toLowerCase() === nome.toLowerCase(),
        })),
    };
  }
}

describe('POST /users (UC001)', () => {
  let app: INestApplication<App>;
  let banco: BancoFalso;
  const corpo = {
    nome: 'leitora_teste',
    email: 'leitora@example.com',
    dataNascimento: '2000-05-20',
    senha: 'senha123',
    confirmarSenha: 'senha123',
  };

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

  const post = (b: object) => request(app.getHttpServer()).post('/users').send(b);

  it('201 e resposta sem senha/hash', async () => {
    const res = await post(corpo).expect(201);
    expect(res.body.mensagem).toBe('Usuário cadastrado com sucesso!');
    expect(Object.keys(res.body.usuario).sort()).toEqual(
      ['criado_em', 'data_nascimento', 'email', 'id', 'nome_usuario'],
    );
    expect(JSON.stringify(res.body)).not.toMatch(/senha|\$2/);
    expect(banco.linhas[0].senha_hash).not.toBe('senha123');
  });

  it('400 com lista de mensagens quando faltam campos', async () => {
    const res = await post({}).expect(400);
    expect(Array.isArray(res.body.message)).toBe(true);
    expect(res.body.message.length).toBeGreaterThanOrEqual(5);
  });

  it('400 para nome > 20, e-mail inválido, data inválida e senhas diferentes', async () => {
    await post({ ...corpo, nome: 'a'.repeat(21) }).expect(400);
    await post({ ...corpo, email: 'invalido' }).expect(400);
    await post({ ...corpo, dataNascimento: '2000-02-31' }).expect(400);
    await post({ ...corpo, dataNascimento: '2020-01-01' }).expect(400);
    await post({ ...corpo, confirmarSenha: 'diferente' }).expect(400);
  });

  it('409 para e-mail e nome duplicados (sem diferenciar maiúsculas)', async () => {
    await post(corpo).expect(201);
    await post({ ...corpo, nome: 'outro_nome' }).expect(409);
    await post({ ...corpo, email: 'outro@example.com', nome: 'LEITORA_TESTE' }).expect(409);
  });

  it('campos extras são descartados e não chegam ao banco', async () => {
    const res = await post({ ...corpo, nivel: 99, verificada: true }).expect(201);
    expect(res.body.usuario).not.toHaveProperty('nivel');
    expect(banco.linhas[0]).not.toHaveProperty('nivel');
  });
});
