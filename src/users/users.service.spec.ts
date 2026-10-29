import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { UsersService } from './users.service';

// Testes de unidade: o banco é substituído por um "dublê" (jest.fn), então
// nenhum PostgreSQL é necessário e nada é gravado em lugar nenhum.
describe('UsersService.cadastrar (UC001)', () => {
  let service: UsersService;
  const query = jest.fn();
  const hoje = new Date(2026, 5, 15); // 15/06/2026, fixo para os testes

  const dadosValidos = () => ({
    nome: '  Leitora_Teste  ',
    email: '  Leitora@Example.COM ',
    dataNascimento: '2000-05-20',
    senha: 'senha123',
    confirmarSenha: 'senha123',
  });

  beforeEach(async () => {
    query.mockReset();
    const modulo: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: DatabaseService, useValue: { query } }],
    }).compile();
    service = modulo.get(UsersService);
  });

  function bancoSemDuplicados() {
    query
      .mockResolvedValueOnce({ rows: [] }) // SELECT de duplicidade
      .mockImplementationOnce(async (_sql: string, params: unknown[]) => ({
        rows: [
          {
            id: 1,
            nome_usuario: params[0],
            email: params[1],
            data_nascimento: params[3],
            criado_em: new Date().toISOString(),
          },
        ],
      }));
  }

  it('cadastra, normaliza nome/e-mail e não devolve senha nem hash', async () => {
    bancoSemDuplicados();

    const resposta = await service.cadastrar(dadosValidos(), hoje);

    expect(resposta.mensagem).toBe('Usuário cadastrado com sucesso!');
    expect(resposta.usuario.nome_usuario).toBe('Leitora_Teste');
    expect(resposta.usuario.email).toBe('leitora@example.com');
    const json = JSON.stringify(resposta);
    expect(json).not.toContain('senha');
    expect(json).not.toContain('$2'); // prefixo de hashes bcrypt
  });

  it('grava um hash bcrypt válido, nunca a senha em texto puro', async () => {
    bancoSemDuplicados();
    await service.cadastrar(dadosValidos(), hoje);

    const [sql, params] = query.mock.calls[1] as [string, string[]];
    expect(sql).toContain('INSERT INTO usuarios');
    expect(params).not.toContain('senha123');
    expect(await bcrypt.compare('senha123', params[2])).toBe(true);
  });

  it('usa apenas consultas parametrizadas', async () => {
    bancoSemDuplicados();
    await service.cadastrar(dadosValidos(), hoje);
    for (const [sql] of query.mock.calls as [string][]) {
      expect(sql).not.toContain('leitora');
      expect(sql).toMatch(/\$1/);
    }
  });

  it('A4: rejeita senhas diferentes sem consultar o banco', async () => {
    const dados = { ...dadosValidos(), confirmarSenha: 'outra' };
    await expect(service.cadastrar(dados, hoje)).rejects.toThrow(
      new BadRequestException('As senhas não coincidem.'),
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('A1: rejeita nome formado só por espaços', async () => {
    await expect(
      service.cadastrar({ ...dadosValidos(), nome: '    ' }, hoje),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejeita data de nascimento inexistente (31/02)', async () => {
    await expect(
      service.cadastrar({ ...dadosValidos(), dataNascimento: '2000-02-31' }, hoje),
    ).rejects.toThrow('A data de nascimento informada é inválida.');
  });

  it.each([
    ['13 anos completos (2013-06-15)', '2013-06-15', false],
    ['14 anos completos (2012-06-15)', '2012-06-15', true],
    ['faltando 1 dia para os 14 (2012-06-16)', '2012-06-16', false],
    ['149 anos (1877-06-15)', '1877-06-15', true],
    ['150 anos (1876-06-15)', '1876-06-15', false],
    ['data futura (2030-01-01)', '2030-01-01', false],
  ])('RN-002: %s', async (_nome, data, deveAceitar) => {
    if (deveAceitar) bancoSemDuplicados();
    const promessa = service.cadastrar({ ...dadosValidos(), dataNascimento: data }, hoje);
    if (deveAceitar) {
      await expect(promessa).resolves.toBeDefined();
    } else {
      await expect(promessa).rejects.toThrow(
        /idade deve ser maior que 13|data de nascimento informada é inválida/,
      );
    }
  });

  it('409 quando o e-mail já existe', async () => {
    query.mockResolvedValueOnce({ rows: [{ email_repetido: true, nome_repetido: false }] });
    await expect(service.cadastrar(dadosValidos(), hoje)).rejects.toThrow(
      new ConflictException('Este e-mail já está cadastrado.'),
    );
    expect(query).toHaveBeenCalledTimes(1); // não chegou ao INSERT
  });

  it('A3: 409 quando o nome de usuário já existe', async () => {
    query.mockResolvedValueOnce({ rows: [{ email_repetido: false, nome_repetido: true }] });
    await expect(service.cadastrar(dadosValidos(), hoje)).rejects.toThrow(
      new ConflictException('Este nome de usuário já está em uso.'),
    );
  });

  describe('corrida entre duas requisições (erro 23505 do PostgreSQL)', () => {
    it.each([
      ['e-mail', { code: '23505', constraint: 'usuarios_email_lower_idx', detail: 'Key (lower(email::text))=(a@a.com) already exists.' }, 'Este e-mail já está cadastrado.'],
      ['nome', { code: '23505', constraint: 'usuarios_nome_usuario_lower_idx', detail: 'Key (lower(nome_usuario::text))=(a) already exists.' }, 'Este nome de usuário já está em uso.'],
      ['desconhecido', { code: '23505' }, 'E-mail ou nome de usuário já cadastrado.'],
    ])('traduz duplicidade de %s para 409', async (_n, erroPg, mensagem) => {
      query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(erroPg);
      await expect(service.cadastrar(dadosValidos(), hoje)).rejects.toThrow(
        new ConflictException(mensagem),
      );
    });

    it('relança erros inesperados do banco (viram 500)', async () => {
      const erro = { code: '08006', message: 'conexão perdida' };
      query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(erro);
      await expect(service.cadastrar(dadosValidos(), hoje)).rejects.toBe(erro);
    });
  });
});
