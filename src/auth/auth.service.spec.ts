import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { AuthService } from './auth.service';

describe('AuthService.login (UC001 / RF 006)', () => {
  let service: AuthService;
  const query = jest.fn();

  const usuarioNoBanco = (extra = {}) => ({
    id: 7,
    nome_usuario: 'leitora',
    email: 'leitora@example.com',
    senha_hash: bcrypt.hashSync('senha123', 4),
    ativo: true,
    data_nascimento: '2000-05-20',
    nivel: 1,
    exp: 0,
    criado_em: '2026-01-01T00:00:00Z',
    ...extra,
  });

  beforeEach(async () => {
    query.mockReset();
    const modulo = await Test.createTestingModule({
      providers: [AuthService, { provide: DatabaseService, useValue: { query } }],
    }).compile();
    service = modulo.get(AuthService);
  });

  it('autentica com senha correta e não devolve hash nem flag ativo', async () => {
    query.mockResolvedValueOnce({ rows: [usuarioNoBanco()] });
    const r = await service.login({ login: ' Leitora@Example.com ', senha: 'senha123' });
    expect(r.usuario.id).toBe(7);
    expect(JSON.stringify(r)).not.toMatch(/senha_hash|\$2|ativo/);
    expect(query.mock.calls[0][1]).toEqual(['Leitora@Example.com']); // trim aplicado
  });

  it('A1: senha incorreta -> 401', async () => {
    query.mockResolvedValueOnce({ rows: [usuarioNoBanco()] });
    await expect(service.login({ login: 'leitora', senha: 'errada' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('A1: usuário inexistente -> 401 com a MESMA mensagem da senha errada', async () => {
    query.mockResolvedValueOnce({ rows: [usuarioNoBanco()] });
    const e1 = await service.login({ login: 'leitora', senha: 'errada' }).catch((e) => e);
    query.mockResolvedValueOnce({ rows: [] });
    const e2 = await service.login({ login: 'ninguem', senha: 'senha123' }).catch((e) => e);
    expect(e2).toBeInstanceOf(UnauthorizedException);
    expect(e2.message).toBe(e1.message);
  });

  it('A2: conta desativada com senha correta -> 403', async () => {
    query.mockResolvedValueOnce({ rows: [usuarioNoBanco({ ativo: false })] });
    await expect(service.login({ login: 'leitora', senha: 'senha123' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('conta desativada com senha errada continua sendo 401 (não revela o estado)', async () => {
    query.mockResolvedValueOnce({ rows: [usuarioNoBanco({ ativo: false })] });
    await expect(service.login({ login: 'leitora', senha: 'errada' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
