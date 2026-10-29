import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

const valido = {
  nome: 'leitora_teste',
  email: 'leitora@example.com',
  dataNascimento: '2000-05-20',
  senha: 'senha123',
  confirmarSenha: 'senha123',
};

async function mensagens(corpo: Record<string, unknown>) {
  const erros = await validate(plainToInstance(CreateUserDto, corpo));
  return erros.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('CreateUserDto', () => {
  it('aceita um corpo válido', async () => {
    expect(await mensagens(valido)).toEqual([]);
  });

  it.each(['nome', 'email', 'dataNascimento', 'senha', 'confirmarSenha'])(
    'rejeita quando "%s" está ausente',
    async (campo) => {
      const corpo: Record<string, unknown> = { ...valido };
      delete corpo[campo];
      expect((await mensagens(corpo)).length).toBeGreaterThan(0);
    },
  );

  it('rejeita nome com mais de 20 caracteres e aceita com exatamente 20', async () => {
    expect(await mensagens({ ...valido, nome: 'a'.repeat(21) })).toContain(
      'O nome deve ter no máximo 20 caracteres.',
    );
    expect(await mensagens({ ...valido, nome: 'a'.repeat(20) })).toEqual([]);
  });

  it('rejeita e-mail inválido', async () => {
    expect(await mensagens({ ...valido, email: 'sem-arroba' })).toContain(
      'Informe um e-mail em formato válido.',
    );
  });

  it('rejeita data fora do formato AAAA-MM-DD', async () => {
    expect(await mensagens({ ...valido, dataNascimento: '20/05/2000' })).toContain(
      'A data de nascimento deve estar no formato AAAA-MM-DD.',
    );
  });

  it('rejeita senha acima de 72 caracteres', async () => {
    expect(await mensagens({ ...valido, senha: 'x'.repeat(73) })).toContain(
      'A senha deve ter no máximo 72 caracteres.',
    );
  });

  it('rejeita tipos errados (número no lugar de texto)', async () => {
    expect((await mensagens({ ...valido, nome: 123 })).length).toBeGreaterThan(0);
  });
});
