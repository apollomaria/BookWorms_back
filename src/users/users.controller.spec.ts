import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  const cadastrar = jest.fn();

  beforeEach(async () => {
    cadastrar.mockReset();
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      // O service é substituído por um dublê: aqui só testamos o controller.
      providers: [{ provide: UsersService, useValue: { cadastrar } }],
    }).compile();

    controller = modulo.get(UsersController);
  });

  it('delega o cadastro ao service e devolve o resultado', async () => {
    const dados = {
      nome: 'a',
      email: 'a@a.com',
      dataNascimento: '2000-01-01',
      senha: 'x',
      confirmarSenha: 'x',
    };
    cadastrar.mockResolvedValue({ mensagem: 'ok' });

    await expect(controller.cadastrar(dados)).resolves.toEqual({ mensagem: 'ok' });
    expect(cadastrar).toHaveBeenCalledWith(dados);
  });
});
