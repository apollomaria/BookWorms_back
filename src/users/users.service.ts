
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async testarConexao() {
    const resultado = await this.databaseService.query(
      'SELECT current_database() AS banco, current_user AS usuario',
    );

    return resultado.rows[0];
  }

  async cadastrar(dados: CreateUserDto) {
    const { nome, email, senha, confirmarSenha } = dados;

    if (
      !nome?.trim() ||
      !email?.trim() ||
      !senha ||
      !confirmarSenha
    ) {
      throw new BadRequestException(
        'Todos os campos são obrigatórios.',
      );
    }

    if (senha !== confirmarSenha) {
      throw new BadRequestException(
        'As senhas não coincidem.',
      );
    }

    const nomeLimpo = nome.trim();
    const emailNormalizado = email.trim().toLowerCase();

    const usuarioExistente = await this.databaseService.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [emailNormalizado],
    );

    if (usuarioExistente.rows.length > 0) {
      throw new ConflictException(
        'Este e-mail já está cadastrado.',
      );
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    try {
      const resultado = await this.databaseService.query(
        `INSERT INTO usuarios (nome, email, senha_hash)
         VALUES ($1, $2, $3)
         RETURNING id, nome, email, criado_em`,
        [nomeLimpo, emailNormalizado, senhaHash],
      );

      return {
        mensagem: 'Usuário cadastrado com sucesso!',
        usuario: resultado.rows[0],
      };
    } catch (erro: unknown) {
      if (
        typeof erro === 'object' &&
        erro !== null &&
        'code' in erro &&
        erro.code === '23505'
      ) {
        throw new ConflictException(
          'Este e-mail já está cadastrado.',
        );
      }

      throw erro;
    }
  }
}